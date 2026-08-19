import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { aulasDoPeriodo } from '../src/server/relatorio/consultas'

/**
 * O que só o banco responde: que a janela do período respeita o fuso da conta,
 * que a troca de profissional leva a aula junto, e que o feriado aparece
 * explicado em vez de virar buraco no total.
 *
 * A regra de o que conta como aula está em `tests/unit/aulas.test.ts`: é regra
 * de produto, e teste de soma não deveria precisar de banco.
 */
describe('aulas por profissional no banco', () => {
  const db = admin()
  const FUSO = 'America/Sao_Paulo'
  let contaId: string, servicoId: string
  let cecilia: string, marcos: string
  let pessoaId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio das aulas', slug: `aul-${m}`, fuso: FUSO })
      .select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates aparelho' }).select().single()
    servicoId = s!.id

    const { data: p1 } = await db.from('profissional')
      .insert({ conta_id: contaId, nome: 'Cecília' }).select().single()
    const { data: p2 } = await db.from('profissional')
      .insert({ conta_id: contaId, nome: 'Marcos' }).select().single()
    cecilia = p1!.id
    marcos = p2!.id

    const { data: pe } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Joana Prado' }).select().single()
    pessoaId = pe!.id
  })

  async function sessao(inicio: string, opcoes: {
    profissional?: string | null
    cancelada?: boolean
    motivo?: string | null
    presente?: boolean
  } = {}) {
    const { data } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId,
      profissional_id: opcoes.profissional === undefined ? cecilia : opcoes.profissional,
      inicio, duracao_min: 60, capacidade: 6,
      status: opcoes.cancelada ? 'cancelada' : 'prevista',
      motivo_cancelamento: opcoes.motivo ?? null,
    }).select('id').single()

    if (opcoes.presente !== undefined) {
      await db.from('participacao').insert({
        conta_id: contaId, sessao_id: data!.id, pessoa_id: pessoaId,
        origem: 'recorrente', status: opcoes.presente ? 'presente' : 'falta',
      })
    }
    return data!.id
  }

  it('conta as aulas do período, com as pessoas atendidas', async () => {
    await sessao('2026-05-04T10:00:00Z', { presente: true })
    await sessao('2026-05-06T10:00:00Z', { presente: true })

    const r = await aulasDoPeriodo(db, contaId, '2026-05-01', '2026-05-31', FUSO)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({
      profissionalNome: 'Cecília', aplicadas: 2, atendimentos: 2,
    })
    expect(r.total.aplicadas).toBe(2)
  })

  it('a aula das 21h de sexta não escorrega para sábado', async () => {
    /*
     * 21h de 29/05 em São Paulo é 00h de 30/05 em UTC. Com a janela montada em
     * `T00:00:00Z`, esta aula sairia do relatório de maio inteiro e apareceria
     * no primeiro dia de junho, que é o defeito que o financeiro teve.
     */
    await sessao('2026-05-30T00:00:00Z', { presente: true })

    const maio = await aulasDoPeriodo(db, contaId, '2026-05-01', '2026-05-29', FUSO)
    expect(maio.total.aplicadas).toBe(3)

    const junho = await aulasDoPeriodo(db, contaId, '2026-06-01', '2026-06-30', FUSO)
    expect(junho.total.aplicadas).toBe(0)
  })

  it('quem cobriu a aula aparece com ela, e o titular não', async () => {
    const id = await sessao('2026-06-10T10:00:00Z', { presente: true })
    await db.from('sessao').update({ profissional_id: marcos }).eq('id', id)

    const r = await aulasDoPeriodo(db, contaId, '2026-06-01', '2026-06-30', FUSO)
    expect(r.linhas.map((l) => [l.profissionalNome, l.aplicadas]))
      .toEqual([['Marcos', 1]])
  })

  it('o feriado aparece explicado, e não vira buraco no total', async () => {
    await sessao('2026-07-09T10:00:00Z', {
      cancelada: true, motivo: 'Dia marcado como feriado',
    })
    await sessao('2026-07-16T10:00:00Z', { presente: true })

    const r = await aulasDoPeriodo(db, contaId, '2026-07-01', '2026-07-31', FUSO)
    expect(r.total).toMatchObject({ aplicadas: 1, canceladas: 1, porFeriado: 1 })
  })

  it('sessão sem profissional vira linha própria', async () => {
    await sessao('2026-08-05T10:00:00Z', { profissional: null, presente: true })

    const r = await aulasDoPeriodo(db, contaId, '2026-08-01', '2026-08-31', FUSO)
    expect(r.linhas[0].profissionalNome).toBe('Sem profissional')
    expect(r.linhas[0].profissionalId).toBeNull()
  })

  it('outra conta não entra na contagem', async () => {
    const { data: outra } = await db.from('conta')
      .insert({ nome: 'Outro estúdio', slug: `aul-outro-${Date.now()}` })
      .select().single()
    const { data: s } = await db.from('servico')
      .insert({ conta_id: outra!.id, nome: 'Pilates' }).select().single()
    await db.from('sessao').insert({
      conta_id: outra!.id, servico_id: s!.id, inicio: '2026-05-04T10:00:00Z',
      duracao_min: 60, capacidade: 4,
    })

    const r = await aulasDoPeriodo(db, contaId, '2026-05-01', '2026-05-31', FUSO)
    expect(r.total.aplicadas).toBe(3)
  })
})
