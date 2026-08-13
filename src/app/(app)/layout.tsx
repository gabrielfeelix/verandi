import Link from 'next/link'
import { exigirConta, clienteServidor, contasDoUsuario } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { Sair } from '@/components/ui/sair'

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const contas = await contasDoUsuario()

  const operacional = conta.papel === 'dono' || conta.papel === 'recepcao'

  return (
    <div className="min-h-dvh">
      {/* A conta ativa aparece em toda tela de propósito: operar na conta
          errada é o erro mais caro que este sistema permite, e é silencioso. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <strong>{conta.nome}</strong>
        <span className="text-sm opacity-70">{conta.papel}</span>

        <nav className="flex gap-4">
          <Link href="/hoje">Hoje</Link>
          {operacional ? <Link href="/semana">Semana</Link> : null}
          {operacional ? <Link href="/pessoas">{rotulos.pessoa.plural}</Link> : null}
          {operacional ? <Link href="/vaga">Buscar vaga</Link> : null}
          {operacional ? <Link href="/pendencias">Pendências</Link> : null}
          {operacional ? <Link href="/grade">Grade fixa</Link> : null}
          {conta.papel === 'dono' || conta.papel === 'suporte'
            ? <Link href="/config">Configuração</Link> : null}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {contas.length > 1 ? <Link href="/contas">Trocar de conta</Link> : null}
          <Sair />
        </div>
      </header>

      <main className="p-4">{children}</main>
    </div>
  )
}
