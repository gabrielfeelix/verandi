import { NextResponse, type NextRequest } from 'next/server'
import { listarPessoas } from '@/server/pessoas/consultas'
import { comChave, erro, type Contexto } from '@/server/api/rota'

/**
 * Achar quem já existe, antes de cadastrar de novo.
 *
 * É a rota que evita o defeito mais previsível da integração: a mesma pessoa
 * virando três cadastros porque escreveu o nome de três jeitos no WhatsApp. A
 * busca é a mesma da tela — `nome_busca`, a coluna sem acento —, então "ceci"
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
 */
export const GET = comChave(async (req: NextRequest, ctx: Contexto) => {
  const busca = (req.nextUrl.searchParams.get('busca') ?? '').trim()
  if (busca.length < 2) {
    return erro(400, 'busca precisa de pelo menos duas letras', 'busca')
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
