/**
 * O que uma chave de API é, sem banco e sem relógio implícito.
 *
 * Mesma divisão do convite: aqui mora a forma e o estado; guardar o hash e
 * procurar a linha é trabalho do `server/`.
 */

/**
 * O prefixo existe para a chave ser **reconhecível**.
 *
 * Um segredo solto num log de erro, num print de suporte ou num repositório
 * público é indistinguível de qualquer outra sequência de letras. Com `vr_` na
 * frente, um varredor de segredo acha, um humano reconhece, e revogar deixa de
 * depender de alguém desconfiar. É o mesmo motivo de `sk_live_` e `ghp_`.
 */
export const PREFIXO = 'vr_'

/** quantos caracteres do segredo aparecem na tela depois da criação */
export const TAMANHO_DO_VISIVEL = 8

/**
 * O pedaço que a tela pode mostrar para sempre.
 *
 * Sem ele, três chaves na lista são três linhas iguais, e revogar vira loteria.
 * Oito caracteres separam qualquer par de chaves na prática e não encurtam o
 * segredo de forma útil para quem quiser adivinhar o resto.
 */
export function prefixoVisivel(segredo: string): string {
  return segredo.slice(0, PREFIXO.length + TAMANHO_DO_VISIVEL)
}

/**
 * A chave que veio no cabeçalho, ou `null`.
 *
 * Aceita `Bearer vr_...` e o segredo cru, porque metade dos clientes de API
 * manda de um jeito e metade do outro, e recusar por causa disso gera chamado
 * em vez de segurança. O que **não** se aceita é qualquer coisa que não comece
 * com o prefixo: sem isso, um cabeçalho vazio ou um "undefined" literal viraria
 * consulta ao banco a cada requisição.
 */
export function segredoDoCabecalho(cabecalho: string | null): string | null {
  if (!cabecalho) return null
  // `trim` antes **e** depois: cabeçalho copiado de campo de configuração vem
  // com espaço nas duas pontas mais vezes do que se imagina
  const bruto = cabecalho.trim().replace(/^Bearer\s+/i, '').trim()
  if (!bruto.startsWith(PREFIXO)) return null
  // o suficiente para não valer a pena procurar no banco: `vr_` mais 32 bytes
  // em base64url dão 46, e qualquer coisa muito menor é lixo ou tentativa
  if (bruto.length < PREFIXO.length + 20) return null
  return bruto
}

export type ChaveBase = { revogadaEm: string | null }

export type EstadoChave = 'valida' | 'revogada' | 'inexistente'

/**
 * Chave revogada e chave que nunca existiu são estados diferentes **aqui** e a
 * mesma resposta na API.
 *
 * A separação serve para o log e para a tela: quem revogou precisa ver que
 * revogou. Para quem chama, os dois viram 401 sem detalhe, porque dizer "essa
 * chave existiu" já é informação demais para quem está tentando.
 */
export function estadoDaChave(c: ChaveBase | null): EstadoChave {
  if (c === null) return 'inexistente'
  if (c.revogadaEm !== null) return 'revogada'
  return 'valida'
}
