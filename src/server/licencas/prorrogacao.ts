import type { Db } from '../supabase'
import {
  diasForaNaLicenca, fimProrrogado, prorrogacaoDaLicenca,
} from '@/core/contratos/contrato'

/**
 * A licença que empurra o fim do plano (ver `0074_vr_licenca_prorroga_plano.sql`).
 *
 * Sem `'use server'` pelo mesmo motivo de `licencas.ts`: quem fecha a licença é
 * a chamada, Pendências ou o bot, e cada porta traz o seu cliente.
 */

/**
 * O fim que a ficha mostra: o do contrato em vigor que vence primeiro, já com
 * pausas e licenças devolvidas.
 *
 * `pessoa.vencimento_plano` é uma coluna, e não uma conta feita na hora, porque
 * a lista de alunos filtra "vence esta semana" no banco. Quem muda o fim de um
 * contrato chama isto, senão a lista e a ficha discordam.
 */
export async function escreverVencimentoNaFicha(
  db: Db, contaId: string, pessoaId: string,
): Promise<void> {
  const { data, error } = await db.from('contrato')
    .select('fim, pausa(inicio, fim), licenca(dias_prorrogados)')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .neq('status', 'encerrado')
  if (error) throw error

  const fins = (data ?? [])
    .map((c) => fimProrrogado(
      c.fim,
      (c.pausa ?? []).map((p) => ({ inicio: p.inicio, fim: p.fim })),
      somaDosDias(c.licenca ?? []),
    ))
    .filter((f): f is string => f !== null)
    .sort()

  // o mais próximo é o que a ficha precisa mostrar: é ele que vence primeiro
  const { error: e } = await db.from('pessoa')
    .update({ vencimento_plano: fins[0] ?? null })
    .eq('id', pessoaId).eq('conta_id', contaId)
  if (e) throw e
}

export const somaDosDias = (licencas: Array<{ dias_prorrogados: number | null }>): number =>
  licencas.reduce((total, l) => total + (l.dias_prorrogados ?? 0), 0)

type ContratoCandidato = {
  id: string
  inicio: string
  fim: string | null
  teto: number
}

/**
 * Fechou a licença: devolve os dias ao contrato em vigor no começo dela.
 *
 * O contrato é o que valia quando a pessoa saiu, e não o de hoje: quem saiu no
 * último dia do trimestral e voltou já no semestral teve a licença no
 * trimestral. Sem contrato com teto, nada acontece, e a licença fica sem
 * contrato: plano mensal se renova sozinho e não tem fim para empurrar.
 */
export async function prorrogarPlanoPelaLicenca(
  db: Db, contaId: string, licencaId: string, volta: string,
): Promise<void> {
  const { data: l, error } = await db.from('licenca')
    .select('id, pessoa_id, inicio')
    .eq('conta_id', contaId).eq('id', licencaId).maybeSingle()
  if (error) throw error
  if (!l) return

  const contrato = await contratoDaLicenca(db, contaId, l.pessoa_id, l.inicio)
  if (!contrato) return

  const jaUsados = await diasJaUsados(db, contrato.id, l.id)
  const dias = prorrogacaoDaLicenca(diasForaNaLicenca(l.inicio, volta), contrato.teto, jaUsados)

  const { error: e } = await db.from('licenca')
    .update({ contrato_id: contrato.id, dias_prorrogados: dias })
    .eq('id', l.id)
  if (e) throw e

  await escreverVencimentoNaFicha(db, contaId, l.pessoa_id)
}

/**
 * Corrige à mão quantos dias a licença devolveu.
 *
 * Existe porque a volta registrada nem sempre é a volta: a chamada de quinta
 * lançada na segunda seguinte encerra a licença com quatro dias a mais. O teto
 * continua valendo: corrigir não é jeito de dar mais do que o plano dá.
 */
export async function corrigirProrrogacao(
  db: Db, contaId: string, licencaId: string, dias: number,
): Promise<{ ok: true; dias: number } | { ok: false; erro: string }> {
  const { data: l, error } = await db.from('licenca')
    .select('id, pessoa_id, contrato_id, contrato:contrato_id(plano(dias_licenca))')
    .eq('conta_id', contaId).eq('id', licencaId).maybeSingle()
  if (error) throw error
  if (!l || !l.contrato_id) return { ok: false, erro: 'Esta licença não prorrogou nenhum plano.' }

  const teto = l.contrato?.plano?.dias_licenca ?? 0
  const jaUsados = await diasJaUsados(db, l.contrato_id, l.id)
  const limite = Math.max(0, teto - jaUsados)
  if (!Number.isInteger(dias) || dias < 0) {
    return { ok: false, erro: 'Escreva um número de dias, de 0 para cima.' }
  }
  if (dias > limite) {
    return {
      ok: false,
      erro: limite === teto
        ? `O plano devolve até ${teto} dias de licença.`
        : `O plano devolve até ${teto} dias de licença, e outra licença já usou ${jaUsados}.`,
    }
  }

  const { error: e } = await db.from('licenca')
    .update({ dias_prorrogados: dias }).eq('id', l.id)
  if (e) throw e

  await escreverVencimentoNaFicha(db, contaId, l.pessoa_id)
  return { ok: true, dias }
}

async function diasJaUsados(db: Db, contratoId: string, excluindo: string): Promise<number> {
  const { data, error } = await db.from('licenca')
    .select('dias_prorrogados')
    .eq('contrato_id', contratoId).neq('id', excluindo)
  if (error) throw error
  return somaDosDias(data ?? [])
}

async function contratoDaLicenca(
  db: Db, contaId: string, pessoaId: string, inicioDaLicenca: string,
): Promise<ContratoCandidato | null> {
  const { data, error } = await db.from('contrato')
    .select('id, inicio, fim, pausa(inicio, fim), licenca(dias_prorrogados), plano(dias_licenca)')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .neq('status', 'encerrado')
    .lte('inicio', inicioDaLicenca)
    .order('inicio', { ascending: false })
  if (error) throw error

  for (const c of data ?? []) {
    const teto = c.plano?.dias_licenca ?? 0
    if (teto <= 0) continue
    const fim = fimProrrogado(
      c.fim,
      (c.pausa ?? []).map((p) => ({ inicio: p.inicio, fim: p.fim })),
      somaDosDias(c.licenca ?? []),
    )
    if (fim === null || fim >= inicioDaLicenca) {
      return { id: c.id, inicio: c.inicio, fim: c.fim, teto }
    }
  }
  return null
}
