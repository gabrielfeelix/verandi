import { describe, it, expect } from 'vitest'
import {
  linhasDaSerie,
  colide,
  colisoesDe,
  alcanceDaEdicao,
  sessoesOrfas,
  type NovaSerie,
  type SerieBase,
  type SerieExistente,
  type SessaoParaReconciliar,
} from '@/core/agenda/serie'

const NOVA: NovaSerie = {
  servicoId: 'serv-1',
  profissionalId: 'prof-1',
  localId: 'local-1',
  diasSemana: [1, 3, 5],
  horaInicio: '07:00',
  duracaoMin: 60,
  capacidade: 4,
  vigenciaInicio: '2026-08-01',
}

describe('linhasDaSerie', () => {
  it('devolve uma linha por dia pedido', () => {
    const linhas = linhasDaSerie(NOVA, 'conta-1')
    expect(linhas).toHaveLength(3)
    expect(linhas.map((l) => l.dia_semana)).toEqual([1, 3, 5])
  })

  it('TODAS as linhas carregam o mesmo conjunto de chaves', () => {
    // O PostgREST normaliza o lote para o mesmo conjunto de colunas e preenche
    // o que falta com NULL — o default da coluna NÃO é aplicado. Uma linha com
    // uma chave a menos quebra o lote inteiro com 23502. Mordeu duas vezes.
    const linhas = linhasDaSerie(
      { ...NOVA, profissionalId: undefined, localId: undefined, vigenciaFim: undefined },
      'conta-1',
    )
    const chaves = linhas.map((l) => Object.keys(l).sort().join(','))
    expect(new Set(chaves).size).toBe(1)
  })

  it('o opcional ausente vira null explícito, não chave faltando', () => {
    const [linha] = linhasDaSerie(
      { ...NOVA, diasSemana: [2], profissionalId: undefined, localId: undefined },
      'conta-1',
    )
    expect(linha).toHaveProperty('profissional_id', null)
    expect(linha).toHaveProperty('local_id', null)
    expect(linha).toHaveProperty('vigencia_fim', null)
  })

  it('carrega a conta e nasce ativa', () => {
    const [linha] = linhasDaSerie({ ...NOVA, diasSemana: [4] }, 'conta-9')
    expect(linha.conta_id).toBe('conta-9')
    expect(linha.ativo).toBe(true)
  })

  it('dia repetido não vira série duplicada', () => {
    const linhas = linhasDaSerie({ ...NOVA, diasSemana: [1, 1, 3] }, 'conta-1')
    expect(linhas.map((l) => l.dia_semana)).toEqual([1, 3])
  })

  it('sem dia nenhum não devolve linha', () => {
    expect(linhasDaSerie({ ...NOVA, diasSemana: [] }, 'conta-1')).toEqual([])
  })
})

const base = (over: Partial<SerieBase> = {}): SerieBase => ({
  diaSemana: 1,
  horaInicio: '07:00',
  duracaoMin: 60,
  profissionalId: 'prof-1',
  localId: 'local-1',
  ...over,
})

describe('colide', () => {
  it('mesmo profissional em horário sobreposto colide', () => {
    expect(colide(base(), base({ horaInicio: '07:30', localId: 'local-2' })))
      .toBe('profissional')
  })

  it('mesmo local em horário sobreposto colide', () => {
    expect(colide(base(), base({ horaInicio: '07:30', profissionalId: 'prof-2' })))
      .toBe('local')
  })

  it('horário encostado não colide', () => {
    // 07h–08h e 08h–09h dividem só o instante da borda
    expect(colide(base(), base({ horaInicio: '08:00' }))).toBeNull()
  })

  it('dia diferente nunca colide', () => {
    expect(colide(base(), base({ diaSemana: 2 }))).toBeNull()
  })

  it('profissionais e locais diferentes não colidem', () => {
    expect(colide(base(), base({ profissionalId: 'prof-2', localId: 'local-2' })))
      .toBeNull()
  })

  it('série sem profissional não colide por profissional', () => {
    expect(colide(
      base({ profissionalId: null, localId: null }),
      base({ profissionalId: null, localId: 'local-2' }),
    )).toBeNull()
  })

  it('profissional ganha de local quando os dois batem', () => {
    // a mensagem tem que apontar o conflito mais grave: gente não se divide
    expect(colide(base(), base({ horaInicio: '07:30' }))).toBe('profissional')
  })

  it('aceita a hora com segundos, que é como o Postgres devolve', () => {
    expect(colide(base({ horaInicio: '07:00:00' }), base({ horaInicio: '07:30:00' })))
      .toBe('profissional')
  })

  it('a série que engloba a outra colide', () => {
    expect(colide(base({ duracaoMin: 180 }), base({ horaInicio: '08:00' })))
      .toBe('profissional')
  })
})

const existente = (over: Partial<SerieExistente> = {}): SerieExistente => ({
  id: 'e1',
  diaSemana: 1,
  horaInicio: '07:00:00',
  duracaoMin: 60,
  profissionalId: 'prof-1',
  localId: 'local-1',
  nomeProfissional: 'Marina',
  nomeLocal: 'Sala 1',
  ...over,
})

describe('colisoesDe', () => {
  it('acha a colisão em cada dia pedido', () => {
    const r = colisoesDe(
      { diasSemana: [1, 3], horaInicio: '07:30', duracaoMin: 60,
        profissionalId: 'prof-1', localId: null },
      [existente({ id: 'seg' }), existente({ id: 'qua', diaSemana: 3 })],
    )
    expect(r.map((c) => c.serieId)).toEqual(['seg', 'qua'])
    expect(r.every((c) => c.tipo === 'profissional')).toBe(true)
  })

  it('a mensagem carrega o nome de quem já ocupa', () => {
    const [c] = colisoesDe(
      { diasSemana: [1], horaInicio: '07:30', duracaoMin: 60,
        profissionalId: 'prof-1', localId: null },
      [existente()],
    )
    expect(c.ocupadoPor).toBe('Marina')
  })

  it('colisão de local aponta o nome da sala', () => {
    const [c] = colisoesDe(
      { diasSemana: [1], horaInicio: '07:30', duracaoMin: 60,
        profissionalId: 'prof-9', localId: 'local-1' },
      [existente()],
    )
    expect(c.tipo).toBe('local')
    expect(c.ocupadoPor).toBe('Sala 1')
  })

  it('dia sem conflito não gera colisão', () => {
    const r = colisoesDe(
      { diasSemana: [2, 4], horaInicio: '07:00', duracaoMin: 60,
        profissionalId: 'prof-1', localId: 'local-1' },
      [existente()],
    )
    expect(r).toEqual([])
  })

  it('grade vazia nunca colide', () => {
    const r = colisoesDe(
      { diasSemana: [1, 2, 3, 4, 5], horaInicio: '07:00', duracaoMin: 60,
        profissionalId: 'prof-1', localId: 'local-1' },
      [],
    )
    expect(r).toEqual([])
  })

  it('dia repetido no pedido não duplica o aviso', () => {
    const r = colisoesDe(
      { diasSemana: [1, 1], horaInicio: '07:00', duracaoMin: 60,
        profissionalId: 'prof-1', localId: null },
      [existente()],
    )
    expect(r).toHaveLength(1)
  })
})

const AGORA = new Date('2026-08-13T12:00:00Z')

const sessao = (over: Partial<SessaoParaReconciliar> = {}): SessaoParaReconciliar => ({
  id: 's1',
  inicio: '2026-08-20T10:00:00Z',
  status: 'prevista',
  capacidade: 4,
  ...over,
})

describe('alcanceDaEdicao', () => {
  it('sessão futura prevista e intocada é atualizada', () => {
    const r = alcanceDaEdicao([sessao()], 4, AGORA)
    expect(r).toEqual({ atualiza: ['s1'], preserva: [] })
  })

  it('sessão passada é preservada — o passado não se reescreve', () => {
    const r = alcanceDaEdicao([sessao({ inicio: '2026-08-06T10:00:00Z' })], 4, AGORA)
    expect(r).toEqual({ atualiza: [], preserva: ['s1'] })
  })

  it('sessão já realizada é preservada mesmo no futuro', () => {
    const r = alcanceDaEdicao([sessao({ status: 'realizada' })], 4, AGORA)
    expect(r.preserva).toEqual(['s1'])
  })

  it('sessão cancelada é preservada', () => {
    const r = alcanceDaEdicao([sessao({ status: 'cancelada' })], 4, AGORA)
    expect(r.preserva).toEqual(['s1'])
  })

  it('capacidade ajustada à mão é preservada — configuração não desfaz decisão do dia', () => {
    const r = alcanceDaEdicao([sessao({ capacidade: 5 })], 4, AGORA)
    expect(r.preserva).toEqual(['s1'])
  })

  it('sessão que já começou agora mesmo é preservada', () => {
    const r = alcanceDaEdicao([sessao({ inicio: AGORA.toISOString() })], 4, AGORA)
    expect(r.preserva).toEqual(['s1'])
  })

  it('separa o lote misto sem perder ninguém', () => {
    const r = alcanceDaEdicao(
      [
        sessao({ id: 'futura' }),
        sessao({ id: 'passada', inicio: '2026-08-06T10:00:00Z' }),
        sessao({ id: 'mexida', capacidade: 6 }),
        sessao({ id: 'cancelada', status: 'cancelada' }),
        sessao({ id: 'outra-futura', inicio: '2026-09-01T10:00:00Z' }),
      ],
      4,
      AGORA,
    )
    expect(r.atualiza).toEqual(['futura', 'outra-futura'])
    expect(r.preserva).toEqual(['passada', 'mexida', 'cancelada'])
  })

  it('lista vazia devolve dois vazios', () => {
    expect(alcanceDaEdicao([], 4, AGORA)).toEqual({ atualiza: [], preserva: [] })
  })
})

describe('sessoesOrfas', () => {
  // 20/ago/2026 é quinta; 21/ago é sexta
  const quinta = '2026-08-20T10:00:00Z'
  const sexta = '2026-08-21T10:00:00Z'

  it('a sessão que a série não cobre mais fica órfã', () => {
    const r = sessoesOrfas(
      [sessao({ id: 'velha', inicio: quinta }), sessao({ id: 'nova', inicio: sexta })],
      (s) => s.inicio === sexta,
      AGORA,
    )
    expect(r).toEqual(['velha'])
  })

  it('sessão passada nunca fica órfã — o passado não se reescreve', () => {
    const r = sessoesOrfas(
      [sessao({ id: 'ontem', inicio: '2026-08-06T10:00:00Z' })],
      () => false,
      AGORA,
    )
    expect(r).toEqual([])
  })

  it('sessão já cancelada não é cancelada de novo', () => {
    const r = sessoesOrfas(
      [sessao({ id: 'ja', inicio: quinta, status: 'cancelada' })],
      () => false,
      AGORA,
    )
    expect(r).toEqual([])
  })

  it('sessão realizada no futuro é deixada em paz', () => {
    const r = sessoesOrfas(
      [sessao({ id: 'feita', inicio: quinta, status: 'realizada' })],
      () => false,
      AGORA,
    )
    expect(r).toEqual([])
  })

  it('capacidade mexida à mão não salva a sessão de ficar órfã', () => {
    // aqui é diferente de `alcanceDaEdicao`: o horário deixou de existir na
    // grade, e manter uma sessão de aula que ninguém mais dá é pior
    const r = sessoesOrfas(
      [sessao({ id: 'mexida', inicio: quinta, capacidade: 9 })],
      () => false,
      AGORA,
    )
    expect(r).toEqual(['mexida'])
  })

  it('série que continua igual não órfã ninguém', () => {
    const r = sessoesOrfas(
      [sessao({ id: 'a', inicio: quinta }), sessao({ id: 'b', inicio: sexta })],
      () => true,
      AGORA,
    )
    expect(r).toEqual([])
  })
})
