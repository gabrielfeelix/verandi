import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'

/**
 * O que só o banco responde: a cobrança que não nasce duas vezes, o pago que é
 * somado e não guardado, e o estorno que sai da conta sem sair da tabela.
 *
 * A regra de quais competências um contrato deve não está aqui de propósito:
 * é regra de produto, e mora em `tests/unit/financeiro.test.ts`.
 */
describe('financeiro no banco', () => {
  const db = admin()
  let contaId: string, pessoaId: string, contratoId: string, cobrancaId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio do caixa', slug: `fin-${m}` }).select().single()
    contaId = c!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Marina Ferraz' }).select().single()
    pessoaId = p!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates aparelho' }).select().single()

    const { data: pl } = await db.from('plano').insert({
      conta_id: contaId, servico_id: s!.id, codigo: '002',
      nome: 'Mensal, 2x por semana', recorrencia: 'mensal',
      frequencia_semanal: 2, preco_vinculado_cent: 73500,
      preco_avulso_cent: 73500,
    }).select().single()

    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: pl!.id,
      inicio: '2026-09-01', dia_vencimento: 5, preco_aplicado_cent: 73500,
    }).select().single()
    contratoId = ct!.id
  })

  it('a mesma competência não nasce duas vezes no mesmo contrato', async () => {
    const linha = {
      conta_id: contaId, contrato_id: contratoId, pessoa_id: pessoaId,
      competencia: '2026-09-01', vencimento: '2026-09-05', valor_cent: 73500,
    }
    const { data, error } = await db.from('cobranca').insert(linha)
      .select().single()
    expect(error).toBeNull()
    cobrancaId = data!.id

    // a segunda abertura da tela materializa de novo, e o banco recusa: sem
    // isto, abrir duas abas cobra duas vezes
    expect((await db.from('cobranca').insert(linha)).error?.code).toBe('23505')
  })

  it('sem pagamento a situação é aberta, e o pago é zero', async () => {
    const { data } = await db.from('cobranca_resumo')
      .select('situacao, valor_pago_cent').eq('id', cobrancaId).single()
    expect(data!.situacao).toBe('aberta')
    expect(data!.valor_pago_cent).toBe(0)
  })

  it('pagamento parcial soma, e a situação diz parcial', async () => {
    const { error } = await db.from('pagamento').insert({
      conta_id: contaId, cobranca_id: cobrancaId, valor_cent: 30000,
      forma: 'pix', recebido_em: '2026-09-03',
    })
    expect(error).toBeNull()

    const { data } = await db.from('cobranca_resumo')
      .select('situacao, valor_pago_cent').eq('id', cobrancaId).single()
    expect(data!.valor_pago_cent).toBe(30000)
    expect(data!.situacao).toBe('parcial')
  })

  it('o resto fecha a cobrança, e as duas datas continuam existindo', async () => {
    await db.from('pagamento').insert({
      conta_id: contaId, cobranca_id: cobrancaId, valor_cent: 43500,
      forma: 'dinheiro', recebido_em: '2026-09-20',
    })

    const { data } = await db.from('cobranca_resumo')
      .select('situacao, valor_pago_cent').eq('id', cobrancaId).single()
    expect(data!.situacao).toBe('paga')

    // o caixa do dia 3 e o do dia 20 são consultas diferentes, e as duas
    // precisam achar a linha delas
    const { data: linhas } = await db.from('pagamento')
      .select('recebido_em').eq('cobranca_id', cobrancaId).order('recebido_em')
    expect(linhas!.map((l) => l.recebido_em)).toEqual(['2026-09-03', '2026-09-20'])
  })

  it('estorno tira da soma sem tirar da tabela, e exige motivo', async () => {
    const { data: pg } = await db.from('pagamento')
      .select('id').eq('cobranca_id', cobrancaId).eq('valor_cent', 30000).single()

    const semMotivo = await db.from('pagamento')
      .update({ estornado_em: new Date().toISOString() }).eq('id', pg!.id)
    expect(semMotivo.error).not.toBeNull()

    await db.from('pagamento').update({
      estornado_em: new Date().toISOString(), motivo_estorno: 'digitado em dobro',
    }).eq('id', pg!.id)

    const { data } = await db.from('cobranca_resumo')
      .select('situacao, valor_pago_cent').eq('id', cobrancaId).single()
    expect(data!.valor_pago_cent).toBe(43500)
    expect(data!.situacao).toBe('parcial')

    // a linha continua lá: o fechamento de ontem não muda de valor sozinho
    const { count } = await db.from('pagamento')
      .select('id', { count: 'exact', head: true }).eq('cobranca_id', cobrancaId)
    expect(count).toBe(2)
  })

  it('cancelada vence a soma: cobrança cancelada não conta como paga', async () => {
    await db.from('cobranca').update({
      status: 'cancelada', motivo_cancelamento: 'contrato encerrado em 20/09',
    }).eq('id', cobrancaId)

    const { data } = await db.from('cobranca_resumo')
      .select('situacao').eq('id', cobrancaId).single()
    expect(data!.situacao).toBe('cancelada')
  })

  it('apagar o contrato é recusado enquanto houver cobrança dele', async () => {
    // cobrança órfã é dívida que ninguém sabe de onde veio
    const { error } = await db.from('contrato').delete().eq('id', contratoId)
    expect(error?.code).toBe('23503')
  })
})

/**
 * A materialização, que é o coração do módulo: ela roda em toda abertura de
 * tela, e errar aqui cobra duas vezes de quem já pagou.
 *
 * Não passa pelas Server Actions de propósito: o que se prova é a regra sobre o
 * banco, e ação de tela precisa de sessão, cookie e papel, que são outra
 * pergunta e já têm teste próprio.
 */
const hojeDeVerdade = () => new Date().toISOString().slice(0, 10)

describe('a materialização das cobranças', () => {
  const db = admin()
  let contaId: string, pessoaId: string, planoId: string, contratoId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio da materialização', slug: `mat-${m}` })
      .select().single()
    contaId = c!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Joana Prado' }).select().single()
    pessoaId = p!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()

    const { data: pl } = await db.from('plano').insert({
      conta_id: contaId, servico_id: s!.id, codigo: '010',
      nome: 'Mensal, 1x por semana', recorrencia: 'mensal',
      frequencia_semanal: 1, preco_vinculado_cent: 45000,
      preco_avulso_cent: 45000,
    }).select().single()
    planoId = pl!.id

    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-01-10', dia_vencimento: 5, preco_aplicado_cent: 45000,
      // o contrato entrou no sistema no dia em que começou: é o caso comum, e
      // é o que faz as datas fixas deste teste continuarem valendo
      criado_em: '2026-01-10T09:00:00Z',
    }).select().single()
    contratoId = ct!.id
  })

  it('cria do começo do contrato até o mês seguinte ao aberto, e nada além', async () => {
    const { materializarCobrancas } = await import('../src/server/financeiro/materializar')
    const criadas = await materializarCobrancas(db, contaId, '2026-03-12')
    expect(criadas).toBe(4)

    const { data } = await db.from('cobranca')
      .select('competencia, vencimento, valor_cent')
      .eq('contrato_id', contratoId).order('competencia')
    expect(data!.map((c) => c.competencia))
      .toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'])
    // a primeira não vence antes de o contrato começar
    expect(data![0].vencimento).toBe('2026-01-10')
  })

  it('contrato antigo digitado hoje não nasce devendo o ano inteiro', async () => {
    const { materializarCobrancas } = await import('../src/server/financeiro/materializar')
    // o MGM vai digitar as matrículas em curso com a data real de início; sem
    // a régua, a primeira tela que a recepção abre acusa todo mundo de caloteiro
    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2025-02-01', dia_vencimento: 5, preco_aplicado_cent: 45000,
    }).select().single()

    await materializarCobrancas(db, contaId, hojeDeVerdade(), ct!.id)

    const { data } = await db.from('cobranca').select('competencia')
      .eq('contrato_id', ct!.id).order('competencia')
    const mesDoCadastro = `${hojeDeVerdade().slice(0, 7)}-01`
    expect(data!.length).toBeLessThanOrEqual(2)
    expect(data![0].competencia).toBe(mesDoCadastro)
  })

  it('a segunda passada não cria nada, e é o caso comum', async () => {
    const { materializarCobrancas } = await import('../src/server/financeiro/materializar')
    expect(await materializarCobrancas(db, contaId, '2026-03-12')).toBe(0)
  })

  /*
   * A aluna que chega querendo pagar até dezembro não tinha o que pagar: as
   * cobranças de dois meses à frente não existiam, e a recepção só conseguia
   * receber o mês corrente e o seguinte. Abrir mais é um pedido, e não uma
   * mudança de regra: o padrão continua sendo um mês.
   */
  it('antecipar abre os meses pedidos, e só do contrato pedido', async () => {
    const { materializarCobrancas } = await import('../src/server/financeiro/materializar')

    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-03-01', dia_vencimento: 10, preco_aplicado_cent: 45000,
      criado_em: '2026-03-01T09:00:00Z',
    }).select().single()

    await materializarCobrancas(db, contaId, '2026-03-12', ct!.id, 5)

    const { data } = await db.from('cobranca').select('competencia, vencimento')
      .eq('contrato_id', ct!.id).order('competencia')
    expect(data!.map((c) => c.competencia)).toEqual([
      '2026-03-01', '2026-04-01', '2026-05-01',
      '2026-06-01', '2026-07-01', '2026-08-01',
    ])
    // o vencimento continua sendo o que o contrato manda, e não a data de hoje
    expect(data![1].vencimento).toBe('2026-04-10')

    // o contrato do vizinho não ganhou mês nenhum
    const { data: outro } = await db.from('cobranca').select('competencia')
      .eq('contrato_id', contratoId).order('competencia', { ascending: false })
    expect(outro![0].competencia).toBe('2026-04-01')
  })

  it('antecipar duas vezes não cria a mesma competência de novo', async () => {
    const { materializarCobrancas } = await import('../src/server/financeiro/materializar')
    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-03-01', dia_vencimento: 10, preco_aplicado_cent: 45000,
      criado_em: '2026-03-01T09:00:00Z',
    }).select().single()

    expect(await materializarCobrancas(db, contaId, '2026-03-12', ct!.id, 3)).toBe(4)
    expect(await materializarCobrancas(db, contaId, '2026-03-12', ct!.id, 3)).toBe(0)
  })

  it('trancar cancela o mês que já tinha nascido à frente, e retomar reabre', async () => {
    const { sincronizarCobrancas } = await import('../src/server/financeiro/materializar')

    // a licença começa em março e ainda não tem volta marcada: abril inteiro
    // cai dentro dela
    const { data: pausa } = await db.from('pausa').insert({
      conta_id: contaId, contrato_id: contratoId, inicio: '2026-03-20',
    }).select().single()
    await db.from('contrato').update({ status: 'pausado' }).eq('id', contratoId)
    await sincronizarCobrancas(db, contaId, contratoId, '2026-03-20')

    const abril = async () => (await db.from('cobranca')
      .select('status, motivo_cancelamento')
      .eq('contrato_id', contratoId).eq('competencia', '2026-04-01').single()).data!

    expect((await abril()).status).toBe('cancelada')
    expect((await abril()).motivo_cancelamento).toBe('licença do contrato')

    // março fica: o mês em que a licença começou foi entregue pela metade, e
    // proporcional é decisão comercial do estúdio
    const { data: marco } = await db.from('cobranca').select('status')
      .eq('contrato_id', contratoId).eq('competencia', '2026-03-01').single()
    expect(marco!.status).toBe('aberta')

    await db.from('pausa').update({ fim: '2026-04-10' }).eq('id', pausa!.id)
    await db.from('contrato').update({ status: 'ativo' }).eq('id', contratoId)
    await sincronizarCobrancas(db, contaId, contratoId, '2026-04-10')

    expect((await abril()).status).toBe('aberta')
    expect((await abril()).motivo_cancelamento).toBeNull()
  })

  it('cancelamento escrito à mão não é reaberto pela sincronização', async () => {
    const { sincronizarCobrancas } = await import('../src/server/financeiro/materializar')
    await db.from('cobranca').update({
      status: 'cancelada', motivo_cancelamento: 'cortesia de aniversário',
    }).eq('contrato_id', contratoId).eq('competencia', '2026-02-01')

    await sincronizarCobrancas(db, contaId, contratoId, '2026-04-10')

    const { data } = await db.from('cobranca').select('status')
      .eq('contrato_id', contratoId).eq('competencia', '2026-02-01').single()
    expect(data!.status).toBe('cancelada')
  })

  it('encerrar cancela o que ainda não venceu, e deixa a dívida velha de pé', async () => {
    const { cancelarCobrancasFuturas } = await import('../src/server/financeiro/materializar')
    await cancelarCobrancasFuturas(db, contaId, contratoId, '2026-03-31')

    const { data } = await db.from('cobranca')
      .select('competencia, status').eq('contrato_id', contratoId)
      .order('competencia')
    const porMes = Object.fromEntries(data!.map((c) => [c.competencia, c.status]))
    // janeiro venceu e não foi pago: quem saiu devendo continua devendo
    expect(porMes['2026-01-01']).toBe('aberta')
    expect(porMes['2026-04-01']).toBe('cancelada')
  })

  it('o log aceita as entidades do financeiro, e as dos módulos 15 e 16', async () => {
    // a lista permitida parou na 0048, e por isso nenhuma criação de plano ou
    // de contrato foi registrada desde 18/08: o insert falhava e `registrar`
    // não olha o erro
    for (const entidade of ['plano', 'contrato', 'cobranca', 'pagamento']) {
      const { error } = await db.from('log_configuracao')
        .insert({ conta_id: contaId, entidade, acao: 'criou' })
      expect(error, entidade).toBeNull()
    }
  })
})
