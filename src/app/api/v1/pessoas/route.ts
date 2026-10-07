import { NextResponse, type NextRequest } from 'next/server'
import { acharPorEmail, acharPorTelefone, listarPessoas } from '@/server/pessoas/consultas'
import { inserirPessoa } from '@/server/pessoas/registro'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { erroDoTelefone, normalizarTelefone } from '@/core/telefone'
import { comIdempotencia, lerCorpo } from '@/server/api/idempotencia'
import { primeiro, texto } from '@/core/api/pedido'

/**
 * Achar quem já existe, antes de cadastrar de novo.
 *
 * É a rota que evita o defeito mais previsível da integração: a mesma pessoa
 * virando três cadastros porque escreveu o nome de três jeitos no WhatsApp. A
 * busca é a mesma da tela (`nome_busca`, a coluna sem acento), então "ceci"
 * acha "Cecília" aqui e lá do mesmo jeito.
 *
 * **Duas letras no mínimo.** Sem o piso, um `busca=` vazio devolveria a lista de
 * pessoas da conta inteira para quem tem a chave, e a chave é do bot: ele
 * precisa procurar quem a conversa citou, não baixar o cadastro.
 *
 * O que sai é **o mínimo para reconhecer**: id, nome e telefone. Nada de
 * observação, nascimento ou marcação. O bot marca aula; ficha clínica é da
 * tela, e quem lê tem papel para isso.
 *
 *   GET /api/v1/pessoas?busca=cecilia
 *   GET /api/v1/pessoas?telefone=5544998887766
 *   GET /api/v1/pessoas?email=marina@exemplo.com
 */
export const GET = comChave(async (req: NextRequest, ctx: Contexto) => {
  const parametros = req.nextUrl.searchParams
  const telefone = (parametros.get('telefone') ?? '').trim()
  const busca = (parametros.get('busca') ?? '').trim()
  const email = (parametros.get('email') ?? '').trim()

  /*
   * Procurar pelo número é o caminho do robô; pelo nome, o de quem digitou.
   *
   * **Sem este ramo, o bot começa toda conversa em "qual o seu nome?"**,
   * inclusive com quem faz aula aqui há dois anos e acabou de mandar mensagem
   * para remarcar. Quem escreve "oi" não disse nome nenhum, então a busca por
   * nome não tem o que procurar.
   *
   * Vem primeiro porque é mais específico: quem manda os dois quer o número.
   */
  if (telefone !== '' || email !== '') {
    const pessoas = telefone !== ''
      ? await acharPorTelefone(ctx.db, ctx.contaId, telefone)
      : await acharPorEmail(ctx.db, ctx.contaId, email)

    /*
     * Não achar é **200 com lista vazia**, e não 404.
     *
     * No dado real 30% das pessoas não têm telefone cadastrado, e quem chega
     * pelo WhatsApp pode nunca ter passado por aqui. Não reconhecer é o caminho
     * normal desta rota, não uma falha: um 404 faria o integrador tratar como
     * erro o que é metade das chamadas.
     *
     * Mais de uma é o número da família (mãe e filha). A primeira é a ativa
     * mais nova; quem conversa pergunta o nome quando `total` passa de 1.
     */
    return NextResponse.json({
      total: pessoas.length,
      pessoas: pessoas.map((p) => ({
        pessoaId: p.id,
        nome: p.nome,
        telefone: p.telefone,
        ativa: p.ativo,
      })),
    })
  }

  if (busca.length < 2) {
    return erro(
      400,
      'informe telefone=, email=, ou busca= com pelo menos duas letras',
      'busca',
    )
  }

  const { linhas, total } = await listarPessoas(ctx.db, ctx.contaId, { busca })

  return NextResponse.json({
    total,
    pessoas: linhas.map((p) => ({
      pessoaId: p.id,
      nome: p.nome,
      telefone: p.telefone,
      ativa: p.ativo,
    })),
  })
})

/**
 * Cadastrar quem a busca não achou.
 *
 * Nome é o único obrigatório, igual à tela. A rota chama `inserirPessoa`, que a
 * ação de tela também chama: cadastro válido é uma definição só.
 *
 * **Procure antes de cadastrar.** A rota não tenta adivinhar duplicata, e é de
 * propósito: "Ana" e "Ana Paula" podem ser a mesma pessoa ou duas, e quem sabe é
 * a conversa, não o banco. Recusar por semelhança impediria o cadastro legítimo
 * da segunda Ana; aceitar em silêncio é o comportamento previsível.
 *
 *   POST /api/v1/pessoas
 *   { "nome": "Marina Alves", "telefone": "11988887777" }
 */
export const POST = comChave(async (req: NextRequest, ctx: Contexto) => {
  const corpo = await lerCorpo(req)
  if (!corpo) return erro(400, 'o corpo precisa ser um objeto JSON')

  const nome = texto(corpo.json.nome, 'nome', { obrigatorio: true, max: 120 })
  const telefone = texto(corpo.json.telefone, 'telefone', { max: 40 })
  const externo = texto(corpo.json.identificadorExterno, 'identificadorExterno', { max: 60 })

  const ruim = primeiro(nome.erro, telefone.erro, externo.erro)
  if (ruim) return erroDePedido(ruim)

  /*
   * Telefone inválido é **400**, e não 500.
   *
   * `inserirPessoa` valida com `throw`, porque quem a chama pela tela trata a
   * exceção. Aqui a exceção caía no `catch` genérico da casca e virava
   * "não deu para responder agora": a resposta que faz o integrador procurar
   * defeito no servidor quando o problema está no corpo que ele mandou, e que
   * na automação vira handoff em vez de uma correção possível.
   */
  const erroFone = erroDoTelefone(telefone.valor)
  if (erroFone) return erro(400, erroFone, 'telefone')

  return comIdempotencia(req, ctx, 'POST /pessoas', corpo.bruto, async () => {
    const { id } = await inserirPessoa(ctx.db, ctx.contaId, {
      nome: nome.valor!,
      telefone: telefone.valor,
      identificadorExterno: externo.valor,
    })
    return {
      status: 201,
      corpo: {
        pessoaId: id,
        nome: nome.valor,
        // O que ficou gravado, e não o que chegou: o cadastro guarda sem o
        // país, e devolver `5544…` faria o integrador acreditar numa ficha
        // que a busca por telefone não acha com aquele valor.
        telefone: normalizarTelefone(telefone.valor),
        ativa: true,
      },
    }
  })
})
