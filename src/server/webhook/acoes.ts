'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { clienteAdmin } from '../supabase'
import { novoSegredoDeWebhook } from './outbox'
import { registrar } from '../log'

/**
 * Configurar para onde a Verandi avisa.
 *
 * Roda com a chave de serviço, e não com a sessão, porque a tabela `webhook` não
 * tem política: ela guarda o segredo de assinatura em claro, e uma política de
 * leitura para quem está logado faria o "aparece uma vez" virar mentira. Quem
 * confere o papel é esta função, que é o mesmo caminho que a observação restrita
 * já usa.
 */

export type ResultadoWebhook = { segredo: string }

export async function salvarWebhook(url: string): Promise<ResultadoWebhook> {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta configura integração')
  }

  const limpa = url.trim()
  /*
   * `https` obrigatório, e a recusa é do produto e não do banco: o evento leva
   * nome e telefone de quem é atendido, e `http` põe isso em texto aberto na
   * rede de quem estiver no meio. O `check` da migration repete a regra, porque
   * banco que confia na aplicação é banco que um dia recebe outra aplicação.
   */
  if (!/^https:\/\/.+/.test(limpa)) {
    throw new Error('o endereço precisa começar com https://')
  }

  const segredo = novoSegredoDeWebhook()
  const db = clienteAdmin()

  const { error } = await db.from('webhook').upsert({
    conta_id: conta.contaId, url: limpa, segredo, ativo: true,
  }, { onConflict: 'conta_id' })
  if (error) throw error

  /*
   * O endereço entra no log, o segredo não. Trocar para onde os eventos da conta
   * são mandados é a mudança mais parecida com "redirecionar tudo" que esta tela
   * permite, e precisa deixar rastro.
   */
  // o log vai pelo cliente com sessão: `registrar` lê quem está logado, e a
  // chave de serviço não tem usuário nenhum para responder essa pergunta
  await registrar(await clienteServidor(), {
    contaId: conta.contaId, entidade: 'webhook', entidadeId: null,
    acao: 'editou', detalhe: { url: limpa },
  })

  revalidatePath('/config')
  return { segredo }
}

export async function desligarWebhook(): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta configura integração')
  }

  const db = clienteAdmin()
  // desligar, e não apagar: o histórico de eventos continua apontando para algo
  const { error } = await db.from('webhook')
    .update({ ativo: false }).eq('conta_id', conta.contaId)
  if (error) throw error

  await registrar(await clienteServidor(), {
    contaId: conta.contaId, entidade: 'webhook', entidadeId: null, acao: 'desativou',
  })
  revalidatePath('/config')
}
