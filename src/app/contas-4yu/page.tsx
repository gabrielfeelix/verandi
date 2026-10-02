import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import {
  ehSuporte, listarContas, listarAcessosDeSuporte, CONTAS_POR_PAGINA,
} from '@/server/suporte/consultas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { PainelContas } from '@/components/suporte/painel-contas'

/**
 * A tela da 4YU: criar, diagnosticar e entrar nas contas dos clientes.
 *
 * É a única que atravessa o isolamento entre clientes, então a checagem de
 * papel vem antes de qualquer leitura — e é código, porque a RLS não tem como
 * autorizar quem cria a própria linha em `conta`.
 *
 * Busca e página vivem na URL, como em `/pessoas`: assim o "conta do Daniel"
 * que alguém achou vira link que se manda no chat, e o voltar do navegador
 * desfaz a busca em vez de sair da tela.
 */
export default async function Contas4YU({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  await exigirConta()
  const db = await clienteServidor()
  if (!(await ehSuporte(db))) redirect('/hoje')

  const { q, p } = await searchParams
  const pagina = Math.max(1, Number(p) || 1)

  const [{ linhas: contas, total }, acessos] = await Promise.all([
    listarContas({ busca: q, pagina }),
    listarAcessosDeSuporte(),
  ])

  return (
    <ProvedorDeAviso>
      {/* o cabeçalho mora no painel: os dois botões dele abrem coisas que são
          estado do cliente.

          Daqui só descem valores. O endereço de cada página é montado lá
          dentro: função não atravessa a fronteira de Server para Client
          Component, e o Next recusa em tempo de execução, não de compilação. */}
      <PainelContas
        contas={contas}
        acessos={acessos}
        busca={q ?? ''}
        pagina={pagina}
        total={total}
        porPagina={CONTAS_POR_PAGINA}
      />
    </ProvedorDeAviso>
  )
}
