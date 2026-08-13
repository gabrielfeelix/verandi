import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

/** Uma conta com catálogo pronto e grade vazia — o começo de todo cliente. */
async function contaSemGrade() {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  return { ...base, email }
}

test('conta nova mostra a grade vazia dizendo o que fazer', async ({ page }) => {
  const c = await contaSemGrade()
  await entrar(page, c.email)
  await page.goto('/grade')

  await expect(page.getByText('A grade está vazia')).toBeVisible()
})

test('criar em três dias de uma vez cria três séries', async ({ page }) => {
  const c = await contaSemGrade()
  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: /Criar/ }).click()
  for (const dia of ['seg', 'qua', 'sex']) {
    await page.getByRole('checkbox', { name: dia, exact: true }).check()
  }
  await page.getByLabel('Começa às').fill('07:00')
  await page.getByLabel('Capacidade').fill('4')
  await page.getByLabel('Serviço').selectOption({ label: 'Pilates solo' })
  await page.getByLabel('Profissional').selectOption({ label: 'Marina' })
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { count } = await admin.from('serie')
      .select('*', { count: 'exact', head: true }).eq('conta_id', c.contaId)
    return count
  }).toBe(3)

  await expect(page.getByRole('heading', { name: 'Segunda' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sexta' })).toBeVisible()
})

test('horário do mesmo profissional avisa a colisão e deixa seguir', async ({ page }) => {
  const c = await contaSemGrade()
  await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, dia_semana: 1, hora_inicio: '07:00', duracao_min: 60,
    capacidade: 4, vigencia_inicio: '2026-01-01', ativo: true,
  })

  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: /Criar/ }).click()
  await page.getByRole('checkbox', { name: 'seg', exact: true }).check()
  await page.getByLabel('Começa às').fill('07:30')
  await page.getByLabel('Serviço').selectOption({ label: 'Pilates solo' })
  await page.getByLabel('Profissional').selectOption({ label: 'Marina' })
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('Esse horário já tem coisa marcada')).toBeVisible()
  await expect(page.getByText(/Marina já ocupa/)).toBeVisible()

  // a série não foi criada enquanto o aviso não foi confirmado
  const { count } = await admin.from('serie')
    .select('*', { count: 'exact', head: true }).eq('conta_id', c.contaId)
  expect(count).toBe(1)

  await page.getByRole('button', { name: 'Criar mesmo assim' }).click()
  await expect.poll(async () => {
    const { count } = await admin.from('serie')
      .select('*', { count: 'exact', head: true }).eq('conta_id', c.contaId)
    return count
  }).toBe(2)
})

test('a grade mostra ocupação e separa as encerradas', async ({ page }) => {
  const c = await contaSemGrade()
  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  const anteontem = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)

  const { data: viva } = await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, dia_semana: 2, hora_inicio: '08:00', duracao_min: 60,
    capacidade: 4, vigencia_inicio: anteontem, vigencia_fim: null, ativo: true,
  }).select().single()

  await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, dia_semana: 4, hora_inicio: '19:00', duracao_min: 45,
    capacidade: 2, vigencia_inicio: anteontem, vigencia_fim: ontem, ativo: true,
  })

  const pessoas = await criarPessoas(c.contaId, ['Helena Moraes', 'Otávio Prado'])
  await admin.from('vaga').insert(pessoas.map((p) => ({
    conta_id: c.contaId, serie_id: viva!.id, pessoa_id: p.id,
    inicio: anteontem, fim: null,
  })))

  await entrar(page, c.email)
  await page.goto('/grade')

  await expect(page.getByText('2/4')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Encerradas' })).toBeVisible()
  await expect(page.getByText(`encerrada em ${ontem}`)).toBeVisible()
})

test('recepção lê a grade e não pode montar', async ({ page }) => {
  const c = await contaSemGrade()
  const recepcao = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec`)

  await entrar(page, recepcao.email)
  await page.goto('/grade')

  await expect(page.getByRole('heading', { name: 'Grade fixa' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Criar/ })).toHaveCount(0)
})

test('profissional não alcança a grade', async ({ page }) => {
  const c = await contaSemGrade()
  const prof = await usuarioDe(c.contaId, 'profissional', `${c.marca}-prof`)

  await entrar(page, prof.email)
  await page.goto('/grade')

  await expect(page).toHaveURL(/\/hoje/)
})

test('a tela usa o rótulo da conta, não a palavra do código', async ({ page }) => {
  const c = await contaSemGrade()
  await admin.from('vocabulario').insert([
    { conta_id: c.contaId, chave: 'serie', singular: 'Turma', plural: 'Turmas' },
  ])

  await entrar(page, c.email)
  await page.goto('/grade')

  await expect(page.getByRole('button', { name: 'Criar turma' })).toBeVisible()
})
