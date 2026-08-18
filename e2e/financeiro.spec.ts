import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * A jornada do caixa: a cobrança que nasce da matrícula, o pagamento em dois
 * cliques, o atraso no topo, e quem atende sem alcançar nada disso.
 *
 * O que este arquivo cobre e nenhum outro cobre: que matricular faz a cobrança
 * aparecer sozinha, que receber muda a situação e o fechamento do dia, que
 * estornar risca sem apagar, e que a tela abre no que precisa de decisão.
 *
 * A pergunta é sempre "abriu, e fez o que prometeu?".
 */

const HOJE = () => new Date().toLocaleDateString('en-CA')
const competencia = (iso: string) => `${iso.slice(0, 7)}-01`

async function cenario(nome: string) {
  const { contaId, marca } = await contaDeTeste(nome)
  const { email } = await usuarioDe(contaId, 'dono', marca)

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Marina ${marca}`, telefone: '11988887777' })
    .select('id').single<{ id: string }>()

  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Pilates aparelho' })
    .select('id').single<{ id: string }>()

  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servico!.id, codigo: '002',
    nome: 'Mensal, 2x por semana', recorrencia: 'mensal',
    frequencia_semanal: 1, preco_vinculado_cent: 73500, preco_avulso_cent: 73500,
  }).select('id').single<{ id: string }>()

  const { data: serie } = await admin.from('serie').insert({
    conta_id: contaId, servico_id: servico!.id, dia_semana: 1,
    hora_inicio: '07:00', duracao_min: 60, capacidade: 6,
    vigencia_inicio: '2026-01-01',
  }).select('id').single<{ id: string }>()

  return { contaId, marca, email, pessoaId: pessoa!.id, planoId: plano!.id,
           serieId: serie!.id }
}

/** Um contrato criado direto no banco, com a cobrança que a tela vai buscar. */
async function contratoCom(
  c: { contaId: string; pessoaId: string; planoId: string },
  cobranca: { vencimento: string; valorCent?: number },
) {
  const { data: contrato } = await admin.from('contrato').insert({
    conta_id: c.contaId, pessoa_id: c.pessoaId, plano_id: c.planoId,
    inicio: cobranca.vencimento, dia_vencimento: 5,
    preco_aplicado_cent: cobranca.valorCent ?? 73500,
    criado_em: `${cobranca.vencimento}T09:00:00Z`,
  }).select('id').single<{ id: string }>()

  const { data: linha } = await admin.from('cobranca').insert({
    conta_id: c.contaId, contrato_id: contrato!.id, pessoa_id: c.pessoaId,
    competencia: competencia(cobranca.vencimento),
    vencimento: cobranca.vencimento,
    valor_cent: cobranca.valorCent ?? 73500,
  }).select('id').single<{ id: string }>()

  return { contratoId: contrato!.id, cobrancaId: linha!.id }
}

test('matricular faz a primeira cobrança nascer sozinha', async ({ page }) => {
  const c = await cenario('Estúdio da primeira cobrança')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}?aba=contratos`)

  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByRole('button', { name: /Mensal, 2x por semana/ }).click()
  await page.getByRole('button', { name: /Segunda 07:00/ }).click()
  await page.getByRole('button', { name: 'Criar contrato' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  // a cobrança do mês aparece na mesma tela, sem ninguém digitar valor
  await expect(page.getByRole('heading', { name: 'Cobranças' })).toBeVisible()
  await expect.poll(async () => {
    const { data } = await admin.from('cobranca')
      .select('valor_cent').eq('pessoa_id', c.pessoaId)
    return data?.length ?? 0
  }).toBeGreaterThan(0)

  const { data } = await admin.from('cobranca')
    .select('valor_cent, competencia').eq('pessoa_id', c.pessoaId)
    .order('competencia')
  expect(data![0].valor_cent).toBe(73500)
  expect(data![0].competencia).toBe(competencia(HOJE()))
})

test('receber é dois cliques, e o que falta vem preenchido', async ({ page }) => {
  const c = await cenario('Estúdio do recebimento')
  await contratoCom(c, { vencimento: HOJE() })

  await entrar(page, c.email)
  await page.goto('/financeiro?aba=a_vencer')

  await expect(page.getByText('Em aberto').first()).toBeVisible()
  await page.getByRole('button', { name: 'Receber' }).first().click()

  // o valor já vem com o que falta, e a data com hoje: o segundo clique fecha
  await expect(page.getByLabel('Valor recebido')).toHaveValue('735,00')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.goto('/financeiro?aba=pagas')
  await expect(page.getByText('Pago', { exact: true })).toBeVisible()
  await expect(page.getByText(/R\$ 735,00 · Pix/)).toBeVisible()
})

test('o pagamento pela metade fica parcial, e as duas datas ficam', async ({ page }) => {
  const c = await cenario('Estúdio do pagamento partido')
  await contratoCom(c, { vencimento: HOJE() })

  await entrar(page, c.email)
  await page.goto('/financeiro?aba=a_vencer')

  await page.getByRole('button', { name: 'Receber' }).first().click()
  await page.getByLabel('Valor recebido').fill('300,00')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await expect(page.getByText('Pago em parte')).toBeVisible()
  await expect(page.getByText('faltam R$ 435,00')).toBeVisible()

  // e o segundo recebimento já vem preenchido com o que falta
  await page.getByRole('button', { name: 'Receber' }).first().click()
  await expect(page.getByLabel('Valor recebido')).toHaveValue('435,00')
})

test('a tela abre pelo que está em atraso, com os dias e o telefone', async ({ page }) => {
  const c = await cenario('Estúdio do atraso')
  const ontem = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10)
  await contratoCom(c, { vencimento: ontem })

  await entrar(page, c.email)
  await page.goto('/financeiro')

  /*
   * A primeira aba é a do que dói, e ela diz há quantos dias. São mais de uma
   * linha porque a abertura da tela materializa os meses entre o começo do
   * contrato e o mês que vem, e todos os vencidos entram aqui: é o
   * comportamento certo, e é por isso que o teste olha o primeiro.
   */
  await expect(page.getByText(/Em atraso · 40d/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ligar' }).first()).toBeVisible()
  await expect(page.getByText(/cobranças? em atraso/)).toBeVisible()
})

test('estornar risca o pagamento e devolve a cobrança para o aberto', async ({ page }) => {
  const c = await cenario('Estúdio do estorno')
  const { cobrancaId } = await contratoCom(c, { vencimento: HOJE() })
  await admin.from('pagamento').insert({
    conta_id: c.contaId, cobranca_id: cobrancaId, valor_cent: 73500,
    forma: 'dinheiro', recebido_em: HOJE(),
  })

  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')
  await page.getByRole('button', { name: 'estornar' }).click()
  await page.getByLabel('Motivo').fill('digitado em dobro')
  await page.getByRole('button', { name: 'Estornar', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.goto('/financeiro?aba=a_vencer')
  await expect(page.getByText('estornado: digitado em dobro')).toBeVisible()
  await expect(page.getByText('Em aberto').first()).toBeVisible()

  // a linha continua no banco: o fechamento de ontem não muda de valor sozinho
  const { data } = await admin.from('pagamento')
    .select('estornado_em').eq('cobranca_id', cobrancaId)
  expect(data).toHaveLength(1)
  expect(data![0].estornado_em).not.toBeNull()
})

test('cancelar pede motivo, e a cobrança continua listada com ele', async ({ page }) => {
  const c = await cenario('Estúdio do cancelamento')
  await contratoCom(c, { vencimento: HOJE() })

  await entrar(page, c.email)
  await page.goto('/financeiro?aba=a_vencer')
  // corrigir e cancelar moram no menu de três pontinhos: à vista ficam só
  // receber e ligar, que é o que se faz o tempo todo
  await page.getByRole('button', { name: /Mais sobre a cobrança/ }).first().click()
  await page.getByRole('menuitem', { name: 'Cancelar a cobrança' }).click()
  await page.getByLabel('Motivo').fill('cortesia combinada com a dona')
  await page.getByRole('button', { name: 'Cancelar cobrança' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.goto('/financeiro?aba=canceladas')
  await expect(page.getByText('Cancelada: cortesia combinada com a dona')).toBeVisible()
})

test('o fechamento soma o dia por forma de pagamento', async ({ page }) => {
  const c = await cenario('Estúdio do fechamento')
  const { cobrancaId } = await contratoCom(c, { vencimento: HOJE() })
  await admin.from('pagamento').insert([
    { conta_id: c.contaId, cobranca_id: cobrancaId, valor_cent: 50000,
      forma: 'pix', recebido_em: HOJE() },
    { conta_id: c.contaId, cobranca_id: cobrancaId, valor_cent: 23500,
      forma: 'dinheiro', recebido_em: HOJE() },
  ])

  await entrar(page, c.email)
  await page.goto('/financeiro?aba=fechamento')

  await expect(page.getByText('Entrou no período')).toBeVisible()
  await expect(page.getByText('R$ 735,00').first()).toBeVisible()
  await expect(page.getByText(/Pix: R\$ 500,00 · Dinheiro: R\$ 235,00/)).toBeVisible()
  await expect(page.getByText('Em vigor hoje')).toBeVisible()

  // os quatro números do topo são os do documento do cliente: faturado,
  // estornos, clientes ativos e novos no período
  await expect(page.getByText('Estornos no período')).toBeVisible()
  await expect(page.getByText('Clientes ativos')).toBeVisible()
  await expect(page.getByText('Novos no período')).toBeVisible()
  // e as quatro janelas que ele pede: dia, semana, mês e ano
  await expect(page.getByRole('link', { name: 'Este ano' })).toBeVisible()
})

test('quem atende não alcança o financeiro', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio sem dinheiro à vista')
  const { email } = await usuarioDe(contaId, 'profissional', marca)

  await entrar(page, email)
  await expect(page.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)

  await page.goto('/financeiro')
  await expect(page).toHaveURL(/\/hoje/)
})
