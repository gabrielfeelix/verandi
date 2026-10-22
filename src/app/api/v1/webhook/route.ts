import { NextResponse, type NextRequest } from 'next/server'
import { clienteAdmin } from '@/server/supabase'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'

/**
 * O AutoFluxos se registra como destino dos avisos da conta, num clique do
 * lado de lá (a ponte Verandi e AutoFluxos).
 *
 * Antes, ligar os avisos era copiar um endereço de um sistema, colar no outro,
 * copiar o segredo de volta, e o formato da assinatura nem batia. Agora quem
 * tem a chave da conta pede, e a Verandi passa a avisar.
 *
 * **Só aceita endereço do AutoFluxos**, e é isso que torna seguro deixar a
 * chave fazer isto: com uma chave vazada não dá para mandar nome e telefone
 * dos alunos para outro lugar. Outro destino continua sendo configurado pela
 * tela, pelo dono.
 *
 * O segredo vem de lá: é o AutoFluxos que confere a assinatura, e ele já o
 * guarda no cofre dele. Aqui ele fica em claro, como todo segredo de
 * assinatura (ver a migration 0048).
 *
 *   PUT /api/v1/webhook     { "url": "https://autofluxos.4yu.com.br/api/webhook/verandi/…", "segredo": "…" }
 *   DELETE /api/v1/webhook
 */
const PREFIXO_DO_AUTOFLUXOS = 'https://autofluxos.4yu.com.br/api/webhook/verandi/'

export const PUT = comChave(async (req: NextRequest, ctx: Contexto) => {
  let corpo: { url?: unknown; segredo?: unknown }
  try {
    corpo = (await req.json()) as typeof corpo
  } catch {
    return erro(400, 'corpo precisa ser JSON')
  }
  const url = typeof corpo.url === 'string' ? corpo.url.trim() : ''
  const segredo = typeof corpo.segredo === 'string' ? corpo.segredo.trim() : ''
  if (!url.startsWith(PREFIXO_DO_AUTOFLUXOS) || url.length > 300 || /\s/.test(url)) {
    return erroDePedido({ campo: 'url', mensagem: 'pela API, só um endereço do AutoFluxos; outro destino se configura na tela' })
  }
  if (segredo.length < 32 || segredo.length > 200) {
    return erroDePedido({ campo: 'segredo', mensagem: 'segredo precisa ter de 32 a 200 caracteres' })
  }

  const { error } = await clienteAdmin().from('webhook').upsert(
    { conta_id: ctx.contaId, url, segredo, ativo: true },
    { onConflict: 'conta_id' },
  )
  if (error) throw error
  return NextResponse.json({ ativo: true, url })
})

export const DELETE = comChave(async (_req: NextRequest, ctx: Contexto) => {
  // desligar, e não apagar: o histórico de eventos continua apontando para algo
  const { data, error } = await clienteAdmin()
    .from('webhook')
    .update({ ativo: false })
    .eq('conta_id', ctx.contaId)
    .like('url', `${PREFIXO_DO_AUTOFLUXOS}%`)
    .select('conta_id')
  if (error) throw error
  return NextResponse.json({ ativo: false, desligou: (data ?? []).length > 0 })
})
