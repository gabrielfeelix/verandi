import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

/** Uma sessão de capacidade 2 já cheia, mais alguém de fora esperando. */
async function cenarioCheio() {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)

  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: base.contaId, servico_id: base.servicoId,
    profissional_id: base.profissionalId, local_id: base.localId,
    inicio: '2026-08-12T13:00:00Z', duracao_min: 60, capacidade: 2,
  }).select().single()

  const pessoas = await criarPessoas(base.contaId,
    ['Helena Moraes', 'Otávio Prado', 'Beatriz Nogueira'])

  await admin.from('participacao').insert(
    pessoas.slice(0, 2).map((p) => ({
      conta_id: base.contaId, sessao_id: sessao!.id, pessoa_id: p.id,
      origem: 'recorrente' as const, status: 'esperada' as const,
    })),
  )

  return { ...base, email, sessaoId: sessao!.id as string, pessoas }
}

test('horário cheio recusa o encaixe e aponta a saída', async ({ page }) => {
  const c = await cenarioCheio()
  // esta conta escolheu bloquear excedente: lotada é lotada, e a saída é subir
  // a capacidade do dia
  await admin.from('conta').update({ encaixe_acima: false }).eq('id', c.contaId)
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await expect(page.getByText('2/2 — cheio')).toBeVisible()

  await page.getByPlaceholder('Buscar por nome').fill('Beatriz')
  await page.getByRole('button', { name: /Beatriz Nogueira/ }).click()

  await expect(page.getByText('Para caber mais um, aumente a capacidade')).toBeVisible()

  const { count } = await admin.from('participacao')
    .select('*', { count: 'exact', head: true }).eq('sessao_id', c.sessaoId)
  expect(count).toBe(2)
})

test('aumentar a capacidade do dia abre a vaga, e a série não muda', async ({ page }) => {
  const c = await cenarioCheio()

  const { data: serie } = await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    dia_semana: 3, hora_inicio: '10:00', duracao_min: 60, capacidade: 2,
    vigencia_inicio: '2026-01-01',
  }).select().single()
  await admin.from('sessao').update({ serie_id: serie!.id }).eq('id', c.sessaoId)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await page.getByLabel('Capacidade só deste dia').fill('3')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('2/3 — 1 livre(s)')).toBeVisible()

  await page.getByPlaceholder('Buscar por nome').fill('Beatriz')
  await page.getByRole('button', { name: /Beatriz Nogueira/ }).click()

  await expect.poll(async () => {
    const { count } = await admin.from('participacao')
      .select('*', { count: 'exact', head: true }).eq('sessao_id', c.sessaoId)
    return count
  }).toBe(3)

  // a grade fixa das outras semanas continua igual
  const { data: depois } = await admin.from('serie')
    .select('capacidade').eq('id', serie!.id).single()
  expect(depois!.capacidade).toBe(2)
})

test('quem avisou que não vem devolve a vaga', async ({ page }) => {
  const c = await cenarioCheio()
  await admin.from('participacao').update({ status: 'falta_avisada' })
    .eq('sessao_id', c.sessaoId).eq('pessoa_id', c.pessoas[1].id)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await expect(page.getByText('1/2 — 1 livre(s)')).toBeVisible()

  await page.getByLabel('Tipo').selectOption('reposicao')
  await page.getByPlaceholder('Buscar por nome').fill('Beatriz')
  await page.getByRole('button', { name: /Beatriz Nogueira/ }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('origem').eq('sessao_id', c.sessaoId).eq('pessoa_id', c.pessoas[2].id)
      .maybeSingle()
    return data?.origem ?? null
  }).toBe('reposicao')
})

test('a mesma pessoa duas vezes é recusada', async ({ page }) => {
  const c = await cenarioCheio()
  await admin.from('sessao').update({ capacidade: 5 }).eq('id', c.sessaoId)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await page.getByPlaceholder('Buscar por nome').fill('Helena')
  await page.getByRole('button', { name: /Helena Moraes/ }).click()

  await expect(page.getByText('já está neste horário')).toBeVisible()
})

test('cancelar o horário avisa quantas pessoas serão afetadas', async ({ page }) => {
  const c = await cenarioCheio()
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  let textoDoAviso = ''
  page.on('dialog', (d) => { textoDoAviso = d.message(); d.accept() })

  await page.getByLabel('Cancelar este horário').fill('Sala interditada')
  await page.getByRole('button', { name: 'Cancelar horário' }).click()

  await expect(page.getByText('Horário cancelado — Sala interditada')).toBeVisible()
  expect(textoDoAviso).toContain('2 pessoa(s)')
})

test('com encaixe acima permitido, a tela pede confirmação e registra a exceção', async ({ page }) => {
  const c = await cenarioCheio()
  await admin.from('conta').update({ encaixe_acima: true }).eq('id', c.contaId)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await expect(page.getByText('2/2 — cheio')).toBeVisible()

  await page.getByPlaceholder('Buscar por nome').fill('Beatriz')
  await page.getByRole('button', { name: /Beatriz Nogueira/ }).click()

  // não grava no primeiro toque: passa da capacidade e a tela conta isso
  await expect(page.getByText(/Encaixar deixa 3\/2/)).toBeVisible()
  const antes = await admin.from('participacao')
    .select('*', { count: 'exact', head: true }).eq('sessao_id', c.sessaoId)
  expect(antes.count).toBe(2)

  await page.getByRole('button', { name: 'Encaixar mesmo assim' }).click()

  await expect.poll(async () => {
    const { count } = await admin.from('participacao')
      .select('*', { count: 'exact', head: true }).eq('sessao_id', c.sessaoId)
    return count
  }).toBe(3)
})

test('desistir da confirmação não grava nada', async ({ page }) => {
  const c = await cenarioCheio()
  await admin.from('conta').update({ encaixe_acima: true }).eq('id', c.contaId)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await page.getByPlaceholder('Buscar por nome').fill('Beatriz')
  await page.getByRole('button', { name: /Beatriz Nogueira/ }).click()
  await page.getByRole('button', { name: 'Não encaixar' }).click()

  const { count } = await admin.from('participacao')
    .select('*', { count: 'exact', head: true }).eq('sessao_id', c.sessaoId)
  expect(count).toBe(2)
})

test('a busca de vaga não oferece horário cheio, mesmo com encaixe permitido', async ({ page }) => {
  const c = await cenarioCheio()
  await admin.from('conta').update({ encaixe_acima: true }).eq('id', c.contaId)

  // uma sessão cheia amanhã: a busca olha para frente
  const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, inicio: `${amanha}T13:00:00Z`, duracao_min: 60,
    capacidade: 1, status: 'prevista', motivo_cancelamento: null,
  }).select().single()
  await admin.from('participacao').insert({
    conta_id: c.contaId, sessao_id: sessao!.id, pessoa_id: c.pessoas[0].id,
    origem: 'recorrente', status: 'esperada',
  })

  await entrar(page, c.email)
  await page.goto('/vaga')

  // a recepção pode abrir exceção olhando para a pessoa; a busca não decide nada
  await expect(page.getByRole('heading', { name: /Cheios/ })).toBeVisible()
  await expect(page.getByLabel('Horários cheios')).toContainText('1/1')
})
