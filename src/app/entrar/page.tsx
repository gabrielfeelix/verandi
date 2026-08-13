'use client'

import { useActionState } from 'react'
import { entrar, type EstadoEntrar } from './acoes'

export default function Entrar() {
  const [estado, acao, pendente] = useActionState<EstadoEntrar, FormData>(entrar, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Verandi</h1>

      <form action={acao} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">E-mail</label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha" name="senha" type="password" required
            autoComplete="current-password"
            className="rounded border px-3 py-2"
          />
        </div>

        {estado?.erro ? <p role="alert">{estado.erro}</p> : null}

        <button type="submit" disabled={pendente} className="rounded border px-3 py-2">
          {pendente ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
