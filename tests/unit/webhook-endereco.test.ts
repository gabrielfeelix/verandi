import { describe, it, expect } from 'vitest'
import { enderecoPublico, ipPublico } from '@/core/webhook/endereco'
import { postarParaFora, resolverSoPublico } from '@/server/webhook/entrega'

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

describe('ipPublico', () => {
  it('aceita IP da internet', () => {
    for (const ip of ['8.8.8.8', '177.71.207.1', '2804:14c::1']) expect(ipPublico(ip), ip).toBe(true)
  })

  it('recusa interno, loopback, reservado e IPv4 escondido em IPv6', () => {
    for (const ip of [
      '10.0.0.5', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1',
      '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
      '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.5', '64:ff9b::a00:5',
    ]) expect(ipPublico(ip), ip).toBe(false)
  })
})

/**
 * O nome público que resolve para dentro: o texto do endereço passa, a
 * conexão não. O resolvedor é de mentira para não depender de DNS.
 */
describe('resolverSoPublico', () => {
  const resolverPara = (ips: string[]) =>
    resolverSoPublico((_nome, opcoes, volta) => {
      if (opcoes.all) volta(null, ips.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })))
      else volta(null, ips[0], ips[0].includes(':') ? 6 : 4)
    })

  const resolver = (lookup: ReturnType<typeof resolverSoPublico>, all: boolean) =>
    new Promise<{ erro: NodeJS.ErrnoException | null; endereco: unknown }>((pronto) =>
      lookup('avisos.exemplo.com', { all }, (erro, endereco) => pronto({ erro, endereco })))

  it('deixa passar o nome que resolve para a internet', async () => {
    const r = await resolver(resolverPara(['8.8.8.8']), false)
    expect(r.erro).toBeNull()
    expect(r.endereco).toBe('8.8.8.8')
  })

  it('derruba o nome que resolve para rede interna', async () => {
    const r = await resolver(resolverPara(['169.254.169.254']), false)
    expect(r.erro?.code).toBe('EDESTINOINTERNO')
  })

  it('derruba se um só dos endereços do nome for interno', async () => {
    const r = await resolver(resolverPara(['8.8.8.8', '10.0.0.5']), true)
    expect(r.erro?.code).toBe('EDESTINOINTERNO')
  })

  it('não conecta em IP interno escrito no endereço', async () => {
    await expect(postarParaFora('https://10.0.0.5/x', {}, '{}', 1000)).rejects.toThrow('rede interna')
  })
})
