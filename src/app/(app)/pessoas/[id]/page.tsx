import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { fichaDaPessoa } from '@/server/pessoas/consultas'
import { EditarPessoa } from '@/components/pessoas/editar-pessoa'
import { Vagas } from '@/components/pessoas/vagas'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export default async function Pessoa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conta = await exigirConta()
  const db = await clienteServidor()

  const ficha = await fichaDaPessoa(db, conta.contaId, id)
  if (!ficha) notFound()

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const { data: series } = await db
    .from('serie')
    .select('id, dia_semana, hora_inicio, servico:servico_id(nome)')
    .eq('conta_id', conta.contaId).eq('ativo', true)
    .order('dia_semana').order('hora_inicio')
    .returns<Array<{ id: string; dia_semana: number; hora_inicio: string;
                     servico: { nome: string } | null }>>()

  const opcoesSerie = (series ?? []).map((s) => ({
    id: s.id,
    rotulo: `${DIAS[s.dia_semana]} ${String(s.hora_inicio).slice(0, 5)} · ${s.servico?.nome ?? '—'}`,
  }))

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">{ficha.pessoa.nome}</h1>
        <p className="opacity-80">
          {ficha.pessoa.telefone ?? 'sem telefone'}
          {ficha.pessoa.identificadorExterno
            ? ` · ${ficha.pessoa.identificadorExterno}` : ''}
          {!ficha.pessoa.ativo ? ' · inativa' : ''}
        </p>
        {ficha.tags.length > 0 ? (
          <p className="mt-1 flex gap-2">
            {ficha.tags.map((t) => (
              <span key={t} className="rounded border px-1.5 text-xs">{t}</span>
            ))}
          </p>
        ) : null}
      </header>

      <EditarPessoa
        pessoa={{
          id: ficha.pessoa.id,
          nome: ficha.pessoa.nome,
          telefone: ficha.pessoa.telefone,
          email: ficha.pessoa.email,
          identificadorExterno: ficha.pessoa.identificadorExterno,
          nascimento: ficha.pessoa.nascimento,
          vencimentoPlano: ficha.pessoa.vencimentoPlano,
          observacao: ficha.pessoa.observacao,
          ativo: ficha.pessoa.ativo,
        }}
      />

      <section>
        <h2 className="mb-2 font-medium">{rotulos.vaga.plural}</h2>
        <Vagas
          pessoaId={ficha.pessoa.id}
          vagas={ficha.vagas.map((v) => ({
            id: v.id,
            rotulo: `${DIAS[v.diaSemana]} ${v.horaInicio} · ${v.servico}` +
                    (v.profissional ? ` · ${v.profissional}` : ''),
            desde: v.inicio,
            ate: v.fim,
          }))}
          series={opcoesSerie}
          rotuloVaga={rotulos.vaga.singular}
        />
      </section>

      {ficha.reposicoesAbertas.length > 0 ? (
        <section>
          <h2 className="mb-2 font-medium">
            Reposições em aberto ({ficha.reposicoesAbertas.length})
          </h2>
          <ul className="flex flex-col gap-1">
            {ficha.reposicoesAbertas.map((r) => (
              <li key={r.id} className="rounded border p-2 text-sm">
                faltou em {r.data} às {r.hora} — {r.servico}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-medium">Próximos horários</h2>
        {ficha.proximas.length === 0 ? (
          <p className="opacity-70">Nada marcado à frente.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ficha.proximas.map((x) => (
              <li key={x.id} className="text-sm">
                <Link href={`/sessao/${x.sessaoId}`}>
                  {x.data} {x.hora} · {x.servico} · {x.origem}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Histórico</h2>
        {ficha.historico.length === 0 ? (
          <p className="opacity-70">Ainda não há histórico.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ficha.historico.slice(0, 60).map((x) => (
              <li key={x.id} className="text-sm">
                <Link href={`/sessao/${x.sessaoId}`}>
                  {x.data} {x.hora} · {x.servico} · <strong>{x.status}</strong>
                  {x.origem !== 'recorrente' ? ` · ${x.origem}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
