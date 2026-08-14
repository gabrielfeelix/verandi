import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, contaInterna, entrar, usuarioDe } from './apoio'

/** Alguém com papel de suporte na conta interna — é assim que a 4YU existe. */
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
  await page.goto('/contas-4yu')

  await page.getByRole('button', { name: 'Nova conta' }).click()
  await page.getByLabel('Nome do negócio').fill('Studio Aurora')
  await page.getByLabel('Identificador').fill(slug)
  await page.getByLabel('E-mail do dono').fill(`dono-${slug}@teste.local`)
  await page.getByRole('button', { name: 'Criar conta' }).click()

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
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-dono-1')
  await page.getByLabel('Repita a senha').fill('senha-do-dono-1')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL(/\/entrar/)

  const { data: vinculo } = await admin.from('usuario_conta')
    .select('papel').eq('conta_id', conta!.id).single()
  expect(vinculo!.papel).toBe('dono')
})

test('entrar como suporte mostra a faixa que não some, e registra', async ({ page }) => {
  const s = await comoSuporte()
  // nome único: o banco não é limpo entre execuções, e nome repetido torna o
  // seletor ambíguo na segunda rodada
  const nome = `Studio do Cliente ${Date.now()}`
  const cliente = await contaDeTeste(nome)

  await entrar(page, s.email)
  await page.goto('/contas-4yu')

  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()

  await expect(page.getByText(/como suporte da 4YU/)).toBeVisible()

  // a faixa acompanha em qualquer tela
  await page.goto('/pessoas')
  await expect(page.getByText(/como suporte da 4YU/)).toBeVisible()

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
  await page.goto('/contas-4yu')
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByText(/como suporte da 4YU/)).toBeVisible()

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
  await page.goto('/contas-4yu')
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByText(/como suporte da 4YU/)).toBeVisible()

  await page.getByRole('button', { name: 'Sair do suporte' }).click()
  await expect(page.getByText(/como suporte da 4YU/)).toBeHidden()

  // o vínculo da conta interna é o que faz ser da 4YU: continua de pé
  await page.goto('/contas-4yu')
  await expect(page).toHaveURL(/\/contas-4yu/)
  const { count } = await admin.from('usuario_conta')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', s.usuarioId).eq('conta_id', s.contaId)
  expect(count).toBe(1)
})

test('a conta da própria 4YU não aparece como cliente', async ({ page }) => {
  const s = await comoSuporte()

  await entrar(page, s.email)
  await page.goto('/contas-4yu')
  await expect(page.getByRole('listitem').filter({ hasText: '4yu' })).toHaveCount(0)
})

test('quem não é da 4YU não alcança a tela de contas', async ({ page }) => {
  const base = await contaDeTeste()
  const { email } = await usuarioDe(base.contaId, 'dono', base.marca)

  await entrar(page, email)
  await page.goto('/contas-4yu')
  await expect(page).toHaveURL(/\/hoje/)
})

test('suspender tira o acesso sem apagar dado', async ({ page }) => {
  const s = await comoSuporte()
  const nome = `Barbearia Dom ${Date.now()}`
  const cliente = await contaDeTeste(nome)
  await admin.from('pessoa').insert({ conta_id: cliente.contaId, nome: 'Cliente Antigo' })

  await entrar(page, s.email)
  await page.goto('/contas-4yu')
  // suspender é ação de menu: não se suspende conta de cliente sem procurar
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: `Ações de ${nome}` })
    .click()
  await page.getByRole('menuitem', { name: 'Suspender conta' }).click()

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
  await page.goto('/contas-4yu')
  await page.getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByText(/como suporte da 4YU/)).toBeVisible()

  await page.goto('/contas-4yu')

  // o log é modal: ele conta o que a 4YU fez, e não é o que se lê todo dia
  await page.getByRole('button', { name: 'Log de suporte' }).click()
  const log = page.getByRole('dialog')
  await expect(
    log.getByRole('listitem').filter({ hasText: nome })
      .filter({ hasText: 'em aberto' }).first(),
  ).toBeVisible()
})
