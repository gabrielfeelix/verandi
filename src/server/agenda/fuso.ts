/**
 * A fronteira entre o `core/`, que só conhece data e hora locais em string, e
 * o banco, que guarda instante absoluto.
 */

/**
 * `2026-08-03` + `07:00` + `America/Sao_Paulo` → instante absoluto.
 *
 * Descobre o deslocamento do fuso naquela data formatando um palpite em UTC e
 * medindo a diferença. Funciona com horário de verão e sem ele — o Brasil não
 * tem desde 2019, mas o produto não é só do Brasil e a conta escolhe o fuso.
 */
export function instante(data: string, hora: string, fuso: string): string {
  const palpite = new Date(`${data}T${hora}:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(
    fmt.formatToParts(palpite)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>

  const comoLocal = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second),
  )
  const deslocamento = comoLocal - palpite.getTime()
  return new Date(palpite.getTime() - deslocamento).toISOString()
}

/** O instante absoluto em que o dia local começa e termina. */
export function limitesDoDia(data: string, fuso: string): { de: string; ate: string } {
  return {
    de: instante(data, '00:00', fuso),
    ate: instante(data, '23:59', fuso),
  }
}

/**
 * O dia de hoje **na conta**, não na máquina nem em UTC.
 *
 * `new Date().toISOString().slice(0, 10)` parece inofensivo e não é: depois das
 * 21h no horário de Brasília isso já devolve o dia seguinte. A ocupação da grade
 * mudaria de número à noite, e a turma das 21h semearia participação contra a
 * data errada.
 */
export function hojeEm(fuso: string): string {
  return localDe(new Date().toISOString(), fuso).data
}

/** Data e hora locais de um instante, no fuso da conta. */
export function localDe(iso: string, fuso: string): { data: string; hora: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const p = Object.fromEntries(
    fmt.formatToParts(new Date(iso))
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>

  return {
    data: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`,
  }
}
