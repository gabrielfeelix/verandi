import { test, expect } from '@playwright/test'

/**
 * Termos e privacidade são públicos, e é isso que estes testes prendem.
 *
 * O defeito que eles existem para pegar é silencioso: basta alguém reorganizar
 * a lista de rotas públicas do `proxy.ts` e a política de privacidade passa a
 * redirecionar para a tela de entrar. Nada quebra, nenhum teste de produto
 * reclama, e o documento continua "publicado" para quem já está logado, que é
 * exatamente quem não precisa dele.
 */

test('sem sessão, os dois documentos abrem', async ({ page }) => {
  await page.goto('/privacidade')
  await expect(page).toHaveURL(/\/privacidade$/)
  await expect(
    page.getByRole('heading', { name: 'Política de privacidade', level: 1 }),
  ).toBeVisible()

  await page.goto('/termos')
  await expect(page).toHaveURL(/\/termos$/)
  await expect(page.getByRole('heading', { name: 'Termos de uso', level: 1 })).toBeVisible()
})

test('a política separa os dois papéis com todas as letras', async ({ page }) => {
  await page.goto('/privacidade')
  // a frase que estrutura o produto: quem coletou o dado foi o cliente
  await expect(page.getByText('a 4YU é operadora').first()).toBeVisible()
  await expect(page.getByText('a 4YU é controladora').first()).toBeVisible()
})

test('quem está do lado de fora chega aos documentos pelo rodapé', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Privacidade' }).click()
  await expect(
    page.getByRole('heading', { name: 'Política de privacidade', level: 1 }),
  ).toBeVisible()
})

test('o sumário leva à seção', async ({ page }) => {
  await page.goto('/termos')
  await page.getByRole('link', { name: /Encerramento/ }).first().click()
  await expect(page).toHaveURL(/#encerramento$/)
})
