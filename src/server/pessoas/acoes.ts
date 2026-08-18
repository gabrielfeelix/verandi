'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { inserirPessoa } from './registro'
import type { Atualizacao } from '../banco'
import { erroDoTelefone, normalizarTelefone } from '@/core/telefone'
import { cpfValido, soDigitosCpf } from '@/core/pessoas/documento'
import { LIMITE_ENVIO_MB, MB } from '@/core/foto'
import { limparAvaliacoesDaPessoa } from '../avaliacao/registro'

/**
 * Cadastrar pela tela.
 *
 * A regra mora em `inserirPessoa`, que a rota da API também chama; aqui fica só
 * o que é da tela, que é saber quem está logado e mandar a lista se redesenhar.
 */
export async function criarPessoa(entrada: {
  nome: string
  telefone?: string
  identificadorExterno?: string
}): Promise<{ id: string }> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const r = await inserirPessoa(db, conta.contaId, entrada)
  revalidatePath('/pessoas')
  return r
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
  /*
   * Os campos que o formulário de matrícula do cliente pede. Todos opcionais:
   * ninguém é obrigado a preencher nada, e exigir documento é o jeito mais
   * rápido de a recepção inventar número.
   */
  cpf?: string | null
  rg?: string | null
  endereco?: string | null
  enderecoNumero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  sexo?: string | null
  estadoCivil?: string | null
  profissao?: string | null
  telefoneResidencial?: string | null
  telefoneComercial?: string | null
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
  if (campos.telefone !== undefined) {
    // a mesma régua do cadastro: a ficha é justamente onde se conserta o
    // telefone que veio incompleto da planilha antiga
    const erroFone = erroDoTelefone(campos.telefone)
    if (erroFone) throw new Error(erroFone)
    linha.telefone = normalizarTelefone(campos.telefone)
  }
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

  /*
   * O CPF confere dígito antes de entrar. É o único documento aqui que tem
   * conferência possível, e o erro dele só apareceria na hora de emitir um
   * recibo, com a pessoa já de saída.
   */
  if (campos.cpf !== undefined) {
    const digitos = soDigitosCpf(campos.cpf ?? '')
    if (digitos && !cpfValido(digitos)) {
      throw new Error('Esse CPF não confere. Verifique os números.')
    }
    linha.cpf = digitos || null
  }

  if (campos.rg !== undefined) linha.rg = campos.rg || null
  if (campos.endereco !== undefined) linha.endereco = campos.endereco || null
  if (campos.enderecoNumero !== undefined) {
    linha.endereco_numero = campos.enderecoNumero || null
  }
  if (campos.complemento !== undefined) linha.complemento = campos.complemento || null
  if (campos.bairro !== undefined) linha.bairro = campos.bairro || null
  if (campos.cidade !== undefined) linha.cidade = campos.cidade || null
  if (campos.cep !== undefined) linha.cep = campos.cep || null
  if (campos.sexo !== undefined) linha.sexo = campos.sexo || null
  if (campos.estadoCivil !== undefined) linha.estado_civil = campos.estadoCivil || null
  if (campos.profissao !== undefined) linha.profissao = campos.profissao || null
  if (campos.telefoneResidencial !== undefined) {
    linha.telefone_residencial = campos.telefoneResidencial || null
  }
  if (campos.telefoneComercial !== undefined) {
    linha.telefone_comercial = campos.telefoneComercial || null
  }
  // a UF é guardada em duas letras maiúsculas, e o banco recusa o resto
  if (campos.uf !== undefined) {
    linha.uf = campos.uf ? campos.uf.trim().toUpperCase().slice(0, 2) : null
  }

  const { error } = await db.from('pessoa').update(linha).eq('id', id)
  if (error) {
    // CPF repetido é a mesma pessoa cadastrada duas vezes, e quem está na tela
    // é quem pode resolver isso
    const e = error as { code?: string }
    if (e.code === '23505') {
      throw new Error('Já existe uma ficha nesta conta com esse CPF.')
    }
    throw error
  }

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
const BALDE_FOTO_PESSOA = 'foto-pessoa'
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

/**
 * A foto da ficha.
 *
 * Em pilates e fisioterapia ela não é enfeite de cadastro: é o antes e depois
 * da correção postural, e é como a recepção reconhece quem chegou. Vai num
 * balde separado do da equipe, e o caminho começa pela conta — é por essa
 * pasta que a política do Storage separa um cliente do outro.
 */
export async function salvarFotoDaPessoa(id: string, foto: File): Promise<void> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  if (!TIPOS_FOTO.includes(foto.type)) {
    throw new Error('a foto precisa ser JPEG, PNG ou WEBP')
  }
  if (foto.size > LIMITE_ENVIO_MB * MB) {
    throw new Error(`a foto precisa ter até ${LIMITE_ENVIO_MB} MB depois de reduzida`)
  }

  const ext = foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg'
  const caminho = `${conta.contaId}/${id}.${ext}`

  const envio = await db.storage.from(BALDE_FOTO_PESSOA)
    .upload(caminho, foto, { upsert: true, contentType: foto.type })
  if (envio.error) throw envio.error

  const r = await db.from('pessoa').update({ foto_path: caminho })
    .eq('id', id).eq('conta_id', conta.contaId)
  if (r.error) throw r.error

  revalidatePath(`/pessoas/${id}`)
  revalidatePath('/pessoas')
}

export async function removerFotoDaPessoa(id: string): Promise<void> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { data } = await db.from('pessoa').select('foto_path')
    .eq('id', id).eq('conta_id', conta.contaId).maybeSingle()
  if (data?.foto_path) {
    await db.storage.from(BALDE_FOTO_PESSOA).remove([data.foto_path])
  }
  const r = await db.from('pessoa').update({ foto_path: null })
    .eq('id', id).eq('conta_id', conta.contaId)
  if (r.error) throw r.error

  revalidatePath(`/pessoas/${id}`)
  revalidatePath('/pessoas')
}

export async function anonimizarPessoa(id: string): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta atende a pedido de exclusão')
  }
  const db = await clienteServidor()

  /*
   * As imagens saem antes das colunas, e são duas famílias delas.
   *
   * A foto da ficha identifica melhor que o nome: zerar o nome e deixar o
   * rosto no balde é anonimizar no papel e não no fato. As fotos de avaliação
   * são dado de saúde do titular, e o pedido de exclusão alcança as duas.
   *
   * O arquivo primeiro, a linha depois: ao contrário, a imagem fica no balde
   * sem ninguém que saiba que ela existe.
   */
  const { data: comFoto } = await db.from('pessoa')
    .select('foto_path').eq('id', id).eq('conta_id', conta.contaId)
    .maybeSingle<{ foto_path: string | null }>()
  if (comFoto?.foto_path) {
    await db.storage.from(BALDE_FOTO_PESSOA).remove([comFoto.foto_path])
  }
  await limparAvaliacoesDaPessoa(db, conta.contaId, id)

  /*
   * Os catorze campos da ficha ampliada saem junto, e este é o segundo defeito
   * da mesma família: o módulo 14 deixou a foto de rosto no balde, e o módulo
   * 16 deixou **CPF, RG e endereço completo** na linha. Zerar o nome e manter o
   * documento é anonimizar no papel e não no fato, e o CPF é o identificador
   * mais forte que este sistema guarda.
   *
   * A lista é escrita à mão de propósito. `update` com objeto montado por laço
   * sobre as colunas da tabela pareceria mais seguro e seria o contrário: no
   * dia em que alguém acrescentar uma coluna que **precisa** sobreviver (o
   * `criado_em`, a `conta_id`), o laço a apagaria em silêncio.
   */
  const { error } = await db.from('pessoa').update({
    nome: 'Pessoa removida',
    telefone: null,
    email: null,
    identificador_externo: null,
    nascimento: null,
    observacao: null,
    foto_path: null,
    cpf: null,
    rg: null,
    endereco: null,
    endereco_numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
    cep: null,
    sexo: null,
    estado_civil: null,
    profissao: null,
    telefone_residencial: null,
    telefone_comercial: null,
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
