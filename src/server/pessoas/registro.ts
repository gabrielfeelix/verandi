import { erroDoTelefone, normalizarTelefone } from '@/core/telefone'
import type { Db } from '../supabase'

/**
 * Cadastrar alguém, sem saber quem está pedindo.
 *
 * Mesma razão de `encaixarNaSessao`: a ação de tela lê `cookies()` e a rota da
 * API não tem cookie nenhum. A regra desce para cá e as duas chamam, senão a
 * rota nasce com uma segunda versão de "o que é um cadastro válido" e as duas
 * divergem na primeira mudança.
 *
 * **Nome é o único campo obrigatório, de propósito.** Exigir telefone é o jeito
 * mais rápido de fazer a recepção inventar um número: no dado real, 30% das
 * pessoas não têm telefone cadastrado. Pelo bot vale ainda mais, porque quem
 * está conversando pode não querer dar o número antes de saber se há vaga.
 */
export async function inserirPessoa(
  db: Db,
  contaId: string,
  entrada: { nome: string; telefone?: string | null; identificadorExterno?: string | null },
): Promise<{ id: string }> {
  const nome = entrada.nome.trim()
  if (!nome) throw new Error('nome é obrigatório')

  // telefone continua opcional; o que não se aceita é telefone pela metade —
  // nove dígitos sem DDD é um número que não disca e ninguém adivinha depois
  const erroFone = erroDoTelefone(entrada.telefone)
  if (erroFone) throw new Error(erroFone)

  const { data, error } = await db.from('pessoa').insert({
    conta_id: contaId,
    nome,
    telefone: normalizarTelefone(entrada.telefone),
    identificador_externo: entrada.identificadorExterno?.trim() || null,
  }).select('id').single()

  if (error) throw error
  return { id: data.id }
}
