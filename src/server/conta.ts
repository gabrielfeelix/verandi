import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import type { Papel } from '@/core/acesso/destino'
import { ESQUEMA } from './esquema'
import type { Database } from './banco.types'

/**
 * O cliente que respeita a RLS, com a sessão do cookie: é o caminho de toda
 * tela e de toda ação do usuário.
 *
 * `Database` vem do arquivo gerado por `npm run tipos`. Sem ele, este cliente
 * aceitava qualquer nome de tabela e qualquer nome de coluna, e devolvia um
 * tipo que cada consulta tinha de reescrever à mão.
 *
 * **Um por pedido, e é daí que vem a velocidade.** O `cache` do React não
 * guarda nada entre pedidos: ele só faz a segunda chamada dentro do mesmo
 * render devolver o mesmo cliente. Sem isso, cada tela criava quatro ou cinco
 * clientes — o proxy, o layout, `contaAtiva`, `contasDoUsuario`, a página — e o
 * **primeiro `getUser` de cada cliente novo é uma ida ao servidor de
 * autenticação**, medida em 90 ms com o banco na própria máquina. As chamadas
 * seguintes do mesmo cliente custam 1 ms, porque o supabase-js já guardou a
 * resposta. Eram 350 ms de "quem é você" repetido antes de qualquer consulta
 * do produto começar, em toda navegação.
 */
export const clienteServidor = cache(async function clienteServidor() {
  const jar = await cookies()
  return createServerClient<Database, 'app_verandi'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: ESQUEMA },
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
})

export type ContaAtiva =
  { contaId: string; papel: Papel; nome: string; fuso: string; interna: boolean }

/**
 * A conta em que o usuário está trabalhando.
 *
 * Quem pertence a uma só nunca escolhe; quem pertence a várias escolhe em
 * `/contas`, e a escolha fica num cookie. Operar na conta errada é o erro mais
 * caro que este sistema permite, e ele é silencioso — por isso a conta ativa
 * precisa aparecer em toda tela.
 *
 * `cache` pelo mesmo motivo do cliente: o layout pergunta, a página pergunta de
 * novo, e às vezes a ação pergunta uma terceira vez. A resposta é a mesma
 * dentro do mesmo pedido, e cada repetição custava uma consulta a
 * `usuario_conta`.
 */
export const contaAtiva = cache(async function contaAtiva(): Promise<ContaAtiva | null> {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('usuario_conta')
    .select('conta_id, papel, conta:conta_id(nome, fuso, interna)')
    .eq('usuario_id', user.id)
    .eq('ativo', true)

  if (!data?.length) return null

  const jar = await cookies()
  const escolhida = jar.get('conta')?.value
  const linha = data.find((l) => l.conta_id === escolhida) ?? data[0]
  // com os tipos do banco gerados, `linha.conta` já vem com a forma certa: a
  // chave estrangeira é um-para-um e o supabase-js sabe disso pelo arquivo
  const conta = linha.conta

  return {
    contaId: linha.conta_id,
    papel: linha.papel as Papel,
    nome: conta.nome,
    // o fuso desce junto porque "hoje" é pergunta da conta, não da máquina
    fuso: conta.fuso,
    // a conta da própria 4YU não recebe a faixa de suporte
    interna: conta.interna,
  }
})

/**
 * O papel com que o usuário começa a sessão, logo depois de entrar.
 *
 * Existe separado de `contaAtiva` porque quem acabou de autenticar já tem o
 * `usuario_id` na mão: perguntar de novo ao servidor de auth é uma ida a mais
 * numa ação que a pessoa está esperando de olho na tela. Sem cookie de conta
 * escolhida ainda, o primeiro vínculo é o certo.
 */
export async function papelAoEntrar(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  usuarioId: string,
): Promise<Papel | null> {
  const { data } = await db
    .from('usuario_conta')
    .select('papel')
    .eq('usuario_id', usuarioId)
    .eq('ativo', true)
    .limit(1)
    

  return data?.[0]?.papel ?? null
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
    nome: l.conta.nome,
  }))
}
