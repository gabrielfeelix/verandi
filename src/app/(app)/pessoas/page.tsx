import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import {
  contarPessoas, listarPessoas, POR_PAGINA, type FiltroPessoa,
} from '@/server/pessoas/consultas'
import { telefoneMascarado } from '@/core/pessoas/telefone'
import { situacaoDe, DIAS_CURTOS } from '@/core/pessoas/situacao'
import { NovaPessoa } from '@/components/pessoas/nova-pessoa'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { cartao, Chip, Paginacao, Vazio } from '@/components/ui/pecas'
import { TINTA } from '@/components/ui/tintas'

const FILTROS: Array<{ valor: FiltroPessoa; rotulo: string }> = [
  { valor: 'sem_telefone',     rotulo: 'Sem telefone' },
  { valor: 'sem_horario_fixo', rotulo: 'Sem horário fixo' },
  { valor: 'plano_vencendo',   rotulo: 'Plano vencendo' },
  { valor: 'faltou_duas',      rotulo: 'Faltou nas últimas duas' },
  { valor: 'inativa',          rotulo: 'Inativa' },
]

/*
 * Sem gênero e sem interpolar o rótulo da conta.
 *
 * O vocabulário é escolhido por quem usa, e há rótulo masculino e feminino
 * entre as escolhas possíveis — juntar o rótulo com "inativa" produz frases
 * que só aparecem depois de a conta trocar a palavra, muito longe daqui.
 */
const NOTA_INATIVA = 'quem está inativo não some, fica fora do padrão'

type Busca = Promise<{ q?: string; f?: string | string[]; t?: string; p?: string }>

function quando(iso: string | null) {
  if (!iso) return 'nunca veio'
  const dias = Math.floor((Date.parse(new Date().toDateString()) - Date.parse(iso)) / 864e5)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `${dias} dias`
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export default async function Pessoas({ searchParams }: { searchParams: Busca }) {
  const { q, f, t: tag, p: pag } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const filtros = (Array.isArray(f) ? f : f ? [f] : []) as FiltroPessoa[]
  const pagina = Math.max(1, Number(pag) || 1)

  const [{ linhas: pessoas, total }, contagem] = await Promise.all([
    listarPessoas(db, conta.contaId, {
      busca: q, filtros, tag, fuso: conta.fuso, pagina,
    }),
    contarPessoas(db, conta.contaId, { busca: q, fuso: conta.fuso }),
  ])

  const cadastrados = contagem.ativos + contagem.inativos
  const semFiltro = filtros.length === 0 && !tag

  /*
   * O contador do topo conta a busca inteira, não a página: com paginação, "24
   * cadastrados" tinha virado "20 cadastrados" a cada vez que a lista passasse
   * de uma página — um número errado que ninguém desconfiaria.
   */
  const endereco = (mudanca: (b: URLSearchParams) => void) => {
    const base = new URLSearchParams()
    if (q) base.set('q', q)
    for (const x of filtros) base.append('f', x)
    if (tag) base.set('t', tag)
    mudanca(base)
    const s = base.toString()
    return s ? `/pessoas?${s}` : '/pessoas'
  }

  // trocar de filtro sempre volta para a página 1: a página 4 do filtro
  // anterior quase nunca existe no novo
  const alternar = (valor: FiltroPessoa) =>
    endereco((b) => {
      b.delete('f')
      for (const x of filtros) if (x !== valor) b.append('f', x)
      if (!filtros.includes(valor)) b.append('f', valor)
    })

  const alternarTag = (nome: string) =>
    endereco((b) => { if (tag === nome) b.delete('t'); else b.set('t', nome) })

  const daPagina = (n: number) => endereco((b) => { if (n > 1) b.set('p', String(n)) })
  const exportar = endereco(() => {}).replace('/pessoas', '/pessoas/exportar')

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            {rotulos.pessoa.plural}
          </h1>
          {/* três números, não um: "28 cadastrados" sozinho esconde que três
              pessoas pararam, e é justamente quem parou que se quer achar */}
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {cadastrados} {cadastrados === 1 ? 'cadastrado' : 'cadastrados'}
            {' · '}{contagem.ativos} {contagem.ativos === 1 ? 'ativo' : 'ativos'}
            {' · '}{contagem.inativos} {contagem.inativos === 1 ? 'inativo' : 'inativos'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form className="relative flex items-center">
            {filtros.map((x) => (
              <input key={x} type="hidden" name="f" value={x} />
            ))}
            {tag ? <input type="hidden" name="t" value={tag} /> : null}
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 font-mono text-[13px] text-tinta-fraca"
            >
              ⌕
            </span>
            <input
              id="q" name="q" defaultValue={q ?? ''} aria-label="Buscar"
              placeholder="Nome, telefone ou identificador"
              className="min-h-11 min-w-[248px] rounded-padrao border border-linha bg-superficie pr-3.5 pl-9 text-[13px] placeholder:text-tinta-fraca"
            />
            {/* a busca acontece com Enter; o botão existe para quem navega por
                teclado saber que existe uma, e para leitor de tela anunciá-la */}
            <button type="submit" className="sr-only focus:not-sr-only focus:ml-2">
              Buscar
            </button>
          </form>

          <a
            href={exportar}
            download
            className="inline-flex min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[13px] font-medium hover:bg-superficie-mais-suave"
          >
            Exportar
          </a>

          <div data-guia="pessoas-novo">
            <NovaPessoa rotuloPessoa={rotulos.pessoa.singular} />
          </div>
        </div>
      </header>

      {/* Os filtros são o motivo desta tela existir: a planilha já dá a lista,
          o que ela não dá é "quem está sumindo" e "quem eu não consigo avisar".
          O número em cada chip é o que faz reparar sem precisar clicar. */}
      <div className="flex flex-wrap gap-1.5">
        <Chip href={endereco((b) => { b.delete('f'); b.delete('t') })} ativo={semFiltro}>
          Todos <Contador ativo={semFiltro}>{contagem.ativos}</Contador>
        </Chip>

        {FILTROS.map((x) => {
          const ativo = filtros.includes(x.valor)
          return (
            <Chip key={x.valor} href={alternar(x.valor)} ativo={ativo}>
              {x.rotulo} <Contador ativo={ativo}>{contagem.porFiltro[x.valor]}</Contador>
            </Chip>
          )
        })}

        {/* as etiquetas são da conta, não do código: "gestante" aqui é escolha
            do estúdio, e outra conta terá outras */}
        {contagem.etiquetas.map((e) => (
          <Chip key={e.tag} href={alternarTag(e.tag)} ativo={tag === e.tag}>
            <span className="capitalize">{e.tag}</span>{' '}
            <Contador ativo={tag === e.tag}>{e.n}</Contador>
          </Chip>
        ))}
      </div>

      <section className={`overflow-hidden ${cartao}`}>
        <div className="hidden grid-cols-[minmax(0,1fr)_132px_108px_116px_128px] gap-3.5 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3 md:grid">
          {['Nome', 'Telefone', rotulos.serie.singular, 'Última presença', 'Situação']
            .map((c) => (
              <span
                key={c}
                className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-media uppercase"
              >
                {c}
              </span>
            ))}
        </div>

        {pessoas.length === 0 ? (
          <Vazio
            icone="pessoas"
            titulo="Ninguém com esses filtros"
            texto="Conta nova começa assim. O primeiro cadastro entra pelo botão acima, com o nome apenas."
          />
        ) : (
          <ul aria-label={rotulos.pessoa.plural}>
            {pessoas.map((p) => {
              const [fundo, frente] = paresDe(p.nome)
              const situacao = situacaoDe(p)
              const fone = telefoneMascarado(p.telefone)

              return (
                <li key={p.id}>
                  <Link
                    href={`/pessoas/${p.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 border-b border-linha-fina px-4.5 py-3.5 hover:bg-superficie-tenue md:grid-cols-[minmax(0,1fr)_132px_108px_116px_128px]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex size-8.5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
                        style={{ background: fundo, color: frente, opacity: p.ativo ? 1 : 0.55 }}
                      >
                        {iniciaisDe(p.nome)}
                      </span>
                      <span className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[14px] font-medium">{p.nome}</span>
                          {p.tags.map((x) => (
                            <span
                              key={x}
                              className={`shrink-0 rounded-minima px-1.5 py-[3px] text-[10px] font-semibold tracking-[.08em] uppercase ${TINTA.atencao}`}
                            >
                              {x}
                            </span>
                          ))}
                        </span>
                        <span className="truncate text-[11.5px] text-tinta-media">
                          {p.identificadorExterno
                            ? `id ${p.identificadorExterno}`
                            : 'sem identificador'}
                        </span>
                      </span>
                    </span>

                    <span
                      title={fone ? undefined : 'sem telefone cadastrado'}
                      className={`font-mono text-[12.5px] ${
                        fone ? 'text-tinta-media' : 'text-alerta'
                      }`}
                    >
                      {fone ?? 'sem registro'}
                      {fone ? null : <span className="sr-only">sem telefone</span>}
                    </span>

                    <span
                      className={`hidden text-[13px] md:block ${
                        p.horarioFixo ? 'text-tinta-media' : 'text-tinta-fraca'
                      }`}
                    >
                      {p.horarioFixo ? (
                        <>
                          {DIAS_CURTOS[p.horarioFixo.diaSemana]} {p.horarioFixo.hora}
                          {p.vagasAtivas > 1 ? (
                            <span className="text-tinta-fraca"> +{p.vagasAtivas - 1}</span>
                          ) : null}
                        </>
                      ) : 'sem registro'}
                    </span>

                    <span className="hidden text-[13px] text-tinta-media md:block">
                      {quando(p.ultimaPresenca)}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 justify-self-start rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${TINTA[situacao.tinta]}`}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {situacao.rotulo}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {total > 0 ? (
          <div className="border-t border-linha-fina px-4.5 py-3.5">
            <Paginacao
              pagina={pagina}
              total={total}
              porPagina={POR_PAGINA}
              hrefDe={daPagina}
              nota={NOTA_INATIVA}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

/** O número dentro do chip: mesma linha, peso menor, nunca disputa o rótulo. */
function Contador({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  return (
    <span className={`font-mono text-[11.5px] ${ativo ? 'opacity-70' : 'text-tinta-fraca'}`}>
      {children}
    </span>
  )
}
