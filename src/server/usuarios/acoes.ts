'use server'

import { randomBytes, createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { clienteAdmin } from '../supabase'
import { registrar } from '../log'
import { estadoDoConvite, type EstadoConvite } from '@/core/acesso/convite'
import type { Papel } from '@/core/acesso/destino'
import { PAPEIS_CONVIDAVEIS, type PapelConvidavel } from '@/core/acesso/papeis'

/**
 * Convite e senha.
 *
 * O token vive fora do banco: só o `sha256` dele é coluna, e o valor em claro
 * aparece uma vez, na tela de quem convidou. Guardar token legível é decisão que
 * só dói depois de vazar — e aí dói em todas as contas de uma vez.
 */

const DIAS_ATE_EXPIRAR = 7

function novoToken(): { token: string; hash: string } {
  // 32 bytes: o suficiente para que adivinhar não seja um caminho
  const token = randomBytes(32).toString('base64url')
  return { token, hash: createHash('sha256').update(token).digest('hex') }
}

function hashDe(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function exigirDono() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta gerencia acesso')
  }
  return conta
}

// ---------------------------------------------------------------------------
// Convidar
// ---------------------------------------------------------------------------

export async function convidar(entrada: {
  email: string
  papel: PapelConvidavel
}): Promise<{ id: string; token: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const email = entrada.email.trim().toLowerCase()
  if (!email.includes('@')) throw new Error('e-mail inválido')

  /*
   * `suporte` é o papel da 4YU: enxerga conta de cliente e entra como suporte.
   * Sem esta recusa, o dono de qualquer conta se promoveria a suporte
   * convidando o próprio e-mail — escalada de privilégio em dois cliques.
   */
  if (!PAPEIS_CONVIDAVEIS.includes(entrada.papel)) {
    throw new Error('esse papel não pode ser concedido por convite')
  }

  const { token, hash } = novoToken()
  const expira = new Date(Date.now() + DIAS_ATE_EXPIRAR * 864e5).toISOString()

  const { data: { user } } = await db.auth.getUser()
  const { data, error } = await db.from('convite').insert({
    conta_id: conta.contaId,
    email,
    papel: entrada.papel,
    tipo: 'acesso',
    token_hash: hash,
    criado_por_usuario_id: user?.id ?? null,
    expira_em: expira,
  }).select('id').single<{ id: string }>()

  if (error) {
    if (error.code === '23505') throw new Error('já existe convite em aberto para esse e-mail')
    throw error
  }

  await registrar(db, {
    contaId: conta.contaId, entidade: 'convite', entidadeId: data.id,
    acao: 'criou', detalhe: { email, papel: entrada.papel },
  })
  revalidatePath('/config')
  return { id: data.id, token }
}

/**
 * Gera um link para a pessoa definir uma senha nova.
 *
 * É o caminho de "esqueci a senha" sem depender de e-mail: o dono gera e manda
 * pelo WhatsApp. Quando o envio por e-mail existir, ele vira só mais um caminho
 * para o mesmo token.
 */
export async function gerarLinkDeSenha(usuarioId: string): Promise<{ token: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { data: usuarios, error: erroUsuarios } =
    await db.rpc('usuarios_da_conta', { p_conta: conta.contaId })
  if (erroUsuarios) throw erroUsuarios

  const lista = (usuarios ?? []) as unknown as { usuario_id: string; email: string }[]
  const alvo = lista.find((u) => u.usuario_id === usuarioId)
  if (!alvo) throw new Error('essa pessoa não tem acesso a esta conta')

  const { token, hash } = novoToken()
  const { data: { user } } = await db.auth.getUser()

  const { data, error } = await db.from('convite').insert({
    conta_id: conta.contaId,
    email: alvo.email,
    papel: 'profissional', // não concede nada: quem aceita já tem vínculo
    tipo: 'senha',
    token_hash: hash,
    criado_por_usuario_id: user?.id ?? null,
    expira_em: new Date(Date.now() + 864e5).toISOString(), // 24h para senha
  }).select('id').single<{ id: string }>()
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'usuario_conta', entidadeId: usuarioId,
    acao: 'editou', detalhe: { redefinicaoDeSenha: true, convite: data.id },
  })
  revalidatePath('/config')
  return { token }
}

export async function revogarConvite(id: string): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { error } = await db.from('convite')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', id).is('aceito_em', null)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'convite', entidadeId: id, acao: 'removeu',
  })
  revalidatePath('/config')
}

// ---------------------------------------------------------------------------
// Aceitar — roda sem sessão
// ---------------------------------------------------------------------------

export type ResultadoConvite =
  // o papel viaja junto porque a tela precisa dizer no que a pessoa está
  // entrando antes de ela aceitar: conta e papel, não só "você foi convidada"
  | { ok: true; contaNome: string; email: string; papel: Papel; tipo: string }
  | { ok: false; motivo: EstadoConvite }

type LinhaConvite = {
  id: string
  conta_id: string
  email: string
  papel: Papel
  tipo: 'acesso' | 'senha'
  expira_em: string
  aceito_em: string | null
  revogado_em: string | null
  conta: { nome: string } | null
}

/**
 * Lê o convite pelo token, sem sessão nenhuma.
 *
 * Usa a chave de serviço porque quem abre o link ainda não é ninguém no
 * sistema — e o token **é** a credencial. Nada aqui aceita identificador do
 * navegador: a única entrada é o token, e ele é comparado por hash.
 */
export async function lerConvite(token: string): Promise<ResultadoConvite> {
  const db = clienteAdmin()

  const { data } = await db.from('convite')
    .select('id, conta_id, email, papel, tipo, expira_em, aceito_em, revogado_em, conta:conta_id(nome)')
    .eq('token_hash', hashDe(token))
    .maybeSingle<LinhaConvite>()

  const estado = estadoDoConvite(
    data ? {
      expiraEm: data.expira_em,
      aceitoEm: data.aceito_em,
      revogadoEm: data.revogado_em,
    } : null,
    new Date(),
  )
  if (estado !== 'valido' || !data) return { ok: false, motivo: estado }

  return {
    ok: true,
    contaNome: data.conta?.nome ?? '',
    email: data.email,
    papel: data.papel,
    tipo: data.tipo,
  }
}

/**
 * Aceita o convite: cria o usuário (ou reaproveita o que já existe com aquele
 * e-mail), grava o vínculo com a conta, e marca o convite como usado.
 *
 * Reaproveitar importa: a mesma professora pode atender dois estúdios, e o
 * segundo convite não pode falhar porque o e-mail já existe no Auth.
 */
export async function aceitarConvite(
  token: string, senha: string,
): Promise<ResultadoConvite> {
  if (senha.length < 8) throw new Error('a senha precisa de ao menos 8 caracteres')

  const db = clienteAdmin()

  const { data: convite } = await db.from('convite')
    .select('id, conta_id, email, papel, tipo, expira_em, aceito_em, revogado_em, conta:conta_id(nome)')
    .eq('token_hash', hashDe(token))
    .maybeSingle<LinhaConvite>()

  const estado = estadoDoConvite(
    convite ? {
      expiraEm: convite.expira_em,
      aceitoEm: convite.aceito_em,
      revogadoEm: convite.revogado_em,
    } : null,
    new Date(),
  )
  if (estado !== 'valido' || !convite) return { ok: false, motivo: estado }

  const existente = await procurarUsuario(db, convite.email)

  let usuarioId: string
  if (existente) {
    usuarioId = existente
    const { error } = await db.auth.admin.updateUserById(usuarioId, { password: senha })
    if (error) throw error
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: convite.email, password: senha, email_confirm: true,
    })
    if (error) throw error
    usuarioId = data.user!.id
  }

  // convite de senha não concede papel nenhum: quem o usa já tem vínculo
  if (convite.tipo === 'acesso') {
    const { error } = await db.from('usuario_conta').upsert({
      usuario_id: usuarioId,
      conta_id: convite.conta_id,
      papel: convite.papel,
      ativo: true,
    }, { onConflict: 'usuario_id,conta_id' })
    if (error) throw error
  }

  const { error: erroMarca } = await db.from('convite').update({
    aceito_em: new Date().toISOString(),
    aceito_por_usuario_id: usuarioId,
  }).eq('id', convite.id)
  if (erroMarca) throw erroMarca

  return {
    ok: true,
    contaNome: convite.conta?.nome ?? '',
    email: convite.email,
    papel: convite.papel,
    tipo: convite.tipo,
  }
}

/** O Auth não tem busca por e-mail; a lista paginada é o caminho que existe. */
async function procurarUsuario(
  db: ReturnType<typeof clienteAdmin>, email: string,
): Promise<string | null> {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw error
    const achado = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (achado) return achado.id
    if (data.users.length < 200) return null
  }
  return null
}

// ---------------------------------------------------------------------------
// Papel e remoção
// ---------------------------------------------------------------------------

export async function mudarPapel(usuarioId: string, papel: PapelConvidavel): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  if (!PAPEIS_CONVIDAVEIS.includes(papel)) {
    throw new Error('esse papel não pode ser concedido')
  }

  const { data: { user } } = await db.auth.getUser()
  if (user?.id === usuarioId) {
    // trocar o próprio papel é como se trancar do lado de fora, ou se promover
    throw new Error('não dá para mudar o próprio papel')
  }

  await exigirOutroDono(db, conta.contaId, usuarioId, papel)

  const { error } = await db.from('usuario_conta')
    .update({ papel }).eq('conta_id', conta.contaId).eq('usuario_id', usuarioId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'usuario_conta', entidadeId: usuarioId,
    acao: 'editou', detalhe: { papel },
  })
  revalidatePath('/config')
}

/**
 * Remover é `ativo = false`.
 *
 * Nada do que a pessoa registrou é apagado: presença marcada por ela continua
 * marcada por ela. Se for profissional, o nome segue na grade — o que acaba é
 * o acesso ao sistema.
 */
export async function removerUsuario(usuarioId: string): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { data: { user } } = await db.auth.getUser()
  if (user?.id === usuarioId) throw new Error('não dá para remover o próprio acesso')

  await exigirOutroDono(db, conta.contaId, usuarioId, null)

  const { error } = await db.from('usuario_conta')
    .update({ ativo: false }).eq('conta_id', conta.contaId).eq('usuario_id', usuarioId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'usuario_conta', entidadeId: usuarioId,
    acao: 'removeu',
  })
  revalidatePath('/config')
}

/**
 * Conta sem dono é conta que ninguém configura, e o caminho de volta passa pela
 * 4YU. Barato de impedir agora, caro de socorrer depois.
 */
async function exigirOutroDono(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string,
  usuarioId: string,
  papelNovo: PapelConvidavel | null,
): Promise<void> {
  if (papelNovo === 'dono') return

  const { data, error } = await db.from('usuario_conta')
    .select('usuario_id, papel')
    .eq('conta_id', contaId).eq('ativo', true)
    .returns<{ usuario_id: string; papel: Papel }[]>()
  if (error) throw error

  const donos = (data ?? []).filter((u) => u.papel === 'dono')
  const ehDono = donos.some((u) => u.usuario_id === usuarioId)
  if (ehDono && donos.length <= 1) {
    throw new Error('esta conta ficaria sem dono — promova outra pessoa antes')
  }
}
