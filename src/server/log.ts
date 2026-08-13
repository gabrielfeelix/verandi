import type { Db } from './supabase'

export type EntidadeConfig =
  | 'serie' | 'servico' | 'profissional' | 'local' | 'vocabulario'
  | 'funcionamento' | 'excecao_calendario' | 'usuario_conta' | 'convite' | 'conta'

export type AcaoConfig =
  | 'criou' | 'editou' | 'duplicou' | 'encerrou' | 'desativou' | 'reativou' | 'removeu'

/**
 * Registra uma mudança de configuração.
 *
 * Falhar aqui **não derruba a ação**: perder a linha de log é ruim, desfazer uma
 * edição de grade que já foi gravada é pior — e sem transação de verdade entre
 * as duas escritas, escolher qual das duas manda é obrigatório. Escolhemos a
 * ação.
 */
export async function registrar(
  db: Db,
  entrada: {
    contaId: string
    entidade: EntidadeConfig
    entidadeId?: string | null
    acao: AcaoConfig
    detalhe?: Record<string, unknown>
  },
): Promise<void> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return

  await db.from('log_configuracao').insert({
    conta_id: entrada.contaId,
    entidade: entrada.entidade,
    entidade_id: entrada.entidadeId ?? null,
    acao: entrada.acao,
    detalhe: entrada.detalhe ?? {},
    por_usuario_id: user.id,
  })
}
