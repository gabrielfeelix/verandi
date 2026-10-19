/**
 * Recusa destino de rede interna.
 *
 * Quem entrega o evento é o servidor da Verandi: um endereço como
 * `https://localhost` ou `https://10.0.0.5` faria o nosso servidor bater em
 * máquina que só ele alcança. O entregador também não segue redirecionamento,
 * senão um endereço público mandaria para o interno do mesmo jeito.
 *
 * Isto confere só o texto do endereço. Um nome público pode resolver para IP
 * interno, então o entregador confere de novo o IP na hora de conectar
 * (`server/webhook/entrega.ts`), com `ipPublico`.
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
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return ipPublico(host)
  return true
}

/**
 * Este IP é da internet, e não de rede interna, loopback ou reservado?
 *
 * IPv6 com IPv4 dentro (`::ffff:10.0.0.5`) é recusado inteiro: é o jeito mais
 * comum de passar um IP interno por quem só olha o formato IPv4.
 */
export function ipPublico(ip: string): boolean {
  const limpo = ip.toLowerCase().replace(/^\[|\]$/g, '')
  const v4 = limpo.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 192 && b === 0 && Number(v4[3]) === 0) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if (a >= 224) return false
    return true
  }
  if (!limpo.includes(':')) return false
  if (limpo === '::1' || limpo === '::') return false
  if (/^f[cd]/.test(limpo) || /^fe[89ab]/.test(limpo) || /^ff/.test(limpo)) return false
  if (limpo.startsWith('::ffff:') || limpo.startsWith('64:ff9b:')) return false
  return true
}
