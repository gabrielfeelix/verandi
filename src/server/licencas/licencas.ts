import type { Db } from '../supabase'
import { ajusteDaLicenca, type AulaDaPessoa, type JanelaDeLicenca } from '@/core/agenda/licenca'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import { localDe } from '../agenda/fuso'
import { avisarQuemEspera } from '../agenda/espera'

/**
 * A licença como período acompanhado (ver `0070_vr_licenca.sql`).
 *
 * Funções sem `'use server'` porque três portas chamam as mesmas regras: a
 * chamada da tela, Pendências e a API do bot. Cada porta traz o seu cliente
 * (com RLS na tela, `service_role` na API) e o seu carimbo.
 */

export type EncerradaPor = 'presenca' | 'operador' | 'bot'

export type LicencaAberta = {
  id: string
  pessoaId: string
  pessoaNome: string
  inicio: string
  voltaPrevista: string | null
  voltouSemReagendarEm: string | null
}

/**
 * Abre a licença, ou atualiza a que já está aberta.
 *
 * Marcar licença na aula de terça e de novo na de quinta é a mesma licença: a
 * segunda marcação só traz a data de volta, se vier uma. Data de volta vazia
 * não apaga a que já existe; quem quer mudar a data usa "Prorrogar".
 */
export async function abrirLicenca(
  db: Db, contaId: string, pessoaId: string,
  opts: { inicio: string; voltaPrevista?: string | null; usuarioId?: string | null },
): Promise<void> {
  const { data: aberta, error } = await db
    .from('licenca').select('id, inicio')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId).is('encerrada_em', null)
    .maybeSingle()
  if (error) throw error

  if (aberta) {
    if (opts.voltaPrevista) {
      const { error: e } = await db.from('licenca')
        .update({ volta_prevista: maiorData(opts.voltaPrevista, aberta.inicio) })
        .eq('id', aberta.id)
      if (e) throw e
    }
  } else {
    const { error: e } = await db.from('licenca').insert({
      conta_id: contaId,
      pessoa_id: pessoaId,
      inicio: opts.inicio,
      volta_prevista: opts.voltaPrevista ? maiorData(opts.voltaPrevista, opts.inicio) : null,
      criado_por_usuario_id: opts.usuarioId ?? null,
    })
    // duas abas marcando ao mesmo tempo: o índice único segura, e a outra já abriu
    if (e && e.code !== '23505') throw e
  }

  await acertarAulas(db, contaId, pessoaId, await licencaDaPessoa(db, contaId, pessoaId))
}

/** Fecha a licença aberta da pessoa, se houver. Devolve se fechou alguma. */
export async function encerrarLicenca(
  db: Db, contaId: string, pessoaIds: string[], por: EncerradaPor,
): Promise<number> {
  if (pessoaIds.length === 0) return 0
  const { data, error } = await db.from('licenca')
    .update({ encerrada_em: new Date().toISOString(), encerrada_por: por })
    .eq('conta_id', contaId).in('pessoa_id', pessoaIds).is('encerrada_em', null)
    .select('pessoa_id')
  if (error) throw error
  // voltou: as aulas futuras que estavam em licença são dela de novo
  for (const l of data ?? []) await acertarAulas(db, contaId, l.pessoa_id, null)
  return data?.length ?? 0
}

/** Muda a data de volta da licença aberta. `null` tira a data. */
export async function prorrogarLicenca(
  db: Db, contaId: string, licencaId: string, voltaPrevista: string | null,
): Promise<void> {
  const { data: l, error } = await db.from('licenca').select('inicio, pessoa_id')
    .eq('conta_id', contaId).eq('id', licencaId).maybeSingle()
  if (error) throw error
  if (!l) return
  const volta = voltaPrevista ? maiorData(voltaPrevista, l.inicio) : null
  const { error: e } = await db.from('licenca')
    .update({
      volta_prevista: volta,
      // nova data é nova combinação: o "voltou e não reagendou" deixa de valer
      voltou_sem_reagendar_em: null,
    })
    .eq('id', licencaId)
  if (e) throw e
  // data maior recolhe mais aulas; data menor devolve as que ficaram fora
  await acertarAulas(db, contaId, l.pessoa_id, { inicio: l.inicio, voltaPrevista: volta })
}

/**
 * Põe as aulas futuras da pessoa de acordo com a licença (ver
 * `ajusteDaLicenca`). `janela` nula é licença encerrada.
 *
 * O carimbo é `sistema`: quem marcou foi a regra, não alguém na chamada. É
 * também o que deixa o "Desfazer" distinguir a aula tocada das que vieram
 * junto.
 *
 * Cada aula que ganhou um lugar avisa a fila de espera interna. O webhook
 * `participacao.cancelada` fica de fora de propósito: o bot trata esse evento
 * como desistência e mandaria mensagem errada para a pessoa afastada.
 */
async function acertarAulas(
  db: Db, contaId: string, pessoaId: string, janela: JanelaDeLicenca | null,
): Promise<void> {
  const agora = new Date()
  const { data: conta, error: erroConta } = await db
    .from('conta').select('fuso').eq('id', contaId).single()
  if (erroConta) throw erroConta

  const { data, error } = await db.from('participacao')
    .select('id, status, sessao_id, sessao:sessao_id!inner(inicio, status)')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .in('status', ['esperada', 'confirmada', 'licenca'])
    .eq('sessao.status', 'prevista')
    .gt('sessao.inicio', agora.toISOString())
  if (error) throw error

  const aulas: AulaDaPessoa[] = (data ?? []).map((p) => ({
    participacaoId: p.id,
    sessaoId: p.sessao_id,
    status: p.status as StatusParticipacao,
    sessaoInicio: p.sessao.inicio,
    data: localDe(p.sessao.inicio, conta.fuso).data,
  }))
  const { paraLicenca, paraEsperada } = ajusteDaLicenca(aulas, janela, agora.getTime())

  const carimbo = {
    registrado_por_origem: 'sistema' as const,
    registrado_por_usuario_id: null,
    registrado_em: agora.toISOString(),
  }
  if (paraLicenca.length) {
    const { error: e } = await db.from('participacao')
      .update({ status: 'licenca', ...carimbo })
      .in('id', paraLicenca.map((a) => a.participacaoId))
    if (e) throw e
    for (const sessaoId of new Set(paraLicenca.map((a) => a.sessaoId))) {
      await avisarQuemEspera(db, contaId, sessaoId)
    }
  }
  if (paraEsperada.length) {
    const { error: e } = await db.from('participacao')
      .update({ status: 'esperada', ...carimbo })
      .in('id', paraEsperada.map((a) => a.participacaoId))
    if (e) throw e
  }
}

export async function licencasAbertas(db: Db, contaId: string): Promise<LicencaAberta[]> {
  const { data, error } = await db.from('licenca')
    .select('id, pessoa_id, inicio, volta_prevista, voltou_sem_reagendar_em, pessoa:pessoa_id(nome)')
    .eq('conta_id', contaId).is('encerrada_em', null)
  if (error) throw error
  return (data ?? []).map((l) => ({
    id: l.id,
    pessoaId: l.pessoa_id,
    pessoaNome: l.pessoa?.nome ?? 'Sem nome',
    inicio: l.inicio,
    voltaPrevista: l.volta_prevista,
    voltouSemReagendarEm: l.voltou_sem_reagendar_em,
  }))
}

/** A licença aberta de uma pessoa, para a ficha e para a API. */
export async function licencaDaPessoa(
  db: Db, contaId: string, pessoaId: string,
): Promise<{ id: string; inicio: string; voltaPrevista: string | null } | null> {
  const { data, error } = await db.from('licenca')
    .select('id, inicio, volta_prevista')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId).is('encerrada_em', null)
    .maybeSingle()
  if (error) throw error
  return data ? { id: data.id, inicio: data.inicio, voltaPrevista: data.volta_prevista } : null
}

/** A volta não pode ser antes do início: a restrição do banco recusaria. */
function maiorData(a: string, b: string) {
  return a >= b ? a : b
}

/**
 * O "Desfazer" de uma licença marcada por engano.
 *
 * Se nenhuma aula da licença aberta continua como licença marcada por alguém,
 * ela nasceu do toque que acabou de ser desfeito, e some. As aulas que a regra
 * recolheu junto (carimbo `sistema`) não contam, e voltam a `esperada`. Apagar
 * e não encerrar: uma licença encerrada no mesmo minuto em que abriu é ruído no
 * histórico da pessoa.
 */
export async function desfazerLicencaSemAula(
  db: Db, contaId: string, pessoaId: string,
): Promise<void> {
  const aberta = await licencaDaPessoa(db, contaId, pessoaId)
  if (!aberta) return
  const { count, error } = await db.from('participacao')
    .select('id, sessao:sessao_id!inner(inicio)', { count: 'exact', head: true })
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId).eq('status', 'licenca')
    .neq('registrado_por_origem', 'sistema')
    .gte('sessao.inicio', `${aberta.inicio}T00:00:00Z`)
  if (error) throw error
  if ((count ?? 0) > 0) return
  const { data: apagada, error: e } = await db.from('licenca').delete()
    .eq('id', aberta.id).is('voltou_sem_reagendar_em', null).select('id')
  if (e) throw e
  if (apagada?.length) await acertarAulas(db, contaId, pessoaId, null)
}
