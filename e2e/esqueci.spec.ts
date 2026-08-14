import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, SENHA } from './apoio'

/**
 * "Esqueci a senha", que é público e não pede sessão nenhuma.
 *
 * O que estes testes guardam não é o envio (que depende do Brevo e não roda
 * aqui), é a **regra de não contar quem existe**: a tela precisa responder
 * igual para um e-mail cadastrado e para um inventado. Responder diferente
 * entrega, para quem só tem um formulário, a lista de quem trabalha no estúdio.
 */

test('a tela é pública e não manda ninguém para o login', async ({ page }) => {
  await page.goto('/esqueci')
  await expect(page.getByRole('heading', { name: 'Vamos criar outra' })).toBeVisible()
  expect(page.url()).toContain('/esqueci')
})

test('e-mail que não existe leva para a mesma tela de sempre', async ({ page }) => {
  await page.goto('/esqueci')
  await page.getByLabel('E-mail').fill(`ninguem-${Date.now()}@exemplo.invalido`)
  await page.getByRole('button', { name: 'Mandar o link' }).click()

  await expect(page).toHaveURL(/\/enviado/)
  await expect(page.getByRole('heading', { name: 'Link a caminho' })).toBeVisible()
  // "se este e-mail estiver cadastrado" é o que evita confirmar existência
  await expect(page.getByText(/se este e-mail estiver cadastrado/i)).toBeVisible()
})

test('e-mail que existe leva exatamente para a mesma tela', async ({ page }) => {
  const conta = await contaDeTeste('esqueci')
  const email = `dona-${Date.now()}@exemplo.test`
  const { data } = await admin.auth.admin.createUser({
    email, password: SENHA, email_confirm: true,
  })
  await admin.from('usuario_conta').insert({
    usuario_id: data.user!.id, conta_id: conta.contaId, papel: 'dono', ativo: true,
  })

  await page.goto('/esqueci')
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Mandar o link' }).click()

  await expect(page).toHaveURL(/\/enviado/)
  await expect(page.getByRole('heading', { name: 'Link a caminho' })).toBeVisible()

  // o token nasceu mesmo, ainda que o e-mail não saia sem chave do Brevo
  await expect.poll(async () => {
    const { data: linhas } = await admin.from('convite')
      .select('id').eq('email', email).eq('tipo', 'senha')
    return linhas?.length ?? 0
  }, { timeout: 10_000 }).toBe(1)
})

test('pedir duas vezes não gera dois links', async ({ page }) => {
  // sem esta trava, um formulário público vira máquina de encher caixa de
  // entrada alheia e de queimar a cota diária do Brevo
  const conta = await contaDeTeste('esqueci-repetido')
  const email = `repete-${Date.now()}@exemplo.test`
  const { data } = await admin.auth.admin.createUser({
    email, password: SENHA, email_confirm: true,
  })
  await admin.from('usuario_conta').insert({
    usuario_id: data.user!.id, conta_id: conta.contaId, papel: 'dono', ativo: true,
  })

  for (let i = 0; i < 2; i++) {
    await page.goto('/esqueci')
    await page.getByLabel('E-mail').fill(email)
    await page.getByRole('button', { name: 'Mandar o link' }).click()
    await expect(page).toHaveURL(/\/enviado/)
  }

  const { data: linhas } = await admin.from('convite')
    .select('id').eq('email', email).eq('tipo', 'senha')
  expect(linhas?.length).toBe(1)
})

test('a tela de entrar leva para o esqueci', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Esqueci a senha' }).click()
  await expect(page).toHaveURL(/\/esqueci/)
})
