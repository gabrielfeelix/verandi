import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

async function cenario(capacidade = 4) {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'profissional', base.marca)

  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: base.contaId,
    servico_id: base.servicoId,
    profissional_id: base.profissionalId,
    local_id: base.localId,
    inicio: '2026-08-12T13:00:00Z',
    duracao_min: 60,
    capacidade,
  }).select().single()

  const pessoas = await criarPessoas(base.contaId,
    ['Helena Moraes', 'Otávio Prado', 'Beatriz Nogueira'])

  await admin.from('participacao').insert(
    pessoas.map((p) => ({
      conta_id: base.contaId, sessao_id: sessao!.id, pessoa_id: p.id,
      origem: 'recorrente' as const, status: 'esperada' as const,
    })),
  )

  return { ...base, email, sessaoId: sessao!.id as string, pessoas }
}

test('mostra ocupação, origem e quem está sem telefone', async ({ page }) => {
  const c = await cenario()
  await admin.from('pessoa_tag')
    .insert({ pessoa_id: c.pessoas[0].id, conta_id: c.contaId, tag: 'gestante' })

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await expect(page.getByText('3/4', { exact: true })).toBeVisible()
  await expect(page.getByText('Chamada pendente').first()).toBeVisible()
  await expect(page.getByText('gestante')).toBeVisible()
  // nenhuma das três tem telefone no cenário
  await expect(page.getByText('sem telefone').first()).toBeVisible()
  await expect(page.getByText('Fixo').first()).toBeVisible()
})

test('um toque marca todo mundo presente e a chamada fecha', async ({ page }) => {
  const c = await cenario()
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await page.getByRole('button', { name: /Marcar todos presentes \(3\)/ }).click()
  await expect(page.getByRole('button', { name: /Marcar todos presentes/ })).toBeHidden()

  // a UI é otimista: o botão some antes de a escrita chegar ao banco.
  // conferir o banco sem poll testaria a animação, não o registro.
  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('status').eq('sessao_id', c.sessaoId)
    return data!.filter((p) => p.status === 'presente').length
  }).toBe(3)
})

test('marcar a exceção primeiro e depois "todos vieram" preserva a falta', async ({ page }) => {
  const c = await cenario()
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  const linhaBeatriz = page.getByRole('listitem').filter({ hasText: 'Beatriz Nogueira' })
  await linhaBeatriz.getByRole('button', { name: 'Faltou' }).click()
  await expect(page.getByRole('status')).toContainText('Beatriz Nogueira')

  await page.getByRole('button', { name: /Marcar todos presentes \(2\)/ }).click()
  await expect(page.getByRole('button', { name: /Marcar todos presentes/ })).toBeHidden()

  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('pessoa_id, status').eq('sessao_id', c.sessaoId)
    return data!.filter((p) => p.status === 'presente').length
  }).toBe(2)

  const { data } = await admin.from('participacao')
    .select('pessoa_id, status').eq('sessao_id', c.sessaoId)
  const beatriz = data!.find((p) => p.pessoa_id === c.pessoas[2].id)
  expect(beatriz!.status).toBe('falta')
})

test('desfazer devolve o status anterior', async ({ page }) => {
  const c = await cenario()
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  const linha = page.getByRole('listitem').filter({ hasText: 'Helena Moraes' })
  await linha.getByRole('button', { name: 'Veio' }).click()
  await page.getByRole('button', { name: 'Desfazer' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('status').eq('pessoa_id', c.pessoas[0].id).single()
    return data!.status
  }).toBe('esperada')
})

test('sessão cancelada mostra o motivo e não deixa registrar', async ({ page }) => {
  const c = await cenario()
  await admin.from('sessao')
    .update({ status: 'cancelada', motivo_cancelamento: 'Professora doente' })
    .eq('id', c.sessaoId)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  // a frase agora nomeia a entidade da conta: "Aula cancelada", "Sessão cancelada"
  await expect(page.getByText(/cancelada — Professora doente/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Marcar todos presentes/ })).toBeHidden()
})

test('a tela usa o rótulo da conta, não a palavra do código', async ({ page }) => {
  const c = await cenario()
  await admin.from('vocabulario').insert([
    { conta_id: c.contaId, chave: 'pessoa', singular: 'Aluno', plural: 'Alunos' },
    { conta_id: c.contaId, chave: 'sessao', singular: 'Aula', plural: 'Aulas' },
  ])

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  // o h1 agora é o nome do serviço, como no protótipo; o vocabulário da conta
  // aparece no título da lista e na trilha
  await expect(
    page.getByRole('heading', { name: 'Alunos nesta aula' }),
  ).toBeVisible()
  await expect(page.getByRole('list', { name: 'Alunos' })).toBeVisible()
})
