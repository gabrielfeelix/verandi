import type { Db } from './supabase'

export type Notificacao = {
  id: string
  tipo: 'cancelada' | 'falta_avisada' | 'encaixe' | 'reposicao'
  texto: string
  detalhe: string
  quando: string
  href: string
}

/**
 * O que aconteceu na conta e o dono precisa saber sem ir procurar.
 *
 * Não é log de auditoria — isso já existe na ficha e na sessão. É a resposta a
 * "o que mudou desde ontem": aula cancelada, aluno que avisou que não vem,
 * encaixe feito na recepção. Sem isto, quem descobre o cancelamento é o aluno
 * na porta fechada, e quem descobre o encaixe é o professor com uma pessoa a
 * mais na sala.
 *
 * Sete dias e vinte linhas, das mais novas para as mais velhas. Uma consulta
 * por tipo, porque são três perguntas diferentes ao banco e juntar isso numa
 * view seria manter uma view para uma lista que ninguém pagina.
 */
export async function notificacoesDaConta(
  db: Db, contaId: string,
): Promise<Notificacao[]> {
  const desde = new Date(Date.now() - 7 * 864e5).toISOString()

  const [canceladas, participacoes] = await Promise.all([
    db.from('sessao')
      .select('id, inicio, motivo_cancelamento, servico:servico_id(nome), profissional:profissional_id(nome)')
      .eq('conta_id', contaId).eq('status', 'cancelada')
      .gte('inicio', desde).order('inicio', { ascending: false }).limit(10),
    db.from('participacao')
      .select(`id, status, origem, registrado_em,
               pessoa:pessoa_id(nome),
               sessao:sessao_id(inicio, servico:servico_id(nome))`)
      .eq('conta_id', contaId)
      .in('status', ['falta_avisada'])
      .gte('registrado_em', desde)
      .order('registrado_em', { ascending: false }).limit(10),
  ])

  const quando = (iso: string) => {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
    if (dias === 0) return 'hoje'
    if (dias === 1) return 'ontem'
    return `há ${dias} dias`
  }
  const hora = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))

  const lista: Notificacao[] = [
    ...(canceladas.data ?? []).map((s) => ({
      id: `c-${s.id}`,
      tipo: 'cancelada' as const,
      texto: `${s.servico?.nome ?? 'Aula'} de ${hora(s.inicio)} foi cancelada`,
      detalhe: [s.profissional?.nome, s.motivo_cancelamento].filter(Boolean).join(' · ')
        || 'sem motivo registrado',
      quando: quando(s.inicio),
      href: `/sessao/${s.id}`,
    })),
    ...(participacoes.data ?? []).map((p) => ({
      id: `p-${p.id}`,
      tipo: 'falta_avisada' as const,
      texto: `${p.pessoa?.nome ?? 'Alguém'} avisou que não vem`,
      detalhe: p.sessao
        ? `${p.sessao.servico?.nome ?? ''} ${hora(p.sessao.inicio)}`.trim()
        : '',
      quando: quando(p.registrado_em),
      href: '/pendencias',
    })),
  ]

  return lista.slice(0, 20)
}
