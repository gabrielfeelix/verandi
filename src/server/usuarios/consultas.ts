import type { Db } from '../supabase'
import type { Papel } from '@/core/acesso/destino'
import type { EstadoDeEntrega } from '@/core/email/entrega'

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
  /** `null` é "ainda não veio notícia", que não é o mesmo que "deu certo". */
  entrega: EstadoDeEntrega | null
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

  const linhas = data ?? []

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
  /*
   * `.returns<>()` pelas duas colunas de união: `papel` e `tipo` são `text` com
   * `check`, e o arquivo gerado diz `string` nos dois. É a informação que mora
   * na migration e não atravessa o gerador.
   */
  const { data, error } = await db
    .from('convite')
    .select('id, email, papel, tipo, criado_em, expira_em, entrega')
    .eq('conta_id', contaId)
    .is('aceito_em', null)
    .is('revogado_em', null)
    .order('criado_em', { ascending: false })
    .returns<{
      id: string; email: string; papel: Papel; tipo: ConvitePendente['tipo']
      criado_em: string; expira_em: string; entrega: ConvitePendente['entrega']
    }[]>()

  if (error) throw error

  const agora = Date.now()
  return (data ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    papel: c.papel,
    tipo: c.tipo,
    entrega: c.entrega,
    criadoEm: c.criado_em,
    expiraEm: c.expira_em,
    expirado: new Date(c.expira_em).getTime() <= agora,
  }))
}
