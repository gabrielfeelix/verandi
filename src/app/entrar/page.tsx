'use client'

import { useActionState, useState } from 'react'
import { PainelAcesso } from '@/components/ui/painel-acesso'
import { Botao } from '@/components/ui/botao'
import { Rotulo } from '@/components/ui/pecas'
import { entrar, type EstadoEntrar } from './acoes'

export default function Entrar() {
  const [estado, acao, pendente] = useActionState<EstadoEntrar, FormData>(entrar, null)
  const [verSenha, setVerSenha] = useState(false)

  return (
    <PainelAcesso
      titulo="A agenda inteira em uma tela só."
      texto="Chamada em dois toques, reposição sem planilha e a semana inteira visível de uma vez."
    >
      <h1 className="font-titulo text-[27px] font-semibold tracking-[-.02em]">
        Que bom te ver
      </h1>
      <p className="pt-2 pb-6 text-[13.5px] leading-relaxed text-tinta-media">
        Entre com o e-mail que recebeu o convite.
      </p>

      <form action={acao} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email">
            <Rotulo>E-mail</Rotulo>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="min-h-12 rounded-[13px] border border-linha-suave bg-superficie-suave px-4 text-[14px] focus:border-marca focus:bg-superficie"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha">
            <Rotulo>Senha</Rotulo>
          </label>
          <div className="flex items-center rounded-[13px] border border-linha-suave bg-superficie-suave pr-2 focus-within:border-marca focus-within:bg-superficie">
            <input
              id="senha" name="senha" required autoComplete="current-password"
              type={verSenha ? 'text' : 'password'}
              className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-[14px] outline-none"
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              className="min-h-9 rounded-[--radius-peca] px-2 text-[12px] font-medium text-marca"
            >
              {verSenha ? 'ocultar' : 'mostrar'}
            </button>
          </div>
        </div>

        {/* O erro nunca diz se o e-mail existe — dizer é entregar uma lista de
            quem trabalha no estúdio para quem só tem um formulário. */}
        {estado?.erro ? (
          <p className="flex items-center gap-2.5 rounded-[12px] border border-[#F7DACB] bg-[#FFF6F1] px-3 py-2.5 text-[12.5px] text-[#8A4526]">
            <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-alerta" />
            {estado.erro}
          </p>
        ) : null}

        <Botao
          type="submit"
          disabled={pendente}
          className="mt-2 min-h-13 w-full rounded-[14px] text-[14.5px] font-semibold"
        >
          {pendente ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>

      {/* O protótipo oferece "esqueci a senha" e "receber link por e-mail". Os
          dois dependem de SMTP, que é marco 2. Enquanto não existe, o caminho
          honesto é dizer quem redefine — e não um link que não vai chegar. */}
      <p className="pt-5 text-center text-[12.5px] leading-relaxed text-tinta-media">
        Esqueceu a senha? Quem convidou você redefine para você — o estúdio, em
        Configuração → Usuários; a 4YU, para quem é dono da conta.
      </p>
    </PainelAcesso>
  )
}
