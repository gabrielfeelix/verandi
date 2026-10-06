import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { materializarJanela } from '@/server/agenda/materializar'
import {
  abrirLicenca, encerrarLicenca, licencaDaPessoa, prorrogarLicenca,
} from '@/server/licencas/licencas'

/*
 * Datas em 2027 para estarem sempre no futuro: a regra só mexe em aula que
 * ainda não começou. Segundas de janeiro: 4, 11, 18, 25.
 */
describe('licença no período inteiro', () => {
  const db = admin()
  let contaId: string, pessoaId: string

  async function statusPorDia(): Promise<Record<string, string>> {
    const { data } = await db.from('participacao')
      .select('status, sessao:sessao_id!inner(inicio)')
      .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    return Object.fromEntries(
      (data ?? []).map((p) => [p.sessao.inicio.slice(0, 10), p.status]),
    )
  }

  beforeAll(async () => {
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `lic-${Date.now()}`, fuso: 'America/Sao_Paulo' })
      .select().single()
    contaId = c!.id
    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()
    const { data: se } = await db.from('serie').insert({
      conta_id: contaId, servico_id: s!.id, dia_semana: 1, hora_inicio: '07:00',
      duracao_min: 60, capacidade: 4, vigencia_inicio: '2026-03-01',
    }).select().single()
    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Helena' }).select().single()
    pessoaId = p!.id
    await db.from('vaga').insert({
      conta_id: contaId, serie_id: se!.id, pessoa_id: pessoaId, inicio: '2026-03-01',
    })
    await materializarJanela(db, contaId, '2027-01-01', '2027-01-31')
  })

  it('abrir recolhe as aulas até a véspera da volta', async () => {
    await abrirLicenca(db, contaId, pessoaId, { inicio: '2027-01-01', voltaPrevista: '2027-01-25' })
    expect(await statusPorDia()).toEqual({
      '2027-01-04': 'licenca', '2027-01-11': 'licenca',
      '2027-01-18': 'licenca', '2027-01-25': 'esperada',
    })
  })

  it('aula gerada durante a licença já nasce em licença', async () => {
    await prorrogarLicenca(db, contaId, (await licencaDaPessoa(db, contaId, pessoaId))!.id, null)
    await materializarJanela(db, contaId, '2027-02-01', '2027-02-07')
    const s = await statusPorDia()
    expect(s['2027-01-25']).toBe('licenca')
    expect(s['2027-02-01']).toBe('licenca')
  })

  it('data encurtada devolve o que ficou depois dela', async () => {
    await prorrogarLicenca(db, contaId, (await licencaDaPessoa(db, contaId, pessoaId))!.id, '2027-01-12')
    const s = await statusPorDia()
    expect(s['2027-01-11']).toBe('licenca')
    expect(s['2027-01-18']).toBe('esperada')
    expect(s['2027-02-01']).toBe('esperada')
  })

  it('voltou: tudo o que não começou volta a esperada', async () => {
    await encerrarLicenca(db, contaId, [pessoaId], 'operador')
    expect(Object.values(await statusPorDia()).every((st) => st === 'esperada')).toBe(true)
  })
})
