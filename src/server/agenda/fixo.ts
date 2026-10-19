'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { localDe } from './fuso'
import { incluirVagasNasSessoes, tirarDasAulasDepoisDoFim } from './materializar'
import { avisarQuemEspera } from './espera'

/**
 * O horário fixo a partir da tela da aula.
 *
 * Até 19/10/2026 o "fica aqui toda semana" só existia na ficha da pessoa, e
 * quem estava na aula não achava: o Daniel (MGM) tentou pôr a Luz Marina na
 * segunda 10h pela aula e não conseguiu, e o Renovar do contrato virou o jeito
 * de "editar". Sugestão do Eduardo: Fixo como uma das origens do encaixe.
 */

type Resultado =
  | { ok: true }
  | { ok: false; motivo: 'lotada'; ocupadas: number; capacidade: number }
  | { ok: false; motivo: 'erro'; erro: string }

function podeOperar(papel: string): boolean {
  return papel === 'dono' || papel === 'recepcao' || papel === 'suporte'
}

/**
 * Põe a pessoa no horário fixo desta aula, a partir desta aula.
 *
 * Turma cheia não entra calada: volta `lotada`, e com `aumentarTurma` a turma
 * ganha o lugar (na grade e nas aulas que ainda vão acontecer), porque um fixo
 * acima da capacidade é a turma que cresceu, não um encaixe de um dia.
 */
export async function fixarNoHorario(
  sessaoId: string, pessoaId: string, aumentarTurma = false,
): Promise<Resultado> {
  try {
    const conta = await exigirConta()
    if (!podeOperar(conta.papel)) {
      return { ok: false, motivo: 'erro', erro: 'Quem põe horário fixo é a recepção ou quem responde pelo negócio.' }
    }
    const db = await clienteServidor()

    const { data: sessao } = await db.from('sessao')
      .select('serie_id, inicio, serie:serie_id(id, capacidade, servico_id)')
      .eq('id', sessaoId).eq('conta_id', conta.contaId).maybeSingle()
    const serie = sessao?.serie as unknown as { id: string; capacidade: number; servico_id: string } | null
    if (!sessao || !serie) {
      return { ok: false, motivo: 'erro', erro: 'Esta aula não é da grade fixa: não há "toda semana" para ela.' }
    }
    const desde = localDe(sessao.inicio, conta.fuso).data

    const { data: vagas } = await db.from('vaga')
      .select('pessoa_id')
      .eq('conta_id', conta.contaId).eq('serie_id', serie.id)
      .or(`fim.is.null,fim.gte.${desde}`)
    const ativas = vagas ?? []
    if (ativas.some((v) => v.pessoa_id === pessoaId)) {
      return { ok: false, motivo: 'erro', erro: 'Esta pessoa já tem este horário fixo.' }
    }

    if (ativas.length >= serie.capacidade) {
      if (!aumentarTurma) {
        return { ok: false, motivo: 'lotada', ocupadas: ativas.length, capacidade: serie.capacidade }
      }
      const nova = ativas.length + 1
      const { error: erroSerie } = await db.from('serie')
        .update({ capacidade: nova }).eq('id', serie.id).eq('conta_id', conta.contaId)
      if (erroSerie) throw erroSerie
      const { error: erroSessoes } = await db.from('sessao')
        .update({ capacidade: nova })
        .eq('conta_id', conta.contaId).eq('serie_id', serie.id).eq('status', 'prevista')
        .gte('inicio', sessao.inicio).lt('capacidade', nova)
      if (erroSessoes) throw erroSessoes
    }

    // o contrato em vigor da mesma modalidade, quando houver: é ele que paga o horário
    const { data: contrato } = await db.from('contrato')
      .select('id, plano!inner(servico_id)')
      .eq('conta_id', conta.contaId).eq('pessoa_id', pessoaId).eq('status', 'ativo')
      .eq('plano.servico_id', serie.servico_id)
      .order('inicio', { ascending: false }).limit(1).maybeSingle()

    const { error } = await db.from('vaga').insert({
      conta_id: conta.contaId, serie_id: serie.id, pessoa_id: pessoaId, inicio: desde,
      contrato_id: contrato?.id ?? null,
    })
    if (error) throw error
    await incluirVagasNasSessoes(db, conta.contaId, conta.fuso, [
      { serie_id: serie.id, pessoa_id: pessoaId, inicio: desde },
    ])

    revalidatePath(`/sessao/${sessaoId}`)
    revalidatePath(`/pessoas/${pessoaId}`)
    revalidatePath('/semana')
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: 'erro', erro: e instanceof Error ? e.message : 'Não foi possível pôr no horário fixo.' }
  }
}

/**
 * Tira a pessoa do horário fixo a partir desta aula.
 *
 * Encerra a vaga na véspera, então esta aula e as próximas soltam o lugar. O
 * passado fica como estava, igual ao "Encerrar" da ficha.
 */
export async function tirarDoHorarioFixo(participacaoId: string): Promise<void> {
  const conta = await exigirConta()
  if (!podeOperar(conta.papel)) {
    throw new Error('Quem tira do horário fixo é a recepção ou quem responde pelo negócio.')
  }
  const db = await clienteServidor()

  const { data: p } = await db.from('participacao')
    .select('pessoa_id, sessao:sessao_id(serie_id, inicio)')
    .eq('id', participacaoId).eq('conta_id', conta.contaId).maybeSingle()
  const sessao = p?.sessao as unknown as { serie_id: string | null; inicio: string } | null
  if (!p || !sessao?.serie_id) throw new Error('Esta aula não é da grade fixa.')

  const dia = localDe(sessao.inicio, conta.fuso).data
  const vespera = new Date(`${dia}T12:00:00Z`)
  vespera.setUTCDate(vespera.getUTCDate() - 1)
  const fim = vespera.toISOString().slice(0, 10)

  const { data: vaga } = await db.from('vaga')
    .select('id, inicio')
    .eq('conta_id', conta.contaId).eq('serie_id', sessao.serie_id).eq('pessoa_id', p.pessoa_id)
    .or(`fim.is.null,fim.gte.${dia}`)
    .order('inicio', { ascending: false }).limit(1).maybeSingle()
  if (!vaga) throw new Error('Esta pessoa não tem horário fixo nesta turma.')

  // Fixo que começou nesta aula some inteiro: fim antes do início não existe.
  const { data: encerrada, error } = vaga.inicio > fim
    ? await db.from('vaga').delete().eq('id', vaga.id).select('serie_id, pessoa_id').maybeSingle()
        .then((r) => ({ ...r, data: r.data ? { ...r.data, fim: fim } : null }))
    : await db.from('vaga').update({ fim }).eq('id', vaga.id)
        .select('serie_id, pessoa_id, fim').maybeSingle()
  if (error) throw error
  if (!encerrada) return

  const sessoes = await tirarDasAulasDepoisDoFim(db, conta.contaId, conta.fuso, [encerrada])
  for (const id of sessoes) await avisarQuemEspera(db, conta.contaId, id)
  revalidatePath(`/pessoas/${p.pessoa_id}`)
  revalidatePath('/semana')
}
