import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, entrar, usuarioDe } from './apoio'

/** Uma conta recém-criada e uma pessoa que nunca entrou: a primeira entrada. */
async function primeiraVez(papel = 'dono') {
  const base = await contaDeTeste('Estúdio recém-nascido')
  const { email, usuarioId } = await usuarioDe(
    base.contaId, papel, base.marca, { pularOnboarding: false },
  )
  return { ...base, email, usuarioId }
}

test('as boas-vindas abrem por cima do sistema, não no lugar dele', async ({ page }) => {
  const c = await primeiraVez()
  await entrar(page, c.email)

  // o produto carrega atrás: o trilho e o nome do negócio estão lá
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).first())
    .toBeVisible()
  await expect(page.getByText('Estúdio recém-nascido').first()).toBeVisible()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: /A semana inteira em uma tela/ }))
    .toBeVisible()
})

test('vale para quem entra direto numa tela, como pelo link de um e-mail', async ({ page }) => {
  const c = await primeiraVez()
  await entrar(page, c.email)
  await page.goto('/pessoas')
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('escolher o tipo de negócio muda o texto de todas as telas', async ({ page }) => {
  const c = await primeiraVez()
  await entrar(page, c.email)

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Próxima' }).click()
  }

  await expect(page.getByRole('heading', { name: /Como o seu negócio chama/ }))
    .toBeVisible()
  await page.getByRole('button', { name: /Saúde e terapias/ }).click()
  await page.getByRole('button', { name: 'Começar' }).click()

  // o vocabulário chega no trilho, que é o que a pessoa vê primeiro
  await expect(page.getByRole('link', { name: 'Pacientes' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect.poll(async () => {
    const { data } = await admin.from('vocabulario')
      .select('singular').eq('conta_id', c.contaId).eq('chave', 'pessoa').maybeSingle()
    return (data as { singular: string } | null)?.singular
  }).toBe('Paciente')
})

test('pular é definitivo: ninguém é perguntado duas vezes', async ({ page }) => {
  const c = await primeiraVez()
  await entrar(page, c.email)

  await page.getByRole('button', { name: 'Pular' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/semana')
  await expect(page.getByRole('heading', { name: /A semana inteira em uma tela/ }))
    .toHaveCount(0)
})

test('a visita guiada leva a pessoa pelas telas, e para quando pedem', async ({ page }) => {
  const c = await primeiraVez()
  await entrar(page, c.email)
  await page.getByRole('button', { name: 'Pular' }).click()

  // a visita começa na tela de trabalho, e é ela que navega
  await expect(page.getByText('Passo 1 de 15')).toBeVisible()
  await expect(page).toHaveURL(/\/hoje/)
  await expect(page.getByRole('heading', { name: 'Esta é a sua tela de trabalho' }))
    .toBeVisible()

  // passa pelo menu antes de sair de /hoje, e só então muda de tela
  for (let n = 0; n < 4; n++) {
    await page.getByRole('button', { name: 'Próxima' }).click()
  }
  await expect(page).toHaveURL(/\/semana/)
  await expect(page.getByText('Passo 5 de 15')).toBeVisible()

  // dá para voltar sem perder o lugar
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByText('Passo 4 de 15')).toBeVisible()

  await page.getByRole('button', { name: 'Pular' }).click()
  await expect(page.getByText(/Passo \d+ de 15/)).toHaveCount(0)

  await expect.poll(async () => {
    const { data } = await admin.from('onboarding')
      .select('pulado_em').eq('usuario_id', c.usuarioId)
      .eq('roteiro', 'primeiros-passos').maybeSingle()
    return (data as { pulado_em: string | null } | null)?.pulado_em != null
  }).toBe(true)
})

test('quem só opera não é ensinado a mexer na configuração', async ({ page }) => {
  const c = await primeiraVez('recepcao')
  await entrar(page, c.email)

  // recepção não escolhe as palavras da conta: são quatro cartões, sem o tipo
  await expect(page.getByText('1 de 4')).toBeVisible()

  await page.getByRole('button', { name: 'Pular' }).click()
  // a visita dela é mais curta, e nenhum passo leva à configuração
  await expect(page.getByText('Passo 1 de 11')).toBeVisible()
})

test('conta que já opera não recebe apontamento de conta nova', async ({ page }) => {
  const c = await primeiraVez()
  await admin.from('serie').insert({
    conta_id: c.contaId, servico_id: c.servicoId, profissional_id: c.profissionalId,
    local_id: c.localId, dia_semana: 1, hora_inicio: '07:00', duracao_min: 60,
    capacidade: 4, vigencia_inicio: '2026-01-01', ativo: true,
  })

  await entrar(page, c.email)
  await page.getByRole('button', { name: 'Pular' }).click()

  // as boas-vindas valem sempre; "monte o primeiro horário" não vale para quem
  // já montou
  await expect(page.getByText(/Passo \d de \d/)).toHaveCount(0)
})
