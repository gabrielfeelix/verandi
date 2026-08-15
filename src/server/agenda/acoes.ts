'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import { encaixarNaSessao, type PedidoDeEncaixe, type ResultadoEncaixe } from './encaixe'
import { avisar } from '../webhook/eventos'
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
  const { db, conta, carimbo } = await quemRegistra()

  const { data, error } = await db
    .from('participacao')
    .update({ status, ...carimbo })
    .eq('id', participacaoId)
    .select('sessao_id')
    .maybeSingle()

  if (error) throw error
  if (!data) return
  atualizarTela(data.sessao_id)

  /*
   * Só os dois status que devolvem a vaga viram evento.
   *
   * "Presente" e "falta" são registro do que aconteceu na sala, e o outro
   * sistema não tem nada a fazer com isso. `falta_avisada` e `cancelada` são o
   * contrário: a vaga abriu, e é exatamente a notícia que faz o bot chamar a
   * próxima pessoa.
   */
  if (status === 'falta_avisada' || status === 'cancelada') {
    await avisar(db, conta.contaId, 'participacao.cancelada', {
      participacaoId, sessaoId: data.sessao_id,
    })
  }
}

/**
 * O encaixe pela tela.
 *
 * A regra não mora mais aqui: ela está em `encaixarNaSessao`, que a rota da API
 * chama com o carimbo do bot. O que sobrou nesta função é o que só a tela tem,
 * que é ler quem está logado e mandar a tela se redesenhar. Ver
 * `docs/planos/12-api-que-escreve.md`.
 */
export async function encaixar(entrada: PedidoDeEncaixe): Promise<ResultadoEncaixe> {
  const { db, conta, carimbo } = await quemRegistra()
  const r = await encaixarNaSessao(db, conta.contaId, carimbo, entrada)
  if (r.ok) atualizarTela(entrada.sessaoId)
  return r
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
  const { db, conta } = await quemRegistra()
  const { error } = await db
    .from('sessao')
    .update({ status: 'cancelada', motivo_cancelamento: motivo })
    .eq('id', sessaoId)
  if (error) throw error
  atualizarTela(sessaoId)

  // é o evento que mais justifica a Fase 4 existir: a aula caiu, e são seis
  // pessoas que precisam saber antes de sair de casa
  await avisar(db, conta.contaId, 'sessao.cancelada', { sessaoId })
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
