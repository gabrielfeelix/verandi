import Link from 'next/link'
import type { SessaoResumo } from '@/server/agenda/consultas'
import { AvatarProf } from '@/components/hoje/pecas'
import { cartao } from '@/components/ui/pecas'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function diaDe(dataIso: string) {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay()
}

/**
 * A substituta da planilha. Aguenta 70 horários numa semana porque a linha é o
 * horário, não o bloco desenhado — acrescentar horário é acrescentar linha.
 *
 * É uma grade CSS, não `<table>`: cada célula pode ter duas turmas paralelas
 * empilhadas, e tabela com célula composta vira leitura confusa em leitor de
 * tela. O cabeçalho de dia e a coluna de hora carregam a semântica.
 *
 * Em celular sete colunas não cabem; a folha vira um dia por vez. Não é
 * degradação, é a forma correta no tamanho pequeno.
 */
export function GradeSemana({
  sessoes, dias, feriados, hoje,
}: {
  sessoes: SessaoResumo[]
  dias: string[]
  feriados: Record<string, string>
  hoje: string
}) {
  const horas = [...new Set(sessoes.map((s) => s.hora))].sort()

  const porCelula = new Map<string, SessaoResumo[]>()
  for (const s of sessoes) {
    const k = `${s.data}|${s.hora}`
    porCelula.set(k, [...(porCelula.get(k) ?? []), s])
  }

  if (horas.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2.5 rounded-cartao border border-dashed border-linha-tracejada bg-superficie px-6 py-8.5 text-center">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-media bg-superficie-mais-suave font-mono text-[17px] text-tinta-media"
        >
          ▦
        </span>
        <span className="font-titulo text-[18px] font-semibold">
          Nenhum horário nesta semana
        </span>
        <span className="max-w-[380px] text-[13px] leading-relaxed text-tinta-media">
          Conta nova começa assim. A grade nasce em Grade fixa — é lá que se diz
          o que se repete toda semana. Não é falha de carregamento.
        </span>
        <Link
          href="/grade"
          className="mt-1.5 rounded-padrao bg-escuro px-4 py-2.5 text-[13px] font-medium text-tinta-clara"
        >
          Montar a grade fixa
        </Link>
      </section>
    )
  }

  return (
    <section
      aria-label="Grade da semana"
      className={`max-h-[calc(100vh-210px)] overflow-auto ${cartao} p-3.5`}
    >
      <div className="grid min-w-[920px] grid-cols-[58px_repeat(7,minmax(0,1fr))] gap-1.5">
        <div className="sticky top-0 z-3 bg-superficie" />

        {dias.map((d) => {
          const feriado = feriados[d]
          const ehHoje = d === hoje
          return (
            <div
              key={d}
              className={`sticky top-0 z-3 flex flex-col items-center gap-0.5 rounded-peca px-1 pt-1.5 pb-2.5 shadow-[0_6px_0_#fff] ${
                feriado ? 'bg-atencao-fundo' : ehHoje ? 'bg-[#EAF4F0]' : 'bg-superficie'
              }`}
            >
              <span
                className={`text-[11px] font-semibold tracking-[.08em] uppercase ${
                  feriado ? 'text-atencao' : ehHoje ? 'text-marca' : 'text-tinta-media'
                }`}
              >
                {DIAS[diaDe(d)]}
              </span>
              <span
                className={`font-mono text-[15px] ${ehHoje ? 'text-marca' : 'text-tinta'}`}
              >
                {d.slice(8)}
              </span>
              <span className="truncate text-[10px] text-tinta-media">
                {feriado ?? (ehHoje ? 'hoje' : '')}
              </span>
            </div>
          )
        })}

        {horas.map((hora) => (
          <div key={hora} className="contents">
            <div className="flex items-start justify-end pt-1.5 pr-2">
              <span className="font-mono text-[12px] text-tinta-media">{hora}</span>
            </div>

            {dias.map((d) => {
              const celula = porCelula.get(`${d}|${hora}`) ?? []
              // duas cabem lado a lado; a partir da terceira o "+N" evita que a
              // linha estique e quebre a leitura da semana inteira
              const visiveis = celula.slice(0, 2)
              const sobra = celula.length - visiveis.length

              if (celula.length === 0) {
                return (
                  <div
                    key={d}
                    className="flex min-h-14 items-center justify-center rounded-padrao border border-linha-fina bg-superficie-tenue font-mono text-[13px] text-linha-tracejada"
                  >
                    <span aria-hidden>+</span>
                  </div>
                )
              }

              return (
                <div
                  key={d}
                  className="flex min-h-14 flex-col gap-1.5 rounded-padrao border border-linha-suave bg-superficie p-1"
                >
                  {visiveis.map((s) => (
                    <CelulaTurma key={s.id} sessao={s} />
                  ))}
                  {sobra > 0 ? (
                    <Link
                      href={`/semana?de=${dias[0]}&dia=${d}`}
                      className="self-start rounded-minima bg-neutro-fundo px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.06em] text-tinta-media uppercase"
                    >
                      +{sobra} no mesmo horário
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Uma turma dentro da célula: quem atende, o que é, e como está a ocupação. */
export function CelulaTurma({ sessao }: { sessao: SessaoResumo }) {
  const cancelada = sessao.status === 'cancelada'
  return (
    <Link
      href={`/sessao/${sessao.id}`}
      data-cheio={sessao.ocupacao.lotada ? 'sim' : undefined}
      data-cancelada={cancelada ? 'sim' : undefined}
      className={`flex flex-col gap-0.5 rounded-peca border px-1.5 py-1 transition-[background-color,border-color,transform] duration-100 hover:-translate-y-px ${
        cancelada
          ? 'border-linha-suave bg-superficie-mais-suave'
          : sessao.ocupacao.excedida
            ? 'border-alerta-linha bg-alerta-superficie'
            : 'border-linha-suave bg-superficie-suave hover:border-linha-tracejada hover:bg-superficie'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {sessao.profissional ? (
          <AvatarProf
            nome={sessao.profissional}
            cor={sessao.corProfissional}
            tamanho={18}
          />
        ) : null}
        <span
          className={`truncate text-[12px] font-medium ${
            cancelada ? 'text-tinta-media line-through' : ''
          }`}
        >
          {sessao.servico}
        </span>
      </span>
      <span className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[10.5px] text-tinta-media">
          {sessao.profissional ?? sessao.local ?? ''}
        </span>
        <span
          className={`rounded-minima px-1.5 py-0.5 font-mono text-[10.5px] ${
            sessao.ocupacao.excedida
              ? 'bg-alerta-fundo text-alerta'
              : 'bg-superficie-mais-suave text-tinta-media'
          }`}
        >
          {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
        </span>
      </span>
    </Link>
  )
}
