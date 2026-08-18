import { clienteServidor, exigirConta } from '../conta'
import { ordenarPosicoes, POSICOES_PADRAO } from '@/core/avaliacao/posicoes'
import type { Papel } from '@/core/acesso/destino'
import type { AvaliacaoNaTela, PosicaoNaTela } from '@/components/avaliacao/tipos'

export const BALDE_AVALIACAO = 'foto-avaliacao'

/** uma hora: dura o que dura a consulta, e o endereço morre antes do dia acabar */
const PRAZO_DO_ENDERECO = 60 * 60

/**
 * Quem enxerga a avaliação.
 *
 * Foto de corpo é dado de saúde, e a recepção não precisa dela para marcar
 * aula. A barreira mora aqui e na ação, não só na tela: esconder a aba sem
 * barrar o servidor é proteger a vista e deixar o dado aberto, que foi
 * exatamente a distinção que a `0043` já teve que fazer para a observação da
 * participação.
 */
export function podeVerAvaliacao(papel: Papel): boolean {
  return papel !== 'recepcao'
}

/**
 * As posições da conta, criando as seis de partida na primeira vez.
 *
 * A criação é aqui, e não numa migration que varre todas as contas, por dois
 * motivos: conta que nunca vai usar o módulo não precisa carregar seis linhas,
 * e conta criada depois da migration nasceria sem elas de qualquer jeito.
 */
export async function posicoesDaConta(): Promise<PosicaoNaTela[]> {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { data } = await db.from('posicao_avaliacao')
    .select('id, nome, ordem')
    .eq('conta_id', conta.contaId)
    .eq('ativo', true)
    .returns<PosicaoNaTela[]>()

  if (data && data.length > 0) return ordenarPosicoes(data)

  const { data: criadas, error } = await db.from('posicao_avaliacao')
    .insert(POSICOES_PADRAO.map((nome, i) => ({
      conta_id: conta.contaId, nome, ordem: i + 1, ativo: true,
    })))
    .select('id, nome, ordem')
    .returns<PosicaoNaTela[]>()
  if (error) throw error
  return ordenarPosicoes(criadas ?? [])
}

/**
 * As avaliações da pessoa, da mais antiga para a mais nova.
 *
 * A ordem é essa porque é como se lê progresso: da esquerda para a direita, do
 * começo para hoje. A tela que quiser a mais recente primeiro que inverta, mas
 * a matriz e a comparação leem nesta.
 *
 * Os endereços das fotos são assinados em **um lote só**. Uma pessoa com quatro
 * avaliações de seis posições tem vinte e quatro imagens, e assinar uma a uma
 * seriam vinte e quatro idas ao Storage para desenhar uma tela.
 */
export async function avaliacoesDaPessoa(pessoaId: string): Promise<AvaliacaoNaTela[]> {
  const conta = await exigirConta()
  if (!podeVerAvaliacao(conta.papel)) return []
  const db = await clienteServidor()

  const { data, error } = await db.from('avaliacao')
    .select('id, data, observacao, profissional:profissional_id(nome), fotos:avaliacao_foto(posicao_id, path, observacao)')
    .eq('conta_id', conta.contaId)
    .eq('pessoa_id', pessoaId)
    .order('data', { ascending: true })
    .returns<Array<{
      id: string
      data: string
      observacao: string | null
      profissional: { nome: string } | null
      fotos: Array<{ posicao_id: string; path: string; observacao: string | null }>
    }>>()
  if (error) throw error
  if (!data || data.length === 0) return []

  const caminhos = data.flatMap((a) => a.fotos.map((f) => f.path))
  const { data: assinados } = caminhos.length
    ? await db.storage.from(BALDE_AVALIACAO)
        .createSignedUrls(caminhos, PRAZO_DO_ENDERECO)
    : { data: [] }

  const porCaminho = new Map(
    (assinados ?? []).map((a) => [a.path ?? '', a.signedUrl]),
  )

  return data.map((a) => ({
    id: a.id,
    data: a.data,
    profissional: a.profissional?.nome ?? null,
    observacao: a.observacao,
    // foto cujo endereço não foi assinado fica de fora: melhor a coluna vazia,
    // que a tela explica, do que uma imagem quebrada que parece defeito
    fotos: a.fotos.flatMap((f) => {
      const url = porCaminho.get(f.path)
      return url ? [{ posicaoId: f.posicao_id, url, observacao: f.observacao }] : []
    }),
  }))
}
