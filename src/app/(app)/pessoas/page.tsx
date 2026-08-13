import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarPessoas, type FiltroPessoa } from '@/server/pessoas/consultas'
import { NovaPessoa } from '@/components/pessoas/nova-pessoa'

const FILTROS: Array<{ valor: FiltroPessoa; rotulo: string }> = [
  { valor: 'sem_telefone',     rotulo: 'Sem telefone' },
  { valor: 'sem_horario_fixo', rotulo: 'Sem horário fixo' },
  { valor: 'plano_vencendo',   rotulo: 'Plano vencendo' },
  { valor: 'faltou_duas',      rotulo: 'Faltou 2+ vezes' },
  { valor: 'inativa',          rotulo: 'Inativas' },
]

type Busca = Promise<{ q?: string; f?: string | string[] }>

export default async function Pessoas({ searchParams }: { searchParams: Busca }) {
  const { q, f } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const filtros = (Array.isArray(f) ? f : f ? [f] : []) as FiltroPessoa[]
  const pessoas = await listarPessoas(db, conta.contaId, { busca: q, filtros })

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{rotulos.pessoa.plural}</h1>
        <span className="opacity-70">{pessoas.length} no total</span>
      </header>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q">Buscar</label>
          <input
            id="q" name="q" defaultValue={q ?? ''}
            placeholder="nome, mesmo sem acento"
            className="rounded border px-3 py-2"
          />
        </div>

        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Filtros</legend>
          {FILTROS.map((x) => (
            <label key={x.valor} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox" name="f" value={x.valor}
                defaultChecked={filtros.includes(x.valor)}
              />
              {x.rotulo}
            </label>
          ))}
        </fieldset>

        <button type="submit" className="rounded border px-3 py-2">Filtrar</button>
      </form>

      <NovaPessoa rotuloPessoa={rotulos.pessoa.singular} />

      {pessoas.length === 0 ? (
        <p className="opacity-70">
          Ninguém encontrado. Ajuste a busca ou cadastre {rotulos.pessoa.singular.toLowerCase()}.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={rotulos.pessoa.plural}>
          {pessoas.map((p) => (
            <li key={p.id} className="rounded border p-3">
              <Link href={`/pessoas/${p.id}`} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{p.nome}</span>

                {/* algo que desambigua: nomes se repetem e são escritos de
                    formas diferentes entre meses */}
                <span className="text-sm opacity-70">
                  {p.telefone ?? p.identificadorExterno ?? 'sem telefone'}
                </span>

                {p.vagasAtivas === 0 ? (
                  <span className="text-sm opacity-70">sem horário fixo</span>
                ) : (
                  <span className="text-sm opacity-70">
                    {p.vagasAtivas} {rotulos.vaga.plural.toLowerCase()}
                  </span>
                )}

                {p.reposicoesAbertas > 0 ? (
                  <span className="text-sm">
                    {p.reposicoesAbertas} reposição(ões) em aberto
                  </span>
                ) : null}

                {p.faltasRecentes >= 2 ? (
                  <span className="text-sm font-medium">
                    {p.faltasRecentes} faltas em 30 dias
                  </span>
                ) : null}

                {!p.ativo ? <span className="text-sm">inativa</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
