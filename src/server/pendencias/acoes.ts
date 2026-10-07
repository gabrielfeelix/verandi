'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import type { TipoPendencia } from './consultas'
import { SEM_DISPENSAR } from '@/core/pendencias'

/**
 * Dispensar é um fato, não um estado.
 *
 * A lista precisa ser esvaziável: pendência que nunca zera vira ruído e a
 * pessoa para de abrir a tela. Por isso dispensar existe, e por isso pede
 * motivo, que é o que separa "resolvi por fora" de "isso nunca foi problema".
 */
export async function dispensarPendencia(entrada: {
  tipo: TipoPendencia
  referenciaId: string
  motivo: string
}): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') {
    throw new Error('pendências são da operação')
  }

  // aula dada sem cobrança se resolve com contrato ou encerrando o horário
  if (SEM_DISPENSAR.has(entrada.tipo)) {
    throw new Error('esta pendência se resolve na ficha: criando o contrato, renovando ou agendando')
  }

  const motivo = entrada.motivo.trim()
  if (!motivo) throw new Error('diga o motivo, é o que faz o registro valer alguma coisa')

  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()

  const { error } = await db.from('pendencia_dispensada').upsert({
    conta_id: conta.contaId,
    tipo: entrada.tipo,
    referencia_id: entrada.referenciaId,
    motivo,
    dispensado_por_usuario_id: user?.id ?? null,
  }, { onConflict: 'conta_id,tipo,referencia_id' })
  if (error) throw error

  revalidatePath('/pendencias')
}
