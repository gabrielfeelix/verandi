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
