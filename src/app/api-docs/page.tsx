import type { Metadata } from 'next'
import Link from 'next/link'
import { ABERTURA, COMECAR, REGRAS, WEBHOOK, type Passo } from '@/core/api-doc/guia'
import { BASE, ROTAS, type Campo, type Rota } from '@/core/api-doc/referencia'

export const metadata: Metadata = {
  title: 'API da Verandi',
  description:
    'Como outro sistema consulta horários com vaga, cadastra pessoas, marca e desmarca na agenda de um estúdio ou clínica.',
}

/**
 * A documentação da API, pública.
 *
 * Pública porque documentação atrás de login é documentação que não convence
 * ninguém a integrar: quem avalia se dá para plugar faz isso antes de ter conta.
 *
 * A ordem da página é a ordem em que a pessoa precisa das coisas: pegar a chave,
 * fazer uma chamada funcionar, entender as quatro regras que quebram integração,
 * e só então a lista de rotas. Conceito antes do primeiro `curl` é o que faz
 * fechar a aba.
 */

const TINTA_METODO: Record<Rota['metodo'], string> = {
  GET: 'bg-positivo-fundo text-positivo',
  POST: 'bg-info-fundo text-info',
  DELETE: 'bg-alerta-fundo text-alerta',
}

function Codigo({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-padrao border border-linha bg-superficie-suave p-3.5 text-[12.5px] leading-[1.65]">
      <code className="font-mono whitespace-pre">{children}</code>
    </pre>
  )
}

function Bloco({ p }: { p: Passo }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="font-titulo text-[15px] font-semibold">{p.titulo}</h3>
      <p className="text-[14px] leading-[1.7] text-tinta-media">{p.texto}</p>
      {p.codigo ? <Codigo>{p.codigo}</Codigo> : null}
    </div>
  )
}

function Tabela({ titulo, campos }: { titulo: string; campos: Campo[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] font-medium tracking-[.1em] text-tinta-fraca uppercase">
        {titulo}
      </p>
      <div className="overflow-x-auto rounded-padrao border border-linha">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <tbody>
            {campos.map((c) => (
              <tr key={c.nome} className="border-b border-linha-fina last:border-0">
                <td className="px-3.5 py-2.5 align-top">
                  <span className="font-mono text-[12.5px] font-medium">{c.nome}</span>
                  {c.obrigatorio ? (
                    <span className="ml-2 text-[11px] text-alerta">obrigatório</span>
                  ) : null}
                </td>
                <td className="px-3.5 py-2.5 align-top text-[12.5px] text-tinta-fraca">
                  {c.tipo}
                </td>
                <td className="px-3.5 py-2.5 align-top text-[13px] leading-relaxed text-tinta-media">
                  {c.descricao}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ApiDocs() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-8 md:px-6 md:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 rounded-padrao"
        aria-label="Verandi, ir para o início"
      >
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-padrao bg-escuro font-titulo text-[17px] font-bold text-menta"
        >
          V
        </span>
        <span className="font-titulo text-[17px] font-semibold">Verandi</span>
      </Link>

      <header className="pt-8">
        <h1 className="font-titulo text-[30px] leading-[1.15] font-semibold tracking-[-.02em]">
          API da Verandi
        </h1>
        <p className="max-w-[62ch] pt-3 text-[14px] leading-[1.75]">{ABERTURA}</p>
        <p className="pt-4 font-mono text-[12.5px] text-tinta-fraca">{BASE}</p>
      </header>

      <section className="flex flex-col gap-7 pt-11">
        <h2 className="font-titulo text-[19px] font-semibold">Começando</h2>
        {COMECAR.map((p) => <Bloco key={p.titulo} p={p} />)}
      </section>

      <section className="flex flex-col gap-7 pt-12">
        <h2 className="font-titulo text-[19px] font-semibold">
          Cinco coisas que evitam retrabalho
        </h2>
        {REGRAS.map((p) => <Bloco key={p.titulo} p={p} />)}
      </section>

      <section className="pt-12">
        <h2 className="font-titulo text-[19px] font-semibold">Rotas</h2>

        <nav aria-label="Rotas" className="flex flex-col gap-1.5 pt-4">
          {ROTAS.map((r) => (
            <a
              key={r.id}
              href={`#${r.id}`}
              className="flex flex-wrap items-baseline gap-2 text-[13px] text-marca hover:text-marca-forte"
            >
              <span className="font-mono text-[11.5px] font-medium">{r.metodo}</span>
              <span className="font-mono">{r.caminho}</span>
              <span className="text-tinta-fraca">{r.titulo}</span>
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-12 pt-10">
          {ROTAS.map((r) => (
            <article key={r.id} id={r.id} className="scroll-mt-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded-peca px-2 py-[3px] font-mono text-[11px] font-semibold ${TINTA_METODO[r.metodo]}`}
                >
                  {r.metodo}
                </span>
                <span className="font-mono text-[14px] font-medium">{r.caminho}</span>
              </div>

              <h3 className="pt-3 font-titulo text-[17px] font-semibold">{r.titulo}</h3>
              <p className="pt-2 text-[14px] leading-[1.7] text-tinta-media">{r.resumo}</p>

              {r.atencao ? (
                <p className="mt-3.5 rounded-padrao border-l-2 border-menta bg-superficie-suave px-4 py-3 text-[13.5px] leading-[1.7] text-tinta-media">
                  {r.atencao}
                </p>
              ) : null}

              <div className="flex flex-col gap-4 pt-4">
                {r.parametros ? <Tabela titulo="Parâmetros" campos={r.parametros} /> : null}
                {r.corpo ? <Tabela titulo="Corpo" campos={r.corpo} /> : null}

                <div className="flex flex-col gap-2">
                  <p className="text-[10.5px] font-medium tracking-[.1em] text-tinta-fraca uppercase">
                    Exemplo
                  </p>
                  <Codigo>{r.exemplo}</Codigo>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-[10.5px] font-medium tracking-[.1em] text-tinta-fraca uppercase">
                    Resposta
                  </p>
                  <Codigo>{r.resposta}</Codigo>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="webhook" className="flex flex-col gap-7 scroll-mt-6 pt-14">
        <div>
          <h2 className="font-titulo text-[19px] font-semibold">
            Receber avisos da Verandi
          </h2>
          <p className="max-w-[62ch] pt-2 text-[14px] leading-[1.7] text-tinta-media">
            As rotas acima são você perguntando. Esta parte é o contrário: a
            recepção cancela a aula de quinta na tela, e o seu sistema precisa
            saber para avisar quem ia.
          </p>
        </div>
        {WEBHOOK.map((p) => <Bloco key={p.titulo} p={p} />)}
      </section>

      <footer className="mt-14 border-t border-linha pt-6 text-[12.5px] leading-relaxed text-tinta-fraca">
        <p>
          Dúvida de integração:{' '}
          <span className="text-tinta-media">sac@4yu.com.br</span>.
        </p>
        <p className="pt-2">
          <Link href="/termos" className="text-marca hover:text-marca-forte">
            Termos de uso
          </Link>
          {' · '}
          <Link href="/privacidade" className="text-marca hover:text-marca-forte">
            Privacidade
          </Link>
        </p>
      </footer>
    </main>
  )
}
