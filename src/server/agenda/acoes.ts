'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { calcularOcupacao, type StatusParticipacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe } from '@/core/agenda/encaixe'
import type { OrigemParticipacao } from './consultas'
import { semAcento } from '../pessoas/consultas'

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
    .maybeSingle()

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
    .single()
  if (error) throw error

  // a conta decide se a recepção pode abrir exceção; a leitura é aqui e não na
  // tela porque entre mostrar e clicar alguém pode ter mudado a configuração
  const { data: padrao } = await db.from('conta')
    .select('encaixe_acima').eq('id', conta.contaId).single()

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
    .maybeSingle()
  if (error) throw error
  if (data) atualizarTela(data.sessao_id)
}

/**
 * A observação de uma participação: "chegou atrasada", "lesão no ombro".
 *
 * As duas frases moram na mesma caixa e são coisas diferentes: a segunda é dado
 * de saúde, e recepção ler tudo é problema jurídico antes de ser de gosto. Por
 * isso quem escreve escolhe quem lê, **na hora de escrever**, que é o momento
 * em que a pessoa sabe o que está escrevendo.
 *
 * O padrão é `profissionais`, e fecha por decisão: quem anota entre uma turma e
 * outra não vai lembrar de restringir depois, e o erro de deixar aberto é o que
 * não tem volta.
 */
export async function salvarObservacao(
  participacaoId: string,
  observacao: string,
  visivel: 'profissionais' | 'todos' = 'profissionais',
): Promise<void> {
  const { db, conta, carimbo } = await quemRegistra()
  const texto = observacao.trim()

  /*
   * A recepção não sobrescreve o que não pode ler.
   *
   * A tela já esconde o texto restrito, então o campo chegaria vazio e a
   * gravação apagaria a anotação do profissional sem ninguém perceber. Esconder
   * na tela e não barrar aqui seria proteger a leitura e perder o dado.
   */
  if (conta.papel === 'recepcao') {
    const atual = await db.from('participacao')
      .select('observacao, observacao_visivel').eq('id', participacaoId)
      .maybeSingle()
    if (atual.data?.observacao && atual.data.observacao_visivel === 'profissionais') {
      throw new Error('esta observação é de quem atende, e não dá para reescrever daqui')
    }
  }

  const { data, error } = await db
    .from('participacao')
    .update({
      observacao: texto || null,
      observacao_visivel: visivel,
      ...carimbo,
    })
    .eq('id', participacaoId)
    .select('sessao_id')
    .maybeSingle()

  if (error) throw error
  if (data) atualizarTela(data.sessao_id)
}

/**
 * Aponta de qual falta esta participação é a reposição.
 *
 * É o `REP 05/6` da planilha virando chave estrangeira. Sem ele, o controle de
 * quem tem crédito mora na memória de quem escreveu — e some quando essa pessoa
 * entra de férias.
 *
 * Passar `null` desfaz o apontamento. Trocar a origem para `reposicao` junto é
 * de propósito: uma coisa é a consequência da outra, e deixar as duas soltas
 * cria participação marcada como reposição que não repõe nada.
 */
export async function apontarReposicao(
  participacaoId: string,
  faltaId: string | null,
): Promise<void> {
  const { db, carimbo } = await quemRegistra()

  const { data, error } = await db
    .from('participacao')
    .update({
      reposicao_de_id: faltaId,
      ...(faltaId ? { origem: 'reposicao' as const } : {}),
      ...carimbo,
    })
    .eq('id', participacaoId)
    .select('sessao_id')
    .maybeSingle()

  if (error) throw error
  if (data) atualizarTela(data.sessao_id)
}

/**
 * Corrige de onde a pessoa veio: fixo, avulso, reposição, encaixe, reserva.
 *
 * Existe porque quem encaixa às pressas escolhe errado, e origem errada
 * distorce a leitura da turma — a planilha resolvia isso por posição na folha,
 * e a tela precisa de um jeito de consertar.
 */
export async function trocarOrigem(
  participacaoId: string,
  origem: OrigemParticipacao,
): Promise<void> {
  const { db, carimbo } = await quemRegistra()

  const { data, error } = await db
    .from('participacao')
    .update({
      origem,
      // deixar o vínculo pendurado numa participação que não é mais reposição
      // faria a falta continuar contando como já reposta
      ...(origem === 'reposicao' ? {} : { reposicao_de_id: null }),
      ...carimbo,
    })
    .eq('id', participacaoId)
    .select('sessao_id')
    .maybeSingle()

  if (error) throw error
  if (data) atualizarTela(data.sessao_id)
}

/**
 * Troca quem atende **só nesta sessão**.
 *
 * A série continua com o profissional dela: cobrir uma quarta-feira não é mudar
 * a grade. Como `sessao` guarda cópia do profissional, e não referência viva, a
 * troca de hoje não reescreve o que valia em março.
 */
export async function trocarProfissionalDaSessao(
  sessaoId: string,
  profissionalId: string | null,
): Promise<void> {
  const { db } = await quemRegistra()
  const { error } = await db
    .from('sessao')
    .update({ profissional_id: profissionalId })
    .eq('id', sessaoId)
  if (error) throw error
  atualizarTela(sessaoId)
}

/**
 * Quem pode ser encaixado neste horário, procurado pelo nome.
 *
 * Antes a tela da Sessão descia **todas as pessoas ativas da conta** para o
 * navegador, em toda visita, só para o campo de encaixe filtrar no cliente. Um
 * estúdio com 800 cadastros pagava 800 linhas de nome e telefone em cada
 * abertura de chamada, e a busca só começa a valer a partir de duas letras: o
 * caso comum era baixar tudo e usar nada.
 *
 * `nome_busca` é a coluna sem acento da 0034, a mesma que a lista de pessoas
 * usa, então "ceci" acha "Cecília" aqui e lá do mesmo jeito.
 *
 * Oito resultados porque a lista mora dentro de um modal: quem tem dez
 * "Maria Silva" escreve o sobrenome, e não rola uma lista de trinta com a
 * pessoa esperando no balcão.
 */
export async function buscarCandidatos(
  termo: string,
): Promise<Array<{ id: string; nome: string; detalhe: string }>> {
  const busca = termo.trim()
  if (busca.length < 2) return []

  const conta = await exigirConta()
  const db = await clienteServidor()

  const { data, error } = await db
    .from('pessoa')
    .select('id, nome, telefone, identificador_externo')
    .eq('conta_id', conta.contaId)
    .eq('ativo', true)
    .like('nome_busca', `%${semAcento(busca)}%`)
    .order('nome')
    .limit(8)
    
  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    // algo que desambigua: nomes se repetem e são escritos de formas diferentes
    detalhe: p.telefone ?? p.identificador_externo ?? 'sem telefone',
  }))
}
