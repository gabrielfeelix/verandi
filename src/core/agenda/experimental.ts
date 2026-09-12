/**
 * A grade da aula experimental.
 *
 * O estúdio abre a semana inteira e a aula experimental cabe em pedaços dela.
 * Quem chega pelo bot dizendo "quero conhecer" não pode ver a mesma agenda que
 * o aluno matriculado vê: no MGM só o Pilates aparelho recebe experimental, e
 * nem em todo horário — segunda das 12h às 14h não dá, quarta só a partir das
 * 15h.
 *
 * Está aqui, puro e sem banco, pelo mesmo motivo de `encaixe.ts`: é conta sobre
 * tempo, e conta sobre tempo tem que dar para testar sem subir servidor e sem
 * esperar dar quarta-feira. A consulta que usa isto é
 * `server/agenda/disponibilidade.ts`.
 */

/** `"08:00"` — a mesma grafia que a pessoa digita e que o banco guarda. */
export type Faixa = { de: string; ate: string }

/**
 * As faixas de um serviço, por dia da semana.
 *
 * Índice = dia, 0 = domingo, como em `Date.prototype.getDay()`. Mais de uma
 * faixa por dia de propósito: "12h às 13h fechado, 14h em diante aberto" é o
 * caso real, e um único `de`/`ate` obrigaria a mentir.
 *
 * O formato repete o `HorarioDeAtendimento` do AutoFluxos de propósito — ele
 * já é testado e já tem tela.
 */
export type JanelaExperimental = { dias: Faixa[][] }

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

/** `"08:30"` → 510. `null` quando não é hora. */
export function emMinutos(relogio: string): number | null {
  const achado = HORA.exec(relogio.trim())
  if (!achado) return null
  return Number(achado[1]) * 60 + Number(achado[2])
}

/**
 * Lê o que veio do `jsonb`. Qualquer coisa fora do formato vira `null`.
 *
 * `null` aqui significa "sem restrição de horário", que é o lado seguro: o
 * campo só é consultado depois de `aceita_experimental` já ter dito que sim, e
 * um objeto torto não pode virar "em horário nenhum" por acidente e sumir com
 * a agenda inteira sem ninguém entender por quê.
 */
export function lerJanela(bruto: unknown): JanelaExperimental | null {
  if (bruto === null || bruto === undefined) return null
  if (typeof bruto !== 'object') return null

  const dias = (bruto as { dias?: unknown }).dias
  if (!Array.isArray(dias) || dias.length !== 7) return null

  const lidos: Faixa[][] = []
  for (const dia of dias) {
    if (!Array.isArray(dia)) return null
    const faixas: Faixa[] = []
    for (const faixa of dia) {
      if (typeof faixa !== 'object' || faixa === null) return null
      const { de, ate } = faixa as { de?: unknown; ate?: unknown }
      if (typeof de !== 'string' || typeof ate !== 'string') return null
      faixas.push({ de, ate })
    }
    lidos.push(faixas)
  }
  return { dias: lidos }
}

/**
 * Essa sessão pode ser oferecida como aula experimental?
 *
 * `janela` nula = sem restrição de horário: o serviço aceita experimental em
 * qualquer sessão dele. Diferente de sete listas vazias, que é "em horário
 * nenhum" — alguém configurou para não oferecer, e o sistema obedece.
 *
 * `dia` é o dia da semana da sessão (0 = domingo) e `hora` é a hora local dela
 * (`"15:00"`), que é o que `SessaoResumo` já carrega pronto. Nada de `Date`
 * aqui dentro: o fuso já foi resolvido por quem leu a agenda, e refazer essa
 * conta neste módulo é a forma conhecida de as duas discordarem.
 */
export function cabeNaJanela(
  janela: JanelaExperimental | null,
  dia: number,
  hora: string,
): boolean {
  if (janela === null) return true

  const minutos = emMinutos(hora)
  if (minutos === null) return false

  return (janela.dias[dia] ?? []).some((faixa) => {
    const de = emMinutos(faixa.de)
    const ate = emMinutos(faixa.ate)
    /*
     * Faixa ilegível não abre horário. É o mesmo lado que o AutoFluxos escolhe
     * no horário de atendimento: melhor não oferecer do que oferecer uma aula
     * que o estúdio não tem como dar.
     */
    if (de === null || ate === null || ate <= de) return false
    return minutos >= de && minutos < ate
  })
}

/** O dia da semana de uma data local `AAAA-MM-DD`. 0 = domingo. */
export function diaDaSemana(data: string): number {
  // meio-dia UTC: longe das duas bordas em que o fuso empurraria para o dia
  // vizinho. A data já vem local, então só o dia da semana importa.
  return new Date(`${data}T12:00:00Z`).getUTCDay()
}
