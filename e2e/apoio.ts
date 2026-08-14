import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { ESQUEMA } from '../src/server/esquema'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
) as Record<string, string>

export const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: ESQUEMA },
  auth: { persistSession: false, autoRefreshToken: false },
})

export const SENHA = 'senha-de-teste-123'

/**
 * Engolir o erro do Supabase e quebrar depois em `data!` dá "cannot read
 * properties of null" numa linha que não tem nada a ver com o problema. Já
 * custou uma investigação inteira.
 */
function ou<T>(
  r: { data: T | null; error: { message: string } | null },
  oque: string,
): NonNullable<T> {
  if (r.error) throw new Error(`${oque}: ${r.error.message}`)
  if (r.data === null || r.data === undefined) throw new Error(`${oque}: não voltou nada`)
  return r.data
}

type Id = { id: string }

let seq = 0

/** Uma conta nova, isolada, com serviço e local prontos. */
export async function contaDeTeste(nome = 'Estúdio E2E') {
  const marca = `${Date.now()}-${++seq}`
  const conta = ou<Id>(await admin.from('conta')
    .insert({ nome, slug: `e2e-${marca}`, fuso: 'America/Sao_Paulo' })
    .select().single<Id>(), 'criar conta')

  const servico = ou<Id>(await admin.from('servico')
    .insert({ conta_id: conta.id, nome: 'Pilates solo', capacidade_padrao: 4 })
    .select().single<Id>(), 'criar serviço')

  const local = ou<Id>(await admin.from('local')
    .insert({ conta_id: conta.id, nome: 'Sala 1' }).select().single<Id>(), 'criar local')

  const profissional = ou<Id>(await admin.from('profissional')
    .insert({ conta_id: conta.id, nome: 'Marina' })
    .select().single<Id>(), 'criar profissional')

  return {
    contaId: conta.id as string,
    servicoId: servico.id as string,
    localId: local.id as string,
    profissionalId: profissional.id as string,
    marca,
  }
}

/**
 * A conta da própria 4YU, criada pela migration `0010`. É onde o papel
 * `suporte` mora: em conta de cliente, sair do suporte apaga o vínculo.
 */
export async function contaInterna(): Promise<string> {
  const c = ou<Id>(await admin.from('conta')
    .select('id').eq('interna', true).single<Id>(), 'achar a conta interna')
  return c.id as string
}

export async function usuarioDe(
  contaId: string, papel: string, marca: string,
  /**
   * O onboarding entra na frente de tudo: sem isto, toda tela deste teste
   * começaria em `/comecar`. Quem testa o onboarding passa `false` e vê a
   * primeira entrada de verdade.
   */
  opcoes: { pularOnboarding?: boolean } = {},
) {
  const email = `${papel}-${marca}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: SENHA, email_confirm: true,
  })
  if (error) throw new Error(`criar usuário ${email}: ${error.message}`)
  if (!data.user) throw new Error(`criar usuário ${email}: não voltou usuário`)

  const vinculo = await admin.from('usuario_conta')
    .insert({ usuario_id: data.user.id, conta_id: contaId, papel })
  if (vinculo.error) throw new Error(`vincular ${email}: ${vinculo.error.message}`)

  if (opcoes.pularOnboarding !== false) {
    const agora = new Date().toISOString()
    await admin.from('onboarding').insert(
      (['boas-vindas', 'primeiros-passos'] as const).map((roteiro) => ({
        conta_id: contaId, usuario_id: data.user!.id, roteiro, pulado_em: agora,
      })),
    )
  }

  return { email, usuarioId: data.user.id as string }
}

export async function entrar(page: Page, email: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))
}

export async function criarPessoas(contaId: string, nomes: string[]) {
  return ou<{ id: string; nome: string }[]>(
    await admin.from('pessoa')
      .insert(nomes.map((nome) => ({ conta_id: contaId, nome })))
      .select('id, nome')
      .returns<{ id: string; nome: string }[]>(),
    'criar pessoas',
  )
}
