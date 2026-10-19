import { NextResponse, type NextRequest } from 'next/server'
import { clienteAdmin, type Db } from '../supabase'
import { contaDaChave } from './chave'
import { avisarErro } from '../alerta'
import type { Erro } from '@/core/api/pedido'

/**
 * A casca de toda rota da API v1.
 *
 * Existe para que autenticação e formato de erro sejam escritos **uma vez**.
 * Rota que repete o `if (!chave) return 401` é rota que um dia esquece o `if`,
 * e o esquecimento não aparece em teste de caminho feliz.
 */

export type Contexto = {
  /** a conta dona da chave. **Toda** consulta precisa filtrar por ela */
  contaId: string
  chaveId: string
  /**
   * Cliente com a chave de serviço, que **ignora RLS**.
   *
   * É o único caminho possível: quem chama a API não tem sessão, então não há
   * `auth.uid()` para a política avaliar. Em troca, o isolamento entre contas
   * deixa de ser garantido pelo banco e passa a ser responsabilidade de quem
   * escreve a rota. Se um `select` daqui esquecer o `conta_id`, ele lê a conta
   * de todo mundo.
   *
   * As funções de `server/` que a API reusa já recebem `contaId` e filtram por
   * ele, e é por isso que a rota deve chamá-las em vez de montar consulta nova.
   */
  db: Db
}

export function erro(status: number, mensagem: string, campo?: string) {
  return NextResponse.json({ erro: mensagem, ...(campo ? { campo } : {}) }, { status })
}

export function erroDePedido(e: Erro) {
  return erro(400, e.mensagem, e.campo)
}

/**
 * Autentica e chama a rota, ou devolve 401.
 *
 * **O 401 é sempre igual**: chave ausente, malformada, inexistente, revogada ou
 * de conta suspensa dão a mesma resposta. Distinguir seria dizer a quem está
 * tentando qual das cinco portas existe.
 */
/**
 * Limite de pedidos da API, contado no banco (`app_verandi.consumir_limite`,
 * 0083): na Vercel cada instância nasce zerada, então contagem em memória não
 * segura nada.
 *
 * Por chave, 300 por minuto: folga larga para o robô do AutoFluxos, que é
 * quem mais chama, e ainda assim um teto para chave vazada ou laço de
 * integração. Sem chave válida, 30 por minuto por endereço.
 *
 * Falha aberta: se o banco não responder o limite, o pedido segue. Derrubar a
 * API inteira porque o contador falhou seria pior do que o abuso que ele
 * evita.
 */
const LIMITE_POR_CHAVE = { teto: 300, janelaSegundos: 60 }
const LIMITE_SEM_CHAVE = { teto: 30, janelaSegundos: 60 }

async function dentroDoLimite(chave: string, limite: { teto: number; janelaSegundos: number }) {
  const { data, error } = await clienteAdmin().rpc('consumir_limite', {
    p_chave: chave, p_teto: limite.teto, p_janela_segundos: limite.janelaSegundos,
  })
  if (error) {
    console.error('[api/v1] limite indisponível', error.message)
    return true
  }
  return data !== false
}

function muitoPedido() {
  const resposta = erro(429, 'muitos pedidos em pouco tempo; tente de novo em um minuto')
  resposta.headers.set('Retry-After', '60')
  return resposta
}

export function comChave<P extends Record<string, string> = Record<string, never>>(
  fn: (req: NextRequest, ctx: Contexto, params: P) => Promise<NextResponse>,
) {
  return async (
    req: NextRequest,
    /*
     * O segundo argumento do Next, com os pedaços da rota. No Next 16 ele chega
     * como promessa, e rota sem pedaço nenhum não recebe nada, por isso o
     * opcional: sem ele, `/catalogo` quebraria ao ser chamada.
     */
    contexto?: { params: Promise<P> },
  ): Promise<NextResponse> => {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sem-ip'
    const conta = await contaDaChave(req.headers.get('authorization'))
    if (!conta) {
      // chave errada repetida do mesmo endereço: quem tenta não ganha tentativa infinita
      if (!(await dentroDoLimite(`v1:ip:${ip}`, LIMITE_SEM_CHAVE))) return muitoPedido()
      return erro(401, 'chave de API ausente ou inválida')
    }
    if (!(await dentroDoLimite(`v1:chave:${conta.chaveId}`, LIMITE_POR_CHAVE))) return muitoPedido()

    try {
      const params = contexto ? await contexto.params : ({} as P)
      return await fn(req, { ...conta, db: clienteAdmin() }, params)
    } catch (e) {
      /*
       * O detalhe do erro fica no log do servidor, não na resposta. Mensagem de
       * Postgres vazada para fora leva junto nome de tabela e de coluna, que é
       * o mapa do banco entregue a quem estava só tentando.
       */
      console.error('[api/v1]', req.nextUrl.pathname, e)
      /*
       * A rota tem `try` próprio, então o gancho do Next nunca a vê: sem esta
       * linha, justamente o caminho do robô, que ninguém está olhando, seria o
       * único que quebra em silêncio.
       */
      await avisarErro(`api ${req.nextUrl.pathname}`, e)
      return erro(500, 'não deu para responder agora')
    }
  }
}
