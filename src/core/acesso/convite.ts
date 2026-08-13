/**
 * O estado de um convite, decidido sem banco e sem relógio implícito.
 *
 * O `core/` não guarda o token nem sabe como ele é comparado — isso é trabalho
 * do `server/`, que guarda só o hash. Aqui se responde uma pergunta só: quem
 * abriu este link pode entrar?
 */

export type ConviteBase = {
  /** instante absoluto, ISO */
  expiraEm: string
  aceitoEm: string | null
  revogadoEm: string | null
}

export type EstadoConvite = 'valido' | 'expirado' | 'ja_aceito' | 'revogado' | 'inexistente'

/**
 * A ordem das perguntas é a ordem da utilidade para quem abriu o link.
 *
 * `ja_aceito` ganha de `expirado` de propósito: quem já aceitou precisa saber
 * que é só entrar, e não que "o prazo acabou" — a segunda mensagem manda a
 * pessoa pedir outro convite que ela não precisa. Não há vazamento nessa
 * escolha: quem tem o token já é quem foi convidado.
 */
export function estadoDoConvite(c: ConviteBase | null, agora: Date): EstadoConvite {
  if (c === null) return 'inexistente'
  if (c.aceitoEm !== null) return 'ja_aceito'
  if (c.revogadoEm !== null) return 'revogado'
  if (new Date(c.expiraEm).getTime() <= agora.getTime()) return 'expirado'
  return 'valido'
}
