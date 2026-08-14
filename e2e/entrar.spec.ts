import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { ESQUEMA } from '../src/server/esquema'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
) as Record<string, string>

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: ESQUEMA },
  auth: { persistSession: false, autoRefreshToken: false },
})

const SENHA = 'senha-de-teste-123'
const marca = Date.now()
let contaId: string

test.beforeAll(async () => {
  const { data } = await admin.from('conta')
    .insert({ nome: 'Estúdio E2E', slug: `e2e-${marca}` }).select().single()
  contaId = data!.id
})

let sequencia = 0

async function criarUsuario(papel: string) {
  // sequência porque o mesmo papel é criado mais de uma vez no arquivo, e
  // e-mail repetido faz o createUser devolver null sem estourar
  const email = `${papel}-e2e-${marca}-${++sequencia}@teste.local`
  const { data } = await admin.auth.admin.createUser({
    email, password: SENHA, email_confirm: true,
  })
  await admin.from('usuario_conta')
    .insert({ usuario_id: data.user!.id, conta_id: contaId, papel })
  return email
}

test('quem não entrou é mandado para /entrar', async ({ page }) => {
  await page.goto('/semana')
  await expect(page).toHaveURL(/\/entrar/)
})

test('senha errada não revela se o e-mail existe', async ({ page }) => {
  const email = await criarUsuario('profissional')

  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  const comEmailReal = await page.getByRole('alert').textContent()

  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(`nao-existe-${marca}@teste.local`)
  await page.getByLabel('Senha').fill('qualquer-coisa')
  await page.getByRole('button', { name: 'Entrar' }).click()
  const comEmailFalso = await page.getByRole('alert').textContent()

  expect(comEmailReal).toBe(comEmailFalso)
})

for (const [papel, destino] of [
  ['profissional', '/hoje'],
  ['dono', '/semana'],
  ['recepcao', '/semana'],
  ['suporte', '/contas'],
] as const) {
  test(`${papel} entra e cai em ${destino}`, async ({ page }) => {
    const email = await criarUsuario(papel)

    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(new RegExp(`${destino}$`))
  })
}
