import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * Duas coisas que só o navegador responde: que a tela inicial obedece ao
 * arranjo de quem a arrumou, e que dá para abrir os próximos meses de um
 * contrato para receber adiantado.
 *
 * A regra das duas está testada em `tests/unit` e em `tests/home.test.ts`. O
 * que falta aqui é a pergunta de sempre: abriu, e fez o que prometeu?
 */

const HOJE = () => new Date().toLocaleDateString('en-CA')

async function cenario(nome: string) {
  const { contaId, marca, servicoId } = await contaDeTeste(nome)
  const { email } = await usuarioDe(contaId, 'dono', marca)

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Amanda ${marca}` })
    .select('id').single<{ id: string }>()

  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servicoId, codigo: '002',
    nome: 'Mensal, 2x por semana', recorrencia: 'mensal',
    frequencia_semanal: 1, preco_vinculado_cent: 70000, preco_avulso_cent: 70000,
  }).select('id').single<{ id: string }>()

  const { data: contrato } = await admin.from('contrato').insert({
    conta_id: contaId, pessoa_id: pessoa!.id, plano_id: plano!.id,
    inicio: HOJE(), dia_vencimento: 10, preco_aplicado_cent: 70000,
    criado_em: `${HOJE()}T09:00:00Z`,
  }).select('id').single<{ id: string }>()

  return { contaId, email, pessoaId: pessoa!.id, contratoId: contrato!.id }
}

test('receber adiantado abre os próximos meses do contrato', async ({ page }) => {
  const c = await cenario('Estúdio do adiantado')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)

  // o sistema abre até o mês que vem, e é isso que mantém "a vencer" legível:
  // quem quer pagar até dezembro pede, e as cobranças nascem na hora
  await page.getByRole('button', { name: 'Receber adiantado' }).click()
  await page.getByLabel('Quantos meses abrir').fill('4')
  await page.getByRole('button', { name: 'Abrir os meses' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await expect.poll(async () => {
    const { count } = await admin.from('cobranca')
      .select('*', { count: 'exact', head: true }).eq('contrato_id', c.contratoId)
    return count ?? 0
  }).toBe(5)

  /*
   * Cada uma com o dia de vencimento do contrato, e não com a data de hoje.
   *
   * A primeira fica de fora da conferência de propósito: ela não vence antes de
   * o contrato começar, então um contrato que nasce no dia 19 com vencimento no
   * dia 10 tem a primeira parcela no dia 19 e as seguintes no dia 10.
   */
  const { data } = await admin.from('cobranca')
    .select('vencimento').eq('contrato_id', c.contratoId).order('competencia')
    .returns<Array<{ vencimento: string }>>()
  expect(data!.slice(1).every((l) => l.vencimento.endsWith('-10'))).toBe(true)
})

test('arrumar a tela inicial muda a ordem, e só para quem arrumou', async ({ page }) => {
  const c = await cenario('Estúdio da home')
  await entrar(page, c.email)
  await page.goto('/hoje')

  await page.getByRole('button', { name: 'Arrumar a tela inicial' }).click()
  const painel = page.getByRole('dialog')
  await expect(painel.getByRole('heading', { name: 'Coluna larga' })).toBeVisible()

  // o caixa nasce embaixo dos números do dia, e sobe um lugar
  await painel.getByRole('button', { name: 'Subir Caixa' }).click()
  // e a nota de lotação sai de vez
  await painel.getByRole('checkbox', { name: /Nota sobre lotação/ }).uncheck()
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Lotação cheia não é bloqueio')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ver o fechamento' })).toBeVisible()

  // o arranjo é da pessoa: o que foi gravado tem o caixa na frente
  const { data } = await admin.from('preferencia_home')
    .select('blocos').eq('conta_id', c.contaId).single<{ blocos: Array<{ id: string; visivel: boolean }> }>()
  expect(data!.blocos[0].id).toBe('caixa')
  expect(data!.blocos.find((b) => b.id === 'dica')!.visivel).toBe(false)
})

test('voltar ao padrão apaga a preferência, e não grava uma foto do padrão', async ({ page }) => {
  const c = await cenario('Estúdio do padrão')
  await entrar(page, c.email)
  await page.goto('/hoje')

  await page.getByRole('button', { name: 'Arrumar a tela inicial' }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: /Nota sobre lotação/ }).uncheck()
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Arrumar a tela inicial' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Voltar ao padrão' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  /*
   * A linha some, e não vira o padrão gravado: quem restaurou hoje ganha o
   * bloco que a tela receber amanhã, em vez de ficar com a foto de hoje.
   */
  await expect.poll(async () => {
    const { count } = await admin.from('preferencia_home')
      .select('*', { count: 'exact', head: true }).eq('conta_id', c.contaId)
    return count ?? 0
  }).toBe(0)
  await expect(page.getByText('Lotação cheia não é bloqueio')).toBeVisible()
})

test('o financeiro diz quanto, e não só quantas', async ({ page }) => {
  const c = await cenario('Estúdio dos números')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=todas')

  /*
   * A tela dizia "10 cobranças em atraso" e não dizia quanto. Dez linhas de
   * R$ 90 e dez de R$ 700 são a mesma frase e duas manhãs diferentes.
   */
  await expect(page.getByText('Cobrado', { exact: true })).toBeVisible()
  await expect(page.getByText('Ticket médio')).toBeVisible()
  await expect(page.getByText('R$ 700,00').first()).toBeVisible()
})

test('o arquivo de recibos se recorta por data', async ({ page }) => {
  const c = await cenario('Estúdio do arquivo')
  await entrar(page, c.email)

  // um dia em que nada foi emitido: a pergunta "e os do dia 19 de janeiro?"
  await page.goto('/recibos?de=2026-01-19&ate=2026-01-19')
  await expect(page.getByText('Nenhum recibo em 19/01/26.')).toBeVisible()

  // e a barra de período diz o recorte em vez de deixar a tela mentir vazia
  await expect(page.getByText('em 19/01/26').first()).toBeVisible()
  await page.getByRole('link', { name: 'limpar' }).click()
  await expect(page.getByText('sem recorte de data')).toBeVisible()
})

test('a ficha responde se a pessoa está em dia', async ({ page }) => {
  const c = await cenario('Estúdio da ficha')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)

  // a aba listava cobranças e não respondia nenhuma pergunta sobre a pessoa
  await expect(page.getByText('Já pagou')).toBeVisible()
  await expect(page.getByText('Em atraso', { exact: true })).toBeVisible()
  await expect(page.getByText('Último pagamento')).toBeVisible()
})
