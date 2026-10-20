import type { Db } from '../supabase'
import type { Recorrencia } from '@/core/planos/plano'
import {
  fimProrrogado, saldoDoPacote, type Pausa,
} from '@/core/contratos/contrato'
import { somaDosDias } from '../licencas/prorrogacao'

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
  /** as licenças que empurraram o fim deste contrato, e por quantos dias */
  licencas: Array<{ id: string; inicio: string; volta: string | null; dias: number }>
  /** quantos dias de licença o plano devolve, somados no contrato */
  tetoDeLicenca: number
  /** só existe em contrato de pacote */
  saldo: { usadas: number; restantes: number; acabou: boolean } | null
  /** quantas turmas fixas este contrato ocupa hoje */
  vagasVivas: number
  /** o fim como foi vendido, antes de pausa e licença empurrarem */
  fimOriginal: string | null
  descontoCent: number
  descontoMotivo: string | null
  /** o contrato inteiro numa cobrança só (0077) */
  recebidoDeUmaVez: boolean
  /** as turmas fixas que ele ocupa hoje, para o "Ver contrato" */
  horarios: Array<{ dia: number; hora: string; codigo: string | null }>
  criadoEm: string
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
      desconto_cent, desconto_motivo, parcelas, criado_em,
      plano(codigo, nome, recorrencia, dias_licenca, servico(nome)),
      pausa(inicio, fim),
      licenca(id, inicio, encerrada_em, dias_prorrogados),
      vaga(id, fim, serie:serie_id(codigo, dia_semana, hora_inicio)),
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
      fim: fimProrrogado(c.fim, pausas, somaDosDias(c.licenca ?? [])),
      diaVencimento: c.dia_vencimento,
      precoAplicadoCent: c.preco_aplicado_cent,
      vinculoUsado: c.vinculo_usado,
      formaPagamento: c.forma_pagamento,
      status: c.status as 'ativo' | 'pausado' | 'encerrado',
      pausas,
      licencas: (c.licenca ?? [])
        .filter((l) => l.dias_prorrogados !== null)
        .map((l) => ({
          id: l.id,
          inicio: l.inicio,
          volta: l.encerrada_em ? l.encerrada_em.slice(0, 10) : null,
          dias: l.dias_prorrogados ?? 0,
        }))
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
      tetoDeLicenca: c.plano?.dias_licenca ?? 0,
      saldo: saldoDoPacote(c.sessoes_contratadas, usadas),
      vagasVivas: (c.vaga ?? []).filter((v) => v.fim === null).length,
      fimOriginal: c.fim,
      descontoCent: c.desconto_cent ?? 0,
      descontoMotivo: c.desconto_motivo,
      recebidoDeUmaVez: c.parcelas === 1,
      horarios: (c.vaga ?? [])
        .filter((v) => v.fim === null && v.serie)
        .map((v) => {
          const s = v.serie as unknown as { codigo: string | null; dia_semana: number; hora_inicio: string }
          return { dia: s.dia_semana, hora: String(s.hora_inicio).slice(0, 5), codigo: s.codigo }
        })
        // semana começando na segunda, como a Agenda
        .sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7) || a.hora.localeCompare(b.hora)),
      criadoEm: c.criado_em,
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

/**
 * A modalidade que a pessoa faz, para a ficha.
 *
 * Existe separada de `contratosDaPessoa` por causa de **quem lê**. Aquela só é
 * chamada para papel operacional, porque contrato é dinheiro; a modalidade não
 * é: o professor que abre a ficha antes da aula precisa saber se a pessoa faz
 * Pilates aparelho ou Personal, e essa pergunta não tem preço dentro. Chamar a
 * consulta inteira para tirar um nome de serviço traria plano, valor e forma de
 * pagamento para uma tela que não pode mostrá-los.
 *
 * **Vem do contrato, e não da vaga.** A ficha já carrega as vagas com o serviço
 * junto, e tirar a modalidade dali seria de graça, mas em produção a tabela
 * `vaga` está vazia: as 63 pessoas com modalidade têm todas pelo contrato, e
 * nenhuma pela vaga. Tirar da vaga daria branco para todo mundo.
 *
 * Devolve uma lista porque o schema permite mais de um contrato ativo, ainda
 * que hoje ninguém tenha dois: quem chamar decide como mostrar.
 */
/** As modalidades dos contratos ativos, com id: o "Marcar aula" filtra por elas. */
export async function servicosDaPessoa(
  db: Db, contaId: string, pessoaId: string,
): Promise<Array<{ id: string; nome: string }>> {
  const { data, error } = await db
    .from('contrato')
    .select('plano(servico(id, nome))')
    .eq('conta_id', contaId)
    .eq('pessoa_id', pessoaId)
    .eq('status', 'ativo')
  if (error) throw error
  const out: Array<{ id: string; nome: string }> = []
  for (const c of data ?? []) {
    const s = c.plano?.servico
    if (s && !out.some((x) => x.id === s.id)) out.push({ id: s.id, nome: s.nome })
  }
  return out
}

export async function modalidadesDaPessoa(
  db: Db, contaId: string, pessoaId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('contrato')
    .select('plano(servico(nome))')
    .eq('conta_id', contaId)
    .eq('pessoa_id', pessoaId)
    .eq('status', 'ativo')

  if (error) throw error

  const nomes: string[] = []
  for (const c of data ?? []) {
    const nome = c.plano?.servico?.nome
    if (nome && !nomes.includes(nome)) nomes.push(nome)
  }
  return nomes
}
