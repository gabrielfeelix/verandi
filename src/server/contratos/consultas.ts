import type { Db } from '../supabase'
import type { Recorrencia } from '@/core/planos/plano'
import {
  fimProrrogado, saldoDoPacote, type Pausa,
} from '@/core/contratos/contrato'

export type ContratoLinha = {
  id: string
  planoId: string
  planoNome: string
  planoCodigo: string
  servicoNome: string
  recorrencia: Recorrencia
  inicio: string
  /** o fim já com os dias de pausa devolvidos */
  fim: string | null
  diaVencimento: number | null
  precoAplicadoCent: number
  vinculoUsado: boolean
  formaPagamento: string | null
  status: 'ativo' | 'pausado' | 'encerrado'
  pausas: Pausa[]
  /** só existe em contrato de pacote */
  saldo: { usadas: number; restantes: number; acabou: boolean } | null
  /** quantas turmas fixas este contrato ocupa hoje */
  vagasVivas: number
}

/**
 * Os contratos de uma pessoa, do mais novo para o mais velho.
 *
 * O fim que sai daqui já é o **prorrogado**: quem trancou dois meses vê a data
 * nova, não a original, porque é a nova que responde "até quando eu tenho".
 */
export async function contratosDaPessoa(
  db: Db, contaId: string, pessoaId: string,
): Promise<ContratoLinha[]> {
  const { data, error } = await db
    .from('contrato')
    .select(`
      id, plano_id, inicio, fim, dia_vencimento, preco_aplicado_cent,
      vinculo_usado, forma_pagamento, status, sessoes_contratadas,
      plano(codigo, nome, recorrencia, servico(nome)),
      pausa(inicio, fim),
      vaga(id, fim),
      participacao(id, status)
    `)
    .eq('conta_id', contaId)
    .eq('pessoa_id', pessoaId)
    .order('inicio', { ascending: false })

  if (error) throw error

  return (data ?? []).map((c) => {
    const pausas: Pausa[] = (c.pausa ?? []).map((p) => ({
      inicio: p.inicio, fim: p.fim,
    }))

    /*
     * Sessão consumida do pacote é a que **aconteceu**: presença e falta gastam,
     * porque o horário foi reservado e ninguém mais pôde usá-lo. Cancelada pelo
     * negócio não gasta, e é isso que a reposição existe para devolver.
     */
    const usadas = (c.participacao ?? [])
      .filter((p) => p.status === 'presente' || p.status === 'falta'
        || p.status === 'falta_avisada').length

    return {
      id: c.id,
      planoId: c.plano_id,
      planoNome: c.plano?.nome ?? '',
      planoCodigo: c.plano?.codigo ?? '',
      servicoNome: c.plano?.servico?.nome ?? '',
      recorrencia: (c.plano?.recorrencia ?? 'mensal') as Recorrencia,
      inicio: c.inicio,
      fim: fimProrrogado(c.fim, pausas),
      diaVencimento: c.dia_vencimento,
      precoAplicadoCent: c.preco_aplicado_cent,
      vinculoUsado: c.vinculo_usado,
      formaPagamento: c.forma_pagamento,
      status: c.status as 'ativo' | 'pausado' | 'encerrado',
      pausas,
      saldo: saldoDoPacote(c.sessoes_contratadas, usadas),
      vagasVivas: (c.vaga ?? []).filter((v) => v.fim === null).length,
    }
  })
}

/**
 * Esta pessoa já é cliente de **outra** modalidade?
 *
 * É o que decide entre os dois preços do plano, e o documento do cliente é
 * explícito: R$ 195 para quem já faz pilates, R$ 230 para quem só vem para a
 * terapia. "Outra" é a palavra que importa: um segundo contrato da mesma
 * modalidade não é vínculo, é renovação.
 */
export async function temVinculo(
  db: Db, contaId: string, pessoaId: string, servicoId: string, hoje: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('contrato')
    .select('id, fim, plano(servico_id)')
    .eq('conta_id', contaId)
    .eq('pessoa_id', pessoaId)
    .eq('status', 'ativo')

  if (error) throw error

  return (data ?? []).some((c) =>
    c.plano?.servico_id !== servicoId && (c.fim === null || c.fim >= hoje))
}
