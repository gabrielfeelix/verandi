'use server'

import { clienteServidor, exigirConta } from './conta'
import { notificacoesDaConta, type Notificacao } from './notificacoes'

/**
 * As notificações de agora, pedidas pelo navegador de tempos em tempos.
 * Professor não recebe: o sino é de quem responde pela agenda inteira.
 */
export async function notificacoesRecentes(): Promise<Notificacao[]> {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') return []
  const db = await clienteServidor()
  return notificacoesDaConta(db, conta.contaId, conta.fuso)
}
