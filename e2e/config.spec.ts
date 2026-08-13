import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, entrar, usuarioDe } from './apoio'

async function contaDono() {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  return { ...base, email }
}

test('cadastrar serviço e ele aparecer na grade', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=servicos')

  await page.getByRole('button', { name: 'Novo serviço' }).click()
  await page.getByLabel('Nome').fill('Fáscia avançada')
  await page.getByLabel('Duração (min)').fill('40')
  await page.getByLabel('Capacidade padrão').fill('3')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('Fáscia avançada')).toBeVisible()

  // o catálogo da grade enxerga na hora
  await page.goto('/grade')
  await page.getByRole('button', { name: /Criar/ }).click()
  await expect(page.getByLabel('Serviço')).toContainText('Fáscia avançada')
})

test('desativar serviço tira das escolhas novas e mantém no histórico', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=servicos')

  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('checkbox', { name: 'Ativo' }).uncheck()
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('inativo')).toBeVisible()

  await expect.poll(async () => {
    const { data } = await admin.from('servico')
      .select('ativo').eq('id', c.servicoId).single()
    return data?.ativo
  }).toBe(false)

  // some do editor de série, sem sumir do banco
  await page.goto('/grade')
  await page.getByRole('button', { name: /Criar/ }).click()
  await expect(page.getByText('cadastre um serviço em Configuração')).toBeVisible()
})

test('local guarda capacidade, e sem capacidade também vale', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=locais')

  await page.getByRole('button', { name: 'Novo local' }).click()
  await page.getByLabel('Nome').fill('Sala 2')
  await page.getByLabel('Capacidade').fill('6')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('cabe 6')).toBeVisible()
})

test('padrões salvam, inclusive os horários sugeridos', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=padroes')

  await page.getByLabel('Prazo da reposição').fill('30')
  await page.getByLabel('Novo horário').fill('06:30')
  await page.getByRole('button', { name: 'Acrescentar' }).click()
  await page.getByRole('button', { name: 'Salvar padrões' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('conta')
      .select('prazo_reposicao_dias, horarios_sugeridos').eq('id', c.contaId).single()
    return { prazo: data?.prazo_reposicao_dias, tem: data?.horarios_sugeridos?.includes('06:30:00') }
  }).toEqual({ prazo: 30, tem: true })
})

test('encaixe acima da capacidade é escolha, e a tela explica o limite dela', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=padroes')

  await expect(page.getByText(/A busca de vaga e o robô continuam sem enxergar horário cheio/))
    .toBeVisible()

  await page.getByRole('button', { name: 'Bloquear' }).click()
  await page.getByRole('button', { name: 'Salvar padrões' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('conta')
      .select('encaixe_acima').eq('id', c.contaId).single()
    return data?.encaixe_acima
  }).toBe(false)
})

test('vocabulário mostra o efeito antes de salvar, e muda a navegação depois', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=vocabulario')

  const singular = page.getByLabel('Singular').first()
  await singular.fill('Aluno')
  await page.getByLabel('Plural').first().fill('Alunos')

  // a prévia responde antes de gravar qualquer coisa
  await expect(page.getByText('Encaixar aluno')).toBeVisible()

  await page.getByRole('button', { name: 'Salvar vocabulário' }).click()
  await expect(page.getByRole('link', { name: 'Alunos' })).toBeVisible()
})

test('funcionamento fecha um dia e o dia fechado some da lista de horários', async ({ page }) => {
  const c = await contaDono()
  await admin.from('funcionamento').insert({
    conta_id: c.contaId, dia_semana: 0, abre: '08:00', fecha: '12:00',
  })

  await entrar(page, c.email)
  await page.goto('/config?s=funcionamento')

  await expect(page.getByLabel('Domingo abre')).toBeVisible()
  await page.getByRole('button', { name: 'Aberto' }).first().click()
  await page.getByRole('button', { name: 'Salvar funcionamento' }).click()

  await expect.poll(async () => {
    const { count } = await admin.from('funcionamento')
      .select('*', { count: 'exact', head: true })
      .eq('conta_id', c.contaId).eq('dia_semana', 0)
    return count
  }).toBe(0)
})

test('marcar feriado cancela os horários daquele dia, com motivo', async ({ page }) => {
  const c = await contaDono()

  // uma sessão já materializada no dia que vai virar feriado
  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, inicio: '2036-12-25T13:00:00Z', duracao_min: 60,
    capacidade: 4, status: 'prevista', motivo_cancelamento: null,
  }).select().single()

  await entrar(page, c.email)
  await page.goto('/config?s=funcionamento')

  await page.getByRole('button', { name: 'Nova data' }).click()
  await page.getByLabel('Data').fill('2036-12-25')
  await page.getByLabel('Nome').fill('Natal')
  await page.getByRole('button', { name: 'Marcar data' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('sessao')
      .select('status, motivo_cancelamento').eq('id', sessao!.id).single()
    return data
  }).toEqual({ status: 'cancelada', motivo_cancelamento: 'Dia marcado como feriado — Natal' })
})

test('"só marcar como fechado" não cancela nada', async ({ page }) => {
  const c = await contaDono()
  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, inicio: '2036-11-15T13:00:00Z', duracao_min: 60,
    capacidade: 4, status: 'prevista', motivo_cancelamento: null,
  }).select().single()

  await entrar(page, c.email)
  await page.goto('/config?s=funcionamento')

  await page.getByRole('button', { name: 'Nova data' }).click()
  await page.getByLabel('Data').fill('2036-11-15')
  await page.getByLabel('O que fazer com os horários do dia').selectOption('so_marcar')
  await page.getByRole('button', { name: 'Marcar data' }).click()

  await expect(page.getByText('2036-11-15')).toBeVisible()
  const { data } = await admin.from('sessao').select('status').eq('id', sessao!.id).single()
  expect(data!.status).toBe('prevista')
})

test('recepção não alcança a configuração', async ({ page }) => {
  const c = await contaDono()
  const recepcao = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec`)

  await entrar(page, recepcao.email)
  await page.goto('/config')
  await expect(page).toHaveURL(/\/hoje/)
})

test('mexer na configuração registra quem fez', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=locais')

  await page.getByRole('button', { name: 'Novo local' }).click()
  await page.getByLabel('Nome').fill('Domicílio')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('log_configuracao')
      .select('entidade, acao').eq('conta_id', c.contaId)
    return data?.map((l) => `${l.entidade}:${l.acao}`)
  }).toContain('local:criou')
})
