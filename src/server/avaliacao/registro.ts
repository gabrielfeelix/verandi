import type { Db } from '../supabase'
import { BALDE_AVALIACAO } from './consultas'

/**
 * O que escreve avaliação, sem saber quem está logado.
 *
 * Mora fora do arquivo de ações pelo mesmo motivo de `pessoas/registro.ts`:
 * arquivo `'use server'` só pode exportar função assíncrona, e tudo que ele
 * exporta vira um endereço que o navegador pode chamar. Uma função que recebe
 * o cliente do banco por parâmetro não pode ser isso, e o teste precisa
 * chamá-la sem sessão.
 */

/**
 * Apaga as avaliações da pessoa, e as imagens antes das linhas.
 *
 * A ordem importa e não é detalhe: apagar a linha primeiro deixa o arquivo no
 * balde sem ninguém que saiba que ele existe, e foto de corpo órfã é o pior
 * tipo de sobra. Se a remoção do arquivo falhar, a linha continua lá, e o
 * próximo pedido tenta de novo.
 */
export async function limparAvaliacoesDaPessoa(
  db: Db, contaId: string, pessoaId: string,
): Promise<void> {
  const { data: fotos } = await db.from('avaliacao_foto')
    .select('path, avaliacao:avaliacao_id(pessoa_id)')
    .eq('conta_id', contaId)
    .returns<Array<{ path: string; avaliacao: { pessoa_id: string } | null }>>()

  const caminhos = (fotos ?? [])
    .filter((f) => f.avaliacao?.pessoa_id === pessoaId)
    .map((f) => f.path)

  if (caminhos.length > 0) {
    const { error } = await db.storage.from(BALDE_AVALIACAO).remove(caminhos)
    if (error) throw error
  }

  // `avaliacao_foto` cai por cascade junto com a avaliação
  const r = await db.from('avaliacao')
    .delete().eq('conta_id', contaId).eq('pessoa_id', pessoaId)
  if (r.error) throw r.error
}
