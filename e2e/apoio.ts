import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
) as Record<string, string>

export const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const SENHA = 'senha-de-teste-123'

let seq = 0

/** Uma conta nova, isolada, com serviço e local prontos. */
export async function contaDeTeste(nome = 'Estúdio E2E') {
  const marca = `${Date.now()}-${++seq}`
  const { data: conta } = await admin.from('conta')
    .insert({ nome, slug: `e2e-${marca}`, fuso: 'America/Sao_Paulo' })
    .select().single()

  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: conta!.id, nome: 'Pilates solo', capacidade_padrao: 4 })
    .select().single()

  const { data: local } = await admin.from('local')
    .insert({ conta_id: conta!.id, nome: 'Sala 1' }).select().single()

  const { data: profissional } = await admin.from('profissional')
    .insert({ conta_id: conta!.id, nome: 'Marina' }).select().single()

  return {
    contaId: conta!.id as string,
    servicoId: servico!.id as string,
    localId: local!.id as string,
    profissionalId: profissional!.id as string,
    marca,
  }
}

export async function usuarioDe(contaId: string, papel: string, marca: string) {
  const email = `${papel}-${marca}@teste.local`
  const { data } = await admin.auth.admin.createUser({
    email, password: SENHA, email_confirm: true,
  })
  await admin.from('usuario_conta')
    .insert({ usuario_id: data.user!.id, conta_id: contaId, papel })
  return { email, usuarioId: data.user!.id as string }
}

export async function entrar(page: Page, email: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))
}

export async function criarPessoas(contaId: string, nomes: string[]) {
  const { data } = await admin.from('pessoa')
    .insert(nomes.map((nome) => ({ conta_id: contaId, nome })))
    .select('id, nome')
  return data as { id: string; nome: string }[]
}
