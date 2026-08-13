import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { ehSuporte, listarContas, listarAcessosDeSuporte } from '@/server/suporte/consultas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { PainelContas } from '@/components/suporte/painel-contas'

/**
 * A tela da 4YU: criar, diagnosticar e entrar nas contas dos clientes.
 *
 * É a única que atravessa o isolamento entre clientes, então a checagem de
 * papel vem antes de qualquer leitura — e é código, porque a RLS não tem como
 * autorizar quem cria a própria linha em `conta`.
 */
export default async function Contas4YU() {
  await exigirConta()
  const db = await clienteServidor()
  if (!(await ehSuporte(db))) redirect('/hoje')

  const [contas, acessos] = await Promise.all([
    listarContas(),
    listarAcessosDeSuporte(),
  ])

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Contas
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            Painel da 4YU · {contas.length}{' '}
            {contas.length === 1 ? 'conta' : 'contas'} · sinais de vida antes da
            reclamação
          </p>
        </header>

        <PainelContas contas={contas} acessos={acessos} />
      </div>
    </ProvedorDeAviso>
  )
}
