'use server'

import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { clienteServidor } from '../conta'
import { clienteAdmin } from '../supabase'
import { ehSuporte } from './consultas'

/**
 * As ações da 4YU.
 *
 * São as únicas que atravessam o isolamento entre clientes, e por isso são as
 * únicas que usam a chave de serviço fora da materialização. Toda uma delas
 * começa conferindo o papel — a RLS não tem como autorizar quem cria a própria
 * linha em `conta`, então a checagem é código, e precisa ser explícita.
 */
async function exigirSuporte() {
  const db = await clienteServidor()
  if (!(await ehSuporte(db))) throw new Error('essa área é da equipe 4YU')
  const { data: { user } } = await db.auth.getUser()
  return { db, usuarioId: user!.id }
}

/**
 * Cria a conta de um cliente e devolve o convite do dono.
 *
 * A conta nasce **vazia**: sem série, sem pessoa, sem sessão. E nasce com o
 * vocabulário padrão sem precisar de linha nenhuma em `vocabulario` — o padrão
 * é o que o `core/` responde quando a conta não configurou nada, e semear
 * cópias dele seria criar sete linhas que só existem para repetir o default.
 */
export async function criarConta(entrada: {
  nome: string
  slug: string
  fuso?: string
  emailDono: string
}): Promise<{ contaId: string; token: string }> {
  const { usuarioId } = await exigirSuporte()
  const admin = clienteAdmin()

  const nome = entrada.nome.trim()
  const slug = entrada.slug.trim().toLowerCase()
  const emailDono = entrada.emailDono.trim().toLowerCase()

  if (!nome) throw new Error('a conta precisa de nome')
  if (!/^[a-z0-9-]{3,}$/.test(slug)) {
    throw new Error('o identificador aceita letras minúsculas, números e hífen')
  }
  if (!emailDono.includes('@')) throw new Error('e-mail do dono inválido')

  const { data: conta, error } = await admin.from('conta').insert({
    nome, slug, fuso: entrada.fuso || 'America/Sao_Paulo', ativo: true,
  }).select('id').single<{ id: string }>()
  if (error) {
    if (error.code === '23505') throw new Error('já existe conta com esse identificador')
    throw error
  }

  const token = randomBytes(32).toString('base64url')
  const { error: erroConvite } = await admin.from('convite').insert({
    conta_id: conta.id,
    email: emailDono,
    papel: 'dono',
    tipo: 'acesso',
    token_hash: createHash('sha256').update(token).digest('hex'),
    criado_por_usuario_id: usuarioId,
    expira_em: new Date(Date.now() + 7 * 864e5).toISOString(),
  })
  if (erroConvite) throw erroConvite

  await admin.from('log_configuracao').insert({
    conta_id: conta.id, entidade: 'conta', entidade_id: conta.id,
    acao: 'criou', detalhe: { nome, slug, porSuporte: true },
    por_usuario_id: usuarioId,
  })

  revalidatePath('/contas-4yu')
  return { contaId: conta.id, token }
}

/**
 * Entra numa conta de cliente como suporte.
 *
 * Cria o vínculo se ele não existir, grava o começo do acesso, e troca a conta
 * ativa. Ver dado de cliente sem que ninguém saiba é o tipo de acesso que
 * precisa ser constrangedor de propósito: por isso a linha em `acesso_suporte`
 * é escrita **antes** da primeira tela aparecer.
 */
export async function entrarComoSuporte(contaId: string): Promise<void> {
  const { usuarioId } = await exigirSuporte()
  const admin = clienteAdmin()

  const { error: erroVinculo } = await admin.from('usuario_conta').upsert({
    usuario_id: usuarioId, conta_id: contaId, papel: 'suporte', ativo: true,
  }, { onConflict: 'usuario_id,conta_id' })
  if (erroVinculo) throw erroVinculo

  const { error } = await admin.from('acesso_suporte')
    .insert({ conta_id: contaId, usuario_id: usuarioId })
  if (error) throw error

  const jar = await cookies()
  jar.set('conta', contaId, { httpOnly: true, sameSite: 'lax', path: '/' })
  revalidatePath('/', 'layout')
}

/** Fecha o acesso: encerra o registro e desfaz o vínculo temporário. */
export async function sairDoSuporte(): Promise<void> {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return

  const jar = await cookies()
  const contaId = jar.get('conta')?.value
  if (!contaId) return

  const admin = clienteAdmin()

  const { data: aberto } = await admin.from('acesso_suporte')
    .select('id').eq('conta_id', contaId).eq('usuario_id', user.id)
    .is('encerrado_em', null)
    .order('iniciado_em', { ascending: false })
    .limit(1)
    .returns<{ id: string }[]>()

  if (aberto?.length) {
    await admin.from('acesso_suporte')
      .update({ encerrado_em: new Date().toISOString() }).eq('id', aberto[0].id)
  }

  // o vínculo era temporário: sai junto, para a conta não continuar na lista
  await admin.from('usuario_conta')
    .delete().eq('usuario_id', user.id).eq('conta_id', contaId).eq('papel', 'suporte')

  jar.delete('conta')
  revalidatePath('/', 'layout')
}

/**
 * Suspender tira o acesso sem apagar dado.
 *
 * Cliente que sai leva a agenda dele junto no dia em que voltar — apagar seria
 * economizar linha e perder história.
 */
export async function suspenderConta(contaId: string, ativa: boolean): Promise<void> {
  const { usuarioId } = await exigirSuporte()
  const admin = clienteAdmin()

  const { error } = await admin.from('conta').update({ ativo: ativa }).eq('id', contaId)
  if (error) throw error

  await admin.from('log_configuracao').insert({
    conta_id: contaId, entidade: 'conta', entidade_id: contaId,
    acao: ativa ? 'reativou' : 'desativou', detalhe: { porSuporte: true },
    por_usuario_id: usuarioId,
  })

  revalidatePath('/contas-4yu')
}
