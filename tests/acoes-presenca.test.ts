import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { calcularOcupacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe } from '@/core/agenda/encaixe'

/**
 * As server actions dependem de `cookies()` do Next e não rodam fora dele — o
 * caminho pela tela é coberto em `e2e/sessao.spec.ts`. O que se prova aqui é a
 * regra que as ações aplicam, contra o banco de verdade.
 */
describe('regras que as ações de presença aplicam', () => {
  const db = admin()
  let contaId: string, sessaoId: string, servicoId: string
  let pessoas: { id: string; nome: string }[]

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `acoes-${m}` }).select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()
    servicoId = s!.id

    const { data: ss } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId,
      inicio: '2026-08-12T13:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()
    sessaoId = ss!.id

    const { data: ps } = await db.from('pessoa').insert(
      ['Helena', 'Otávio', 'Beatriz', 'Rafael', 'Lívia']
        .map((nome) => ({ conta_id: contaId, nome })),
    ).select('id, nome')
    pessoas = ps!
  })

  it('marcar todos presentes NÃO sobrescreve quem já foi decidido', async () => {
    // `status` explícito em TODAS as linhas: num insert em lote o PostgREST
    // normaliza as linhas para o mesmo conjunto de colunas e preenche o que
    // faltar com NULL — o default da coluna não é aplicado. Omitir em uma linha
    // só quebra o lote inteiro com 23502.
    const { error: erroInsert } = await db.from('participacao').insert([
      { conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoas[0].id,
        origem: 'recorrente', status: 'esperada' },
      { conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoas[1].id,
        origem: 'recorrente', status: 'esperada' },
      { conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoas[2].id,
        origem: 'recorrente', status: 'falta' },
    ])
    expect(erroInsert).toBeNull()

    // é exatamente a consulta que `marcarTodosPresentes` faz
    const { data } = await db.from('participacao')
      .update({ status: 'presente' })
      .eq('sessao_id', sessaoId)
      .in('status', ['esperada', 'confirmada'])
      .select('id')

    expect(data).toHaveLength(2)

    const { data: falta } = await db.from('participacao')
      .select('status').eq('pessoa_id', pessoas[2].id).single()
    expect(falta!.status).toBe('falta')
  })

  it('encaixar em sessão lotada é recusado, e subir a capacidade resolve', async () => {
    // a sessão tem capacidade 4 e 3 pessoas; enche com a quarta
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoas[3].id, origem: 'avulso',
    })

    const ler = async () => {
      const { data } = await db.from('sessao')
        .select('capacidade, participacao(pessoa_id, status)')
        .eq('id', sessaoId).single<{
          capacidade: number
          participacao: { pessoa_id: string; status: never }[]
        }>()
      return data!
    }

    let s = await ler()
    let veredito = avaliarEncaixe(
      calcularOcupacao(s.capacidade, s.participacao.map((p) => p.status)),
      false,
    )
    expect(veredito).toEqual({ cabe: false, motivo: 'lotada', podeAbrirVaga: true })

    await db.from('sessao').update({ capacidade: 5 }).eq('id', sessaoId)

    s = await ler()
    veredito = avaliarEncaixe(
      calcularOcupacao(s.capacidade, s.participacao.map((p) => p.status)),
      false,
    )
    expect(veredito).toEqual({ cabe: true })
  })

  it('a mesma pessoa duas vezes é recusada antes de tocar no banco', async () => {
    const { data } = await db.from('sessao')
      .select('capacidade, participacao(pessoa_id, status)')
      .eq('id', sessaoId).single<{
        capacidade: number
        participacao: { pessoa_id: string; status: never }[]
      }>()

    const veredito = avaliarEncaixe(
      calcularOcupacao(data!.capacidade, data!.participacao.map((p) => p.status)),
      true,
    )
    expect(veredito.motivo).toBe('ja_participa')
  })

  it('quem avisou que não vem libera a vaga para a reposição', async () => {
    const { data: ss } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId,
      inicio: '2026-08-19T13:00:00Z', duracao_min: 60, capacidade: 2,
    }).select().single()

    await db.from('participacao').insert([
      { conta_id: contaId, sessao_id: ss!.id, pessoa_id: pessoas[0].id, origem: 'recorrente' },
      { conta_id: contaId, sessao_id: ss!.id, pessoa_id: pessoas[1].id, origem: 'recorrente' },
    ])

    const ocupacaoCheia = calcularOcupacao(2, ['esperada', 'esperada'])
    expect(avaliarEncaixe(ocupacaoCheia, false).cabe).toBe(false)

    await db.from('participacao').update({ status: 'falta_avisada' })
      .eq('sessao_id', ss!.id).eq('pessoa_id', pessoas[1].id)

    const ocupacaoAberta = calcularOcupacao(2, ['esperada', 'falta_avisada'])
    expect(avaliarEncaixe(ocupacaoAberta, false).cabe).toBe(true)
  })

  it('a reposição guarda de qual falta ela veio', async () => {
    const { data: falta } = await db.from('participacao')
      .select('id').eq('sessao_id', sessaoId).eq('pessoa_id', pessoas[2].id).single()

    const { data: ss } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId,
      inicio: '2026-08-26T13:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()

    const { data, error } = await db.from('participacao').insert({
      conta_id: contaId, sessao_id: ss!.id, pessoa_id: pessoas[2].id,
      origem: 'reposicao', reposicao_de_id: falta!.id,
    }).select('reposicao_de_id').single()

    expect(error).toBeNull()
    expect(data!.reposicao_de_id).toBe(falta!.id)
  })
})
