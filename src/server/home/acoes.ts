'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { BLOCOS, type Arranjo } from '@/core/home/blocos'
import type { Json } from '../banco.types'

/**
 * Guardar o arranjo da tela inicial.
 *
 * Erro volta como **valor**, e não como `throw`: exceção lançada dentro de
 * Server Action não atravessa a rede com o nosso texto, e a tela mostraria
 * "alguma coisa quebrou" no lugar da frase que resolve. Já custou isso duas
 * vezes, em `planos/acoes.ts` e em `config/acoes.ts`.
 */
export type Resultado = { ok: true } | { ok: false; erro: string }

const IDS = new Set(BLOCOS.map((b) => b.id))

export async function salvarArranjoDaHome(arranjo: Arranjo[]): Promise<Resultado> {
  try {
    const conta = await exigirConta()
    const db = await clienteServidor()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { ok: false, erro: 'Entre de novo para salvar a sua tela.' }

    if (!Array.isArray(arranjo)) {
      return { ok: false, erro: 'Não deu para entender o arranjo da tela.' }
    }

    /*
     * Só passa `id` que a tela conhece, e cada um uma vez.
     *
     * Isto não é desconfiança do formulário: é que o arranjo é gravado por uma
     * versão do produto e lido por outra, e um `id` inventado gravado hoje
     * viraria uma linha que nenhuma tela desenha e ninguém consegue apagar
     * pelo painel. O que não é reconhecido some agora, e não daqui a um ano.
     */
    const vistos = new Set<string>()
    const limpo: Arranjo[] = []
    for (const linha of arranjo) {
      const id = typeof linha?.id === 'string' ? linha.id : ''
      if (!IDS.has(id) || vistos.has(id)) continue
      vistos.add(id)
      limpo.push({ id, visivel: linha.visivel !== false })
    }

    const { error } = await db.from('preferencia_home').upsert({
      conta_id: conta.contaId,
      usuario_id: user.id,
      blocos: limpo as unknown as Json,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'conta_id,usuario_id' })
    if (error) throw error

    revalidatePath('/hoje')
    return { ok: true }
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    return { ok: false, erro: m || 'Não foi possível salvar o arranjo da tela.' }
  }
}

/** Voltar ao arranjo que a tela tem para quem nunca mexeu. */
export async function restaurarArranjoDaHome(): Promise<Resultado> {
  try {
    const conta = await exigirConta()
    const db = await clienteServidor()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { ok: false, erro: 'Entre de novo para restaurar a sua tela.' }

    // apagar a linha, e não gravar o padrão: assim quem restaurou hoje ganha o
    // bloco que a tela receber amanhã, em vez de ficar com a foto de hoje
    const { error } = await db.from('preferencia_home').delete()
      .eq('conta_id', conta.contaId).eq('usuario_id', user.id)
    if (error) throw error

    revalidatePath('/hoje')
    return { ok: true }
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    return { ok: false, erro: m || 'Não foi possível restaurar o arranjo da tela.' }
  }
}
