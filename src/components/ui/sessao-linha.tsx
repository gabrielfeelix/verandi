import Link from 'next/link'
import type { SessaoResumo } from '@/server/agenda/consultas'

const CHAMADA: Record<string, string> = {
  pendente: 'Chamada pendente',
  feita: 'Chamada feita',
  sem_ninguem: 'Ninguém marcado',
}

/** Uma sessão numa lista. Usada em Hoje e na busca de vaga. */
export function SessaoLinha({
  sessao, mostrarData = false, mostrarProfissional = true,
}: {
  sessao: SessaoResumo
  mostrarData?: boolean
  mostrarProfissional?: boolean
}) {
  const cancelada = sessao.status === 'cancelada'

  return (
    <li className="rounded border p-3">
      <Link href={`/sessao/${sessao.id}`} className="flex flex-wrap items-baseline gap-x-3">
        <span className={`text-lg font-medium ${cancelada ? 'line-through' : ''}`}>
          {mostrarData ? `${sessao.data} · ` : ''}{sessao.hora}
        </span>

        <span className={cancelada ? 'line-through' : undefined}>{sessao.servico}</span>

        {mostrarProfissional && sessao.profissional ? (
          <span className="opacity-70">{sessao.profissional}</span>
        ) : null}

        {sessao.local ? <span className="opacity-70">{sessao.local}</span> : null}

        <span className={sessao.ocupacao.excedida ? 'font-bold' : undefined}>
          {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
        </span>

        {cancelada ? (
          <span className="ml-auto text-sm">Cancelado, {sessao.motivoCancelamento}</span>
        ) : (
          // a informação que mais vale nesta lista: é a chamada que se esquece
          <span
            className={`ml-auto text-sm ${sessao.chamada === 'pendente' ? 'font-bold' : 'opacity-60'}`}
          >
            {CHAMADA[sessao.chamada]}
          </span>
        )}
      </Link>
    </li>
  )
}
