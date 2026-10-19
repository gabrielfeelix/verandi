import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

/**
 * Financeiro com papel no banco (0084_vr).
 *
 * Antes, qualquer membro da conta gravava em plano, contrato, cobrança,
 * pagamento e recibo pela Data API, com o próprio login: quem barrava o
 * profissional era só a tela. Aqui o banco barra sozinho.
 */
describe('papel no financeiro', () => {
  const a = admin()
  let contaId: string
  let pessoaId: string
  let servicoId: string
  let planoId: string
  let contratoId: string
  let cobrancaId: string
  let dono: Awaited<ReturnType<typeof comoUsuario>>
  let recepcao: Awaited<ReturnType<typeof comoUsuario>>
  let profissional: Awaited<ReturnType<typeof comoUsuario>>

  beforeAll(async () => {
    const m = `${Date.now()}-fin`
    const { data: c } = await a.from('conta')
      .insert({ nome: 'Estúdio do caixa', slug: `fin-${m}` }).select().single()
    contaId = c!.id

    dono = await comoUsuario(`dono-${m}@teste.local`)
    recepcao = await comoUsuario(`recepcao-${m}@teste.local`)
    profissional = await comoUsuario(`prof-${m}@teste.local`)
    await a.from('usuario_conta').insert([
      { usuario_id: dono.usuarioId, conta_id: contaId, papel: 'dono' },
      { usuario_id: recepcao.usuarioId, conta_id: contaId, papel: 'recepcao' },
      { usuario_id: profissional.usuarioId, conta_id: contaId, papel: 'profissional' },
    ])

    const { data: p } = await a.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Marina Ferraz' }).select().single()
    pessoaId = p!.id
    const { data: s } = await a.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates', duracao_min: 50 }).select().single()
    servicoId = s!.id
    const { data: pl } = await a.from('plano').insert({
      conta_id: contaId, servico_id: servicoId, codigo: '001', nome: 'Mensal',
      recorrencia: 'mensal', preco_vinculado_cent: 50000, preco_avulso_cent: 50000,
    }).select().single()
    planoId = pl!.id
    const { data: ct } = await a.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-09-01', preco_aplicado_cent: 50000,
    }).select().single()
    contratoId = ct!.id
    const { data: cob } = await a.from('cobranca').insert({
      conta_id: contaId, contrato_id: contratoId, pessoa_id: pessoaId,
      competencia: '2026-09-01', vencimento: '2026-09-05', valor_cent: 50000,
    }).select().single()
    cobrancaId = cob!.id
  })

  it('profissional segue lendo contrato e cobrança', async () => {
    const { data: contratos } = await profissional.cliente.from('contrato').select('id')
    const { data: cobrancas } = await profissional.cliente.from('cobranca').select('id')
    expect(contratos!.map((l) => l.id)).toContain(contratoId)
    expect(cobrancas!.map((l) => l.id)).toContain(cobrancaId)
  })

  it('profissional não dá baixa em cobrança', async () => {
    const { error } = await profissional.cliente.from('pagamento').insert({
      conta_id: contaId, cobranca_id: cobrancaId, valor_cent: 50000,
      forma: 'pix', recebido_em: '2026-09-05',
    })
    expect(error?.code).toBe('42501')
  })

  it('profissional não muda valor de cobrança nem de contrato', async () => {
    const { data: cob } = await profissional.cliente.from('cobranca')
      .update({ valor_cent: 1 }).eq('id', cobrancaId).select('id')
    const { data: ct } = await profissional.cliente.from('contrato')
      .update({ preco_aplicado_cent: 1 }).eq('id', contratoId).select('id')
    expect(cob).toEqual([])
    expect(ct).toEqual([])
    const { data } = await a.from('cobranca').select('valor_cent').eq('id', cobrancaId).single()
    expect(data!.valor_cent).toBe(50000)
  })

  it('profissional não cria contrato', async () => {
    const { error } = await profissional.cliente.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-10-01', preco_aplicado_cent: 1,
    })
    expect(error?.code).toBe('42501')
  })

  it('recepção não mexe em preço de plano', async () => {
    const { error } = await recepcao.cliente.from('plano').insert({
      conta_id: contaId, servico_id: servicoId, codigo: '002', nome: 'Barato',
      recorrencia: 'mensal', preco_vinculado_cent: 1, preco_avulso_cent: 1,
    })
    expect(error?.code).toBe('42501')
    const { data } = await recepcao.cliente.from('plano')
      .update({ preco_vinculado_cent: 1 }).eq('id', planoId).select('id')
    expect(data).toEqual([])
  })

  it('recepção opera o caixa', async () => {
    const { error } = await recepcao.cliente.from('pagamento').insert({
      conta_id: contaId, cobranca_id: cobrancaId, valor_cent: 20000,
      forma: 'pix', recebido_em: '2026-09-05',
    })
    expect(error).toBeNull()
  })

  it('dono muda plano', async () => {
    const { data, error } = await dono.cliente.from('plano')
      .update({ nome: 'Mensal 2x' }).eq('id', planoId).select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })
})
