import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, contaInterna, entrar, usuarioDe } from './apoio'

/** Alguém com papel de suporte na conta interna, é assim que a 4YU existe. */
async function comoSuporte() {
  const marca = `${Date.now()}-sup`
  const contaId = await contaInterna()
  const { email, usuarioId } = await usuarioDe(contaId, 'suporte', marca)
  return { contaId, marca, email, usuarioId }
}

test('a 4YU cria conta e recebe o convite do dono', async ({ page }) => {
  const s = await comoSuporte()
  const slug = `aurora-${Date.now()}`

  await entrar(page, s.email)
  await page.goto('/admin/empresas')

  await page.getByRole('button', { name: 'Nova empresa' }).click()
  await page.getByLabel('Nome do negócio').fill('Studio Aurora')
  await page.getByLabel('Identificador').fill(slug)
  await page.getByLabel('E-mail do dono').fill(`dono-${slug}@teste.local`)
  await page.getByRole('button', { name: 'Criar empresa' }).click()

  const link = await page.getByLabel('Link do convite').inputValue()
  expect(link).toContain('/convite/')

  // a conta nasce vazia
  const { data: conta } = await admin.from('conta')
    .select('id').eq('slug', slug).single()
  const { count } = await admin.from('serie')
    .select('*', { count: 'exact', head: true }).eq('conta_id', conta!.id)
  expect(count).toBe(0)

  // e o dono entra por esse link
  await page.context().clearCookies()
  await page.goto(link)
  await page.getByLabel('Seu nome').fill('Dono do Aurora')
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-dono-1')
  await page.getByLabel('Repita a senha').fill('senha-do-dono-1')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL(/\/entrar/)

  const { data: vinculo } = await admin.from('usuario_conta')
    .select('papel').eq('conta_id', conta!.id).single()
  expect(vinculo!.papel).toBe('dono')
})

test('entrar como suporte deixa o sair à mão, e registra', async ({ page }) => {
  const s = await comoSuporte()
  // nome único: o banco não é limpo entre execuções, e nome repetido torna o
  // seletor ambíguo na segunda rodada
  const nome = `Studio do Cliente ${Date.now()}`
  const cliente = await contaDeTeste(nome)

  await entrar(page, s.email)
  // pela busca, e não pela lista inteira: `/admin/empresas` pagina de vinte em
  // vinte, e o banco de teste guarda mil contas de execuções anteriores
  await page.goto(`/admin/empresas?q=${encodeURIComponent(nome)}`)

  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()

  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeVisible()

  // o sair acompanha em qualquer tela
  await page.goto('/pessoas')
  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeVisible()

  await expect.poll(async () => {
    const { data } = await admin.from('acesso_suporte')
      .select('encerrado_em').eq('conta_id', cliente.contaId).single()
    return data?.encerrado_em
  }).toBeNull()
})

test('sair do suporte encerra o registro e devolve a conta', async ({ page }) => {
  const s = await comoSuporte()
  const nome = `Clínica Nascente ${Date.now()}`
  const cliente = await contaDeTeste(nome)

  await entrar(page, s.email)
  await page.goto(`/admin/empresas?q=${encodeURIComponent(nome)}`)
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair do suporte' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('acesso_suporte')
      .select('encerrado_em').eq('conta_id', cliente.contaId).single()
    return data?.encerrado_em !== null
  }).toBe(true)

  // o vínculo temporário some junto
  const { count } = await admin.from('usuario_conta')
    .select('*', { count: 'exact', head: true })
    .eq('conta_id', cliente.contaId).eq('usuario_id', s.usuarioId)
  expect(count).toBe(0)
})

test('sair do suporte não tira quem é da 4YU', async ({ page }) => {
  const s = await comoSuporte()
  const nome = `Academia Aurora ${Date.now()}`
  await contaDeTeste(nome)

  await entrar(page, s.email)
  await page.goto(`/admin/empresas?q=${encodeURIComponent(nome)}`)
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair do suporte' }).click()
  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeHidden()

  // o vínculo da conta interna é o que faz ser da 4YU: continua de pé
  await page.goto('/admin/empresas')
  await expect(page).toHaveURL(/\/admin\/empresas/)
  const { count } = await admin.from('usuario_conta')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', s.usuarioId).eq('conta_id', s.contaId)
  expect(count).toBe(1)
})

test('a conta da própria 4YU não aparece como cliente', async ({ page }) => {
  const s = await comoSuporte()

  await entrar(page, s.email)
  await page.goto('/admin/empresas')
  await expect(page.getByRole('listitem').filter({ hasText: '4yu' })).toHaveCount(0)
})

test('quem não é da 4YU não alcança a tela de contas', async ({ page }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)

  await entrar(page, email)
  await page.goto('/admin/empresas')
  await expect(page).toHaveURL(/\/hoje/)
})

test('suspender tira o acesso sem apagar dado', async ({ page }) => {
  const s = await comoSuporte()
  const nome = `Barbearia Dom ${Date.now()}`
  const cliente = await contaDeTeste(nome)
  await admin.from('pessoa').insert({ conta_id: cliente.contaId, nome: 'Cliente Antigo' })

  await entrar(page, s.email)
  await page.goto(`/admin/empresas?q=${encodeURIComponent(nome)}`)
  // suspender é ação de menu: não se suspende conta de cliente sem procurar
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: `Ações de ${nome}` })
    .click()
  await page.getByRole('menuitem', { name: 'Suspender empresa' }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('conta').select('ativo').eq('id', cliente.contaId).single()
    return data?.ativo
  }).toBe(false)

  const { count } = await admin.from('pessoa')
    .select('*', { count: 'exact', head: true }).eq('conta_id', cliente.contaId)
  expect(count).toBe(1)
})

test('o log de acesso da 4YU mostra o que ficou em aberto', async ({ page }) => {
  const s = await comoSuporte()
  const nome = `Espaço Movimento ${Date.now()}`
  const cliente = await contaDeTeste(nome)

  await entrar(page, s.email)
  await page.goto(`/admin/empresas?q=${encodeURIComponent(nome)}`)
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeVisible()

  // o log tem página própria na administração, com o e-mail de quem entrou
  await page.goto('/admin/log')
  await expect(
    page.getByRole('listitem').filter({ hasText: nome })
      .filter({ hasText: 'em aberto' }).first(),
  ).toBeVisible()
})

/*
 * O vínculo de suporte que ficou aberto põe o cliente em `/contas`. Escolher a
 * empresa ali é querer entrar nela, como o "Entrar" do admin, e não voltar
 * para a administração e procurar de novo.
 */
test('escolher a empresa na troca de conta entra nela como suporte', async ({ page }) => {
  const s = await comoSuporte()
  const nome = `Studio Lembrado ${Date.now()}`
  const cliente = await contaDeTeste(nome)
  await admin.from('usuario_conta')
    .insert({ usuario_id: s.usuarioId, conta_id: cliente.contaId, papel: 'suporte' })

  await entrar(page, s.email)
  await page.goto('/contas')
  await page.getByRole('button', { name: new RegExp(nome) }).click()

  await expect(page).toHaveURL(/\/semana/)
  await expect(page.getByRole('button', { name: 'Sair do suporte' })).toBeVisible()
  await expect.poll(async () => {
    const { data } = await admin.from('acesso_suporte')
      .select('id').eq('conta_id', cliente.contaId).eq('usuario_id', s.usuarioId)
    return data?.length ?? 0
  }).toBe(1)
})
