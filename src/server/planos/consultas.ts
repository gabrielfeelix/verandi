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
  /** contratos ativos ou pausados: a forma de cobrar deles vem daqui */
  contratosEmVigor: number
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
      id, codigo, nome, servico_id, recorrencia, parcelas, frequencia_semanal, horario_livre, dias_permitidos,
      sessoes_no_pacote, validade_meses, dias_licenca, preco_vinculado_cent,
      preco_avulso_cent, ativo, servico(nome, categoria)
    `)
    .eq('conta_id', contaId)
    .order('codigo')

  if (error) throw error

  const { data: vendidos, error: erroVendidos } = await db.from('contrato')
    .select('plano_id').eq('conta_id', contaId).neq('status', 'encerrado')
  if (erroVendidos) throw erroVendidos
  const emVigor = new Map<string, number>()
  for (const c of vendidos ?? []) emVigor.set(c.plano_id, (emVigor.get(c.plano_id) ?? 0) + 1)

  return (data ?? []).map((p) => ({
    contratosEmVigor: emVigor.get(p.id) ?? 0,
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    servicoId: p.servico_id,
    servicoNome: p.servico?.nome ?? '',
    categoria: p.servico?.categoria ?? null,
    recorrencia: p.recorrencia as Recorrencia,
    parcelas: p.parcelas,
    frequenciaSemanal: p.frequencia_semanal,
    horarioLivre: p.horario_livre,
    diasPermitidos: p.dias_permitidos,
    sessoesNoPacote: p.sessoes_no_pacote,
    validadeMeses: p.validade_meses,
    diasLicenca: p.dias_licenca,
    precoVinculadoCent: p.preco_vinculado_cent,
    precoAvulsoCent: p.preco_avulso_cent,
    ativo: p.ativo,
  }))
}
