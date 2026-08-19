import type { Db } from '../supabase'
import type { Recorrencia } from '@/core/planos/plano'
import { fimProrrogado, type Pausa } from '@/core/contratos/contrato'
import {
  cobrancasPrevistas, competenciaDe, proximaCompetencia,
} from '@/core/financeiro/cobranca'

/**
 * A cobrança que nasce do contrato.
 *
 * Mora fora de `acoes.ts` de propósito: tudo que um arquivo `'use server'`
 * exporta vira endereço de rede chamável de fora, e estas três funções recebem
 * `contaId` pronto, sem conferir papel. É a mesma separação que a agenda já faz
 * entre `materializarJanela` e as ações da tela.
 */

/**
 * Cria as cobranças que ainda não existem, até o mês que vem.
 *
 * **Materializada, e não agendada**, pelo mesmo motivo da agenda: o plano
 * gratuito da Vercel não dá cron, e um job que alguém esquece de rodar é pior
 * que nenhum. Roda ao abrir o financeiro, ao abrir a ficha e logo depois de
 * matricular, e é idempotente pelo `unique (contrato_id, competencia)`: duas
 * abas abertas ao mesmo tempo não cobram duas vezes.
 *
 * **Lê antes de escrever, e no caso comum não escreve.** No dia 12 de um mês
 * já materializado não há nada a criar, e a esmagadora maioria das aberturas de
 * tela cai nesse caso.
 */
export async function materializarCobrancas(
  db: Db, contaId: string, hoje: string,
  /** quando dado, só este contrato; é o caminho de logo depois de matricular */
  contratoId?: string,
  /**
   * Quantos meses à frente do atual materializar. Um é o padrão e é o que a
   * abertura de tela usa; mais que isso é decisão de quem está no balcão com
   * alguém pagando adiantado, e por isso chega por parâmetro em vez de virar
   * regra da casa. Ver `anteciparCobrancas`.
   */
  mesesAdiante = 1,
): Promise<number> {
  let horizonte = competenciaDe(hoje)
  for (let i = 0; i < Math.max(1, mesesAdiante); i++) {
    horizonte = proximaCompetencia(horizonte)
  }

  let q = db.from('contrato')
    .select(`id, pessoa_id, inicio, fim, status, dia_vencimento, criado_em,
             preco_aplicado_cent, pausa(inicio, fim),
             plano(recorrencia, parcelas), cobranca(competencia)`)
    .eq('conta_id', contaId).neq('status', 'encerrado')
  if (contratoId) q = q.eq('id', contratoId)

  const { data: contratos, error } = await q.returns<Array<{
    id: string; pessoa_id: string; inicio: string; fim: string | null
    status: string; dia_vencimento: number | null; preco_aplicado_cent: number
    criado_em: string
    pausa: Array<{ inicio: string; fim: string | null }>
    plano: { recorrencia: string; parcelas: number } | null
    cobranca: Array<{ competencia: string }>
  }>>()
  if (error) throw error

  const novas: Array<{
    conta_id: string; contrato_id: string; pessoa_id: string
    competencia: string; vencimento: string; valor_cent: number
  }> = []

  for (const c of contratos ?? []) {
    if (!c.plano) continue
    const pausas: Pausa[] = (c.pausa ?? []).map((p) => ({ inicio: p.inicio, fim: p.fim }))
    const jaExiste = new Set((c.cobranca ?? []).map((x) => x.competencia))

    for (const prevista of cobrancasPrevistas({
      inicio: c.inicio,
      fim: fimProrrogado(c.fim, pausas),
      recorrencia: c.plano.recorrencia as Recorrencia,
      parcelas: c.plano.parcelas,
      precoAplicadoCent: c.preco_aplicado_cent,
      diaVencimento: c.dia_vencimento,
      pausas,
    }, horizonte)) {
      if (jaExiste.has(prevista.competencia)) continue
      if (prevista.competencia < primeiraCobravel(c.inicio, c.criado_em)) continue
      novas.push({
        conta_id: contaId,
        contrato_id: c.id,
        pessoa_id: c.pessoa_id,
        competencia: prevista.competencia,
        vencimento: prevista.vencimento,
        valor_cent: prevista.valorCent,
      })
    }
  }

  if (!novas.length) return 0

  /*
   * `upsert` com `ignoreDuplicates`, e não `insert`: o índice único é a
   * garantia contra duas abas materializando ao mesmo tempo, e o que se quer
   * dessa corrida é que a segunda não faça nada, e não que ela derrube a tela
   * de quem abriu.
   */
  const { error: erroInsert, count } = await db.from('cobranca')
    .upsert(novas, { onConflict: 'contrato_id,competencia', ignoreDuplicates: true, count: 'exact' })
  if (erroInsert) throw erroInsert
  return count ?? novas.length
}

/**
 * O contrato mudou de forma, e as cobranças dele seguem.
 *
 * Chamada por trancar e por retomar, e é o que fecha o buraco entre os módulos
 * 16 e 17: quem tranca em setembro já tem a cobrança de outubro criada, porque
 * o horizonte é um mês à frente, e ela viraria dívida de um mês em que a pessoa
 * nem podia entrar na sala. Quem retoma precisa do caminho de volta.
 *
 * Só mexe no que o sistema criou e ninguém pagou: cobrança com pagamento é
 * dinheiro que entrou, e cancelamento escrito à mão tem um motivo que não é
 * este. O texto do motivo é a marca de quem cancelou, e é por ele que a volta
 * sabe o que pode reabrir.
 */
/**
 * O sistema não inventa dívida de antes de saber que o contrato existe.
 *
 * O MGM vai digitar as matrículas em curso, com a data real de início, para o
 * histórico e para as vagas ficarem certos. Sem esta linha, cadastrar um
 * contrato que começou em janeiro faria nascer quinze cobranças vencidas numa
 * tela cuja primeira aba é "em atraso", e o sistema abriria acusando o cliente
 * de caloteiro na frente da recepção.
 *
 * O que ficou para trás é conversa do estúdio com o aluno, fora daqui. O que
 * está escrito é: cobrança existe a partir do mês em que o contrato entrou no
 * sistema, ou do começo dele, o que vier depois.
 */
function primeiraCobravel(inicio: string, criadoEm: string): string {
  const doCadastro = competenciaDe(criadoEm.slice(0, 10))
  const doInicio = competenciaDe(inicio)
  return doInicio >= doCadastro ? doInicio : doCadastro
}

const MOTIVO_LICENCA = 'licença do contrato'

export async function sincronizarCobrancas(
  db: Db, contaId: string, contratoId: string, hoje: string,
): Promise<void> {
  const horizonte = proximaCompetencia(competenciaDe(hoje))

  const { data: c } = await db.from('contrato')
    .select(`id, inicio, fim, dia_vencimento, preco_aplicado_cent, criado_em,
             pausa(inicio, fim), plano(recorrencia, parcelas)`)
    .eq('id', contratoId).eq('conta_id', contaId).maybeSingle()
  if (!c?.plano) return

  const pausas: Pausa[] = (c.pausa ?? []).map((p) => ({ inicio: p.inicio, fim: p.fim }))
  const devidas = new Set(cobrancasPrevistas({
    inicio: c.inicio,
    fim: fimProrrogado(c.fim, pausas),
    recorrencia: c.plano.recorrencia as Recorrencia,
    parcelas: c.plano.parcelas,
    precoAplicadoCent: c.preco_aplicado_cent,
    diaVencimento: c.dia_vencimento,
    pausas,
  }, horizonte)
    .filter((p) => p.competencia >= primeiraCobravel(c.inicio, c.criado_em))
    .map((p) => p.competencia))

  const { data: existentes } = await db.from('cobranca_resumo')
    .select('id, competencia, status, valor_pago_cent, motivo_cancelamento, origem')
    .eq('conta_id', contaId).eq('contrato_id', contratoId)

  for (const e of existentes ?? []) {
    if (e.origem !== 'sistema') continue
    const devida = devidas.has(e.competencia!)

    if (!devida && e.status === 'aberta' && (e.valor_pago_cent ?? 0) === 0) {
      await db.from('cobranca').update({
        status: 'cancelada', motivo_cancelamento: MOTIVO_LICENCA,
      }).eq('id', e.id!)
    }

    if (devida && e.status === 'cancelada'
        && e.motivo_cancelamento === MOTIVO_LICENCA) {
      await db.from('cobranca')
        .update({ status: 'aberta', motivo_cancelamento: null })
        .eq('id', e.id!)
    }
  }

  await materializarCobrancas(db, contaId, hoje, contratoId)
}

/**
 * O que o encerrar do contrato faz com o que ainda não venceu.
 *
 * Chamada por `encerrarContrato`, e não por uma tela. As cobranças de
 * competência posterior ao fim são canceladas; as vencidas e não pagas ficam,
 * porque quem saiu devendo continua devendo, e apagar a dívida no ato do
 * encerramento é o jeito mais rápido de o sistema perder dinheiro do cliente
 * sem ninguém perceber.
 */
export async function cancelarCobrancasFuturas(
  db: Db, contaId: string, contratoId: string, fim: string,
): Promise<number> {
  const { data, error } = await db.from('cobranca')
    .update({
      status: 'cancelada',
      motivo_cancelamento: `contrato encerrado em ${fim.split('-').reverse().join('/')}`,
    })
    .eq('conta_id', contaId).eq('contrato_id', contratoId)
    .eq('status', 'aberta').gt('competencia', competenciaDe(fim))
    .select('id')
  if (error) throw error

  // as que já receberam alguma coisa não são canceladas: a soma delas é
  // dinheiro que entrou, e cancelar apagaria o motivo de ele ter entrado
  const canceladas = (data ?? []).length
  return canceladas
}
