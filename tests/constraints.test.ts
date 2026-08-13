import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'

describe('as constraints de que o modelo depende', () => {
  const a = admin()
  let contaId: string, serieId: string, servicoId: string, pessoaId: string
  let sessaoId: string

  beforeAll(async () => {
    const marca = Date.now()
    const { data: c } = await a.from('conta')
      .insert({ nome: 'C', slug: `c-${marca}` }).select().single()
    contaId = c!.id

    const { data: s } = await a.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()
    servicoId = s!.id

    const { data: se } = await a.from('serie').insert({
      conta_id: contaId, servico_id: servicoId, dia_semana: 1,
      hora_inicio: '07:00', duracao_min: 60, capacidade: 4,
      vigencia_inicio: '2026-03-01',
    }).select().single()
    serieId = se!.id

    const { data: p } = await a.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Helena' }).select().single()
    pessoaId = p!.id

    const { data: ss } = await a.from('sessao').insert({
      conta_id: contaId, serie_id: serieId, servico_id: servicoId,
      inicio: '2026-08-10T10:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()
    sessaoId = ss!.id
  })

  it('a mesma série no mesmo instante não duplica', async () => {
    const { error } = await a.from('sessao').insert({
      conta_id: contaId, serie_id: serieId, servico_id: servicoId,
      inicio: '2026-08-10T10:00:00Z', duracao_min: 60, capacidade: 4,
    })
    expect(error?.code).toBe('23505')
  })

  it('duas sessões avulsas no mesmo instante são permitidas', async () => {
    const um = await a.from('sessao').insert({
      conta_id: contaId, serie_id: null, servico_id: servicoId,
      inicio: '2026-08-11T10:00:00Z', duracao_min: 60, capacidade: 1,
    })
    const dois = await a.from('sessao').insert({
      conta_id: contaId, serie_id: null, servico_id: servicoId,
      inicio: '2026-08-11T10:00:00Z', duracao_min: 60, capacidade: 1,
    })
    expect(um.error).toBeNull()
    expect(dois.error).toBeNull()
  })

  it('a mesma pessoa duas vezes na mesma sessão é recusada', async () => {
    const um = await a.from('participacao').insert({
      conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoaId,
      origem: 'recorrente',
    })
    expect(um.error).toBeNull()

    const dois = await a.from('participacao').insert({
      conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoaId,
      origem: 'encaixe',
    })
    expect(dois.error?.code).toBe('23505')
  })

  it('o BANCO não conta participação — a regra de lotação mora no core', async () => {
    // Lotada é lotada, mas quem impede é `core/encaixe` + a ação de servidor,
    // nunca um gatilho. Gatilho quebraria a importação: no histórico há
    // sessões que de fato tiveram mais gente do que a capacidade nominal, e
    // reescrever isso para caber num limite seria mentir sobre o passado.
    for (let i = 0; i < 5; i++) {
      const { data: p } = await a.from('pessoa')
        .insert({ conta_id: contaId, nome: `Histórico ${i}` }).select().single()
      const { error } = await a.from('participacao').insert({
        conta_id: contaId, sessao_id: sessaoId, pessoa_id: p!.id,
        origem: 'encaixe',
      })
      expect(error).toBeNull()
    }
    const { count } = await a.from('participacao')
      .select('*', { count: 'exact', head: true }).eq('sessao_id', sessaoId)
    expect(count).toBe(6)
  })

  it('a capacidade da sessão é editável sem tocar na série', async () => {
    // é assim que o profissional abre vaga: sobe a capacidade daquele dia
    const { error } = await a.from('sessao')
      .update({ capacidade: 6 }).eq('id', sessaoId)
    expect(error).toBeNull()

    const { data: serie } = await a.from('serie')
      .select('capacidade').eq('id', serieId).single()
    expect(serie?.capacidade).toBe(4) // a grade fixa continua 4
  })

  it('a reposição aponta para a falta que a gerou', async () => {
    const { data: falta } = await a.from('participacao')
      .select('id').eq('sessao_id', sessaoId).eq('pessoa_id', pessoaId).single()

    const { data: outra } = await a.from('sessao').insert({
      conta_id: contaId, serie_id: null, servico_id: servicoId,
      inicio: '2026-08-13T10:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()

    const { data, error } = await a.from('participacao').insert({
      conta_id: contaId, sessao_id: outra!.id, pessoa_id: pessoaId,
      origem: 'reposicao', reposicao_de_id: falta!.id,
    }).select().single()

    expect(error).toBeNull()
    expect(data?.reposicao_de_id).toBe(falta!.id)
  })
})
