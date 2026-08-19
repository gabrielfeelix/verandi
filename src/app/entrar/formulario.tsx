'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { PainelAcesso } from '@/components/ui/painel-acesso'
import { Botao } from '@/components/ui/botao'
import { Rotulo, entrada } from '@/components/ui/pecas'
import { entrar, type EstadoEntrar } from './acoes'

/**
 * O formulário de entrada.
 *
 * Vive separado da rota porque `emailInicial` vem da barra de endereço, e ler
 * `searchParams` é coisa de componente de servidor. A tela em si continua toda
 * do cliente: o estado do botão, o mostrar/ocultar da senha e o erro.
 */
export function FormularioDeEntrada({ emailInicial }: { emailInicial?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoEntrar, FormData>(entrar, null)
  const [verSenha, setVerSenha] = useState(false)

  /*
   * O `pendente` do `useActionState` volta a `false` quando a ação termina, e a
   * navegação só começa depois disso: o botão voltava a "Entrar" com a tela
   * ainda parada, e quem está esperando clica de novo. Este estado só é desfeito
   * quando a ação volta com erro; no caminho feliz ele fica ligado até a próxima
   * tela pintar.
   */
  const [enviando, setEnviando] = useState(false)
  const [ultimaResposta, setUltimaResposta] = useState(estado)
  /*
   * Ajuste durante o render, e não num efeito: cada volta da ação devolve um
   * objeto novo, então basta comparar a identidade para saber que ela respondeu
   * (o que só acontece quando deu erro, porque o sucesso redireciona).
   */
  if (estado !== ultimaResposta) {
    setUltimaResposta(estado)
    setEnviando(false)
  }
  const carregando = pendente || enviando

  return (
    <PainelAcesso tela="entrar">
      <h1 className="font-titulo text-[27px] font-semibold tracking-[-.02em]">
        Que bom te ver
      </h1>
      <p className="pt-2 pb-6 text-[13.5px] leading-relaxed text-tinta-media">
        Entre com o e-mail que recebeu o convite do estúdio.
      </p>

      <form
        action={acao}
        onSubmit={() => setEnviando(true)}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email">
            <Rotulo>E-mail</Rotulo>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            defaultValue={emailInicial}
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
              /* quem acabou de criar a senha chega com o e-mail preenchido: o
                 cursor tem que estar no único campo que falta */
              autoFocus={Boolean(emailInicial)}
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
          disabled={carregando}
          className="mt-2 min-h-13 w-full rounded-media text-[14.5px] font-semibold"
        >
          {carregando ? 'Entrando…' : 'Entrar'}
        </Botao>

        {/* Junto do botão, e não no rodapé: aceite só vale se a pessoa teve como
            ler o que aceitou, e link escondido no pé da página é a versão fraca
            disso. O registro de quem aceitou o quê fica em `aceite_de_termos`. */}
        <p className="pt-1 text-center text-[11.5px] leading-[1.6] text-tinta-fraca">
          Ao entrar, você concorda com os{' '}
          <Link href="/termos" className="text-marca hover:text-marca-forte">
            Termos de uso
          </Link>{' '}
          e com a{' '}
          <Link href="/privacidade" className="text-marca hover:text-marca-forte">
            Política de privacidade
          </Link>
          .
        </p>
      </form>

      {/* O link por e-mail passou a existir, mas o caminho pela pessoa continua
          e não é redundância: domínio de envio novo cai em spam, e quem opera um
          estúdio resolve pelo WhatsApp em dez segundos. */}
      <p className="pt-4 text-center text-[12.5px] leading-[1.5] text-tinta-fraca">
        <Link href="/esqueci" className="font-medium text-marca hover:text-marca-forte">
          Esqueci a senha
        </Link>
        <br />
        Quem convidou você também consegue gerar o link na hora, em
        Configuração,&nbsp;Usuários.
      </p>
    </PainelAcesso>
  )
}
