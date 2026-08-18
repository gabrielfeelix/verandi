import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

/**
 * O que só o banco responde: o número que não se repete e não pula, mesmo com
 * dois balcões clicando ao mesmo tempo, e o cancelado que continua ocupando o
 * lugar dele na sequência.
 *
 * A alocação é testada pela função, e não pelo `insert`: `select max + 1` no
 * aplicativo passaria neste teste rodando sozinho e falharia no balcão.
 */
describe('recibo no banco', () => {
  const db = admin()
  let contaId: string, pessoaId: string, cobrancaId: string, pagamentoId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio do recibo', slug: `rec-${m}` }).select().single()
    contaId = c!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Marina Ferraz', identificador_externo: '042' })
      .select().single()
    pessoaId = p!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates aparelho' }).select().single()

    const { data: pl } = await db.from('plano').insert({
      conta_id: contaId, servico_id: s!.id, codigo: '002', nome: 'Mensal 2x',
      recorrencia: 'mensal', preco_vinculado_cent: 73500, preco_avulso_cent: 73500,
    }).select().single()

    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: pl!.id,
      inicio: '2026-09-01', preco_aplicado_cent: 73500,
    }).select().single()

    const { data: cob } = await db.from('cobranca').insert({
      conta_id: contaId, contrato_id: ct!.id, pessoa_id: pessoaId,
      competencia: '2026-09-01', vencimento: '2026-09-05', valor_cent: 73500,
    }).select().single()
    cobrancaId = cob!.id

    const { data: pg } = await db.from('pagamento').insert({
      conta_id: contaId, cobranca_id: cobrancaId, valor_cent: 73500,
      forma: 'pix', recebido_em: '2026-09-05',
    }).select().single()
    pagamentoId = pg!.id
  })

  it('a série começa em 1 e anda de um em um', async () => {
    const { cliente } = await comoUsuario(`rec-dono-${Date.now()}@dev.local`)
    await db.from('usuario_conta').insert({
      usuario_id: (await cliente.auth.getUser()).data.user!.id,
      conta_id: contaId, papel: 'dono',
    })

    const um = await cliente.rpc('proximo_numero_recibo', {
      p_conta: contaId, p_serie: 'A',
    })
    const dois = await cliente.rpc('proximo_numero_recibo', {
      p_conta: contaId, p_serie: 'A',
    })
    expect(um.data).toBe(1)
    expect(dois.data).toBe(2)
  })

  it('dois balcões ao mesmo tempo não recebem o mesmo número', async () => {
    const { cliente } = await comoUsuario(`rec-recep-${Date.now()}@dev.local`)
    await db.from('usuario_conta').insert({
      usuario_id: (await cliente.auth.getUser()).data.user!.id,
      conta_id: contaId, papel: 'recepcao',
    })

    // dez pedidos disparados juntos: com `select max + 1` no aplicativo, alguns
    // voltariam iguais, e o defeito só apareceria com dois papéis na mão
    const numeros = await Promise.all(Array.from({ length: 10 }, () =>
      cliente.rpc('proximo_numero_recibo', { p_conta: contaId, p_serie: 'A' })
        .then((r) => r.data as number)))

    expect(new Set(numeros).size).toBe(10)
    // e sem buraco: de 3 a 12, porque o teste anterior já tirou 1 e 2
    expect([...numeros].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 3))
  })

  it('quem não é da conta não aloca número nenhum', async () => {
    const { cliente } = await comoUsuario(`rec-forasteiro-${Date.now()}@dev.local`)
    const { error } = await cliente.rpc('proximo_numero_recibo', {
      p_conta: contaId, p_serie: 'A',
    })
    expect(error?.message).toContain('sem acesso')
  })

  it('o número cancelado continua ocupado, e o corpo fica congelado', async () => {
    const corpo = {
      pessoa: 'Marina Ferraz', matricula: '042', valor: 'setecentos e trinta e cinco reais',
    }
    const { data: r, error } = await db.from('recibo').insert({
      conta_id: contaId, serie: 'A', numero: 90, pagamento_id: pagamentoId,
      pessoa_id: pessoaId, valor_cent: 73500, corpo,
    }).select().single()
    expect(error).toBeNull()

    // cancelar sem motivo é recusado pelo banco: o número fica ocupado, e
    // alguém vai perguntar por quê
    const semMotivo = await db.from('recibo')
      .update({ status: 'cancelado' }).eq('id', r!.id)
    expect(semMotivo.error).not.toBeNull()

    await db.from('recibo').update({
      status: 'cancelado', motivo: 'valor errado', cancelado_em: new Date().toISOString(),
    }).eq('id', r!.id)

    // o mesmo número não volta a ser usado na mesma versão
    const repetido = await db.from('recibo').insert({
      conta_id: contaId, serie: 'A', numero: 90, pagamento_id: pagamentoId,
      pessoa_id: pessoaId, valor_cent: 10000, corpo,
    })
    expect(repetido.error?.code).toBe('23505')

    const { data: depois } = await db.from('recibo')
      .select('corpo, status').eq('id', r!.id).single()
    expect(depois!.corpo).toEqual(corpo)
    expect(depois!.status).toBe('cancelado')
  })

  it('a correção é versão nova do mesmo número', async () => {
    const { data: v2, error } = await db.from('recibo').insert({
      conta_id: contaId, serie: 'A', numero: 90, versao: 2,
      pagamento_id: pagamentoId, pessoa_id: pessoaId, valor_cent: 73500,
      corpo: { pessoa: 'Marina Ferraz Silva' }, motivo: 'nome incompleto',
    }).select().single()
    expect(error).toBeNull()
    expect(v2!.numero).toBe(90)
    expect(v2!.versao).toBe(2)
  })

  it('o recibo sobrevive ao apagar do pagamento e da pessoa', async () => {
    // é a razão de ele existir: o documento contábil não some junto com o que
    // ele descreve. Ver a guarda de cinco anos, no plano 13.
    await db.from('pagamento').delete().eq('id', pagamentoId)

    const { data } = await db.from('recibo')
      .select('id, pagamento_id, corpo').eq('conta_id', contaId).eq('numero', 90)
    expect(data!.length).toBe(2)
    expect(data!.every((r) => r.pagamento_id === null)).toBe(true)
    expect(data![0].corpo).toBeTruthy()
  })
})

/**
 * O relatório que faltava dos sete: recibos emitidos e cancelados no período.
 *
 * Emitido conta pela emissão, cancelado conta pelo cancelamento: o recibo de
 * março cancelado em abril é um cancelamento de abril, e quem fechou março já
 * conferiu aquele número.
 */
describe('recibos do período', () => {
  const db = admin()
  let contaId: string, pessoaId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio do relatório', slug: `rel-${m}` }).select().single()
    contaId = c!.id
    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Joana Prado' }).select().single()
    pessoaId = p!.id

    const corpo = { pagadorNome: 'Joana Prado' }
    /*
     * As três linhas com as mesmas chaves de propósito: num `insert` em lote, o
     * PostgREST usa as colunas da primeira linha e manda `null` explícito nas
     * que faltarem nas outras. Omitir `status` numa e escrevê-lo noutra derruba
     * o `not null` da tabela, e o erro fala de coluna nula sem dizer por quê.
     */
    const semeado = await db.from('recibo').insert([
      { conta_id: contaId, serie: 'A', numero: 1, pessoa_id: pessoaId,
        valor_cent: 45000, corpo, emitido_em: '2026-03-10T12:00:00Z',
        status: 'valido', motivo: null, cancelado_em: null },
      { conta_id: contaId, serie: 'A', numero: 2, pessoa_id: pessoaId,
        valor_cent: 73500, corpo, emitido_em: '2026-04-05T12:00:00Z',
        status: 'valido', motivo: null, cancelado_em: null },
      { conta_id: contaId, serie: 'A', numero: 3, pessoa_id: pessoaId,
        valor_cent: 20000, corpo, emitido_em: '2026-03-20T12:00:00Z',
        status: 'cancelado', motivo: 'valor errado',
        cancelado_em: '2026-04-02T12:00:00Z' },
    ])
    if (semeado.error) throw semeado.error
  })

  it('conta o emitido pela emissão e o cancelado pelo cancelamento', async () => {
    const { recibosDoPeriodo } = await import('../src/server/recibo/consultas')

    const marco = await recibosDoPeriodo(db, contaId, '2026-03-01', '2026-03-31')
    expect(marco).toEqual({
      emitidos: 2, emitidoCent: 65000, cancelados: 0, canceladoCent: 0,
    })

    const abril = await recibosDoPeriodo(db, contaId, '2026-04-01', '2026-04-30')
    expect(abril).toEqual({
      emitidos: 1, emitidoCent: 73500, cancelados: 1, canceladoCent: 20000,
    })
  })

  it('a busca acha pelo número e pelo nome de quem pagou', async () => {
    const { listarRecibos } = await import('../src/server/recibo/consultas')

    const porNumero = await listarRecibos(db, contaId, { busca: '2' })
    expect(porNumero.linhas.map((r) => r.numero)).toEqual([2])

    // o nome vem de dentro do corpo congelado, e não de uma junção com a ficha:
    // quem pediu exclusão continua nomeado no documento contábil
    const porNome = await listarRecibos(db, contaId, { busca: 'Joana' })
    expect(porNome.total).toBe(3)
  })

  it('a lista de cancelados é o relatório que o documento pede', async () => {
    const { listarRecibos } = await import('../src/server/recibo/consultas')
    const r = await listarRecibos(db, contaId, { filtro: 'cancelados' })
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].motivo).toBe('valor errado')
  })
})
