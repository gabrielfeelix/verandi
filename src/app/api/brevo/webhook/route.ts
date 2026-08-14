import { NextResponse, type NextRequest } from 'next/server'
import { clienteAdmin } from '@/server/supabase'
import { estadoDoEvento, piorEntre, type EstadoDeEntrega } from '@/core/email/entrega'

/**
 * O Brevo contando o que aconteceu com um e-mail que saiu.
 *
 * É a única coisa que ele sabe e o nosso banco não: se chegou, se voltou, se
 * caiu no spam. Sem isto a tela afirma "Convite enviado" para um endereço
 * digitado errado e ninguém descobre.
 *
 * **Autenticação é o segredo na URL.** O Brevo não assina webhook — não há
 * HMAC nem cabeçalho para conferir. Então o endereço em si é a credencial, e
 * por isso ele vive em `BREVO_WEBHOOK_SEGREDO`, nunca no repositório. Sem o
 * segredo configurado a rota recusa tudo: aberta ela deixaria qualquer um
 * marcar convite alheio como "voltou", que é negação de serviço barata.
 */

// o Brevo desiste e reenvia se demorar; nada aqui deve ficar pensando
export const maxDuration = 10

function autorizado(req: NextRequest): boolean {
  const esperado = process.env.BREVO_WEBHOOK_SEGREDO
  if (!esperado) return false
  const veio = req.nextUrl.searchParams.get('s') ?? ''
  // comparação de tamanho fixo evita medir o segredo pelo tempo de resposta
  if (veio.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= veio.charCodeAt(i) ^ esperado.charCodeAt(i)
  }
  return diferenca === 0
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 })
  }

  // o Brevo manda um evento por requisição, mas já mandou lote no passado
  const eventos = Array.isArray(corpo) ? corpo : [corpo]
  let aplicados = 0

  for (const e of eventos) {
    const bruto = e as { event?: string; email?: string }
    const estado = estadoDoEvento(bruto.event ?? '')
    const email = (bruto.email ?? '').trim().toLowerCase()
    if (!estado || !email) continue

    /*
     * Só o convite em aberto interessa. Aceito já virou usuário e revogado não
     * vale mais — marcar "voltou" em qualquer um dos dois confundiria uma tela
     * que fala do presente.
     *
     * Sem filtro de conta de propósito: o webhook não sabe de conta, e o mesmo
     * endereço pode ter convite aberto em dois estúdios. Se o e-mail voltou,
     * voltou para os dois.
     */
    const db = clienteAdmin()
    const { data: linhas } = await db
      .from('convite')
      .select('id, entrega')
      .eq('email', email)
      .is('aceito_em', null)
      .is('revogado_em', null)
      .returns<{ id: string; entrega: EstadoDeEntrega | null }[]>()

    for (const linha of linhas ?? []) {
      const novo = piorEntre(linha.entrega, estado)
      if (novo === linha.entrega) continue
      await db
        .from('convite')
        .update({ entrega: novo, entrega_em: new Date().toISOString() })
        .eq('id', linha.id)
      aplicados++
    }
  }

  // 200 sempre que o segredo bate: evento que não reconhecemos não é erro do
  // Brevo, e devolver falha faria ele reenviar para sempre
  return NextResponse.json({ ok: true, aplicados })
}
