import { describe, it, expect } from 'vitest'
import { ajusteDaLicenca, dentroDaLicenca, type AulaDaPessoa } from '@/core/agenda/licenca'

const AGORA = Date.parse('2026-10-06T12:00:00Z')

function aula(data: string, status: AulaDaPessoa['status'], hora = '10:00'): AulaDaPessoa {
  return {
    participacaoId: `p-${data}-${status}`, sessaoId: `s-${data}`, status,
    sessaoInicio: `${data}T${hora}:00Z`, data,
  }
}

describe('dentroDaLicenca', () => {
  const janela = { inicio: '2026-10-06', voltaPrevista: '2026-10-20' }

  it('vale do início até a véspera da volta', () => {
    expect(dentroDaLicenca('2026-10-06', janela)).toBe(true)
    expect(dentroDaLicenca('2026-10-19', janela)).toBe(true)
    expect(dentroDaLicenca('2026-10-20', janela)).toBe(false)
    expect(dentroDaLicenca('2026-10-05', janela)).toBe(false)
  })

  it('sem data de volta, não acaba', () => {
    expect(dentroDaLicenca('2027-03-01', { inicio: '2026-10-06', voltaPrevista: null })).toBe(true)
  })
})

describe('ajusteDaLicenca', () => {
  const janela = { inicio: '2026-10-01', voltaPrevista: '2026-10-20' }

  it('aulas futuras dentro do período viram licença', () => {
    const r = ajusteDaLicenca([
      aula('2026-10-08', 'esperada'),
      aula('2026-10-13', 'confirmada'),
      aula('2026-10-22', 'esperada'),
    ], janela, AGORA)
    expect(r.paraLicenca.map((a) => a.data)).toEqual(['2026-10-08', '2026-10-13'])
    expect(r.paraEsperada).toEqual([])
  })

  it('passado não muda, nem a aula de hoje que já começou', () => {
    const r = ajusteDaLicenca([
      aula('2026-10-02', 'esperada'),
      aula('2026-10-06', 'esperada', '08:00'),
      aula('2026-10-06', 'licenca', '07:00'),
    ], null, AGORA)
    expect(r.paraLicenca).toEqual([])
    expect(r.paraEsperada).toEqual([])
  })

  it('não mexe em presença, falta ou cancelamento já registrados', () => {
    const r = ajusteDaLicenca([
      aula('2026-10-08', 'falta_avisada'),
      aula('2026-10-09', 'cancelada'),
    ], janela, AGORA)
    expect(r.paraLicenca).toEqual([])
  })

  it('encerrada, toda licença futura volta a esperada', () => {
    const r = ajusteDaLicenca([
      aula('2026-10-08', 'licenca'),
      aula('2026-11-08', 'licenca'),
    ], null, AGORA)
    expect(r.paraEsperada.map((a) => a.data)).toEqual(['2026-10-08', '2026-11-08'])
  })

  it('data encurtada devolve só o que ficou depois da nova volta', () => {
    const r = ajusteDaLicenca([
      aula('2026-10-08', 'licenca'),
      aula('2026-10-15', 'licenca'),
    ], { inicio: '2026-10-01', voltaPrevista: '2026-10-12' }, AGORA)
    expect(r.paraEsperada.map((a) => a.data)).toEqual(['2026-10-15'])
    expect(r.paraLicenca).toEqual([])
  })
})
