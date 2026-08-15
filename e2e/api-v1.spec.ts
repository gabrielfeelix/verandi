import { test, expect, type APIRequestContext } from '@playwright/test'
import { admin, contaDeTeste } from './apoio'
import { novaChave } from '../src/server/api/chave'

/**
 * A API v1, batendo no servidor de verdade.
 *
 * Aqui não há navegador nem sessão: é exatamente o que o AutoFluxos vai fazer.
 * Sem sessão não há RLS para proteger nada, então cada teste de vazamento
 * abaixo está checando a **única** barreira que existe, que é o `conta_id` na
 * consulta da rota.
 */

/** Uma conta com chave viva, e o segredo em mãos. */
async function contaComChave(nome = 'Estúdio API') {
  const base = await contaDeTeste(nome)
  const { segredo, hash, prefixo } = novaChave()
  await admin.from('chave_api').insert({
    conta_id: base.contaId, nome: 'AutoFluxos', hash, prefixo,
  })
  return { ...base, segredo }
}

const com = (segredo: string) => ({ headers: { authorization: `Bearer ${segredo}` } })

/** Uma série de segunda às 07:00, para haver o que responder. */
async function comGrade(base: Awaited<ReturnType<typeof contaComChave>>) {
  await admin.from('serie').insert({
    conta_id: base.contaId,
    servico_id: base.servicoId,
    profissional_id: base.profissionalId,
    local_id: base.localId,
    dia_semana: 1,
    hora_inicio: '07:00',
    duracao_min: 60,
    capacidade: 2,
    vigencia_inicio: '2026-01-01',
  })
}

/** A segunda-feira seguinte a uma data, em texto local. */
function proximaSegunda(de = new Date()): string {
  const d = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate(), 12))
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7))
  return d.toISOString().slice(0, 10)
}

async function json(req: APIRequestContext, url: string, opts?: object) {
  const r = await req.get(url, opts)
  return { status: r.status(), corpo: await r.json() }
}

test.describe('quem pode chamar', () => {
  test('sem chave, com chave inventada e com chave revogada dão o mesmo 401', async ({ request }) => {
    const c = await contaComChave()
    const url = '/api/v1/catalogo'

    const semNada = await json(request, url)
    const inventada = await json(request, url, com('vr_naoexisteessachaveaqui1234567890abcd'))

    await admin.from('chave_api')
      .update({ revogada_em: new Date().toISOString() }).eq('conta_id', c.contaId)
    const revogada = await json(request, url, com(c.segredo))

    /*
     * As três respostas são idênticas de propósito. Distinguir "chave revogada"
     * de "chave não existe" conta a quem está tentando qual das portas já
     * existiu, e isso é informação de graça.
     */
    expect(semNada.status).toBe(401)
    expect(inventada.status).toBe(401)
    expect(revogada.status).toBe(401)
    expect(inventada.corpo).toEqual(semNada.corpo)
    expect(revogada.corpo).toEqual(semNada.corpo)
  })

  test('conta suspensa não responde, mesmo com chave viva', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('conta').update({ ativo: false }).eq('id', c.contaId)

    const r = await json(request, '/api/v1/catalogo', com(c.segredo))
    // senão o bot segue marcando aula numa conta que a 4YU desligou, e o
    // cliente descobre pelo WhatsApp
    expect(r.status).toBe(401)
  })

  test('usar a chave carimba o último uso, que é o que responde "posso revogar?"', async ({ request }) => {
    const c = await contaComChave()
    await request.get('/api/v1/catalogo', com(c.segredo))

    await expect.poll(async () => {
      const { data } = await admin.from('chave_api')
        .select('ultimo_uso_em').eq('conta_id', c.contaId).single()
      return data?.ultimo_uso_em === null ? 'nunca' : 'usada'
    }).toBe('usada')
  })
})

test.describe('catálogo', () => {
  test('devolve o que existe, com o vocabulário da conta', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('vocabulario').insert([
      { conta_id: c.contaId, chave: 'servico', singular: 'Modalidade', plural: 'Modalidades' },
    ])

    const { status, corpo } = await json(request, '/api/v1/catalogo', com(c.segredo))
    expect(status).toBe(200)
    expect(corpo.servicos.map((s: { nome: string }) => s.nome)).toContain('Pilates solo')
    expect(corpo.profissionais.map((p: { nome: string }) => p.nome)).toContain('Marina')
    // o bot fala a língua do negócio, senão escreve "serviço" onde a tela do
    // mesmo cliente escreve "modalidade"
    expect(corpo.vocabulario.servico.singular).toBe('Modalidade')
  })

  test('o desativado não aparece: o bot não oferece o que o estúdio parou de dar', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('servico').update({ ativo: false }).eq('id', c.servicoId)

    const { corpo } = await json(request, '/api/v1/catalogo', com(c.segredo))
    expect(corpo.servicos).toEqual([])
  })

  test('uma conta não enxerga o catálogo da outra', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaDeTeste('Salão B')
    await admin.from('servico')
      .insert({ conta_id: b.contaId, nome: 'Corte masculino', capacidade_padrao: 1 })

    const { corpo } = await json(request, '/api/v1/catalogo', com(a.segredo))
    expect(JSON.stringify(corpo)).not.toContain('Corte masculino')
  })
})

test.describe('disponibilidade', () => {
  test('cheio sai em "cheios" e nunca em "livres"', async ({ request }) => {
    const c = await contaComChave()
    await comGrade(c)
    const segunda = proximaSegunda()

    const url = `/api/v1/disponibilidade?de=${segunda}&ate=${segunda}`
    const primeira = await json(request, url, com(c.segredo))
    expect(primeira.status).toBe(200)
    expect(primeira.corpo.livres).toHaveLength(1)
    expect(primeira.corpo.livres[0]).toMatchObject({
      data: segunda, hora: '07:00', capacidade: 2, ocupadas: 0, livres: 2,
    })

    // enche a turma pelas duas vagas
    const sessaoId = primeira.corpo.livres[0].sessaoId
    const { data: pessoas } = await admin.from('pessoa').insert([
      { conta_id: c.contaId, nome: 'Ana Cheia' },
      { conta_id: c.contaId, nome: 'Bia Cheia' },
    ]).select('id')
    await admin.from('participacao').insert(
      (pessoas ?? []).map((p) => ({
        conta_id: c.contaId, sessao_id: sessaoId, pessoa_id: p.id,
        origem: 'avulso' as const, status: 'esperada' as const,
      })),
    )

    const depois = await json(request, url, com(c.segredo))
    /*
     * Esta é a regra que sustenta o marco inteiro: horário cheio **não é
     * resultado**. O bot só oferece `livres`, e por isso ele nunca promete vaga
     * que não existe. `cheios` vem junto para o bot saber a diferença entre
     * "não tem horário nesse dia" e "tem, e está lotado".
     */
    expect(depois.corpo.livres).toEqual([])
    expect(depois.corpo.cheios).toHaveLength(1)
    expect(depois.corpo.cheios[0]).toMatchObject({ ocupadas: 2, livres: 0 })
  })

  test('a sessão cancelada não é oferecida nem como cheia', async ({ request }) => {
    const c = await contaComChave()
    await comGrade(c)
    const segunda = proximaSegunda()
    const url = `/api/v1/disponibilidade?de=${segunda}&ate=${segunda}`

    const antes = await json(request, url, com(c.segredo))
    await admin.from('sessao')
      .update({ status: 'cancelada', motivo_cancelamento: 'Feriado' })
      .eq('id', antes.corpo.livres[0].sessaoId)

    const depois = await json(request, url, com(c.segredo))
    expect(depois.corpo.livres).toEqual([])
    expect(depois.corpo.cheios).toEqual([])
  })

  test('filtra por profissional, que é a pergunta "com quem?"', async ({ request }) => {
    const c = await contaComChave()
    await comGrade(c)
    const segunda = proximaSegunda()

    const dela = await json(
      request,
      `/api/v1/disponibilidade?de=${segunda}&ate=${segunda}&profissional=${c.profissionalId}`,
      com(c.segredo),
    )
    expect(dela.corpo.livres).toHaveLength(1)

    const { data: outra } = await admin.from('profissional')
      .insert({ conta_id: c.contaId, nome: 'Ninguém dá aula' }).select('id').single()
    const doOutro = await json(
      request,
      `/api/v1/disponibilidade?de=${segunda}&ate=${segunda}&profissional=${outra!.id}`,
      com(c.segredo),
    )
    expect(doOutro.corpo.livres).toEqual([])
  })

  test('recusa pedido malformado dizendo qual campo', async ({ request }) => {
    const c = await contaComChave()

    const semData = await json(request, '/api/v1/disponibilidade', com(c.segredo))
    expect(semData.status).toBe(400)
    expect(semData.corpo.campo).toBe('de')

    const instante = await json(
      request,
      '/api/v1/disponibilidade?de=2026-08-15T00:00:00Z&ate=2026-08-16',
      com(c.segredo),
    )
    expect(instante.status).toBe(400)

    const invertido = await json(
      request, '/api/v1/disponibilidade?de=2026-08-20&ate=2026-08-10', com(c.segredo),
    )
    expect(invertido.status).toBe(400)
    expect(invertido.corpo.campo).toBe('ate')

    // janela grande demais criaria milhares de sessões por um ano digitado errado
    const gigante = await json(
      request, '/api/v1/disponibilidade?de=2026-01-01&ate=2028-01-01', com(c.segredo),
    )
    expect(gigante.status).toBe(400)

    const idTorto = await json(
      request,
      '/api/v1/disponibilidade?de=2026-08-15&ate=2026-08-16&servico=nao-e-uuid',
      com(c.segredo),
    )
    expect(idTorto.status).toBe(400)
    expect(idTorto.corpo.campo).toBe('servico')
    // e a mensagem não vaza nome de tabela nem de coluna do Postgres
    expect(JSON.stringify(idTorto.corpo)).not.toMatch(/relation|column|pgrst/i)
  })
})

test.describe('pessoas', () => {
  test('acha sem acento, do mesmo jeito que a tela', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Cecília Prado', telefone: '11988887777' })

    const { status, corpo } = await json(
      request, '/api/v1/pessoas?busca=cecil', com(c.segredo),
    )
    expect(status).toBe(200)
    expect(corpo.pessoas).toHaveLength(1)
    expect(corpo.pessoas[0]).toMatchObject({
      nome: 'Cecília Prado', telefone: '11988887777', ativa: true,
    })
  })

  test('não devolve o cadastro inteiro, e não vaza ficha', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('pessoa').insert({
      conta_id: c.contaId, nome: 'Vera Lopes',
      observacao: 'hérnia de disco', nascimento: '1980-03-02',
    })

    const vazia = await json(request, '/api/v1/pessoas?busca=', com(c.segredo))
    expect(vazia.status).toBe(400)
    const umaLetra = await json(request, '/api/v1/pessoas?busca=v', com(c.segredo))
    expect(umaLetra.status).toBe(400)

    // o bot marca aula; dado de saúde é da tela, e quem lê tem papel para isso
    const achou = await json(request, '/api/v1/pessoas?busca=vera', com(c.segredo))
    expect(JSON.stringify(achou.corpo)).not.toContain('hérnia')
    expect(JSON.stringify(achou.corpo)).not.toContain('1980')
  })

  test('uma conta não acha a pessoa da outra', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaDeTeste('Salão B')
    await admin.from('pessoa').insert({ conta_id: b.contaId, nome: 'Zulmira Secreta' })

    const { corpo } = await json(request, '/api/v1/pessoas?busca=zulmira', com(a.segredo))
    expect(corpo.pessoas).toEqual([])
  })
})
