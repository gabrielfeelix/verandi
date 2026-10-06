/**
 * A conta "4YU TESTE" em produção: um estúdio inventado, cheio, para testar
 * todas as telas e botões sem encostar em cliente de verdade.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   npx tsx scripts/semeia-teste.mts            # cria, se não existir
 *   npx tsx scripts/semeia-teste.mts --recriar  # apaga só esta conta e cria de novo
 *
 * Só toca a conta de slug `4yu-teste`. Apagar é `delete` dessa conta, e o resto
 * cai em cascata dentro dela. A chave de serviço é lida na hora pela Management
 * API e não vai para disco nem para log.
 *
 * As datas saem de **hoje**: semear de novo na semana que vem dá a mesma forma
 * (passado com chamada feita, hoje em aberto, futuro marcado).
 *
 * Situações que a conta traz, para cada botão ter onde ser apertado:
 * - chamadas feitas nas duas últimas semanas, com presente, falta, falta
 *   avisada e licença; três aulas recentes sem chamada (Pendências);
 * - cinco licenças, uma em cada estado: volta atrasada, volta hoje, volta
 *   futura, sem data, e "voltou sem reagendar";
 * - reposições em aberto, e uma já remarcada;
 * - um horário lotado com duas pessoas na lista de espera;
 * - um encaixe, uma aula avulsa e uma aula cancelada pelo estúdio;
 * - um feriado na semana que vem;
 * - gente sem telefone, sem horário fixo, inativa, com etiqueta e observação;
 * - planos, contratos, cobranças em aberto, pagas, pela metade e canceladas;
 * - três logins (dono, recepção, professor) para testar cada papel.
 *
 * Nomes e telefones são inventados. Telefones com DDD 44 são de teste.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import type { Database } from '../src/server/banco.types'
import { materializarJanela } from '../src/server/agenda/materializar'

const REF = 'xxxynoshwirupkdzwxbj'
const SLUG = '4yu-teste'
const NOME = '4YU TESTE'
const FUSO = 'America/Sao_Paulo'
const RECRIAR = process.argv.includes('--recriar')

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('falta SUPABASE_ACCESS_TOKEN: carregue ../.secrets/4yu.env')

const chaves = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json()) as Array<{ name: string; api_key: string }>
const servico = chaves.find((k) => k.name === 'service_role')?.api_key
if (!servico) throw new Error('não achei a service_role do projeto')

const db = createClient<Database, 'app_verandi'>(`https://${REF}.supabase.co`, servico, {
  db: { schema: 'app_verandi' },
  auth: { persistSession: false, autoRefreshToken: false },
})

function ok<T>(r: { data: T; error: { message: string } | null }, oque: string): T {
  if (r.error) throw new Error(`${oque}: ${r.error.message}`)
  return r.data
}

/* ------------------------------------------------------------ datas */

const DIA = 864e5
const agora = new Date()
const hojeLocal = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora)
const somar = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10)
const mesAtras = (n: number) => {
  const [a, m] = hojeLocal.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 - n, 1)).toISOString().slice(0, 10)
}

/* ------------------------------------------------------------ conta */

const existente = ok(await db.from('conta').select('id').eq('slug', SLUG).maybeSingle(), 'procurar conta')
if (existente && !RECRIAR) {
  console.log(`a conta ${NOME} já existe (${existente.id}). Use --recriar para apagar e criar de novo.`)
  process.exit(0)
}
if (existente) {
  ok(await db.from('conta').delete().eq('id', existente.id), 'apagar conta anterior')
  console.log('conta anterior apagada')
}

const conta = ok(await db.from('conta').insert({
  nome: NOME, slug: SLUG, fuso: FUSO,
  razao_social: '4YU Teste Ltda',
  documento: '11222333000181',
  endereco_emitente: 'Rua de Teste, 100, Maringá, PR',
  telefone_emitente: '4433334444',
  minutos_minimos_cancelamento: 120,
}).select('id').single(), 'criar conta')
const contaId = conta.id

ok(await db.from('vocabulario').insert([
  { conta_id: contaId, chave: 'pessoa', singular: 'Aluno', plural: 'Alunos' },
  { conta_id: contaId, chave: 'serie', singular: 'Turma', plural: 'Turmas' },
  { conta_id: contaId, chave: 'sessao', singular: 'Aula', plural: 'Aulas' },
  { conta_id: contaId, chave: 'profissional', singular: 'Professor', plural: 'Professores' },
  { conta_id: contaId, chave: 'vaga', singular: 'Matrícula', plural: 'Matrículas' },
]), 'vocabulário')

ok(await db.from('funcionamento').insert([1, 2, 3, 4, 5].map((d) => ({
  conta_id: contaId, dia_semana: d, abre: '06:30', fecha: '21:00',
})).concat([{ conta_id: contaId, dia_semana: 6, abre: '07:00', fecha: '12:00' }])), 'funcionamento')

// um feriado na semana que vem: a grade precisa mostrar o dia fechado
const feriado = somar(hojeLocal, 8)
ok(await db.from('excecao_calendario').insert({
  conta_id: contaId, data: feriado, tipo: 'feriado', descricao: 'Feriado de teste',
}), 'feriado')

const profs = ok(await db.from('profissional').insert(
  [['Ana Teste', '#2F7D6D'], ['Bruno Teste', '#7A4FB5'], ['Carla Teste', '#C2410C'], ['Diego Teste', '#1D4ED8']]
    .map(([nome, cor]) => ({ conta_id: contaId, nome, cor })),
).select('id, nome'), 'professores')

const servicos = ok(await db.from('servico').insert([
  { conta_id: contaId, nome: 'Pilates aparelho', duracao_min: 60, capacidade_padrao: 3, categoria: 'Pilates' },
  { conta_id: contaId, nome: 'Pilates solo', duracao_min: 60, capacidade_padrao: 4, categoria: 'Pilates' },
  { conta_id: contaId, nome: 'Fisioterapia', duracao_min: 50, capacidade_padrao: 1, categoria: 'Terapias' },
]).select('id, nome'), 'serviços')
const [aparelho, solo, fisio] = servicos

const locais = ok(await db.from('local').insert([
  { conta_id: contaId, nome: 'Sala 1' },
  { conta_id: contaId, nome: 'Sala 2' },
]).select('id'), 'locais')

/* ------------------------------------------------------------ grade fixa */

const horas = ['07:00', '08:00', '09:00', '10:00', '12:00', '17:00', '18:00', '19:00']
const series: Database['app_verandi']['Tables']['serie']['Insert'][] = []
for (let dia = 1; dia <= 5; dia++) {
  for (const [i, hora] of horas.entries()) {
    const s = i % 4 === 3 ? fisio : i % 2 === 0 ? aparelho : solo
    series.push({
      conta_id: contaId, servico_id: s.id,
      profissional_id: profs[(dia + i) % profs.length].id,
      local_id: locais[s === solo ? 1 : 0].id,
      dia_semana: dia, hora_inicio: hora,
      duracao_min: s === fisio ? 50 : 60,
      capacidade: s === fisio ? 1 : s === aparelho ? 3 : 4,
      vigencia_inicio: mesAtras(3),
    })
  }
}
for (const hora of ['08:00', '09:00', '10:00']) {
  series.push({
    conta_id: contaId, servico_id: aparelho.id, profissional_id: profs[0].id,
    local_id: locais[0].id, dia_semana: 6, hora_inicio: hora, duracao_min: 60,
    capacidade: 3, vigencia_inicio: mesAtras(3),
  })
}
const seriesCriadas = ok(await db.from('serie').insert(series).select('id, capacidade, servico_id'), 'grade')

/* ------------------------------------------------------------ alunos */

const NOMES = [
  'Amanda Ribeiro', 'Bernardo Lima', 'Cecília Duarte', 'Daniel Fontes', 'Eduarda Paiva',
  'Felipe Couto', 'Gabriela Moura', 'Henrique Sales', 'Isabela Rocha', 'João Pedro Alves',
  'Karina Mendes', 'Leonardo Brito', 'Mariana Castro', 'Nicolas Farias', 'Olívia Prates',
  'Paulo Henrique Dias', 'Quitéria Nunes', 'Renata Lopes', 'Samuel Teixeira', 'Tatiane Borges',
  'Ursula Gomes', 'Vinícius Rangel', 'Wanda Pires', 'Xavier Monteiro', 'Yasmin Cardoso',
  'Zeca Andrade', 'Bianca Freitas', 'Caio Martins', 'Débora Serra', 'Enzo Tavares',
]
const pessoas = ok(await db.from('pessoa').insert(NOMES.map((nome, i) => ({
  conta_id: contaId,
  nome,
  // 1 em cada 5 sem telefone, e uma com telefone sem DDD: "Telefone incompleto"
  telefone: i % 5 === 4 ? null : i === 7 ? '999990007' : `449999900${String(i).padStart(2, '0')}`,
  email: i % 3 === 0 ? `aluno${i}@teste.4yu.com.br` : null,
  identificador_externo: i % 4 === 3 ? null : String(1000 + i),
  vencimento_plano: i % 7 === 0 ? somar(hojeLocal, 6) : i % 7 === 1 ? somar(hojeLocal, -20) : null,
  nascimento: `19${70 + (i % 25)}-0${1 + (i % 9)}-1${i % 9}`,
  // os dois últimos param: "Cadastro inativo"
  ativo: i < NOMES.length - 2,
  observacao: i === 2 ? 'Hérnia lombar: evitar flexão com carga. Liberada pelo médico em agosto.' : null,
}))).select('id, nome'), 'alunos')
const P = (i: number) => pessoas[i]

ok(await db.from('pessoa_tag').insert([
  { pessoa_id: P(4).id, conta_id: contaId, tag: 'gestante' },
  { pessoa_id: P(9).id, conta_id: contaId, tag: 'idoso' },
  { pessoa_id: P(2).id, conta_id: contaId, tag: 'lesão' },
]), 'etiquetas')

// matrículas: ocupa ~2/3 da grade; os índices 20 a 27 ficam sem horário fixo
const ativos = pessoas.slice(0, 20)
const vagas: Database['app_verandi']['Tables']['vaga']['Insert'][] = []
const vistos = new Set<string>()
let k = 0
for (const [si, s] of seriesCriadas.entries()) {
  // o primeiro aparelho de segunda fica lotado: é o horário da lista de espera
  const quantas = si === 0 ? s.capacidade : Math.max(1, Math.round(s.capacidade * 0.66))
  for (let q = 0; q < quantas; q++) {
    const pessoa = ativos[k++ % ativos.length]
    const chave = `${s.id}|${pessoa.id}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    vagas.push({ conta_id: contaId, serie_id: s.id, pessoa_id: pessoa.id, inicio: mesAtras(3) })
  }
}
ok(await db.from('vaga').insert(vagas), 'matrículas')

/* ------------------------------------------------------------ aulas */

const janelaDe = somar(hojeLocal, -14)
const janelaAte = somar(hojeLocal, 21)
const m = await materializarJanela(db as never, contaId, janelaDe, janelaAte, FUSO)
console.log(`${m.criadas} aulas · ${m.participacoesCriadas} presenças previstas`)

type Linha = { id: string; status: string; pessoa_id: string; sessao_id: string; inicio: string }
const parts = ok(await db.from('participacao')
  .select('id, status, pessoa_id, sessao_id, sessao:sessao_id(inicio)')
  .eq('conta_id', contaId), 'ler presenças')
  .map((p) => ({ ...p, inicio: (p.sessao as { inicio: string }).inicio })) as Linha[]
const sessoes = ok(await db.from('sessao').select('id, inicio, capacidade, servico_id, status')
  .eq('conta_id', contaId).order('inicio'), 'ler aulas')

const agoraIso = agora.toISOString()
const passadas = parts.filter((p) => p.inicio < agoraIso)
const futuras = parts.filter((p) => p.inicio >= agoraIso)

/*
 * A chamada do passado.
 *
 * As três aulas mais recentes que já acabaram ficam sem chamada, para
 * Pendências ter "chamada não feita". O resto recebe chamada: a maioria
 * presente, com falta, falta avisada e licença espalhadas.
 */
const sessoesPassadas = [...new Set(passadas.map((p) => p.sessao_id))]
const semChamada = new Set(sessoesPassadas.slice(-3))
const LICENCA = [P(10), P(11), P(12), P(13), P(14)].map((p) => p.id)

const porStatus: Record<string, string[]> = { presente: [], falta: [], falta_avisada: [], licenca: [] }
for (const [i, p] of passadas.entries()) {
  if (semChamada.has(p.sessao_id)) continue
  const status = LICENCA.includes(p.pessoa_id) && p.inicio >= somar(hojeLocal, -10)
    ? 'licenca'
    : i % 11 === 0 ? 'falta' : i % 13 === 0 ? 'falta_avisada' : 'presente'
  porStatus[status].push(p.id)
}
const registro = {
  registrado_por_origem: 'recepcao' as const,
  registrado_em: agoraIso,
}
for (const [status, ids] of Object.entries(porStatus)) {
  for (let i = 0; i < ids.length; i += 200) {
    ok(await db.from('participacao')
      .update({ status: status as 'presente', ...registro })
      .in('id', ids.slice(i, i + 200)), `chamada ${status}`)
  }
}
ok(await db.from('sessao').update({ status: 'realizada' })
  .in('id', sessoesPassadas.filter((s) => !semChamada.has(s))), 'aulas realizadas')
console.log(Object.entries(porStatus).map(([s, ids]) => `${ids.length} ${s}`).join(' · '))

/* ------------------------------------------------------------ licenças */

const licencas = [
  { pessoa: P(10), volta: somar(hojeLocal, -3), voltou: false },  // volta atrasada
  { pessoa: P(11), volta: hojeLocal, voltou: false },             // volta hoje
  { pessoa: P(12), volta: somar(hojeLocal, 12), voltou: false },  // volta futura
  { pessoa: P(13), volta: null, voltou: false },                  // sem data
  { pessoa: P(14), volta: somar(hojeLocal, 2), voltou: true },    // avisou que voltou
]
ok(await db.from('licenca').insert(licencas.map((l) => ({
  conta_id: contaId, pessoa_id: l.pessoa.id, inicio: somar(hojeLocal, -10),
  volta_prevista: l.volta,
  voltou_sem_reagendar_em: l.voltou ? new Date(agora.getTime() - 3600e3).toISOString() : null,
}))), 'licenças')

/* ------------------------------------------------------------ reposição */

// uma das faltas avisadas já foi remarcada numa aula futura com vaga
const avisada = porStatus.falta_avisada[0]
const comVaga = sessoes.find((s) => s.inicio > somar(hojeLocal, 2) && s.servico_id !== fisio.id &&
  futuras.filter((p) => p.sessao_id === s.id).length < s.capacidade)
if (avisada && comVaga) {
  const origem = parts.find((p) => p.id === avisada)!
  if (!futuras.some((p) => p.sessao_id === comVaga.id && p.pessoa_id === origem.pessoa_id)) {
    ok(await db.from('participacao').insert({
      conta_id: contaId, sessao_id: comVaga.id, pessoa_id: origem.pessoa_id,
      origem: 'reposicao', status: 'esperada', reposicao_de_id: avisada,
    }), 'reposição remarcada')
  }
}

/* ------------------------------------------------------------ espera, encaixe, avulso, cancelada */

const lotada = sessoes.find((s) => s.inicio > agoraIso &&
  futuras.filter((p) => p.sessao_id === s.id).length >= s.capacidade && s.servico_id === aparelho.id)
if (lotada) {
  ok(await db.from('espera').insert([P(20), P(21)].map((p) => ({
    conta_id: contaId, sessao_id: lotada.id, pessoa_id: p.id,
  }))), 'lista de espera')
}

const amanha = sessoes.filter((s) => s.inicio.slice(0, 10) === somar(hojeLocal, 1))
const livre = (s: { id: string; capacidade: number }) =>
  futuras.filter((p) => p.sessao_id === s.id).length < s.capacidade
const paraEncaixe = amanha.find((s) => s.servico_id === solo.id && livre(s))
if (paraEncaixe) {
  ok(await db.from('participacao').insert({
    conta_id: contaId, sessao_id: paraEncaixe.id, pessoa_id: P(22).id,
    origem: 'encaixe', status: 'esperada',
  }), 'encaixe')
}
const paraAvulso = amanha.find((s) => s.id !== paraEncaixe?.id && s.servico_id !== fisio.id && livre(s))
if (paraAvulso) {
  ok(await db.from('participacao').insert({
    conta_id: contaId, sessao_id: paraAvulso.id, pessoa_id: P(23).id,
    origem: 'avulso', status: 'confirmada',
  }), 'avulso')
}

const paraCancelar = sessoes.find((s) => s.inicio.slice(0, 10) === somar(hojeLocal, 3))
if (paraCancelar) {
  ok(await db.from('sessao').update({ status: 'cancelada', motivo_cancelamento: 'Professor em curso (teste)' })
    .eq('id', paraCancelar.id), 'aula cancelada')
}

/* ------------------------------------------------------------ financeiro */

const planos = ok(await db.from('plano').insert([
  { conta_id: contaId, servico_id: aparelho.id, codigo: '001', nome: 'Mensal, 1x por semana',
    recorrencia: 'mensal', parcelas: 1, frequencia_semanal: 1, preco_vinculado_cent: 33700, preco_avulso_cent: 33700 },
  { conta_id: contaId, servico_id: aparelho.id, codigo: '002', nome: 'Mensal, 2x por semana',
    recorrencia: 'mensal', parcelas: 1, frequencia_semanal: 2, preco_vinculado_cent: 52000, preco_avulso_cent: 52000 },
  { conta_id: contaId, servico_id: aparelho.id, codigo: '004', nome: 'Trimestral, 2x por semana',
    recorrencia: 'trimestral', parcelas: 3, frequencia_semanal: 2, preco_vinculado_cent: 147000, preco_avulso_cent: 147000 },
  { conta_id: contaId, servico_id: solo.id, codigo: '013', nome: 'Aula avulsa',
    recorrencia: 'avulsa', parcelas: 1, preco_vinculado_cent: 9000, preco_avulso_cent: 9000 },
  { conta_id: contaId, servico_id: fisio.id, codigo: '101', nome: 'Fisioterapia, pacote 10 sessões',
    recorrencia: 'pacote', parcelas: 1, sessoes_no_pacote: 10, validade_meses: 6,
    preco_vinculado_cent: 135000, preco_avulso_cent: 162000 },
]).select('id, codigo, recorrencia, parcelas, preco_vinculado_cent'), 'planos')

const contratos = ok(await db.from('contrato').insert(pessoas.slice(0, 14).map((p, i) => {
  const plano = planos[i % planos.length]
  const inicio = mesAtras(i % 3)
  return {
    conta_id: contaId, pessoa_id: p.id, plano_id: plano.id, inicio,
    dia_vencimento: [5, 10, 15][i % 3],
    preco_aplicado_cent: plano.preco_vinculado_cent,
    sessoes_contratadas: plano.recorrencia === 'pacote' ? 10 : null,
    forma_pagamento: (['pix', 'dinheiro', 'credito'] as const)[i % 3],
    criado_em: `${inicio}T09:00:00Z`,
  }
})).select('id, pessoa_id, plano_id, dia_vencimento, preco_aplicado_cent'), 'contratos')

const cobrancas: Database['app_verandi']['Tables']['cobranca']['Insert'][] = []
for (const [i, c] of contratos.entries()) {
  const plano = planos.find((x) => x.id === c.plano_id)!
  const meses = plano.recorrencia === 'mensal' || plano.recorrencia === 'trimestral' ? 3 : 1
  for (let mm = 0; mm < meses; mm++) {
    const competencia = mesAtras(mm)
    cobrancas.push({
      conta_id: contaId, contrato_id: c.id, pessoa_id: c.pessoa_id, competencia,
      vencimento: `${competencia.slice(0, 8)}${String(c.dia_vencimento).padStart(2, '0')}`,
      valor_cent: Math.floor(c.preco_aplicado_cent / (plano.parcelas || 1)),
      status: i === 13 && mm === 0 ? 'cancelada' : 'aberta',
      motivo_cancelamento: i === 13 && mm === 0 ? 'cortesia (teste)' : null,
    })
  }
}
const cobrancasCriadas = ok(await db.from('cobranca').insert(cobrancas)
  .select('id, valor_cent, competencia, status'), 'cobranças')

const pagamentos = cobrancasCriadas
  .filter((c, i) => c.status !== 'cancelada' && (c.competencia !== mesAtras(0) || i % 3 === 0))
  .map((c, i) => ({
    conta_id: contaId, cobranca_id: c.id,
    valor_cent: i % 6 === 0 ? Math.floor(c.valor_cent / 2) : c.valor_cent,
    forma: (['pix', 'dinheiro', 'credito', 'transferencia'] as const)[i % 4],
    recebido_em: somar(hojeLocal, -(i % 25)),
  }))
ok(await db.from('pagamento').insert(pagamentos), 'pagamentos')

/* ------------------------------------------------------------ logins */

async function acharUsuario(email: string) {
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 })
    const achado = data.users.find((u) => u.email === email)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
  return null
}

const senha = `Teste-${randomBytes(4).toString('hex')}`
const logins: Array<[string, 'dono' | 'recepcao' | 'profissional', string]> = [
  ['dono@teste.4yu.com.br', 'dono', 'Edu (dono)'],
  ['recepcao@teste.4yu.com.br', 'recepcao', 'Edu (recepção)'],
  ['professor@teste.4yu.com.br', 'profissional', 'Edu (professor)'],
]
for (const [email, papel, nome] of logins) {
  const achado = await acharUsuario(email)
  let id = achado?.id
  if (id) {
    ok(await db.auth.admin.updateUserById(id, { password: senha }), `senha ${email}`)
  } else {
    id = ok(await db.auth.admin.createUser({ email, password: senha, email_confirm: true }),
      `criar ${email}`).user!.id
  }
  ok(await db.from('usuario_conta').upsert(
    { usuario_id: id, conta_id: contaId, papel, nome, ativo: true },
    { onConflict: 'usuario_id,conta_id' },
  ), `vínculo ${email}`)
  // o professor de teste é a Ana: a tela Hoje dele mostra as aulas dela
  if (papel === 'profissional') {
    ok(await db.from('profissional').update({ usuario_id: id }).eq('id', profs[0].id), 'ligar professor')
  }
}

console.log(`\nconta ${NOME} · ${contaId}`)
console.log(`${seriesCriadas.length} turmas · ${pessoas.length} alunos · ${vagas.length} matrículas · ${contratos.length} contratos`)
console.log(`logins (senha ${senha}):`)
for (const [email, papel] of logins) console.log(`  ${papel.padEnd(12)} ${email}`)
