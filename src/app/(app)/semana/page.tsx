import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo } from '@/server/agenda/consultas'
import { diaDaSemanaDe, somarDias } from '@/core/agenda/datas'
import { localDe } from '@/server/agenda/fuso'
import { GradeSemana } from '@/components/grade/grade-semana'
import { SessaoLinha } from '@/components/ui/sessao-linha'

type Busca = Promise<{ de?: string; profissional?: string; dia?: string }>

/** A segunda-feira da semana que contém a data. */
function segundaDe(data: string): string {
  const d = diaDaSemanaDe(data)
  return somarDias(data, d === 0 ? -6 : 1 - d)
}

export default async function Semana({ searchParams }: { searchParams: Busca }) {
  const p = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { data: contaRow } = await db
    .from('conta').select('fuso').eq('id', conta.contaId).single()
  const fuso = (contaRow?.fuso as string) ?? 'America/Sao_Paulo'

  const hoje = localDe(new Date().toISOString(), fuso).data
  const segunda = segundaDe(p.de ?? hoje)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
  const sabado = dias[6]

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const { data: profissionais } = await db
    .from('profissional').select('id, nome')
    .eq('conta_id', conta.contaId).eq('ativo', true).order('nome')
    .returns<{ id: string; nome: string }[]>()

  const sessoes = await sessoesDoIntervalo(
    db, conta.contaId, segunda, sabado,
    p.profissional ? { profissionalId: p.profissional } : {},
  )

  const { data: excecoes } = await db
    .from('excecao_calendario').select('data, descricao, tipo')
    .eq('conta_id', conta.contaId).gte('data', segunda).lte('data', sabado)
    .returns<{ data: string; descricao: string | null; tipo: string }[]>()

  const feriados = Object.fromEntries(
    (excecoes ?? []).map((e) => [e.data, e.descricao ?? e.tipo]),
  )

  const q = (extra: Record<string, string | undefined>) => {
    const base: Record<string, string> = { de: segunda }
    if (p.profissional) base.profissional = p.profissional
    if (p.dia) base.dia = p.dia
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) delete base[k]
      else base[k] = v
    }
    return `/semana?${new URLSearchParams(base)}`
  }

  // em celular a grade de sete colunas não funciona: vira um dia por vez
  const diaFoco = p.dia ?? hoje
  const doDia = sessoes.filter((s) => s.data === diaFoco)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold">Semana de {segunda}</h1>

        <nav className="flex gap-3 text-sm">
          <Link href={q({ de: somarDias(segunda, -7) })}>← semana anterior</Link>
          <Link href={q({ de: segundaDe(hoje) })}>esta semana</Link>
          <Link href={q({ de: somarDias(segunda, 7) })}>próxima semana →</Link>
        </nav>

        <form className="ml-auto flex items-center gap-2 text-sm">
          <input type="hidden" name="de" value={segunda} />
          <label htmlFor="profissional">{rotulos.profissional.singular}</label>
          <select
            id="profissional" name="profissional" defaultValue={p.profissional ?? ''}
            className="rounded border px-2 py-1"
          >
            <option value="">todos</option>
            {(profissionais ?? []).map((pr) => (
              <option key={pr.id} value={pr.id}>{pr.nome}</option>
            ))}
          </select>
          <button type="submit" className="rounded border px-2 py-1">Filtrar</button>
        </form>
      </header>

      <div className="hidden md:block">
        <GradeSemana sessoes={sessoes} dias={dias} feriados={feriados} />
      </div>

      <div className="md:hidden">
        <nav className="mb-3 flex flex-wrap gap-2 text-sm">
          {dias.map((d) => (
            <Link
              key={d}
              href={q({ dia: d })}
              aria-current={d === diaFoco ? 'page' : undefined}
              className="rounded border px-2 py-1 aria-[current=page]:font-bold"
            >
              {d.slice(8)}
            </Link>
          ))}
        </nav>

        {feriados[diaFoco] ? <p className="mb-2">{feriados[diaFoco]}</p> : null}

        {doDia.length === 0 ? (
          <p className="opacity-70">Nenhum horário neste dia.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={rotulos.sessao.plural}>
            {doDia.map((s) => <SessaoLinha key={s.id} sessao={s} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
