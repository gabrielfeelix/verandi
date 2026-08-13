import { cartao, Esqueleto } from './pecas'

/**
 * O esqueleto de carregamento de cada tela, transcrito do `skel()` do protótipo.
 *
 * Não existe um esqueleto genérico: cada tela monta o **seu**, com a forma do
 * conteúdo que vai chegar. É a diferença entre a página parecer que já está
 * quase lá e um giro no meio da tela dizendo "espera" — o segundo não informa
 * nada, e faz o carregamento parecer mais longo do que é.
 *
 * As larguras alternam de linha para linha porque esqueleto com todas as barras
 * do mesmo tamanho lê como tabela, não como texto que ainda vai chegar.
 */
const L1 = [200, 168, 224, 186, 210, 176]
const L2 = [140, 176, 120, 158, 132, 150]

const linhas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    a: `${L1[i % L1.length]}px`,
    b: `${L2[i % L2.length]}px`,
  }))

export type Bloco =
  /** a fileira de números do topo (aulas hoje, pendentes, presenças…) */
  | { tipo: 'cards'; quantos?: number }
  /** o painel escuro da próxima turma */
  | { tipo: 'destaque' }
  /** lista ou tabela com cabeçalho */
  | { tipo: 'tabela'; itens?: number }
  /** a grade de sete dias */
  | { tipo: 'grade' }
  /** o cabeçalho da ficha de uma pessoa, com avatar e abas */
  | { tipo: 'ficha' }
  /** conteúdo principal com painel de apoio à direita */
  | { tipo: 'painel'; itens?: number }
  /**
   * navegação estreita à esquerda e conteúdo à direita — Configuração e Vaga.
   *
   * Existe separado do `painel` porque o lado importa: um esqueleto que põe a
   * coluna estreita à direita e a tela a traz à esquerda faz o conteúdo saltar
   * de lado quando o dado chega.
   */
  | { tipo: 'lateral'; itens?: number }

export function EsqueletoTela({
  tituloLargura = '230px',
  blocos,
}: {
  tituloLargura?: string
  blocos: Bloco[]
}) {
  return (
    <div
      /*
       * `aria-busy` e o rótulo para quem usa leitor de tela: sem isso a tela
       * fica muda no carregamento, porque um esqueleto é feito só de caixas sem
       * texto nenhum.
       */
      role="status"
      aria-busy="true"
      aria-label="Carregando"
      className="flex flex-col gap-[18px]"
      style={{ animation: 'vd-aparece .12s ease both' }}
    >
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2.5">
          <Esqueleto largura={tituloLargura} altura={30} raio={11} />
          <Esqueleto largura="320px" altura={13} />
        </div>
        <div className="flex gap-2">
          <Esqueleto largura="118px" altura={38} raio={12} />
          <Esqueleto largura="96px" altura={38} raio={12} />
        </div>
      </header>

      {blocos.map((b, i) => (
        <div key={i}>{desenhar(b)}</div>
      ))}
    </div>
  )
}

function desenhar(b: Bloco) {
  switch (b.tipo) {
    case 'cards':
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {linhas(b.quantos ?? 4).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-grande border border-linha-suave bg-superficie px-4 py-4"
            >
              <Esqueleto largura="74%" altura={11} />
              <Esqueleto largura="52px" altura={26} raio={8} />
            </div>
          ))}
        </div>
      )

    case 'destaque':
      return (
        <div className="flex flex-wrap items-start justify-between gap-6 rounded-cartao bg-escuro px-6 py-[22px] opacity-90">
          <div className="flex flex-wrap gap-[22px]">
            <div className="flex flex-col gap-2.5">
              <Esqueleto largura="88px" altura={11} opacidade={0.35} />
              <Esqueleto largura="120px" altura={34} raio={11} opacidade={0.35} />
              <Esqueleto largura="96px" altura={11} opacidade={0.35} />
            </div>
            <div className="flex flex-col gap-[11px]">
              <Esqueleto largura="190px" altura={20} opacidade={0.35} />
              <Esqueleto largura="230px" altura={12} opacidade={0.35} />
              <div className="flex gap-[7px]">
                <Esqueleto largura="132px" altura={34} raio={999} opacidade={0.35} />
                <Esqueleto largura="118px" altura={34} raio={999} opacidade={0.35} />
              </div>
            </div>
          </div>
          <div className="flex w-[206px] flex-col gap-2.5">
            <Esqueleto altura={44} raio={12} opacidade={0.5} />
            <Esqueleto altura={38} raio={12} opacidade={0.25} />
          </div>
        </div>
      )

    case 'tabela':
      return (
        <div className="overflow-hidden rounded-cartao border border-linha-suave bg-superficie">
          <div className="flex items-center justify-between gap-4 border-b border-linha-fina px-[18px] py-[15px]">
            <Esqueleto largura="150px" altura={15} />
            <Esqueleto largura="180px" altura={11} />
          </div>
          {linhas(b.itens ?? 6).map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 border-b border-linha-fina px-[18px] py-3.5"
            >
              <Esqueleto largura="44px" altura={15} />
              <Esqueleto largura="3px" altura={30} raio={2} />
              <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <Esqueleto largura={l.a} altura={13} />
                <Esqueleto largura={l.b} altura={11} />
              </div>
              <Esqueleto largura="82px" altura={26} raio={999} />
              <Esqueleto largura="54px" altura={22} raio={8} />
              <Esqueleto largura="88px" altura={24} raio={9} />
            </div>
          ))}
        </div>
      )

    case 'grade':
      return (
        <div className="rounded-cartao border border-linha-suave bg-superficie p-3.5">
          <div className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] gap-1.5">
            <span />
            {Array.from({ length: 7 }, (_, c) => (
              <div key={c} className="flex flex-col items-center gap-1.5 pt-2 pb-2.5">
                <Esqueleto largura="28px" altura={9} />
                <Esqueleto largura="20px" altura={14} />
              </div>
            ))}
            {Array.from({ length: 8 }, (_, r) => (
              <div key={r} className="contents">
                <div className="flex justify-end pt-1.5 pr-2">
                  <Esqueleto largura="34px" altura={11} />
                </div>
                {Array.from({ length: 7 }, (_, c) => (
                  // a célula clara de três em três imita o buraco real da grade:
                  // ninguém tem a semana toda cheia
                  <Esqueleto
                    key={c}
                    altura={56}
                    raio={12}
                    opacidade={(r + c) % 3 === 0 ? 0.35 : 1}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )

    case 'ficha':
      return (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-start gap-[18px] rounded-cartao border border-linha-suave bg-superficie px-[22px] py-5">
            <Esqueleto largura={64} altura={64} raio={999} />
            <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
              <Esqueleto largura="210px" altura={22} />
              <div className="flex flex-wrap gap-[22px]">
                <Esqueleto largura="120px" altura={32} />
                <Esqueleto largura="150px" altura={32} />
                <Esqueleto largura="90px" altura={32} />
              </div>
            </div>
            <Esqueleto largura="200px" altura={44} raio={12} />
          </div>
          <div className="flex gap-1.5">
            <Esqueleto largura="104px" altura={38} raio={12} />
            <Esqueleto largura="118px" altura={38} raio={12} opacidade={0.6} />
            <Esqueleto largura="120px" altura={38} raio={12} opacidade={0.6} />
            <Esqueleto largura="86px" altura={38} raio={12} opacidade={0.6} />
          </div>
        </div>
      )

    case 'painel':
      return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-3">
            {linhas(b.itens ?? 3).map((l, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-cartao border border-linha-suave bg-superficie px-[18px] py-4"
              >
                <Esqueleto largura={l.a} altura={15} />
                <Esqueleto altura={44} raio={12} />
                <Esqueleto largura="76%" altura={12} />
              </div>
            ))}
          </div>
          <div className="hidden flex-col gap-3 lg:flex">
            <div className="flex flex-col gap-3 rounded-cartao border border-linha-suave bg-superficie px-[18px] py-4">
              <Esqueleto largura="120px" altura={15} />
              <Esqueleto altura={11} />
              <Esqueleto largura="80%" altura={11} />
              <Esqueleto largura="64%" altura={11} />
            </div>
          </div>
        </div>
      )

    case 'lateral':
      return (
        <div className="grid items-start gap-4 lg:grid-cols-[268px_minmax(0,1fr)]">
          <div className={`hidden flex-col gap-1 ${cartao} p-2 lg:flex`}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Esqueleto largura={18} altura={18} raio={5} />
                <Esqueleto largura={`${[92, 74, 68, 84, 110, 128, 88][i]}px`} altura={12} />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {linhas(b.itens ?? 3).map((l, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-cartao border border-linha-suave bg-superficie px-[18px] py-4"
              >
                <Esqueleto largura={l.a} altura={15} />
                <Esqueleto altura={44} raio={12} />
                <Esqueleto largura="76%" altura={12} />
              </div>
            ))}
          </div>
        </div>
      )
  }
}
