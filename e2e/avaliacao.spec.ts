import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar } from './apoio'

/**
 * A jornada do acompanhamento por foto, pela tela.
 *
 * O que este arquivo cobre e nenhum outro cobre: que a aba existe para quem
 * atende e **não existe** para a recepção, e que registrar uma visita aparece
 * na matriz. A pergunta é sempre "abriu, e fez o que prometeu?", que é a lição
 * que a suíte aprendeu em 16/08.
 */
test('quem atende registra uma avaliação e ela aparece na matriz', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio da avaliação')
  const { email } = await usuarioDe(contaId, 'dono', marca)

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Marina ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa!.id}?aba=avaliacao`)

  await expect(page.getByText('Acompanhamento por foto')).toBeVisible()
  await expect(page.getByText('Nenhuma avaliação ainda')).toBeVisible()

  await page.getByRole('button', { name: 'Nova avaliação' }).click()
  await expect(page.getByText('Nova avaliação', { exact: true }).last()).toBeVisible()

  // as seis posições de partida nascem na primeira abertura da aba
  await expect(page.getByText('Flexão de coluna')).toBeVisible()

  await page.getByRole('button', { name: 'Registrar' }).click()

  // não navegar logo depois de clicar: a ação roda numa transição, e sair da
  // página no meio testa o estado anterior
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('A avaliação')).toBeVisible()
})

test('a recepção não enxerga a aba, e nem a rota direta', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio sem recepção na foto')
  const { email } = await usuarioDe(contaId, 'recepcao', marca)

  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Renata ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa!.id}`)

  await expect(page.getByRole('link', { name: 'Avaliação' })).toHaveCount(0)

  // a rota direta também não mostra nada: a barreira não é só a aba escondida
  await page.goto(`/pessoas/${pessoa!.id}?aba=avaliacao`)
  await expect(page.getByText('Acompanhamento por foto')).toHaveCount(0)
})
