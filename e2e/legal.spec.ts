import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'
import { VERSAO } from '../src/core/legal'

/**
 * Termos e privacidade são públicos, e é isso que estes testes prendem.
 *
 * O defeito que eles existem para pegar é silencioso: basta alguém reorganizar
 * a lista de rotas públicas do `proxy.ts` e a política de privacidade passa a
 * redirecionar para a tela de entrar. Nada quebra, nenhum teste de produto
 * reclama, e o documento continua "publicado" para quem já está logado, que é
 * exatamente quem não precisa dele.
 */

test('sem sessão, os dois documentos abrem', async ({ page }) => {
  await page.goto('/privacidade')
  await expect(page).toHaveURL(/\/privacidade$/)
  await expect(
    page.getByRole('heading', { name: 'Política de privacidade', level: 1 }),
  ).toBeVisible()

  await page.goto('/termos')
  await expect(page).toHaveURL(/\/termos$/)
  await expect(page.getByRole('heading', { name: 'Termos de uso', level: 1 })).toBeVisible()
})

test('a política separa os dois papéis com todas as letras', async ({ page }) => {
  await page.goto('/privacidade')
  // a frase que estrutura o produto: quem coletou o dado foi o cliente
  await expect(page.getByText('a 4YU é operadora').first()).toBeVisible()
  await expect(page.getByText('a 4YU é controladora').first()).toBeVisible()
})

test('quem está do lado de fora chega aos documentos pelo rodapé', async ({ page }) => {
  await page.goto('/entrar')
  // `exact` porque a frase de aceite, logo acima, tem "Política de privacidade"
  await page.getByRole('link', { name: 'Privacidade', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Política de privacidade', level: 1 }),
  ).toBeVisible()
})

test('o sumário leva à seção', async ({ page }) => {
  await page.goto('/termos')
  await page.getByRole('link', { name: /Encerramento/ }).first().click()
  await expect(page).toHaveURL(/#encerramento$/)
})

test('entrar registra o aceite, com a versão que estava no ar', async ({ page }) => {
  /*
   * O teste que importa desta leva inteira. "A pessoa aceitou" sem registro é
   * afirmação; com versão, data e endereço, é prova. E é aqui que se pega o
   * defeito silencioso: o registro falha de propósito sem derrubar o login, o
   * que significa que ninguém descobriria pela tela que ele parou de gravar.
   */
  const marca = `aceite-${Date.now()}`
  const conta = await contaDeTeste(`Aceite ${marca}`)
  const dono = await usuarioDe(conta.contaId, 'dono', marca)

  await entrar(page, dono.email)

  await expect
    .poll(async () => {
      const { data } = await admin
        .from('aceite_de_termos')
        .select('documento, versao, origem')
        .eq('usuario_id', dono.usuarioId)
        .order('documento')
      return data ?? []
    })
    .toEqual([
      { documento: 'privacidade', versao: VERSAO, origem: 'entrada' },
      { documento: 'termos', versao: VERSAO, origem: 'entrada' },
    ])

  const { data } = await admin
    .from('aceite_de_termos')
    .select('ip, aceito_em')
    .eq('usuario_id', dono.usuarioId)
    .limit(1)
    .single()
  expect(data?.ip).toBeTruthy()
  expect(data?.aceito_em).toBeTruthy()
})

test('a frase de aceite fica junto do botão, não escondida no rodapé', async ({ page }) => {
  await page.goto('/entrar')
  const frase = page.getByText('Ao entrar, você concorda com os')
  await expect(frase).toBeVisible()
  await expect(frase.getByRole('link', { name: 'Termos de uso' })).toBeVisible()
})

test('a documentação da API é pública, e mostra as rotas de escrita', async ({ page }) => {
  /*
   * Pública porque quem decide se dá para integrar faz isso antes de ter conta.
   * O teste prende as duas pontas: a rota não pede login, e a página realmente
   * descreve o que a Fase 3 entregou.
   */
  await page.goto('/api-docs')
  await expect(page).toHaveURL(/\/api-docs$/)
  await expect(page.getByRole('heading', { name: 'API da Verandi', level: 1 })).toBeVisible()

  await expect(page.getByText('POST', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('/participacoes', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Idempotency-Key').first()).toBeVisible()
})
