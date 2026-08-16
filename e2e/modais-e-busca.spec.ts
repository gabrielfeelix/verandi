import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, criarPessoas, entrar, usuarioDe } from './apoio'

/**
 * As ações que o protótipo desenhou em modal, e as duas buscas.
 *
 * Existe por causa do que passou batido antes: a suíte conferia a URL e dava
 * verde enquanto a tela ficava em branco. Aqui a pergunta é sempre a mesma —
 * **abriu o modal, e ele fez o que prometeu?** —, porque foi assim que
 * "Cadastrar aluno" virou uma faixa dentro do cabeçalho, "Agendar" virou uma
 * âncora que não levava a lugar nenhum e "Encerrar" virou `confirm()` do
 * navegador, com a suíte inteira passando.
 */
async function cenario() {
  const base = await contaDeTeste()

  const { data: serie } = await admin.from('serie').insert({
    conta_id: base.contaId, servico_id: base.servicoId,
    profissional_id: base.profissionalId, local_id: base.localId,
    dia_semana: 2, hora_inicio: '09:00', duracao_min: 60, capacidade: 4,
    vigencia_inicio: '2026-01-01',
  }).select().single()

  const [pessoa] = await criarPessoas(base.contaId, ['Helena Moraes'])
  await admin.from('vaga').insert({
    conta_id: base.contaId, serie_id: serie!.id,
    pessoa_id: pessoa.id, inicio: '2026-01-01',
  })

  return { ...base, pessoaId: pessoa.id }
}

test('cadastrar pessoa abre modal, grava e abre a ficha', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/pessoas')
  await page.getByRole('button', { name: /^Cadastrar/ }).click()

  const modal = page.locator('dialog[open]')
  await expect(modal.getByRole('heading')).toContainText('Cadastrar')

  await modal.locator('#np-nome').fill('Otávio Prado')
  await modal.locator('#np-fone').fill('11987654321')
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()

  // a ficha da pessoa nova é o destino: cadastrar para cair de volta na lista
  // obriga a procurar quem acabou de ser criado
  await page.waitForURL(/\/pessoas\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Otávio Prado')
})

test('editar dados abre modal, salva e fecha', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto(`/pessoas/${c.pessoaId}`)
  await page.getByRole('button', { name: 'Editar dados' }).click()

  const modal = page.locator('dialog[open]')
  await modal.locator('#ep-email').fill('helena@teste.local')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.getByText('helena@teste.local')).toBeVisible()
})

test('agendar, no alto da ficha, abre o mesmo modal de matrícula', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto(`/pessoas/${c.pessoaId}`)
  await page.getByRole('button', { name: 'Agendar' }).click()

  const modal = page.locator('dialog[open]')
  await expect(modal.getByRole('heading')).toContainText('Novo agendamento')

  // o horário da grade tem que estar oferecido: modal que abre vazio é o mesmo
  // beco da âncora que não levava a lugar nenhum
  await modal.locator('#vg-serie').click()
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option').first()).toContainText('09:00')
})

test('encerrar matrícula pergunta em modal, não no confirm do navegador', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  // se algum dia voltar a usar `confirm()`, o diálogo nativo fica pendurado e
  // este teste falha em vez de passar sem ninguém ver
  page.on('dialog', () => { throw new Error('usou o confirm() do navegador') })

  await page.goto(`/pessoas/${c.pessoaId}`)
  await page.getByRole('button', { name: 'Encerrar' }).first().click()

  const modal = page.locator('dialog[open]')
  await expect(modal.getByRole('heading')).toContainText('Encerrar')
  await modal.getByRole('button', { name: 'Encerrar' }).click()

  await expect(page.locator('dialog[open]')).toHaveCount(0)
  // encerrar vale a partir de hoje, então a linha continua na lista até virar
  // o dia; o que prova que a ação aconteceu é o aviso
  await expect(page.getByText('Agendamento encerrado')).toBeVisible()
})

test('a busca de pessoas filtra enquanto se digita, sem Enter', async ({ page }) => {
  const c = await cenario()
  await criarPessoas(c.contaId, ['Otávio Prado', 'Beatriz Nogueira'])
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/pessoas')
  // o link de exportar também mora sob /pessoas/, e não é ficha de ninguém
  const fichas = page.locator('a[href^="/pessoas/"]:not([href*="exportar"])')
  await expect(fichas).toHaveCount(3)

  await page.getByLabel('Buscar').fill('Helena')

  await expect(fichas).toHaveCount(1)
  await expect(page).toHaveURL(/q=Helena/)

  // apagar devolve a lista: a busca não pode ser um caminho de mão única
  await page.getByLabel('Buscar').fill('')
  await expect(fichas).toHaveCount(3)
})

test('a busca do Hoje acha a pessoa e abre a ficha', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/hoje')
  // era um `<span>`: parecia campo, tinha o `/` desenhado ao lado e não
  // aceitava foco nem digitação
  await page.getByRole('combobox', { name: /Buscar/i }).fill('Hele')

  const opcao = page.getByRole('option').first()
  await expect(opcao).toContainText('Helena Moraes')
  await opcao.click()

  await page.waitForURL(`**/pessoas/${c.pessoaId}`)
})

test('os selects da grade dizem "sem professor", não ", sem definir ,"', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto('/grade')
  await page.getByRole('button', { name: /Criar/ }).first().click()

  const modal = page.locator('dialog[open]')
  await expect(modal.locator('#profissionalId')).toHaveText(/^Sem /)
  await expect(modal.locator('#localId')).toHaveText(/^Sem /)

  // e a lista aberta também: o vazio é uma opção com nome, não uma vírgula
  await modal.locator('#profissionalId').click()
  await expect(page.getByRole('option').first()).toHaveText(/^Sem /)
  await expect(page.getByText(', sem definir ,')).toHaveCount(0)
})

test('Esc fecha só o painel aberto, não o modal inteiro', async ({ page }) => {
  const c = await cenario()
  const { email } = await usuarioDe(c.contaId, 'dono', c.marca)
  await entrar(page, email)

  await page.goto(`/pessoas/${c.pessoaId}`)
  await page.getByRole('button', { name: 'Agendar' }).click()

  // o `<dialog>` fecha no Esc por conta própria: sem interceptar, desistir da
  // lista de horários levava junto o formulário inteiro
  await page.locator('#vg-serie').click()
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.locator('dialog[open]')).toHaveCount(1)

  await page.getByLabel('Abrir o calendário').click()
  await expect(page.locator('[role=grid]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[role=grid]')).toHaveCount(0)
  await expect(page.locator('dialog[open]')).toHaveCount(1)

  // sem painel aberto, o Esc volta a ser do modal
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
})
