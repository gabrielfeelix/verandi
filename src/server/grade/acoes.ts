'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import {
  colisoesDe, linhasDaSerie,
  type Colisao, type NovaSerie, type SerieExistente,
} from '@/core/agenda/serie'

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
  diasSemana: number[],
  ignorarSerieId?: string,
): Promise<SerieExistente[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  let q = db.from('serie')
    .select(`id, dia_semana, hora_inicio, duracao_min, profissional_id, local_id,
             profissional:profissional_id(nome), local:local_id(nome)`)
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .in('dia_semana', diasSemana)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)

  if (ignorarSerieId) q = q.neq('id', ignorarSerieId)

  const { data, error } = await q.returns<LinhaExistente[]>()
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
    const colisoes = colisoesDe(nova, await seriesQueDisputam(db, conta.contaId, dias))
    if (colisoes.length) return { ok: false, colisoes }
  }

  const { data, error } = await db.from('serie')
    .insert(linhasDaSerie({ ...nova, diasSemana: dias }, conta.contaId))
    .select('id')
    .returns<{ id: string }[]>()

  if (error) throw error

  revalidatePath('/grade')
  return { ok: true, ids: (data ?? []).map((l) => l.id) }
}
