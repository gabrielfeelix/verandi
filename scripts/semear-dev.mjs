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
    'entrar com dono@dev.local / prof@dev.local / recepcao@dev.local / ' +
    `suporte@dev.local — senha ${SENHA}`,
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
