import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import {
  listarRecibos, recibosDaPessoa, resumoDosRecibos, ultimosEnvios,
} from '@/server/recibo/consultas'

/**
 * Achar um recibo depois, que é o que um arquivo serve para fazer.
 *
 * Com trezentas linhas a busca por nome resolve; com trezentas mil ela não
 * resolve nada, e "e os do dia 19 de janeiro?" não tinha resposta em tela
 * nenhuma. O que este arquivo prova é o recorte por data, o resumo que soma o
 * recorte inteiro, e o registro de envio que responde "já mandei isso?".
 */
describe('o arquivo de recibos', () => {
  const db = admin()
  const marca = Date.now()
  let contaId: string, pessoaId: string, outraPessoaId: string

  const corpoDe = (nome: string, valorCent: number) => ({
    emitenteNome: 'Estúdio do arquivo',
    emitenteDocumento: '11222333000181',
    emitenteEndereco: 'Rua das Acácias, 204, Maringá, PR',
    emitenteTelefone: null,
    pagadorNome: nome,
    pagadorDocumento: null,
    pagadorMatricula: null,
    pagadorEndereco: null,
    referente: 'Mensal',
    valorCent,
    valorPorExtenso: 'x',
    forma: 'Pix',
    recebidoEm: '2026-01-19',
    emitidoPor: '',
    emitidoEm: '2026-01-19T12:00:00Z',
  })

  beforeAll(async () => {
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Arquivo', slug: `arq-${marca}` }).select().single()
    contaId = c!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: `Amanda ${marca}` }).select().single()
    pessoaId = p!.id
    const { data: p2 } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: `Bruno ${marca}` }).select().single()
    outraPessoaId = p2!.id

    /*
     * Todas as linhas com as mesmas chaves.
     *
     * O PostgREST monta o `insert` em lote com as colunas da **primeira** linha
     * e manda `null` explícito nas outras: sem o `status` na primeira, a
     * segunda chegava com status nulo e o erro falava de coluna não nula sem
     * dizer por quê. É a armadilha que o handoff documenta, chegando por aqui.
     */
    const semear = await db.from('recibo').insert([
      // dois em 19 de janeiro, um deles cancelado
      {
        conta_id: contaId, serie: 'A', numero: 1, pessoa_id: pessoaId,
        valor_cent: 30000, corpo: corpoDe('Amanda', 30000),
        emitido_em: '2026-01-19T10:00:00-03:00',
        status: 'valido', motivo: null,
      },
      {
        conta_id: contaId, serie: 'A', numero: 2, pessoa_id: outraPessoaId,
        valor_cent: 40000, corpo: corpoDe('Bruno', 40000),
        emitido_em: '2026-01-19T21:30:00-03:00',
        status: 'cancelado', motivo: 'valor errado',
      },
      // um no dia seguinte, para provar que a janela fecha
      {
        conta_id: contaId, serie: 'A', numero: 3, pessoa_id: pessoaId,
        valor_cent: 50000, corpo: corpoDe('Amanda', 50000),
        emitido_em: '2026-01-20T09:00:00-03:00',
        status: 'valido', motivo: null,
      },
    ])
    // engolir o erro aqui daria nove falhas que não dizem o que houve
    if (semear.error) throw new Error(`semear recibos: ${semear.error.message}`)
  })

  it('o recorte por data traz só os do dia pedido', async () => {
    const { linhas, total } = await listarRecibos(db, contaId, {
      periodo: { de: '2026-01-19', ate: '2026-01-19' }, fuso: 'America/Sao_Paulo',
    })
    expect(total).toBe(2)
    expect(linhas.map((l) => l.numero).sort()).toEqual([1, 2])
  })

  /*
   * O das 21h30 é o caso que quebra quem compara `timestamptz` com a data
   * crua: a meia-noite UTC do dia 19 já passou às 21h no Brasil, e o recibo
   * sumiria do próprio dia. É a mesma armadilha de fuso que o fechamento já
   * pagou uma vez.
   */
  it('o recibo emitido às 21h30 continua sendo do dia dele', async () => {
    const { linhas } = await listarRecibos(db, contaId, {
      periodo: { de: '2026-01-19', ate: '2026-01-19' }, fuso: 'America/Sao_Paulo',
    })
    expect(linhas.map((l) => l.numero)).toContain(2)
  })

  it('o dia seguinte não entra na janela de um dia', async () => {
    const { linhas } = await listarRecibos(db, contaId, {
      periodo: { de: '2026-01-20', ate: '2026-01-20' }, fuso: 'America/Sao_Paulo',
    })
    expect(linhas.map((l) => l.numero)).toEqual([3])
  })

  it('o resumo soma o recorte, e o cancelado não comprova valor', async () => {
    const { resumo, completo } = await resumoDosRecibos(db, contaId, {
      periodo: { de: '2026-01-19', ate: '2026-01-19' }, fuso: 'America/Sao_Paulo',
    })
    expect(completo).toBe(true)
    expect(resumo.quantidade).toBe(2)
    expect(resumo.validos).toBe(1)
    expect(resumo.cancelados).toBe(1)
    expect(resumo.validoCent).toBe(30000)
  })

  it('a data e o filtro de situação se combinam', async () => {
    const { total } = await listarRecibos(db, contaId, {
      filtro: 'cancelados', periodo: { de: '2026-01-19', ate: '2026-01-19' },
      fuso: 'America/Sao_Paulo',
    })
    expect(total).toBe(1)
  })

  it('a busca por nome continua funcionando junto com a data', async () => {
    const { linhas } = await listarRecibos(db, contaId, {
      busca: 'Amanda', periodo: { de: '2026-01-01', ate: '2026-01-31' },
      fuso: 'America/Sao_Paulo',
    })
    expect(linhas.map((l) => l.numero).sort()).toEqual([1, 3])
  })

  it('os recibos de uma pessoa saem do mais novo para o mais velho', async () => {
    const dela = await recibosDaPessoa(db, contaId, pessoaId)
    expect(dela.map((r) => r.numero)).toEqual([3, 1])
  })

  it('o último envio é o que a lista mostra, e reenviar não apaga o anterior', async () => {
    const { data: r } = await db.from('recibo').select('id')
      .eq('conta_id', contaId).eq('numero', 1).single()

    await db.from('envio_de_recibo').insert([
      {
        conta_id: contaId, recibo_id: r!.id, para: 'antigo@exemplo.com',
        enviado_em: '2026-01-19T13:00:00Z', entregue: true,
      },
      {
        conta_id: contaId, recibo_id: r!.id, para: 'novo@exemplo.com',
        enviado_em: '2026-01-20T13:00:00Z', entregue: true,
      },
    ])

    const mapa = await ultimosEnvios(db, contaId, [r!.id])
    expect(mapa.get(r!.id)?.para).toBe('novo@exemplo.com')

    // as duas linhas continuam: "eu nunca recebi" se responde com o histórico
    const { count } = await db.from('envio_de_recibo')
      .select('*', { count: 'exact', head: true }).eq('recibo_id', r!.id)
    expect(count).toBe(2)
  })

  it('o envio que não saiu não conta como último envio', async () => {
    const { data: r } = await db.from('recibo').select('id')
      .eq('conta_id', contaId).eq('numero', 3).single()

    await db.from('envio_de_recibo').insert({
      conta_id: contaId, recibo_id: r!.id, para: 'quebrou@exemplo.com',
      entregue: false, erro: 'o provedor de e-mail recusou o envio',
    })

    const mapa = await ultimosEnvios(db, contaId, [r!.id])
    expect(mapa.has(r!.id)).toBe(false)
  })
})
