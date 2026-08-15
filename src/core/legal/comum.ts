/**
 * O papel, escrito uma vez só.
 *
 * Termos de uso e política de privacidade são texto de produto, não anexo de
 * pasta: quem lê é o dono do estúdio antes de assinar, o jurídico da clínica
 * antes de liberar, e o titular do dado depois de desconfiar. Por isso moram
 * aqui, em dado estruturado, e não num `.md` solto: a tela renderiza o mesmo
 * conteúdo que o teste confere, e não existe uma segunda cópia para envelhecer.
 *
 * O adendo de tratamento de dados (o contrato de operador) é o único que fica
 * fora, em `docs/juridico/`, porque ele não é publicado: ele é assinado.
 *
 * **Nada aqui leva travessão**, pela mesma régua do resto do produto.
 */

/** Um parágrafo, uma lista, uma tabela ou uma caixa de destaque. */
export type Bloco =
  | { tipo: 'p'; texto: string }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] }
  | { tipo: 'nota'; texto: string }

export type Secao = {
  /** vira âncora na URL: quem cita um documento cita um trecho dele */
  id: string
  titulo: string
  blocos: Bloco[]
}

export type Documento = {
  slug: 'termos' | 'privacidade'
  titulo: string
  /** uma frase, antes do sumário, dizendo o que este documento resolve */
  resumo: string
  versao: string
  vigenteDesde: string
  secoes: Secao[]
}

/**
 * O endereço público dos documentos.
 *
 * Fixo, e não derivado de `APP_URL`, por causa do e-mail: ele é lido dias
 * depois, fora do navegador, às vezes disparado de uma prévia local. O
 * documento é um só e mora num endereço só.
 */
export const ENDERECO_PUBLICO = 'https://verandi.4yu.com.br'

/**
 * Enquanto a minuta não voltar do advogado, o documento diz que é minuta.
 *
 * Publicar como final o que ninguém revisou é a única parte disto que seria
 * desonesta. Vire para `false` depois da revisão, no mesmo commit que subir o
 * texto revisado, e mexa na versão.
 */
export const EM_REVISAO = true

export const VERSAO = '1.0'
export const VIGENTE_DESDE = '15 de agosto de 2026'

/** Quem é a 4YU, do jeito que precisa aparecer num documento destes. */
export const EMPRESA = {
  nome: '4YU',
  site: '4yu.com.br',
  /*
   * Vazio some da tela em vez de virar "[preencher]" na cara do cliente. O que
   * falta está listado em `docs/juridico/README.md`, que é onde alguém procura
   * antes de assinar.
   */
  razaoSocial: '',
  cnpj: '',
  endereco: '',
} as const

export const CONTATO = {
  /** o endereço do encarregado. A ANPD espera achar isto publicado. */
  privacidade: 'privacidade@4yu.com.br',
  suporte: 'sac@4yu.com.br',
} as const

/**
 * Quem mais toca o dado, e onde ele fica de verdade.
 *
 * As regiões foram conferidas na API de cada fornecedor, não deduzidas: o banco
 * está em São Paulo, e era isso que os nossos próprios documentos internos
 * diziam errado ao anotar "Supabase, fora do Brasil". A aplicação é que roda
 * fora, e a diferença importa: transferência internacional se declara pelo
 * lugar onde o dado é tratado, não pela sede do fornecedor.
 */
export const SUBPROCESSADORES = [
  {
    nome: 'Supabase',
    faz: 'banco de dados, autenticação e arquivo',
    onde: 'São Paulo, Brasil (região sa-east-1)',
    sede: 'Estados Unidos',
  },
  {
    nome: 'Vercel',
    faz: 'hospedagem e execução da aplicação',
    onde: 'São Paulo, Brasil (região gru1)',
    sede: 'Estados Unidos',
  },
  {
    nome: 'Brevo',
    faz: 'envio dos e-mails de convite, senha e aviso',
    onde: 'União Europeia',
    sede: 'França',
  },
] as const
