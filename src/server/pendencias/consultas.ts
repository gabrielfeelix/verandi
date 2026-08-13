import type { Db } from '../supabase'
import { hojeEm, localDe } from '../agenda/fuso'
import { estadoDaChamada } from '@/core/agenda/chamada'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'

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
      .single<{ prazo_reposicao_dias: number; credito_falta_avisada: boolean }>(),
    db.from('pendencia_dispensada')
      .select('tipo, referencia_id')
      .eq('conta_id', contaId)
      .returns<{ tipo: TipoPendencia; referencia_id: string }[]>(),
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
      sub: 'faltas com crédito não usado',
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
    .returns<{
      id: string
      inicio: string
      servico: { nome: string } | null
      profissional: { nome: string } | null
      participacao: { status: StatusParticipacao }[]
    }[]>()

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
 */
async function reposicoesAbertas(
  db: Db, contaId: string, prazoDias: number, creditoAvisada: boolean,
): Promise<Pendencia[]> {
  const statusComCredito: StatusParticipacao[] = creditoAvisada
    ? ['falta', 'falta_avisada']
    : ['falta']

  const limite = new Date(Date.now() - prazoDias * DIA).toISOString()

  const { data, error } = await db
    .from('participacao')
    .select('id, status, pessoa:pessoa_id(id, nome), sessao:sessao_id(inicio, servico:servico_id(nome))')
    .eq('conta_id', contaId)
    .in('status', statusComCredito)
    .returns<{
      id: string
      status: StatusParticipacao
      pessoa: { id: string; nome: string } | null
      sessao: { inicio: string; servico: { nome: string } | null } | null
    }[]>()
  if (error) throw error

  const faltas = (data ?? []).filter((p) => p.sessao && p.sessao.inicio >= limite)
  if (!faltas.length) return []

  // quais já foram repostas: a reposição aponta para a falta que a originou
  const { data: usadas } = await db
    .from('participacao')
    .select('reposicao_de_id')
    .eq('conta_id', contaId)
    .not('reposicao_de_id', 'is', null)
    .returns<{ reposicao_de_id: string }[]>()
  const jaReposta = new Set((usadas ?? []).map((u) => u.reposicao_de_id))

  return faltas
    .filter((p) => !jaReposta.has(p.id))
    .map((p) => ({
      tipo: 'reposicao_aberta' as const,
      referenciaId: p.id,
      titulo: p.pessoa?.nome ?? 'Sem nome',
      detalhe: `${p.status === 'falta' ? 'faltou' : 'avisou que não vinha'} em ${
        p.sessao!.inicio.slice(0, 10)} · ${p.sessao!.servico?.nome ?? ''}`,
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
    .returns<{
      id: string
      registrado_em: string
      pessoa: { id: string; nome: string } | null
      sessao: { id: string; inicio: string; servico: { nome: string } | null } | null
    }[]>()
  if (error) throw error

  return (data ?? [])
    .filter((p) => p.sessao && p.sessao.inicio >= agora)
    .map((p) => ({
      tipo: 'reserva_esperando' as const,
      referenciaId: p.id,
      titulo: p.pessoa?.nome ?? 'Sem nome',
      detalhe: `quer ${p.sessao!.servico?.nome ?? 'o horário'} de ${
        p.sessao!.inicio.slice(0, 10)}`,
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
    .returns<{
      id: string
      nome: string
      telefone: string | null
      identificador_externo: string | null
      vaga: { id: string; inicio: string; fim: string | null }[]
    }[]>()
  if (error) throw error

  return (data ?? [])
    .filter((p) => p.vaga.some((v) => v.inicio <= hoje && (v.fim === null || v.fim >= hoje)))
    .map((p) => ({
      tipo: 'cadastro_incompleto' as const,
      referenciaId: p.id,
      titulo: p.nome,
      detalhe: !p.telefone
        ? 'sem telefone — não dá para avisar'
        : 'sem identificador',
      diasEmAberto: null,
      href: `/pessoas/${p.id}`,
    }))
}
