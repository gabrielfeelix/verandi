'use client'

import { useActionState, useState } from 'react'
import { PainelAcesso } from '@/components/ui/painel-acesso'
import { Botao } from '@/components/ui/botao'
import { Rotulo, entrada } from '@/components/ui/pecas'
import { entrar, type EstadoEntrar } from './acoes'

export default function Entrar() {
  const [estado, acao, pendente] = useActionState<EstadoEntrar, FormData>(entrar, null)
  const [verSenha, setVerSenha] = useState(false)

  return (
    <PainelAcesso tela="entrar">
      <h1 className="font-titulo text-[27px] font-semibold tracking-[-.02em]">
        Que bom te ver
      </h1>
      <p className="pt-2 pb-6 text-[13.5px] leading-relaxed text-tinta-media">
        Entre com o e-mail que recebeu o convite do estúdio.
      </p>

      <form action={acao} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email">
            <Rotulo>E-mail</Rotulo>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            placeholder="voce@estudio.com.br"
            className={entrada}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha">
            <Rotulo>Senha</Rotulo>
          </label>
          <div className="campo-caixa pr-2">
            <input
              id="senha" name="senha" required autoComplete="current-password"
              type={verSenha ? 'text' : 'password'}
              className="min-h-12 min-w-0 flex-1 bg-transparent px-[15px] text-[14px] tracking-[.02em] outline-none"
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              className="min-h-9 cursor-pointer rounded-peca px-2 text-[12px] font-medium text-marca hover:text-marca-forte"
            >
              {verSenha ? 'ocultar' : 'mostrar'}
            </button>
          </div>
        </div>

        {/* O erro nunca diz se o e-mail existe — dizer é entregar uma lista de
            quem trabalha no estúdio para quem só tem um formulário. */}
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
          {pendente ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>

      {/* O protótipo oferece "esqueci a senha" e "receber link por e-mail". Os
          dois dependem de SMTP, que é marco 2. Enquanto não existe, o caminho
          honesto é dizer quem redefine — e não um link que não vai chegar. */}
      <p className="pt-4 text-center text-[12.5px] leading-[1.5] text-tinta-fraca">
        Esqueceu a senha? Quem convidou você redefine — o estúdio, em
        Configuração&nbsp;→&nbsp;Usuários; a 4YU, para quem é dono da conta.
      </p>
    </PainelAcesso>
  )
}
