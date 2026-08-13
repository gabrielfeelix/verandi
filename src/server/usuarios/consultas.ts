import type { Db } from '../supabase'
import type { Papel } from '@/core/acesso/destino'

export type UsuarioLinha = {
  usuarioId: string
  email: string
  papel: Papel
  ativo: boolean
  ultimoAcesso: string | null
}

export type ConvitePendente = {
  id: string
  email: string
  papel: Papel
  tipo: 'acesso' | 'senha'
  criadoEm: string
  expiraEm: string
  expirado: boolean
}

/**
 * Quem tem acesso à conta.
 *
 * Passa pela função `usuarios_da_conta`, que lê `auth.users` com os direitos
 * dela e confere o papel de quem chamou. A alternativa seria a chave de serviço
 * na tela, que é o atalho que um dia vira vazamento.
 */
export async function listarUsuarios(db: Db, contaId: string): Promise<UsuarioLinha[]> {
  const { data, error } = await db.rpc('usuarios_da_conta', { p_conta: contaId })
  if (error) throw error

  // o cliente não tem os tipos do banco gerados, e o retorno de função ainda
  // não é inferido: a forma vem da própria migration
  const linhas = (data ?? []) as unknown as {
    usuario_id: string
    email: string
    papel: Papel
    ativo: boolean
    criado_em: string
    ultimo_acesso: string | null
  }[]

  return linhas.map((u) => ({
    usuarioId: u.usuario_id,
    email: u.email,
    papel: u.papel,
    ativo: u.ativo,
    ultimoAcesso: u.ultimo_acesso,
  }))
}

/** Convites em aberto — os aceitos e os revogados ficam fora da lista. */
export async function listarConvites(db: Db, contaId: string): Promise<ConvitePendente[]> {
  const { data, error } = await db
    .from('convite')
    .select('id, email, papel, tipo, criado_em, expira_em')
    .eq('conta_id', contaId)
    .is('aceito_em', null)
    .is('revogado_em', null)
    .order('criado_em', { ascending: false })
    .returns<{
      id: string; email: string; papel: Papel; tipo: 'acesso' | 'senha'
      criado_em: string; expira_em: string
    }[]>()

  if (error) throw error

  const agora = Date.now()
  return (data ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    papel: c.papel,
    tipo: c.tipo,
    criadoEm: c.criado_em,
    expiraEm: c.expira_em,
    expirado: new Date(c.expira_em).getTime() <= agora,
  }))
}
