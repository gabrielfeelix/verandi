import type { ReactNode } from 'react'
import { ACESSO, type TelaAcesso } from './arte-acesso'
import { RodapeLegal } from './rodape-legal'

/** A arte de um painel: arquivo, descrição e a geometria dela na moldura. */
export type ArtePainel = {
  arquivo: string
  descricao: string
  largura: string
  topo: string
}

/**
 * O cartão duplo das telas de acesso: promessa do produto de um lado, o
 * formulário do outro.
 *
 * Quem chama diz só qual tela é — o título, o texto e a arte saem da tabela em
 * `arte-acesso.ts`. Título escrito à mão na página é como as três telas de
 * acesso começam a divergir uma da outra.
 */
export function PainelAcesso({
  tela,
  children,
}: {
  tela: TelaAcesso
  children: ReactNode
}) {
  const { titulo, texto, arte } = ACESSO[tela]
  return <CascaAcesso titulo={titulo} texto={texto} arte={arte}>{children}</CascaAcesso>
}

/**
 * A mesma casca, com o texto e a arte vindos de fora.
 *
 * Existe porque as boas-vindas do onboarding são a mesma composição, com o
 * conteúdo mudando a cada cartão: sem isto, ou o onboarding copiava cem linhas
 * de marcação, ou a tabela `arte-acesso.ts` viraria depósito de coisa que não é
 * tela de acesso.
 */
export function CascaAcesso({
  titulo, texto, arte, children,
}: {
  titulo: string
  texto: string
  arte: ArtePainel
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-4 md:p-7">
      {/*
       * A arte é o primeiro pixel do produto: ela tem de estar na tela junto com
       * o texto, não um segundo depois. O `preload` a põe na fila antes de o
       * React montar, e `media` evita baixar 40 KB para o celular, onde o painel
       * escuro nem aparece.
       */}
      <link
        rel="preload"
        as="image"
        href={arte.arquivo}
        fetchPriority="high"
        media="(min-width: 768px)"
      />

      <div className="grid w-full max-w-[1000px] gap-5 rounded-[26px] bg-superficie p-4 shadow-acesso md:grid-cols-2 md:p-5">
        <section className="ruido-escuro hidden min-h-[556px] flex-col justify-between overflow-hidden rounded-cartao bg-[linear-gradient(165deg,var(--color-escuro)_0%,var(--color-escuro-2)_62%,var(--color-escuro-3)_100%)] px-[30px] py-8 md:flex">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 size-[260px] rounded-full bg-[radial-gradient(circle,rgba(42,195,163,.24),transparent_70%)]"
          />

          <div className="relative z-[1] flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-padrao bg-menta font-titulo text-[19px] font-bold text-escuro"
            >
              V
            </span>
            <span className="font-titulo text-[18px] font-semibold text-tinta-clara">
              Verandi
            </span>
          </div>

          <div className="relative z-[1] pt-6">
            <p className="font-titulo text-[30px] leading-[1.16] font-semibold tracking-[-.025em] whitespace-pre-line text-pretty text-tinta-clara">
              {titulo}
            </p>
            <span aria-hidden className="my-4 block h-[3px] w-15 rounded-sm bg-menta" />
            <p className="max-w-[290px] text-[13.5px] leading-relaxed text-tinta-escura-media">
              {texto}
            </p>
          </div>

          {/*
           * A arte sangra para fora do painel: as margens negativas casam com o
           * padding, e o `overflow` do painel corta o que passa. É o que faz a
           * cena parecer apoiada na borda em vez de colada dentro de uma caixa.
           */}
          <div className="relative z-[1] mt-[18px] mr-[-30px] mb-[-32px] ml-[-30px] h-[236px]">
            {/*
              `<img>` e não `next/image` de propósito: a arte já sai pronta de
              `scripts/otimiza-arte.mjs` no tamanho e formato finais. O `Image`
              acrescentaria uma ida ao otimizador em tempo de execução para
              refazer o que já está feito, e é justamente esta imagem que não
              pode chegar atrasada.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={arte.arquivo}
              alt={arte.descricao}
              width={880}
              height={660}
              fetchPriority="high"
              className="absolute left-1/2 max-w-none -translate-x-1/2 drop-shadow-[0_22px_30px_rgba(0,0,0,.3)]"
              style={{ width: arte.largura, top: arte.topo }}
            />
          </div>
        </section>

        <section className="flex flex-col justify-center px-2 py-4 md:px-7">
          {/* a marca também aparece aqui: em celular o painel escuro não existe */}
          <div className="flex items-center gap-3 pb-6 md:hidden">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-padrao bg-escuro font-titulo text-[19px] font-bold text-menta"
            >
              V
            </span>
            <span className="font-titulo text-[18px] font-semibold">Verandi</span>
          </div>
          {children}
        </section>
      </div>

      {/* aqui o rodapé não é higiene, é o único lugar onde quem foi convidado
          consegue ler os termos antes de criar a senha */}
      <RodapeLegal className="justify-center pt-5" />
    </main>
  )
}
