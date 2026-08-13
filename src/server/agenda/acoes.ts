'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { calcularOcupacao, type StatusParticipacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe } from '@/core/agenda/encaixe'
import type { OrigemParticipacao } from './consultas'

/** De qual lado do balcão veio o registro. Serve auditoria, não permissão. */
async function quemRegistra() {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  return {
    db,
    conta,
    carimbo: {
      registrado_por_usuario_id: user?.id ?? null,
      registrado_por_origem:
        conta.papel === 'profissional' ? ('profissional' as const) : ('recepcao' as const),
      registrado_em: new Date().toISOString(),
    },
  }
}

function atualizarTela(sessaoId: string) {
  revalidatePath(`/sessao/${sessaoId}`)
  revalidatePath('/hoje')
  revalidatePath('/semana')
}

/**
 * Marca como presente **só quem ainda não foi decidido**.
 *
 * Não sobrescrever quem já está como falta é deliberado: o professor às vezes
 * marca a exceção primeiro e só depois usa o botão. Perder esse registro seria
 * pior que exigir um toque a mais.
 */
export async function marcarTodosPresentes(sessaoId: string): Promise<{ marcadas: number }> {
  const { db, carimbo } = await quemRegistra()

  const { data, error } = await db
    .from('participacao')
    .update({ status: 'presente', ...carimbo })
    .eq('sessao_id', sessaoId)
    .in('status', ['esperada', 'confirmada'])
    .select('id')

  if (error) throw error
  atualizarTela(sessaoId)
  return { marcadas: data?.length ?? 0 }
}

export async function mudarStatus(
  participacaoId: string,
  status: StatusParticipacao,
): Promise<void> {
  const { db, carimbo } = await quemRegistra()

  const { data, error } = await db
    .from('participacao')
    .update({ status, ...carimbo })
    .eq('id', participacaoId)
    .select('sessao_id')
    .maybeSingle<{ sessao_id: string }>()

  if (error) throw error
  if (data) atualizarTela(data.sessao_id)
}

export type ResultadoEncaixe =
  | { ok: true }
  | { ok: false; motivo: 'lotada' | 'ja_participa' | 'acima_da_capacidade' }

/**
 * Confere a vaga **na hora de gravar**, relendo a ocupação — não confia no que
 * a tela mostrava. Entre mostrar e clicar, alguém pode ter ocupado.
 */
export async function encaixar(entrada: {
  sessaoId: string
  pessoaId: string
  origem: Exclude<OrigemParticipacao, 'recorrente'>
  reposicaoDeId?: string
  /** o usuário viu que passa da capacidade e confirmou mesmo assim */
  confirmarAcima?: boolean
}): Promise<ResultadoEncaixe> {
  const { db, conta, carimbo } = await quemRegistra()

  const { data: sessao, error } = await db
    .from('sessao')
    .select('capacidade, participacao(pessoa_id, status)')
    .eq('id', entrada.sessaoId)
    .single<{
      capacidade: number
      participacao: { pessoa_id: string; status: StatusParticipacao }[]
    }>()
  if (error) throw error

  // a conta decide se a recepção pode abrir exceção; a leitura é aqui e não na
  // tela porque entre mostrar e clicar alguém pode ter mudado a configuração
  const { data: padrao } = await db.from('conta')
    .select('encaixe_acima').eq('id', conta.contaId).single<{ encaixe_acima: boolean }>()

  const jaParticipa = sessao.participacao.some((p) => p.pessoa_id === entrada.pessoaId)
  const ocupacao = calcularOcupacao(
    sessao.capacidade,
    sessao.participacao.map((p) => p.status),
  )
  const veredito = avaliarEncaixe(ocupacao, jaParticipa, padrao?.encaixe_acima ?? false)
  if (!veredito.cabe) return { ok: false, motivo: veredito.motivo! }

  /*
   * Encaixe acima da capacidade **exige confirmação explícita**.
   *
   * Sem isto, a tela mostraria 4/4 e a pessoa clicaria achando que havia vaga —
   * e o excedente viraria acidente em vez de decisão. Quem confirma sabe o que
   * está fazendo, e o registro guarda quem foi.
   */
  if (veredito.acimaDaCapacidade && !entrada.confirmarAcima) {
    return { ok: false, motivo: 'acima_da_capacidade' }
  }

  const { error: erroInsert } = await db.from('participacao').insert({
    conta_id: conta.contaId,
    sessao_id: entrada.sessaoId,
    pessoa_id: entrada.pessoaId,
    origem: entrada.origem,
    status: 'esperada',
    reposicao_de_id: entrada.reposicaoDeId ?? null,
    ...carimbo,
  })
  if (erroInsert) throw erroInsert

  atualizarTela(entrada.sessaoId)
  return { ok: true }
}

/**
 * A única forma de abrir vaga em sessão lotada.
 *
 * Muda a capacidade **daquele dia**, não da série — é o que mantém o número
 * verdadeiro para a tela, a busca e o bot ao mesmo tempo.
 */
export async function ajustarCapacidade(sessaoId: string, capacidade: number): Promise<void> {
  if (!Number.isInteger(capacidade) || capacidade < 1) {
    throw new Error('capacidade tem que ser inteiro positivo')
  }
  const { db } = await quemRegistra()
  const { error } = await db.from('sessao').update({ capacidade }).eq('id', sessaoId)
  if (error) throw error
  atualizarTela(sessaoId)
}

export async function cancelarSessao(sessaoId: string, motivo: string): Promise<void> {
  const { db } = await quemRegistra()
  const { error } = await db
    .from('sessao')
    .update({ status: 'cancelada', motivo_cancelamento: motivo })
    .eq('id', sessaoId)
  if (error) throw error
  atualizarTela(sessaoId)
}

export async function reabrirSessao(sessaoId: string): Promise<void> {
  const { db } = await quemRegistra()
  const { error } = await db
    .from('sessao')
    .update({ status: 'prevista', motivo_cancelamento: null })
    .eq('id', sessaoId)
  if (error) throw error
  atualizarTela(sessaoId)
}

export async function removerParticipacao(participacaoId: string): Promise<void> {
  const { db } = await quemRegistra()
  const { data, error } = await db
    .from('participacao')
    .delete()
    .eq('id', participacaoId)
    .select('sessao_id')
    .maybeSingle<{ sessao_id: string }>()
  if (error) throw error
  if (data) atualizarTela(data.sessao_id)
}
