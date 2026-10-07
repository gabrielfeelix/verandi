import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, entrar, usuarioDe } from './apoio'

/**
 * Aula avulsa marcada pela ficha, numa modalidade sem grade.
 *
 * O caso que importa: a pessoa já tem um pacote com saldo na mesma modalidade.
 * A aula avulsa cobrada é paga pelo contrato dela, e o pacote fica intacto. Antes,
 * o encaixe ligava a aula ao contrato mais antigo com saldo: o pacote perdia uma
 * aula, e o avulso ficava cobrado e sem aula.
 */
async function cenario() {
  const { contaId, marca } = await contaDeTeste('Estúdio da avulsa')
  const { email } = await usuarioDe(contaId, 'dono', marca)

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Thais ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()
  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Fisioterapia' })
    .select('id').single<{ id: string }>()
  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servico!.id, codigo: 'P10', nome: 'Pacote de 10',
    recorrencia: 'pacote', sessoes_no_pacote: 10, preco_vinculado_cent: 150000, preco_avulso_cent: 150000,
  }).select('id').single<{ id: string }>()
  const { data: pacote } = await admin.from('contrato').insert({
    conta_id: contaId, pessoa_id: pessoa!.id, plano_id: plano!.id,
    inicio: '2026-01-01', preco_aplicado_cent: 150000, sessoes_contratadas: 10,
  }).select('id').single<{ id: string }>()

  return { email, pessoaId: pessoa!.id, pacoteId: pacote!.id }
}

test('aula avulsa cobrada é paga pelo contrato dela, e o pacote fica intacto', async ({ page }) => {
  const c = await cenario()
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}`)

  await page.getByRole('button', { name: /^Marcar / }).first().click()
  await page.getByRole('textbox', { name: 'Dia', exact: true }).fill('2026-12-10')
  await page.getByRole('textbox', { name: 'Hora', exact: true }).fill('10:00')

  // colado do extrato, o valor é lido em reais, não como dígitos de maquininha
  const valor = page.getByRole('textbox', { name: 'Valor', exact: true })
  await valor.evaluate((el) => {
    const dt = new DataTransfer()
    dt.setData('text', 'R$ 120')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(valor).toHaveValue('120,00')

  await page.getByRole('button', { name: 'Marcar neste dia e hora' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const { data: parts } = await admin.from('participacao')
    .select('contrato_id, contrato:contrato_id(plano(recorrencia), preco_aplicado_cent)')
    .eq('pessoa_id', c.pessoaId)
  expect(parts).toHaveLength(1)
  const p = parts![0] as unknown as {
    contrato_id: string
    contrato: { plano: { recorrencia: string }; preco_aplicado_cent: number }
  }
  expect(p.contrato_id).not.toBe(c.pacoteId)
  expect(p.contrato.plano.recorrencia).toBe('avulsa')
  expect(p.contrato.preco_aplicado_cent).toBe(12000)

  // o pacote não gastou nada
  const { count } = await admin.from('participacao')
    .select('*', { count: 'exact', head: true }).eq('contrato_id', c.pacoteId)
  expect(count).toBe(0)
})

test('sem valor, a aula avulsa sai do saldo do pacote', async ({ page }) => {
  const c = await cenario()
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}`)

  await page.getByRole('button', { name: /^Marcar / }).first().click()
  await page.getByRole('textbox', { name: 'Dia', exact: true }).fill('2026-12-11')
  await page.getByRole('textbox', { name: 'Hora', exact: true }).fill('10:00')
  await page.getByRole('button', { name: 'Marcar neste dia e hora' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const { data: parts } = await admin.from('participacao')
    .select('contrato_id').eq('pessoa_id', c.pessoaId)
  expect(parts).toEqual([{ contrato_id: c.pacoteId }])
})

test('encaixe pago numa aula avulsa não conta no limite do plano livre', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio do plano livre')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Paula ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()
  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Fisioterapia' })
    .select('id').single<{ id: string }>()
  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servico!.id, codigo: 'L1', nome: 'Livre 1x',
    recorrencia: 'mensal', horario_livre: true, frequencia_semanal: 1,
    preco_vinculado_cent: 30000, preco_avulso_cent: 30000,
  }).select('id').single<{ id: string }>()
  const { data: livre } = await admin.from('contrato').insert({
    conta_id: contaId, pessoa_id: pessoa!.id, plano_id: plano!.id,
    inicio: '2026-01-01', preco_aplicado_cent: 30000,
  }).select('id').single<{ id: string }>()

  // a aula da semana que o plano dá já foi usada na segunda
  const sessao = async (inicio: string) => (await admin.from('sessao').insert({
    conta_id: contaId, servico_id: servico!.id, inicio, duracao_min: 60,
    capacidade: 2, status: 'prevista',
  }).select('id').single<{ id: string }>()).data!.id
  const segunda = await sessao('2026-12-07T13:00:00Z')
  await admin.from('participacao').insert({
    conta_id: contaId, sessao_id: segunda, pessoa_id: pessoa!.id,
    origem: 'avulso', status: 'esperada', contrato_id: livre!.id,
  })
  const quarta = await sessao('2026-12-09T13:00:00Z')

  await entrar(page, email)
  await page.goto(`/sessao/${quarta}`)
  await page.getByRole('button', { name: /Encaixar/ }).click()
  const modal = page.getByRole('dialog')
  await modal.getByPlaceholder('Buscar por nome').fill('Paula')
  await modal.getByRole('button', { name: /Paula/ }).click()
  await modal.getByRole('textbox', { name: 'Valor desta aula' }).fill('8000')
  await modal.getByRole('button', { name: /^Encaixar como/ }).click()
  await expect(modal).toHaveCount(0)

  const { data: parts } = await admin.from('participacao')
    .select('contrato:contrato_id(plano(recorrencia), preco_aplicado_cent)')
    .eq('sessao_id', quarta).eq('pessoa_id', pessoa!.id)
  expect(parts).toEqual([{ contrato: { plano: { recorrencia: 'avulsa' }, preco_aplicado_cent: 8000 } }])
})

test('aula paga que foi cancelada devolve o crédito para a próxima', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio da aula cancelada')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Vera ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()
  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Fisioterapia' })
    .select('id').single<{ id: string }>()
  const { data: plano } = await admin.from('plano').insert({
    conta_id: contaId, servico_id: servico!.id, codigo: 'AV1', nome: 'Aula avulsa',
    recorrencia: 'avulsa', preco_vinculado_cent: 9000, preco_avulso_cent: 9000,
  }).select('id').single<{ id: string }>()
  const { data: avulso } = await admin.from('contrato').insert({
    conta_id: contaId, pessoa_id: pessoa!.id, plano_id: plano!.id,
    inicio: '2026-12-01', fim: '2026-12-01', preco_aplicado_cent: 9000,
  }).select('id').single<{ id: string }>()
  const sessao = async (inicio: string, status = 'prevista') => (await admin.from('sessao').insert({
    conta_id: contaId, servico_id: servico!.id, inicio, duracao_min: 60, capacidade: 2, status,
  }).select('id').single<{ id: string }>()).data!.id
  const caiu = await sessao('2026-12-01T13:00:00Z', 'cancelada')
  await admin.from('participacao').insert({
    conta_id: contaId, sessao_id: caiu, pessoa_id: pessoa!.id,
    origem: 'avulso', status: 'esperada', contrato_id: avulso!.id,
  })
  const nova = await sessao('2026-12-08T13:00:00Z')

  await entrar(page, email)
  await page.goto(`/sessao/${nova}`)
  await page.getByRole('button', { name: /Encaixar/ }).click()
  const modal = page.getByRole('dialog')
  await modal.getByPlaceholder('Buscar por nome').fill('Vera')
  await modal.getByRole('button', { name: /Vera/ }).click()
  await modal.getByRole('button', { name: /^Encaixar como/ }).click()
  await expect(modal).toHaveCount(0)

  const { data: parts } = await admin.from('participacao')
    .select('contrato_id').eq('sessao_id', nova).eq('pessoa_id', pessoa!.id)
  expect(parts).toEqual([{ contrato_id: avulso!.id }])
})
