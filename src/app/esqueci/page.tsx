'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { PainelAcesso } from '@/components/ui/painel-acesso'
import { Botao } from '@/components/ui/botao'
import { Rotulo, entrada } from '@/components/ui/pecas'
import { pedirSenhaNova, type EstadoEsqueci } from './acoes'

export default function Esqueci() {
  const [estado, acao, pendente] = useActionState<EstadoEsqueci, FormData>(
    pedirSenhaNova, null,
  )

  return (
    <PainelAcesso tela="esqueci">
      <h1 className="font-titulo text-[27px] font-semibold tracking-[-.02em]">
        Vamos criar outra
      </h1>
      <p className="pt-2 pb-6 text-[13.5px] leading-relaxed text-tinta-media">
        Diga o e-mail que você usa para entrar. Mandamos um link para criar uma
        senha nova.
      </p>

      <form action={acao} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email">
            <Rotulo>E-mail</Rotulo>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            autoFocus placeholder="voce@estudio.com.br"
            className={entrada}
          />
        </div>

        {estado?.erro ? (
          <p className="flex items-center gap-2.5 rounded-padrao border border-alerta-linha bg-alerta-superficie px-3 py-2.5 text-[12.5px] text-alerta-texto">
            <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-alerta" />
            {estado.erro}
          </p>
        ) : null}

        <Botao
          type="submit"
          disabled={pendente}
          className="mt-2 min-h-13 w-full rounded-media text-[14.5px] font-semibold"
        >
          {pendente ? 'Mandando…' : 'Mandar o link'}
        </Botao>
      </form>

      <p className="pt-4 text-center text-[12.5px] leading-[1.5] text-tinta-fraca">
        Lembrou?{' '}
        <Link href="/entrar" className="font-medium text-marca hover:text-marca-forte">
          Voltar para entrar
        </Link>
      </p>
    </PainelAcesso>
  )
}
