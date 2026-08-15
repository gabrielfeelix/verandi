'use server'

import { randomBytes, createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { clienteAdmin } from '@/server/supabase'
import { envia } from '@/server/email/brevo'
import { urlDoApp } from '@/server/url'
import { montaRedefinicao } from '@/core/email/redefinir'

/**
 * "Esqueci a senha", sem sessão e sem ninguém do estúdio no meio.
 *
 * Substitui o `recover` do Supabase Auth, que ficou inutilizável: o rastreio de
 * clique do Brevo reescreve todo link e não pode ser desligado, e o token do
 * Supabase é consumido no GET. O rastreador abria o link antes da pessoa e ela
 * recebia `otp_expired`. O nosso token só é consumido no POST que grava a
 * senha, então robô que abre a página não quebra nada.
 *
 * O link continua existindo pelo caminho antigo, em Configuração > Usuários:
 * quem não recebe e-mail ainda é atendido por quem convidou.
 */

const MINUTOS = 30

export type EstadoEsqueci = { erro: string } | null

/**
 * Sempre leva para `/enviado`, exista o e-mail ou não.
 *
 * Responder diferente para e-mail que existe entrega, para quem só tem um
 * formulário, a lista de quem trabalha no estúdio. É a mesma regra do erro de
 * login, e vale mais aqui: esta tela é pública e não pede senha nenhuma.
 */
export async function pedirSenhaNova(
  _anterior: EstadoEsqueci, form: FormData,
): Promise<EstadoEsqueci> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) return { erro: 'confira o e-mail digitado' }

  try {
    await mandaSeExistir(email)
  } catch (e) {
    // falhar aqui não pode virar pista sobre o e-mail: registra e segue
    console.error('[esqueci] não deu para preparar a redefinição:', e)
  }

  redirect('/enviado')
}

async function mandaSeExistir(email: string): Promise<void> {
  const db = clienteAdmin()

  const usuarioId = await procuraUsuario(db, email)
  if (!usuarioId) return

  /*
   * O vínculo com alguma conta é o que define "é gente daqui". Usuário no Auth
   * sem vínculo nenhum não tem o que acessar, e mandar link para ele seria
   * confirmar a existência de um cadastro que não opera nada.
   *
   * A conta serve só de dono da linha: convite de senha não concede papel, e a
   * pessoa volta com o acesso que já tinha, em todas as contas dela.
   */
  const { data: vinculo } = await db
    .from('usuario_conta')
    .select('conta_id')
    .eq('usuario_id', usuarioId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  if (!vinculo) return

  /*
   * Um pedido em aberto por vez, por e-mail.
   *
   * Sem isto, um formulário público vira máquina de encher a caixa de entrada
   * de qualquer pessoa cujo e-mail alguém conheça, e ainda queima a cota diária
   * do Brevo. Quem pediu duas vezes usa o link que já recebeu; quem não recebeu
   * espera o prazo acabar, que é curto de propósito.
   */
  const { data: emAberto } = await db
    .from('convite')
    .select('id')
    .eq('email', email)
    .eq('tipo', 'senha')
    .is('aceito_em', null)
    .is('revogado_em', null)
    .gt('expira_em', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (emAberto) return

  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')

  const { error } = await db.from('convite').insert({
    conta_id: vinculo.conta_id,
    email,
    papel: 'profissional', // não concede nada: `tipo: 'senha'` ignora o papel
    tipo: 'senha',
    token_hash: hash,
    expira_em: new Date(Date.now() + MINUTOS * 60_000).toISOString(),
  })
  if (error) throw error

  const conteudo = montaRedefinicao({
    link: `${urlDoApp()}/convite/${token}`,
    minutosAteExpirar: MINUTOS,
  })
  await envia({
    para: email,
    de: null, // remetente fixo: a pessoa está olhando a tela da Verandi agora
    assunto: conteudo.assunto,
    html: conteudo.html,
    texto: conteudo.texto,
  })
}

/** `listUsers` não filtra por e-mail, então a busca é paginada. */
async function procuraUsuario(
  db: ReturnType<typeof clienteAdmin>, email: string,
): Promise<string | null> {
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw error
    const achado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (achado) return achado.id
    if (data.users.length < 200) return null
  }
  return null
}
