import { describe, expect, it } from 'vitest'
import { resumirPeriodo, type ContratoParaResumo, type ParticipacaoParaResumo } from '@/core/relatorio/resumo-da-api'

const p = (x: Partial<ParticipacaoParaResumo>): ParticipacaoParaResumo => ({
  pessoaId: 'p1',
  status: 'presente',
  origem: 'recorrente',
  dia: '2026-10-10',
  aulaJaAconteceu: true,
  aulaCancelada: false,
  ...x,
})
const c = (x: Partial<ContratoParaResumo>): ContratoParaResumo => ({
  pessoaId: 'p1',
  inicio: '2026-01-05',
  fim: null,
  status: 'ativo',
  ...x,
})

describe('resumo do período para a API', () => {
  it('presença conta só aula dada; licença e aula cancelada pela casa ficam fora', () => {
    const r = resumirPeriodo(
      [
        p({}),
        p({ status: 'falta' }),
        p({ status: 'falta_avisada' }),
        p({ status: 'licenca' }),
        p({ status: 'falta', aulaCancelada: true }),
        p({ status: 'esperada', aulaJaAconteceu: false }),
        p({ origem: 'reposicao' }),
      ],
      [],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.presencas).toBe(2)
    expect(r.faltas).toBe(1)
    expect(r.faltasAvisadas).toBe(1)
    expect(r.taxaDePresenca).toBe(0.5)
    expect(r.reposicoesFeitas).toBe(1)
  })

  it('experimental vira matrícula com contrato a partir do dia dela', () => {
    const r = resumirPeriodo(
      [
        p({ pessoaId: 'a', origem: 'experimental', dia: '2026-10-03' }),
        p({ pessoaId: 'b', origem: 'experimental', dia: '2026-10-04' }),
        p({ pessoaId: 'x', origem: 'experimental', status: 'cancelada' }),
      ],
      [c({ pessoaId: 'a', inicio: '2026-10-06' }), c({ pessoaId: 'b', inicio: '2025-02-01', status: 'encerrado', fim: '2025-06-01' })],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.experimentais).toBe(2)
    expect(r.experimentaisQueMatricularam).toBe(1)
  })

  it('matrícula nova é o primeiro contrato; sair é encerrar sem outro vigente', () => {
    const r = resumirPeriodo(
      [],
      [
        c({ pessoaId: 'nova', inicio: '2026-10-06' }),
        c({ pessoaId: 'renovou', inicio: '2025-03-01', status: 'encerrado', fim: '2026-10-05' }),
        c({ pessoaId: 'renovou', inicio: '2026-10-06' }),
        c({ pessoaId: 'saiu', inicio: '2025-03-01', status: 'encerrado', fim: '2026-10-20' }),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.matriculasNovas).toBe(1)
    expect(r.sairam).toBe(1)
    expect(r.alunosAtivos).toBe(2)
  })
})
