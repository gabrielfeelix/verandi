import { redirect } from 'next/navigation'
import { contasDoUsuario } from '@/server/conta'
import { destinoDoPapel } from '@/core/acesso/destino'
import { escolherConta } from './acoes'

export default async function Contas() {
  const contas = await contasDoUsuario()

  if (contas.length === 0) redirect('/entrar')
  // quem tem uma conta só nunca vê esta tela
  if (contas.length === 1) redirect(destinoDoPapel(contas[0].papel))

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">Em qual conta você vai trabalhar?</h1>

      <ul className="flex flex-col gap-2">
        {contas.map((c) => (
          <li key={c.contaId}>
            <form action={escolherConta}>
              <input type="hidden" name="contaId" value={c.contaId} />
              <button type="submit" className="w-full rounded border px-3 py-2 text-left">
                <span className="font-medium">{c.nome}</span>
                <span className="ml-2 text-sm opacity-70">{c.papel}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  )
}
