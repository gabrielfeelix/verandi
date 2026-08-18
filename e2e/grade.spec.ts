import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe, escolher } from './apoio'

/** Uma conta com catálogo pronto e grade vazia, o começo de todo cliente. */
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
    await page.getByRole('button', { name: dia, exact: true }).click()
  }
  await page.getByLabel('Começa às').fill('07:00')
  await page.getByLabel('Capacidade').fill('4')
  await escolher(page, 'Serviço', 'Pilates solo')
  await escolher(page, 'Profissional', 'Marina')
  await page.getByRole('button', { name: 'Criar 3 horários' }).click()

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
  await page.getByRole('button', { name: 'seg', exact: true }).click()
  await page.getByLabel('Começa às').fill('07:30')
  await escolher(page, 'Serviço', 'Pilates solo')
  await escolher(page, 'Profissional', 'Marina')
  await page.getByRole('button', { name: 'Criar horário', exact: true }).click()

  await expect(page.getByText('Já existe algo marcado neste horário')).toBeVisible()
  await expect(page.getByText(/Marina já atende/)).toBeVisible()

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
  /*
   * Dois e três dias atrás, não um e dois.
   *
   * `toISOString()` dá a data em UTC; a conta vive em America/Sao_Paulo. Entre
   * 21h e meia-noite as duas discordam, e "ontem em UTC" é hoje na conta, a
   * série encerrada voltava a ser vigente e o teste falhava só à noite.
   */
  const ontem = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)
  const anteontem = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)

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

  // o resumo do dia também diz "2/4 ocupadas"; a etiqueta da linha é a exata
  await expect(page.getByText('2/4', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /que terminaram/i })).toBeVisible()

  // a vigência é lida como época, não como dia: "mar/26 – ago/26"
  const mes = (d: string) =>
    ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
     'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(d.slice(5, 7)) - 1]
      + '/' + d.slice(2, 4)
  await expect(
    page.getByText(`${mes(anteontem)} – ${mes(ontem)}`),
  ).toBeVisible()
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

/**
 * A parte perigosa: editar a grade é a única operação que mexe em dado já
 * materializado. O que sai da grade tem que ficar cancelado, não sumir.
 */
async function contaComSerieEsessoes() {
  const c = await contaSemGrade()

  const { data: serie } = await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, dia_semana: 4, hora_inicio: '10:00', duracao_min: 60,
    capacidade: 4, vigencia_inicio: '2026-01-01', ativo: true,
  }).select().single()

  // 20/ago/2026 é quinta; a semana seguinte é 27/ago
  const { data: sessoes } = await admin.from('sessao').insert([
    { conta_id: c.contaId, serie_id: serie!.id, servico_id: c.servicoId,
      profissional_id: c.profissionalId, local_id: c.localId,
      inicio: '2036-08-21T13:00:00Z', duracao_min: 60, capacidade: 4,
      status: 'prevista', motivo_cancelamento: null },
    { conta_id: c.contaId, serie_id: serie!.id, servico_id: c.servicoId,
      profissional_id: c.profissionalId, local_id: c.localId,
      inicio: '2036-08-28T13:00:00Z', duracao_min: 60, capacidade: 4,
      status: 'prevista', motivo_cancelamento: null },
  ]).select('id, inicio')

  return { ...c, serieId: serie!.id as string, sessoes: sessoes! }
}

test('editar mostra o que muda antes de salvar, e o passado não entra na conta', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Capacidade').fill('6')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(page.getByText('A mudança vale daqui para frente')).toBeVisible()
  await expect(page.getByText(/\d+ mudam/)).toBeVisible()

  await page.getByRole('button', { name: 'Confirmar' }).click()

  // as duas sessões futuras conhecidas mudam de capacidade; entrar como dono
  // cai em /semana, que materializa a semana corrente, então a contagem total
  // de sessões da série não é fixa, o que se afirma são estas duas
  await expect.poll(async () => {
    const { data } = await admin.from('sessao')
      .select('capacidade').in('id', c.sessoes.map((s) => s.id)).order('inicio')
    return data?.map((s) => s.capacidade)
  }).toEqual([6, 6])
})

test('mudar o dia cancela as sessões do dia antigo em vez de deixá-las órfãs', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Editar' }).click()
  // por papel, e não por `escolher`: o campo é obrigatório, e o asterisco do
  // rótulo derruba o `exact` do helper
  await page.getByRole('combobox', { name: 'Dia da semana' }).click()
  await page.getByRole('option', { name: 'Sexta' }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(page.getByText(/saem da grade e ficam cancelados/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('sessao')
      .select('status').in('id', c.sessoes.map((s) => s.id))
    return data?.map((s) => s.status)
  }).toEqual(['cancelada', 'cancelada'])

  // riscada com motivo, não sumida
  const { data } = await admin.from('sessao')
    .select('motivo_cancelamento').eq('id', c.sessoes[0].id).single()
  expect(data!.motivo_cancelamento).toBe('Horário mudou na grade')
})

test('sessão já realizada não é tocada pela edição', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  await admin.from('sessao').update({ status: 'realizada' }).eq('id', c.sessoes[0].id)

  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Capacidade').fill('9')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(page.getByText(/ficam como estão/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('sessao')
      .select('capacidade').eq('id', c.sessoes[0].id).single()
    return data?.capacidade
  }).toBe(4)
})

test('baixar a capacidade abaixo da ocupação avisa quantos ocupam', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  const pessoas = await criarPessoas(c.contaId, ['Helena Moraes', 'Otávio Prado'])
  await admin.from('vaga').insert(pessoas.map((p) => ({
    conta_id: c.contaId, serie_id: c.serieId, pessoa_id: p.id,
    inicio: '2026-01-01', fim: null,
  })))

  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Capacidade').fill('1')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(page.getByText(/2 .*ocupam este horário, e a capacidade nova é menor/))
    .toBeVisible()
})

test('duplicar repete o horário em outros dias', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Duplicar' }).click()
  const dup = page.getByRole('dialog')
  await dup.getByRole('button', { name: 'ter', exact: true }).click()
  await dup.getByRole('button', { name: 'sáb', exact: true }).click()
  await dup.getByRole('button', { name: 'Duplicar', exact: true }).click()

  await expect.poll(async () => {
    const { count } = await admin.from('serie')
      .select('*', { count: 'exact', head: true }).eq('conta_id', c.contaId)
    return count
  }).toBe(3)
})

test('encerrar pergunta quantos ocupam, e não apaga o passado', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  const pessoas = await criarPessoas(c.contaId, ['Helena Moraes'])
  await admin.from('vaga').insert({
    conta_id: c.contaId, serie_id: c.serieId, pessoa_id: pessoas[0].id,
    inicio: '2026-01-01', fim: null,
  })

  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  await page.getByRole('dialog')
    .getByRole('button', { name: 'Encerrar', exact: true }).click()

  await expect(page.getByText(/1 .*ocupa este horário/)).toBeVisible()
  await page.getByRole('button', { name: 'Encerrar mesmo assim' }).click()

  // a série ganhou fim, as sessões futuras saíram da grade, e nada foi apagado
  await expect.poll(async () => {
    const { data } = await admin.from('serie')
      .select('vigencia_fim').eq('id', c.serieId).single()
    return data?.vigencia_fim
  }).not.toBeNull()

  await expect.poll(async () => {
    const { data } = await admin.from('sessao')
      .select('status').in('id', c.sessoes.map((s) => s.id))
    return data?.map((s) => s.status)
  }).toEqual(['cancelada', 'cancelada'])
})

test('mexer na grade registra quem fez', async ({ page }) => {
  const c = await contaComSerieEsessoes()
  await entrar(page, c.email)
  await page.goto('/grade')

  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Capacidade').fill('5')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('log_configuracao')
      .select('acao, por_usuario_id').eq('conta_id', c.contaId).eq('entidade', 'serie')
    return data?.map((l) => l.acao)
  }).toContain('editou')

  const { data } = await admin.from('log_configuracao')
    .select('por_usuario_id').eq('conta_id', c.contaId).limit(1).single()
  expect(data!.por_usuario_id).not.toBeNull()
})
