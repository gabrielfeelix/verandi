import { test, expect, type Page } from '@playwright/test'
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

/**
 * O defeito que trouxe estes testes: a foto do celular tem 3 a 12 MB, e o
 * envio morria no teto de 1 MB da requisição, antes de qualquer validação
 * nossa. Nada era salvo, e o erro chegava como 500 sem texto.
 */

/** Um PNG de ruído, que não comprime: é o jeito de ter arquivo pesado de verdade. */
async function fotoPesada(page: Page, lado: number) {
  return page.evaluate((lado) => {
    const tela = document.createElement('canvas')
    tela.width = lado
    tela.height = Math.round(lado * 0.75)
    const p = tela.getContext('2d')!
    const pixels = p.createImageData(tela.width, tela.height)
    // `getRandomValues` só entrega 64 KB por chamada: o ruído sai de uma
    // semente repetida com deslocamento, que basta para o PNG não comprimir
    const semente = new Uint8Array(65536)
    crypto.getRandomValues(semente)
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = semente[(i * 3 + 1) % 65536]
      pixels.data[i + 1] = semente[(i * 5 + 7) % 65536]
      pixels.data[i + 2] = semente[(i * 11 + 13) % 65536]
      pixels.data[i + 3] = 255
    }
    p.putImageData(pixels, 0, 0)

    return new Promise<{ tamanho: number; base64: string }>((pronto) => {
      tela.toBlob((bloco) => {
        // base64, e não array de números: um PNG de 13 MB vira 13 milhões de
        // elementos no processo do teste, e o worker morre por falta de memória
        const leitor = new FileReader()
        leitor.onload = () => pronto({
          tamanho: bloco!.size,
          base64: String(leitor.result).split(',')[1],
        })
        leitor.readAsDataURL(bloco!)
      }, 'image/png')
    })
  }, lado)
}

async function abrirNovaAvaliacao(page: Page, nome: string) {
  const { contaId, marca } = await contaDeTeste(nome)
  const { email } = await usuarioDe(contaId, 'dono', marca)
  const { data: pessoa } = await admin.from('pessoa')
    .insert({ conta_id: contaId, nome: `Bruna ${marca}`, ativo: true })
    .select('id').single<{ id: string }>()

  await entrar(page, email)
  await page.goto(`/pessoas/${pessoa!.id}?aba=avaliacao`)
  await page.getByRole('button', { name: 'Nova avaliação' }).click()
  await expect(page.getByText('Flexão de coluna')).toBeVisible()
  return { contaId }
}

test('foto pesada é reduzida no navegador e a avaliação salva', async ({ page }) => {
  const { contaId } = await abrirNovaAvaliacao(page, 'Estúdio da foto pesada')

  const pesada = await fotoPesada(page, 1200)
  // acima do teto antigo da requisição, que é o que fazia o envio morrer
  expect(pesada.tamanho).toBeGreaterThan(1024 * 1024)

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'costas.png', mimeType: 'image/png',
    buffer: Buffer.from(pesada.base64, 'base64'),
  })

  // a prévia só aparece depois de reduzir, e é o sinal de que deu para enviar
  await expect(page.getByText('Desfazer a escolha')).toBeVisible()

  await page.getByRole('button', { name: 'Registrar', exact: true }).click()

  await expect.poll(async () => {
    const { data } = await admin.from('avaliacao_foto').select('path')
      .eq('conta_id', contaId)
    return data?.length ?? 0
  }, { timeout: 20_000 }).toBe(1)

  await expect(page.getByRole('heading', { name: 'A avaliação', exact: true }))
    .toBeVisible()
})

test('acima do limite a tela diz o tamanho, e o arquivo não vai junto', async ({ page }) => {
  await abrirNovaAvaliacao(page, 'Estúdio da foto grande demais')

  const enorme = await fotoPesada(page, 2400)
  expect(enorme.tamanho).toBeGreaterThan(10 * 1024 * 1024)

  const campo = page.locator('input[type=file]').first()
  await campo.setInputFiles({
    name: 'costas.png', mimeType: 'image/png',
    buffer: Buffer.from(enorme.base64, 'base64'),
  })

  // o tamanho da foto dela, e não só o do limite: é o que responde "por quanto
  // passou?" para quem precisa decidir o que fazer
  await expect(page.getByText(/Esta foto tem 1\d,\d MB, e o limite é 10 MB/)).toBeVisible()

  // recusar sem limpar o campo é o pior dos dois mundos: a tela avisa, e o
  // arquivo sobe assim mesmo no envio seguinte
  expect(await campo.evaluate((c: HTMLInputElement) => c.files?.length ?? 0)).toBe(0)
})

test('posição nova aparece na hora em que é adicionada', async ({ page }) => {
  await abrirNovaAvaliacao(page, 'Estúdio da posição nova')

  await page.getByLabel('Outra posição').fill('Perfil direito')
  await page.getByRole('button', { name: 'Adicionar' }).click()

  // entrar no banco não basta: sem revalidar, quem acabou de criar conclui que
  // o botão não funcionou e clica de novo, e aí recebe erro de nome repetido
  await expect(page.getByText('Perfil direito').first()).toBeVisible()
})
