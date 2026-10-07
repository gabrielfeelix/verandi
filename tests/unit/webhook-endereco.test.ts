import { describe, it, expect } from 'vitest'
import { enderecoPublico } from '@/core/webhook/endereco'

describe('enderecoPublico', () => {
  it('aceita endereço da internet', () => {
    expect(enderecoPublico('https://bot.mgmpilates.com.br/avisos')).toBe(true)
    expect(enderecoPublico('https://8.8.8.8/x')).toBe(true)
  })

  it('recusa rede interna, nome local e IP privado', () => {
    for (const url of [
      'https://localhost/x', 'https://servidor/x', 'https://api.internal/x',
      'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://172.20.1.1/x',
      'https://192.168.0.10/x', 'https://169.254.169.254/latest',
      'https://[::1]/x', 'https://[fd00::1]/x', 'https://[::ffff:127.0.0.1]/x',
      'não é url',
    ]) expect(enderecoPublico(url), url).toBe(false)
  })
})
