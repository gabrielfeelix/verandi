import { lookup as resolverNome, type LookupAddress, type LookupOptions } from 'node:dns'
import { request } from 'node:https'
import type { LookupFunction } from 'node:net'
import { enderecoPublico, ipPublico } from '@/core/webhook/endereco'

/**
 * O POST do webhook para fora, recusando rede interna **na hora de conectar**.
 *
 * `enderecoPublico` confere o texto do endereço, e isso não basta: o dono do
 * domínio escolhe para onde o nome resolve, e `avisos.exemplo.com` pode
 * apontar para `169.254.169.254` hoje, ou mudar entre o cadastro e a entrega.
 * Aqui quem resolve o nome é a própria conexão, e um IP interno derruba o
 * pedido antes do primeiro byte. Conferir antes e conectar depois deixaria a
 * janela aberta para o nome trocar no meio.
 *
 * `node:https` e não `fetch`: o `fetch` do Node não deixa trocar quem resolve
 * o nome. Redirecionamento não é seguido, como antes.
 */
export async function postarParaFora(
  url: string,
  cabecalhos: Record<string, string>,
  corpo: string,
  limiteMs: number,
): Promise<number> {
  // IP escrito no endereço não passa pela resolução de nome: confere aqui
  if (!enderecoPublico(url)) throw new Error('destino de rede interna')

  return new Promise((pronto, falhou) => {
    const pedido = request(url, {
      method: 'POST',
      headers: { ...cabecalhos, 'Content-Length': Buffer.byteLength(corpo) },
      lookup: resolverSoPublico(),
      signal: AbortSignal.timeout(limiteMs),
    }, (resposta) => {
      resposta.resume()
      pronto(resposta.statusCode ?? 0)
    })
    pedido.on('error', falhou)
    pedido.end(corpo)
  })
}

type Resolver = (
  nome: string,
  opcoes: LookupOptions,
  volta: (erro: NodeJS.ErrnoException | null, endereco: string | LookupAddress[], familia?: number) => void,
) => void

/**
 * O `lookup` da conexão, com a recusa no meio. Recebe o resolvedor para o
 * teste poder dizer "este nome resolve para 10.0.0.5" sem depender de DNS.
 */
export function resolverSoPublico(resolver: Resolver = resolverNome as Resolver): LookupFunction {
  return (nome, opcoes, volta) => {
    resolver(nome, opcoes, (erro, endereco, familia) => {
      if (erro) return volta(erro, '', 0)
      const lista = Array.isArray(endereco) ? endereco.map((e) => e.address) : [endereco]
      const interno = lista.find((ip) => !ipPublico(ip))
      if (interno !== undefined) {
        const recusa: NodeJS.ErrnoException = new Error(`${nome} resolve para rede interna`)
        recusa.code = 'EDESTINOINTERNO'
        return volta(recusa, '', 0)
      }
      volta(null, endereco, familia)
    })
  }
}
