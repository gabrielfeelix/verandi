import { Abas } from '@/components/ui/abas'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'

export type SecaoDoFinanceiro = 'cobrancas' | 'fechamento' | 'recibos' | 'aulas'

/**
 * As quatro seções do Financeiro, no topo de cada uma.
 *
 * Recibos e Aulas por professor eram itens próprios do menu. São consulta de
 * dinheiro, e moram aqui: o menu ficou com uma entrada por pergunta. Aulas por
 * professor é a base do pagamento da equipe, e só o dono vê.
 */
export async function SecoesDoFinanceiro({ ativa }: { ativa: SecaoDoFinanceiro }) {
  const conta = await exigirConta()
  const comAulas = conta.papel === 'dono' || conta.papel === 'suporte'
  const rotulos = resolverRotulos(await carregarVocabulario(await clienteServidor(), conta.contaId))
  return (
    <Abas
      rotuloDoGrupo="Seções do financeiro"
      ativo={ativa}
      itens={[
        { id: 'cobrancas', rotulo: 'Cobranças', href: '/financeiro' },
        { id: 'fechamento', rotulo: 'Fechamento', href: '/financeiro?aba=fechamento' },
        { id: 'recibos', rotulo: 'Recibos', href: '/recibos' },
        ...(comAulas
          ? [{
            id: 'aulas',
            rotulo: `${rotulos.sessao.plural} por ${rotulos.profissional.singular.toLowerCase()}`,
            href: '/aulas',
          }]
          : []),
      ]}
    />
  )
}
