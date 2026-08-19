import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * O relatório do item 7: quantas aulas cada profissional aplicou.
 *
 * O que este arquivo cobre e nenhum outro cobre: que o total conta a aula que
 * já aconteceu e não a que está marcada para semana que vem, que o feriado
 * aparece explicado em vez de virar buraco, que quem cobriu a aula fica com
 * ela, e que a recepção não alcança nada disso.
 */

const HOJE = () => new Date().toLocaleDateString('en-CA')
const DIAS = (n: number) =>
  new Date(Date.parse(`${HOJE()}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

async function cenario(nome: string) {
  const base = await contaDeTeste(nome)
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)

  const { data: outro } = await admin.from('profissional')
    .insert({ conta_id: base.contaId, nome: `Cecília ${base.marca}` })
    .select('id').single<{ id: string }>()

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: base.contaId, nome: `Joana ${base.marca}` })
    .select('id').single<{ id: string }>()

  return { ...base, email, outroId: outro!.id, pessoaId: pessoa!.id }
}

async function sessao(c: {
  contaId: string; servicoId: string; pessoaId: string
}, dia: string, opcoes: {
  profissional: string | null
  hora?: string
  cancelada?: boolean
  motivo?: string
  presente?: boolean
  /** alguém marcado e ninguém decidiu: é isto que é chamada pendente */
  esperando?: boolean
}) {
  const { data } = await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId,
    profissional_id: opcoes.profissional,
    inicio: `${dia}T${opcoes.hora ?? '13'}:00:00Z`,
    duracao_min: 60, capacidade: 4,
    status: opcoes.cancelada ? 'cancelada' : 'prevista',
    motivo_cancelamento: opcoes.motivo ?? null,
  }).select('id').single<{ id: string }>()

  if (opcoes.presente !== undefined || opcoes.esperando) {
    await admin.from('participacao').insert({
      conta_id: c.contaId, sessao_id: data!.id, pessoa_id: c.pessoaId,
      origem: 'recorrente',
      status: opcoes.esperando ? 'esperada' : opcoes.presente ? 'presente' : 'falta',
    })
  }
  return data!.id
}

test('o relatório conta a aula que aconteceu, e explica o feriado', async ({ page }) => {
  const c = await cenario('Estúdio das aulas')

  await sessao(c, DIAS(-3), { profissional: c.profissionalId, presente: true })
  await sessao(c, DIAS(-2), { profissional: c.profissionalId, presente: true })
  // ninguém apareceu, e a aula continua sendo do profissional: ele foi e esperou
  await sessao(c, DIAS(-1), { profissional: c.profissionalId, presente: false })
  // feriado: não conta como aula e não conta como falta dele
  await sessao(c, DIAS(-4), {
    profissional: c.profissionalId, cancelada: true,
    motivo: 'Dia marcado como feriado',
  })
  // marcada para a semana que vem: não é aula aplicada
  await sessao(c, DIAS(4), { profissional: c.profissionalId })

  await entrar(page, c.email)
  await page.goto(`/aulas?de=${DIAS(-10)}&ate=${DIAS(10)}`)

  await expect(page.getByText(/3 aulas aplicadas, com 2 presenças/)).toBeVisible()
  await expect(page.getByText(/1 dia fechado no período/)).toBeVisible()
  await expect(page.getByText(/1 ainda por dar/)).toBeVisible()
  await expect(page.getByText(/feriado ou fechamento do estúdio/)).toBeVisible()

  // a linha do profissional, com o número grande e a ressalva ao lado
  const linha = page.getByRole('row').filter({ hasText: 'Marina' })
  await expect(linha).toContainText('3')
  await expect(linha).toContainText('(1 fechado)')
})

test('quem cobriu a aula aparece com ela', async ({ page }) => {
  const c = await cenario('Estúdio da cobertura')

  await sessao(c, DIAS(-2), { profissional: c.profissionalId, presente: true })
  const coberta = await sessao(c, DIAS(-1), {
    profissional: c.profissionalId, presente: true,
  })
  // a troca acontece na tela da sessão, e o relatório segue a sessão, não a série
  await admin.from('sessao').update({ profissional_id: c.outroId }).eq('id', coberta)

  await entrar(page, c.email)
  await page.goto(`/aulas?de=${DIAS(-10)}&ate=${DIAS(10)}`)

  await expect(page.getByRole('row').filter({ hasText: 'Marina' })).toContainText('1')
  await expect(page.getByRole('row').filter({ hasText: 'Cecília' })).toContainText('1')
})

test('a chamada não registrada aparece, e não é escondida do total', async ({ page }) => {
  const c = await cenario('Estúdio da chamada pendente')
  // gente marcada e ninguém decidiu: turma sem ninguém marcado é outra coisa,
  // e conta como aula sem ninguém, não como chamada por fazer
  await sessao(c, DIAS(-1), { profissional: c.profissionalId, esperando: true })

  await entrar(page, c.email)
  await page.goto(`/aulas?de=${DIAS(-10)}&ate=${DIAS(10)}`)

  await expect(page.getByText(/1 aula aplicada/)).toBeVisible()
  await expect(page.getByText(/1 sem chamada registrada/)).toBeVisible()
  await expect(page.getByText(/aconteceu e ninguém registrou quem veio/)).toBeVisible()
})

test('período vazio explica que não é falha de carregamento', async ({ page }) => {
  const c = await cenario('Estúdio vazio')
  await entrar(page, c.email)
  await page.goto(`/aulas?de=${DIAS(-10)}&ate=${DIAS(-5)}`)

  await expect(page.getByText('Nada para contar neste período')).toBeVisible()
  await expect(page.getByText(/confira se a grade cobre esses dias/)).toBeVisible()
})

test('a recepção não alcança o relatório', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio sem relatório')
  const { email } = await usuarioDe(contaId, 'recepcao', marca)

  await entrar(page, email)
  await expect(page.getByRole('link', { name: 'Aulas' })).toHaveCount(0)

  await page.goto('/aulas')
  await expect(page).toHaveURL(/\/hoje/)
})

test('a planilha sai com as mesmas contas da tela', async ({ page }) => {
  const c = await cenario('Estúdio da planilha de aulas')
  await sessao(c, DIAS(-1), { profissional: c.profissionalId, presente: true })

  await entrar(page, c.email)
  const r = await page.request.get(`/aulas/exportar?de=${DIAS(-10)}&ate=${DIAS(10)}`)
  expect(r.status()).toBe(200)

  const csv = await r.text()
  expect(csv).toContain('Aulas por profissional')
  expect(csv).toContain('Marina;1;1')
})
