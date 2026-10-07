import type { Db } from '../supabase'
import { calcularOcupacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe } from '@/core/agenda/encaixe'
import type { OrigemParticipacao } from './consultas'
import { avisar } from '../webhook/eventos'
import { aulasNaSemana, dataLocal } from '@/core/contratos/horario-livre'

/**
 * "Cabe ou não cabe", escrito uma vez só.
 *
 * Este arquivo existe por causa de uma armadilha concreta: `encaixar`, a ação de
 * tela, lia `cookies()` no meio da regra. Uma rota de API não tem cookie, e a
 * saída óbvia seria a rota reimplementar a conferência de vaga. No dia em que a
 * tela e a rota discordassem, ninguém descobriria por semanas, porque as duas
 * continuariam respondendo com confiança.
 *
 * Então a regra desceu para cá e recebe de fora **quem está registrando**. A
 * ação de tela lê o cookie e passa o carimbo da recepção; a rota da API passa o
 * carimbo do bot. A decisão é a mesma nas duas.
 *
 * Note que este arquivo **não** é `'use server'`: ele exporta tipo, e arquivo de
 * ação só exporta função async.
 */

/** De qual lado do balcão veio o registro. Serve auditoria, não permissão. */
export type Carimbo = {
  registrado_por_usuario_id: string | null
  registrado_por_origem: 'profissional' | 'recepcao' | 'bot' | 'sistema' | 'importacao'
  registrado_em: string
}

export type PedidoDeEncaixe = {
  sessaoId: string
  pessoaId: string
  origem: Exclude<OrigemParticipacao, 'recorrente'>
  reposicaoDeId?: string
  /** quem está no balcão viu que passa da capacidade e assumiu. O bot nunca */
  confirmarAcima?: boolean
  /** quem está no balcão marca além do limite semanal do plano livre. O bot nunca */
  passarDoLimite?: boolean
  /**
   * O contrato que paga esta aula, quando quem marca já sabe: a aula avulsa
   * cobrada nasce com o contrato dela, e não pode cair no pacote mais antigo nem
   * contar no limite semanal de um plano livre. Só vale contrato ativo desta
   * pessoa nesta conta.
   */
  contratoId?: string
}

export type ResultadoEncaixe =
  | { ok: true; participacaoId: string }
  | { ok: false; motivo: 'lotada' | 'ja_participa' | 'acima_da_capacidade' | 'sessao_inexistente' }
  | { ok: false; motivo: 'limite_da_semana'; limite: number; plano: string }
  | { ok: false; motivo: 'dia_nao_permitido'; dias: number[]; plano: string }

/**
 * Confere a vaga **na hora de gravar**, relendo a ocupação, e não confia no que
 * a tela mostrava: entre mostrar e clicar, alguém pode ter ocupado.
 *
 * O `conta_id` na consulta da sessão não é redundância. Pela tela ele seria,
 * porque a RLS já corta; pela API não existe RLS, o cliente é o de serviço, e
 * sem este filtro uma sessão de outro cliente entraria pelo id.
 */
export async function encaixarNaSessao(
  db: Db,
  contaId: string,
  carimbo: Carimbo,
  entrada: PedidoDeEncaixe,
): Promise<ResultadoEncaixe> {
  const { data: sessao, error } = await db
    .from('sessao')
    .select('capacidade, inicio, servico_id, participacao(pessoa_id, status)')
    .eq('id', entrada.sessaoId)
    .eq('conta_id', contaId)
    .maybeSingle()
  if (error) throw error
  if (!sessao) return { ok: false, motivo: 'sessao_inexistente' }

  // a conta decide se a recepção pode abrir exceção; a leitura é aqui e não na
  // tela porque entre mostrar e clicar alguém pode ter mudado a configuração
  const { data: padrao } = await db.from('conta')
    .select('encaixe_acima, fuso').eq('id', contaId).single()

  const jaParticipa = sessao.participacao.some((p) => p.pessoa_id === entrada.pessoaId)
  const ocupacao = calcularOcupacao(
    sessao.capacidade,
    sessao.participacao.map((p) => p.status),
  )
  const veredito = avaliarEncaixe(ocupacao, jaParticipa, padrao?.encaixe_acima ?? false)
  if (!veredito.cabe) return { ok: false, motivo: veredito.motivo! }

  /*
   * Encaixe acima da capacidade **exige confirmação explícita**.
   *
   * Sem isto, a tela mostraria 4/4 e a pessoa clicaria achando que havia vaga, e
   * o excedente viraria acidente em vez de decisão. Quem confirma sabe o que
   * está fazendo, e o registro guarda quem foi. O bot nunca confirma: ele não
   * estava na sala para decidir.
   */
  if (veredito.acimaDaCapacidade && !entrada.confirmarAcima) {
    return { ok: false, motivo: 'acima_da_capacidade' }
  }

  /*
   * Plano de horário livre: a aula é do contrato, e o contrato tem limite por
   * semana. Reposição fica fora, porque devolve uma aula que já era dela.
   */
  const fuso = padrao?.fuso ?? 'America/Sao_Paulo'
  let contratoId: string | null = null
  if (entrada.contratoId) {
    const { data: dela, error: erroContrato } = await db.from('contrato').select('id')
      .eq('id', entrada.contratoId).eq('conta_id', contaId)
      .eq('pessoa_id', entrada.pessoaId).eq('status', 'ativo').maybeSingle()
    if (erroContrato) throw erroContrato
    if (!dela) throw new Error('contrato de outra pessoa, de outra conta ou encerrado')
    contratoId = dela.id
  } else if (entrada.origem !== 'reposicao') {
    const livre = await contratoLivre(db, contaId, entrada.pessoaId, sessao.servico_id,
      dataLocal(sessao.inicio, fuso))
    if (livre) {
      contratoId = livre.id
      const dia = new Date(`${dataLocal(sessao.inicio, fuso)}T12:00:00Z`).getUTCDay()
      if (!entrada.passarDoLimite && livre.dias && !livre.dias.includes(dia)) {
        return { ok: false, motivo: 'dia_nao_permitido', dias: livre.dias, plano: livre.plano }
      }
      if (!entrada.passarDoLimite) {
        const { data: dele } = await db.from('participacao')
          .select('status, sessao!inner(inicio, status)')
          .eq('conta_id', contaId).eq('contrato_id', livre.id)
        const usadas = aulasNaSemana(
          (dele ?? []).map((p) => ({
            inicio: p.sessao.inicio, status: p.status,
            sessaoCancelada: p.sessao.status === 'cancelada',
          })),
          sessao.inicio, fuso)
        if (usadas >= livre.limite) {
          return { ok: false, motivo: 'limite_da_semana', limite: livre.limite, plano: livre.plano }
        }
      }
    } else {
      contratoId = await contratoComSaldo(db, contaId, entrada.pessoaId, sessao.servico_id)
    }
  }

  const { data: criada, error: erroInsert } = await db.from('participacao').insert({
    conta_id: contaId,
    sessao_id: entrada.sessaoId,
    pessoa_id: entrada.pessoaId,
    origem: entrada.origem,
    status: 'esperada',
    reposicao_de_id: entrada.reposicaoDeId ?? null,
    contrato_id: contratoId,
    ...carimbo,
  }).select('id').single()
  if (erroInsert) throw erroInsert

  /*
   * O evento sai daqui, e não da tela nem da rota, pelo mesmo motivo que a regra
   * mora aqui: quem marcou pela recepção e quem marcou pelo bot geram o mesmo
   * acontecimento. Avisar em dois lugares é esquecer em um deles.
   */
  await avisar(db, contaId, 'participacao.criada', {
    participacaoId: criada.id, sessaoId: entrada.sessaoId,
  })

  return { ok: true, participacaoId: criada.id }
}

/**
 * O pacote (ou aula avulsa) desta pessoa, nesta modalidade, que ainda tem
 * saldo, do mais antigo para o mais novo.
 *
 * Sem esta ligação a aula marcada não gastava o pacote: o saldo da ficha e o
 * aviso "aulas a fazer" ficavam parados para sempre. Conta as aulas já
 * marcadas à frente junto das usadas, senão três aulas agendadas de uma vez
 * cairiam todas no mesmo pacote de uma aula só.
 */
async function contratoComSaldo(
  db: Db, contaId: string, pessoaId: string, servicoId: string,
): Promise<string | null> {
  const { data, error } = await db.from('contrato')
    .select('id, inicio, sessoes_contratadas, plano!inner(servico_id, recorrencia), participacao(status)')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId).eq('status', 'ativo')
    .eq('plano.servico_id', servicoId)
    .in('plano.recorrencia', ['pacote', 'avulsa'])
    .order('inicio', { ascending: true })
  if (error) throw error
  const OCUPAM = new Set(['presente', 'falta', 'falta_avisada', 'esperada', 'confirmada'])
  for (const c of data ?? []) {
    const total = c.sessoes_contratadas ?? (c.plano.recorrencia === 'avulsa' ? 1 : 0)
    const ocupadas = (c.participacao ?? []).filter((x) => OCUPAM.has(x.status)).length
    if (ocupadas < total) return c.id
  }
  return null
}

/**
 * O contrato de horário livre em vigor desta pessoa, nesta modalidade, no dia
 * da aula. Contrato trancado não marca aula: está parado de propósito.
 */
async function contratoLivre(
  db: Db, contaId: string, pessoaId: string, servicoId: string, dia: string,
): Promise<{ id: string; limite: number; plano: string; dias: number[] | null } | null> {
  const { data, error } = await db.from('contrato')
    .select('id, inicio, fim, plano!inner(nome, servico_id, horario_livre, frequencia_semanal, dias_permitidos)')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId).eq('status', 'ativo')
    .eq('plano.horario_livre', true).eq('plano.servico_id', servicoId)
    .lte('inicio', dia)
  if (error) throw error
  const valendo = (data ?? []).find((c) => c.fim === null || c.fim >= dia)
  if (!valendo || !valendo.plano.frequencia_semanal) return null
  return {
    id: valendo.id,
    limite: valendo.plano.frequencia_semanal,
    plano: valendo.plano.nome,
    dias: valendo.plano.dias_permitidos?.length ? valendo.plano.dias_permitidos : null,
  }
}
