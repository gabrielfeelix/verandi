import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { listarPessoas, fichaDaPessoa, semAcento } from '@/server/pessoas/consultas'
import { horariosLivres, comoPontoEVirgula } from '@/server/agenda/disponibilidade'

describe('busca e filtros de pessoa', () => {
  const db = admin()
  let contaId: string
  let comAcento: string, semFone: string, semVaga: string, inativa: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `pes-${m}` }).select().single()
    contaId = c!.id

    const { data: servico } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()
    const { data: serie } = await db.from('serie').insert({
      conta_id: contaId, servico_id: servico!.id, dia_semana: 1,
      hora_inicio: '07:00', duracao_min: 60, capacidade: 4,
      vigencia_inicio: '2026-01-01',
    }).select().single()

    // `ativo` em TODAS as linhas: no insert em lote o PostgREST normaliza as
    // linhas para o mesmo conjunto de colunas e preenche o que faltar com
    // NULL — o default da coluna não é aplicado
    const { data: ps, error: erroPessoas } = await db.from('pessoa').insert([
      { conta_id: contaId, nome: 'Emília Gonçalves', telefone: '11999990000', ativo: true },
      { conta_id: contaId, nome: 'Otávio Prado', telefone: null, ativo: true },
      { conta_id: contaId, nome: 'Beatriz Nogueira', telefone: '11988880000', ativo: true },
      { conta_id: contaId, nome: 'Rafael Antigo', telefone: null, ativo: false },
    ]).select('id, nome')
    if (erroPessoas) throw erroPessoas
    comAcento = ps![0].id
    semFone = ps![1].id
    semVaga = ps![2].id
    inativa = ps![3].id

    // Emília e Otávio têm horário fixo; Beatriz não
    await db.from('vaga').insert([
      { conta_id: contaId, serie_id: serie!.id, pessoa_id: comAcento, inicio: '2026-01-01' },
      { conta_id: contaId, serie_id: serie!.id, pessoa_id: semFone, inicio: '2026-01-01' },
    ])
  })

  it('a busca é tolerante a acento', async () => {
    expect(semAcento('Emília Gonçalves')).toBe('emilia goncalves')
    const r = (await listarPessoas(db, contaId, { busca: 'emilia' })).linhas
    expect(r.map((p) => p.nome)).toEqual(['Emília Gonçalves'])
  })

  it('a busca aceita nome parcial e ignora caixa', async () => {
    const r = (await listarPessoas(db, contaId, { busca: 'NOGUE' })).linhas
    expect(r.map((p) => p.nome)).toEqual(['Beatriz Nogueira'])
  })

  it('inativa some do padrão e aparece no filtro dela', async () => {
    const padrao = (await listarPessoas(db, contaId, {})).linhas
    expect(padrao.map((p) => p.id)).not.toContain(inativa)

    const so = (await listarPessoas(db, contaId, { filtros: ['inativa'] })).linhas
    expect(so.map((p) => p.id)).toEqual([inativa])
  })

  it('filtra quem não tem telefone', async () => {
    const r = (await listarPessoas(db, contaId, { filtros: ['sem_telefone'] })).linhas
    expect(r.map((p) => p.id)).toEqual([semFone])
  })

  it('filtra quem não tem horário fixo', async () => {
    const r = (await listarPessoas(db, contaId, { filtros: ['sem_horario_fixo'] })).linhas
    expect(r.map((p) => p.id)).toEqual([semVaga])
  })

  it('os filtros combinam', async () => {
    const r = (await listarPessoas(db, contaId, {
      filtros: ['sem_telefone', 'sem_horario_fixo'],
    })).linhas
    expect(r).toEqual([])
  })

  it('a ficha traz vagas e conta reposição em aberto', async () => {
    const { data: sessao } = await db.from('sessao').insert({
      conta_id: contaId,
      servico_id: (await db.from('servico').select('id').eq('conta_id', contaId).limit(1).single()).data!.id,
      inicio: '2026-08-03T10:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()

    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: sessao!.id, pessoa_id: comAcento,
      origem: 'recorrente', status: 'falta',
    })

    const f = await fichaDaPessoa(db, contaId, comAcento)
    expect(f!.vagas).toHaveLength(1)
    expect(f!.reposicoesAbertas).toHaveLength(1)
  })

  it('a falta some das reposições em aberto quando é reposta', async () => {
    const antes = await fichaDaPessoa(db, contaId, comAcento)
    const falta = antes!.reposicoesAbertas[0]

    const { data: outra } = await db.from('sessao').insert({
      conta_id: contaId,
      servico_id: (await db.from('servico').select('id').eq('conta_id', contaId).limit(1).single()).data!.id,
      inicio: '2026-08-10T10:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()

    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: outra!.id, pessoa_id: comAcento,
      origem: 'reposicao', status: 'esperada', reposicao_de_id: falta.id,
    })

    const depois = await fichaDaPessoa(db, contaId, comAcento)
    expect(depois!.reposicoesAbertas).toHaveLength(0)
  })

  it('encerrar a vaga não apaga o passado', async () => {
    const antes = await fichaDaPessoa(db, contaId, comAcento)
    const quantasNoHistorico = antes!.historico.length + antes!.proximas.length

    await db.from('vaga').update({ fim: '2026-07-31' })
      .eq('pessoa_id', comAcento)

    const depois = await fichaDaPessoa(db, contaId, comAcento)
    expect(depois!.historico.length + depois!.proximas.length).toBe(quantasNoHistorico)
    expect(depois!.vagas[0].fim).toBe('2026-07-31')
  })

  it('pessoa de outra conta não aparece', async () => {
    const { data: outra } = await db.from('conta')
      .insert({ nome: 'Outra', slug: `outra-${Date.now()}` }).select().single()
    await db.from('pessoa').insert({ conta_id: outra!.id, nome: 'Intrusa' })

    const r = (await listarPessoas(db, contaId, { busca: 'intrusa' })).linhas
    expect(r).toEqual([])
  })
})

describe('disponibilidade', () => {
  const db = admin()
  let contaId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `disp-${m}`, fuso: 'America/Sao_Paulo' })
      .select().single()
    contaId = c!.id

    const { data: servico } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()

    // segunda 07h com 1 vaga, quarta 10h com 2
    const { data: series } = await db.from('serie').insert([
      { conta_id: contaId, servico_id: servico!.id, dia_semana: 1,
        hora_inicio: '07:00', duracao_min: 60, capacidade: 1,
        vigencia_inicio: '2026-01-01' },
      { conta_id: contaId, servico_id: servico!.id, dia_semana: 3,
        hora_inicio: '10:00', duracao_min: 60, capacidade: 2,
        vigencia_inicio: '2026-01-01' },
    ]).select()

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Helena' }).select().single()

    // ocupa a única vaga da segunda
    await db.from('vaga').insert({
      conta_id: contaId, serie_id: series![0].id, pessoa_id: p!.id, inicio: '2026-01-01',
    })
  })

  it('cheio NÃO entra na lista de livres', async () => {
    const { livres, cheios } = await horariosLivres(db, contaId, {
      de: '2026-08-03', ate: '2026-08-09',
    })
    expect(livres.map((s) => s.hora)).toEqual(['10:00'])
    expect(cheios.map((s) => s.hora)).toEqual(['07:00'])
  })

  it('quem avisou que não vem devolve o horário para a lista de livres', async () => {
    const { data: sessao } = await db.from('sessao').select('id')
      .eq('conta_id', contaId).gte('inicio', '2026-08-03T00:00:00Z')
      .lt('inicio', '2026-08-04T00:00:00Z').single()

    await db.from('participacao').update({ status: 'falta_avisada' })
      .eq('sessao_id', sessao!.id)

    const { livres, cheios } = await horariosLivres(db, contaId, {
      de: '2026-08-03', ate: '2026-08-09',
    })
    expect(livres.map((s) => s.hora).sort()).toEqual(['07:00', '10:00'])
    expect(cheios).toEqual([])
  })

  it('sessão cancelada não é oferecida nem listada como cheia', async () => {
    const { data: sessao } = await db.from('sessao').select('id')
      .eq('conta_id', contaId).gte('inicio', '2026-08-05T00:00:00Z')
      .lt('inicio', '2026-08-06T00:00:00Z').single()

    await db.from('sessao').update({ status: 'cancelada', motivo_cancelamento: 'x' })
      .eq('id', sessao!.id)

    const { livres, cheios } = await horariosLivres(db, contaId, {
      de: '2026-08-05', ate: '2026-08-05',
    })
    expect(livres).toEqual([])
    expect(cheios).toEqual([])
  })

  it('o formato do bot é ponto e vírgula, como o AutoFluxos consome', async () => {
    const { livres } = await horariosLivres(db, contaId, {
      de: '2026-08-03', ate: '2026-08-03',
    })
    expect(comoPontoEVirgula(livres)).toBe('07h00')
  })
})
