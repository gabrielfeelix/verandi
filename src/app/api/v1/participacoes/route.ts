import { type NextRequest } from 'next/server'
import { encaixarNaSessao } from '@/server/agenda/encaixe'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { comIdempotencia, lerCorpo } from '@/server/api/idempotencia'
import { escolha, idObrigatorio, primeiro } from '@/core/api/pedido'

/**
 * Marcar alguém num horário.
 *
 * A rota **não decide se cabe**. Quem decide é `encaixarNaSessao`, a mesma
 * função que a tela chama, e essa igualdade é o ponto: se a recepção vê "cheia"
 * e o bot marca assim mesmo, a confiança no sistema inteiro acaba num dia, e o
 * defeito leva semanas para aparecer porque os dois lados continuam respondendo
 * com convicção.
 *
 * **O bot nunca confirma acima da capacidade.** `confirmarAcima` fica em `false`,
 * fixo, e não é parâmetro. Encaixe acima da lotação é decisão de quem está no
 * balcão olhando para a pessoa, com nome e registro; um robô confirmando a sexta
 * pessoa numa turma de quatro, às onze da noite, é exatamente o que o produto
 * decidiu não permitir.
 *
 * A origem padrão é `avulso`. `reposicao` exige dizer qual falta está sendo
 * reposta, senão o crédito continuaria aberto e a mesma falta viraria duas
 * reposições.
 *
 *   POST /api/v1/participacoes
 *   { "pessoaId": "...", "sessaoId": "...", "origem": "avulso" }
 */

const ORIGENS = ['avulso', 'reposicao', 'encaixe', 'reserva'] as const

export const POST = comChave(async (req: NextRequest, ctx: Contexto) => {
  const corpo = await lerCorpo(req)
  if (!corpo) return erro(400, 'o corpo precisa ser um objeto JSON')

  const origem = escolha(corpo.json.origem, 'origem', ORIGENS, 'avulso')
  const ruim = primeiro(
    idObrigatorio(corpo.json.pessoaId, 'pessoaId'),
    idObrigatorio(corpo.json.sessaoId, 'sessaoId'),
    origem.erro,
  )
  if (ruim) return erroDePedido(ruim)

  const pessoaId = corpo.json.pessoaId as string
  const sessaoId = corpo.json.sessaoId as string
  const reposicaoDeId = corpo.json.reposicaoDeId as string | undefined

  if (origem.valor === 'reposicao' && !reposicaoDeId) {
    return erro(400, 'reposicaoDeId é obrigatório quando origem é reposicao', 'reposicaoDeId')
  }

  return comIdempotencia(req, ctx, 'POST /participacoes', corpo.bruto, async () => {
    /*
     * A pessoa é conferida antes, e por conta: sem isto, o id de alguém de outro
     * cliente entraria numa sessão daqui e o banco aceitaria, porque quem chama
     * a API usa a chave de serviço e não passa por RLS.
     */
    const { data: pessoa } = await ctx.db.from('pessoa')
      .select('id, ativo, anonimizada_em')
      .eq('id', pessoaId).eq('conta_id', ctx.contaId)
      .maybeSingle()
    if (!pessoa) return { status: 404, corpo: { erro: 'esta pessoa não existe nesta conta' } }
    if (pessoa.anonimizada_em) {
      return { status: 409, corpo: { erro: 'esta pessoa pediu a exclusão dos dados dela' } }
    }

    /*
     * Sessão cancelada e sessão no passado ficam fora, e a conferência é aqui e
     * não na função compartilhada de propósito: pela tela, marcar alguém numa
     * aula de ontem é registro retroativo legítimo, feito por quem estava lá. O
     * bot não estava, e não tem por que escrever no passado.
     */
    const { data: sessao } = await ctx.db.from('sessao')
      .select('id, inicio, status')
      .eq('id', sessaoId).eq('conta_id', ctx.contaId)
      .maybeSingle()
    if (!sessao) return { status: 404, corpo: { erro: 'este horário não existe nesta conta' } }
    if (sessao.status === 'cancelada') {
      return { status: 409, corpo: { erro: 'este horário foi cancelado' } }
    }
    if (Date.parse(sessao.inicio) < Date.now()) {
      return { status: 409, corpo: { erro: 'este horário já passou' } }
    }

    const r = await encaixarNaSessao(
      ctx.db,
      ctx.contaId,
      {
        registrado_por_usuario_id: null,
        registrado_por_origem: 'bot',
        registrado_em: new Date().toISOString(),
      },
      { sessaoId, pessoaId, origem: origem.valor, reposicaoDeId, confirmarAcima: false },
    )

    if (!r.ok) {
      const motivo: Record<string, string> = {
        lotada: 'este horário está cheio',
        acima_da_capacidade: 'este horário está cheio',
        ja_participa: 'esta pessoa já está marcada neste horário',
        sessao_inexistente: 'este horário não existe nesta conta',
      }
      return {
        status: r.motivo === 'sessao_inexistente' ? 404 : 409,
        corpo: { erro: motivo[r.motivo], motivo: r.motivo },
      }
    }

    return {
      status: 201,
      corpo: {
        participacaoId: r.participacaoId,
        pessoaId,
        sessaoId,
        origem: origem.valor,
        status: 'esperada',
      },
    }
  })
})
