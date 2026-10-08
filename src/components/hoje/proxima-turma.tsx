'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SessaoResumo } from '@/server/agenda/consultas'
import { paresDe, primeiroNome, iniciaisDe } from './pecas'
import { chamadaAbreEm } from '@/core/agenda/chamada'

/**
 * A próxima turma, em destaque.
 *
 * Registrar a chamada de uma turma de quatro tem que caber em um toque mais as
 * exceções (por isso "Marcar todos presentes" é o botão maior da tela, e não
 * um item de menu dentro da sessão).
 */
export function ProximaTurma({
  sessao, faltam, podeRegistrar, rotulo, rotuloPessoa,
}: {
  sessao: SessaoResumo
  /** como esta conta chama uma sessão: "turma", "horário", "atendimento" */
  rotulo: string
  rotuloPessoa: string
  /** "começa em 21:55", já formatado no servidor: o cliente não sabe o fuso da conta */
  faltam: string
  podeRegistrar: boolean
}) {

  // marcar em bloco só depois do começo, como na tela da chamada; o botão
  // libera sozinho na hora, sem recarregar
  // a chamada abre uma hora antes do começo (`CHAMADA_ABRE_ANTES_MS`)
  const [comecou, setComecou] = useState(() => chamadaAbreEm(sessao.inicio) <= Date.now())
  useEffect(() => {
    const falta = chamadaAbreEm(sessao.inicio) - Date.now()
    if (falta <= 0 || falta > 2 ** 31 - 1) return
    const t = setTimeout(() => setComecou(true), falta)
    return () => clearTimeout(t)
  }, [sessao.inicio])

  const aMarcar = sessao.pessoas.filter(
    (p) => p.status === 'esperada' || p.status === 'confirmada',
  ).length

  return (
    <article className="relative overflow-hidden rounded-cartao bg-[linear-gradient(180deg,#12211C_0%,#173029_100%)] px-6 py-5.5 text-tinta-clara shadow-[0_14px_30px_-20px_rgba(18,33,28,.6)]">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(42,195,163,.22),transparent_70%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6.5 gap-y-4.5">
        <div className="flex min-w-0 flex-[1_1_330px] flex-col gap-4 sm:flex-row sm:gap-5.5">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-menta">
              <span aria-hidden className="size-[7px] rounded-full bg-menta" />
              {/* "Próxima" concordaria com a palavra do cliente: "Próxima
                  atendimento". "A seguir" não tem gênero e diz o mesmo. */}
              {rotulo.charAt(0).toUpperCase() + rotulo.slice(1).toLowerCase()} a seguir
            </span>
            <span className="font-titulo text-[40px] leading-none font-semibold tracking-[-.03em]">
              {sessao.hora}
            </span>
            <span className="text-[13.5px] text-tinta-escura-media">{faltam}</span>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-titulo text-[23px] leading-tight font-semibold">
                {sessao.servico}
              </h2>
              <span className="rounded-peca bg-tinta-clara/12 px-2.5 py-[3px] text-[13.5px] text-[#CDE3DD]">
                {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[14.5px] text-[#B7CBC5]">
              {sessao.profissional ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-full bg-[#22463C] text-[8.5px] leading-none font-semibold tracking-[-.02em] text-menta shadow-[inset_0_0_0_1.5px_#2AC3A3]"
                  >
                    {iniciaisDe(sessao.profissional)}
                  </span>
                  {sessao.profissional}
                </span>
              ) : null}
              {sessao.local ? (
                <>
                  <span aria-hidden className="opacity-40">·</span>
                  <span>{sessao.local}</span>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {sessao.pessoas.map((p, i) => {
                const [fundo, frente] = paresDe(p.nome)
                return (
                  <span
                    key={`${p.nome}-${i}`}
                    className="flex items-center gap-2 rounded-full border border-tinta-clara/12 bg-tinta-clara/8 py-[5px] pr-3 pl-[5px]"
                  >
                    <span
                      aria-hidden
                      className="flex size-6 items-center justify-center rounded-full text-[9px] leading-none font-semibold tracking-[-.02em]"
                      style={{ background: fundo, color: frente }}
                    >
                      {iniciaisDe(p.nome)}
                    </span>
                    <span className="text-[14.5px] text-tinta-clara">
                      {primeiroNome(p.nome)}
                    </span>
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-minima bg-[rgba(240,105,60,.18)] px-1.5 py-[2px] text-[12px] font-semibold text-[#F5A88A]"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )
              })}
              {sessao.pessoas.length === 0 ? (
                <span className="text-[13.5px] text-tinta-escura-media">
                  Ninguém marcado ainda.
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-[206px] flex-[1_1_206px] flex-col gap-2.5">
          {/* a chamada se faz na tela da aula, onde dá para marcar quem não
              veio: concluir daqui dava presença a todos sem olhar a lista.
              Antes da hora, o botão abre a aula; "Chamada abre às 17:00" num
              botão parecia um botão desligado */}
          <Link
            href={`/sessao/${sessao.id}`}
            className="flex min-h-11 items-center justify-center rounded-padrao bg-menta px-4 text-[14.5px] font-semibold text-sobre-menta transition-[background-color,transform] duration-150 hover:bg-menta-hover active:translate-y-px"
          >
            {!podeRegistrar || !comecou
              ? `Abrir ${rotulo.toLowerCase()}`
              : aMarcar === 0 ? 'Ver chamada' : 'Fazer chamada'}
          </Link>

          <Link
            href={`/sessao/${sessao.id}#encaixar`}
            className="flex min-h-11 items-center justify-center rounded-padrao border border-tinta-clara/22 px-4 text-[14.5px] font-medium text-tinta-clara hover:bg-tinta-clara/10"
          >
            Encaixar {rotuloPessoa.toLowerCase()}
          </Link>
        </div>
      </div>
    </article>
  )
}
