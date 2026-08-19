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
export function BarraDePeriodo({
  base, periodo, hoje, rotulo, escondidos = {},
}: {
  /** o caminho da tela, sem busca: `/financeiro` */
  base: string
  periodo: Periodo | null
  hoje: string
  /** que data está sendo recortada, dito com todas as letras */
  rotulo: string
  /** o que precisa sobreviver ao filtro: aba, busca, e o que mais houver */
  escondidos?: Record<string, string | undefined>
}) {
  const ligado = atalhoDe(periodo, hoje)
  const dito = periodoPorExtenso(periodo)

  const comParametros = (extra: Record<string, string>) => {
    const b = new URLSearchParams()
    for (const [k, v] of Object.entries(escondidos)) if (v) b.set(k, v)
    for (const [k, v] of Object.entries(extra)) if (v) b.set(k, v)
    return `${base}?${b}`
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
        {rotulo}
      </span>

      <div className="flex flex-wrap gap-1.5">
        {ATALHOS.map((a) => {
          const j = a.janela(hoje)
          return (
            <Link
              key={a.id}
              href={comParametros({ de: j.de, ate: j.ate })}
              className={`inline-flex min-h-9 items-center rounded-peca border px-2.5 text-[13.5px] ${
                ligado === a.id
                  ? 'border-marca bg-positivo-superficie text-marca'
                  : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
              }`}
            >
              {a.rotulo}
            </Link>
          )
        })}
      </div>

      {/*
        * Os dois campos, para o dia exato que nenhum atalho cobre.
        *
        * `CampoData` e não `<input type="date">`: o nativo escreve a data na
        * ordem da configuração do navegador, e um estúdio no Brasil com o
        * navegador em inglês veria `mm/dd/yyyy` num sistema em português. É o
        * mesmo componente que a agenda usa, e ele já entrega o `aaaa-mm-dd` num
        * campo escondido, que é o que a URL precisa.
        */}
      <form method="get" action={base} className="flex flex-wrap items-center gap-1.5">
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

      {periodo ? (
        <>
          <span className="text-[13px] text-tinta-media">{dito}</span>
          <Link
            href={comParametros({})}
            className="text-[13.5px] text-tinta-media underline"
          >
            limpar
          </Link>
        </>
      ) : (
        <span className="text-[13px] text-tinta-fraca">sem recorte de data</span>
      )}
    </div>
  )
}
