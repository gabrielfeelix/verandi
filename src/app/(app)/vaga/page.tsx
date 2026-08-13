import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { horariosLivres } from '@/server/agenda/disponibilidade'
import { somarDias } from '@/core/agenda/datas'
import { localDe } from '@/server/agenda/fuso'
import { SessaoLinha } from '@/components/ui/sessao-linha'

type Busca = Promise<{
  de?: string; ate?: string; servico?: string; profissional?: string
}>

export default async function BuscarVaga({ searchParams }: { searchParams: Busca }) {
  const p = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const { data: contaRow } = await db
    .from('conta').select('fuso').eq('id', conta.contaId).single()
  const fuso = (contaRow?.fuso as string) ?? 'America/Sao_Paulo'

  const hoje = localDe(new Date().toISOString(), fuso).data
  const de = p.de ?? hoje
  const ate = p.ate ?? somarDias(de, 13)

  const [{ data: servicos }, { data: profissionais }] = await Promise.all([
    db.from('servico').select('id, nome').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome').returns<{ id: string; nome: string }[]>(),
    db.from('profissional').select('id, nome').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome').returns<{ id: string; nome: string }[]>(),
  ])

  const { livres, cheios } = await horariosLivres(db, conta.contaId, {
    de, ate, servicoId: p.servico, profissionalId: p.profissional,
  })

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Buscar vaga</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={de}
                 className="rounded border px-2 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={ate}
                 className="rounded border px-2 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="servico">{rotulos.servico.singular}</label>
          <select id="servico" name="servico" defaultValue={p.servico ?? ''}
                  className="rounded border px-2 py-2">
            <option value="">todos</option>
            {(servicos ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profissional">{rotulos.profissional.singular}</label>
          <select id="profissional" name="profissional" defaultValue={p.profissional ?? ''}
                  className="rounded border px-2 py-2">
            <option value="">todos</option>
            {(profissionais ?? []).map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">Buscar</button>
      </form>

      <section>
        <h2 className="mb-2 font-medium">Com vaga ({livres.length})</h2>
        {livres.length === 0 ? (
          <p className="opacity-70">
            Nenhum horário livre neste período com esses filtros.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Horários com vaga">
            {livres.map((s) => (
              <SessaoLinha key={s.id} sessao={s} mostrarData />
            ))}
          </ul>
        )}
      </section>

      {/* cheio vem separado e rotulado: misturar com o livre é o que faz a
          recepção prometer vaga que não existe. A única coisa que dá para fazer
          a partir daqui é ir na sessão e aumentar a capacidade. */}
      {cheios.length > 0 ? (
        <section>
          <h2 className="mb-2 font-medium">Cheios ({cheios.length})</h2>
          <p className="mb-2 text-sm opacity-70">
            Estes não têm vaga. Para abrir uma, é preciso aumentar a capacidade do dia
            na tela do horário.
          </p>
          <ul className="flex flex-col gap-1 text-sm" aria-label="Horários cheios">
            {cheios.map((s) => (
              <li key={s.id}>
                <Link href={`/sessao/${s.id}`}>
                  {s.data} {s.hora} · {s.servico}
                  {s.profissional ? ` · ${s.profissional}` : ''} ·{' '}
                  {s.ocupacao.ocupadas}/{s.ocupacao.capacidade}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
