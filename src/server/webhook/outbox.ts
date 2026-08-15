import { createHmac, randomBytes } from 'node:crypto'
import type { Db } from '../supabase'
import { clienteAdmin } from '../supabase'
import {
  CABECALHO_ASSINATURA, CABECALHO_EVENTO, CABECALHO_INSTANTE,
  MAXIMO_DE_TENTATIVAS, proximaEspera, textoAssinado,
} from '@/core/webhook/assinatura'

/**
 * A fila de saída, e quem a esvazia.
 *
 * Duas funções e uma regra: **enfileirar nunca falha para quem chamou.** Quem
 * está cancelando uma aula na tela não pode receber erro porque o webhook de um
 * terceiro está mal configurado, e o bot que desmarca pela API não pode receber
 * 500 porque a fila teve soluço. O evento é um efeito, não o pedido.
 */

export type TipoDeEvento =
  | 'participacao.criada'
  | 'participacao.cancelada'
  | 'sessao.cancelada'

/** Um segredo de assinatura novo, para a tela mostrar uma vez. */
export function novoSegredoDeWebhook(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`
}

/**
 * Grava o evento. Não entrega, não espera, não levanta erro.
 *
 * Sem destino configurado, nem grava: fila que enche para ninguém é fila que um
 * dia alguém encontra com dez mil linhas e não sabe o que fazer com elas.
 */
export async function enfileirar(
  db: Db,
  contaId: string,
  tipo: TipoDeEvento,
  dados: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: destino } = await db
      .from('webhook').select('id').eq('conta_id', contaId).eq('ativo', true)
      .maybeSingle()
    if (!destino) return

    await db.from('evento_saida').insert({
      conta_id: contaId, tipo, dados: dados as never,
    })
  } catch (e) {
    console.error('[outbox] não consegui enfileirar', tipo, e)
  }
}

/**
 * Manda o que está vencido, e reagenda o que falhar.
 *
 * Chamada depois da resposta sair (`after`), e também pela rota de manutenção:
 * a primeira dá entrega imediata no caminho feliz, a segunda é o que garante a
 * reentrega quando o outro lado estava fora do ar na hora.
 *
 * O `limite` existe para uma execução não virar meia hora de trabalho. O que
 * sobrar sai na próxima.
 */
export async function entregarPendentes(limite = 20): Promise<{ entregues: number; falhas: number }> {
  const db = clienteAdmin()
  const agora = new Date().toISOString()

  const { data: eventos, error } = await db
    .from('evento_saida')
    .select('id, conta_id, tipo, dados, tentativas')
    .is('entregue_em', null)
    .not('proxima_tentativa_em', 'is', null)
    .lte('proxima_tentativa_em', agora)
    .order('criado_em')
    .limit(limite)
  if (error) throw error

  let entregues = 0
  let falhas = 0

  for (const ev of eventos ?? []) {
    const { data: destino } = await db
      .from('webhook').select('url, segredo').eq('conta_id', ev.conta_id).eq('ativo', true)
      .maybeSingle()

    /*
     * Destino que sumiu no meio do caminho encerra o evento em vez de tentar
     * seis vezes contra o nada. Quem desligou a integração já disse o que
     * queria.
     */
    if (!destino) {
      await db.from('evento_saida')
        .update({ proxima_tentativa_em: null, ultimo_erro: 'sem destino configurado' })
        .eq('id', ev.id)
      continue
    }

    const corpo = JSON.stringify({
      evento: ev.tipo,
      eventoId: ev.id,
      criadoEm: agora,
      dados: ev.dados,
    })
    const instante = Math.floor(Date.now() / 1000)
    const assinatura = createHmac('sha256', destino.segredo)
      .update(textoAssinado(instante, corpo))
      .digest('hex')

    let erro: string | null = null
    try {
      /*
       * Dez segundos, e não mais: o entregador roda depois da resposta do
       * usuário, mas ainda dentro da mesma invocação, e um destino que demora
       * meio minuto seguraria a função inteira por conta de um evento só.
       */
      const r = await fetch(destino.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CABECALHO_EVENTO]: ev.tipo,
          [CABECALHO_INSTANTE]: String(instante),
          [CABECALHO_ASSINATURA]: assinatura,
        },
        body: corpo,
        signal: AbortSignal.timeout(10_000),
      })
      // qualquer 2xx é sucesso: exigir 200 recusaria um 204 legítimo
      if (!r.ok) erro = `resposta ${r.status}`
    } catch (e) {
      erro = e instanceof Error ? e.message : 'falha de rede'
    }

    if (!erro) {
      await db.from('evento_saida')
        .update({ entregue_em: new Date().toISOString(), proxima_tentativa_em: null, ultimo_erro: null })
        .eq('id', ev.id)
      entregues++
      continue
    }

    const tentativas = ev.tentativas + 1
    const espera = proximaEspera(tentativas)
    await db.from('evento_saida').update({
      tentativas,
      ultimo_erro: erro.slice(0, 300),
      /*
       * Nulo desiste, e a linha fica com o erro para alguém olhar. Fila que
       * tenta para sempre é fila que enche para sempre, e um evento da aula de
       * terça não interessa mais na sexta.
       */
      proxima_tentativa_em: espera === null
        ? null
        : new Date(Date.now() + espera * 1000).toISOString(),
    }).eq('id', ev.id)
    falhas++

    if (tentativas >= MAXIMO_DE_TENTATIVAS) {
      console.error('[outbox] desisti do evento', ev.id, ev.tipo, erro)
    }
  }

  return { entregues, falhas }
}
