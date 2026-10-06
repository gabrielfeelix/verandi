import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

test('a ficha usa o crédito: agenda a reposição ligada à falta', async ({ page }) => {
  const c = await contaDeTeste('Estúdio da reposição')
  const { email } = await usuarioDe(c.contaId, 'recepcao', c.marca)
  const [ana] = await criarPessoas(c.contaId, ['Ana Reposta'])

  const sessao = async (inicio: string) => (await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, inicio, duracao_min: 60, capacidade: 4,
  }).select('id').single()).data!.id as string

  // a falta avisada, na semana passada, e uma aula com lugar daqui a dois dias
  const passada = await sessao(new Date(Date.now() - 6 * 864e5).toISOString())
  const futura = await sessao(new Date(Date.now() + 2 * 864e5).toISOString())
  const { data: falta } = await admin.from('participacao').insert({
    conta_id: c.contaId, sessao_id: passada, pessoa_id: ana.id,
    origem: 'recorrente', status: 'falta_avisada',
  }).select('id').single()

  await entrar(page, email)
  await page.goto(`/pessoas/${ana.id}?aba=reposicoes`)
  await page.getByRole('button', { name: 'Agendar reposição' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Marcar/ }).click()

  await expect(page.getByText(/reposição marcada/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agendar reposição' })).toHaveCount(0)

  const { data } = await admin.from('participacao')
    .select('origem, reposicao_de_id').eq('sessao_id', futura).eq('pessoa_id', ana.id)
    .single()
  expect(data!.origem).toBe('reposicao')
  expect(data!.reposicao_de_id).toBe(falta!.id)
})

test('"Marcar aula" no topo da ficha já usa a falta em aberto como reposição', async ({ page }) => {
  const c = await contaDeTeste('Estúdio do marcar aula')
  const { email } = await usuarioDe(c.contaId, 'recepcao', c.marca)
  const [ana] = await criarPessoas(c.contaId, ['Ana Marcada'])

  const sessao = async (inicio: string) => (await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, inicio, duracao_min: 60, capacidade: 4,
  }).select('id').single()).data!.id as string

  const passada = await sessao(new Date(Date.now() - 6 * 864e5).toISOString())
  const futura = await sessao(new Date(Date.now() + 2 * 864e5).toISOString())
  const { data: falta } = await admin.from('participacao').insert({
    conta_id: c.contaId, sessao_id: passada, pessoa_id: ana.id,
    origem: 'recorrente', status: 'falta_avisada',
  }).select('id').single()

  await entrar(page, email)
  await page.goto(`/pessoas/${ana.id}`)
  await page.getByRole('button', { name: /^Marcar / }).first().click()

  const modal = page.getByRole('dialog')
  await expect(modal.getByText(/Entra como/)).toContainText('Reposição')
  await modal.getByRole('button', { name: /Marcar$/ }).first().click()
  await expect(page.getByText(/reposição marcada/)).toBeVisible()

  const { data } = await admin.from('participacao')
    .select('origem, reposicao_de_id').eq('sessao_id', futura).eq('pessoa_id', ana.id)
    .single()
  expect(data!.origem).toBe('reposicao')
  expect(data!.reposicao_de_id).toBe(falta!.id)
})
