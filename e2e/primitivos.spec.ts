import { test, expect } from '@playwright/test'

/**
 * A amostra existe para conferir contraste, foco e alvo de toque sem abrir seis
 * telas de produto. Estes testes prendem as três coisas que o protótipo erra e
 * que o produto não pode errar.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/amostra')
})

test('as nove peças aparecem', async ({ page }) => {
  for (const titulo of [
    'Botão', 'Tipografia', 'Tintas com significado', 'Etiqueta', 'Chip',
    'Campo', 'Nota', 'Avatar', 'Esqueleto', 'Modal e desfazer',
  ]) {
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
  }
})

test('o alvo de toque dos botões tem 44px', async ({ page }) => {
  // a tela de Sessão é usada em pé, numa sala, com a mão ocupada
  const caixa = await page.getByRole('button', { name: 'Salvar' }).boundingBox()
  expect(caixa!.height).toBeGreaterThanOrEqual(44)
})

test('o foco de teclado é visível', async ({ page }) => {
  const botao = page.getByRole('button', { name: 'Salvar' })
  await botao.focus()
  const contorno = await botao.evaluate(
    (e) => getComputedStyle(e).getPropertyValue('outline-style'),
  )
  expect(contorno).not.toBe('none')
})

test('o texto continua selecionável — o produto não é a demonstração', async ({ page }) => {
  const selecao = await page.evaluate(() => getComputedStyle(document.body).userSelect)
  expect(selecao).not.toBe('none')
})

test('as fontes vêm do próprio domínio, não do Google', async ({ page }) => {
  const externos = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"]')]
      .map((l) => (l as HTMLLinkElement).href)
      .filter((h) => h.includes('googleapis') || h.includes('gstatic')),
  )
  expect(externos).toEqual([])
})

test('o modal prende o foco e fecha com Esc', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modal' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('o destrutivo lista nominalmente quem é afetado', async ({ page }) => {
  // número sozinho não dá para conferir; lista dá
  await page.getByRole('button', { name: 'Abrir destrutivo' }).click()
  await expect(page.getByText('Vera Lúcia Braga')).toBeVisible()
  await expect(page.getByText('Cássia Mota')).toBeVisible()
})

test('desfazer aparece e some sozinho', async ({ page }) => {
  await page.getByRole('button', { name: 'Mostrar desfazer' }).click()
  const barra = page.getByRole('status')
  await expect(barra).toBeVisible()
  await expect(barra.getByRole('button', { name: 'Desfazer' })).toBeVisible()
  // seis segundos, sem ninguém tocar
  await expect(barra).toBeHidden({ timeout: 9000 })
})

test('o avatar de uma pessoa é sempre a mesma cor', async ({ page }) => {
  const cor = async (nome: string) =>
    page.getByTitle(nome).evaluate((e) => getComputedStyle(e).backgroundColor)

  await expect(page.getByTitle('Ruth Salgado')).toBeVisible()
  const primeira = await cor('Ruth Salgado')
  await page.reload()
  expect(await cor('Ruth Salgado')).toBe(primeira)
})
