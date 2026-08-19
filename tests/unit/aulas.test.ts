import { describe, it, expect } from 'vitest'
import {
  aulasPorProfissional, canceladaPorFeriado, ressalvaDoTotal, totalDoPeriodo,
  type SessaoParaContar,
} from '@/core/relatorio/aulas'

const AGORA = '2026-09-20T12:00:00.000Z'

function sessao(x: Partial<SessaoParaContar>): SessaoParaContar {
  return {
    profissionalId: 'p1',
    profissionalNome: 'Cecília',
    inicio: '2026-09-10T10:00:00.000Z',
    cancelada: false,
    motivoCancelamento: null,
    status: ['presente', 'presente'],
    ...x,
  }
}

describe('o que conta como aula aplicada', () => {
  it('a sessão que já passou e não foi cancelada conta, e a turma vazia também', () => {
    // o profissional foi ao estúdio e esperou: turma vazia não é culpa dele
    const r = aulasPorProfissional([
      sessao({ status: ['presente'] }),
      sessao({ status: ['falta', 'falta_avisada'] }),
    ], AGORA)
    expect(r[0].aplicadas).toBe(2)
    expect(r[0].comPresenca).toBe(1)
    expect(r[0].semNinguem).toBe(1)
  })

  it('aula futura não entra no total, e aparece como ainda por dar', () => {
    const r = aulasPorProfissional([
      sessao({}),
      sessao({ inicio: '2026-09-28T10:00:00.000Z', status: [] }),
    ], AGORA)
    expect(r[0].aplicadas).toBe(1)
    expect(r[0].aindaPorDar).toBe(1)
  })

  it('cancelada não conta, e a de feriado conta separada', () => {
    const r = aulasPorProfissional([
      sessao({ cancelada: true, motivoCancelamento: 'Dia marcado como feriado' }),
      sessao({ cancelada: true, motivoCancelamento: 'A profissional avisou' }),
      sessao({}),
    ], AGORA)
    expect(r[0]).toMatchObject({ aplicadas: 1, canceladas: 2, porFeriado: 1 })
  })

  it('chamada não registrada conta como aula e fica marcada', () => {
    // o total existe e ainda não está conferido: esconder isso faria o número
    // parecer mais firme do que é
    const r = aulasPorProfissional([
      sessao({ status: ['esperada', 'presente'] }),
    ], AGORA)
    expect(r[0]).toMatchObject({ aplicadas: 1, semChamada: 1, comPresenca: 0 })
  })

  it('soma as pessoas atendidas, e não só as aulas', () => {
    const r = aulasPorProfissional([
      sessao({ status: ['presente', 'presente', 'falta'] }),
      sessao({ status: ['presente'] }),
    ], AGORA)
    expect(r[0].atendimentos).toBe(3)
  })

  it('quem cobriu a aula de outro aparece com ela', () => {
    // `sessao.profissional_id` é cópia, e não referência viva à série
    const r = aulasPorProfissional([
      sessao({}),
      sessao({ profissionalId: 'p2', profissionalNome: 'Marcos' }),
    ], AGORA)
    expect(r.map((l) => [l.profissionalNome, l.aplicadas]))
      .toEqual([['Cecília', 1], ['Marcos', 1]])
  })

  it('sessão sem profissional vira linha própria, e não some', () => {
    // some em silêncio faria a soma das linhas não bater com o total do estúdio
    const r = aulasPorProfissional([
      sessao({ profissionalId: null, profissionalNome: 'Sem profissional' }),
    ], AGORA)
    expect(r[0].profissionalId).toBeNull()
    expect(r[0].aplicadas).toBe(1)
  })

  it('a ordem é de quem mais deu aula para quem menos deu', () => {
    const r = aulasPorProfissional([
      sessao({ profissionalId: 'p2', profissionalNome: 'Marcos' }),
      sessao({}),
      sessao({}),
    ], AGORA)
    expect(r.map((l) => l.profissionalNome)).toEqual(['Cecília', 'Marcos'])
  })
})

describe('o motivo do cancelamento', () => {
  it('reconhece o texto que a materialização escreve', () => {
    expect(canceladaPorFeriado('Dia marcado como feriado')).toBe(true)
    expect(canceladaPorFeriado('Dia marcado como fechado')).toBe(true)
    expect(canceladaPorFeriado('A profissional avisou que não vinha')).toBe(false)
    expect(canceladaPorFeriado(null)).toBe(false)
  })
})

describe('o total e a ressalva', () => {
  it('o total é a soma das linhas, e não outra consulta', () => {
    const linhas = aulasPorProfissional([
      sessao({}),
      sessao({ profissionalId: 'p2', profissionalNome: 'Marcos', status: ['presente'] }),
      sessao({ cancelada: true, motivoCancelamento: 'Dia marcado como feriado' }),
    ], AGORA)
    expect(totalDoPeriodo(linhas)).toEqual({
      aplicadas: 2, atendimentos: 3, semChamada: 0,
      canceladas: 1, porFeriado: 1, aindaPorDar: 0,
    })
  })

  it('a ressalva anda junto do número, e some quando não há o que ressalvar', () => {
    expect(ressalvaDoTotal({ semChamada: 6, porFeriado: 2, aindaPorDar: 4 }))
      .toBe('6 sem chamada registrada · 2 dias fechados no período · 4 ainda por dar')
    expect(ressalvaDoTotal({ semChamada: 0, porFeriado: 0, aindaPorDar: 0 }))
      .toBeNull()
  })
})
