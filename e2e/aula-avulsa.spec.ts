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
