import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * A jornada da matrícula: escolher plano, ocupar turma, e o que se faz depois.
 *
 * O que este arquivo cobre e nenhum outro cobre: que o contrato produz vaga de
 * verdade, que a horário cheio é recusado antes de gravar qualquer coisa, que o
 * preço aplicado é o do vínculo quando ele existe, e que trancar devolve o
 * lugar para a turma.
 */

async function cenario(nome: string, opcoes?: { capacidade?: number }) {
  const { contaId, marca } = await contaDeTeste(nome)
  const { email } = await usuarioDe(contaId, 'dono', marca)

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Marina ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()

  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Pilates aparelho' })
    .select('id').single<{ id: string }>()

  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servico!.id, codigo: '002',
    nome: 'Mensal, 2x por semana', recorrencia: 'mensal',
    frequencia_semanal: 2, preco_vinculado_cent: 73500, preco_avulso_cent: 73500,
  }).select('id').single<{ id: string }>()

  const turmas = []
  for (const [dia, hora] of [[1, '07:00'], [3, '09:00']] as const) {
    const { data: s } = await admin.from('serie').insert({
      conta_id: contaId, servico_id: servico!.id, dia_semana: dia,
      hora_inicio: hora, duracao_min: 60,
      capacidade: opcoes?.capacidade ?? 6, vigencia_inicio: '2026-01-01',
    }).select('id').single<{ id: string }>()
    turmas.push(s!.id)
  }

  return { contaId, marca, email, pessoaId: pessoa!.id, servicoId: servico!.id,
           planoId: plano!.id, turmas }
}

test('contratar ocupa os horários escolhidos, e o contrato aparece na ficha', async ({ page }) => {
  const c = await cenario('Estúdio da matrícula')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)

  await expect(page.getByText('Nenhum contrato ainda')).toBeVisible()

  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByRole('button', { name: /Mensal, 2x por semana/ }).click()

  // a tela conta quantos o plano pede, para não descobrir no envio
  await expect(page.getByText('o plano pede 2, e 0 foram escolhidos')).toBeVisible()

  await page.getByRole('button', { name: /Segunda 07:00/ }).click()
  await page.getByRole('button', { name: /Quarta 09:00/ }).click()
  await expect(page.getByText('o plano pede 2, e 2 foram escolhidos')).toBeVisible()

  await page.getByRole('button', { name: 'Criar contrato' }).click()

  // o modal fecha primeiro: enquanto ele está aberto, o preço aparece duas
  // vezes na tela, uma no cartão do plano e outra na linha do contrato
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.getByText('Em vigor', { exact: true })).toBeVisible()
  // o preço aparece três vezes desde o módulo 17: na linha do contrato e nas
  // cobranças que ele acabou de gerar, logo abaixo, na mesma aba
  await expect(page.getByText('R$ 735,00').first()).toBeVisible()

  // o contrato produz vaga: é o que a chamada e a reposição leem
  await expect.poll(async () => {
    const { data } = await admin.from('vaga')
      .select('serie_id, contrato_id').eq('pessoa_id', c.pessoaId)
    return data?.length ?? 0
  }).toBe(2)

  const { data: vagas } = await admin.from('vaga')
    .select('contrato_id').eq('pessoa_id', c.pessoaId)
  expect(vagas!.every((v) => v.contrato_id !== null)).toBe(true)
})

test('horário cheio é recusado, e nada é gravado pela metade', async ({ page }) => {
  const c = await cenario('Estúdio da turma cheia', { capacidade: 1 })

  // enche o segundo horário com outra pessoa
  const { data: outra } = await admin.from('pessoa')
    .insert({ conta_id: c.contaId, nome: `Bruna ${c.marca}` })
    .select('id').single<{ id: string }>()
  await admin.from('vaga').insert({
    conta_id: c.contaId, serie_id: c.turmas[1], pessoa_id: outra!.id,
    inicio: '2026-01-01',
  })

  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)
  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByRole('button', { name: /Mensal, 2x por semana/ }).click()
  await page.getByRole('button', { name: /Segunda 07:00/ }).click()
  await page.getByRole('button', { name: /Quarta 09:00/ }).click()
  await page.getByRole('button', { name: 'Criar contrato' }).click()

  await expect(page.getByText(/O horário de Quarta às 09:00 está cheio/)).toBeVisible()

  // o primeiro horário não pode ter recebido a pessoa: ela sairia daqui achando
  // que resolveu, e a chamada de segunda apareceria com ela
  const { count: vagas } = await admin.from('vaga')
    .select('*', { count: 'exact', head: true }).eq('pessoa_id', c.pessoaId)
  expect(vagas).toBe(0)
  const { count: contratos } = await admin.from('contrato')
    .select('*', { count: 'exact', head: true }).eq('pessoa_id', c.pessoaId)
  expect(contratos).toBe(0)
})

test('quem já é cliente de outra modalidade paga o preço de vínculo', async ({ page }) => {
  const c = await cenario('Estúdio do vínculo')

  // já tem contrato de pilates em vigor
  await admin.from('contrato').insert({
    conta_id: c.contaId, pessoa_id: c.pessoaId, plano_id: c.planoId,
    inicio: '2026-01-01', preco_aplicado_cent: 73500,
  })

  // e agora contrata fisioterapia, que tem dois preços
  const { data: fisio } = await admin.from('servico')
    .insert({ conta_id: c.contaId, nome: 'Fisioterapia' })
    .select('id').single<{ id: string }>()
  await admin.from('plano').insert({
    conta_id: c.contaId, servico_id: fisio!.id, codigo: '100',
    nome: 'Fisioterapia, sessão', recorrencia: 'avulsa',
    preco_vinculado_cent: 19500, preco_avulso_cent: 23000,
  })

  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)
  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByRole('button', { name: /Fisioterapia, sessão/ }).click()
  await page.getByRole('button', { name: 'Criar contrato' }).click()

  await expect(page.getByText('R$ 195,00')).toBeVisible()
  // e a ficha diz por que foi esse preço, sem obrigar a abrir a tabela
  await expect(page.getByText('Preço de quem já é cliente de outra modalidade'))
    .toBeVisible()
})

test('trancar devolve o lugar para o horário, e retomar traz de volta', async ({ page }) => {
  const c = await cenario('Estúdio da licença')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)

  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByRole('button', { name: /Mensal, 2x por semana/ }).click()
  await page.getByRole('button', { name: /Segunda 07:00/ }).click()
  await page.getByRole('button', { name: /Quarta 09:00/ }).click()
  await page.getByRole('button', { name: 'Criar contrato' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.getByText('Em vigor', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Trancar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Trancar' }).click()

  await expect(page.getByText('Trancado')).toBeVisible()

  // o lugar volta para o horário: quem está na fila pode ocupá-lo enquanto isso
  await expect.poll(async () => {
    const { data } = await admin.from('vaga')
      .select('fim').eq('pessoa_id', c.pessoaId)
    return data?.filter((v) => v.fim === null).length ?? 0
  }).toBe(0)

  await page.getByRole('button', { name: 'Retomar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Retomar' }).click()

  await expect(page.getByText('Em vigor', { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const { data } = await admin.from('vaga')
      .select('fim').eq('pessoa_id', c.pessoaId)
    return data?.filter((v) => v.fim === null).length ?? 0
  }).toBe(2)
})

test('a mesma pessoa não entra duas vezes no mesmo horário', async ({ page }) => {
  const c = await cenario('Estúdio do em dobro')

  await admin.from('vaga').insert({
    conta_id: c.contaId, serie_id: c.turmas[0], pessoa_id: c.pessoaId,
    inicio: '2026-01-01',
  })

  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)
  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByRole('button', { name: /Mensal, 2x por semana/ }).click()
  await page.getByRole('button', { name: /Segunda 07:00/ }).click()
  await page.getByRole('button', { name: /Quarta 09:00/ }).click()
  await page.getByRole('button', { name: 'Criar contrato' }).click()

  await expect(page.getByText(/já ocupa o horário de Segunda às 07:00/)).toBeVisible()
})

test('o CPF errado não entra na ficha, e o certo entra', async ({ page }) => {
  const c = await cenario('Estúdio do documento')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}`)

  await page.getByRole('button', { name: 'Editar dados' }).click()
  await page.getByText('Documento e endereço').click()
  await page.getByLabel('CPF').fill('390.533.447-06')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText(/Esse CPF não confere/)).toBeVisible()

  await page.getByLabel('CPF').fill('390.533.447-05')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('pessoa')
      .select('cpf').eq('id', c.pessoaId).single()
    return data?.cpf
  }).toBe('39053344705')
})

test('quem atende não vê a aba de contratos', async ({ page }) => {
  const c = await cenario('Estúdio sem profissional na matrícula')
  const { email } = await usuarioDe(c.contaId, 'profissional', c.marca)

  await entrar(page, email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)

  await expect(page.getByRole('button', { name: 'Novo contrato' })).toHaveCount(0)
})
