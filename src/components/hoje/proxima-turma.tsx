'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { SessaoResumo } from '@/server/agenda/consultas'
import { marcarTodosPresentes } from '@/server/agenda/acoes'
import { useAviso } from '@/components/ui/desfazer'
import { paresDe, primeiroNome, iniciaisDe } from './pecas'

/**
 * A próxima turma, em destaque.
 *
 * Registrar a chamada de uma turma de quatro tem que caber em um toque mais as
 * exceções — por isso "Marcar todos presentes" é o botão maior da tela, e não
 * um item de menu dentro da sessão.
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
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()
  const router = useRouter()

  const aMarcar = sessao.pessoas.filter(
    (p) => p.status === 'esperada' || p.status === 'confirmada',
  ).length

  return (
    <article className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#12211C_0%,#173029_100%)] px-6 py-5.5 text-tinta-clara shadow-[0_14px_30px_-20px_rgba(18,33,28,.6)]">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(42,195,163,.22),transparent_70%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6.5 gap-y-4.5">
        <div className="flex min-w-0 flex-[1_1_330px] gap-5.5">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[.1em] text-menta uppercase">
              <span aria-hidden className="size-[7px] rounded-full bg-menta" />
              Próxima {rotulo.toLowerCase()}
            </span>
            <span className="font-titulo text-[40px] leading-none font-semibold tracking-[-.03em]">
              {sessao.hora}
            </span>
            <span className="text-[12.5px] text-[#9FB5AE]">{faltam}</span>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-titulo text-[23px] leading-tight font-semibold">
                {sessao.servico}
              </h2>
              <span className="rounded-[8px] bg-tinta-clara/12 px-2.5 py-[3px] font-mono text-[12px] text-[#CDE3DD]">
                {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[13px] text-[#B7CBC5]">
              {sessao.profissional ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-full bg-[#22463C] text-[9.5px] font-semibold text-menta shadow-[inset_0_0_0_1.5px_#2AC3A3]"
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
                      className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ background: fundo, color: frente }}
                    >
                      {iniciaisDe(p.nome)}
                    </span>
                    <span className="text-[13px] text-tinta-clara">
                      {primeiroNome(p.nome)}
                    </span>
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-[5px] bg-[rgba(240,105,60,.18)] px-1.5 py-[2px] text-[9.5px] font-semibold tracking-[.08em] text-[#F5A88A] uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )
              })}
              {sessao.pessoas.length === 0 ? (
                <span className="text-[12.5px] text-[#9FB5AE]">
                  Ninguém marcado nesta {rotulo.toLowerCase()} ainda.
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-[206px] flex-[1_1_206px] flex-col gap-2.5">
          {podeRegistrar ? (
            <button
              type="button"
              disabled={pendente || aMarcar === 0}
              onClick={() =>
                iniciar(async () => {
                  const { marcadas } = await marcarTodosPresentes(sessao.id)
                  avisar({ texto: `${marcadas} marcada(s) como presente.` })
                  router.refresh()
                })
              }
              className="min-h-11 rounded-[12px] bg-menta px-4 text-[14px] font-semibold text-[#08201A] transition-[background-color,transform] duration-150 hover:bg-[#38D6B4] active:translate-y-px disabled:opacity-60"
            >
              {aMarcar === 0 ? 'Chamada feita' : 'Marcar todos presentes'}
            </button>
          ) : null}

          <Link
            href={`/sessao/${sessao.id}`}
            className="flex min-h-11 items-center justify-center rounded-[12px] border border-tinta-clara/22 px-4 text-[13px] hover:bg-tinta-clara/10"
          >
            Abrir {rotulo.toLowerCase()}
          </Link>

          <Link
            href={`/sessao/${sessao.id}#encaixar`}
            className="text-center text-[12px] text-[#9FB5AE] hover:text-tinta-clara"
          >
            Encaixar {rotuloPessoa.toLowerCase()}
          </Link>
        </div>
      </div>
    </article>
  )
}
