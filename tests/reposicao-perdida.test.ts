import { describe, expect, it } from 'vitest'
import { naoRepoem } from '@/core/agenda/ocupacao'

describe('faltar na reposição segue a regra de faltar numa aula comum', () => {
  it('na MGM (falta sem aviso não dá crédito), faltar sem avisar perde a reposição', () => {
    const mgm = naoRepoem(true, false)
    // a falta antiga não volta: a reposição foi perdida (Carolina Garcia, 21/10 9h)
    expect(mgm).not.toContain('falta')
    // avisou no prazo, o estúdio cancelou ou estava de licença: a falta antiga volta
    expect(mgm).toEqual(expect.arrayContaining(['falta_avisada', 'cancelada', 'licenca']))
  })

  it('conta que dá crédito para toda falta devolve a falta antiga, como antes', () => {
    expect(naoRepoem(true, true)).toEqual(expect.arrayContaining(['falta', 'falta_avisada', 'cancelada', 'licenca']))
  })

  it('conta que não dá crédito nem para falta avisada só devolve cancelada e licença', () => {
    expect(naoRepoem(false, false).sort()).toEqual(['cancelada', 'licenca'])
  })
})
