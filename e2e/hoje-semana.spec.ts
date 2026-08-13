import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

/** Uma grade de verdade: duas séries em dias diferentes, com gente matriculada. */
async function cenario() {
  const base = await contaDeTeste()

  const { data: outroProf } = await admin.from('profissional')
    .insert({ conta_id: base.contaId, nome: 'Sofia' }).select().single()

  const { data: series } = await admin.from('serie').insert([
    { conta_id: base.contaId, servico_id: base.servicoId,
      profissional_id: base.profissionalId, local_id: base.localId,
      dia_semana: 1, hora_inicio: '07:00', duracao_min: 60, capacidade: 4,
      vigencia_inicio: '2026-01-01' },
    { conta_id: base.contaId, servico_id: base.servicoId,
      profissional_id: outroProf!.id, local_id: base.localId,
      dia_semana: 3, hora_inicio: '10:00', duracao_min: 60, capacidade: 2,
      vigencia_inicio: '2026-01-01' },
  ]).select()

  const pessoas = await criarPessoas(base.contaId, ['Helena Moraes', 'Otávio Prado'])
  await admin.from('vaga').insert([
    { conta_id: base.contaId, serie_id: series![0].id,
      pessoa_id: pessoas[0].id, inicio: '2026-01-01' },
    { conta_id: base.contaId, serie_id: series![1].id,
      pessoa_id: pessoas[1].id, inicio: '2026-01-01' },
  ])

  await admin.from('excecao_calendario').insert({
    conta_id: base.contaId, data: '2026-08-07', tipo: 'feriado',
    descricao: 'Feriado municipal',
  })

  return { ...base, outroProfId: outroProf!.id as string, pessoas }
}

test('a grade da semana materializa sozinha e mostra a ocupação', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  // nada foi materializado ainda: abrir a semana é o gatilho
  await page.goto('/semana?de=2026-08-03')
  await expect(page.getByRole('heading', { level: 1 }))
    .toContainText('Semana de 2026-08-03')

  const grade = page.locator('table')
  await expect(grade.getByRole('row').filter({ hasText: '07:00' })).toBeVisible()
  await expect(grade.getByText('1/4').first()).toBeVisible()
  await expect(grade.getByText('1/2').first()).toBeVisible()

  const { count } = await admin.from('sessao')
    .select('*', { count: 'exact', head: true }).eq('conta_id', c.contaId)
  expect(count).toBeGreaterThan(0)
})

test('feriado aparece na coluna do dia', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/semana?de=2026-08-03')
  await expect(page.locator('table').getByText('Feriado municipal')).toBeVisible()
})

test('filtrar por profissional mostra só a agenda dele', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto(`/semana?de=2026-08-03&profissional=${c.outroProfId}`)
  const grade = page.locator('table')
  await expect(grade.getByText('Sofia').first()).toBeVisible()
  await expect(grade.getByText('Marina')).toBeHidden()
})

test('em celular a grade vira um dia por vez', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, email)

  await page.goto('/semana?de=2026-08-03&dia=2026-08-05')
  await expect(page.locator('table')).toBeHidden()
  await expect(page.getByRole('link', { name: /10:00/ })).toBeVisible()
})

test('clicar numa célula abre a sessão', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/semana?de=2026-08-03')
  await page.locator('table a').first().click()
  await expect(page).toHaveURL(/\/sessao\//)
})

test('Hoje destaca a chamada pendente e anda entre os dias', async ({ page }) => {
  const c = await cenario()
  const { email, usuarioId } = await usuarioDe(c.contaId, 'profissional', c.marca)
  await admin.from('profissional').update({ usuario_id: usuarioId }).eq('id', c.profissionalId)

  await entrar(page, email)
  await page.goto('/hoje?dia=2026-08-03')

  await expect(page.getByText('1 chamada pendente.')).toBeVisible()
  await expect(page.getByRole('link', { name: /07:00/ })).toBeVisible()

  // a quarta é da Sofia: o profissional não vê a agenda dela
  await page.goto('/hoje?dia=2026-08-05')
  await expect(page.getByText('Nenhum horário neste dia.')).toBeVisible()
})

test('dono alterna entre a própria agenda e a de todos', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/hoje?dia=2026-08-05&todos=1')
  await expect(page.getByRole('link', { name: /10:00/ })).toBeVisible()
  await expect(page.getByText('Sofia')).toBeVisible()
})

test('dia sem horário diz isso com naturalidade', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/hoje?dia=2026-08-09&todos=1') // domingo
  await expect(page.getByText('Nenhum horário neste dia.')).toBeVisible()
})
