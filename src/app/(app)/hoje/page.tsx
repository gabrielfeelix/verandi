import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo } from '@/server/agenda/consultas'
import { somarDias } from '@/core/agenda/datas'
import { localDe } from '@/server/agenda/fuso'
import { SessaoLinha } from '@/components/ui/sessao-linha'

type Busca = Promise<{ dia?: string; todos?: string }>

export default async function Hoje({ searchParams }: { searchParams: Busca }) {
  const { dia: diaParam, todos } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { data: contaRow } = await db
    .from('conta').select('fuso').eq('id', conta.contaId).single()
  const fuso = (contaRow?.fuso as string) ?? 'America/Sao_Paulo'

  const hoje = localDe(new Date().toISOString(), fuso).data
  const dia = diaParam ?? hoje

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  // o profissional vê a agenda dele; dono e recepção escolhem
  const { data: eu } = await db
    .from('profissional').select('id')
    .eq('conta_id', conta.contaId)
    .eq('usuario_id', (await db.auth.getUser()).data.user?.id ?? '')
    .maybeSingle<{ id: string }>()

  const podeVerTodos = conta.papel !== 'profissional'
  const verTodos = podeVerTodos && todos === '1'
  const filtro = !verTodos && eu ? { profissionalId: eu.id } : {}

  const sessoes = await sessoesDoIntervalo(db, conta.contaId, dia, dia, filtro)
  const pendentes = sessoes.filter(
    (s) => s.chamada === 'pendente' && s.status !== 'cancelada',
  ).length

  const link = (d: string, t = verTodos) =>
    `/hoje?dia=${d}${t ? '&todos=1' : ''}`

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold">
          {dia === hoje ? 'Hoje' : dia}
        </h1>

        <nav className="flex gap-3 text-sm">
          <Link href={link(somarDias(dia, -1))}>← dia anterior</Link>
          {dia !== hoje ? <Link href={link(hoje)}>hoje</Link> : null}
          <Link href={link(somarDias(dia, 1))}>próximo dia →</Link>
        </nav>

        {podeVerTodos ? (
          <Link href={link(dia, !verTodos)} className="text-sm underline">
            {verTodos
              ? 'Ver só a minha agenda'
              : `Ver de todos os ${rotulos.profissional.plural.toLowerCase()}`}
          </Link>
        ) : null}
      </header>

      {pendentes > 0 ? (
        <p className="font-medium">
          {pendentes} {pendentes === 1 ? 'chamada pendente' : 'chamadas pendentes'}.
        </p>
      ) : null}

      {sessoes.length === 0 ? (
        <p className="opacity-70">
          Nenhum horário neste dia.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={rotulos.sessao.plural}>
          {sessoes.map((s) => (
            <SessaoLinha key={s.id} sessao={s} mostrarProfissional={verTodos} />
          ))}
        </ul>
      )}
    </div>
  )
}
