import type { Db } from './supabase'

/**
 * O que aconteceu na conta e o dono precisa saber sem ir procurar.
 *
 * Não é log de auditoria: isso já existe na ficha e na sessão. É a resposta a
 * "o que mudou desde ontem": aula cancelada, aluno que avisou que não vem,
 * quem confirmou ou remarcou pelo WhatsApp, encaixe feito na recepção.
 *
 * O que entrou por importação de planilha fica de fora: histórico de um ano
 * trazido hoje não é novidade de hoje, e enchia o sino de faltas antigas.
 */
export type Notificacao = {
  id: string
  tipo: 'cancelada' | 'falta_avisada' | 'confirmada' | 'encaixe' | 'reposicao'
  /** quem fez, em destaque; vazio quando o assunto é a aula */
  quem: string
  /** o que aconteceu, depois do nome */
  texto: string
  detalhe: string
  /** ISO de quando aconteceu: ordena, agrupa e diz a hora */
  em: string
  /** veio do atendimento automático por WhatsApp */
  peloBot: boolean
  href: string
}

/** "MARIA BETANIA DA SILVA" vira "Maria Betania da Silva"; nome já escrito fica. */
export function nomeLegivel(nome: string): string {
  if (nome !== nome.toUpperCase()) return nome
  const miudas = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
  return nome.toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && miudas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

export async function notificacoesDaConta(
  db: Db, contaId: string, fuso = 'America/Sao_Paulo',
): Promise<Notificacao[]> {
  const desde = new Date(Date.now() - 7 * 864e5).toISOString()
  const agora = new Date().toISOString()

  const [canceladas, participacoes] = await Promise.all([
    db.from('sessao')
      .select('id, inicio, motivo_cancelamento, servico:servico_id(nome), profissional:profissional_id(nome)')
      .eq('conta_id', contaId).eq('status', 'cancelada')
      .gte('inicio', desde).order('inicio', { ascending: false }).limit(15),
    db.from('participacao')
      .select(`id, status, origem, registrado_em, registrado_por_origem, sessao_id,
               pessoa:pessoa_id(nome),
               sessao:sessao_id(inicio, servico:servico_id(nome))`)
      .eq('conta_id', contaId)
      .not('registrado_por_origem', 'in', '(importacao,sistema)')
      .gte('registrado_em', desde)
      .order('registrado_em', { ascending: false }).limit(60),
  ])

  const hora = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: fuso,
    }).format(new Date(iso)).replace('.', '')

  const lista: Notificacao[] = (canceladas.data ?? []).map((s) => ({
    id: `c-${s.id}`,
    tipo: 'cancelada' as const,
    quem: '',
    texto: `${s.servico?.nome ?? 'Aula'} de ${hora(s.inicio)} cancelada`,
    detalhe: [s.profissional?.nome, s.motivo_cancelamento].filter(Boolean).join(' · ')
      || 'Sem motivo registrado',
    // a sessão não guarda quando foi cancelada: vale a hora da aula, e a do
    // futuro vai para um grupo próprio no sino
    em: s.inicio,
    peloBot: false,
    href: `/sessao/${s.id}`,
  }))

  for (const p of participacoes.data ?? []) {
    const aula = p.sessao
      ? `${p.sessao.servico?.nome ?? 'Aula'}, ${hora(p.sessao.inicio)}` : ''
    const base = {
      quem: nomeLegivel(p.pessoa?.nome ?? 'Alguém'),
      detalhe: aula,
      em: p.registrado_em,
      peloBot: p.registrado_por_origem === 'bot',
      href: `/sessao/${p.sessao_id}`,
    }
    if (p.status === 'falta_avisada') {
      lista.push({ ...base, id: `f-${p.id}`, tipo: 'falta_avisada', texto: 'avisou que não vem', href: '/pendencias' })
    } else if (p.origem === 'reposicao' && (p.status === 'esperada' || p.status === 'confirmada')) {
      lista.push({ ...base, id: `r-${p.id}`, tipo: 'reposicao', texto: 'remarcou para outra aula' })
    } else if (p.status === 'confirmada') {
      lista.push({ ...base, id: `k-${p.id}`, tipo: 'confirmada', texto: 'confirmou presença' })
    } else if ((p.origem === 'encaixe' || p.origem === 'avulso') && p.status === 'esperada') {
      lista.push({ ...base, id: `e-${p.id}`, tipo: 'encaixe', texto: 'entrou numa aula' })
    }
  }

  const passadas = lista.filter((n) => n.em <= agora).sort((a, b) => b.em.localeCompare(a.em))
  const aFrente = lista.filter((n) => n.em > agora).sort((a, b) => a.em.localeCompare(b.em))
  return [...passadas.slice(0, 30), ...aFrente.slice(0, 10)]
}
