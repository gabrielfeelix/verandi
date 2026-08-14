import { describe, it, expect } from 'vitest'
import { roteiroDe } from '@/core/onboarding/roteiro'
import { boasVindas } from '@/core/onboarding/boas-vindas'
import { PREDEFINICOES, predefinicao, ehTipoDeNegocio } from '@/core/vocabulario/predefinicoes'
import { PADRAO, type ChaveVocabulario, type Rotulos } from '@/core/vocabulario/padrao'

/** Os rótulos de um estúdio de pilates, para provar que o texto os usa. */
const PILATES: Rotulos = {
  ...PADRAO,
  pessoa: { singular: 'Aluno', plural: 'Alunos' },
  serie: { singular: 'Turma fixa', plural: 'Turmas fixas' },
  sessao: { singular: 'Aula', plural: 'Aulas' },
  servico: { singular: 'Modalidade', plural: 'Modalidades' },
}

describe('roteiro dos primeiros passos', () => {
  it('quem configura vê a configuração; quem só opera, não', () => {
    const dono = roteiroDe('dono', PADRAO)
    const recepcao = roteiroDe('recepcao', PADRAO)

    expect(dono.map((p) => p.href)).toContain('/config')
    expect(dono.map((p) => p.href)).toContain('/grade')
    // ensinar alguém a mexer numa tela que o papel dela não alcança é ensinar
    // a bater numa porta trancada
    expect(recepcao.map((p) => p.href)).not.toContain('/config')
    expect(recepcao.map((p) => p.href)).not.toContain('/grade')
  })

  it('o profissional recebe o essencial, e só', () => {
    // ela não navega o sistema: opera a sessão que está na frente dela
    const passos = roteiroDe('profissional', PADRAO)
    expect(passos.every((p) => p.href === '/hoje')).toBe(true)
    expect(passos.length).toBeLessThan(roteiroDe('recepcao', PADRAO).length)
  })

  it('a visita começa pela tela e passa pelo menu antes dos destinos', () => {
    const passos = roteiroDe('dono', PADRAO)
    expect(passos[0].alvo).toBe('tela')
    // o menu vem cedo: sem ele a pessoa aprende telas soltas e não descobre
    // que existem as outras
    const primeiroDoMenu = passos.findIndex((p) => p.alvo.startsWith('rail-'))
    expect(primeiroDoMenu).toBeLessThan(4)
    expect(passos.filter((p) => p.alvo.startsWith('rail-')).length)
      .toBeGreaterThanOrEqual(6)
  })

  it('todo passo de item do menu leva ao destino no passo seguinte', () => {
    const passos = roteiroDe('dono', PADRAO)
    for (const [n, p] of passos.entries()) {
      if (!p.alvo.startsWith('rail-') || n + 1 >= passos.length) continue
      const destino = `/${p.alvo.replace('rail-', '')}`
      expect(passos[n + 1].href).toBe(destino)
    }
  })

  it('o suporte da 4YU não tem roteiro: não é cliente', () => {
    expect(roteiroDe('suporte', PADRAO)).toEqual([])
  })

  it('todo passo aponta um alvo e leva a uma tela', () => {
    for (const papel of ['dono', 'recepcao', 'profissional'] as const) {
      for (const p of roteiroDe(papel, PADRAO)) {
        expect(p.href.startsWith('/')).toBe(true)
        expect(p.alvo).toMatch(/^[a-z-]+$/)
        expect(p.titulo.length).toBeGreaterThan(0)
      }
    }
  })

  it('o texto fala a língua da conta, e nunca a palavra fixa', () => {
    const texto = roteiroDe('dono', PILATES).map((p) => p.texto).join(' ')
    expect(texto).toContain('modalidade')
    expect(texto).toContain('turmas fixas')
    expect(texto).not.toMatch(/horário fixo/)
  })

  it('nenhum artigo cola na palavra do vocabulário', () => {
    /*
     * O gênero é da palavra e a palavra é do cliente: "um serviço" vira "um
     * modalidade", "os horários fixos" vira "os turmas fixas". Quem escreve o
     * texto não pode saber qual palavra vai cair ali, então artigo antes dela
     * é erro de português esperando o primeiro cliente que não seja estúdio.
     */
    const palavras = ['aluno', 'alunos', 'turma fixa', 'turmas fixas',
                      'aula', 'aulas', 'modalidade', 'modalidades']
    const artigos = ['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
                     'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
                     'ao', 'à', 'pelo', 'pela']

    for (const papel of ['dono', 'recepcao', 'profissional'] as const) {
      const texto = roteiroDe(papel, PILATES)
        .map((p) => `${p.titulo} ${p.texto}`).join(' ').toLowerCase()
      for (const artigo of artigos) {
        for (const palavra of palavras) {
          expect(texto).not.toContain(` ${artigo} ${palavra}`)
        }
      }
    }
  })
})

describe('boas-vindas', () => {
  it('promete configuração só a quem configura', () => {
    const dono = boasVindas('dono', PADRAO).map((c) => c.texto).join(' ')
    const recepcao = boasVindas('recepcao', PADRAO).map((c) => c.texto).join(' ')
    expect(dono).toContain('palavras')
    expect(recepcao).not.toContain('palavras são suas')
  })

  it('toda arte tem descrição, porque quem usa leitor de tela escolhe', () => {
    for (const papel of ['dono', 'recepcao'] as const) {
      for (const c of boasVindas(papel, PADRAO)) {
        expect(c.arte.descricao.length).toBeGreaterThan(10)
        expect(c.arte.arquivo).toMatch(/\.webp$/)
      }
    }
  })
})

describe('predefinições de vocabulário', () => {
  it('cada uma preenche o vocabulário inteiro', () => {
    const chaves = Object.keys(PADRAO) as ChaveVocabulario[]
    for (const p of PREDEFINICOES) {
      for (const chave of chaves) {
        expect(p.palavras[chave].singular.length).toBeGreaterThan(0)
        expect(p.palavras[chave].plural.length).toBeGreaterThan(0)
      }
    }
  })

  it('"outro" existe e mantém o neutro', () => {
    // sem ele, alguém escolhe a predefinição errada só para passar da tela
    expect(predefinicao('neutro').palavras).toEqual(PADRAO)
  })

  it('recusa tipo desconhecido em vez de escrever qualquer coisa', () => {
    expect(ehTipoDeNegocio('pilates')).toBe(false)
    expect(() => predefinicao('pilates' as never)).toThrow()
  })

  it('nenhum texto do onboarding leva travessão', () => {
    const tudo = [
      ...roteiroDe('dono', PADRAO), ...roteiroDe('recepcao', PADRAO),
    ].map((p) => `${p.titulo} ${p.texto}`)
      .concat(boasVindas('dono', PADRAO).map((c) => `${c.titulo} ${c.texto}`))
      .concat(PREDEFINICOES.map((p) => `${p.nome} ${p.exemplos}`))
      .join(' ')
    expect(tudo).not.toMatch(/[—–]/)
  })
})
