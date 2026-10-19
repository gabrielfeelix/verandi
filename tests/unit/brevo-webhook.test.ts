import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/brevo/webhook/route'

/** O segredo do webhook do Brevo vem no cabeçalho, e não mais na URL. */
describe('webhook do Brevo', () => {
  const pedido = (url: string, cabecalhos: Record<string, string> = {}) =>
    new NextRequest(url, { method: 'POST', headers: cabecalhos, body: '[]' })

  beforeEach(() => {
    process.env.BREVO_WEBHOOK_TOKEN = 'token-novo-de-teste'
    delete process.env.BREVO_WEBHOOK_SEGREDO
  })

  it('aceita o token no cabeçalho', async () => {
    const r = await POST(pedido('https://x.test/api/brevo/webhook', { authorization: 'Bearer token-novo-de-teste' }))
    expect(r.status).toBe(200)
  })

  it('recusa sem token, com token errado e com o token na URL', async () => {
    expect((await POST(pedido('https://x.test/api/brevo/webhook'))).status).toBe(401)
    expect((await POST(pedido('https://x.test/api/brevo/webhook', { authorization: 'Bearer outro' }))).status).toBe(401)
    expect((await POST(pedido('https://x.test/api/brevo/webhook?s=token-novo-de-teste'))).status).toBe(401)
  })

  it('o segredo antigo na URL só vale enquanto estiver configurado', async () => {
    process.env.BREVO_WEBHOOK_SEGREDO = 'segredo-antigo'
    expect((await POST(pedido('https://x.test/api/brevo/webhook?s=segredo-antigo'))).status).toBe(200)
    delete process.env.BREVO_WEBHOOK_SEGREDO
    expect((await POST(pedido('https://x.test/api/brevo/webhook?s=segredo-antigo'))).status).toBe(401)
  })
})
