import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * O que este arquivo cobre e nenhum outro cobre: que a tabela de preços entra
 * pela tela, que o código repetido é recusado dizendo de quem ele é, e que a
 * recepção não alcança preço.
 *
 * A pergunta é sempre "abriu, e fez o que prometeu?", que é a lição que a suíte
 * aprendeu em 16/08.
 */
test('cadastrar plano, e o código repetido dizer de quem é', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio dos planos')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Pilates aparelho', categoria: 'Pilates' })

  await entrar(page, email)
  await page.goto('/config?s=planos')

  await page.getByRole('button', { name: 'Novo plano' }).click()
  await page.getByLabel('Código').fill('002')
  await page.getByLabel('Nome do plano').fill('Mensal, 2x por semana')
  await page.getByLabel('Horários por semana').fill('2')
  await page.getByLabel('Preço de cliente').fill('735,00')
  await page.getByLabel('Preço cheio').fill('735,00')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  await expect(page.getByText('Mensal, 2x por semana')).toBeVisible()
  await expect(page.getByText('Todo mês · 2 horários')).toBeVisible()
  // preço igual nos dois não se repete: número repetido faz procurar a
  // diferença que não existe
  await expect(page.getByText('mesma').first()).toBeVisible()
  // o grupo é a categoria da modalidade, e não o nome dela
  await expect(page.getByText('Pilates · 1')).toBeVisible()

  await page.getByRole('button', { name: 'Novo plano' }).click()
  await page.getByLabel('Código').fill('002')
  await page.getByLabel('Nome do plano').fill('Qualquer outro')
  await page.getByLabel('Preço de cliente').fill('100,00')
  await page.getByLabel('Preço cheio').fill('100,00')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  await expect(page.getByText(/O código 002 já é de "Mensal, 2x por semana"/))
    .toBeVisible()
})

test('o pacote pergunta sessões, e o mensal não', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio do pacote')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  await admin.from('servico').insert({ conta_id: contaId, nome: 'Fisioterapia' })

  await entrar(page, email)
  await page.goto('/config?s=planos')
  await page.getByRole('button', { name: 'Novo plano' }).click()

  // no mensal, perguntar "quantas sessões" só serve para a tabela nascer com
  // campo preenchido no lugar errado
  await expect(page.getByLabel('Sessões no pacote')).toHaveCount(0)
  await expect(page.getByLabel('Horários por semana')).toBeVisible()

  // por papel, e não por `escolher`: o campo é obrigatório, e o asterisco do
  // rótulo derruba o `exact` do helper
  await page.getByRole('combobox', { name: 'Como cobra' }).click()
  await page.getByRole('option', { name: 'Pacote de sessões' }).click()
  await expect(page.getByLabel('Sessões no pacote')).toBeVisible()
  await expect(page.getByLabel('Horários por semana')).toHaveCount(0)

  await page.getByLabel('Código').fill('101')
  await page.getByLabel('Nome do plano').fill('Fisioterapia, pacote')
  await page.getByLabel('Sessões no pacote').fill('10')
  await page.getByLabel('Preço de cliente').fill('1.755,00')
  await page.getByLabel('Preço cheio').fill('2.070,00')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  await expect(page.getByText('10 sessões · validade 6 meses')).toBeVisible()
  // dois preços diferentes aparecem os dois, e é o caso que o módulo existe
  // para resolver
  await expect(page.getByText('R$ 1.755,00')).toBeVisible()
  await expect(page.getByText('R$ 2.070,00')).toBeVisible()
})

test('preço que não é número para o formulário, em vez de virar zero', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio do preço ruim')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  await admin.from('servico').insert({ conta_id: contaId, nome: 'Pilates solo' })

  await entrar(page, email)
  await page.goto('/config?s=planos')
  await page.getByRole('button', { name: 'Novo plano' }).click()
  await page.getByLabel('Código').fill('003')
  await page.getByLabel('Nome do plano').fill('Plano de preço torto')
  await page.getByLabel('Preço de cliente').fill('combinar')
  await page.getByLabel('Preço cheio').fill('combinar')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  await expect(page.getByText(/Escreva os dois preços em reais/)).toBeVisible()

  // e nada entrou no banco: plano valendo R$ 0,00 só apareceria na primeira
  // cobrança, meses depois
  const { count } = await admin.from('plano')
    .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)
  expect(count).toBe(0)
})

test('tirar de uso mantém o plano no catálogo, e o filtro o encontra', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio do plano velho')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  const { data: s } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Pilates aparelho' }).select().single()
  await admin.from('plano').insert({
    conta_id: contaId, servico_id: s!.id, codigo: '013', nome: 'Aula avulsa',
    recorrencia: 'avulsa', preco_vinculado_cent: 10000, preco_avulso_cent: 10000,
  })

  await entrar(page, email)
  await page.goto('/config?s=planos')

  await page.getByRole('button', { name: 'Tirar de uso' }).click()
  await expect(page.getByText('Desativado')).toBeVisible()

  await page.getByLabel('Só os que saíram de uso').check()
  await expect(page.getByText('Aula avulsa')).toBeVisible()

  // desativar não apaga: o plano continua nomeando o que já foi vendido
  const { data } = await admin.from('plano')
    .select('ativo').eq('conta_id', contaId).single()
  expect(data!.ativo).toBe(false)
})

test('a recepção não alcança a tabela de preços', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio sem recepção no preço')
  const { email } = await usuarioDe(contaId, 'recepcao', marca)

  await entrar(page, email)
  await page.goto('/config?s=planos')

  // Configuração inteira já é do dono: a recepção não vê nem a porta
  await expect(page).not.toHaveURL(/\/config/)
})

test('a turma ganha número, e o repetido diz de quem é', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio das turmas numeradas')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  await admin.from('servico').insert({ conta_id: contaId, nome: 'Pilates aparelho' })

  await entrar(page, email)
  await page.goto('/grade')

  await page.getByRole('button', { name: /Criar/ }).click()
  await page.getByRole('button', { name: 'seg', exact: true }).click()
  await page.getByLabel('Começa às').fill('07:00')
  await page.getByLabel('Número da turma').fill('001')
  await page.getByRole('button', { name: 'Criar horário', exact: true }).click()

  await expect(page.getByText('001').first()).toBeVisible()

  // o mesmo número na mesma conta é recusado, e a recusa diz qual turma já o usa
  await page.getByRole('button', { name: /Criar/ }).click()
  await page.getByRole('button', { name: 'ter', exact: true }).click()
  await page.getByLabel('Começa às').fill('08:00')
  await page.getByLabel('Número da turma').fill('001')
  await page.getByRole('button', { name: 'Criar horário', exact: true }).click()

  await expect(page.getByText(/O número 001 já é da turma de Segunda às 07:00/))
    .toBeVisible()
})

test('criar vários dias de uma vez não pergunta número', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio de três dias')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  await admin.from('servico').insert({ conta_id: contaId, nome: 'Pilates solo' })

  await entrar(page, email)
  await page.goto('/grade')
  await page.getByRole('button', { name: /Criar/ }).click()

  await page.getByRole('button', { name: 'seg', exact: true }).click()
  await expect(page.getByLabel('Número da turma')).toBeVisible()

  // dois dias criam duas turmas, e um número só não serve para as duas
  await page.getByRole('button', { name: 'qua', exact: true }).click()
  await expect(page.getByLabel('Número da turma')).toHaveCount(0)
})
