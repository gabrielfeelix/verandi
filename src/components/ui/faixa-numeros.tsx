import Link from 'next/link'

export type NumeroDaFaixa = {
  rotulo: string
  valor: string
  /** a linha pequena embaixo: o que o número quer dizer */
  nota?: string
  tom?: 'neutro' | 'alerta' | 'positivo' | 'atencao'
  /** quando o número leva a algum lugar */
  href?: string
}

const TINTA: Record<string, string> = {
  neutro: 'text-tinta',
  alerta: 'text-alerta',
  positivo: 'text-positivo',
  atencao: 'text-atencao',
}

/**
 * A faixa de números que fica em cima de uma lista de dinheiro.
 *
 * A tela dizia "10 cobranças em atraso" e não dizia quanto. Dez linhas de R$ 90
 * e dez linhas de R$ 700 são a mesma frase e duas manhãs diferentes, e quem
 * abre o Financeiro está decidindo o que fazer com a manhã.
 *
 * Os números somam o **recorte inteiro**, e não a página: um total que muda ao
 * virar a página é pior que total nenhum, porque quem confere caixa com ele
 * perde a tarde procurando a diferença.
 */
export function FaixaDeNumeros({
  itens, aviso,
}: {
  itens: NumeroDaFaixa[]
  /** dito quando a soma não cobriu tudo, em vez de sair parcial em silêncio */
  aviso?: string | null
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        {itens.map((n) => {
          const corpo = (
            <>
              <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
                {n.rotulo}
              </span>
              <span
                className={`font-titulo text-[22px] leading-none font-semibold tabular-nums ${TINTA[n.tom ?? 'neutro']}`}
              >
                {n.valor}
              </span>
              {n.nota ? (
                <span className="text-[12.5px] leading-[1.4] text-tinta-media">
                  {n.nota}
                </span>
              ) : null}
            </>
          )
          const classe = 'flex flex-col gap-1.5 rounded-media border border-linha-suave bg-superficie px-3.5 py-3'
          return n.href ? (
            <Link key={n.rotulo} href={n.href} className={`${classe} hover:bg-superficie-mais-suave`}>
              {corpo}
            </Link>
          ) : (
            <div key={n.rotulo} className={classe}>{corpo}</div>
          )
        })}
      </div>
      {aviso ? (
        <p className="text-[12.5px] text-atencao">{aviso}</p>
      ) : null}
    </div>
  )
}
