import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, entrar, usuarioDe } from './apoio'

/**
 * A porta do bot, pela tela.
 *
 * A regra que sustenta esta seção inteira é uma: o segredo aparece **uma vez**.
 * Se algum dia ele voltar a aparecer, é porque alguém guardou o token legível no
 * banco, e isso só dói depois de vazar.
 */

async function contaDono(nome = 'Estúdio E2E') {
  const base = await contaDeTeste(nome)
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  return { ...base, email }
}

test('ligar o AutoFluxos cria a chave, e ela aparece uma vez só', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=integracoes')

  await expect(page.getByText('recomendado')).toBeVisible()

  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByLabel('Nome').fill('AutoFluxos produção')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  const campo = page.getByLabel('Chave de API')
  await expect(campo).toBeVisible()
  const segredo = await campo.inputValue()

  // o prefixo existe para a chave ser reconhecível num log ou num print
  expect(segredo.startsWith('vr_')).toBe(true)
  expect(segredo.length).toBeGreaterThan(40)

  // e o que foi para o banco é o hash, nunca o segredo
  await expect.poll(async () => {
    const { data } = await admin.from('chave_api')
      .select('nome, hash, prefixo, ultimo_uso_em, revogada_em')
      .eq('conta_id', c.contaId).single()
    return data
  }).toMatchObject({
    nome: 'AutoFluxos produção', ultimo_uso_em: null, revogada_em: null,
  })

  const { data: linha } = await admin.from('chave_api')
    .select('hash, prefixo').eq('conta_id', c.contaId).single()
  expect(linha!.hash).not.toContain(segredo)
  expect(segredo.startsWith(linha!.prefixo)).toBe(true)

  // recarregar não traz o segredo de volta: é o ponto da seção inteira
  await page.reload()
  await expect(page.getByLabel('Chave de API')).toHaveCount(0)
  await expect(page.getByText(segredo)).toHaveCount(0)
  await expect(page.getByText('AutoFluxos produção')).toBeVisible()
  await expect(page.getByText(`${linha!.prefixo}…`)).toBeVisible()
  await expect(page.getByText('nunca usada')).toBeVisible()
})

test('revogar fecha a porta e não apaga o passado', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=integracoes')

  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByLabel('Nome').fill('Chave velha')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await expect(page.getByLabel('Chave de API')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Revogar' }).click()
  await page.getByRole('button', { name: 'Revogar', exact: true }).last().click()

  await expect.poll(async () => {
    const { data } = await admin.from('chave_api')
      .select('nome, revogada_em').eq('conta_id', c.contaId).single()
    return data?.revogada_em === null ? 'viva' : `revogada, nome ${data?.nome}`
  }).toBe('revogada, nome Chave velha')

  // a linha continua na tela, apagada: sem ela, "quem marcou esta aula?" passa
  // a apontar para uma chave que não existe mais
  await page.reload()
  await expect(page.getByText('Chave velha')).toBeVisible()
  await expect(page.getByText(/revogada em/)).toBeVisible()
})

test('a recepção não alcança a seção de integrações', async ({ page }) => {
  const base = await contaDeTeste()
  const recepcao = await usuarioDe(base.contaId, 'recepcao', base.marca)

  await entrar(page, recepcao.email)
  await page.goto('/config?s=integracoes')

  // a Configuração inteira é do dono: a recepção nem chega na porta
  await expect(page).toHaveURL(/\/hoje/)
})
