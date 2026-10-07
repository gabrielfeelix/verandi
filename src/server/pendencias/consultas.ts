import type { Db } from '../supabase'
import { hojeEm, instante, localDe } from '../agenda/fuso'
import { estadoDaChamada } from '@/core/agenda/chamada'
import { statusComCredito, type StatusParticipacao } from '@/core/agenda/ocupacao'
import { dataCurta } from '@/core/agenda/datas'
import { licencasAbertas } from '../licencas/licencas'
import { aulasDoPlanoDaConta, pacotesDaConta } from '../contratos/pacotes'
import { fraseDoSaldo } from '@/core/contratos/pacote'

/**
 * O inbox de quem opera: o que exige ação humana hoje.
 *
 * Nenhum grupo é coluna. Cada um é uma consulta sobre o dado que já existe:
 * coluna de estado derivado é coluna que um dia mente. O que se grava é o ato
 * de dispensar.
 */

export type TipoPendencia =
  | 'chamada_nao_feita'
  | 'reposicao_aberta'
  | 'licenca'
  | 'reserva_esperando'
  | 'cadastro_incompleto'
  | 'horario_sem_contrato'
  | 'pacote_esgotado'
  | 'pacote_acabando'
  | 'pacote_parado'

export type Pendencia = {
  tipo: TipoPendencia
  referenciaId: string
  titulo: string
  detalhe: string
  /** há quantos dias isto está em aberto: crédito velho lê diferente */
  diasEmAberto: number | null
  href: string
  /** a etiqueta da direita quando "há N dias" não é a informação certa */
  etiqueta?: { texto: string; tinta: 'neutro' | 'atencao' | 'alerta' | 'licenca' }
  /** só licença: o que as ações "Voltou" e "Prorrogar" precisam */
  licenca?: { id: string; pessoaId: string; voltaPrevista: string | null }
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
 * O nome do estado, igual ao da chamada e do resumo, e não o verbo do dia a
 * dia ("faltou", "avisou que não vinha"), que muda a mesma informação de nome
 * de uma tela para outra. Sem vocabulário da conta de propósito: qualquer
 * artigo colado numa palavra do cliente vira "a atendimento".
 */
const MOTIVO_DO_CREDITO: Partial<Record<StatusParticipacao, string>> = {
  falta: 'Falta',
  falta_avisada: 'Falta justificada',
  cancelada: 'Horário cancelado pelo estúdio',
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

  const [chamadas, reposicoes, reservas, cadastros, licencas, semContrato, pacotes] = await Promise.all([
    chamadasNaoFeitas(db, contaId, fuso, agora),
    reposicoesAbertas(db, contaId, prazo, creditoAvisada),
    reservasEsperando(db, contaId, agora),
    cadastrosIncompletos(db, contaId, hoje),
    licencasEmAcompanhamento(db, contaId, hoje),
    horariosSemContrato(db, contaId, hoje),
    pacotesPendentes(db, contaId, fuso),
  ])

  const grupos: GrupoPendencia[] = [
    {
      tipo: 'chamada_nao_feita',
      titulo: 'Chamadas não feitas',
      sub: 'Aulas encerradas sem registro de presença',
      itens: chamadas.filter(vale),
    },
    {
      tipo: 'reposicao_aberta',
      titulo: 'Reposições em aberto',
      sub: 'Créditos de falta ou de dia fechado ainda não utilizados',
      itens: reposicoes.filter(vale),
    },
    {
      tipo: 'licenca',
      titulo: 'Licenças',
      sub: 'Alunos afastados com horário reservado',
      itens: licencas,
    },
    {
      tipo: 'reserva_esperando',
      titulo: 'Reservas esperando',
      sub: 'Pedidos de horário que estava completo',
      itens: reservas.filter(vale),
    },
    {
      // sem "Dispensar": aula dada sem cobrança não é ruído para esconder, e
      // se resolve criando o contrato ou encerrando o horário
      tipo: 'horario_sem_contrato',
      titulo: 'Horário fixo sem contrato',
      sub: 'Horário fixo em modalidade sem contrato ativo',
      itens: semContrato,
    },
    {
      tipo: 'pacote_esgotado',
      titulo: 'Pacotes esgotados',
      sub: 'Todas as aulas do pacote usadas, sem renovação',
      itens: pacotes.filter((p) => p.tipo === 'pacote_esgotado'),
    },
    {
      tipo: 'pacote_acabando',
      titulo: 'Pacotes acabando',
      sub: 'Restam poucas aulas no pacote',
      itens: pacotes.filter((p) => p.tipo === 'pacote_acabando'),
    },
    {
      tipo: 'pacote_parado',
      titulo: 'Aulas a fazer',
      sub: 'Saldo de pacote ou avulsa, ou aulas do plano semanal ainda por marcar no mês',
      itens: pacotes.filter((p) => p.tipo === 'pacote_parado'),
    },
    {
      tipo: 'cadastro_incompleto',
      titulo: 'Cadastros incompletos',
      sub: 'Sem telefone ou sem nº da ficha',
      itens: cadastros.filter(vale),
    },
  ]
  return grupos.filter((g) => g.itens.length > 0)
}

/**
 * Sessão que já passou e ainda tem gente em `esperada` ou `confirmada`.
 *
 * A mesma definição derivada da tela de Hoje: se divergisse, a pendência
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
 * continuaria pedindo ação para sempre, e lista que nunca zera vira ruído, que
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

  const abertas = faltas.filter((p) => !jaReposta.has(p.id))
  // quantas cada pessoa tem para repor: a linha diz a falta, o total diz a dívida
  const porPessoa = new Map<string, number>()
  for (const p of abertas) {
    if (p.pessoa) porPessoa.set(p.pessoa.id, (porPessoa.get(p.pessoa.id) ?? 0) + 1)
  }

  return abertas
    .map((p) => ({
      tipo: 'reposicao_aberta' as const,
      referenciaId: p.id,
      titulo: p.pessoa?.nome ?? 'Sem nome',
      detalhe: `${MOTIVO_DO_CREDITO[p.status] ?? 'Horário perdido'} em ${
        dataCurta(p.sessao!.inicio.slice(0, 10))} · ${p.sessao!.servico?.nome ?? ''}${
        (porPessoa.get(p.pessoa?.id ?? '') ?? 0) > 1
          ? ` · ${porPessoa.get(p.pessoa!.id)} reposições em aberto` : ''}`,
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
        ? 'Sem telefone'
        : 'Sem nº da ficha',
      diasEmAberto: null,
      href: `/pessoas/${p.id}`,
    }))
}

/**
 * Quem tem horário fixo numa modalidade sem contrato ativo dela.
 *
 * Não é proibido: aula experimental, troca de modalidade no meio do mês e
 * cortesia são casos de verdade, e por isso a matrícula avisa e não bloqueia.
 * Mas o que passa em silêncio é aula dada sem cobrança, e é aqui que aparece,
 * inclusive o que veio de importação antes do aviso existir.
 */
async function horariosSemContrato(
  db: Db, contaId: string, hoje: string,
): Promise<Pendencia[]> {
  const { data, error } = await db
    .from('pessoa')
    .select(`id, nome,
             vaga(inicio, fim, serie(servico_id, servico(nome))),
             contrato(status, plano(servico_id))`)
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .returns<Array<{
      id: string; nome: string
      vaga: Array<{
        inicio: string; fim: string | null
        serie: { servico_id: string; servico: { nome: string } | null } | null
      }>
      contrato: Array<{ status: string; plano: { servico_id: string } | null }>
    }>>()
  if (error) throw error

  const itens: Pendencia[] = []
  for (const p of data ?? []) {
    const cobertas = new Set(p.contrato
      .filter((c) => c.status === 'ativo' && c.plano)
      .map((c) => c.plano!.servico_id))
    const faltam: string[] = []
    for (const v of p.vaga) {
      const vale = v.inicio <= hoje && (v.fim === null || v.fim >= hoje)
      if (!vale || !v.serie || cobertas.has(v.serie.servico_id)) continue
      const nome = v.serie.servico?.nome ?? 'modalidade sem nome'
      if (!faltam.includes(nome)) faltam.push(nome)
    }
    if (!faltam.length) continue
    itens.push({
      tipo: 'horario_sem_contrato',
      referenciaId: p.id,
      titulo: p.nome,
      detalhe: faltam.join(' e '),
      diasEmAberto: null,
      href: `/pessoas/${p.id}?aba=contratos`,
    })
  }
  return itens.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

/**
 * Pacote de aulas que pede ação: esgotado, acabando ou parado.
 *
 * A regra mora em `estadoDoPacote` (core), a mesma da ficha e de Alunos.
 */
async function pacotesPendentes(
  db: Db, contaId: string, fuso: string,
): Promise<Pendencia[]> {
  // falha aqui não derruba Pendências: os outros grupos continuam
  const [pacotes, planos] = await Promise.all([
    pacotesDaConta(db, contaId, fuso)
      .catch((e) => { console.error('pacotes em Pendências', e); return [] }),
    aulasDoPlanoDaConta(db, contaId, fuso)
      .catch((e) => { console.error('aulas do plano em Pendências', e); return [] }),
  ])
  const itens: Pendencia[] = []
  // plano de N vezes por semana com aula do mês por marcar (o caso da Thais)
  for (const p of planos) {
    itens.push({
      tipo: 'pacote_parado',
      referenciaId: p.pessoaId,
      titulo: p.pessoaNome,
      detalhe: `${p.servico}: plano ${p.frequencia}x por semana, aulas do mês ainda não marcadas`,
      diasEmAberto: null,
      href: `/pessoas/${p.pessoaId}?aba=agenda`,
      etiqueta: { texto: p.restantes === 1 ? '1 aula a fazer' : `${p.restantes} aulas a fazer`, tinta: 'neutro' },
    })
  }
  for (const p of pacotes) {
    if (!p.aviso) continue
    itens.push({
      tipo: `pacote_${p.aviso}`,
      referenciaId: p.pessoaId,
      titulo: p.pessoaNome,
      detalhe: p.aviso === 'parado'
        ? `${p.servico}: ${fraseDoSaldo(p)} · ${p.usadas ? `sem uso há ${p.diasSemUsar} dias` : 'nenhuma usada'}`
        : `${p.servico}: ${fraseDoSaldo(p)}`,
      diasEmAberto: null,
      href: `/pessoas/${p.pessoaId}?aba=${p.aviso === 'parado' ? 'agenda' : 'contratos'}`,
      etiqueta: p.aviso === 'parado'
        ? { texto: p.restantes === 1 ? '1 aula a fazer' : `${p.restantes} aulas a fazer`, tinta: 'neutro' }
        : p.aviso === 'esgotado'
          ? { texto: 'sem saldo', tinta: 'alerta' }
          : { texto: p.restantes === 1 ? 'resta 1' : `restam ${p.restantes}`, tinta: 'atencao' },
    })
  }
  // a mesma pessoa com pacote e plano semanal: uma linha só, as duas frases
  const juntos = new Map<string, Pendencia>()
  for (const i of itens) {
    const chave = `${i.tipo}|${i.referenciaId}`
    const ja = juntos.get(chave)
    if (ja) ja.detalhe = `${ja.detalhe} · ${i.detalhe}`
    else juntos.set(chave, i)
  }
  return [...juntos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

/**
 * Quantas pendências saíram da lista hoje.
 *
 * Uma tela cujo objetivo é zerar precisa mostrar o progresso, senão ela só
 * mostra dívida: dezesseis itens ontem e dezesseis hoje parecem a mesma coisa
 * mesmo quando quatro foram resolvidos e quatro novos nasceram.
 *
 * Conta o que foi **dispensado** hoje: é o único ato que fica gravado. A
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

/*
 * Licença aberta, da mais urgente para a mais tranquila.
 *
 * Não passa pelo "Dispensar": licença não se dispensa, se encerra ("Voltou")
 * ou se prorroga. Três ordens, a do telefone: quem já devia ter voltado (a
 * data passou ou é hoje), quem volta nos próximos dias, e quem não tem data.
 * "Voltou e não reagendou" saiu em 06/out: o bot já passa a conversa para a
 * equipe no inbox, e avisar nos dois lugares era o mesmo recado duas vezes.
 */
async function licencasEmAcompanhamento(
  db: Db, contaId: string, hoje: string,
): Promise<Pendencia[]> {
  const abertas = await licencasAbertas(db, contaId)
  const peso = (l: (typeof abertas)[number]) =>
    !l.voltaPrevista ? 2 : l.voltaPrevista <= hoje ? 0 : 1
  return abertas
    .sort((a, b) => peso(a) - peso(b)
      || (a.voltaPrevista ?? '9').localeCompare(b.voltaPrevista ?? '9')
      || a.pessoaNome.localeCompare(b.pessoaNome, 'pt-BR'))
    .map((l) => {
      const desde = `Em licença desde ${diaMes(l.inicio)}`
      let etiqueta: Pendencia['etiqueta']
      let detalhe = desde
      if (!l.voltaPrevista) {
        etiqueta = { texto: 'sem data de volta', tinta: 'neutro' }
      } else if (l.voltaPrevista < hoje) {
        const n = diasEntre(l.voltaPrevista, hoje)
        etiqueta = { texto: `volta passou há ${n} ${n === 1 ? 'dia' : 'dias'}`, tinta: 'alerta' }
        detalhe = `${desde}, volta prevista ${diaMes(l.voltaPrevista)}`
      } else if (l.voltaPrevista === hoje) {
        etiqueta = { texto: 'volta hoje', tinta: 'atencao' }
      } else {
        etiqueta = { texto: `volta ${diaMes(l.voltaPrevista)}`, tinta: 'licenca' }
      }
      return {
        tipo: 'licenca' as const,
        referenciaId: l.id,
        titulo: l.pessoaNome,
        detalhe,
        diasEmAberto: null,
        href: `/pessoas/${l.pessoaId}`,
        etiqueta,
        licenca: { id: l.id, pessoaId: l.pessoaId, voltaPrevista: l.voltaPrevista },
      }
    })
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA)
}

/** "12/10": na linha da licença o ano só ocupa lugar */
function diaMes(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}
