import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

const atras = (d: number) => new Date(Date.now() - d * 864e5).toISOString()

async function contaComPendencia() {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  const pessoas = await criarPessoas(base.contaId, ['Helena Moraes'])

  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: base.contaId, servico_id: base.servicoId, profissional_id: base.profissionalId,
    inicio: atras(1), duracao_min: 60, capacidade: 4,
    status: 'prevista', motivo_cancelamento: null,
  }).select().single()
  await admin.from('participacao').insert({
    conta_id: base.contaId, sessao_id: sessao!.id, pessoa_id: pessoas[0].id,
    origem: 'recorrente', status: 'esperada',
  })

  return { ...base, email, sessaoId: sessao!.id as string, pessoas }
}

test('a chamada não feita aparece e leva direto para a sessão', async ({ page }) => {
  const c = await contaComPendencia()
  await entrar(page, c.email)
  await page.goto('/pendencias')

  await expect(page.getByRole('heading', { name: 'Chamadas não feitas' })).toBeVisible()
  await page.getByRole('link', { name: 'Resolver' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/sessao/${c.sessaoId}`))
})

test('registrar a chamada tira a pendência sem passo extra', async ({ page }) => {
  const c = await contaComPendencia()
  await entrar(page, c.email)
  await page.goto(`/sessao/${c.sessaoId}`)
  await page.getByRole('button', { name: /Marcar todos presentes/ }).click()

  // esperar a escrita antes de navegar: a ação roda numa transição, e sair da
  // página no meio dela testa o estado anterior
  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('status').eq('sessao_id', c.sessaoId).single()
    return data?.status
  }).toBe('presente')

  await page.goto('/pendencias')
  await expect(page.getByText('Nada pendente')).toBeVisible()
})

test('dispensar pede motivo e some da lista', async ({ page }) => {
  const c = await contaComPendencia()
  await entrar(page, c.email)
  await page.goto('/pendencias')

  await page.getByRole('button', { name: 'Dispensar' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Motivo').selectOption('Não se aplica')
  await page.getByRole('button', { name: 'Dispensar', exact: true }).last().click()

  await expect(page.getByText('Nada pendente')).toBeVisible()

  await expect.poll(async () => {
    const { data } = await admin.from('pendencia_dispensada')
      .select('motivo, dispensado_por_usuario_id').eq('conta_id', c.contaId).single()
    return { motivo: data?.motivo, temAutor: data?.dispensado_por_usuario_id !== null }
  }).toEqual({ motivo: 'Não se aplica', temAutor: true })
})

test('conta sem nada mostra que isso é o normal, não erro', async ({ page }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)

  await entrar(page, email)
  await page.goto('/pendencias')
  await expect(page.getByText('é assim que esta tela deve ficar')).toBeVisible()
})

test('profissional não alcança pendências', async ({ page }) => {
  const c = await contaComPendencia()
  const prof = await usuarioDe(c.contaId, 'profissional', `${c.marca}-p`)

  await entrar(page, prof.email)
  await page.goto('/pendencias')
  await expect(page).toHaveURL(/\/hoje/)
})
