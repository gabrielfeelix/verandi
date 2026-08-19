/**
 * Semeia uma conta de desenvolvimento com a forma do caso real: uma semana
 * densa, turmas pequenas, gente sem telefone, e um feriado no meio.
 *
 * Nomes são fictícios de propósito — o repositório é público.
 *
 *   node scripts/semear-dev.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
)
// repetido em vez de importado: `.mjs` não lê o `esquema.ts`. Se mudar aqui,
// mude em `src/server/esquema.ts` também.
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'app_verandi' },
  auth: { persistSession: false, autoRefreshToken: false },
})

const SENHA = 'senha-de-teste-123'
const SLUG = 'estudio-dev'

const NOMES = [
  'Helena Moraes', 'Otávio Prado', 'Beatriz Nogueira', 'Rafael Quintana',
  'Lívia Sampaio', 'Murilo Bastos', 'Clara Vasconcelos', 'Ígor Salvatore',
  'Nara Figueiredo', 'Téo Aragão', 'Sofia Rezende', 'Vicente Camargo',
  'Alice Bandeira', 'Bruno Peçanha', 'Marina Toledo', 'Caio Estrela',
  'Dora Villaça', 'Elias Munhoz', 'Flor Cavalcanti', 'Gil Aranha',
  'Íris Tavares', 'Joana D’Ávila', 'Lucas Vieira', 'Malu Andrade',
]

async function limpar() {
  const { data } = await db.from('conta').select('id').eq('slug', SLUG).maybeSingle()
  if (data) {
    await db.from('conta').delete().eq('id', data.id)
    console.log('conta anterior apagada')
  }
}

/**
 * Acha um usuário pelo e-mail, virando as páginas.
 *
 * `listUsers()` sem argumento devolve **só os 50 primeiros**. Como o banco de
 * desenvolvimento não é limpo entre execuções, os usuários que os testes deixam
 * para trás empurram `dono@dev.local` para fora da primeira página: o semeador
 * achava que ele não existia, tentava criar de novo, e o `createUser` devolvia
 * `user: null` com "already registered" — o seed morria em
 * `Cannot read properties of null`, sem citar e-mail nenhum.
 */
async function acharUsuario(email) {
  for (let pagina = 1; pagina <= 40; pagina++) {
    const { data } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 })
    const achado = data.users.find((u) => u.email === email)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  await limpar()

  const { data: conta, error } = await db.from('conta')
    .insert({ nome: 'Estúdio Verandi', slug: SLUG, fuso: 'America/Sao_Paulo' })
    .select().single()
  if (error) throw error
  const contaId = conta.id

  await db.from('vocabulario').insert([
    { conta_id: contaId, chave: 'pessoa', singular: 'Aluno', plural: 'Alunos' },
    { conta_id: contaId, chave: 'serie', singular: 'Turma', plural: 'Turmas' },
    { conta_id: contaId, chave: 'sessao', singular: 'Aula', plural: 'Aulas' },
    { conta_id: contaId, chave: 'profissional', singular: 'Professor', plural: 'Professores' },
    { conta_id: contaId, chave: 'vaga', singular: 'Matrícula', plural: 'Matrículas' },
  ])

  const { data: profs } = await db.from('profissional').insert(
    ['Marina', 'Sofia', 'Bruna', 'Nádia'].map((nome) => ({ conta_id: contaId, nome })),
  ).select()

  const { data: servicos } = await db.from('servico').insert([
    { conta_id: contaId, nome: 'Pilates solo', duracao_min: 60, capacidade_padrao: 4 },
    { conta_id: contaId, nome: 'Fáscia', duracao_min: 60, capacidade_padrao: 3 },
    { conta_id: contaId, nome: 'Personal', duracao_min: 60, capacidade_padrao: 1 },
  ]).select()

  const { data: locais } = await db.from('local').insert([
    { conta_id: contaId, nome: 'Sala 1' },
    { conta_id: contaId, nome: 'Sala 2' },
    { conta_id: contaId, nome: 'Domicílio' },
  ]).select()

  // uma semana densa: seg–sex das 7h às 19h, mais sábado de manhã.
  // 14 horários × 5 dias + 4 no sábado = 74 séries, na ordem de grandeza real.
  const horas = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00',
                 '14:00','15:00','16:00','17:00','18:00','19:00','20:00']
  const series = []
  for (let dia = 1; dia <= 5; dia++) {
    for (const [i, hora] of horas.entries()) {
      series.push({
        conta_id: contaId,
        servico_id: servicos[i % 3 === 2 ? 1 : 0].id,
        profissional_id: profs[(dia + i) % profs.length].id,
        local_id: locais[i % 2].id,
        dia_semana: dia,
        hora_inicio: hora,
        duracao_min: 60,
        capacidade: i % 5 === 0 ? 1 : 4,
        vigencia_inicio: '2026-03-01',
      })
    }
  }
  for (const hora of ['08:00', '09:00', '10:00', '11:00']) {
    series.push({
      conta_id: contaId, servico_id: servicos[0].id,
      profissional_id: profs[0].id, local_id: locais[0].id,
      dia_semana: 6, hora_inicio: hora, duracao_min: 60, capacidade: 4,
      vigencia_inicio: '2026-03-01',
    })
  }
  const { data: seriesCriadas } = await db.from('serie').insert(series).select('id, capacidade')

  // 30% sem telefone, como no dado real
  const { data: pessoas } = await db.from('pessoa').insert(
    NOMES.map((nome, i) => ({
      conta_id: contaId,
      nome,
      telefone: i % 10 < 7 ? `1199${String(100000 + i * 137).slice(0, 6)}` : null,
      identificador_externo: i % 4 === 3 ? null : String(100 + i),
      vencimento_plano: i % 6 === 0 ? '2026-08-25' : null,
    })),
  ).select()

  await db.from('pessoa_tag').insert([
    { pessoa_id: pessoas[2].id, conta_id: contaId, tag: 'gestante' },
    { pessoa_id: pessoas[7].id, conta_id: contaId, tag: 'domicílio' },
  ])

  // ocupa ~57% das vagas, como a planilha real
  const vagas = []
  let p = 0
  for (const s of seriesCriadas) {
    const quantas = Math.round(s.capacidade * 0.57)
    for (let k = 0; k < quantas; k++) {
      vagas.push({
        conta_id: contaId, serie_id: s.id,
        pessoa_id: pessoas[p++ % pessoas.length].id,
        inicio: '2026-03-01',
      })
    }
  }
  // uma pessoa não pode ocupar a mesma série duas vezes
  const vistos = new Set()
  const unicas = vagas.filter((v) => {
    const k = `${v.serie_id}|${v.pessoa_id}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
  await db.from('vaga').insert(unicas)

  /*
   * O administrativo, que até aqui nascia vazio.
   *
   * Sem estas linhas, `/financeiro`, `/recibos` e a aba de contratos da ficha
   * abriam com estado vazio em toda sessão de desenvolvimento — e foi assim que
   * os módulos 15 a 19 passaram em setecentos testes sem ninguém nunca ter
   * olhado uma tela cheia. Estado vazio é o que menos custa desenhar e o que
   * menos ensina.
   *
   * Os valores são inventados e redondos de propósito: a tabela de preços do
   * cliente não entra neste repositório, que é público. O que importa aqui é a
   * **forma** — mensal que não acaba, trimestral partido em parcelas, pacote
   * que é uma cobrança só, e dois preços na mesma linha.
   */
  await db.from('conta').update({
    razao_social: 'Estúdio Verandi Ltda',
    documento: '11222333000181',
    endereco_emitente: 'Rua das Acácias, 204, São Paulo, SP',
    telefone_emitente: '1133334444',
  }).eq('id', contaId)

  await db.from('servico').update({ categoria: 'Pilates' }).eq('id', servicos[0].id)
  await db.from('servico').update({ categoria: 'Pilates' }).eq('id', servicos[2].id)
  await db.from('servico').update({ categoria: 'Terapias' }).eq('id', servicos[1].id)

  const { data: planos } = await db.from('plano').insert([
    { conta_id: contaId, servico_id: servicos[0].id, codigo: '001',
      nome: 'Mensal, 1x por semana', recorrencia: 'mensal', parcelas: 1,
      frequencia_semanal: 1, preco_vinculado_cent: 40000, preco_avulso_cent: 40000 },
    { conta_id: contaId, servico_id: servicos[0].id, codigo: '002',
      nome: 'Mensal, 2x por semana', recorrencia: 'mensal', parcelas: 1,
      frequencia_semanal: 2, preco_vinculado_cent: 70000, preco_avulso_cent: 70000 },
    { conta_id: contaId, servico_id: servicos[0].id, codigo: '004',
      nome: 'Trimestral, 2x por semana', recorrencia: 'trimestral', parcelas: 3,
      frequencia_semanal: 2, preco_vinculado_cent: 189000, preco_avulso_cent: 189000 },
    { conta_id: contaId, servico_id: servicos[0].id, codigo: '010',
      nome: 'Anual, 2x por semana', recorrencia: 'anual', parcelas: 12,
      frequencia_semanal: 2, preco_vinculado_cent: 720000, preco_avulso_cent: 720000 },
    { conta_id: contaId, servico_id: servicos[0].id, codigo: '013',
      nome: 'Aula avulsa', recorrencia: 'avulsa', parcelas: 1,
      preco_vinculado_cent: 9000, preco_avulso_cent: 9000 },
    { conta_id: contaId, servico_id: servicos[2].id, codigo: '015',
      nome: 'Personal, pacote 10 aulas', recorrencia: 'pacote', parcelas: 1,
      sessoes_no_pacote: 10, validade_meses: 6,
      preco_vinculado_cent: 180000, preco_avulso_cent: 180000 },
    { conta_id: contaId, servico_id: servicos[1].id, codigo: '100',
      nome: 'Fáscia, sessão', recorrencia: 'avulsa', parcelas: 1,
      preco_vinculado_cent: 15000, preco_avulso_cent: 18000 },
    { conta_id: contaId, servico_id: servicos[1].id, codigo: '101',
      nome: 'Fáscia, pacote 10 sessões', recorrencia: 'pacote', parcelas: 1,
      sessoes_no_pacote: 10, validade_meses: 6,
      preco_vinculado_cent: 135000, preco_avulso_cent: 162000 },
  ]).select('id, codigo, recorrencia, parcelas, preco_vinculado_cent')

  const doCodigo = (c) => planos.find((x) => x.codigo === c)

  /*
   * As datas saem de **hoje**, e não de uma data escrita à mão.
   *
   * Seed com data fixa envelhece: depois de dois meses tudo está em atraso, e a
   * primeira tela que alguém abre mente sobre o produto. Aqui o mês corrente é
   * o mês corrente, e o atraso é atraso de propósito.
   */
  const hoje = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  const mesAtras = (n) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - n, 1))
    return iso(d)
  }
  const diasAtras = (n) => iso(new Date(hoje.getTime() - n * 864e5))

  /*
   * Doze matrículas em cima de quem já ocupa horário, com o contrato ligado à
   * vaga que a pessoa já tem: é o que a ficha lê para dizer "esta vaga veio
   * daquele contrato". Vaga sem contrato continua existindo ao lado, porque ela
   * existe no dado real — quem entrou antes de o sistema existir.
   */
  const contratos = []
  const escolhidos = pessoas.slice(0, 12)
  for (const [i, pessoa] of escolhidos.entries()) {
    const plano = [doCodigo('002'), doCodigo('001'), doCodigo('004'),
                   doCodigo('010'), doCodigo('015'), doCodigo('101')][i % 6]
    const inicio = mesAtras(i % 4)
    contratos.push({
      conta_id: contaId, pessoa_id: pessoa.id, plano_id: plano.id,
      inicio, dia_vencimento: [5, 10, 15][i % 3],
      preco_aplicado_cent: plano.preco_vinculado_cent,
      sessoes_contratadas: plano.recorrencia === 'pacote' ? 10 : null,
      forma_pagamento: ['pix', 'dinheiro', 'credito'][i % 3],
      criado_em: `${inicio}T09:00:00Z`,
    })
  }
  const { data: contratosCriados } = await db.from('contrato').insert(contratos)
    .select('id, pessoa_id, plano_id, inicio, dia_vencimento, preco_aplicado_cent')

  for (const c of contratosCriados) {
    const { data: vagaDela } = await db.from('vaga')
      .select('id').eq('pessoa_id', c.pessoa_id).eq('conta_id', contaId).limit(1)
    if (vagaDela?.length) {
      await db.from('vaga').update({ contrato_id: c.id }).eq('id', vagaDela[0].id)
    }
  }

  /*
   * As cobranças e o que foi recebido.
   *
   * A tela do caixa só ensina alguma coisa com as quatro situações na mesma
   * lista: em atraso, a vencer, paga e cancelada. Uma delas fica pela metade,
   * que é o caso que mais aparece no balcão e o que mais confunde quem lê o
   * saldo.
   */
  const cobrancas = []
  for (const [i, c] of contratosCriados.entries()) {
    const plano = planos.find((p) => p.id === c.plano_id)
    const meses = plano.recorrencia === 'pacote' || plano.recorrencia === 'avulsa' ? 1 : 3
    for (let m = 0; m < meses; m++) {
      const competencia = mesAtras((i % 4) - m)
      if (competencia > mesAtras(0)) continue
      const parcela = Math.floor(c.preco_aplicado_cent / (plano.parcelas || 1))
      cobrancas.push({
        conta_id: contaId, contrato_id: c.id, pessoa_id: c.pessoa_id,
        competencia,
        vencimento: `${competencia.slice(0, 8)}${String(c.dia_vencimento).padStart(2, '0')}`,
        valor_cent: plano.recorrencia === 'mensal' ? c.preco_aplicado_cent : parcela,
        status: i === 11 && m === 0 ? 'cancelada' : 'aberta',
        motivo_cancelamento: i === 11 && m === 0 ? 'cortesia combinada com a dona' : null,
      })
    }
  }
  const vistasCobranca = new Set()
  const cobrancasUnicas = cobrancas.filter((c) => {
    const k = `${c.contrato_id}|${c.competencia}`
    if (vistasCobranca.has(k)) return false
    vistasCobranca.add(k)
    return true
  })
  const { data: cobrancasCriadas } = await db.from('cobranca').insert(cobrancasUnicas)
    .select('id, valor_cent, competencia, status')

  const pagamentos = []
  for (const [i, cob] of cobrancasCriadas.entries()) {
    if (cob.status === 'cancelada') continue
    // as mais antigas foram pagas; as do mês corrente ficam em aberto, e uma
    // paga pela metade, que é o caso que a tela precisa saber mostrar
    if (cob.competencia === mesAtras(0) && i % 3 !== 0) continue
    const metade = i % 7 === 0
    pagamentos.push({
      conta_id: contaId, cobranca_id: cob.id,
      valor_cent: metade ? Math.floor(cob.valor_cent / 2) : cob.valor_cent,
      forma: ['pix', 'dinheiro', 'credito', 'transferencia'][i % 4],
      recebido_em: diasAtras(i % 20),
      ...(i === 5
        ? { estornado_em: new Date().toISOString(), motivo_estorno: 'digitado em dobro' }
        : {}),
    })
  }
  await db.from('pagamento').insert(pagamentos)

  /*
   * Horário de funcionamento: segunda a sábado, domingo fechado.
   *
   * Sem estas linhas a conta de desenvolvimento diz que o estúdio nunca abre —
   * e a grade da semana não consegue distinguir "domingo fechado" de "domingo
   * que ninguém montou", que é justamente o que ela precisa mostrar.
   */
  await db.from('funcionamento').insert([
    { conta_id: contaId, dia_semana: 1, abre: '06:30', fecha: '20:00' },
    { conta_id: contaId, dia_semana: 2, abre: '06:30', fecha: '20:00' },
    { conta_id: contaId, dia_semana: 3, abre: '06:30', fecha: '20:00' },
    { conta_id: contaId, dia_semana: 4, abre: '06:30', fecha: '20:00' },
    { conta_id: contaId, dia_semana: 5, abre: '06:30', fecha: '19:00' },
    { conta_id: contaId, dia_semana: 6, abre: '07:00', fecha: '11:00' },
  ])

  await db.from('excecao_calendario').insert({
    conta_id: contaId, data: '2026-09-07', tipo: 'feriado', descricao: 'Independência',
  })

  // o `suporte` entra no seed porque a tela da 4YU não tem outro jeito de ser
  // vista em desenvolvimento — sem ele, `/contas-4yu` redireciona para `/hoje`.
  // Ele mora na conta interna, não nesta: na conta de cliente, sair do suporte
  // apagaria o vínculo e levaria o acesso junto.
  const { data: interna } = await db.from('conta')
    .select('id').eq('interna', true).maybeSingle()

  for (const [n, papel] of [['prof', 'profissional'], ['dono', 'dono'],
                            ['recepcao', 'recepcao'], ['suporte', 'suporte']]) {
    const email = `${n}@dev.local`
    const achado = await acharUsuario(email)
    const id = achado?.id ??
      (await db.auth.admin.createUser({ email, password: SENHA, email_confirm: true }))
        .data.user.id
    const onde = papel === 'suporte' ? interna.id : contaId
    await db.from('usuario_conta').upsert(
      { usuario_id: id, conta_id: onde, papel },
      { onConflict: 'usuario_id,conta_id' },
    )
  }

  // liga a professora Marina ao usuário `prof@dev.local`, para a tela Hoje
  const prof = await acharUsuario('prof@dev.local')
  await db.from('profissional').update({ usuario_id: prof.id }).eq('id', profs[0].id)

  console.log(`conta ${contaId}`)
  console.log(`${seriesCriadas.length} séries · ${pessoas.length} pessoas · ${unicas.length} vagas`)
  console.log(
    `${planos.length} planos · ${contratosCriados.length} contratos · ` +
    `${cobrancasCriadas.length} cobranças · ${pagamentos.length} pagamentos`,
  )
  console.log(
    'entrar com dono@dev.local / prof@dev.local / recepcao@dev.local / ' +
    `suporte@dev.local — senha ${SENHA}`,
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
