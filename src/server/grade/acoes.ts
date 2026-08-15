'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import {
  alcanceDaEdicao, colisoesDe, linhasDaSerie, sessoesOrfas,
  type Colisao, type NovaSerie, type SerieExistente, type SessaoParaReconciliar,
} from '@/core/agenda/serie'
import { diaDaSemanaDe } from '@/core/agenda/datas'
import { hojeEm, localDe } from '../agenda/fuso'
import { registrar } from '../log'
import type { Atualizacao } from '../banco'

/**
 * Montar 70 horários na mão é o pior momento do cliente com o produto. Por isso
 * criar em vários dias de uma vez é a operação principal desta tela, não um
 * atalho.
 */

/** Configuração é de quem manda na conta. A RLS recusa igual; aqui a recusa fala. */
async function exigirDono() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta mexe na grade')
  }
  return conta
}

type LinhaExistente = {
  id: string
  dia_semana: number
  hora_inicio: string
  duracao_min: number
  profissional_id: string | null
  local_id: string | null
  profissional: { nome: string } | null
  local: { nome: string } | null
}

/**
 * As séries que já ocupam os dias pedidos, para conferir colisão.
 *
 * Só as vigentes: série encerrada não disputa horário com ninguém.
 */
async function seriesQueDisputam(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string,
  fuso: string,
  diasSemana: number[],
  ignorarSerieId?: string,
): Promise<SerieExistente[]> {
  const hoje = hojeEm(fuso)
  let q = db.from('serie')
    .select(`id, dia_semana, hora_inicio, duracao_min, profissional_id, local_id,
             profissional:profissional_id(nome), local:local_id(nome)`)
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .in('dia_semana', diasSemana)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)

  if (ignorarSerieId) q = q.neq('id', ignorarSerieId)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((e) => ({
    id: e.id,
    diaSemana: e.dia_semana,
    horaInicio: e.hora_inicio,
    duracaoMin: e.duracao_min,
    profissionalId: e.profissional_id,
    localId: e.local_id,
    nomeProfissional: e.profissional?.nome ?? null,
    nomeLocal: e.local?.nome ?? null,
  }))
}

/**
 * Cria **uma série por dia pedido**, num insert só.
 *
 * Colisão não bloqueia: dois profissionais na mesma sala, ou a mesma pessoa em
 * duas salas por engano, são coisas diferentes e só quem opera sabe qual é.
 * A ação avisa e devolve; quem confirma chama de novo com `confirmarColisao`.
 */
export async function criarSeries(
  nova: NovaSerie,
  opcoes?: { confirmarColisao?: boolean },
): Promise<{ ok: true; ids: string[] } | { ok: false; colisoes: Colisao[] }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const dias = [...new Set(nova.diasSemana)]
  if (!dias.length) throw new Error('escolha ao menos um dia da semana')
  if (!nova.servicoId) throw new Error('escolha o serviço')
  if (nova.capacidade < 1) throw new Error('a capacidade precisa ser ao menos 1')
  if (nova.duracaoMin < 1) throw new Error('a duração precisa ser ao menos 1 minuto')

  if (!opcoes?.confirmarColisao) {
    const colisoes = colisoesDe(
      nova, await seriesQueDisputam(db, conta.contaId, conta.fuso, dias),
    )
    if (colisoes.length) return { ok: false, colisoes }
  }

  const { data, error } = await db.from('serie')
    .insert(linhasDaSerie({ ...nova, diasSemana: dias }, conta.contaId))
    .select('id')
    

  if (error) throw error

  const ids = (data ?? []).map((l) => l.id)
  for (const id of ids) {
    await registrar(db, {
      contaId: conta.contaId, entidade: 'serie', entidadeId: id, acao: 'criou',
      detalhe: { horaInicio: nova.horaInicio, capacidade: nova.capacidade },
    })
  }

  revalidatePath('/grade')
  return { ok: true, ids }
}

// ---------------------------------------------------------------------------
// Editar, duplicar e encerrar
// ---------------------------------------------------------------------------

export type MudancaSerie = {
  servicoId?: string
  profissionalId?: string | null
  localId?: string | null
  diaSemana?: number
  horaInicio?: string
  duracaoMin?: number
  capacidade?: number
}

type SerieAtual = {
  id: string
  conta_id: string
  servico_id: string
  profissional_id: string | null
  local_id: string | null
  dia_semana: number
  hora_inicio: string
  duracao_min: number
  capacidade: number
  vigencia_inicio: string
  vigencia_fim: string | null
}

export type Preview = {
  /** sessões futuras que a edição atualiza */
  sessoesAfetadas: number
  /** sessões futuras que ficam como estão, porque têm decisão registrada */
  sessoesPreservadas: number
  /** sessões futuras que saem da grade e serão canceladas */
  sessoesCanceladas: number
  vagasAtivas: number
  /** a capacidade nova cabe quem já ocupa? */
  capacidadeMenorQueOcupacao: boolean
}

async function carregarSerie(
  db: Awaited<ReturnType<typeof clienteServidor>>, serieId: string,
): Promise<SerieAtual> {
  const { data, error } = await db.from('serie')
    .select(`id, conta_id, servico_id, profissional_id, local_id, dia_semana,
             hora_inicio, duracao_min, capacidade, vigencia_inicio, vigencia_fim`)
    .eq('id', serieId).single()
  if (error) throw error
  return data
}

async function sessoesFuturas(
  db: Awaited<ReturnType<typeof clienteServidor>>, serieId: string,
): Promise<SessaoParaReconciliar[]> {
  const { data, error } = await db.from('sessao')
    .select('id, inicio, status, capacidade')
    .eq('serie_id', serieId)
    .gt('inicio', new Date().toISOString())
    
  if (error) throw error
  return data ?? []
}

async function vagasVivas(
  db: Awaited<ReturnType<typeof clienteServidor>>, serieId: string, hoje: string,
): Promise<number> {
  const { data, error } = await db.from('vaga')
    .select('inicio, fim').eq('serie_id', serieId)
    
  if (error) throw error
  return (data ?? []).filter((v) => v.inicio <= hoje && (v.fim === null || v.fim >= hoje)).length
}

/**
 * A sessão continua coberta pela série depois da mudança?
 *
 * A pergunta é feita em **data e hora locais**: a sessão guarda instante
 * absoluto, e comparar dia da semana em UTC erra a turma da noite.
 */
function fazSeguirCobrindo(mudanca: MudancaSerie, atual: SerieAtual, fuso: string) {
  const dia = mudanca.diaSemana ?? atual.dia_semana
  const hora = (mudanca.horaInicio ?? atual.hora_inicio).slice(0, 5)
  return (s: SessaoParaReconciliar) => {
    const local = localDe(s.inicio, fuso)
    return diaDaSemanaDe(local.data) === dia && local.hora === hora
  }
}

function separar(
  sessoes: SessaoParaReconciliar[], mudanca: MudancaSerie, atual: SerieAtual, fuso: string,
) {
  const agora = new Date()
  const continua = fazSeguirCobrindo(mudanca, atual, fuso)
  const orfas = sessoesOrfas(sessoes, continua, agora)
  const cobertas = sessoes.filter((s) => continua(s))
  const { atualiza, preserva } = alcanceDaEdicao(cobertas, atual.capacidade, agora)
  return { orfas, atualiza, preserva }
}

/**
 * O que vai acontecer se salvar — perguntado **antes**.
 *
 * Editar a grade é a única operação que mexe em dado já materializado, e é a
 * confusão mais provável do sistema inteiro. A tela precisa poder dizer, em
 * números, que o passado não muda e o que sai da grade fica riscado.
 */
export async function previewEdicao(
  serieId: string, mudanca: MudancaSerie,
): Promise<Preview> {
  const conta = await exigirDono()
  const db = await clienteServidor()
  const atual = await carregarSerie(db, serieId)

  const { orfas, atualiza, preserva } = separar(
    await sessoesFuturas(db, serieId), mudanca, atual, conta.fuso,
  )
  const ocupadas = await vagasVivas(db, serieId, hojeEm(conta.fuso))
  const capacidade = mudanca.capacidade ?? atual.capacidade

  return {
    sessoesAfetadas: atualiza.length,
    sessoesPreservadas: preserva.length,
    sessoesCanceladas: orfas.length,
    vagasAtivas: ocupadas,
    capacidadeMenorQueOcupacao: capacidade < ocupadas,
  }
}

/**
 * Edita a série e reconcilia o futuro.
 *
 * O passado nunca muda. Do futuro, muda a sessão que a série ainda cobre e que
 * ninguém decidiu nada sobre; a que saiu da grade é **cancelada com motivo**, e
 * não apagada — some sem explicação é pior que aparecer riscada.
 */
export async function editarSerie(serieId: string, mudanca: MudancaSerie): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()
  const atual = await carregarSerie(db, serieId)

  const linha: Atualizacao<'serie'> = {}
  if (mudanca.servicoId !== undefined) linha.servico_id = mudanca.servicoId
  if (mudanca.profissionalId !== undefined) linha.profissional_id = mudanca.profissionalId
  if (mudanca.localId !== undefined) linha.local_id = mudanca.localId
  if (mudanca.diaSemana !== undefined) linha.dia_semana = mudanca.diaSemana
  if (mudanca.horaInicio !== undefined) linha.hora_inicio = mudanca.horaInicio
  if (mudanca.duracaoMin !== undefined) linha.duracao_min = mudanca.duracaoMin
  if (mudanca.capacidade !== undefined) linha.capacidade = mudanca.capacidade
  if (!Object.keys(linha).length) return

  const { orfas, atualiza } = separar(
    await sessoesFuturas(db, serieId), mudanca, atual, conta.fuso,
  )

  const { error } = await db.from('serie').update(linha).eq('id', serieId)
  if (error) throw error

  if (atualiza.length) {
    const daSessao: Atualizacao<'sessao'> = {}
    if (mudanca.servicoId !== undefined) daSessao.servico_id = mudanca.servicoId
    if (mudanca.profissionalId !== undefined) daSessao.profissional_id = mudanca.profissionalId
    if (mudanca.localId !== undefined) daSessao.local_id = mudanca.localId
    if (mudanca.duracaoMin !== undefined) daSessao.duracao_min = mudanca.duracaoMin
    if (mudanca.capacidade !== undefined) daSessao.capacidade = mudanca.capacidade
    if (Object.keys(daSessao).length) {
      const r = await db.from('sessao').update(daSessao).in('id', atualiza)
      if (r.error) throw r.error
    }
  }

  await cancelarOrfas(db, orfas, 'Horário mudou na grade')

  await registrar(db, {
    contaId: conta.contaId, entidade: 'serie', entidadeId: serieId, acao: 'editou',
    detalhe: { mudanca, sessoesAtualizadas: atualiza.length, sessoesCanceladas: orfas.length },
  })

  revalidatePath('/grade')
  revalidatePath('/semana')
  revalidatePath('/hoje')
}

async function cancelarOrfas(
  db: Awaited<ReturnType<typeof clienteServidor>>, ids: string[], motivo: string,
): Promise<void> {
  if (!ids.length) return
  const { error } = await db.from('sessao')
    .update({ status: 'cancelada', motivo_cancelamento: motivo })
    .in('id', ids)
  if (error) throw error
}

/**
 * Duplicar é como a semana inteira nasce: a mesma turma de 7h costuma acontecer
 * segunda, quarta e sexta. Passa pela mesma conferência de colisão de criar.
 */
export async function duplicarSerie(
  serieId: string, diasSemana: number[], opcoes?: { confirmarColisao?: boolean },
): Promise<{ ok: true; ids: string[] } | { ok: false; colisoes: Colisao[] }> {
  const conta = await exigirDono()
  const db = await clienteServidor()
  const atual = await carregarSerie(db, serieId)

  const r = await criarSeries({
    servicoId: atual.servico_id,
    profissionalId: atual.profissional_id,
    localId: atual.local_id,
    diasSemana,
    horaInicio: atual.hora_inicio.slice(0, 5),
    duracaoMin: atual.duracao_min,
    capacidade: atual.capacidade,
    vigenciaInicio: hojeEm(conta.fuso),
  }, opcoes)

  if (r.ok) {
    await registrar(db, {
      contaId: conta.contaId, entidade: 'serie', entidadeId: serieId, acao: 'duplicou',
      detalhe: { diasSemana, criadas: r.ids.length },
    })
  }
  return r
}

/**
 * Encerrar é `vigencia_fim`, nunca `delete`: apagar a série orfã as sessões e
 * mata o histórico do horário.
 *
 * Com gente na vaga, a primeira chamada recusa e devolve quantas pessoas são —
 * a tela pergunta antes de confirmar.
 */
export async function encerrarSerie(
  serieId: string, fim: string, opcoes?: { confirmar?: boolean },
): Promise<{ ok: true; sessoesCanceladas: number } | { ok: false; vagasAtivas: number }> {
  const conta = await exigirDono()
  const db = await clienteServidor()
  const atual = await carregarSerie(db, serieId)

  if (fim < atual.vigencia_inicio) {
    throw new Error('a data de fim não pode ser anterior ao começo da série')
  }

  const ocupadas = await vagasVivas(db, serieId, hojeEm(conta.fuso))
  if (ocupadas > 0 && !opcoes?.confirmar) return { ok: false, vagasAtivas: ocupadas }

  const { error } = await db.from('serie').update({ vigencia_fim: fim }).eq('id', serieId)
  if (error) throw error

  // o que já foi materializado depois da data de fim sai da grade
  const futuras = await sessoesFuturas(db, serieId)
  const orfas = sessoesOrfas(
    futuras,
    (s) => localDe(s.inicio, conta.fuso).data <= fim,
    new Date(),
  )
  await cancelarOrfas(db, orfas, 'Horário encerrado na grade')

  await registrar(db, {
    contaId: conta.contaId, entidade: 'serie', entidadeId: serieId, acao: 'encerrou',
    detalhe: { fim, vagasAtivas: ocupadas, sessoesCanceladas: orfas.length },
  })

  revalidatePath('/grade')
  revalidatePath('/semana')
  revalidatePath('/hoje')
  return { ok: true, sessoesCanceladas: orfas.length }
}

/**
 * Quem tem vaga fixa nesta série, agora.
 *
 * É a pergunta que sempre antecede encerrar ou mudar horário — "quem vou
 * atrapalhar?" — e antes dela só havia o número. Nome é o que permite avisar;
 * `4 vagas` não permite.
 *
 * Sob demanda, e não junto da lista: setenta séries × cinco nomes é uma
 * carga que a tela de configuração não precisa pagar toda vez que abre.
 */
export async function quemOcupa(serieId: string): Promise<
  Array<{ pessoaId: string; nome: string; desde: string }>
> {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)

  const { data, error } = await db
    .from('vaga')
    .select('pessoa_id, inicio, fim, pessoa:pessoa_id(nome)')
    .eq('conta_id', conta.contaId)
    .eq('serie_id', serieId)
    .or(`fim.is.null,fim.gte.${hoje}`)
    
  if (error) throw error

  return (data ?? [])
    .filter((v) => v.pessoa !== null)
    .map((v) => ({ pessoaId: v.pessoa_id, nome: v.pessoa!.nome, desde: v.inicio }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
