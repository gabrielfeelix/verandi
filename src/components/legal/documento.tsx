import Link from 'next/link'
import { EM_REVISAO, LINKS_LEGAIS, type Bloco, type Documento } from '@/core/legal'

/**
 * A tela de um documento legal.
 *
 * Ela é pública de propósito: quem mais precisa ler a política de privacidade é
 * justamente quem não tem login, o titular do dado e o jurídico da clínica que
 * ainda está avaliando a compra. Documento atrás de senha é documento que não
 * existe.
 *
 * A largura é menor que a do resto do produto porque aqui se lê linha corrida,
 * não tabela: acima de uns 75 caracteres o olho perde a volta da linha. O
 * sistema é denso e miúdo porque é tela de trabalho; isto aqui não é.
 */
export function TelaDocumento({ doc }: { doc: Documento }) {
  const outro = LINKS_LEGAIS.find((l) => l.href !== `/${doc.slug}`)

  return (
    <main className="mx-auto w-full max-w-[780px] px-4 py-8 md:px-6 md:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 rounded-padrao"
        aria-label="Verandi, ir para o início"
      >
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-padrao bg-escuro font-titulo text-[18px] font-bold text-menta"
        >
          V
        </span>
        <span className="font-titulo text-[18px] font-semibold">Verandi</span>
      </Link>

      <header className="pt-8">
        <h1 className="font-titulo text-[30px] leading-[1.15] font-semibold tracking-[-.02em]">
          {doc.titulo}
        </h1>
        <p className="max-w-[58ch] pt-3 text-[15px] leading-relaxed text-tinta-media">
          {doc.resumo}
        </p>
        <p className="pt-4 text-[12.5px] text-tinta-fraca">
          Versão {doc.versao}, vigente desde {doc.vigenteDesde}.
        </p>

        {/*
          Enquanto a minuta não voltou do advogado, ela diz que é minuta. É o
          único jeito honesto de publicar antes da revisão, e some com uma linha
          em `core/legal/comum.ts` quando a revisão chegar.
        */}
        {EM_REVISAO ? (
          <p className="mt-4 flex items-start gap-2.5 rounded-padrao border border-atencao-linha bg-atencao-superficie px-3.5 py-3 text-[13.5px] leading-relaxed text-atencao">
            <span aria-hidden className="mt-1.5 size-[7px] shrink-0 rounded-full bg-atencao" />
            Esta versão está em revisão jurídica. O texto descreve o que o
            sistema faz hoje, e pode ganhar precisão de redação antes de virar
            versão definitiva.
          </p>
        ) : null}
      </header>

      {/* O sumário existe para o jurídico achar a cláusula que ele veio ler,
          que quase nunca é a primeira. */}
      <nav aria-label="Seções deste documento" className="pt-9">
        <ol className="flex flex-col gap-1.5">
          {doc.secoes.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-[14px] leading-relaxed text-marca hover:text-marca-forte"
              >
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="flex flex-col gap-10 pt-12">
        {doc.secoes.map((s) => (
          /* `scroll-mt` porque a âncora encostaria o título no topo da janela */
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="font-titulo text-[19px] leading-snug font-semibold">
              {s.titulo}
            </h2>
            <div className="flex flex-col gap-4 pt-3.5">
              {s.blocos.map((b, i) => (
                <Peca key={i} bloco={b} />
              ))}
            </div>
          </section>
        ))}
      </article>

      <footer className="mt-14 border-t border-linha pt-6 text-[13.5px] text-tinta-fraca">
        {outro ? (
          <p>
            Leia também:{' '}
            <Link href={outro.href} className="text-marca hover:text-marca-forte">
              {outro.rotulo}
            </Link>
            .
          </p>
        ) : null}
        <p className="pt-2">Verandi, um produto 4YU.</p>
      </footer>
    </main>
  )
}

function Peca({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === 'p') {
    return (
      <p className="text-[15px] leading-[1.75] text-tinta">{bloco.texto}</p>
    )
  }

  if (bloco.tipo === 'lista') {
    return (
      <ul className="flex flex-col gap-2.5">
        {bloco.itens.map((it, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-[1.7] text-tinta">
            <span aria-hidden className="mt-[9px] size-[6px] shrink-0 rounded-full bg-menta" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (bloco.tipo === 'nota') {
    return (
      <p className="rounded-padrao border-l-2 border-menta bg-superficie-suave px-4 py-3.5 text-[14.5px] leading-[1.7] text-tinta-media">
        {bloco.texto}
      </p>
    )
  }

  return (
    /* tabela em celular não cabe: rola dentro da própria moldura, e não empurra
       a página inteira para o lado */
    <div className="overflow-x-auto rounded-padrao border border-linha">
      <table className="w-full min-w-[440px] border-collapse text-left">
        <thead>
          <tr className="bg-superficie-suave">
            {bloco.cabecalho.map((c) => (
              <th
                key={c}
                scope="col"
                className="border-b border-linha px-3.5 py-2.5 text-[12px] font-medium tracking-[.1em] text-tinta-fraca uppercase"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloco.linhas.map((linha, i) => (
            <tr key={i} className="border-b border-linha-fina last:border-0">
              {linha.map((celula, j) => (
                <td
                  key={j}
                  className={`px-3.5 py-3 align-top text-[14px] leading-relaxed ${
                    j === 0 ? 'font-medium text-tinta' : 'text-tinta-media'
                  }`}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
