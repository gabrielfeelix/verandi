/**
 * O catálogo do MGM Pilates, digitado do documento que o cliente mandou.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   node scripts/semeia-mgm.mjs --dry
 *   node scripts/semeia-mgm.mjs --confirmo
 *
 * A fonte é `SISTEMA ADMINISTRATIVO PARA STUDIO MGM PILATES.docx`, item 2. As
 * 43 linhas de lá viram 29 planos em 9 serviços, porque "aluno MGM" e "não
 * aluno MGM" são os **dois preços da mesma linha**, e não dois planos: dois
 * planos fariam o recibo dizer o nome errado e o relatório somar serviço com
 * serviço. `preco_vinculado_cent` é o preço de quem já é aluno;
 * `preco_avulso_cent`, o de quem não é. Onde o documento dá um preço só, os
 * dois campos recebem o mesmo valor.
 *
 * O que está escrito aqui é o que o documento diz, inclusive onde ele se
 * contradiz. As anomalias estão anotadas no próprio plano, em comentário, e
 * são perguntas para o cliente — documento de cliente não se corrige de
 * memória, e duas delas são dinheiro cobrado errado toda vez.
 *
 * A janela da aula experimental vem de outro lugar: o recado do Eduardo de
 * 09/set, traduzido em `tests/unit/grade-mgm.test.ts`. Ela vale só para o
 * Pilates aparelho — as outras modalidades não têm experimental.
 *
 * Roda uma vez, numa conta vazia. Não atualiza o que já existe: se o código do
 * plano já estiver lá, ele para e diz.
 */
const REF = process.env.VERANDI_SUPABASE_REF ?? 'xxxynoshwirupkdzwxbj'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const SLUG = 'mgm-pilates'
const SECO = !process.argv.includes('--confirmo')

if (!TOKEN) {
  console.error('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
  process.exit(1)
}

/**
 * A grade da aula experimental, como o Daniel a descreveu por recado. O índice
 * 0 é domingo. Segunda, quinta e sexta abrem 7h–12h e 14h–21h; terça é igual,
 * menos as 10h (tem personal, não sobra professor) e as 12h; quarta só das 15h
 * em diante; fim de semana não tem.
 */
const JANELA_EXPERIMENTAL = {
  dias: [
    [],
    [{ de: '07:00', ate: '12:00' }, { de: '14:00', ate: '21:00' }],
    [{ de: '07:00', ate: '10:00' }, { de: '11:00', ate: '12:00' }, { de: '13:00', ate: '21:00' }],
    [{ de: '15:00', ate: '21:00' }],
    [{ de: '07:00', ate: '12:00' }, { de: '14:00', ate: '21:00' }],
    [{ de: '07:00', ate: '12:00' }, { de: '14:00', ate: '21:00' }],
    [],
  ],
}

/**
 * `capacidade_padrao` é quanta gente cabe numa sessão. Pilates aparelho é aula
 * em grupo; o resto é atendimento individual. O número do aparelho está por
 * confirmar com o cliente — a lista de turma dele diria, e ela não está aqui.
 */
const SERVICOS = [
  { nome: 'Pilates aparelho', categoria: 'Pilates', duracao_min: 60, capacidade_padrao: 5, experimental: true },
  { nome: 'Personal Pilates', categoria: 'Pilates', duracao_min: 60, capacidade_padrao: 1 },
  { nome: 'Fisioterapia', categoria: 'Fisioterapia', duracao_min: 60, capacidade_padrao: 1 },
  { nome: 'RPG', categoria: 'Fisioterapia', duracao_min: 60, capacidade_padrao: 1 },
  { nome: 'Drenagem Linfática', categoria: 'Terapias', duracao_min: 60, capacidade_padrao: 1 },
  { nome: 'Ventosaterapia', categoria: 'Terapias', duracao_min: 60, capacidade_padrao: 1 },
  // A grafia é a do cliente, de propósito: "Miofacial" e "Tensigridade" estão
  // escritos assim no documento dele. Corrigir a palavra do cliente é decisão
  // dele, não nossa.
  { nome: 'Liberação Miofacial', categoria: 'Terapias', duracao_min: 60, capacidade_padrao: 1 },
  { nome: 'Massagem Relaxante', categoria: 'Terapias', duracao_min: 60, capacidade_padrao: 1 },
  { nome: 'Toque de Tensigridade', categoria: 'Terapias', duracao_min: 60, capacidade_padrao: 1 },
]

const real = (n) => Math.round(n * 100)

/**
 * Um plano por linha do documento. `vinculado` é o preço de aluno MGM;
 * `avulso`, o de quem não é. `parcelas` é o parcelamento que o próprio
 * documento escreve ("6x588"), e o preço é o total.
 */
const PLANOS = [
  // Pilates aparelho — preço único, não muda por ser aluno.
  { cod: '001', servico: 'Pilates aparelho', nome: 'Mensal 1x semana', recorrencia: 'mensal', parcelas: 1, freq: 1, total: 450 },
  { cod: '002', servico: 'Pilates aparelho', nome: 'Mensal 2x semana', recorrencia: 'mensal', parcelas: 1, freq: 2, total: 735 },
  { cod: '003', servico: 'Pilates aparelho', nome: 'Mensal 3x semana', recorrencia: 'mensal', parcelas: 1, freq: 3, total: 1040 },
  { cod: '004', servico: 'Pilates aparelho', nome: 'Trimestral 1x semana', recorrencia: 'trimestral', parcelas: 3, freq: 1, total: 1215 },
  { cod: '005', servico: 'Pilates aparelho', nome: 'Trimestral 2x semana', recorrencia: 'trimestral', parcelas: 3, freq: 2, total: 1980 },
  { cod: '006', servico: 'Pilates aparelho', nome: 'Trimestral 3x semana', recorrencia: 'trimestral', parcelas: 3, freq: 3, total: 2808 },
  { cod: '007', servico: 'Pilates aparelho', nome: 'Semestral 1x semana', recorrencia: 'semestral', parcelas: 6, freq: 1, total: 2160 },
  { cod: '008', servico: 'Pilates aparelho', nome: 'Semestral 2x semana', recorrencia: 'semestral', parcelas: 6, freq: 2, total: 3528 },
  { cod: '009', servico: 'Pilates aparelho', nome: 'Semestral 3x semana', recorrencia: 'semestral', parcelas: 6, freq: 3, total: 4992 },
  { cod: '010', servico: 'Pilates aparelho', nome: 'Anual 1x semana', recorrencia: 'anual', parcelas: 12, freq: 1, total: 4044 },
  { cod: '011', servico: 'Pilates aparelho', nome: 'Anual 2x semana', recorrencia: 'anual', parcelas: 12, freq: 2, total: 6600 },
  { cod: '012', servico: 'Pilates aparelho', nome: 'Anual 3x semana', recorrencia: 'anual', parcelas: 12, freq: 3, total: 9360 },
  { cod: '013', servico: 'Pilates aparelho', nome: 'Aula avulsa', recorrencia: 'avulsa', parcelas: 1, total: 100 },

  { cod: '014', servico: 'Personal Pilates', nome: 'Personal Pilates (1 aula)', recorrencia: 'avulsa', parcelas: 1, total: 230 },
  { cod: '015', servico: 'Personal Pilates', nome: 'Personal Pilates (pacote 10 aulas)', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, total: 2070 },

  // Daqui para baixo o documento dá dois preços por linha: aluno MGM e não aluno.
  { cod: '100', servico: 'Fisioterapia', nome: 'Fisioterapia — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 195, avulso: 230 },
  { cod: '101', servico: 'Fisioterapia', nome: 'Fisioterapia — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 1755, avulso: 2070 },

  { cod: '104', servico: 'RPG', nome: 'RPG — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 195, avulso: 230 },
  // ANOMALIA 1: o documento repete o código 104 na sessão e no pacote, e o 106
  // era o único livre do bloco. ANOMALIA 2: R$ 2.100 no pacote de não aluno —
  // todos os outros pacotes cobram nove sessões, e nove de 230 dá 2.070.
  { cod: '106', servico: 'RPG', nome: 'RPG — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 1755, avulso: 2100 },

  // ANOMALIA 3: o documento escreve "alunos MGM" nas quatro linhas de Drenagem.
  // As duas últimas são claramente o preço de quem não é aluno.
  { cod: '107', servico: 'Drenagem Linfática', nome: 'Drenagem Linfática — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 153, avulso: 180 },
  { cod: '108', servico: 'Drenagem Linfática', nome: 'Drenagem Linfática — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 1377, avulso: 1620 },

  { cod: '111', servico: 'Ventosaterapia', nome: 'Ventosaterapia — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 90, avulso: 105 },
  { cod: '112', servico: 'Ventosaterapia', nome: 'Ventosaterapia — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 810, avulso: 945 },

  { cod: '115', servico: 'Liberação Miofacial', nome: 'Liberação Miofacial — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 150, avulso: 176 },
  // ANOMALIA 4: R$ 810 no pacote de aluno. Nove sessões de 150 dariam 1.350, e
  // 810 é exatamente o pacote da Ventosaterapia, a linha de cima no documento.
  { cod: '116', servico: 'Liberação Miofacial', nome: 'Liberação Miofacial — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 810, avulso: 1584 },

  // ANOMALIA 5: o documento repete os códigos 119 e 120 nas quatro linhas de
  // Massagem, e escreve "alunos MGM" nas quatro. O segundo par é o não aluno.
  { cod: '119', servico: 'Massagem Relaxante', nome: 'Massagem Relaxante — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 153, avulso: 180 },
  { cod: '120', servico: 'Massagem Relaxante', nome: 'Massagem Relaxante — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 1377, avulso: 1620 },

  { cod: '150', servico: 'Toque de Tensigridade', nome: 'Toque de Tensigridade — sessão', recorrencia: 'avulsa', parcelas: 1, vinculado: 270, avulso: 300 },
  { cod: '151', servico: 'Toque de Tensigridade', nome: 'Toque de Tensigridade — pacote 10 sessões', recorrencia: 'pacote', parcelas: 1, sessoes: 10, validade: 6, vinculado: 2430, avulso: 2700 },
]

/** Os nomes que aparecem na lista de turma. Os dados de contato são do cliente. */
const PROFISSIONAIS = ['Márcia', 'Nathália', 'Pérsio']

/** O documento não diz quantas salas são; a lista de turma tem uma só em uso. */
const LOCAIS = [{ nome: 'Estúdio', capacidade: 5 }]

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'curl/8.5.0',
    },
    body: JSON.stringify({ query }),
  })
  const corpo = await r.json()
  if (!r.ok || corpo?.message) throw new Error(corpo?.message ?? `HTTP ${r.status}`)
  return corpo
}

const cita = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

const [conta] = await sql(`select id from app_verandi.conta where slug = '${SLUG}'`)
if (!conta) {
  console.error(`conta '${SLUG}' não encontrada`)
  process.exit(1)
}

const [{ n: jaTem }] = await sql(
  `select count(*)::int as n from app_verandi.plano where conta_id = '${conta.id}'`,
)
if (jaTem > 0) {
  console.error(`a conta já tem ${jaTem} planos. Zere antes, ou este script duplicaria o catálogo.`)
  process.exit(1)
}

console.log(`${SERVICOS.length} serviços · ${PLANOS.length} planos · ${PROFISSIONAIS.length} profissionais · ${LOCAIS.length} local\n`)
for (const p of PLANOS) {
  const v = p.total ?? p.vinculado
  const a = p.total ?? p.avulso
  console.log(`  ${p.cod}  ${p.nome.padEnd(42)} ${String(v).padStart(5)}${v === a ? '' : ` / ${a}`}`)
}

if (SECO) {
  console.log('\nensaio: nada foi gravado. Para valer: --confirmo')
  process.exit(0)
}

const comandos = ['begin;']

for (const s of SERVICOS) {
  comandos.push(
    `insert into app_verandi.servico (conta_id, nome, categoria, duracao_min, capacidade_padrao, ativo, aceita_experimental, janela_experimental)
     values ('${conta.id}', ${cita(s.nome)}, ${cita(s.categoria)}, ${s.duracao_min}, ${s.capacidade_padrao}, true, ${s.experimental ? 'true' : 'false'}, ${s.experimental ? `'${JSON.stringify(JANELA_EXPERIMENTAL)}'::jsonb` : 'null'});`,
  )
}

for (const p of PLANOS) {
  const vinculado = real(p.total ?? p.vinculado)
  const avulso = real(p.total ?? p.avulso)
  comandos.push(
    `insert into app_verandi.plano (conta_id, codigo, nome, servico_id, recorrencia, parcelas, frequencia_semanal, sessoes_no_pacote, validade_meses, preco_vinculado_cent, preco_avulso_cent, ativo)
     values ('${conta.id}', ${cita(p.cod)}, ${cita(p.nome)},
       (select id from app_verandi.servico where conta_id = '${conta.id}' and nome = ${cita(p.servico)}),
       ${cita(p.recorrencia)}, ${p.parcelas}, ${p.freq ?? 'null'}, ${p.sessoes ?? 'null'}, ${p.validade ?? 'null'}, ${vinculado}, ${avulso}, true);`,
  )
}

for (const nome of PROFISSIONAIS) {
  comandos.push(
    `insert into app_verandi.profissional (conta_id, nome, ativo) values ('${conta.id}', ${cita(nome)}, true);`,
  )
}

for (const l of LOCAIS) {
  comandos.push(
    `insert into app_verandi.local (conta_id, nome, capacidade, ativo) values ('${conta.id}', ${cita(l.nome)}, ${l.capacidade}, true);`,
  )
}

comandos.push('commit;')
await sql(comandos.join('\n'))

const [conferido] = await sql(
  `select (select count(*) from app_verandi.servico where conta_id = '${conta.id}')::int servicos,
          (select count(*) from app_verandi.plano where conta_id = '${conta.id}')::int planos,
          (select count(*) from app_verandi.profissional where conta_id = '${conta.id}')::int profissionais,
          (select count(*) from app_verandi.local where conta_id = '${conta.id}')::int locais`,
)
console.log('\ngravado:', conferido)
