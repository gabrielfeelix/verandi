import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, entrar, usuarioDe } from './apoio'

/**
 * Encerrar o horário fixo solta o lugar de verdade.
 *
 * A agenda gera as aulas semanas à frente, com quem tem vaga. Encerrar só
 * gravava o fim da vaga: a pessoa continuava na chamada dessas aulas, ocupando
 * o lugar que a tela dizia ter devolvido.
 */
async function cenario(nome: string) {
  const { contaId, marca } = await contaDeTeste(nome)
  const { email } = await usuarioDe(contaId, 'dono', marca)
  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Gustavo ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()
  const { data: servico } = await admin.from('servico')
    .insert({ conta_id: contaId, nome: 'Pilates solo' })
    .select('id').single<{ id: string }>()
  const { data: serie } = await admin.from('serie').insert({
    conta_id: contaId, servico_id: servico!.id, dia_semana: 3, hora_inicio: '09:00',
    duracao_min: 60, capacidade: 3, vigencia_inicio: '2026-01-01',
  }).select('id').single<{ id: string }>()
  await admin.from('vaga').insert({
    conta_id: contaId, serie_id: serie!.id, pessoa_id: pessoa!.id, inicio: '2026-01-01',
  })
  // a aula já gerada lá na frente, com ele dentro
  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: contaId, serie_id: serie!.id, servico_id: servico!.id,
    inicio: '2026-12-09T12:00:00Z', duracao_min: 60, capacidade: 3, status: 'prevista',
  }).select('id').single<{ id: string }>()
  await admin.from('participacao').insert({
    conta_id: contaId, sessao_id: sessao!.id, pessoa_id: pessoa!.id,
    origem: 'recorrente', status: 'esperada',
  })
  return { email, pessoaId: pessoa!.id, sessaoId: sessao!.id }
}

const naAula = async (sessaoId: string, pessoaId: string) => (await admin.from('participacao')
  .select('*', { count: 'exact', head: true })
  .eq('sessao_id', sessaoId).eq('pessoa_id', pessoaId)).count

test('encerrar o horário fixo tira a pessoa das aulas já geradas', async ({ page }) => {
  const c = await cenario('Estúdio do horário encerrado')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}`)

  await page.getByRole('button', { name: /^Opções de/ }).click()
  await page.getByRole('menuitem', { name: /^Encerrar/ }).click()
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()

  await expect.poll(() => naAula(c.sessaoId, c.pessoaId)).toBe(0)
})

test('inativar o cadastro solta o horário fixo', async ({ page }) => {
  const c = await cenario('Estúdio do aluno que saiu')
  await entrar(page, c.email)
  await page.goto(`/pessoas/${c.pessoaId}`)

  await page.getByRole('button', { name: 'Outras ações' }).click()
  await page.getByRole('menuitem', { name: /Inativar/ }).click()
  await page.getByRole('button', { name: 'Inativar', exact: true }).click()

  await expect.poll(() => naAula(c.sessaoId, c.pessoaId)).toBe(0)
  const { data: vagas } = await admin.from('vaga').select('fim').eq('pessoa_id', c.pessoaId)
  expect(vagas!.every((v) => v.fim !== null)).toBe(true)
})
