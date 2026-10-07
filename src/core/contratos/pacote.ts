/**
 * O que o pacote de aulas está pedindo da recepção.
 *
 * Quem compra dez aulas e vai usando não tem horário fixo, e por isso some da
 * vista: a grade não mostra, a cobrança não vence todo mês. Pedido do Edu
 * (MGM, 07/out/2026): três situações em que alguém precisa agir.
 *
 * - **acabando**: restam poucas aulas. É a hora de oferecer a renovação, antes
 *   de a pessoa marcar a próxima sem saldo.
 * - **esgotado**: usou todas e o contrato continua ativo, sem renovação.
 * - **parado** (na tela, "aulas a fazer"): tem saldo e nada marcado à frente.
 *   Quem compra para usar quando precisa some da agenda; o Edu quer ver esse
 *   saldo como pendência, sem esperar semanas.
 *
 * Função pura: a mesma resposta em Pendências, na ficha e em Alunos.
 */

/** "restam 2" ou menos já é acabando */
export const RESTAM_POUCAS = 2

export type AvisoDoPacote = 'acabando' | 'esgotado' | 'parado'

export type EstadoDoPacote = {
  aviso: AvisoDoPacote | null
  contratadas: number
  usadas: number
  restantes: number
  /** dias desde o último uso (ou desde o início, se nunca usou) */
  diasSemUsar: number
}

const DIA = 864e5

function diasEntre(de: string, ate: string) {
  return Math.max(0, Math.round((Date.parse(ate) - Date.parse(de)) / DIA))
}

export function estadoDoPacote(p: {
  contratadas: number
  usadas: number
  /** há aula agendada à frente consumindo este pacote */
  temAgendada: boolean
  /** data (aaaa-mm-dd) da última aula usada, ou null */
  ultimoUso: string | null
  /** data (aaaa-mm-dd) do início do contrato */
  inicio: string
  hoje: string
}): EstadoDoPacote {
  const restantes = Math.max(0, p.contratadas - p.usadas)
  const diasSemUsar = diasEntre(p.ultimoUso ?? p.inicio, p.hoje)

  // a ordem é a da urgência: sem saldo pesa mais que pouco saldo, e pouco
  // saldo já cobre a conversa de quem está parado
  const aviso: AvisoDoPacote | null = restantes === 0
    ? 'esgotado'
    : restantes <= RESTAM_POUCAS
      ? 'acabando'
      : !p.temAgendada
        ? 'parado'
        : null

  return { aviso, contratadas: p.contratadas, usadas: p.usadas, restantes, diasSemUsar }
}

/** A frase do saldo, igual em toda tela: "7 de 10 usadas, restam 3". */
export function fraseDoSaldo(e: Pick<EstadoDoPacote, 'contratadas' | 'usadas' | 'restantes'>) {
  const restam = e.restantes === 0
    ? 'nenhuma restante'
    : `${e.restantes === 1 ? 'resta 1' : `restam ${e.restantes}`}`
  return `${Math.min(e.usadas, e.contratadas)} de ${e.contratadas} usadas, ${restam}`
}
