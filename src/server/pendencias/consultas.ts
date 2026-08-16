import type { Db } from '../supabase'
import { hojeEm, instante, localDe } from '../agenda/fuso'
import { estadoDaChamada } from '@/core/agenda/chamada'
import { statusComCredito, type StatusParticipacao } from '@/core/agenda/ocupacao'

/**
 * O inbox de quem opera: o que exige ação humana hoje.
 *
 * Nenhum grupo é coluna. Cada um é uma consulta sobre o dado que já existe —
 * coluna de estado derivado é coluna que um dia mente. O que se grava é o ato
 * de dispensar.
 */

export type TipoPendencia =
  | 'chamada_nao_feita'
  | 'reposicao_aberta'
  | 'reserva_esperando'
  | 'cadastro_incompleto'

export type Pendencia = {
  tipo: TipoPendencia
  referenciaId: string
  titulo: string
  detalhe: string
  /** há quantos dias isto está em aberto — crédito velho lê diferente */
  diasEmAberto: number | null
  href: string
}

export type GrupoPendencia = {
  tipo: TipoPendencia
  titulo: string
  sub: string
  itens: Pendencia[]
}

const DIA = 864e5

/**
 * Por que esta pessoa tem crédito, na linha da pendência.
 *
 * O nome do estado, igual ao da chamada e do resumo — e não o verbo do dia a
 * dia ("faltou", "avisou que não vinha"), que muda a mesma informação de nome
 * de uma tela para outra. Sem vocabulário da conta de propósito: qualquer
 * artigo colado numa palavra do cliente vira "a atendimento".
 */
const MOTIVO_DO_CREDITO: Partial<Record<StatusParticipacao, string>> = {
  falta: 'Falta',
  falta_avisada: 'Falta avisada',
  cancelada: 'Horário cancelado pelo estúdio',
}

/** `2026-07-13` → `13/07/26`: data na tela é escrita como se lê. */
function dataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
}

function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DIA))
}

export async function listarPendencias(
  db: Db, contaId: string, fuso: string,
): Promise<GrupoPendencia[]> {
  const hoje = hojeEm(fuso)
  const agora = new Date().toISOString()

  const [conta, dispensadas] = await Promise.all([
    db.from('conta')
      .select('prazo_reposicao_dias, credito_falta_avisada')
      .eq('id', contaId)
      .single(),
    db.from('pendencia_dispensada')
      .select('tipo, referencia_id')
      .eq('conta_id', contaId)
      ,
  ])

  const dispensada = new Set(
    (dispensadas.data ?? []).map((d) => `${d.tipo}|${d.referencia_id}`),
  )
  const vale = (p: Pendencia) => !dispensada.has(`${p.tipo}|${p.referenciaId}`)

  const prazo = conta.data?.prazo_reposicao_dias ?? 60
  const creditoAvisada = conta.data?.credito_falta_avisada ?? true

  const [chamadas, reposicoes, reservas, cadastros] = await Promise.all([
    chamadasNaoFeitas(db, contaId, fuso, agora),
    reposicoesAbertas(db, contaId, prazo, creditoAvisada),
    reservasEsperando(db, contaId, agora),
    cadastrosIncompletos(db, contaId, hoje),
  ])

  const grupos: GrupoPendencia[] = [
    {
      tipo: 'chamada_nao_feita',
      titulo: 'Chamadas não feitas',
      sub: 'já passaram e ninguém registrou',
      itens: chamadas.filter(vale),
    },
    {
      tipo: 'reposicao_aberta',
      titulo: 'Reposições em aberto',
      sub: 'crédito de falta ou de dia fechado que ninguém usou',
      itens: reposicoes.filter(vale),
    },
    {
      tipo: 'reserva_esperando',
      titulo: 'Reservas esperando',
      sub: 'pediram horário que estava cheio',
      itens: reservas.filter(vale),
    },
    {
      tipo: 'cadastro_incompleto',
      titulo: 'Cadastros incompletos',
      sub: 'sem telefone ou sem identificador',
      itens: cadastros.filter(vale),
    },
  ]
  return grupos.filter((g) => g.itens.length > 0)
}

/**
 * Sessão que já passou e ainda tem gente em `esperada` ou `confirmada`.
 *
 * A mesma definição derivada da tela de Hoje — se divergisse, a pendência
 * apontaria para uma sessão que a outra tela mostra como resolvida.
 */
async function chamadasNaoFeitas(
  db: Db, contaId: string, fuso: string, agora: string,
): Promise<Pendencia[]> {
  const { data, error } = await db
    .from('sessao')
    .select('id, inicio, servico:servico_id(nome), profissional:profissional_id(nome), participacao(status)')
    .eq('conta_id', contaId)
    .eq('status', 'prevista')
    .lt('inicio', agora)
    .gte('inicio', new Date(Date.now() - 30 * DIA).toISOString())
    .order('inicio', { ascending: false })
    

  if (error) throw error

  return (data ?? [])
    .filter((s) => estadoDaChamada(s.participacao.map((p) => p.status)) === 'pendente')
    .map((s) => {
      const { data: dia, hora } = localDe(s.inicio, fuso)
      return {
        tipo: 'chamada_nao_feita' as const,
        referenciaId: s.id,
        // hora primeiro, data curta depois: quem varre a lista procura o
        // horário, e "2026-08-13" ocupa espaço dizendo o ano que a pessoa já sabe
        titulo: `${hora} · ${s.servico?.nome ?? 'Horário'}`,
        detalhe: [
          `${dia.slice(8)}/${dia.slice(5, 7)}`,
          s.profissional?.nome,
          `${s.participacao.length} ${s.participacao.length === 1 ? 'pessoa' : 'pessoas'}`,
        ].filter(Boolean).join(' · '),
        diasEmAberto: diasDesde(s.inicio),
        href: `/sessao/${s.id}`,
      }
    })
}

/**
 * Falta com crédito não usado, dentro do prazo da conta.
 *
 * O prazo é o que faz esta lista esvaziar. Sem ele, crédito de dois anos atrás
 * continuaria pedindo ação para sempre — e lista que nunca zera vira ruído, que
 * é quando a pessoa para de abrir a tela.
 *
 * `cancelada` entra **sempre**, e não depende do `credito_falta_avisada` da
 * conta: essa chave responde "falta avisada dá direito a repor?", que é uma
 * pergunta sobre quem faltou. Participação cancelada é o negócio que fechou o
 * dia, ou quem opera tirando a pessoa daquele horário, e aí não há o que
 * decidir, o lugar era dela.
 */
async function reposicoesAbertas(
  db: Db, contaId: string, prazoDias: number, creditoAvisada: boolean,
): Promise<Pendencia[]> {
  const limite = new Date(Date.now() - prazoDias * DIA).toISOString()

  const { data, error } = await db
    .from('participacao')
    .select('id, status, pessoa:pessoa_id(id, nome), sessao:sessao_id(inicio, servico:servico_id(nome))')
    .eq('conta_id', contaId)
    .in('status', statusComCredito(creditoAvisada))
    
  if (error) throw error

  const faltas = (data ?? []).filter((p) => p.sessao && p.sessao.inicio >= limite)
  if (!faltas.length) return []

  // quais já foram repostas: a reposição aponta para a falta que a originou
  const { data: usadas } = await db
    .from('participacao')
    .select('reposicao_de_id')
    .eq('conta_id', contaId)
    .not('reposicao_de_id', 'is', null)
    
  const jaReposta = new Set((usadas ?? []).map((u) => u.reposicao_de_id))

  return faltas
    .filter((p) => !jaReposta.has(p.id))
    .map((p) => ({
      tipo: 'reposicao_aberta' as const,
      referenciaId: p.id,
      titulo: p.pessoa?.nome ?? 'Sem nome',
      detalhe: `${MOTIVO_DO_CREDITO[p.status] ?? 'Horário perdido'} em ${
        dataCurta(p.sessao!.inicio.slice(0, 10))} · ${p.sessao!.servico?.nome ?? ''}`,
      diasEmAberto: diasDesde(p.sessao!.inicio),
      href: p.pessoa ? `/pessoas/${p.pessoa.id}` : '/pessoas',
    }))
}

/** Quem pediu horário cheio e está esperando vaga. */
async function reservasEsperando(
  db: Db, contaId: string, agora: string,
): Promise<Pendencia[]> {
  const { data, error } = await db
    .from('participacao')
    .select('id, registrado_em, pessoa:pessoa_id(id, nome), sessao:sessao_id(id, inicio, servico:servico_id(nome))')
    .eq('conta_id', contaId)
    .eq('origem', 'reserva')
    .eq('status', 'esperada')
    
  if (error) throw error

  return (data ?? [])
    .filter((p) => p.sessao && p.sessao.inicio >= agora)
    .map((p) => ({
      tipo: 'reserva_esperando' as const,
      referenciaId: p.id,
      titulo: p.pessoa?.nome ?? 'Sem nome',
      detalhe: `Aguarda vaga em ${p.sessao!.servico?.nome ?? 'um horário'} de ${
        dataCurta(p.sessao!.inicio.slice(0, 10))}`,
      diasEmAberto: diasDesde(p.registrado_em),
      href: `/sessao/${p.sessao!.id}`,
    }))
}

/**
 * Sem telefone é o que impede avisar; sem identificador é o que impede achar.
 *
 * Só quem está ativo e tem vaga ou participação recente: cobrar cadastro de
 * quem nunca voltou é a definição de ruído.
 */
async function cadastrosIncompletos(
  db: Db, contaId: string, hoje: string,
): Promise<Pendencia[]> {
  const { data, error } = await db
    .from('pessoa')
    .select('id, nome, telefone, identificador_externo, vaga(id, inicio, fim)')
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .or('telefone.is.null,identificador_externo.is.null')
    
  if (error) throw error

  return (data ?? [])
    .filter((p) => p.vaga.some((v) => v.inicio <= hoje && (v.fim === null || v.fim >= hoje)))
    .map((p) => ({
      tipo: 'cadastro_incompleto' as const,
      referenciaId: p.id,
      titulo: p.nome,
      detalhe: !p.telefone
        ? 'sem telefone, não dá para avisar'
        : 'sem identificador',
      diasEmAberto: null,
      href: `/pessoas/${p.id}`,
    }))
}

/**
 * Quantas pendências saíram da lista hoje.
 *
 * Uma tela cujo objetivo é zerar precisa mostrar o progresso, senão ela só
 * mostra dívida: dezesseis itens ontem e dezesseis hoje parecem a mesma coisa
 * mesmo quando quatro foram resolvidos e quatro novos nasceram.
 *
 * Conta o que foi **dispensado** hoje — é o único ato que fica gravado. A
 * chamada feita hoje sai da lista sozinha, e contá-la exigiria um log de
 * resolução que ainda não existe.
 */
export async function esvaziadasHoje(
  db: Db, contaId: string, fuso: string,
): Promise<number> {
  const hoje = hojeEm(fuso)
  const { count } = await db
    .from('pendencia_dispensada')
    .select('id', { count: 'exact', head: true })
    .eq('conta_id', contaId)
    .gte('dispensado_em', instante(hoje, '00:00', fuso))
    .lte('dispensado_em', instante(hoje, '23:59', fuso))
  return count ?? 0
}
