import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

/**
 * O direito do titular do dado, atendido sem destruir o histórico do negócio.
 *
 * Quem coletou o nome foi o cliente, não a 4YU. Ele precisa conseguir cumprir o
 * pedido pela tela, e `delete` não serve: levaria `participacao` por cascade e
 * com ela a presença de todo mundo que estava na mesma turma.
 */
test('atender pedido de exclusão apaga quem a pessoa é e mantém o que aconteceu', async ({ page }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  const [pessoa] = await criarPessoas(base.contaId, [`Larissa Cruz ${base.marca}`])

  await admin.from('pessoa').update({
    telefone: '11999990000', email: 'larissa@exemplo.com',
    observacao: 'lesão no ombro',
  }).eq('id', pessoa.id)
  await admin.from('pessoa_tag')
    .insert({ conta_id: base.contaId, pessoa_id: pessoa.id, tag: 'gestante' })

  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: base.contaId, servico_id: base.servicoId,
    profissional_id: base.profissionalId, local_id: base.localId,
    inicio: '2026-05-12T13:00:00Z', duracao_min: 60, capacidade: 4,
  }).select().single()

  const { data: participacao } = await admin.from('participacao').insert({
    conta_id: base.contaId, sessao_id: sessao!.id, pessoa_id: pessoa.id,
    origem: 'recorrente', status: 'presente', observacao: 'travou no meio',
  }).select().single()

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa.id}`)

  await page.getByRole('button', { name: 'Atender pedido de exclusão' }).click()

  // sem escrever o nome, o primário nem fica clicável: aqui não há desfazer
  await expect(page.getByText('O que sai')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apagar os dados' })).toBeDisabled()

  await page.getByLabel(/Escreva .* para confirmar/).fill(`Larissa Cruz ${base.marca}`)
  await page.getByRole('button', { name: 'Apagar os dados' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('pessoa')
      .select('nome, telefone, email, observacao, ativo, anonimizada_em')
      .eq('id', pessoa.id).single()
    return data && {
      ...data, anonimizada_em: data.anonimizada_em === null ? null : 'tem',
    }
  }).toEqual({
    nome: 'Pessoa removida', telefone: null, email: null, observacao: null,
    ativo: false, anonimizada_em: 'tem',
  })

  // o que aconteceu continua: a presença dela era parte da turma daquele dia
  const { data: p } = await admin.from('participacao')
    .select('status, observacao').eq('id', participacao!.id).single()
  expect(p).toEqual({ status: 'presente', observacao: null })

  const { count } = await admin.from('pessoa_tag')
    .select('*', { count: 'exact', head: true }).eq('pessoa_id', pessoa.id)
  expect(count).toBe(0)

  // fica registrado quem atendeu ao pedido, sem copiar o nome que acabou de sair
  const { data: log } = await admin.from('log_configuracao')
    .select('entidade, acao, detalhe').eq('entidade_id', pessoa.id).single()
  expect(log).toEqual({ entidade: 'pessoa', acao: 'anonimizou', detalhe: {} })

  await page.reload()
  await expect(page.getByText('foram apagados a pedido dela')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atender pedido de exclusão' }))
    .toHaveCount(0)
})

test('recepção não atende pedido de exclusão', async ({ page }) => {
  const base = await contaDeTeste()
  const recepcao = await usuarioDe(base.contaId, 'recepcao', base.marca)
  const [pessoa] = await criarPessoas(base.contaId, [`Ana Reis ${base.marca}`])

  await entrar(page, recepcao.email)
  await page.goto(`/pessoas/${pessoa.id}`)

  await expect(page.getByText(`Ana Reis ${base.marca}`).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atender pedido de exclusão' }))
    .toHaveCount(0)
})
