'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import type { Atualizacao } from '../banco'

/**
 * Nome é o único campo obrigatório, de propósito.
 *
 * Exigir telefone é o jeito mais rápido de fazer a recepção inventar um
 * número: no dado real, 30% das pessoas não têm telefone cadastrado.
 */
export async function criarPessoa(entrada: {
  nome: string
  telefone?: string
  identificadorExterno?: string
}): Promise<{ id: string }> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const nome = entrada.nome.trim()
  if (!nome) throw new Error('nome é obrigatório')

  const { data, error } = await db.from('pessoa').insert({
    conta_id: conta.contaId,
    nome,
    telefone: entrada.telefone?.trim() || null,
    identificador_externo: entrada.identificadorExterno?.trim() || null,
  }).select('id').single()

  if (error) throw error
  revalidatePath('/pessoas')
  return { id: data.id }
}

export async function editarPessoa(id: string, campos: {
  nome?: string
  telefone?: string | null
  email?: string | null
  identificadorExterno?: string | null
  nascimento?: string | null
  vencimentoPlano?: string | null
  observacao?: string | null
  /** quem lê a observação da ficha; ver `0044` e a barreira logo abaixo */
  observacaoVisivel?: 'profissionais' | 'todos'
  ativo?: boolean
}): Promise<void> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  /*
   * A recepção não sobrescreve a observação que não pode ler.
   *
   * É a mesma barreira de `salvarObservacao` (0043), e existe pelo mesmo
   * motivo: a tela já esconde o texto restrito, então o campo chega vazio e a
   * gravação apagaria a anotação de quem atende sem ninguém perceber. Esconder
   * na leitura e não barrar aqui seria proteger o texto e perder o dado.
   *
   * Vale só quando a observação está no pacote: mudar telefone não deveria
   * esbarrar em nada disso.
   */
  if (conta.papel === 'recepcao' && campos.observacao !== undefined) {
    const atual = await db.from('pessoa')
      .select('observacao, observacao_visivel').eq('id', id)
      .eq('conta_id', conta.contaId)
      .maybeSingle()
    if (atual.data?.observacao && atual.data.observacao_visivel === 'profissionais') {
      throw new Error('esta observação é de quem atende, e não dá para reescrever daqui')
    }
  }

  const linha: Atualizacao<'pessoa'> = {}
  if (campos.nome !== undefined) linha.nome = campos.nome.trim()
  if (campos.telefone !== undefined) linha.telefone = campos.telefone || null
  if (campos.email !== undefined) linha.email = campos.email || null
  if (campos.identificadorExterno !== undefined) {
    linha.identificador_externo = campos.identificadorExterno || null
  }
  if (campos.nascimento !== undefined) linha.nascimento = campos.nascimento || null
  if (campos.vencimentoPlano !== undefined) {
    linha.vencimento_plano = campos.vencimentoPlano || null
  }
  if (campos.observacao !== undefined) linha.observacao = campos.observacao || null
  if (campos.observacaoVisivel !== undefined) {
    linha.observacao_visivel = campos.observacaoVisivel
  }
  if (campos.ativo !== undefined) linha.ativo = campos.ativo

  const { error } = await db.from('pessoa').update(linha).eq('id', id)
  if (error) throw error

  revalidatePath(`/pessoas/${id}`)
  revalidatePath('/pessoas')
}

/**
 * O pedido de exclusão do titular do dado, cumprido sem destruir o negócio.
 *
 * Quem coletou o nome e o telefone foi o cliente, não a 4YU: ele é o
 * controlador, nós somos operador, e ele precisa conseguir atender ao pedido
 * pela tela, sem chamado e sem `psql`.
 *
 * **Apagar de verdade não é opção.** `delete` em `pessoa` leva `participacao`
 * por cascade, e com ela vai a presença de todo mundo naquela turma: a
 * ocupação de fevereiro passa a mentir, e o registro de operação de terceiros
 * some junto. O titular tem direito aos dados dele, não ao histórico do
 * estúdio.
 *
 * Então zera-se o que identifica alguém e mantém-se a linha. Depois disto não
 * há como voltar, e é justamente esse o ponto: dado que se recupera não foi
 * anonimizado.
 *
 * As tags saem junto. "gestante", "pós-operatório" e "idosa" identificam tão
 * bem quanto o nome, e uma tabela ligada por `pessoa_id` é exatamente onde
 * ninguém olha quando pensa em dado pessoal.
 */
export async function anonimizarPessoa(id: string): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta atende a pedido de exclusão')
  }
  const db = await clienteServidor()

  const { error } = await db.from('pessoa').update({
    nome: 'Pessoa removida',
    telefone: null,
    email: null,
    identificador_externo: null,
    nascimento: null,
    observacao: null,
    ativo: false,
    anonimizada_em: new Date().toISOString(),
  }).eq('id', id).eq('conta_id', conta.contaId)
  if (error) throw error

  const tags = await db.from('pessoa_tag').delete().eq('pessoa_id', id)
  if (tags.error) throw tags.error

  // a observação da participação é anotação de terceiro sobre o titular, e vai
  // junto: "lesão no ombro" continua sendo dado dela depois que o nome saiu
  const obs = await db.from('participacao')
    .update({ observacao: null })
    .eq('pessoa_id', id)
    .eq('conta_id', conta.contaId)
    .not('observacao', 'is', null)
  if (obs.error) throw obs.error

  // o nome não entra no log: seria a cópia do dado que acabou de ser apagado
  await registrar(db, {
    contaId: conta.contaId, entidade: 'pessoa', entidadeId: id,
    acao: 'anonimizou',
  })

  revalidatePath(`/pessoas/${id}`)
  revalidatePath('/pessoas')
  revalidatePath('/pendencias')
}

export async function criarVaga(
  serieId: string, pessoaId: string, inicio: string,
): Promise<void> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { error } = await db.from('vaga').insert({
    conta_id: conta.contaId, serie_id: serieId, pessoa_id: pessoaId, inicio,
  })
  if (error) throw error

  revalidatePath(`/pessoas/${pessoaId}`)
  revalidatePath('/semana')
}

/**
 * Encerrar **não apaga o passado**: a vaga ganha data de fim, e o histórico de
 * antes dela continua exatamente como estava.
 */
export async function encerrarVaga(vagaId: string, fim: string): Promise<void> {
  const db = await clienteServidor()
  const { data, error } = await db.from('vaga')
    .update({ fim }).eq('id', vagaId)
    .select('pessoa_id').maybeSingle()
  if (error) throw error
  if (data) revalidatePath(`/pessoas/${data.pessoa_id}`)
}
