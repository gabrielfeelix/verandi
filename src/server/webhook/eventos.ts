import { after } from 'next/server'
import type { Db } from '../supabase'
import { enfileirar, entregarPendentes, type TipoDeEvento } from './outbox'

/**
 * O que vai dentro de cada evento, montado num lugar só.
 *
 * A régua do conteúdo é o que o outro lado precisa para **escrever a mensagem
 * sem perguntar de volta**: quem, qual aula, que dia, que horas. Um evento que
 * manda só ids obriga o AutoFluxos a fazer três chamadas antes de conseguir
 * dizer "sua aula de quinta foi cancelada", e é nessas três chamadas que a
 * mensagem atrasa e a pessoa já saiu de casa.
 *
 * **Observação não entra**, aqui como em toda a API. É onde mora dado de saúde,
 * e um webhook é justamente o lugar onde ninguém vai reparar que ela vazou.
 */

type Contexto = { participacaoId?: string; sessaoId: string }

async function corpoDoEvento(
  db: Db, contaId: string, ctx: Contexto,
): Promise<Record<string, unknown> | null> {
  const { data: sessao } = await db
    .from('sessao')
    .select('id, inicio, status, servico:servico_id(nome), profissional:profissional_id(nome)')
    .eq('id', ctx.sessaoId).eq('conta_id', contaId)
    .maybeSingle()
  if (!sessao) return null

  const servico = sessao.servico as unknown as { nome: string } | null
  const profissional = sessao.profissional as unknown as { nome: string } | null

  /*
   * A hora sai no fuso da conta, como todo o resto da API. Mandar instante em
   * UTC aqui recriaria, do lado de fora, o mesmo defeito que a API inteira
   * evita: a aula das 21h vira a de amanhã.
   */
  const { data: conta } = await db.from('conta').select('fuso').eq('id', contaId).single()
  const fuso = conta?.fuso ?? 'America/Sao_Paulo'
  const quando = new Date(sessao.inicio)
  const data = quando.toLocaleDateString('en-CA', { timeZone: fuso })
  const hora = quando.toLocaleTimeString('pt-BR', {
    timeZone: fuso, hour: '2-digit', minute: '2-digit',
  })

  const base: Record<string, unknown> = {
    sessaoId: sessao.id,
    data,
    hora,
    servico: servico?.nome ?? null,
    profissional: profissional?.nome ?? null,
  }

  if (!ctx.participacaoId) return base

  const { data: p } = await db
    .from('participacao')
    .select('id, status, origem, pessoa:pessoa_id(id, nome, telefone)')
    .eq('id', ctx.participacaoId).eq('conta_id', contaId)
    .maybeSingle()
  if (!p) return base

  const pessoa = p.pessoa as unknown as { id: string; nome: string; telefone: string | null } | null

  return {
    ...base,
    participacaoId: p.id,
    status: p.status,
    origem: p.origem,
    pessoaId: pessoa?.id ?? null,
    pessoa: pessoa?.nome ?? null,
    telefone: pessoa?.telefone ?? null,
  }
}

/**
 * Enfileira o evento e tenta entregar depois que a resposta já saiu.
 *
 * `after` é o que separa as duas coisas: quem cancelou a aula recebe a tela
 * pronta na mesma velocidade de antes, e a entrega acontece em seguida, na mesma
 * invocação. Se falhar, a linha continua na fila com hora marcada para a próxima
 * tentativa, e ninguém do lado de cá fica sabendo, que é exatamente o desejado.
 */
export async function avisar(
  db: Db, contaId: string, tipo: TipoDeEvento, ctx: Contexto,
): Promise<void> {
  try {
    const dados = await corpoDoEvento(db, contaId, ctx)
    if (!dados) return
    await enfileirar(db, contaId, tipo, dados)
    after(async () => {
      try {
        await entregarPendentes()
      } catch (e) {
        console.error('[outbox] falha ao entregar depois da resposta', e)
      }
    })
  } catch (e) {
    // avisar é efeito, nunca pedido: erro aqui não pode voltar para quem chamou
    console.error('[outbox] não consegui preparar o evento', tipo, e)
  }
}
