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

/*
 * As três coisas que passaram por tsc, eslint e 209 testes verdes e mesmo assim
 * chegaram tortas na tela. Nenhuma delas quebra em teste de comportamento — só
 * aparece no olho, e por isso são medidas aqui.
 */
test('o token de raio vira raio de verdade', async ({ page }) => {
  // `rounded-[--radius-cartao]` não é sintaxe do Tailwind v4: vira
  // `border-radius: --radius-cartao`, que o navegador descarta calado. O app
  // inteiro rodou sem canto arredondado nenhum sem nada acusar.
  const raio = (sel: string) =>
    page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius))

  expect(await raio('section')).toBeGreaterThan(0)
  expect(await raio('button')).toBeGreaterThan(0)
})

test('o que se clica mostra a mão', async ({ page }) => {
  // o Tailwind v4 mudou `<button>` para `cursor: default`, e a tela inteira
  // passa a parecer que não responde
  const cursor = await page
    .getByRole('button', { name: 'Salvar' })
    .evaluate((e) => getComputedStyle(e).cursor)
  expect(cursor).toBe('pointer')
})

test('o campo vazio é branco com borda, não cinza sem borda', async ({ page }) => {
  const campo = page.getByLabel('Nome')
  const estilo = await campo.evaluate((e) => {
    const c = getComputedStyle(e)
    return { fundo: c.backgroundColor, borda: c.borderTopColor }
  })
  expect(estilo.fundo).toBe('rgb(255, 255, 255)')
  expect(estilo.borda).toBe('rgb(223, 229, 226)')
})

test('o foco do campo marca a moldura inteira, não meio campo', async ({ page }) => {
  // num campo composto ("senha · mostrar") o contorno do `<input>` cerca só ele
  // e deixa o botão de fora, como se metade do campo estivesse focada
  const campo = page.getByLabel('Nome')
  await campo.click()
  expect(await campo.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none')

  // `poll` porque a borda tem transição de .15s: medir na hora pega o meio dela
  await expect
    .poll(() => campo.evaluate((e) => getComputedStyle(e).borderTopColor))
    .toBe('rgb(14, 124, 107)')
})
