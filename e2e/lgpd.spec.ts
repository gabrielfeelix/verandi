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

  /*
   * `poll` também aqui, e não leitura direta.
   *
   * `anonimizarPessoa` zera a `pessoa` primeiro e a `participacao` depois. O
   * `poll` de cima passa assim que a primeira gravação cai, que é **antes** da
   * última: ler direto aqui acerta ou erra conforme a máquina, e já errou.
   */
  await expect.poll(async () => {
    const { data } = await admin.from('participacao')
      .select('status, observacao').eq('id', participacao!.id).single()
    return data
  }).toEqual({ status: 'presente', observacao: null })

  // o que aconteceu continua: a presença dela era parte da turma daquele dia
  await expect.poll(async () => {
    const { count } = await admin.from('pessoa_tag')
      .select('*', { count: 'exact', head: true }).eq('pessoa_id', pessoa.id)
    return count
  }).toBe(0)

  // fica registrado quem atendeu ao pedido, sem copiar o nome que acabou de sair.
  // `poll` pelo mesmo motivo dos dois acima: o log é a última gravação da ação
  await expect.poll(async () => {
    const { data } = await admin.from('log_configuracao')
      .select('entidade, acao, detalhe').eq('entidade_id', pessoa.id).maybeSingle()
    return data
  }).toEqual({ entidade: 'pessoa', acao: 'anonimizou', detalhe: {} })

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

/**
 * A observação da ficha segue a mesma régua da observação da chamada.
 *
 * A faixa "Atenção na aula" é onde alguém escreve "hérnia de disco, não pode
 * carga axial", e ela ficava aberta para a conta inteira enquanto a anotação da
 * chamada já separava quem lê. Fechar metade não fecha nada: a frase restrita
 * migra para a caixa que ainda vaza.
 */
test('observação da ficha escrita para quem atende não chega à recepção', async ({ page, browser }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  const recepcao = await usuarioDe(base.contaId, 'recepcao', `${base.marca}-rec`)
  const [pessoa] = await criarPessoas(base.contaId, [`Vera Lopes ${base.marca}`])

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa.id}`)
  await page.getByRole('button', { name: 'Editar dados' }).click()
  await page.getByLabel('Observação').fill('hérnia de disco, sem carga axial')
  await page.getByLabel('Só quem atende').check()
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('pessoa')
      .select('observacao, observacao_visivel').eq('id', pessoa.id).single()
    return data
  }).toEqual({
    observacao: 'hérnia de disco, sem carga axial',
    observacao_visivel: 'profissionais',
  })

  // quem escreveu continua lendo, e a faixa diz que aquilo é restrito
  await page.reload()
  await expect(page.getByText('hérnia de disco, sem carga axial')).toBeVisible()
  await expect(page.getByText('só quem atende')).toBeVisible()

  // a recepção abre a mesma ficha e não encontra o texto
  const outra = await browser.newContext()
  const pagRec = await outra.newPage()
  await entrar(pagRec, recepcao.email)
  await pagRec.goto(`/pessoas/${pessoa.id}`)
  await expect(pagRec.getByText(`Vera Lopes ${base.marca}`).first()).toBeVisible()
  await expect(pagRec.getByText('hérnia de disco, sem carga axial')).toHaveCount(0)

  // some, mas não em silêncio: senão ela reescreve achando o campo vazio
  await expect(pagRec.getByText('anotação nesta ficha escrita para quem atende'))
    .toBeVisible()

  // e o formulário não oferece o campo que ela não pode ler
  await pagRec.getByRole('button', { name: 'Editar dados' }).click()
  await expect(pagRec.getByLabel('Observação')).toHaveCount(0)
  await expect(pagRec.getByText('foi escrita para quem atende')).toBeVisible()

  // editar o resto continua funcionando, e não apaga a anotação
  // `exact`: a ficha ganhou telefone residencial e comercial, e sem isto o
  // nome casa com os três
  await pagRec.getByLabel('Telefone', { exact: true }).fill('11988887777')
  await pagRec.getByRole('button', { name: 'Salvar' }).click()
  await expect.poll(async () => {
    const { data } = await admin.from('pessoa')
      .select('telefone, observacao').eq('id', pessoa.id).single()
    return data
  }).toEqual({
    telefone: '11988887777', observacao: 'hérnia de disco, sem carga axial',
  })
  await outra.close()
})

test('observação da ficha para todos chega à recepção', async ({ page, browser }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  const recepcao = await usuarioDe(base.contaId, 'recepcao', `${base.marca}-rec2`)
  const [pessoa] = await criarPessoas(base.contaId, [`Ivo Prado ${base.marca}`])

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa.id}`)
  await page.getByRole('button', { name: 'Editar dados' }).click()
  await page.getByLabel('Observação').fill('prefere a maca do fundo')
  await page.getByLabel('Todo mundo da conta').check()
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('pessoa')
      .select('observacao_visivel').eq('id', pessoa.id).single()
    return data?.observacao_visivel
  }).toBe('todos')

  const outra = await browser.newContext()
  const pagRec = await outra.newPage()
  await entrar(pagRec, recepcao.email)
  await pagRec.goto(`/pessoas/${pessoa.id}`)
  await expect(pagRec.getByText('prefere a maca do fundo')).toBeVisible()
  await outra.close()
})

/**
 * O padrão fecha, e é decisão: quem anota entre uma turma e outra não volta
 * para restringir depois, e deixar aberto é o erro que não tem volta.
 */
test('observação nova nasce restrita a quem atende', async ({ page }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)
  const [pessoa] = await criarPessoas(base.contaId, [`Rita Nunes ${base.marca}`])

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa.id}`)
  await page.getByRole('button', { name: 'Editar dados' }).click()
  await expect(page.getByLabel('Só quem atende')).toBeChecked()
})
