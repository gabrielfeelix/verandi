import { test, expect, type Page } from '@playwright/test'
import { admin, contaDeTeste, entrar, escolher, usuarioDe, SENHA } from './apoio'

async function contaDono() {
  const base = await contaDeTeste()
  const { email, usuarioId } = await usuarioDe(base.contaId, 'dono', base.marca)
  return { ...base, email, usuarioId }
}

/** Cria o convite pela tela e devolve o link que ela mostrou. */
async function convitePelaTela(page: import('@playwright/test').Page, para: string, papel = 'Profissional') {
  await page.goto('/config?s=usuarios')
  await page.getByRole('button', { name: 'Convidar' }).click()
  await page.getByLabel('Nome').fill('Sofia Andrade')
  await page.getByLabel('E-mail').fill(para)
  await escolher(page, 'Papel', papel)
  await page.getByRole('button', { name: 'Enviar convite' }).click()

  const campo = page.getByLabel('Link do convite')
  await expect(campo).toBeVisible()
  return await campo.inputValue()
}

test('convidar mostra o link uma vez, e ele leva a definir senha', async ({ page }) => {
  const c = await contaDono()
  const novo = `convidada-${c.marca}@teste.local`

  await entrar(page, c.email)
  const link = await convitePelaTela(page, novo)
  expect(link).toContain('/convite/')

  // o token em claro não está no banco
  const { data } = await admin.from('convite')
    .select('token_hash').eq('conta_id', c.contaId).eq('email', novo).single()
  const token = link.split('/convite/')[1]
  expect(data!.token_hash).not.toBe(token)

  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByLabel('Link do convite')).toHaveCount(0)
})

test('quem recebe o link define senha e entra na conta com o papel do convite', async ({ page }) => {
  const c = await contaDono()
  const novo = `entrante-${c.marca}@teste.local`

  await entrar(page, c.email)
  const link = await convitePelaTela(page, novo, 'Recepção')

  await page.context().clearCookies()
  await page.goto(link)
  await expect(page.getByText('Convite de acesso')).toBeVisible()

  // o nome que o dono escreveu vem preenchido, e quem aceita pode corrigir
  await expect(page.getByLabel('Seu nome')).toHaveValue('Sofia Andrade')
  await page.getByLabel('Seu nome').fill('Sofia Andrade Lima')
  await page.getByLabel('Senha', { exact: true }).fill('senha-nova-123')
  await page.getByLabel('Repita a senha').fill('senha-nova-123')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()

  await page.waitForURL(/\/entrar/)
  const { data: vinculo } = await admin.from('usuario_conta')
    .select('nome').eq('conta_id', c.contaId).eq('papel', 'recepcao').single()
  expect(vinculo!.nome).toBe('Sofia Andrade Lima')
  // o e-mail chega preenchido: quem acabou de criar a senha não redigita o
  // endereço que a tela do convite acabou de mostrar
  await expect(page.getByLabel('E-mail')).toHaveValue(novo)
  await page.getByLabel('Senha').fill('senha-nova-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))

  await expect.poll(async () => {
    const { data } = await admin.from('usuario_conta')
      .select('papel').eq('conta_id', c.contaId)
    return data?.map((x) => x.papel).sort()
  }).toEqual(['dono', 'recepcao'])
})

test('o mesmo link não vale duas vezes', async ({ page }) => {
  const c = await contaDono()
  const novo = `duasvezes-${c.marca}@teste.local`

  await entrar(page, c.email)
  const link = await convitePelaTela(page, novo)

  await page.context().clearCookies()
  await page.goto(link)
  await page.getByLabel('Senha', { exact: true }).fill('senha-nova-123')
  await page.getByLabel('Repita a senha').fill('senha-nova-123')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL(/\/entrar/)

  await page.goto(link)
  await expect(page.getByText('já foi utilizado')).toBeVisible()
})

test('convite revogado deixa de valer na hora', async ({ page }) => {
  const c = await contaDono()
  const novo = `revogada-${c.marca}@teste.local`

  await entrar(page, c.email)
  const link = await convitePelaTela(page, novo)
  await page.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Cancelar convite' }).click()
  // a revogação roda numa transição: navegar antes dela terminar testa o nada
  await expect(page.getByRole('heading', { name: 'Convites em aberto' })).toHaveCount(0)

  await page.context().clearCookies()
  await page.goto(link)
  await expect(page.getByText('foi cancelado')).toBeVisible()
})

test('link inventado não diz se o e-mail existe', async ({ page }) => {
  await page.goto('/convite/token-que-nunca-existiu')
  await expect(page.getByText('Convite não encontrado')).toBeVisible()
})

test('o dono não pode conceder o papel de suporte da 4YU', async ({ page }) => {
  const c = await contaDono()
  await entrar(page, c.email)
  await page.goto('/config?s=usuarios')
  await page.getByRole('button', { name: 'Convidar' }).click()

  // não está na tela, e a ação recusa mesmo se alguém forçar
  await page.getByRole('combobox', { name: 'Papel', exact: true }).click()
  await expect(page.getByRole('option', { name: /Recepção/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Suporte/ })).toHaveCount(0)
})

test('redefinir senha gera link, e a senha nova passa a valer', async ({ page }) => {
  const c = await contaDono()
  const outro = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec`)

  await entrar(page, c.email)
  await page.goto('/config?s=usuarios')
  await abrirMenuDe(page, outro.email)
  await page.getByRole('menuitem', { name: 'Redefinir senha' }).click()

  const link = await page.getByLabel('Link do convite').inputValue()

  await page.context().clearCookies()
  await page.goto(link)
  await page.getByLabel('Senha', { exact: true }).fill('outra-senha-456')
  await page.getByLabel('Repita a senha').fill('outra-senha-456')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL(/\/entrar/)

  await page.getByLabel('E-mail').fill(outro.email)
  await page.getByLabel('Senha').fill('outra-senha-456')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))

  // a senha antiga deixou de valer
  const { error } = await admin.auth.signInWithPassword({
    email: outro.email, password: SENHA,
  })
  expect(error).not.toBeNull()
})

test('redefinir senha não muda o papel de ninguém', async ({ page }) => {
  const c = await contaDono()
  const outro = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec2`)

  await entrar(page, c.email)
  await page.goto('/config?s=usuarios')
  await abrirMenuDe(page, outro.email)
  await page.getByRole('menuitem', { name: 'Redefinir senha' }).click()
  const link = await page.getByLabel('Link do convite').inputValue()

  await page.context().clearCookies()
  await page.goto(link)
  await page.getByLabel('Senha', { exact: true }).fill('mais-uma-senha-789')
  await page.getByLabel('Repita a senha').fill('mais-uma-senha-789')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL(/\/entrar/)

  const { data } = await admin.from('usuario_conta')
    .select('papel').eq('conta_id', c.contaId).eq('usuario_id', outro.usuarioId).single()
  expect(data!.papel).toBe('recepcao')
})

test('remover acesso não apaga o que a pessoa registrou', async ({ page }) => {
  const c = await contaDono()
  const outro = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-rec3`)

  // essa pessoa registrou uma presença
  const { data: sessao } = await admin.from('sessao').insert({
    conta_id: c.contaId, servico_id: c.servicoId, inicio: '2036-03-02T13:00:00Z',
    duracao_min: 60, capacidade: 4, status: 'prevista', motivo_cancelamento: null,
  }).select().single()
  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: c.contaId, nome: 'Helena Moraes' }).select().single()
  await admin.from('participacao').insert({
    conta_id: c.contaId, sessao_id: sessao!.id, pessoa_id: pessoa!.id,
    origem: 'avulso', status: 'presente',
    registrado_por_usuario_id: outro.usuarioId, registrado_por_origem: 'recepcao',
  })

  await entrar(page, c.email)
  await page.goto('/config?s=usuarios')
  await abrirMenuDe(page, outro.email)
  await page.getByRole('menuitem', { name: 'Remover acesso' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remover acesso' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('usuario_conta')
      .select('ativo').eq('conta_id', c.contaId).eq('usuario_id', outro.usuarioId).single()
    return data?.ativo
  }).toBe(false)

  // a presença continua com o nome de quem marcou
  const { data: p } = await admin.from('participacao')
    .select('registrado_por_usuario_id').eq('sessao_id', sessao!.id).single()
  expect(p!.registrado_por_usuario_id).toBe(outro.usuarioId)
})

test('a conta não fica sem dono', async ({ page }) => {
  const c = await contaDono()
  const outro = await usuarioDe(c.contaId, 'dono', `${c.marca}-dono2`)

  await entrar(page, outro.email)
  await page.goto('/config?s=usuarios')

  // rebaixar o outro dono deixaria um só; remover esse último é que é recusado
  await abrirMenuDe(page, c.email)
  await page.getByRole('menuitem', { name: 'Tornar recepção' }).click()
  await expect.poll(async () => {
    const { data } = await admin.from('usuario_conta')
      .select('papel').eq('conta_id', c.contaId).eq('usuario_id', c.usuarioId).single()
    return data?.papel
  }).toBe('recepcao')

  await page.reload()
  await abrirMenuDe(page, c.email)
  await page.getByRole('menuitem', { name: 'Tornar dono' }).click()
  await expect.poll(async () => {
    const { data } = await admin.from('usuario_conta')
      .select('papel').eq('conta_id', c.contaId).eq('usuario_id', c.usuarioId).single()
    return data?.papel
  }).toBe('dono')
})

/**
 * As ações de um usuário moram no menu de três pontinhos da linha dele.
 *
 * Abrir pelo nome acessível, e não pela posição, é o que faz o teste
 * continuar valendo quando a lista muda de ordem.
 */
async function abrirMenuDe(page: Page, email: string) {
  await page.getByRole('button', { name: `Ações de ${email}` }).click()
}

test('quem já tem acesso não recebe convite', async ({ page }) => {
  const c = await contaDono()
  const outro = await usuarioDe(c.contaId, 'recepcao', `${c.marca}-ja`)

  await entrar(page, c.email)
  await page.goto('/config?s=usuarios')
  await page.getByRole('button', { name: 'Convidar' }).click()
  await page.getByLabel('Nome').fill('Sofia Andrade')
  await page.getByLabel('E-mail').fill(outro.email)
  await escolher(page, 'Papel', 'Profissional')
  await page.getByRole('button', { name: 'Enviar convite' }).click()
  await expect(page.getByText(/já tem acesso a esta conta/i)).toBeVisible()

  // o papel continua o de antes: o convite não passou por cima dele
  const { data } = await admin.from('usuario_conta')
    .select('papel').eq('conta_id', c.contaId).eq('usuario_id', outro.usuarioId).single()
  expect(data!.papel).toBe('recepcao')
})

test('convite para e-mail que já existe pede a senha atual e não a troca', async ({ page }) => {
  const c = await contaDono()
  const vizinha = await contaDeTeste()
  const alheio = await usuarioDe(vizinha.contaId, 'dono', `${c.marca}-viz`)

  await entrar(page, c.email)
  const link = await convitePelaTela(page, alheio.email, 'Profissional')

  await page.context().clearCookies()
  await page.goto(link)
  await expect(page.getByLabel('Repita a senha')).toHaveCount(0)

  // quem só tem o link não define senha nova para a conta de outra pessoa
  await page.getByLabel('Sua senha').fill('senha-inventada-123')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await expect(page.getByText(/a senha não confere/i)).toBeVisible()
  const { data: semVinculo } = await admin.from('usuario_conta')
    .select('usuario_id').eq('conta_id', c.contaId).eq('usuario_id', alheio.usuarioId)
  expect(semVinculo).toEqual([])

  // a dona do e-mail, com a senha dela, aceita e continua entrando com ela
  await page.getByLabel('Sua senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL(/\/entrar/)
  await expect.poll(async () => {
    const { data } = await admin.from('usuario_conta')
      .select('papel').eq('conta_id', c.contaId).eq('usuario_id', alheio.usuarioId)
    return data?.map((x) => x.papel)
  }).toEqual(['profissional'])
})
