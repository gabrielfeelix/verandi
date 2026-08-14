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
  sessoes, dias, feriados, hoje, fechados, agora, rotuloSessoes,
}: {
  sessoes: SessaoResumo[]
  dias: string[]
  feriados: Record<string, string>
  hoje: string
  /** dias da semana (0–6) em que a conta não abre */
  fechados: ReadonlySet<number>
  /** hora local da conta, "HH:MM", ou null quando a semana não é a de hoje */
  agora: string | null
  /** o rótulo da conta no plural: "aulas", "sessões", "atendimentos" */
  rotuloSessoes: string
}) {
  const horas = [...new Set(sessoes.map((s) => s.hora))].sort()

  const porCelula = new Map<string, SessaoResumo[]>()
  for (const s of sessoes) {
    const k = `${s.data}|${s.hora}`
    porCelula.set(k, [...(porCelula.get(k) ?? []), s])
  }

  const quantasNoDia = new Map<string, number>()
  for (const s of sessoes) {
    quantasNoDia.set(s.data, (quantasNoDia.get(s.data) ?? 0) + 1)
  }

  /*
   * A célula que está acontecendo agora.
   *
   * É a última hora que já começou no dia de hoje — não a mais próxima do
   * relógio. Às 09:40, a turma das 09:00 é a que está na sala; apontar para a
   * das 10:00 mandaria a recepção para a turma errada.
   */
  const horaAgora = agora
    ? horas.filter((h) => h <= agora).at(-1) ?? null
    : null

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
          Conta nova começa assim. A grade nasce em Grade fixa, é lá que se diz
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

        {/*
          * O cabeçalho do dia carrega três coisas: qual dia é, quanto tem, e se
          * a casa abre. "12 turmas" embaixo do número é o que responde "onde
          * está o buraco da semana?" sem contar cartão por cartão — e "fechado"
          * é a diferença entre um sábado vazio e um sábado que ninguém montou.
          */}
        {dias.map((d) => {
          const feriado = feriados[d]
          const ehHoje = d === hoje
          const fechado = fechados.has(diaDe(d))
          const quantas = quantasNoDia.get(d) ?? 0

          const nota = feriado
            ?? (ehHoje ? 'hoje' : fechado && quantas === 0 ? 'fechado' : '')

          return (
            <div
              key={d}
              className={`sticky top-0 z-3 flex flex-col items-center gap-0.5 rounded-peca px-1 pt-1.5 pb-2.5 shadow-[0_6px_0_#fff] ${
                ehHoje
                  ? 'bg-escuro'
                  : feriado
                    ? 'bg-atencao-fundo'
                    : fechado
                      ? 'bg-neutro-fundo'
                      : 'bg-superficie-suave'
              }`}
            >
              <span
                className={`text-[11px] font-semibold tracking-[.08em] uppercase ${
                  ehHoje
                    ? 'text-menta'
                    : feriado
                      ? 'text-atencao'
                      : fechado
                        ? 'text-tinta-fraca'
                        : 'text-tinta-media'
                }`}
              >
                {DIAS[diaDe(d)]}
              </span>
              <span
                className={`font-mono text-[15px] ${
                  ehHoje ? 'text-tinta-clara' : fechado ? 'text-tinta-fraca' : 'text-tinta'
                }`}
              >
                {d.slice(8)}
              </span>
              <span
                className={`truncate text-[10px] ${
                  ehHoje ? 'text-tinta-clara/70' : 'text-tinta-fraca'
                }`}
              >
                {nota || (quantas > 0 ? `${quantas} ${rotuloSessoes}` : '')}
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
              const ehAgora = d === hoje && hora === horaAgora

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

              /*
               * Duas turmas no mesmo horário não são erro: são dois
               * profissionais, ou duas salas. A etiqueta diz **qual dos dois**,
               * porque as consequências são diferentes — sala repetida no mesmo
               * horário é conflito, professor diferente não é.
               */
              const salas = new Set(celula.map((s) => s.local ?? 'sem registro'))
              const paralelo = celula.length < 2
                ? null
                : salas.size > 1
                  ? `${salas.size} salas`
                  : `${celula.length} ${rotuloSessoes}`

              return (
                <div
                  key={d}
                  className={`flex min-h-14 flex-col gap-1.5 rounded-padrao border p-1 ${
                    ehAgora
                      ? 'border-menta bg-superficie'
                      : 'border-linha-suave bg-superficie'
                  }`}
                >
                  {visiveis.map((s) => (
                    <CelulaTurma key={s.id} sessao={s} />
                  ))}

                  {paralelo || ehAgora ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {ehAgora ? (
                        <span className="rounded-minima bg-positivo-fundo px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.06em] text-marca uppercase">
                          agora
                        </span>
                      ) : null}
                      {paralelo ? (
                        <span className="rounded-minima bg-neutro-fundo px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.06em] text-tinta-media uppercase">
                          {paralelo}
                        </span>
                      ) : null}
                    </span>
                  ) : null}

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
