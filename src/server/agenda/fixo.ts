'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { hojeEm, instante, localDe } from './fuso'
import { incluirVagasNasSessoes, tirarDasAulasDepoisDoFim } from './materializar'
import { avisarQuemEspera } from './espera'

/**
 * O horário fixo, pela Nova aula e pela tela da aula.
 *
 * Até 19/10/2026 o "fica aqui toda semana" só existia na ficha da pessoa e não
 * olhava o contrato: o Daniel (MGM) tentou pôr a Luz Marina na segunda 10h e
 * não conseguiu, e o Renovar virou o jeito de "editar" (dois trimestrais
 * criados sem querer).
 *
 * **O fixo não muda o contrato, ele usa o contrato.** O plano diz quantas aulas
 * por semana a pessoa paga e em que dias; cada horário fixo ocupa uma delas, e
 * a cobrança continua saindo do contrato. Por isso fixar confere, antes:
 * sobra aula na semana? o dia é permitido? existe contrato?
 */

const OPERA = new Set(['dono', 'recepcao', 'suporte'])

export type Turma = {
  id: string
  codigo: string | null
  dia: number
  hora: string
  profissional: string | null
  capacidade: number
  ocupadas: number
}

export type HorarioFixo = { vagaId: string; serieId: string; dia: number; hora: string; codigo: string | null }

export type SituacaoDoContrato = {
  contrato: {
    id: string
    plano: string
    /** `null`: o plano não limita aulas por semana (pacote, avulsa) */
    porSemana: number | null
    /** dias da semana permitidos (0 = domingo); `null`: todos */
    dias: number[] | null
  } | null
  /** os horários fixos dela nesta modalidade, valendo hoje ou depois */
  usados: HorarioFixo[]
}

export type ResultadoFixo =
  | { ok: true; sessaoId: string | null }
  | { ok: false; motivo: 'lotada'; ocupadas: number; capacidade: number }
  | { ok: false; motivo: 'limite'; plano: string; porSemana: number; usados: HorarioFixo[] }
  | { ok: false; motivo: 'sem_contrato' }
  | { ok: false; motivo: 'dia_nao_permitido'; plano: string; dias: number[] }
  | { ok: false; motivo: 'erro'; erro: string }

type Db = Awaited<ReturnType<typeof clienteServidor>>

/** As turmas da grade fixa de uma modalidade, com a lotação de hoje. */
export async function turmasDaModalidade(servicoId: string): Promise<Turma[]> {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)
  const { data: series } = await db.from('serie')
    .select('id, codigo, dia_semana, hora_inicio, capacidade, vigencia_fim, profissional:profissional_id(nome)')
    .eq('conta_id', conta.contaId).eq('servico_id', servicoId).eq('ativo', true)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)
  const ids = (series ?? []).map((s) => s.id)
  if (ids.length === 0) return []
  const { data: vagas } = await db.from('vaga')
    .select('serie_id').eq('conta_id', conta.contaId).in('serie_id', ids)
    .or(`fim.is.null,fim.gte.${hoje}`)
  const ocupadas = new Map<string, number>()
  for (const v of vagas ?? []) ocupadas.set(v.serie_id, (ocupadas.get(v.serie_id) ?? 0) + 1)
  return (series ?? [])
    .map((s) => ({
      id: s.id,
      codigo: s.codigo ?? null,
      dia: s.dia_semana,
      hora: String(s.hora_inicio).slice(0, 5),
      profissional: (s.profissional as unknown as { nome: string } | null)?.nome ?? null,
      capacidade: s.capacidade,
      ocupadas: ocupadas.get(s.id) ?? 0,
    }))
    // segunda primeiro, domingo por último, e por hora dentro do dia
    .sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7) || a.hora.localeCompare(b.hora))
}

async function lerSituacao(
  db: Db, contaId: string, pessoaId: string, servicoId: string, desde: string,
): Promise<SituacaoDoContrato> {
  const [{ data: contrato }, { data: vagas }] = await Promise.all([
    db.from('contrato')
      .select('id, plano!inner(nome, servico_id, frequencia_semanal, dias_permitidos)')
      .eq('conta_id', contaId).eq('pessoa_id', pessoaId).eq('status', 'ativo')
      .eq('plano.servico_id', servicoId)
      .order('inicio', { ascending: false }).limit(1).maybeSingle(),
    db.from('vaga')
      .select('id, serie:serie_id!inner(id, codigo, dia_semana, hora_inicio, servico_id)')
      .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
      .eq('serie.servico_id', servicoId)
      .or(`fim.is.null,fim.gte.${desde}`),
  ])
  const plano = contrato?.plano as unknown as {
    nome: string; frequencia_semanal: number | null; dias_permitidos: number[] | null
  } | undefined
  return {
    contrato: contrato && plano
      ? {
          id: contrato.id,
          plano: plano.nome,
          porSemana: plano.frequencia_semanal,
          dias: plano.dias_permitidos?.length ? plano.dias_permitidos : null,
        }
      : null,
    usados: (vagas ?? []).map((v) => {
      const s = v.serie as unknown as { id: string; codigo: string | null; dia_semana: number; hora_inicio: string }
      return { vagaId: v.id, serieId: s.id, dia: s.dia_semana, hora: String(s.hora_inicio).slice(0, 5), codigo: s.codigo }
    }),
  }
}

/** O contrato da pessoa nesta modalidade e quantos horários fixos ele já usa. */
export async function situacaoDoContrato(pessoaId: string, servicoId: string): Promise<SituacaoDoContrato> {
  const conta = await exigirConta()
  const db = await clienteServidor()
  return lerSituacao(db, conta.contaId, pessoaId, servicoId, hojeEm(conta.fuso))
}

/** Encerra a vaga na véspera de `desde`; se ela nem começou, some inteira. */
async function encerrarAntes(db: Db, contaId: string, fuso: string, vagaId: string, desde: string) {
  const vespera = new Date(`${desde}T12:00:00Z`)
  vespera.setUTCDate(vespera.getUTCDate() - 1)
  const fim = vespera.toISOString().slice(0, 10)
  const { data: vaga } = await db.from('vaga').select('id, inicio, serie_id, pessoa_id')
    .eq('id', vagaId).eq('conta_id', contaId).maybeSingle()
  if (!vaga) return
  if (vaga.inicio > fim) {
    const { error } = await db.from('vaga').delete().eq('id', vaga.id)
    if (error) throw error
  } else {
    const { error } = await db.from('vaga').update({ fim }).eq('id', vaga.id)
    if (error) throw error
  }
  const sessoes = await tirarDasAulasDepoisDoFim(db, contaId, fuso, [
    { serie_id: vaga.serie_id, pessoa_id: vaga.pessoa_id, fim },
  ])
  for (const id of sessoes) await avisarQuemEspera(db, contaId, id)
}

/**
 * Põe a pessoa numa turma da grade fixa, a partir de `desde`.
 *
 * Volta um motivo em vez de gravar quando a decisão é de quem está no balcão:
 * turma cheia (`aumentarTurma` cresce a turma), contrato sem aula sobrando
 * (`trocarVagaId` troca um horário dela por este), sem contrato
 * (`semContrato` segue mesmo assim, aula sem cobrança) e dia fora do plano
 * (esse não tem "mesmo assim": muda o plano antes).
 */
export async function fixarNaTurma(e: {
  serieId: string
  pessoaId: string
  desde: string
  aumentarTurma?: boolean
  trocarVagaId?: string
  semContrato?: boolean
}): Promise<ResultadoFixo> {
  try {
    const conta = await exigirConta()
    if (!OPERA.has(conta.papel)) {
      return { ok: false, motivo: 'erro', erro: 'Quem põe horário fixo é a recepção ou quem responde pelo negócio.' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.desde)) return { ok: false, motivo: 'erro', erro: 'Diga a partir de quando.' }
    const db = await clienteServidor()

    const { data: serie } = await db.from('serie')
      .select('id, capacidade, servico_id, dia_semana')
      .eq('id', e.serieId).eq('conta_id', conta.contaId).maybeSingle()
    if (!serie) return { ok: false, motivo: 'erro', erro: 'Esta turma não existe mais.' }

    const situacao = await lerSituacao(db, conta.contaId, e.pessoaId, serie.servico_id, e.desde)
    if (situacao.usados.some((u) => u.serieId === serie.id)) {
      return { ok: false, motivo: 'erro', erro: 'Esta pessoa já tem este horário fixo.' }
    }
    const c = situacao.contrato
    if (!c && !e.semContrato) return { ok: false, motivo: 'sem_contrato' }
    if (c?.dias && !c.dias.includes(serie.dia_semana)) {
      return { ok: false, motivo: 'dia_nao_permitido', plano: c.plano, dias: c.dias }
    }
    const trocando = e.trocarVagaId ? situacao.usados.find((u) => u.vagaId === e.trocarVagaId) : undefined
    if (c?.porSemana && situacao.usados.length >= c.porSemana && !trocando) {
      return { ok: false, motivo: 'limite', plano: c.plano, porSemana: c.porSemana, usados: situacao.usados }
    }

    const { data: vagas } = await db.from('vaga').select('id')
      .eq('conta_id', conta.contaId).eq('serie_id', serie.id)
      .or(`fim.is.null,fim.gte.${e.desde}`)
    const ocupadas = (vagas ?? []).length
    if (ocupadas >= serie.capacidade) {
      if (!e.aumentarTurma) return { ok: false, motivo: 'lotada', ocupadas, capacidade: serie.capacidade }
      const nova = ocupadas + 1
      const { error: erroSerie } = await db.from('serie')
        .update({ capacidade: nova }).eq('id', serie.id).eq('conta_id', conta.contaId)
      if (erroSerie) throw erroSerie
      const { error: erroSessoes } = await db.from('sessao')
        .update({ capacidade: nova })
        .eq('conta_id', conta.contaId).eq('serie_id', serie.id).eq('status', 'prevista')
        .gte('inicio', instante(e.desde, '00:00', conta.fuso)).lt('capacidade', nova)
      if (erroSessoes) throw erroSessoes
    }

    if (trocando) await encerrarAntes(db, conta.contaId, conta.fuso, trocando.vagaId, e.desde)

    const { error } = await db.from('vaga').insert({
      conta_id: conta.contaId, serie_id: serie.id, pessoa_id: e.pessoaId, inicio: e.desde,
      contrato_id: c?.id ?? null,
    })
    if (error) throw error
    await incluirVagasNasSessoes(db, conta.contaId, conta.fuso, [
      { serie_id: serie.id, pessoa_id: e.pessoaId, inicio: e.desde },
    ])

    const { data: primeira } = await db.from('sessao').select('id')
      .eq('conta_id', conta.contaId).eq('serie_id', serie.id).eq('status', 'prevista')
      .gte('inicio', instante(e.desde, '00:00', conta.fuso))
      .order('inicio').limit(1).maybeSingle()

    revalidatePath(`/pessoas/${e.pessoaId}`)
    revalidatePath('/semana')
    return { ok: true, sessaoId: primeira?.id ?? null }
  } catch (erro) {
    return { ok: false, motivo: 'erro', erro: erro instanceof Error ? erro.message : 'Não foi possível pôr no horário fixo.' }
  }
}

/** O Fixo do Encaixar: a turma e a data saem da aula aberta. */
export async function fixarNoHorario(
  sessaoId: string, pessoaId: string,
  opcoes: { aumentarTurma?: boolean; trocarVagaId?: string; semContrato?: boolean } = {},
): Promise<ResultadoFixo> {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const { data: sessao } = await db.from('sessao').select('serie_id, inicio')
    .eq('id', sessaoId).eq('conta_id', conta.contaId).maybeSingle()
  if (!sessao?.serie_id) {
    return { ok: false, motivo: 'erro', erro: 'Esta aula não é da grade fixa: não há "toda semana" para ela.' }
  }
  const r = await fixarNaTurma({
    serieId: sessao.serie_id, pessoaId, desde: localDe(sessao.inicio, conta.fuso).data, ...opcoes,
  })
  if (r.ok) revalidatePath(`/sessao/${sessaoId}`)
  return r
}

/**
 * Tira a pessoa do horário fixo a partir desta aula.
 *
 * Encerra a vaga na véspera, então esta aula e as próximas soltam o lugar. O
 * passado fica como estava, igual ao "Encerrar" da ficha.
 */
export async function tirarDoHorarioFixo(participacaoId: string): Promise<void> {
  const conta = await exigirConta()
  if (!OPERA.has(conta.papel)) {
    throw new Error('Quem tira do horário fixo é a recepção ou quem responde pelo negócio.')
  }
  const db = await clienteServidor()
  const { data: p } = await db.from('participacao')
    .select('pessoa_id, sessao:sessao_id(serie_id, inicio)')
    .eq('id', participacaoId).eq('conta_id', conta.contaId).maybeSingle()
  const sessao = p?.sessao as unknown as { serie_id: string | null; inicio: string } | null
  if (!p || !sessao?.serie_id) throw new Error('Esta aula não é da grade fixa.')

  const dia = localDe(sessao.inicio, conta.fuso).data
  const { data: vaga } = await db.from('vaga').select('id')
    .eq('conta_id', conta.contaId).eq('serie_id', sessao.serie_id).eq('pessoa_id', p.pessoa_id)
    .or(`fim.is.null,fim.gte.${dia}`)
    .order('inicio', { ascending: false }).limit(1).maybeSingle()
  if (!vaga) throw new Error('Esta pessoa não tem horário fixo nesta turma.')

  await encerrarAntes(db, conta.contaId, conta.fuso, vaga.id, dia)
  revalidatePath(`/pessoas/${p.pessoa_id}`)
  revalidatePath('/semana')
}
