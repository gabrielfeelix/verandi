import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import type { Papel } from '@/core/acesso/destino'

export async function clienteServidor() {
  const jar = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) => jar.set(name, value, options))
          } catch {
            // chamado de dentro de um Server Component, onde não dá para
            // escrever cookie. O middleware já renovou a sessão antes daqui.
          }
        },
      },
    },
  )
}

export type ContaAtiva = { contaId: string; papel: Papel; nome: string }

/**
 * A conta em que o usuário está trabalhando.
 *
 * Quem pertence a uma só nunca escolhe; quem pertence a várias escolhe em
 * `/contas`, e a escolha fica num cookie. Operar na conta errada é o erro mais
 * caro que este sistema permite, e ele é silencioso — por isso a conta ativa
 * precisa aparecer em toda tela.
 */
export async function contaAtiva(): Promise<ContaAtiva | null> {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('usuario_conta')
    .select('conta_id, papel, conta:conta_id(nome)')
    .eq('usuario_id', user.id)
    .eq('ativo', true)

  if (!data?.length) return null

  const jar = await cookies()
  const escolhida = jar.get('conta')?.value
  const linha = data.find((l) => l.conta_id === escolhida) ?? data[0]

  return {
    contaId: linha.conta_id,
    papel: linha.papel as Papel,
    nome: (linha.conta as unknown as { nome: string }).nome,
  }
}

/** Como `contaAtiva`, mas para telas que não fazem sentido sem conta. */
export async function exigirConta(): Promise<ContaAtiva> {
  const conta = await contaAtiva()
  if (!conta) redirect('/entrar')
  return conta
}

/** Todas as contas do usuário, para a tela de troca. */
export async function contasDoUsuario(): Promise<
  Array<{ contaId: string; nome: string; papel: Papel }>
> {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return []

  const { data } = await db
    .from('usuario_conta')
    .select('conta_id, papel, conta:conta_id(nome)')
    .eq('usuario_id', user.id)
    .eq('ativo', true)

  return (data ?? []).map((l) => ({
    contaId: l.conta_id,
    papel: l.papel as Papel,
    nome: (l.conta as unknown as { nome: string }).nome,
  }))
}
