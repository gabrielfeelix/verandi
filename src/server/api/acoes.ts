'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { novaChave } from './chave'

/**
 * Chave de API é a credencial mais forte que um cliente emite: ela alcança a
 * agenda inteira da conta sem passar por papel. Quem cria é quem responde pela
 * conta, e mais ninguém.
 */
async function exigirDono() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta gerencia integrações')
  }
  return conta
}

/**
 * Cria a chave e **devolve o segredo uma vez**.
 *
 * Quem chamar precisa mostrar na hora: não há segunda chance, porque o banco
 * guarda só o hash. É por isso que esta função devolve o segredo em vez de
 * apenas gravar, e é por isso que a tela mostra o campo de copiar antes de
 * qualquer outra coisa.
 */
export async function criarChaveApi(nome: string): Promise<{ segredo: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const limpo = nome.trim()
  if (!limpo) throw new Error('a chave precisa de um nome')

  const { segredo, hash, prefixo } = novaChave()
  const { data: { user } } = await db.auth.getUser()

  const { data, error } = await db.from('chave_api').insert({
    conta_id: conta.contaId,
    nome: limpo,
    hash,
    prefixo,
    criada_por_usuario_id: user?.id ?? null,
  }).select('id').single()
  if (error) throw error

  // o nome entra no log; o segredo e o hash não. O log serve para saber que uma
  // porta foi aberta, não para reabrir a porta
  await registrar(db, {
    contaId: conta.contaId, entidade: 'chave_api', entidadeId: data.id,
    acao: 'criou', detalhe: { nome: limpo },
  })

  revalidatePath('/config')
  return { segredo }
}

/**
 * Revogar **não apaga**: a linha fica com a data.
 *
 * Sem isso, "quem marcou esta aula?" passa a apontar para uma chave que não
 * existe mais, e o histórico perde o pé. É a mesma régua de desativar serviço,
 * local e profissional.
 */
export async function revogarChaveApi(id: string): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { data, error } = await db.from('chave_api')
    .update({ revogada_em: new Date().toISOString() })
    .eq('id', id)
    .eq('conta_id', conta.contaId)
    .is('revogada_em', null)
    .select('nome')
    .maybeSingle()
  if (error) throw error
  if (!data) return

  await registrar(db, {
    contaId: conta.contaId, entidade: 'chave_api', entidadeId: id,
    acao: 'removeu', detalhe: { nome: data.nome },
  })

  revalidatePath('/config')
}
