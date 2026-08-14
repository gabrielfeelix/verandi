/**
 * Provisiona uma conta com o dono já dentro, direto no banco de produção.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   node scripts/cria-conta.mjs "MGM Pilates" dono@exemplo.com [senha]
 *
 * É operação de bastidor, não produto. Existe porque hoje só a 4YU cria conta:
 * quem chega não tem por onde se cadastrar. Quando o auto-cadastro existir
 * (`docs/planos/06-cadastro-e-organizacoes.md`), este script vira ferramenta de
 * suporte, para quando alguém precisa de uma conta na mão.
 *
 * Cria também o mínimo para a conta não abrir vazia: um serviço, um local e o
 * funcionamento da semana. Conta sem nada disso não deixa criar horário nenhum,
 * e a primeira tela vira um beco. O vocabulário fica de fora de propósito: quem
 * escolhe as palavras é a dona, no onboarding.
 */
import { createClient } from '@supabase/supabase-js'

const [nome, email, senhaArg] = process.argv.slice(2)
if (!nome || !email?.includes('@')) {
  console.error('uso: node scripts/cria-conta.mjs "Nome do Negócio" dono@email.com [senha]')
  process.exit(1)
}

const URL = process.env.SUPABASE_URL ?? process.env.VERANDI_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !CHAVE) {
  console.error('faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente')
  process.exit(1)
}

const db = createClient(URL, CHAVE, {
  db: { schema: 'app_verandi' },
  auth: { persistSession: false, autoRefreshToken: false },
})

const senha = senhaArg ?? null
const slug = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function ou(r, oque) {
  if (r.error) throw new Error(`${oque}: ${r.error.message}`)
  return r.data
}

const conta = ou(
  await db.from('conta').insert({ nome, slug, fuso: 'America/Sao_Paulo' })
    .select('id').single(),
  'criar conta',
)
console.log(`conta   ${conta.id}  ${nome} (${slug})`)

/*
 * O vocabulário **não** é escrito aqui, e isso mudou em 14/08/2026.
 *
 * Antes este script gravava "Aluno", "Turma" e "Modalidade" em toda conta que
 * criava, o que é decidir que todo cliente da 4YU dá aula de pilates. Agora
 * quem escolhe é a dona, no primeiro passo do onboarding, e a conta chega aqui
 * falando as palavras neutras do sistema, que já cobrem todas as telas.
 *
 * Se alguém precisar de uma conta já com o vocabulário certo, o caminho é
 * Configuração, Vocabulário, com a pessoa junto, não uma tabela fixa dentro de
 * um script de bastidor.
 */

ou(await db.from('servico').insert([
  { conta_id: conta.id, nome: 'Pilates solo', duracao_min: 50, capacidade_padrao: 4 },
  { conta_id: conta.id, nome: 'Pilates aparelho', duracao_min: 50, capacidade_padrao: 4 },
  { conta_id: conta.id, nome: 'Personal', duracao_min: 50, capacidade_padrao: 1 },
]), 'serviços')

ou(await db.from('local').insert([
  { conta_id: conta.id, nome: 'Sala 1', capacidade: 4 },
  { conta_id: conta.id, nome: 'Sala 2', capacidade: 4 },
]), 'locais')

// segunda a sexta cheio, sábado de manhã, domingo fechado (fica de fora)
ou(await db.from('funcionamento').insert([
  ...[1, 2, 3, 4, 5].map((d) => ({ conta_id: conta.id, dia_semana: d, abre: '07:00', fecha: '20:00' })),
  { conta_id: conta.id, dia_semana: 6, abre: '08:00', fecha: '12:00' },
]), 'funcionamento')

console.log('base    3 serviços, 2 salas, funcionamento da semana')

/*
 * Usuário existente é reaproveitado: a mesma pessoa pode ser dona de dois
 * negócios, e falhar aqui porque o e-mail já existe no Auth seria inventar um
 * limite que o produto não tem.
 */
let usuarioId
const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
const achado = lista?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

if (achado) {
  usuarioId = achado.id
  if (senha) await db.auth.admin.updateUserById(usuarioId, { password: senha })
  console.log(`usuário ${usuarioId}  ${email} (já existia${senha ? ', senha trocada' : ''})`)
} else {
  const { data, error } = await db.auth.admin.createUser({
    email, password: senha ?? undefined, email_confirm: true,
  })
  if (error) throw error
  usuarioId = data.user.id
  console.log(`usuário ${usuarioId}  ${email} (criado)`)
}

ou(await db.from('usuario_conta').upsert(
  { usuario_id: usuarioId, conta_id: conta.id, papel: 'dono', ativo: true },
  { onConflict: 'usuario_id,conta_id' },
), 'vínculo')

console.log(`vínculo dono em ${nome}`)
console.log(`\npronto. Entre em ${process.env.APP_URL ?? 'https://verandi.4yu.com.br'}/entrar`)
if (!senha) console.log('sem senha definida: use "Esqueci a senha" para criar a primeira.')
