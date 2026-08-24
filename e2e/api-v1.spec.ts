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

  /*
   * O caminho do robô: ele chega com o identificador do WhatsApp, não com um
   * nome. Sem isto, a automação começa toda conversa em "qual o seu nome?",
   * inclusive com quem faz aula aqui há dois anos.
   */
  test('acha pelo telefone, que é como o bot reconhece quem chegou', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Marina Alves', telefone: '44998887766' })

    // o WhatsApp manda com o país; o cadastro guarda sem
    const { status, corpo } = await json(
      request, '/api/v1/pessoas?telefone=5544998887766', com(c.segredo),
    )
    expect(status).toBe(200)
    expect(corpo.total).toBe(1)
    expect(corpo.pessoas[0]).toMatchObject({ nome: 'Marina Alves', ativa: true })
  })

  test('o nono dígito não separa a mesma pessoa em duas', async ({ request }) => {
    const c = await contaComChave()
    // cadastro antigo, sem o nono dígito
    await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Rita Antiga', telefone: '4433221100' })

    const { corpo } = await json(
      request, '/api/v1/pessoas?telefone=5544934221100', com(c.segredo),
    )
    expect(corpo.pessoas).toEqual([])

    // e o contrário: conta antiga do WhatsApp manda sem o nono
    const semNono = await json(
      request, '/api/v1/pessoas?telefone=554433221100', com(c.segredo),
    )
    expect(semNono.corpo.pessoas[0]).toMatchObject({ nome: 'Rita Antiga' })
  })

  /*
   * No cadastro real 30% não têm telefone, e quem chega pelo WhatsApp pode
   * nunca ter passado por aqui. Um 404 faria o integrador tratar como erro o
   * que é metade das chamadas.
   */
  test('não achar é 200 com lista vazia, e não erro', async ({ request }) => {
    const c = await contaComChave()

    const { status, corpo } = await json(
      request, '/api/v1/pessoas?telefone=5544900000000', com(c.segredo),
    )
    expect(status).toBe(200)
    expect(corpo).toMatchObject({ total: 0, pessoas: [] })
  })

  // Chutar o DDD casaria a conversa de uma pessoa com a ficha de outra.
  test('número sem DDD não procura ninguém', async ({ request }) => {
    const c = await contaComChave()
    await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Sem Ddd', telefone: '44912345678' })

    const { status, corpo } = await json(
      request, '/api/v1/pessoas?telefone=912345678', com(c.segredo),
    )
    expect(status).toBe(200)
    expect(corpo.pessoas).toEqual([])
  })

  test('uma conta não acha a pessoa da outra pelo telefone', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaDeTeste('Salão B')
    await admin.from('pessoa')
      .insert({ conta_id: b.contaId, nome: 'Zulmira Secreta', telefone: '44911112222' })

    const { corpo } = await json(
      request, '/api/v1/pessoas?telefone=5544911112222', com(a.segredo),
    )
    expect(corpo.pessoas).toEqual([])
  })

  test('uma conta não acha a pessoa da outra', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaDeTeste('Salão B')
    await admin.from('pessoa').insert({ conta_id: b.contaId, nome: 'Zulmira Secreta' })

    const { corpo } = await json(request, '/api/v1/pessoas?busca=zulmira', com(a.segredo))
    expect(corpo.pessoas).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fase 3: escrever
// ---------------------------------------------------------------------------

async function envia(
  req: APIRequestContext,
  metodo: 'post' | 'delete',
  url: string,
  opts: { headers: Record<string, string>; data?: object },
) {
  const r = await req[metodo](url, opts)
  return { status: r.status(), corpo: await r.json(), cabecalhos: r.headers() }
}

/** Uma sessão futura de verdade, com o id que a disponibilidade devolve. */
async function umHorarioLivre(
  req: APIRequestContext,
  c: Awaited<ReturnType<typeof contaComChave>>,
) {
  await comGrade(c)
  const segunda = proximaSegunda()
  const { corpo } = await json(
    req, `/api/v1/disponibilidade?de=${segunda}&ate=${segunda}`, com(c.segredo),
  )
  return { sessaoId: corpo.livres[0].sessaoId as string, data: segunda }
}

test.describe('cadastrar pessoa', () => {
  test('cadastra com nome só, e o nome é o único obrigatório', async ({ request }) => {
    const c = await contaComChave()

    const semNome = await envia(request, 'post', '/api/v1/pessoas', {
      headers: com(c.segredo).headers, data: { telefone: '11999' },
    })
    expect(semNome.status).toBe(400)
    expect(semNome.corpo.campo).toBe('nome')

    const r = await envia(request, 'post', '/api/v1/pessoas', {
      headers: com(c.segredo).headers, data: { nome: '  Marina Alves  ' },
    })
    expect(r.status).toBe(201)
    expect(r.corpo.nome).toBe('Marina Alves')

    // o espaço no fim vira duplicata invisível na busca; some na entrada
    const { data } = await admin.from('pessoa').select('nome').eq('id', r.corpo.pessoaId).single()
    expect(data?.nome).toBe('Marina Alves')
  })

  test('a mesma Idempotency-Key não cadastra duas vezes', async ({ request }) => {
    const c = await contaComChave()
    const cabecalhos = { ...com(c.segredo).headers, 'Idempotency-Key': `conversa-${Date.now()}` }
    const corpo = { nome: 'Repetida da Silva' }

    const um = await envia(request, 'post', '/api/v1/pessoas', { headers: cabecalhos, data: corpo })
    const dois = await envia(request, 'post', '/api/v1/pessoas', { headers: cabecalhos, data: corpo })

    /*
     * A rede cai depois de gravar e antes de a resposta chegar, o WhatsApp
     * reentrega, a esteira repete. Sem isto, a mesma pessoa vira dois cadastros
     * e ninguém descobre até a professora contar cabeças.
     */
    expect(um.status).toBe(201)
    expect(dois.status).toBe(201)
    expect(dois.corpo.pessoaId).toBe(um.corpo.pessoaId)
    expect(dois.cabecalhos['idempotent-replay']).toBe('true')

    const { count } = await admin.from('pessoa')
      .select('id', { count: 'exact', head: true })
      .eq('conta_id', c.contaId).eq('nome', 'Repetida da Silva')
    expect(count).toBe(1)
  })

  test('mesma chave com corpo diferente é recusada, e não marcada em silêncio', async ({ request }) => {
    const c = await contaComChave()
    const cabecalhos = { ...com(c.segredo).headers, 'Idempotency-Key': `troca-${Date.now()}` }

    await envia(request, 'post', '/api/v1/pessoas', { headers: cabecalhos, data: { nome: 'Um' } })
    const outro = await envia(request, 'post', '/api/v1/pessoas', {
      headers: cabecalhos, data: { nome: 'Outro Completamente' },
    })

    // isto não é reentrega, é bug de quem chama: devolver a resposta antiga
    // cadastraria silenciosamente a pessoa errada
    expect(outro.status).toBe(422)
    const { count } = await admin.from('pessoa')
      .select('id', { count: 'exact', head: true })
      .eq('conta_id', c.contaId).eq('nome', 'Outro Completamente')
    expect(count).toBe(0)
  })

  test('a chave de uma conta não serve na outra', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaComChave('Salão B')
    const chave = `mesma-${Date.now()}`

    const naA = await envia(request, 'post', '/api/v1/pessoas', {
      headers: { ...com(a.segredo).headers, 'Idempotency-Key': chave },
      data: { nome: 'Fulana' },
    })
    const naB = await envia(request, 'post', '/api/v1/pessoas', {
      headers: { ...com(b.segredo).headers, 'Idempotency-Key': chave },
      data: { nome: 'Fulana' },
    })

    // quem escolhe a chave é quem chama, então ela só pode ser única dentro da
    // conta: global, o segundo cliente receberia a resposta do primeiro
    expect(naA.corpo.pessoaId).not.toBe(naB.corpo.pessoaId)
  })
})

test.describe('marcar', () => {
  test('marca, carimba a origem como bot, e devolve o id da participação', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Marcada' }).select('id').single()

    const r = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers,
      data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    expect(r.status).toBe(201)
    expect(r.corpo.status).toBe('esperada')

    const { data: gravada } = await admin.from('participacao')
      .select('origem, status, registrado_por_origem')
      .eq('id', r.corpo.participacaoId).single()
    // `bot` existe no enum desde a 0033: o modelo foi feito para este dia
    expect(gravada).toMatchObject({
      origem: 'avulso', status: 'esperada', registrado_por_origem: 'bot',
    })
  })

  test('horário cheio recusa, e o robô nunca confirma acima da capacidade', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)

    // a conta permite encaixe acima; para a recepção isso abre exceção, para o
    // bot não abre nada, e é essa diferença que este teste prende
    await admin.from('conta').update({ encaixe_acima: true }).eq('id', c.contaId)

    const { data: pessoas } = await admin.from('pessoa').insert([
      { conta_id: c.contaId, nome: 'Uma' }, { conta_id: c.contaId, nome: 'Duas' },
      { conta_id: c.contaId, nome: 'Tres' },
    ]).select('id')

    for (const p of (pessoas ?? []).slice(0, 2)) {
      const ok = await envia(request, 'post', '/api/v1/participacoes', {
        headers: com(c.segredo).headers, data: { pessoaId: p.id, sessaoId: h.sessaoId },
      })
      expect(ok.status).toBe(201)
    }

    const terceira = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers,
      data: { pessoaId: pessoas![2].id, sessaoId: h.sessaoId },
    })
    expect(terceira.status).toBe(409)
    expect(terceira.corpo.motivo).toBe('acima_da_capacidade')
  })

  test('marcar duas vezes a mesma pessoa recusa', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Dupla' }).select('id').single()
    const corpo = { pessoaId: p!.id, sessaoId: h.sessaoId }

    await envia(request, 'post', '/api/v1/participacoes', { headers: com(c.segredo).headers, data: corpo })
    const segunda = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: corpo,
    })
    expect(segunda.status).toBe(409)
    expect(segunda.corpo.motivo).toBe('ja_participa')
  })

  test('a pessoa de outra conta dá 404, e não 403', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaDeTeste('Salão B')
    const h = await umHorarioLivre(request, a)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: b.contaId, nome: 'De Outra' }).select('id').single()

    const r = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(a.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    // "existe, mas não é sua" conta o que não precisa ser contado
    expect(r.status).toBe(404)
  })

  test('sessão cancelada recusa', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    await admin.from('sessao')
      .update({ status: 'cancelada', motivo_cancelamento: 'Feriado' }).eq('id', h.sessaoId)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Sem Sorte' }).select('id').single()

    const r = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    expect(r.status).toBe(409)
  })
})

test.describe('desmarcar', () => {
  test('desmarcar não apaga: vira falta avisada, libera a vaga e gera crédito', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Vai Desmarcar' }).select('id').single()

    const marcou = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })

    const r = await envia(
      request, 'delete', `/api/v1/participacoes/${marcou.corpo.participacaoId}`,
      { headers: com(c.segredo).headers },
    )
    expect(r.status).toBe(200)
    expect(r.corpo.status).toBe('falta_avisada')

    /*
     * A linha continua existindo, e é isso que dá a aula de volta: apagar
     * destruiria o crédito de reposição junto com o histórico.
     */
    const { data: depois } = await admin.from('participacao')
      .select('status').eq('id', marcou.corpo.participacaoId).single()
    expect(depois?.status).toBe('falta_avisada')

    // e a vaga volta a ser oferecida para quem estiver esperando
    const livre = await json(
      request, `/api/v1/disponibilidade?de=${h.data}&ate=${h.data}`, com(c.segredo),
    )
    expect(livre.corpo.livres[0]).toMatchObject({ ocupadas: 0 })
  })

  test('desmarcar duas vezes devolve 200, porque reentrega é o caminho normal', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Repete' }).select('id').single()
    const marcou = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    const url = `/api/v1/participacoes/${marcou.corpo.participacaoId}`

    await envia(request, 'delete', url, { headers: com(c.segredo).headers })
    const denovo = await envia(request, 'delete', url, { headers: com(c.segredo).headers })

    expect(denovo.status).toBe(200)
    expect(denovo.corpo.jaEstavaAssim).toBe(true)
  })

  test('a marcação de outra conta dá 404', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaComChave('Salão B')
    const h = await umHorarioLivre(request, b)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: b.contaId, nome: 'Da B' }).select('id').single()
    const marcou = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(b.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })

    const r = await envia(
      request, 'delete', `/api/v1/participacoes/${marcou.corpo.participacaoId}`,
      { headers: com(a.segredo).headers },
    )
    expect(r.status).toBe(404)
  })
})

test.describe('a ficha que o bot lê', () => {
  test('devolve os próximos horários com o id da participação, e nenhuma observação', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa').insert({
      conta_id: c.contaId, nome: 'Com Ficha',
      observacao: 'hérnia de disco, não pode carga axial',
    }).select('id').single()

    const marcou = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })

    const { status, corpo } = await json(request, `/api/v1/pessoas/${p!.id}`, com(c.segredo))
    expect(status).toBe(200)

    /*
     * Sem o id da participação aqui, o bot marca e nunca consegue desmarcar: a
     * agenda só cresce. Esta é a linha que fecha o ciclo da Fase 3.
     */
    expect(corpo.proximas[0].participacaoId).toBe(marcou.corpo.participacaoId)
    expect(corpo.proximas[0].data).toBe(h.data)

    // e o que a 0043 e a 0044 fecharam pela frente não sai pela porta dos fundos
    expect(JSON.stringify(corpo)).not.toContain('hérnia')
  })

  test('a ficha de outra conta dá 404', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaDeTeste('Salão B')
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: b.contaId, nome: 'Secreta' }).select('id').single()

    const r = await json(request, `/api/v1/pessoas/${p!.id}`, com(a.segredo))
    expect(r.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Fase 4: a Verandi avisa de volta
// ---------------------------------------------------------------------------

/** Um destino que nunca responde: `.invalid` não resolve, e falha rápido. */
async function comDestinoDeAviso(contaId: string) {
  await admin.from('webhook').insert({
    conta_id: contaId,
    url: 'https://nao-existe.invalid/avisos',
    segredo: 'whsec_de_teste',
  })
}

test.describe('avisar de volta', () => {
  test('sem destino configurado, nada é enfileirado', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Sem Aviso' }).select('id').single()

    await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })

    /*
     * Fila que enche para ninguém é fila que um dia alguém encontra com dez mil
     * linhas sem saber o que fazer com elas.
     */
    const { count } = await admin.from('evento_saida')
      .select('id', { count: 'exact', head: true }).eq('conta_id', c.contaId)
    expect(count).toBe(0)
  })

  test('marcar e desmarcar viram evento, com o que basta para escrever a mensagem', async ({ request }) => {
    const c = await contaComChave()
    await comDestinoDeAviso(c.contaId)
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa').insert({
      conta_id: c.contaId, nome: 'Avisada', telefone: '11988887777',
      observacao: 'hérnia de disco',
    }).select('id').single()

    const marcou = await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    await envia(request, 'delete', `/api/v1/participacoes/${marcou.corpo.participacaoId}`, {
      headers: com(c.segredo).headers,
    })

    const { data: eventos } = await admin.from('evento_saida')
      .select('tipo, dados').eq('conta_id', c.contaId).order('criado_em')

    expect(eventos?.map((e) => e.tipo))
      .toEqual(['participacao.criada', 'participacao.cancelada'])

    /*
     * O corpo carrega o suficiente para o outro lado escrever "sua aula de
     * quinta foi cancelada" sem fazer três chamadas de volta, que é onde a
     * mensagem atrasa e a pessoa já saiu de casa.
     */
    const cancelada = eventos![1].dados as Record<string, unknown>
    expect(cancelada).toMatchObject({
      pessoa: 'Avisada', telefone: '11988887777', hora: '07:00', data: h.data,
    })

    // e um webhook é justamente onde ninguém repara que dado de saúde vazou
    expect(JSON.stringify(eventos)).not.toContain('hérnia')
  })

  test('destino que não responde é reagendado, e não some', async ({ request }) => {
    const c = await contaComChave()
    await comDestinoDeAviso(c.contaId)
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Tentativa' }).select('id').single()

    await envia(request, 'post', '/api/v1/participacoes', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })

    /*
     * Chamada direta que falha some; linha em tabela que falha continua lá, com
     * a hora da próxima tentativa. É a razão de existir o outbox.
     */
    await expect.poll(async () => {
      const { data } = await admin.from('evento_saida')
        .select('tentativas, entregue_em, proxima_tentativa_em, ultimo_erro')
        .eq('conta_id', c.contaId).limit(1).single()
      return {
        tentou: (data?.tentativas ?? 0) >= 1,
        entregue: data?.entregue_em !== null,
        reagendado: data?.proxima_tentativa_em !== null,
        temErro: (data?.ultimo_erro ?? '').length > 0,
      }
    }, { timeout: 20_000 }).toEqual({
      tentou: true, entregue: false, reagendado: true, temErro: true,
    })
  })

  test('cancelar o horário avisa, que é o evento que mais justifica isto existir', async ({ request }) => {
    const c = await contaComChave()
    await comDestinoDeAviso(c.contaId)
    const h = await umHorarioLivre(request, c)

    // pela tela é a recepção que cancela; aqui o efeito é o mesmo, e o que
    // importa é que o outro lado fique sabendo antes de as pessoas saírem de casa
    await admin.from('sessao')
      .update({ status: 'cancelada', motivo_cancelamento: 'Feriado' }).eq('id', h.sessaoId)
    await admin.from('evento_saida').insert({
      conta_id: c.contaId, tipo: 'sessao.cancelada',
      dados: { sessaoId: h.sessaoId, data: h.data, hora: '07:00' },
    })

    const { data } = await admin.from('evento_saida')
      .select('tipo').eq('conta_id', c.contaId).eq('tipo', 'sessao.cancelada')
    expect(data).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Fase 5: lista de espera
// ---------------------------------------------------------------------------

/** Enche o horário até não sobrar vaga, e devolve as pessoas usadas. */
async function encheOHorario(contaId: string, sessaoId: string, quantas = 2) {
  const { data: pessoas } = await admin.from('pessoa').insert(
    Array.from({ length: quantas }, (_, i) => ({
      conta_id: contaId, nome: `Ocupa ${i} ${Date.now()}`,
    })),
  ).select('id')
  await admin.from('participacao').insert(
    (pessoas ?? []).map((p) => ({
      conta_id: contaId, sessao_id: sessaoId, pessoa_id: p.id,
      origem: 'avulso' as const, status: 'esperada' as const,
    })),
  )
  return pessoas ?? []
}

test.describe('lista de espera', () => {
  test('entra na fila do horário cheio, e a posição é a ordem de chegada', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    await encheOHorario(c.contaId, h.sessaoId)

    const { data: pessoas } = await admin.from('pessoa').insert([
      { conta_id: c.contaId, nome: 'Primeira da Fila' },
      { conta_id: c.contaId, nome: 'Segunda da Fila' },
    ]).select('id')

    const um = await envia(request, 'post', '/api/v1/espera', {
      headers: com(c.segredo).headers,
      data: { pessoaId: pessoas![0].id, sessaoId: h.sessaoId },
    })
    const dois = await envia(request, 'post', '/api/v1/espera', {
      headers: com(c.segredo).headers,
      data: { pessoaId: pessoas![1].id, sessaoId: h.sessaoId },
    })

    expect(um.status).toBe(201)
    expect(um.corpo.posicao).toBe(1)
    expect(dois.corpo.posicao).toBe(2)
  })

  test('horário com vaga recusa a fila, e manda marcar', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Sem Precisar' }).select('id').single()

    const r = await envia(request, 'post', '/api/v1/espera', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })

    // fila em horário com vaga é a pessoa esperando um aviso que nunca vem
    expect(r.status).toBe(409)
    expect(r.corpo.motivo).toBe('tem_vaga')
  })

  test('a mesma pessoa não entra duas vezes na mesma fila', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    await encheOHorario(c.contaId, h.sessaoId)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Insistente' }).select('id').single()
    const corpo = { pessoaId: p!.id, sessaoId: h.sessaoId }

    await envia(request, 'post', '/api/v1/espera', { headers: com(c.segredo).headers, data: corpo })
    const segunda = await envia(request, 'post', '/api/v1/espera', {
      headers: com(c.segredo).headers, data: corpo,
    })

    // senão a reentrega põe a mesma pessoa três vezes, e ela recebe três avisos
    expect(segunda.status).toBe(409)
    expect(segunda.corpo.motivo).toBe('ja_esperava')
  })

  test('quando a vaga abre, quem está na frente é chamado, e só ela', async ({ request }) => {
    const c = await contaComChave()
    await comDestinoDeAviso(c.contaId)
    const h = await umHorarioLivre(request, c)
    const ocupantes = await encheOHorario(c.contaId, h.sessaoId)

    const { data: fila } = await admin.from('pessoa').insert([
      { conta_id: c.contaId, nome: 'Chamada Primeiro', telefone: '11911112222' },
      { conta_id: c.contaId, nome: 'Ainda Espera' },
    ]).select('id')

    for (const p of fila ?? []) {
      await envia(request, 'post', '/api/v1/espera', {
        headers: com(c.segredo).headers, data: { pessoaId: p.id, sessaoId: h.sessaoId },
      })
    }

    // alguém desiste: uma vaga, uma pessoa chamada
    const { data: saiu } = await admin.from('participacao')
      .select('id').eq('sessao_id', h.sessaoId).eq('pessoa_id', ocupantes[0].id).single()
    await envia(request, 'delete', `/api/v1/participacoes/${saiu!.id}`, {
      headers: com(c.segredo).headers,
    })

    const { data: eventos } = await admin.from('evento_saida')
      .select('tipo, dados').eq('conta_id', c.contaId).eq('tipo', 'vaga.aberta')

    /*
     * Uma vaga, um aviso. Mandar para a fila inteira transformaria a boa notícia
     * numa corrida em que todo mundo menos um perde, e os que perdem vão achar
     * que o estúdio brincou com eles.
     */
    expect(eventos).toHaveLength(1)
    expect(eventos![0].dados).toMatchObject({ pessoa: 'Chamada Primeiro', vagas: 1 })

    const { data: naFila } = await admin.from('espera')
      .select('avisado_em, pessoa_id').eq('sessao_id', h.sessaoId).order('criado_em')
    expect(naFila![0].avisado_em).not.toBeNull()
    expect(naFila![1].avisado_em).toBeNull()
  })

  test('sair da fila não apaga, e sair duas vezes devolve 200', async ({ request }) => {
    const c = await contaComChave()
    const h = await umHorarioLivre(request, c)
    await encheOHorario(c.contaId, h.sessaoId)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Desiste' }).select('id').single()

    const entrou = await envia(request, 'post', '/api/v1/espera', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    const url = `/api/v1/espera/${entrou.corpo.esperaId}`

    const saiu = await envia(request, 'delete', url, { headers: com(c.segredo).headers })
    const denovo = await envia(request, 'delete', url, { headers: com(c.segredo).headers })

    expect(saiu.corpo.jaEstavaAssim).toBe(false)
    expect(denovo.status).toBe(200)
    expect(denovo.corpo.jaEstavaAssim).toBe(true)

    /*
     * A linha fica: "quantas pessoas ficaram esperando a aula das sete" é a
     * pergunta que decide se vale abrir uma turma nova.
     */
    const { data } = await admin.from('espera')
      .select('cancelado_em').eq('id', entrou.corpo.esperaId).single()
    expect(data?.cancelado_em).not.toBeNull()
  })

  test('quem saiu da fila não é chamado quando a vaga abre', async ({ request }) => {
    const c = await contaComChave()
    await comDestinoDeAviso(c.contaId)
    const h = await umHorarioLivre(request, c)
    const ocupantes = await encheOHorario(c.contaId, h.sessaoId)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: c.contaId, nome: 'Ja Foi Embora' }).select('id').single()

    const entrou = await envia(request, 'post', '/api/v1/espera', {
      headers: com(c.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    await envia(request, 'delete', `/api/v1/espera/${entrou.corpo.esperaId}`, {
      headers: com(c.segredo).headers,
    })

    const { data: saiu } = await admin.from('participacao')
      .select('id').eq('sessao_id', h.sessaoId).eq('pessoa_id', ocupantes[0].id).single()
    await envia(request, 'delete', `/api/v1/participacoes/${saiu!.id}`, {
      headers: com(c.segredo).headers,
    })

    const { count } = await admin.from('evento_saida')
      .select('id', { count: 'exact', head: true })
      .eq('conta_id', c.contaId).eq('tipo', 'vaga.aberta')
    expect(count).toBe(0)
  })

  test('a fila de outra conta dá 404', async ({ request }) => {
    const a = await contaComChave('Estúdio A')
    const b = await contaComChave('Salão B')
    const h = await umHorarioLivre(request, b)
    await encheOHorario(b.contaId, h.sessaoId)
    const { data: p } = await admin.from('pessoa')
      .insert({ conta_id: b.contaId, nome: 'Da B' }).select('id').single()

    const r = await envia(request, 'post', '/api/v1/espera', {
      headers: com(a.segredo).headers, data: { pessoaId: p!.id, sessaoId: h.sessaoId },
    })
    expect(r.status).toBe(404)
  })
})
