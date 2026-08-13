import { exigirConta, clienteServidor, contasDoUsuario } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { Sair } from '@/components/ui/sair'
import { FaixaSuporte } from '@/components/ui/faixa-suporte'
import { Rail, BarraInferior, type ItemRail } from '@/components/ui/rail'

const PAPEL: Record<string, string> = {
  dono: 'Dono',
  recepcao: 'Recepção',
  profissional: 'Profissional',
  suporte: 'Suporte 4YU',
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const contas = await contasDoUsuario()

  const { data: { user } } = await db.auth.getUser()

  // o nome da grade é o nome da pessoa; quem não é profissional cai no e-mail
  const { data: eu } = await db
    .from('profissional').select('nome')
    .eq('conta_id', conta.contaId)
    .eq('usuario_id', user?.id ?? '')
    .maybeSingle<{ nome: string }>()

  const operacional = conta.papel === 'dono' || conta.papel === 'recepcao'

  const itens: ItemRail[] = [
    { href: '/hoje', rotulo: 'Hoje', curto: 'Hoje', glifo: '◍' },
    ...(operacional
      ? ([
          { href: '/semana', rotulo: 'Grade da semana', curto: 'Semana', glifo: '▦' },
          { href: '/pendencias', rotulo: 'Pendências', curto: 'Pend.', glifo: '◎' },
          {
            href: '/pessoas',
            rotulo: rotulos.pessoa.plural,
            curto: rotulos.pessoa.plural,
            glifo: '◇',
          },
          { href: '/vaga', rotulo: 'Buscar vaga', curto: 'Vaga', glifo: '⌕' },
          { href: '/grade', rotulo: 'Grade fixa', curto: 'Fixa', glifo: '⊞' },
        ] satisfies ItemRail[])
      : []),
    ...(conta.papel === 'dono' || conta.papel === 'suporte'
      ? ([{ href: '/config', rotulo: 'Configuração', curto: 'Config', glifo: '⚙' }] satisfies ItemRail[])
      : []),
    ...(conta.papel === 'suporte'
      ? ([{ href: '/contas-4yu', rotulo: 'Contas (4YU)', curto: '4YU', glifo: '◆' }] satisfies ItemRail[])
      : []),
  ]

  // em celular são quatro, não nove: quem está em pé na sala precisa do que usa
  const tabs = itens.filter((i) =>
    ['/hoje', '/semana', '/pessoas', '/pendencias'].includes(i.href),
  )

  return (
    <div className="min-h-dvh">
      {/* A faixa fica acima de tudo e não some enquanto o suporte estiver dentro
          de conta de cliente. Na conta da própria 4YU não há o que avisar. */}
      {conta.papel === 'suporte' && !conta.interna
        ? <FaixaSuporte conta={conta.nome} /> : null}

      <div className="flex min-h-dvh">
        <Rail
          itens={itens}
          conta={conta.nome}
          pessoa={eu?.nome ?? user?.email ?? 'Você'}
          papel={PAPEL[conta.papel] ?? conta.papel}
          podeTrocar={contas.length > 1}
          sair={<Sair />}
        />

        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">
          {/* A conta ativa aparece em toda tela de propósito: operar na conta
              errada é o erro mais caro que este sistema permite, e é silencioso.
              No rail ela está sempre no topo; em celular, aqui. */}
          <p className="mb-3 flex items-center gap-2 md:hidden">
            <span className="font-titulo text-[15px] font-semibold">{conta.nome}</span>
            <span className="text-[11.5px] text-tinta-media">
              {PAPEL[conta.papel] ?? conta.papel}
            </span>
            {contas.length > 1 ? (
              <a href="/contas" className="ml-auto text-[12.5px] text-marca underline">
                Trocar
              </a>
            ) : null}
          </p>

          {children}
        </main>
      </div>

      <BarraInferior itens={tabs} />
    </div>
  )
}
