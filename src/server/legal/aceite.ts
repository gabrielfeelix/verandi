import { headers } from 'next/headers'
import { clienteAdmin } from '../supabase'
import { LINKS_LEGAIS, VERSAO } from '@/core/legal'

/**
 * O registro de que alguém aceitou os documentos publicados.
 *
 * Escreve com a chave de serviço porque nos dois caminhos que chamam isto a
 * pessoa ainda não tem sessão utilizável: no convite ela acabou de existir, e no
 * login o cookie só é gravado depois. E porque a tabela não é dado de conta, é
 * prova da 4YU, e nenhum usuário logado alcança ela (ver migration `0046`).
 *
 * **Falha aqui não derruba o login.** O aceite é registro do que aconteceu, e o
 * que aconteceu é a pessoa entrar; recusar a entrada porque a prova não gravou
 * seria trocar o produto pela ata dele. O erro vai para o log, alto, e é um dos
 * casos que o monitoramento do item 3 do plano 11 existe para enxergar.
 */
export async function registrarAceite(d: {
  usuarioId: string
  contaId?: string | null
  origem: 'convite' | 'entrada'
}): Promise<void> {
  try {
    const h = await headers()
    /*
     * `x-forwarded-for` chega como uma lista quando há mais de um intermediário,
     * e o primeiro endereço é o de quem pediu. Guardar a lista inteira registra
     * a infraestrutura da Vercel junto com a pessoa, o que não prova nada e
     * guarda dado a mais.
     */
    const ip = (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '')
      .split(',')[0]
      .trim() || null
    const agente = h.get('user-agent')?.slice(0, 400) ?? null

    const db = clienteAdmin()

    /*
     * Uma linha por documento, e não uma linha com dois campos: cada documento
     * tem versão própria, e no dia em que uma mudar sem a outra o registro
     * precisa saber dizer qual foi aceita quando.
     *
     * `ignoreDuplicates` porque aceitar a mesma versão de novo não acrescenta
     * prova: quem entra toda manhã não precisa de uma linha por manhã.
     */
    const { error } = await db.from('aceite_de_termos').upsert(
      LINKS_LEGAIS.map((l) => ({
        usuario_id: d.usuarioId,
        conta_id: d.contaId ?? null,
        documento: l.href.replace('/', ''),
        versao: VERSAO,
        origem: d.origem,
        ip,
        agente,
      })),
      { onConflict: 'usuario_id,documento,versao', ignoreDuplicates: true },
    )
    if (error) throw error
  } catch (e) {
    console.error('[aceite] não consegui registrar o aceite dos termos', e)
  }
}
