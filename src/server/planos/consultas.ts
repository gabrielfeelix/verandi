import type { Db } from '../supabase'
import type { PlanoBase, Recorrencia } from '@/core/planos/plano'

export type PlanoLinha = PlanoBase & {
  id: string
  codigo: string
  nome: string
  servicoId: string
  servicoNome: string
  categoria: string | null
  ativo: boolean
}

/**
 * Todos os planos da conta, inclusive os desativados.
 *
 * A tela precisa dos dois: "só os inativos" é um filtro dela, e ir ao banco de
 * novo a cada troca de filtro faria a página piscar por uma decisão que já
 * está na mão de quem clicou.
 *
 * A ordem é por código, e não por nome, porque é por código que a tabela de
 * preços é lida em voz alta.
 */
export async function listarPlanos(db: Db, contaId: string): Promise<PlanoLinha[]> {
  const { data, error } = await db
    .from('plano')
    .select(`
      id, codigo, nome, servico_id, recorrencia, parcelas, frequencia_semanal,
      sessoes_no_pacote, validade_meses, preco_vinculado_cent,
      preco_avulso_cent, ativo, servico(nome, categoria)
    `)
    .eq('conta_id', contaId)
    .order('codigo')

  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    servicoId: p.servico_id,
    servicoNome: p.servico?.nome ?? '',
    categoria: p.servico?.categoria ?? null,
    recorrencia: p.recorrencia as Recorrencia,
    parcelas: p.parcelas,
    frequenciaSemanal: p.frequencia_semanal,
    sessoesNoPacote: p.sessoes_no_pacote,
    validadeMeses: p.validade_meses,
    precoVinculadoCent: p.preco_vinculado_cent,
    precoAvulsoCent: p.preco_avulso_cent,
    ativo: p.ativo,
  }))
}
