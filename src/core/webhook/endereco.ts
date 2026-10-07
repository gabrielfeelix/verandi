/**
 * Recusa destino de rede interna.
 *
 * Quem entrega o evento é o servidor da Verandi: um endereço como
 * `https://localhost` ou `https://10.0.0.5` faria o nosso servidor bater em
 * máquina que só ele alcança. O entregador também não segue redirecionamento,
 * senão um endereço público mandaria para o interno do mesmo jeito.
 */
export function enderecoPublico(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    return false
  }
  if (!host.includes('.') && !host.includes(':')) return false
  if (host === 'localhost' || /\.(localhost|local|internal|lan)$/.test(host)) return false
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false
  }
  if (host.includes(':')) {
    if (host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe80/.test(host)) return false
    if (host.startsWith('::ffff:')) return false
  }
  return true
}
