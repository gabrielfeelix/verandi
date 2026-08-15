import type { Db } from '../supabase'
import { calcularOcupacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe } from '@/core/agenda/encaixe'
import type { OrigemParticipacao } from './consultas'

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
}

export type ResultadoEncaixe =
  | { ok: true; participacaoId: string }
  | { ok: false; motivo: 'lotada' | 'ja_participa' | 'acima_da_capacidade' | 'sessao_inexistente' }

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
    .select('capacidade, participacao(pessoa_id, status)')
    .eq('id', entrada.sessaoId)
    .eq('conta_id', contaId)
    .maybeSingle()
  if (error) throw error
  if (!sessao) return { ok: false, motivo: 'sessao_inexistente' }

  // a conta decide se a recepção pode abrir exceção; a leitura é aqui e não na
  // tela porque entre mostrar e clicar alguém pode ter mudado a configuração
  const { data: padrao } = await db.from('conta')
    .select('encaixe_acima').eq('id', contaId).single()

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

  const { data: criada, error: erroInsert } = await db.from('participacao').insert({
    conta_id: contaId,
    sessao_id: entrada.sessaoId,
    pessoa_id: entrada.pessoaId,
    origem: entrada.origem,
    status: 'esperada',
    reposicao_de_id: entrada.reposicaoDeId ?? null,
    ...carimbo,
  }).select('id').single()
  if (erroInsert) throw erroInsert

  return { ok: true, participacaoId: criada.id }
}
