import { describe, it, expect } from 'vitest'
import { rotulo } from '@/core/vocabulario/rotulo'
import { PADRAO } from '@/core/vocabulario/padrao'

describe('rotulo', () => {
  it('usa o rótulo da conta quando existe', () => {
    const voc = { pessoa: { singular: 'Aluno', plural: 'Alunos' } }
    expect(rotulo(voc, 'pessoa')).toBe('Aluno')
    expect(rotulo(voc, 'pessoa', 'plural')).toBe('Alunos')
  })

  it('cai no padrão neutro quando a conta não configurou', () => {
    expect(rotulo({}, 'pessoa')).toBe(PADRAO.pessoa.singular)
    expect(rotulo({}, 'sessao', 'plural')).toBe(PADRAO.sessao.plural)
  })

  it('o padrão é neutro — nunca "Aluno", nunca "Paciente"', () => {
    const todos = Object.values(PADRAO).flatMap((r) => [r.singular, r.plural])
    for (const proibido of ['Aluno', 'Alunos', 'Paciente', 'Turma', 'Professor', 'Matrícula']) {
      expect(todos).not.toContain(proibido)
    }
  })

  it('o mesmo sistema serve o salão sem tocar em código', () => {
    const salao = {
      pessoa: { singular: 'Cliente', plural: 'Clientes' },
      profissional: { singular: 'Profissional', plural: 'Profissionais' },
    }
    expect(rotulo(salao, 'pessoa', 'plural')).toBe('Clientes')
    expect(rotulo(salao, 'sessao')).toBe(PADRAO.sessao.singular)
  })
})
