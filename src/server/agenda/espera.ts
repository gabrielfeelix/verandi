import type { Db } from '../supabase'
import { calcularOcupacao } from '@/core/agenda/ocupacao'
import { temVagaParaOferecer } from '@/core/agenda/encaixe'
import { enfileirar } from '../webhook/outbox'

/**
 * A fila de quem quer ser avisado quando abrir vaga.
 *
 * O ciclo inteiro é: o horário está cheio, a pessoa entra na fila, alguém
 * cancela, a vaga existe de novo, e o evento `vaga.aberta` sai com quem está na
 * frente. Quem chama é o outro sistema, que manda a mensagem.
 *
 * **A Verandi não marca sozinha.** Chamar não é reservar: a vaga continua aberta
 * para quem chegar primeiro, inclusive para a recepção que está com alguém no
 * balcão. Marcar automaticamente quem está na fila seria o robô decidindo, que é
 * exatamente o que este produto não faz, e criaria a pior conversa possível,
 * "você foi marcada numa aula que não pediu".
 */

export type EntrarNaFila =
  | { ok: true; esperaId: string; posicao: number }
  | { ok: false; motivo: 'sessao_inexistente' | 'ja_participa' | 'tem_vaga' | 'ja_esperava' }

export async function entrarNaEspera(
  db: Db, contaId: string, sessaoId: string, pessoaId: string,
): Promise<EntrarNaFila> {
  const { data: sessao } = await db
    .from('sessao')
    .select('id, capacidade, participacao(pessoa_id, status)')
    .eq('id', sessaoId).eq('conta_id', contaId)
    .maybeSingle()
  if (!sessao) return { ok: false, motivo: 'sessao_inexistente' }

  if (sessao.participacao.some((p) => p.pessoa_id === pessoaId)) {
    return { ok: false, motivo: 'ja_participa' }
  }

  /*
   * Fila em horário que tem vaga é confusão pura: a pessoa fica esperando um
   * aviso que nunca vem, porque a vaga já estava lá. A resposta certa é mandar
   * marcar.
   */
  const ocupacao = calcularOcupacao(
    sessao.capacidade, sessao.participacao.map((p) => p.status),
  )
  if (temVagaParaOferecer(ocupacao)) return { ok: false, motivo: 'tem_vaga' }

  const { data, error } = await db.from('espera')
    .insert({ conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoaId })
    .select('id, criado_em')
    .single()
  if (error) {
    // 23505 é o índice único: já está na fila, e isso não é erro para quem chama
    if (error.code === '23505') return { ok: false, motivo: 'ja_esperava' }
    throw error
  }

  const { count } = await db.from('espera')
    .select('id', { count: 'exact', head: true })
    .eq('sessao_id', sessaoId).is('cancelado_em', null)
    .lte('criado_em', data.criado_em)

  return { ok: true, esperaId: data.id, posicao: count ?? 1 }
}

export async function sairDaEspera(
  db: Db, contaId: string, esperaId: string,
): Promise<boolean> {
  const { data, error } = await db.from('espera')
    .update({ cancelado_em: new Date().toISOString() })
    .eq('id', esperaId).eq('conta_id', contaId).is('cancelado_em', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return !!data
}

/**
 * A vaga abriu. Avisa quem está na frente.
 *
 * Chamada depois de toda saída de participação, e ela mesma confere se sobrou
 * vaga de verdade: uma turma de quatro com seis marcadas continua cheia depois
 * de uma desistência, e mandar "abriu vaga" ali seria mentir para quem esperou.
 *
 * Avisa **uma pessoa por vaga aberta**, na ordem de chegada. Mandar para a fila
 * inteira transformaria a boa notícia numa corrida em que cinco perdem, e as
 * cinco vão achar que o estúdio brincou com elas.
 */
export async function avisarQuemEspera(
  db: Db, contaId: string, sessaoId: string,
): Promise<number> {
  const { data: sessao } = await db
    .from('sessao')
    .select('id, inicio, status, capacidade, participacao(status)')
    .eq('id', sessaoId).eq('conta_id', contaId)
    .maybeSingle()
  if (!sessao || sessao.status === 'cancelada') return 0
  if (Date.parse(sessao.inicio) < Date.now()) return 0

  const ocupacao = calcularOcupacao(
    sessao.capacidade, sessao.participacao.map((p) => p.status),
  )
  if (!temVagaParaOferecer(ocupacao)) return 0

  const { data: fila } = await db.from('espera')
    .select('id, pessoa:pessoa_id(id, nome, telefone)')
    .eq('sessao_id', sessaoId)
    .is('cancelado_em', null).is('avisado_em', null)
    .order('criado_em')
    .limit(ocupacao.livres)
  if (!fila?.length) return 0

  const agora = new Date().toISOString()
  await db.from('espera').update({ avisado_em: agora }).in('id', fila.map((f) => f.id))

  for (const f of fila) {
    const pessoa = f.pessoa as unknown as
      { id: string; nome: string; telefone: string | null } | null
    await enfileirar(db, contaId, 'vaga.aberta', {
      esperaId: f.id,
      sessaoId,
      pessoaId: pessoa?.id ?? null,
      pessoa: pessoa?.nome ?? null,
      telefone: pessoa?.telefone ?? null,
      /* quantas vagas abriram, para o outro lado não prometer duas na mesma */
      vagas: ocupacao.livres,
    })
  }

  return fila.length
}
