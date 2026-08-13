'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'

/**
 * Nome é o único campo obrigatório, de propósito.
 *
 * Exigir telefone é o jeito mais rápido de fazer a recepção inventar um
 * número: no dado real, 30% das pessoas não têm telefone cadastrado.
 */
export async function criarPessoa(entrada: {
  nome: string
  telefone?: string
  identificadorExterno?: string
}): Promise<{ id: string }> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const nome = entrada.nome.trim()
  if (!nome) throw new Error('nome é obrigatório')

  const { data, error } = await db.from('pessoa').insert({
    conta_id: conta.contaId,
    nome,
    telefone: entrada.telefone?.trim() || null,
    identificador_externo: entrada.identificadorExterno?.trim() || null,
  }).select('id').single<{ id: string }>()

  if (error) throw error
  revalidatePath('/pessoas')
  return { id: data.id }
}

export async function editarPessoa(id: string, campos: {
  nome?: string
  telefone?: string | null
  email?: string | null
  identificadorExterno?: string | null
  nascimento?: string | null
  vencimentoPlano?: string | null
  observacao?: string | null
  ativo?: boolean
}): Promise<void> {
  const db = await clienteServidor()

  const linha: Record<string, unknown> = {}
  if (campos.nome !== undefined) linha.nome = campos.nome.trim()
  if (campos.telefone !== undefined) linha.telefone = campos.telefone || null
  if (campos.email !== undefined) linha.email = campos.email || null
  if (campos.identificadorExterno !== undefined) {
    linha.identificador_externo = campos.identificadorExterno || null
  }
  if (campos.nascimento !== undefined) linha.nascimento = campos.nascimento || null
  if (campos.vencimentoPlano !== undefined) {
    linha.vencimento_plano = campos.vencimentoPlano || null
  }
  if (campos.observacao !== undefined) linha.observacao = campos.observacao || null
  if (campos.ativo !== undefined) linha.ativo = campos.ativo

  const { error } = await db.from('pessoa').update(linha).eq('id', id)
  if (error) throw error

  revalidatePath(`/pessoas/${id}`)
  revalidatePath('/pessoas')
}

export async function criarVaga(
  serieId: string, pessoaId: string, inicio: string,
): Promise<void> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { error } = await db.from('vaga').insert({
    conta_id: conta.contaId, serie_id: serieId, pessoa_id: pessoaId, inicio,
  })
  if (error) throw error

  revalidatePath(`/pessoas/${pessoaId}`)
  revalidatePath('/semana')
}

/**
 * Encerrar **não apaga o passado**: a vaga ganha data de fim, e o histórico de
 * antes dela continua exatamente como estava.
 */
export async function encerrarVaga(vagaId: string, fim: string): Promise<void> {
  const db = await clienteServidor()
  const { data, error } = await db.from('vaga')
    .update({ fim }).eq('id', vagaId)
    .select('pessoa_id').maybeSingle<{ pessoa_id: string }>()
  if (error) throw error
  if (data) revalidatePath(`/pessoas/${data.pessoa_id}`)
}
