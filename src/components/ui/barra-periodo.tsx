import Link from 'next/link'
import { CampoData } from '@/components/ui/campo-data'
import { ATALHOS, atalhoDe, periodoPorExtenso, type Periodo } from '@/core/financeiro/periodo'

/**
 * A barra que recorta uma lista por data.
 *
 * Existe porque a pergunta "e os do dia 19 de janeiro?" não tinha resposta em
 * tela nenhuma: com trezentas linhas a busca por nome resolve, com trezentas
 * mil ela não resolve nada. Os atalhos cobrem o que se pergunta todo dia, e os
 * dois campos cobrem o resto.
 *
 * **Três atalhos, não sete** (06/out/2026): Hoje, Ontem, 7 e 30 dias eram
 * perguntas de caixa que ninguém fazia aqui; o mês, o mês passado e o ano são
 * as que fecham conta. As datas exatas ficam atrás de "Escolher datas", que
 * abre sozinho quando o período não é um dos atalhos.
 *
 * **Nasce sem filtro, e isso é decisão.** Uma lista de cobranças que abre
 * filtrada por "este mês" esconde quem deve desde junho, que é exatamente a
 * pessoa para quem se liga hoje. O período é uma pergunta que alguém faz, e não
 * um estado em que a tela nasce.
 *
 * É um formulário `GET` e não JavaScript: recarrega a página com a URL nova, o
 * que faz o filtro sobreviver ao compartilhar o endereço e ao voltar do
 * navegador. Filtro que some ao apertar "voltar" é filtro que a pessoa digita
 * duas vezes.
 */
/** os atalhos que a barra mostra, dos que `core/financeiro/periodo` conhece */
const USADOS = ['mes', 'mes-passado', 'ano']

export function BarraDePeriodo({
  base, periodo, hoje, rotulo, escondidos = {}, abrirDatas = false, menu = false,
}: {
  /** o caminho da tela, sem busca: `/financeiro` */
  base: string
  periodo: Periodo | null
  hoje: string
  /** que data está sendo recortada, dito com todas as letras */
  rotulo: string
  /** o que precisa sobreviver ao filtro: aba, busca, e o que mais houver */
  escondidos?: Record<string, string | undefined>
  /** `?datas=1`: quem tocou em "Escolher datas" e ainda não filtrou */
  abrirDatas?: boolean
  /**
   * Recolhida num botão "Vencimento: Este mês": numa barra de filtros, os
   * chips de data competiam com os de situação. Sem JavaScript: é um
   * `<details>`, e cada opção continua sendo um link.
   */
  menu?: boolean
}) {
  const ligado = atalhoDe(periodo, hoje)
  const dito = periodoPorExtenso(periodo)

  const comParametros = (extra: Record<string, string>) => {
    const b = new URLSearchParams()
    for (const [k, v] of Object.entries(escondidos)) if (v) b.set(k, v)
    for (const [k, v] of Object.entries(extra)) if (v) b.set(k, v)
    return `${base}?${b}`
  }

  const chip = (ativo: boolean) =>
    `inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-[14.5px] ${
      ativo
        ? 'border-escuro bg-escuro font-medium text-tinta-clara'
        : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
    }`
  const personalizado = periodo !== null && !USADOS.includes(ligado ?? '')

  const conteudo = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[12px] font-semibold text-tinta-fraca">
        {rotulo}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={comParametros({})} className={chip(periodo === null && !abrirDatas)}>
          Todas as datas
        </Link>
        {ATALHOS.filter((a) => USADOS.includes(a.id)).map((a) => {
          const j = a.janela(hoje)
          return (
            <Link
              key={a.id}
              href={comParametros({ de: j.de, ate: j.ate })}
              className={chip(ligado === a.id)}
            >
              {a.rotulo}
            </Link>
          )
        })}

        {/* as datas exatas abrem numa linha própria, sem JavaScript: o chip é
            um link que liga `datas=1`, e o período fora dos atalhos já chega
            com elas abertas */}
        <Link
          href={abrirDatas ? comParametros({}) : comParametros({ datas: '1' })}
          className={chip(personalizado || abrirDatas)}
        >
          {personalizado ? dito : 'Escolher datas'}
        </Link>
      </div>

      {personalizado || abrirDatas ? (
        // `CampoData` e não o `<input type="date">` nativo, que escreve a data
        // na ordem do navegador. A `key` é o período: o campo guarda estado, e
        // o atalho navega sem remontar a página
        <form
          key={`${periodo?.de ?? ''}:${periodo?.ate ?? ''}`}
          method="get" action={base}
          className="flex w-full flex-wrap items-center gap-1.5"
        >
          {Object.entries(escondidos).map(([k, v]) =>
            v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
          <CampoData nome="de" valorInicial={periodo?.de ?? ''} />
          <span aria-hidden className="text-[13.5px] text-tinta-fraca">a</span>
          <CampoData nome="ate" valorInicial={periodo?.ate ?? ''} />
          <button
            type="submit"
            className="min-h-9 cursor-pointer rounded-peca border border-linha-suave bg-superficie px-3 text-[13.5px] text-tinta-media hover:bg-superficie-mais-suave"
          >
            Filtrar
          </button>
        </form>
      ) : null}
    </div>
  )

  if (!menu) return conteudo

  const resumo = periodo === null
    ? 'Todas as datas'
    : ATALHOS.find((a) => a.id === ligado)?.rotulo ?? dito
  return (
    <details className="group relative" open={abrirDatas || undefined}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-media border border-linha bg-superficie px-3.5 text-[13.5px] whitespace-nowrap hover:bg-superficie-mais-suave [&::-webkit-details-marker]:hidden">
        <span className="text-tinta-media">{rotulo}:</span>
        <span className="font-medium">{resumo}</span>
        <span aria-hidden className="text-tinta-fraca transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute right-0 z-30 mt-1.5 w-[min(92vw,560px)] rounded-grande border border-linha-suave bg-superficie p-3 shadow-elevado">
        {conteudo}
      </div>
    </details>
  )
}
