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

  // `exact`: a ficha tem "Registrar renovação", e sem isso o nome casa com os dois
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()

  // não navegar logo depois de clicar: a ação roda numa transição, e sair da
  // página no meio testa o estado anterior. Esperar o estado vazio sumir é o
  // sinal de que a revalidação chegou, e não só de que o modal fechou.
  await expect(page.getByText('Nenhuma avaliação ainda')).toHaveCount(0)

  // por papel e texto exato: "A avaliação" casa por pedaço com o nome da conta,
  // com o botão e com o rótulo do campo de data
  await expect(page.getByRole('heading', { name: 'A avaliação', exact: true }))
    .toBeVisible()

  // a coluna da matriz nasce com a data de hoje, que é o padrão do campo
  const d = new Date()
  const hoje = `${String(d.getDate()).padStart(2, '0')}/${
    String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
  await expect(page.getByText(hoje).first()).toBeVisible()
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
