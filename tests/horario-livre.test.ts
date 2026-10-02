import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { encaixarNaSessao, type Carimbo } from '@/server/agenda/encaixe'
import { segundaDaSemana } from '@/core/contratos/horario-livre'

/**
 * Plano de horário livre: o contrato não ocupa a grade, e o encaixe é quem
 * segura o limite da semana. Terça e quarta passam; a terceira da mesma semana
 * é recusada; a da semana seguinte volta a passar.
 */
describe('horário livre', () => {
  const db = admin()
  let contaId: string, pessoaId: string
  const sessoes: Record<string, string> = {}
  const carimbo: Carimbo = {
    registrado_por_usuario_id: null,
    registrado_por_origem: 'recepcao',
    registrado_em: new Date().toISOString(),
  }

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Academia livre', slug: `hl-${m}` }).select().single()
    contaId = c!.id
    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Rafael Boxe' }).select().single()
    pessoaId = p!.id
    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Boxe' }).select().single()
    const { data: pl } = await db.from('plano').insert({
      conta_id: contaId, servico_id: s!.id, codigo: '010',
      nome: 'Mensal 2x semana livre', recorrencia: 'mensal',
      frequencia_semanal: 2, horario_livre: true,
      preco_vinculado_cent: 20000, preco_avulso_cent: 20000,
    }).select().single()
    const { error } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: pl!.id,
      inicio: '2026-01-01', preco_aplicado_cent: 20000, vinculo_usado: false,
    })
    if (error) throw error

    // semana de 04 a 10/out/2027: terça 15h, quarta 19h, sexta 12h; e a segunda seguinte
    for (const [nome, inicio] of [
      ['ter', '2027-10-05T18:00:00Z'], ['qua', '2027-10-06T22:00:00Z'],
      ['sex', '2027-10-08T15:00:00Z'], ['seg', '2027-10-11T18:00:00Z'],
    ]) {
      const { data: se, error: e } = await db.from('sessao').insert({
        conta_id: contaId, servico_id: s!.id, inicio, duracao_min: 60, capacidade: 8,
      }).select('id').single()
      if (e) throw e
      sessoes[nome] = se!.id
    }
  })

  const marcar = (nome: string, passarDoLimite = false) => encaixarNaSessao(
    db, contaId, carimbo, { sessaoId: sessoes[nome], pessoaId, origem: 'avulso', passarDoLimite })

  it('duas na semana passam, e a aula fica no contrato', async () => {
    expect((await marcar('ter')).ok).toBe(true)
    expect((await marcar('qua')).ok).toBe(true)
    const { data } = await db.from('participacao').select('contrato_id').eq('pessoa_id', pessoaId)
    expect(data!.every((p) => p.contrato_id !== null)).toBe(true)
  })

  it('a terceira da mesma semana é recusada, com o limite', async () => {
    const r = await marcar('sex')
    expect(r).toMatchObject({ ok: false, motivo: 'limite_da_semana', limite: 2 })
  })

  it('a semana seguinte começa do zero', async () => {
    expect((await marcar('seg')).ok).toBe(true)
  })

  it('a recepção pode passar do limite, de propósito', async () => {
    expect((await marcar('sex', true)).ok).toBe(true)
  })

  it('plano de terça e quinta recusa a sexta, e aceita a quinta', async () => {
    const { data: s2 } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Funcional' }).select().single()
    const { data: pl2 } = await db.from('plano').insert({
      conta_id: contaId, servico_id: s2!.id, codigo: '011',
      nome: 'Terça e quinta', recorrencia: 'mensal',
      frequencia_semanal: 2, horario_livre: true, dias_permitidos: [2, 4],
      preco_vinculado_cent: 15000, preco_avulso_cent: 15000,
    }).select().single()
    await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: pl2!.id,
      inicio: '2026-01-01', preco_aplicado_cent: 15000, vinculo_usado: false,
    })
    const nova = async (inicio: string) => (await db.from('sessao').insert({
      conta_id: contaId, servico_id: s2!.id, inicio, duracao_min: 60, capacidade: 8,
    }).select('id').single()).data!.id
    const sexta = await nova('2027-10-08T18:00:00Z')
    const quinta = await nova('2027-10-07T22:00:00Z')
    const r = await encaixarNaSessao(db, contaId, carimbo,
      { sessaoId: sexta, pessoaId, origem: 'avulso' })
    expect(r).toMatchObject({ ok: false, motivo: 'dia_nao_permitido', dias: [2, 4] })
    expect((await encaixarNaSessao(db, contaId, carimbo,
      { sessaoId: quinta, pessoaId, origem: 'avulso' })).ok).toBe(true)
  })

  it('a semana começa na segunda', () => {
    expect(segundaDaSemana('2027-10-10')).toBe('2027-10-04')
    expect(segundaDaSemana('2027-10-11')).toBe('2027-10-11')
  })
})
