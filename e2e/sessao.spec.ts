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

test('cada linha diz por que a pessoa está ali, e o histórico conta como a turma ficou assim', async ({ page }) => {
  const c = await cenario()

  // a série que criou a turma, e a vaga fixa da Helena nela
  const { data: serie } = await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    dia_semana: 3, hora_inicio: '10:00', duracao_min: 60, capacidade: 4,
    vigencia_inicio: '2026-01-01',
  }).select().single()
  await admin.from('sessao').update({ serie_id: serie!.id }).eq('id', c.sessaoId)
  await admin.from('vaga').insert({
    conta_id: c.contaId, serie_id: serie!.id, pessoa_id: c.pessoas[0].id,
    inicio: '2026-03-02',
  })

  // a Beatriz entrou de encaixe, pela recepção
  await admin.from('participacao')
    .update({ origem: 'encaixe', registrado_por_origem: 'recepcao' })
    .eq('sessao_id', c.sessaoId).eq('pessoa_id', c.pessoas[2].id)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  await expect(
    page.getByRole('listitem').filter({ hasText: 'Helena Moraes' }),
  ).toContainText('vaga fixa desde março')

  const historico = page.getByRole('list').filter({ hasText: 'Turma criada' })
  await expect(historico).toContainText('Beatriz Nogueira entrou de encaixe pela recepção')
  await expect(historico).toContainText('Turma criada pela série quarta 10:00')
})

test('um toque marca todo mundo presente e a chamada fecha', async ({ page }) => {
  const c = await cenario()
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)

  // são dois: o do cabeçalho e o da barra que fica colada no rodapé
  await page.getByRole('button', { name: 'Marcar todos presentes' }).first().click()
  await expect(page.getByRole('button', { name: 'Marcar todos presentes' })).toHaveCount(0)

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

  await page.getByRole('button', { name: 'Marcar todos presentes' }).first().click()
  await expect(page.getByRole('button', { name: 'Marcar todos presentes' })).toHaveCount(0)

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
  await expect(page.getByText(/cancelada, Professora doente/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar todos presentes' })).toHaveCount(0)
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

test('observação restrita não chega à recepção, e ela não a sobrescreve', async ({ page, browser }) => {
  const c = await cenario()
  const recepcao = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec`)

  // quem atende escreve, e escolhe quem lê
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)
  await page.getByRole('button', { name: 'Mais ações' }).first().click()
  await page.getByRole('button', { name: 'Escrever observação' }).click()
  await page.getByRole('textbox').fill('lesão no ombro esquerdo')
  await page.getByRole('button', { name: 'Só quem atende' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('observacao, observacao_visivel')
      .eq('sessao_id', c.sessaoId).not('observacao', 'is', null).maybeSingle()
    return data
  }).toEqual({
    observacao: 'lesão no ombro esquerdo', observacao_visivel: 'profissionais',
  })

  // o profissional lê o que escreveu
  await page.reload()
  await expect(page.getByText('lesão no ombro esquerdo')).toBeVisible()

  // a recepção abre a mesma sessão e não encontra o texto em lugar nenhum
  const outra = await browser.newContext()
  const pagRec = await outra.newPage()
  await entrar(pagRec, recepcao.email)
  await pagRec.goto(`/sessao/${c.sessaoId}`)
  await expect(pagRec.getByText('Helena Moraes')).toBeVisible()
  await expect(pagRec.getByText('lesão no ombro esquerdo')).toHaveCount(0)

  // e o menu não oferece reescrever o que ela não pode ler
  await pagRec.getByRole('button', { name: 'Mais ações' }).first().click()
  await expect(pagRec.getByText('Observação de quem atende')).toBeVisible()
  await expect(pagRec.getByRole('button', { name: /observação/ })).toHaveCount(0)
  await outra.close()
})

test('observação para todos chega à recepção', async ({ page, browser }) => {
  const c = await cenario()
  const recepcao = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec2`)

  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)
  await page.getByRole('button', { name: 'Mais ações' }).first().click()
  await page.getByRole('button', { name: 'Escrever observação' }).click()
  await page.getByRole('textbox').fill('chegou 10 min atrasada, avisou antes')
  await page.getByRole('button', { name: 'Todo mundo da conta' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('observacao_visivel')
      .eq('sessao_id', c.sessaoId).not('observacao', 'is', null).maybeSingle()
    return data?.observacao_visivel
  }).toBe('todos')

  const outra = await browser.newContext()
  const pagRec = await outra.newPage()
  await entrar(pagRec, recepcao.email)
  await pagRec.goto(`/sessao/${c.sessaoId}`)
  await expect(pagRec.getByText('chegou 10 min atrasada, avisou antes')).toBeVisible()
  await outra.close()
})
