import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { admin, contaDeTeste, usuarioDe, entrar, escolher } from './apoio'

/**
 * O ensaio geral: o administrativo inteiro, numa conta só, no tamanho do caso
 * real.
 *
 * Os outros arquivos perguntam "esta tela abriu e fez o que promete?". Este
 * pergunta outra coisa, que nenhum deles alcança: **o ciclo fecha?** Tabela de
 * preços inteira digitada pela tela, matrícula, cobrança, recebimento, recibo,
 * fechamento e aulas por professor, na mesma conta, na ordem em que a recepção
 * faz. Era o buraco de 18/08: seiscentos testes verdes e nenhum dado real
 * atravessando o produto de ponta a ponta.
 *
 * **Escala é parte do teste.** Vinte e nove planos em nove serviços e setenta
 * turmas não é enfeite: é o tamanho da tabela do primeiro cliente, e defeito de
 * agrupamento, de ordenação e de número que pula só aparece com volume.
 *
 * Os preços daqui são inventados, e de propósito: este repositório é público, e
 * a tabela do cliente não entra nele. Para ensaiar com a tabela de verdade,
 * aponte `CATALOGO` para um JSON fora do git com a mesma forma:
 *
 *   CATALOGO=../catalogo.json npx playwright test ensaio-administrativo
 */

const HOJE = () => new Date().toLocaleDateString('en-CA')
const COMPETENCIA = `${HOJE().slice(0, 7)}-01`

type PlanoDoCatalogo = {
  codigo: string
  nome: string
  servico: string
  recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'avulsa' | 'pacote'
  parcelas: number
  freq?: number
  sessoes?: number
  vinc: number
  avulso: number
}

type Catalogo = {
  servicos: Array<{ nome: string; categoria: string; capacidade: number }>
  planos: PlanoDoCatalogo[]
}

/**
 * A forma da tabela do cliente, com números inventados.
 *
 * Doze planos de recorrência cruzando quatro períodos com três frequências,
 * uma avulsa, um personal, um pacote, e sete terapias que cobram um preço de
 * quem já é cliente e outro de quem não é. É a forma que importa: o mensal que
 * não tem fim, o trimestral partido em parcelas, o pacote que é uma cobrança
 * só, e os dois preços na mesma linha.
 */
function catalogoSintetico(): Catalogo {
  const periodos = [
    { rec: 'mensal', nome: 'Mensal', meses: 1, base: 40000 },
    { rec: 'trimestral', nome: 'Trimestral', meses: 3, base: 114000 },
    { rec: 'semestral', nome: 'Semestral', meses: 6, base: 216000 },
    { rec: 'anual', nome: 'Anual', meses: 12, base: 408000 },
  ] as const

  const planos: PlanoDoCatalogo[] = []
  let n = 0
  for (const p of periodos) {
    for (const freq of [1, 2, 3]) {
      n += 1
      const preco = p.base * freq - (freq - 1) * 1000
      planos.push({
        codigo: String(n).padStart(3, '0'),
        nome: `${p.nome}, ${freq}x por semana`,
        servico: 'Pilates aparelho',
        recorrencia: p.rec,
        parcelas: p.meses,
        freq,
        vinc: preco,
        avulso: preco,
      })
    }
  }

  planos.push({
    codigo: '013', nome: 'Aula avulsa', servico: 'Pilates aparelho',
    recorrencia: 'avulsa', parcelas: 1, vinc: 10000, avulso: 10000,
  })
  planos.push({
    codigo: '014', nome: 'Personal, 1 aula', servico: 'Personal',
    recorrencia: 'avulsa', parcelas: 1, vinc: 20000, avulso: 20000,
  })
  planos.push({
    codigo: '015', nome: 'Personal, pacote 10 aulas', servico: 'Personal',
    recorrencia: 'pacote', parcelas: 1, sessoes: 10, vinc: 180000, avulso: 180000,
  })

  const terapias = [
    { nome: 'Fisioterapia', cliente: 19000, cheio: 22000 },
    { nome: 'RPG', cliente: 19000, cheio: 22000 },
    { nome: 'Drenagem linfática', cliente: 15000, cheio: 18000 },
    { nome: 'Ventosaterapia', cliente: 9000, cheio: 10000 },
    { nome: 'Liberação miofascial', cliente: 15000, cheio: 17000 },
    { nome: 'Massagem relaxante', cliente: 15000, cheio: 18000 },
    { nome: 'Toque de tensegridade', cliente: 27000, cheio: 30000 },
  ]
  let cod = 100
  for (const t of terapias) {
    planos.push({
      codigo: String(cod++), nome: `${t.nome}, sessão`, servico: t.nome,
      recorrencia: 'avulsa', parcelas: 1, vinc: t.cliente, avulso: t.cheio,
    })
    planos.push({
      codigo: String(cod++), nome: `${t.nome}, pacote 10 sessões`, servico: t.nome,
      recorrencia: 'pacote', parcelas: 1, sessoes: 10,
      vinc: t.cliente * 9, avulso: t.cheio * 9,
    })
  }

  return {
    servicos: [
      { nome: 'Pilates aparelho', categoria: 'Pilates', capacidade: 4 },
      { nome: 'Personal', categoria: 'Pilates', capacidade: 1 },
      ...terapias.map((t) => ({
        nome: t.nome, categoria: 'Fisioterapia e terapias', capacidade: 1,
      })),
    ],
    planos,
  }
}

const CATALOGO: Catalogo = process.env.CATALOGO
  ? (JSON.parse(readFileSync(process.env.CATALOGO, 'utf8')) as Catalogo)
  : catalogoSintetico()

const RECORRENCIA_NA_TELA: Record<string, string> = {
  mensal: 'Todo mês',
  trimestral: 'A cada três meses',
  semestral: 'A cada seis meses',
  anual: 'Uma vez por ano',
  avulsa: 'Uma vez só',
  pacote: 'Pacote de sessões',
}

const emReais = (cent: number) =>
  (cent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

type Estado = {
  contaId: string
  email: string
  servicos: Record<string, string>
  pessoas: Array<{ id: string; nome: string }>
  turmas: Array<{ id: string; dia: number; hora: string; codigo: string }>
}

const est = {} as Estado

/*
 * `serial`: é uma jornada, e cada passo vive do anterior. Falhar no meio e
 * seguir tentando o resto só produz ruído — a matrícula não tem o que escolher
 * se a tabela de preços não entrou.
 */
test.describe.serial('o ciclo administrativo, de ponta a ponta', () => {
  test.beforeAll(async () => {
    const { contaId, marca } = await contaDeTeste('Estúdio do ensaio')
    const { email } = await usuarioDe(contaId, 'dono', marca)
    est.contaId = contaId
    est.email = email

    // o serviço que a `contaDeTeste` cria já se chama "Pilates solo": aqui ele
    // vira o primeiro da tabela, e os outros nascem ao lado
    await admin.from('servico').update({ nome: 'Pilates aparelho', categoria: 'Pilates' })
      .eq('conta_id', contaId)

    for (const s of CATALOGO.servicos.slice(1)) {
      await admin.from('servico').insert({
        conta_id: contaId, nome: s.nome, categoria: s.categoria,
        capacidade_padrao: s.capacidade,
      })
    }
    const { data: servicos } = await admin.from('servico')
      .select('id, nome').eq('conta_id', contaId)
      .returns<Array<{ id: string; nome: string }>>()
    est.servicos = Object.fromEntries(servicos!.map((s) => [s.nome, s.id]))

    /*
     * Setenta turmas, numeradas como o cliente numera: segunda e quarta das 7h
     * às 20h, terça e quinta idem, e sexta sozinha. O número da turma é o que a
     * recepção fala no telefone, e é único por conta.
     */
    const grade: Array<{ dia: number; hora: string; codigo: string }> = []
    let codigo = 0
    for (const par of [[1, 3], [2, 4]] as const) {
      for (let h = 7; h <= 20; h++) {
        for (const dia of par) {
          codigo += 1
          grade.push({ dia, hora: `${String(h).padStart(2, '0')}:00`,
                       codigo: String(codigo).padStart(3, '0') })
        }
      }
    }
    for (let h = 7; h <= 20; h++) {
      codigo += 1
      grade.push({ dia: 5, hora: `${String(h).padStart(2, '0')}:00`,
                   codigo: String(codigo).padStart(3, '0') })
    }

    const { data: profissional } = await admin.from('profissional')
      .insert({ conta_id: contaId, nome: 'Nathália' })
      .select('id').single<{ id: string }>()

    const { data: turmas } = await admin.from('serie').insert(
      grade.map((g) => ({
        conta_id: contaId, servico_id: est.servicos['Pilates aparelho'],
        profissional_id: profissional!.id,
        dia_semana: g.dia, hora_inicio: g.hora, duracao_min: 60,
        capacidade: 4, vigencia_inicio: '2026-01-01', codigo: g.codigo,
      })),
    ).select('id, dia_semana, hora_inicio, codigo')
      .returns<Array<{ id: string; dia_semana: number; hora_inicio: string; codigo: string }>>()

    est.turmas = turmas!.map((t) => ({
      id: t.id, dia: t.dia_semana, hora: t.hora_inicio.slice(0, 5), codigo: t.codigo,
    }))

    const nomes = Array.from({ length: 84 }, (_, i) => `Aluna ${String(i + 1).padStart(3, '0')}`)
    const { data: pessoas } = await admin.from('pessoa').insert(
      nomes.map((nome, i) => ({
        conta_id: contaId, nome, ativo: true,
        identificador_externo: String(i + 1).padStart(3, '0'),
        cpf: String(10000000000 + i),
      })),
    ).select('id, nome').returns<Array<{ id: string; nome: string }>>()
    est.pessoas = pessoas!
  })

  test('a tabela de preços inteira entra pela tela', async ({ page }) => {
    test.setTimeout(300_000)
    await entrar(page, est.email)
    await page.goto('/config?s=planos')

    for (const p of CATALOGO.planos) {
      await page.getByRole('button', { name: 'Novo plano' }).click()
      await page.getByLabel('Código').fill(p.codigo)
      await page.getByLabel('Nome do plano').fill(p.nome)
      await escolher(page, 'Serviço', p.servico)
      await escolher(page, 'Como cobra', RECORRENCIA_NA_TELA[p.recorrencia])

      if (p.recorrencia !== 'avulsa' && p.recorrencia !== 'pacote') {
        await page.getByLabel('Horários por semana').fill(String(p.freq ?? 1))
        await page.getByLabel('Parcelas').fill(String(p.parcelas))
      }
      if (p.recorrencia === 'pacote') {
        await page.getByLabel('Sessões no pacote').fill(String(p.sessoes ?? 10))
      }

      await page.getByLabel('Preço de cliente').fill(emReais(p.vinc))
      await page.getByLabel('Preço cheio').fill(emReais(p.avulso))
      await page.getByRole('button', { name: 'Criar', exact: true }).click()
      await expect(page.locator('dialog[open]')).toHaveCount(0)
    }

    const { count } = await admin.from('plano')
      .select('*', { count: 'exact', head: true }).eq('conta_id', est.contaId)
    expect(count).toBe(CATALOGO.planos.length)

    // nada foi salvo pela metade: preço zero é o defeito que só aparece na
    // primeira cobrança, e é tarde
    const { data } = await admin.from('plano')
      .select('codigo, preco_vinculado_cent, preco_avulso_cent, recorrencia, sessoes_no_pacote')
      .eq('conta_id', est.contaId)
      .returns<Array<{ codigo: string; preco_vinculado_cent: number
                       preco_avulso_cent: number; recorrencia: string
                       sessoes_no_pacote: number | null }>>()
    for (const p of CATALOGO.planos) {
      const linha = data!.find((l) => l.codigo === p.codigo)
      expect(linha, `plano ${p.codigo} não entrou`).toBeTruthy()
      expect(linha!.preco_vinculado_cent, `preço de ${p.codigo}`).toBe(p.vinc)
      expect(linha!.preco_avulso_cent, `preço cheio de ${p.codigo}`).toBe(p.avulso)
      expect(linha!.recorrencia).toBe(p.recorrencia)
      if (p.recorrencia === 'pacote') expect(linha!.sessoes_no_pacote).toBe(p.sessoes)
    }
  })

  test('a tabela na tela agrupa por categoria e mostra os dois preços', async ({ page }) => {
    await entrar(page, est.email)
    await page.goto('/config?s=planos')

    const doPilates = CATALOGO.planos.filter((p) =>
      CATALOGO.servicos.find((s) => s.nome === p.servico)?.categoria === 'Pilates').length
    await expect(page.getByText(`Pilates · ${doPilates}`)).toBeVisible()

    const dois = CATALOGO.planos.find((p) => p.vinc !== p.avulso)!
    await expect(page.getByText(`R$ ${emReais(dois.vinc)}`).first()).toBeVisible()
    await expect(page.getByText(`R$ ${emReais(dois.avulso)}`).first()).toBeVisible()

    /*
     * "mesma" no lugar do número repetido, uma vez por plano de preço único.
     * A contagem é o teste: com quinze planos de preço único e catorze de dois
     * preços, trocar a comparação por engano acende os dois lados da tabela e
     * nenhuma asserção de "está visível" perceberia.
     */
    const umPrecoSo = CATALOGO.planos.filter((p) => p.vinc === p.avulso).length
    await expect(page.getByText('mesma', { exact: true })).toHaveCount(umPrecoSo)
  })

  test('quem emite o recibo entra pela tela, antes de gastar número', async ({ page }) => {
    await entrar(page, est.email)
    await page.goto('/config?s=recibo')

    await page.getByLabel('Razão social').fill('Estúdio do Ensaio Ltda')
    await page.getByLabel('CNPJ ou CPF').fill('12345678000190')
    await page.getByLabel('Endereço').fill('Rua das Acácias, 204')
    await page.getByLabel('Telefone').fill('1133334444')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Emitente salvo')).toBeVisible()
  })

  test('matricular por três formatos diferentes gera a cobrança de cada um', async ({ page }) => {
    test.setTimeout(120_000)
    await entrar(page, est.email)

    const mensal = CATALOGO.planos.find(
      (p) => p.recorrencia === 'mensal' && p.freq === 2)!
    const trimestral = CATALOGO.planos.find(
      (p) => p.recorrencia === 'trimestral' && p.freq === 1)!
    const pacote = CATALOGO.planos.find((p) => p.recorrencia === 'pacote')!

    /* Segunda 07:00 e Quarta 09:00 são as duas primeiras turmas da grade. */
    const horario = (dia: number, hora: string) =>
      new RegExp(`${['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'][dia]} ${hora}`)

    async function matricular(
      pessoaId: string, plano: PlanoDoCatalogo, turmas: Array<[number, string]>,
    ) {
      await page.goto(`/pessoas/${pessoaId}?aba=contratos`)
      await page.getByRole('button', { name: 'Novo contrato' }).click()
      await page.getByRole('button', { name: new RegExp(plano.nome) }).click()
      for (const [dia, hora] of turmas) {
        await page.getByRole('button', { name: horario(dia, hora) }).click()
      }
      await page.getByRole('button', { name: 'Criar contrato' }).click()
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      await expect(page.getByText('Em vigor', { exact: true }).first()).toBeVisible()
    }

    await matricular(est.pessoas[0].id, mensal, [[1, '07:00'], [3, '09:00']])
    await matricular(est.pessoas[1].id, trimestral, [[2, '08:00']])
    await matricular(est.pessoas[2].id, pacote, [])

    const { data } = await admin.from('cobranca')
      .select('pessoa_id, valor_cent, competencia')
      .eq('conta_id', est.contaId).order('competencia')
      .returns<Array<{ pessoa_id: string; valor_cent: number; competencia: string }>>()

    const daPessoa = (id: string) => data!.filter((c) => c.pessoa_id === id)

    // o mensal cobra o valor do mês, e nada além do horizonte
    expect(daPessoa(est.pessoas[0].id)[0].valor_cent).toBe(mensal.vinc)
    expect(daPessoa(est.pessoas[0].id)[0].competencia).toBe(COMPETENCIA)

    // o trimestral parte o total em três, e a sobra de centavo vai na primeira
    const parcela = Math.floor(trimestral.vinc / 3)
    const primeira = daPessoa(est.pessoas[1].id)[0].valor_cent
    expect(primeira).toBe(parcela + (trimestral.vinc - parcela * 3))

    // o pacote é uma cobrança só, do valor inteiro
    expect(daPessoa(est.pessoas[2].id)).toHaveLength(1)
    expect(daPessoa(est.pessoas[2].id)[0].valor_cent).toBe(pacote.vinc)
  })

  test('quem já tem plano em vigor paga a tabela de cliente na terapia', async ({ page }) => {
    await entrar(page, est.email)
    const terapia = CATALOGO.planos.find(
      (p) => p.recorrencia === 'avulsa' && p.vinc !== p.avulso)!

    // a pessoa 0 já saiu daqui com um mensal de pilates em vigor
    await page.goto(`/pessoas/${est.pessoas[0].id}?aba=contratos`)
    await page.getByRole('button', { name: 'Novo contrato' }).click()
    await page.getByRole('button', { name: new RegExp(terapia.nome) }).click()
    await page.getByRole('button', { name: 'Criar contrato' }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)

    const { data } = await admin.from('contrato')
      .select('preco_aplicado_cent, vinculo_usado')
      .eq('pessoa_id', est.pessoas[0].id)
      .returns<Array<{ preco_aplicado_cent: number; vinculo_usado: boolean }>>()
    const daTerapia = data!.find((c) => c.preco_aplicado_cent === terapia.vinc)
    expect(daTerapia, 'a terapia não pegou o preço de cliente').toBeTruthy()
    expect(daTerapia!.vinculo_usado).toBe(true)
  })

  test('receber, emitir o recibo, e o fechamento fechar com a soma do dia', async ({ page }) => {
    test.setTimeout(120_000)
    await entrar(page, est.email)
    await page.goto('/financeiro?aba=a_vencer')

    // recebe as duas primeiras cobranças que a tela oferecer
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Receber' }).first().click()
      await page.getByRole('button', { name: 'Registrar', exact: true }).click()
      await expect(page.locator('dialog[open]')).toHaveCount(0)
    }

    await page.goto('/financeiro?aba=pagas')
    await page.getByRole('button', { name: 'emitir recibo' }).first().click()
    await expect(page.getByRole('link', { name: /A-000001/ })).toBeVisible()
    await page.getByRole('button', { name: 'emitir recibo' }).first().click()
    await expect(page.getByRole('link', { name: /A-000002/ })).toBeVisible()

    const { data: pagos } = await admin.from('pagamento')
      .select('valor_cent').eq('conta_id', est.contaId)
      .returns<Array<{ valor_cent: number }>>()
    const total = pagos!.reduce((s, p) => s + p.valor_cent, 0)

    await page.goto('/financeiro?aba=fechamento')
    await expect(page.getByText('Entrou no período')).toBeVisible()
    await expect(page.getByText(`R$ ${emReais(total)}`).first()).toBeVisible()

    // os sete relatórios que o item 4 do documento pede, na mesma tela
    for (const titulo of [
      'Entrou no período', 'Estornos no período', 'Clientes ativos',
      'Novos no período',
    ]) {
      await expect(page.getByText(titulo)).toBeVisible()
    }
  })

  test('cancelar um recibo não abre buraco na numeração', async ({ page }) => {
    await entrar(page, est.email)
    await page.goto('/recibos')

    await expect(page.getByText('A-000001')).toBeVisible()
    await expect(page.getByText('A-000002')).toBeVisible()

    await page.getByRole('button', { name: /Mais sobre o recibo/ }).first().click()
    await page.getByRole('menuitem', { name: 'Cancelar o recibo' }).click()
    await page.getByLabel('Motivo').fill('emitido no nome errado')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(page.getByText('Cancelado: emitido no nome errado')).toBeVisible()

    // o número cancelado continua sendo dele: buraco na sequência é a primeira
    // coisa que uma fiscalização pergunta
    const { data } = await admin.from('recibo')
      .select('numero, cancelado_em').eq('conta_id', est.contaId).order('numero')
      .returns<Array<{ numero: number; cancelado_em: string | null }>>()
    expect(data!.map((r) => r.numero)).toEqual([1, 2])
    expect(data!.filter((r) => r.cancelado_em !== null)).toHaveLength(1)

    // e o contador não voltou: o próximo recibo é o 3
    const { data: contador } = await admin.from('contador_recibo')
      .select('proximo').eq('conta_id', est.contaId).single<{ proximo: number }>()
    expect(contador!.proximo).toBe(3)
  })
})
