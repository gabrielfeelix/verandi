import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarPessoas, POR_PAGINA, type FiltroPessoa } from '@/server/pessoas/consultas'
import { NovaPessoa } from '@/components/pessoas/nova-pessoa'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { Chip, Paginacao, Vazio } from '@/components/ui/pecas'

const FILTROS: Array<{ valor: FiltroPessoa; rotulo: string }> = [
  { valor: 'sem_telefone',     rotulo: 'Sem telefone' },
  { valor: 'sem_horario_fixo', rotulo: 'Sem horário fixo' },
  { valor: 'plano_vencendo',   rotulo: 'Plano vencendo' },
  { valor: 'faltou_duas',      rotulo: 'Faltou 2+ vezes' },
  { valor: 'inativa',          rotulo: 'Inativas' },
]

type Busca = Promise<{ q?: string; f?: string | string[]; p?: string }>

function quando(iso: string | null) {
  if (!iso) return 'nunca veio'
  const dias = Math.floor((Date.parse(new Date().toDateString()) - Date.parse(iso)) / 864e5)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return `${iso.slice(8)}/${iso.slice(5, 7)}`
}

export default async function Pessoas({ searchParams }: { searchParams: Busca }) {
  const { q, f, p: pag } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const filtros = (Array.isArray(f) ? f : f ? [f] : []) as FiltroPessoa[]
  const pagina = Math.max(1, Number(pag) || 1)
  const { linhas: pessoas, total } = await listarPessoas(db, conta.contaId, {
    busca: q, filtros, fuso: conta.fuso, pagina,
  })

  /*
   * O contador do topo conta a busca inteira, não a página: com paginação, "24
   * cadastrados" tinha virado "20 cadastrados" a cada vez que a lista passasse
   * de uma página — um número errado que ninguém desconfiaria.
   */
  const endereco = (mudanca: (b: URLSearchParams) => void) => {
    const base = new URLSearchParams()
    if (q) base.set('q', q)
    for (const x of filtros) base.append('f', x)
    mudanca(base)
    return `/pessoas?${base}`
  }

  // trocar de filtro sempre volta para a página 1: a página 4 do filtro
  // anterior quase nunca existe no novo
  const alternar = (valor: FiltroPessoa) =>
    endereco((b) => {
      b.delete('f')
      for (const x of filtros) if (x !== valor) b.append('f', x)
      if (!filtros.includes(valor)) b.append('f', valor)
    })

  const daPagina = (n: number) => endereco((b) => { if (n > 1) b.set('p', String(n)) })

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            {rotulos.pessoa.plural}
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {total} {total === 1 ? 'cadastrado' : 'cadastrados'}
            {filtros.length > 0 || q ? ' com este filtro' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form className="flex items-center gap-2">
            {filtros.map((x) => (
              <input key={x} type="hidden" name="f" value={x} />
            ))}
            <input
              id="q" name="q" defaultValue={q ?? ''} aria-label="Buscar"
              placeholder="Nome, telefone ou identificador"
              className="min-h-11 min-w-[230px] rounded-padrao border border-linha bg-superficie px-3.5 text-[13px] placeholder:text-tinta-fraca"
            />
            <button
              type="submit"
              className="min-h-11 rounded-padrao border border-linha bg-superficie px-3.5 text-[13px] hover:bg-superficie-suave"
            >
              Buscar
            </button>
          </form>

          <NovaPessoa rotuloPessoa={rotulos.pessoa.singular} />
        </div>
      </header>

      {/* Os filtros são o motivo desta tela existir: a planilha já dá a lista,
          o que ela não dá é "quem está sumindo" e "quem eu não consigo avisar". */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((x) => {
          const ativo = filtros.includes(x.valor)
          return (
            <Chip key={x.valor} href={alternar(x.valor)} ativo={ativo}>
              {x.rotulo}
            </Chip>
          )
        })}
        {filtros.length > 0 || q ? (
          <Link
            href="/pessoas"
            className="inline-flex min-h-9 items-center px-2 text-[12.5px] text-marca underline"
          >
            limpar
          </Link>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-cartao border border-linha bg-superficie">
        <div className="hidden grid-cols-[minmax(0,1fr)_132px_108px_116px_128px] gap-3.5 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3 md:grid">
          {['Nome', 'Telefone', 'Horário fixo', 'Última presença', 'Situação'].map((c) => (
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
            texto="Conta nova começa assim — o primeiro cadastro entra pelo botão acima, com o nome apenas."
          />
        ) : (
          <ul aria-label={rotulos.pessoa.plural}>
            {pessoas.map((p) => {
              const [fundo, frente] = paresDe(p.nome)
              const situacao = !p.ativo
                ? { rotulo: 'Inativa', cor: 'bg-neutro-fundo text-tinta-media' }
                : p.faltasRecentes >= 2
                  ? { rotulo: 'Sumindo', cor: 'bg-alerta-fundo text-alerta' }
                  : p.reposicoesAbertas > 0
                    ? { rotulo: 'Tem crédito', cor: 'bg-atencao-fundo text-atencao' }
                    : { rotulo: 'Em dia', cor: 'bg-positivo-fundo text-positivo' }

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
                        <span className="truncate text-[14px] font-medium">{p.nome}</span>
                        <span className="truncate text-[11.5px] text-tinta-media">
                          {p.identificadorExterno ?? 'sem identificador'}
                        </span>
                      </span>
                    </span>

                    <span
                      className={`font-mono text-[12.5px] ${
                        p.telefone ? 'text-tinta-media' : 'text-alerta'
                      }`}
                    >
                      {p.telefone ?? 'sem telefone'}
                    </span>

                    <span
                      className={`hidden text-[13px] md:block ${
                        p.vagasAtivas === 0 ? 'text-tinta-fraca' : 'text-tinta-media'
                      }`}
                    >
                      {p.vagasAtivas === 0
                        ? 'sem horário fixo'
                        : `${p.vagasAtivas} ${
                            (p.vagasAtivas === 1
                              ? rotulos.vaga.singular
                              : rotulos.vaga.plural
                            ).toLowerCase()
                          }`}
                    </span>

                    <span className="hidden text-[13px] text-tinta-media md:block">
                      {quando(p.ultimaPresenca)}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 justify-self-start rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${situacao.cor}`}
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
            />
          </div>
        ) : null}
      </section>

      <p className="text-[12px] text-tinta-fraca">
        Quem está inativo não some, fica fora do padrão — o histórico de março
        depende de quem parou em março.
      </p>
    </div>
  )
}
