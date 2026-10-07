import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

test('o sino mostra quem confirmou pelo WhatsApp, e a contagem some ao abrir', async ({ page }) => {
  const c = await contaDeTeste()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, inicio: new Date(Date.now() + 864e5).toISOString(),
    duracao_min: 60, capacidade: 4,
  }).select().single()
  const [maria, antiga] = await criarPessoas(c.contaId, ['MARIA BETANIA DA SILVA', 'Rosa Antiga'])
  await admin.from('participacao').insert([
    {
      conta_id: c.contaId, sessao_id: sessao!.id, pessoa_id: maria.id, origem: 'recorrente',
      status: 'confirmada', registrado_por_origem: 'bot', registrado_em: new Date().toISOString(),
    },
    // histórico importado hoje não é novidade de hoje
    {
      conta_id: c.contaId, sessao_id: sessao!.id, pessoa_id: antiga.id, origem: 'recorrente',
      status: 'falta_avisada', registrado_por_origem: 'importacao', registrado_em: new Date().toISOString(),
    },
  ])

  await entrar(page, email)
  await page.goto('/hoje')
  const sino = page.getByRole('button', { name: /^Notificações/ })
  await expect(sino).toHaveAccessibleName('Notificações, 1 novas')

  await sino.click()
  await expect(page.getByText('Maria Betania da Silva')).toBeVisible()
  await expect(page.getByText('confirmou presença')).toBeVisible()
  await expect(page.getByText('WhatsApp', { exact: true })).toBeVisible()
  await expect(page.getByText('Rosa Antiga')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await page.mouse.click(5, 5)
  await expect(sino).toHaveAccessibleName('Notificações')
})
