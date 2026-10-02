'use server'

import { randomBytes, createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { clienteServidor } from '../conta'
import { clienteAdmin } from '../supabase'
import { ehSuporte } from '../suporte/consultas'
import { envia } from '../email/brevo'
import { urlDoApp } from '../url'
import { montaRedefinicao } from '@/core/email/redefinir'
import { contaInterna, pessoasDoAuth } from './consultas'

/**
 * As ações da área de administração.
 *
 * Toda uma começa em `exigirAdmin`: ação de servidor é endereço público, e o
 * layout de `/admin` não protege nada que não seja tela. E toda uma deixa linha
 * em `log_configuracao` com `porSuporte`, que é o que `/admin/log` lê.
 */
async function exigirAdmin() {
  const db = await clienteServidor()
  if (!(await ehSuporte(db))) throw new Error('essa área é da equipe 4YU')
  const { data: { user } } = await db.auth.getUser()
  return { usuarioId: user!.id }
}

/**
 * Registra uma ação sobre usuário.
 *
 * Usuário não pertence a conta nenhuma, mas a tabela de log exige uma: a linha
 * mora na conta interna, que é da própria 4YU. `oQue` é a frase que o log
 * mostra, porque `acao` é de lista fechada e "editou" não diz que foi a senha.
 */
async function registrar(
  porUsuarioId: string,
  alvo: { id: string; email: string },
  acao: 'criou' | 'editou' | 'desativou' | 'reativou' | 'removeu',
  oQue: string,
) {
  const admin = clienteAdmin()
  const interna = await contaInterna(admin)
  const { error } = await admin.from('log_configuracao').insert({
    conta_id: interna.id,
    entidade: 'usuario_conta',
    entidade_id: alvo.id,
    acao,
    detalhe: { porSuporte: true, alvo: alvo.email, oQue },
    por_usuario_id: porUsuarioId,
  })
  if (error) throw error
}

async function emailDe(usuarioId: string): Promise<string> {
  const { data, error } = await clienteAdmin().auth.admin.getUserById(usuarioId)
  if (error || !data.user) throw new Error('usuário não encontrado')
  return data.user.email ?? ''
}

/** Quantos admins ativos existem, para nunca deixar a plataforma sem nenhum. */
async function admins(): Promise<string[]> {
  const admin = clienteAdmin()
  const interna = await contaInterna(admin)
  const { data, error } = await admin.from('usuario_conta')
    .select('usuario_id')
    .eq('conta_id', interna.id).eq('papel', 'suporte').eq('ativo', true)
  if (error) throw error
  return (data ?? []).map((l) => l.usuario_id)
}

const MINUTOS_DO_LINK = 24 * 60

/**
 * Gera o link de senha nova e tenta mandar por e-mail.
 *
 * Devolve o link sempre: e-mail que não chega é o motivo mais comum de alguém
 * pedir ajuda, e o admin precisa poder mandar pelo WhatsApp. O convite de
 * `tipo: 'senha'` é o mesmo do "esqueci a senha": não concede papel, só troca a
 * senha de quem já existe.
 */
export async function linkDeSenha(usuarioId: string): Promise<{ link: string; enviado: boolean }> {
  const { usuarioId: eu } = await exigirAdmin()
  const admin = clienteAdmin()
  const email = (await emailDe(usuarioId)).toLowerCase()

  // a conta é só a dona da linha; qualquer vínculo da pessoa serve
  const { data: vinculo } = await admin.from('usuario_conta')
    .select('conta_id').eq('usuario_id', usuarioId).limit(1).maybeSingle()
  if (!vinculo) throw new Error('essa pessoa não tem conta na Verandi')

  // o endereço sai antes de mexer em convite: se faltar `APP_URL`, o erro
  // aparece sem ter revogado o link que a pessoa talvez já tenha recebido
  const base = urlDoApp()

  // o link novo substitui os anteriores: dois links válidos ao mesmo tempo é
  // um a mais para vazar
  await admin.from('convite')
    .update({ revogado_em: new Date().toISOString() })
    .eq('email', email).eq('tipo', 'senha')
    .is('aceito_em', null).is('revogado_em', null)

  const token = randomBytes(32).toString('base64url')
  const { error } = await admin.from('convite').insert({
    conta_id: vinculo.conta_id,
    email,
    papel: 'profissional', // não concede nada: `tipo: 'senha'` ignora o papel
    tipo: 'senha',
    token_hash: createHash('sha256').update(token).digest('hex'),
    criado_por_usuario_id: eu,
    expira_em: new Date(Date.now() + MINUTOS_DO_LINK * 60_000).toISOString(),
  })
  if (error) throw error

  const link = `${base}/convite/${token}`
  const conteudo = montaRedefinicao({ link, minutosAteExpirar: MINUTOS_DO_LINK })
  const enviado = await envia({
    para: email, de: null,
    assunto: conteudo.assunto, html: conteudo.html, texto: conteudo.texto,
  }).catch(() => false)

  await registrar(eu, { id: usuarioId, email }, 'editou', `gerou link de senha para ${email}`)
  return { link, enviado }
}

/**
 * Suspende ou devolve o acesso de uma pessoa à Verandi inteira.
 *
 * É o banimento do Auth, que barra o login e a renovação da sessão. Quem já
 * estava dentro sai quando o token vence, em até uma hora. Os vínculos ficam
 * como estavam: devolver o acesso devolve tudo, sem ninguém precisar lembrar
 * em quais contas a pessoa trabalhava.
 *
 * O Auth é do projeto inteiro, e isto só é seguro porque o AutoFluxos não entra
 * por ele (tem login próprio). Ver `docs/ADMIN.md`.
 */
export async function suspenderUsuario(usuarioId: string, suspender: boolean): Promise<void> {
  const { usuarioId: eu } = await exigirAdmin()
  if (usuarioId === eu) throw new Error('você não pode suspender o próprio acesso')
  if (suspender && (await admins()).includes(usuarioId)) {
    throw new Error('tire o acesso de admin antes de suspender')
  }

  const email = await emailDe(usuarioId)
  const { error } = await clienteAdmin().auth.admin.updateUserById(usuarioId, {
    // cem anos: o Auth não tem "para sempre", e `none` é o que desfaz
    ban_duration: suspender ? '876000h' : 'none',
  })
  if (error) throw error

  await registrar(
    eu, { id: usuarioId, email }, suspender ? 'desativou' : 'reativou',
    suspender ? `suspendeu o acesso de ${email}` : `devolveu o acesso de ${email}`,
  )
  revalidatePath('/admin', 'layout')
}

/**
 * Dá ou tira o acesso de admin.
 *
 * Admin é o vínculo `suporte` na conta interna. Tirar desliga a linha em vez de
 * apagar, como em qualquer vínculo do produto, e nunca deixa a plataforma sem
 * admin: sem nenhum, só um script consegue criar o próximo.
 */
export async function definirAdmin(usuarioId: string, admin: boolean): Promise<void> {
  const { usuarioId: eu } = await exigirAdmin()
  if (!admin && usuarioId === eu) throw new Error('você não pode tirar o próprio acesso de admin')

  const db = clienteAdmin()
  const interna = await contaInterna(db)
  const email = await emailDe(usuarioId)

  if (!admin) {
    const atuais = await admins()
    if (atuais.length <= 1 && atuais.includes(usuarioId)) {
      throw new Error('a plataforma precisa de pelo menos um admin')
    }
  }

  const { error } = await db.from('usuario_conta').upsert({
    usuario_id: usuarioId, conta_id: interna.id, papel: 'suporte', ativo: admin,
  }, { onConflict: 'usuario_id,conta_id' })
  if (error) throw error

  await registrar(
    eu, { id: usuarioId, email }, admin ? 'criou' : 'removeu',
    admin ? `deu acesso de admin a ${email}` : `tirou o acesso de admin de ${email}`,
  )
  revalidatePath('/admin', 'layout')
}

/**
 * Cadastra um admin novo, ou promove quem já tem login.
 *
 * Quem já existe no Auth só ganha o vínculo, e a senha dele não muda. Quem não
 * existe nasce com e-mail confirmado e a senha digitada aqui, porque o admin
 * novo é alguém da própria 4YU, e o convite por e-mail esbarraria na regra de
 * que `suporte` não é papel convidável.
 */
export async function novoAdmin(entrada: { email: string; senha: string }): Promise<{ criado: boolean }> {
  const { usuarioId: eu } = await exigirAdmin()
  const email = entrada.email.trim().toLowerCase()
  if (!email.includes('@')) throw new Error('confira o e-mail digitado')

  const existentes = await pessoasDoAuth()
  const ja = [...existentes.values()].find((p) => p.email.toLowerCase() === email)

  let usuarioId = ja?.id
  if (!usuarioId) {
    if (entrada.senha.length < 8) throw new Error('a senha precisa de pelo menos 8 caracteres')
    const { data, error } = await clienteAdmin().auth.admin.createUser({
      email, password: entrada.senha, email_confirm: true,
    })
    if (error) throw error
    usuarioId = data.user.id
  }

  const db = clienteAdmin()
  const interna = await contaInterna(db)
  const { error } = await db.from('usuario_conta').upsert({
    usuario_id: usuarioId, conta_id: interna.id, papel: 'suporte', ativo: true,
  }, { onConflict: 'usuario_id,conta_id' })
  if (error) throw error

  await registrar(eu, { id: usuarioId, email }, 'criou',
    ja ? `deu acesso de admin a ${email}` : `cadastrou ${email} como admin`)
  revalidatePath('/admin', 'layout')
  return { criado: !ja }
}

/** Corrige o nome e o fuso de uma conta de cliente. */
export async function editarConta(
  contaId: string, entrada: { nome: string; fuso: string },
): Promise<void> {
  const { usuarioId: eu } = await exigirAdmin()
  const nome = entrada.nome.trim()
  const fuso = entrada.fuso.trim()
  if (!nome) throw new Error('a conta precisa de nome')
  try {
    // fuso inválido quebraria toda conta de "hoje" da conta inteira
    new Intl.DateTimeFormat('pt-BR', { timeZone: fuso })
  } catch {
    throw new Error('fuso desconhecido; use o formato America/Sao_Paulo')
  }

  const db = clienteAdmin()
  const { data: alvo } = await db.from('conta').select('interna').eq('id', contaId).single()
  if (!alvo || alvo.interna) throw new Error('a conta da 4YU não é conta de cliente')

  const { error } = await db.from('conta').update({ nome, fuso }).eq('id', contaId)
  if (error) throw error

  await db.from('log_configuracao').insert({
    conta_id: contaId, entidade: 'conta', entidade_id: contaId, acao: 'editou',
    detalhe: { porSuporte: true, nome, fuso, oQue: 'editou os dados da conta' },
    por_usuario_id: eu,
  })
  revalidatePath('/admin', 'layout')
}
