import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * A jornada do papel: emitir, imprimir, corrigir, cancelar, e o número que não
 * se repete nem pula.
 *
 * O que este arquivo cobre e nenhum outro cobre: que a emissão nasce da linha
 * do pagamento, que o emitente vazio barra antes de gastar número, que a
 * correção mantém o número e guarda a versão anterior, e que estornar o
 * pagamento derruba o recibo junto.
 */

const HOJE = () => new Date().toLocaleDateString('en-CA')

async function cenario(nome: string, opcoes?: { semEmitente?: boolean }) {
  const { contaId, marca } = await contaDeTeste(nome)
  const { email } = await usuarioDe(contaId, 'dono', marca)

  if (!opcoes?.semEmitente) {
    await admin.from('conta').update({
      razao_social: 'MGM Pilates Ltda', documento: '12345678000190',
      endereco_emitente: 'Rua das Acácias, 204', telefone_emitente: '1133334444',
    }).eq('id', contaId)
  }

  const { data: pessoa } = await admin.from('pessoa').insert({
    conta_id: contaId, nome: `Marina ${marca}`, cpf: `${Date.now()}`.slice(0, 11),
    identificador_externo: '042',
  }).select('id').single<{ id: string }>()

  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Pilates aparelho' })
    .select('id').single<{ id: string }>()

  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servico!.id, codigo: '002',
    nome: 'Mensal, 2x por semana', recorrencia: 'mensal',
    preco_vinculado_cent: 73500, preco_avulso_cent: 73500,
  }).select('id').single<{ id: string }>()

  const { data: contrato } = await admin.from('contrato').insert({
    conta_id: contaId, pessoa_id: pessoa!.id, plano_id: plano!.id,
    inicio: HOJE(), dia_vencimento: 5, preco_aplicado_cent: 73500,
    criado_em: `${HOJE()}T09:00:00Z`,
  }).select('id').single<{ id: string }>()

  const { data: cobranca } = await admin.from('cobranca').insert({
    conta_id: contaId, contrato_id: contrato!.id, pessoa_id: pessoa!.id,
    competencia: `${HOJE().slice(0, 7)}-01`, vencimento: HOJE(),
    valor_cent: 73500,
  }).select('id').single<{ id: string }>()

  const { data: pagamento } = await admin.from('pagamento').insert({
    conta_id: contaId, cobranca_id: cobranca!.id, valor_cent: 73500,
    forma: 'pix', recebido_em: HOJE(),
  }).select('id').single<{ id: string }>()

  return { contaId, marca, email, pessoaId: pessoa!.id, pagamentoId: pagamento!.id }
}

test('emitir nasce da linha do pagamento, e a folha sai com o valor por extenso', async ({ page }) => {
  const c = await cenario('Estúdio do recibo')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')

  await page.getByRole('button', { name: 'emitir recibo' }).click()
  // o número aparece na própria linha, e vira link para a folha
  await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()

  await page.getByRole('link', { name: /A-000001/ }).click()
  await expect(page).toHaveURL(/\/recibos\//)

  // as duas vias, com o extenso e a matrícula que o documento do cliente pede
  await expect(page.getByText(/setecentos e trinta e cinco reais/).first()).toBeVisible()
  await expect(page.getByText(/matrícula nº 042/).first()).toBeVisible()
  await expect(page.getByText('corte aqui')).toBeVisible()
  await expect(
    page.getByText('Este documento é um recibo, e não uma nota fiscal.').first(),
  ).toBeVisible()
})

test('sem os dados de quem emite, a emissão para antes de gastar número', async ({ page }) => {
  const c = await cenario('Estúdio sem emitente', { semEmitente: true })
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')

  await page.getByRole('button', { name: 'emitir recibo' }).click()
  await expect(page.getByText(/Preencha quem emite o recibo em Configuração/))
    .toBeVisible()

  // e nenhum número foi consumido: a sequência não pode ter buraco por tentativa
  const { count } = await admin.from('contador_recibo')
    .select('conta_id', { count: 'exact', head: true }).eq('conta_id', c.contaId)
  expect(count).toBe(0)
})

test('o mesmo pagamento não vira dois recibos', async ({ page }) => {
  const c = await cenario('Estúdio do recibo repetido')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')

  await page.getByRole('button', { name: 'emitir recibo' }).click()
  await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()

  // a segunda tentativa vira segunda via, e não número novo
  await page.goto('/recibos')
  await expect(page.getByText('1 recibo emitido, na série A')).toBeVisible()
})

test('corrigir mantém o número e guarda a versão anterior', async ({ page }) => {
  const c = await cenario('Estúdio da correção')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')
  await page.getByRole('button', { name: 'emitir recibo' }).click()
  await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()

  await page.goto('/recibos')
  // corrigir e cancelar moram no menu da linha, como no Financeiro: soltos ao
  // lado do valor, eles faziam a linha do cancelado ter largura diferente da
  // linha do válido, e a lista perdia as colunas
  await page.getByRole('button', { name: /Mais sobre o recibo/ }).click()
  await page.getByRole('menuitem', { name: 'Corrigir o texto' }).click()
  await page.getByLabel('Nome de quem pagou').fill('Marina Ferraz Silva')
  await page.getByLabel('O que estava errado').fill('nome incompleto')
  await page.getByRole('dialog').getByRole('button', { name: 'Corrigir' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await expect(page.getByText('A-000001 (correção 2)')).toBeVisible()
  await expect(page.getByText('Substituído')).toBeVisible()
  await expect(page.getByText('Correção: nome incompleto')).toBeVisible()
})

test('cancelar pede motivo, e o número continua ocupado', async ({ page }) => {
  const c = await cenario('Estúdio do cancelamento de recibo')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')
  await page.getByRole('button', { name: 'emitir recibo' }).click()
  await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()

  await page.goto('/recibos')
  await page.getByRole('button', { name: /Mais sobre o recibo/ }).click()
  await page.getByRole('menuitem', { name: 'Cancelar o recibo' }).click()
  await page.getByLabel('Motivo').fill('valor errado')
  // o botão que fecha se chama "Voltar": dois "Cancelar" lado a lado, um para
  // desistir e outro para executar, é a hora errada de a palavra ter dois sentidos
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await expect(page.getByText('Cancelado: valor errado')).toBeVisible()

  // o próximo recibo é o 2, e não o 1: buraco na sequência é o que não pode
  const { data } = await admin.from('contador_recibo')
    .select('proximo').eq('conta_id', c.contaId).single()
  expect(data!.proximo).toBe(2)
})

test('estornar o pagamento cancela o recibo dele junto', async ({ page }) => {
  const c = await cenario('Estúdio do estorno com recibo')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')
  await page.getByRole('button', { name: 'emitir recibo' }).click()
  await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()

  await page.getByRole('button', { name: 'estornar' }).click()
  await page.getByLabel('Motivo').fill('cheque devolvido')
  await page.getByRole('button', { name: 'Estornar', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.goto('/recibos?aba=cancelados')
  await expect(page.getByText('Cancelado: pagamento estornado: cheque devolvido'))
    .toBeVisible()
})

test('o fechamento conta os recibos do período', async ({ page }) => {
  const c = await cenario('Estúdio do relatório de recibo')
  await entrar(page, c.email)
  await page.goto('/financeiro?aba=pagas')
  await page.getByRole('button', { name: 'emitir recibo' }).click()
  await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()

  await page.goto('/financeiro?aba=fechamento')
  await expect(page.getByText('Recibos emitidos')).toBeVisible()
  await expect(page.getByText(/R\$ 735,00 em papel, nenhum cancelado/)).toBeVisible()
})

test('salvar só o CNPJ é recusado, e o campo da razão social não finge estar cheio', async ({ page }) => {
  const c = await cenario('Estúdio do emitente pela metade', { semEmitente: true })
  await entrar(page, c.email)
  await page.goto('/config?s=recibo')

  /*
   * O campo nasce vazio de verdade.
   *
   * O placeholder era o nome da conta, e um campo vazio mostrando exatamente o
   * texto que a pessoa ia digitar parece um campo preenchido. Aconteceu em
   * produção: o dono digitou CNPJ e telefone, salvou, e a razão social ficou
   * nula — com a tela de Recibos avisando, sem ninguém entender por quê.
   */
  await expect(page.getByLabel('Razão social')).toHaveValue('')
  await expect(page.getByLabel('Razão social')).not.toHaveAttribute('placeholder', /./)

  await page.getByLabel('CNPJ ou CPF').fill('05570714000159')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText(/Falta a razão social/)).toBeVisible()

  // e nada foi gravado pela metade: meio emitente destrava nada
  const { data } = await admin.from('conta')
    .select('razao_social, documento').eq('id', c.contaId).single()
  expect(data!.razao_social).toBeNull()
  expect(data!.documento).toBeNull()

  // com os dois, salva
  await page.getByLabel('Razão social').fill('MGM Pilates Ltda')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Emitente salvo')).toBeVisible()
})

test('quem atende não alcança os recibos', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio sem recibo à vista')
  const { email } = await usuarioDe(contaId, 'profissional', marca)

  await entrar(page, email)
  await expect(page.getByRole('link', { name: 'Recibos' })).toHaveCount(0)

  await page.goto('/recibos')
  await expect(page).toHaveURL(/\/hoje/)
})
