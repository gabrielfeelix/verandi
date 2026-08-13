import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { fichaDaPessoa } from '@/server/pessoas/consultas'
import { EditarPessoa } from '@/components/pessoas/editar-pessoa'
import { Vagas } from '@/components/pessoas/vagas'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { TINTA_PRESENCA, GLIFO_PRESENCA, TINTA_ORIGEM } from '@/components/ui/tintas'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const ROTULO_STATUS: Record<string, string> = {
  esperada: 'esperada',
  confirmada: 'confirmou',
  presente: 'veio',
  falta: 'faltou',
  falta_avisada: 'avisou',
  licenca: 'licença',
  cancelada: 'cancelada',
}

function curta(data: string) {
  return `${data.slice(8)}/${data.slice(5, 7)}`
}

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

  const p = ficha.pessoa
  const [fundo, frente] = paresDe(p.nome)

  const presencas = ficha.historico.filter((x) => x.status === 'presente').length
  const faltas = ficha.historico.filter(
    (x) => x.status === 'falta' || x.status === 'falta_avisada',
  ).length

  // a ficha é a linha entre agenda e CRM: entra histórico, tag, observação e
  // contato. Não entra funil, proposta, valor nem cobrança.
  const dados: Array<[string, string, boolean?]> = [
    ['Telefone', p.telefone ?? 'sem telefone', !p.telefone],
    ['Identificador', p.identificadorExterno ?? 'sem identificador', !p.identificadorExterno],
    ['E-mail', p.email ?? 'sem e-mail'],
    ['Nascimento', p.nascimento ? curta(p.nascimento) : '—'],
    ['Plano vence', p.vencimentoPlano ? curta(p.vencimentoPlano) : 'sem data'],
  ]

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2.5 text-[12.5px] text-tinta-media">
        <Link href="/pessoas" className="font-medium text-marca">
          {rotulos.pessoa.plural}
        </Link>
        <span aria-hidden className="font-mono">/</span>
        <span className="text-tinta">{p.nome}</span>
      </nav>

      <article className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 rounded-[20px] border border-linha bg-superficie px-5.5 py-5">
        <div className="flex min-w-0 flex-[1_1_360px] items-start gap-4.5">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold"
            style={{ background: fundo, color: frente, opacity: p.ativo ? 1 : 0.55 }}
          >
            {iniciaisDe(p.nome)}
          </span>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-titulo text-[24px] leading-tight font-semibold">
                {p.nome}
              </h1>
              {ficha.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-[6px] bg-atencao-fundo px-1.5 py-[3px] text-[10px] font-semibold tracking-[.08em] text-atencao uppercase"
                >
                  {t}
                </span>
              ))}
              {!p.ativo ? (
                <span className="rounded-[9px] bg-neutro-fundo px-2.5 py-[5px] text-[11.5px] font-medium text-tinta-media">
                  Inativa — continua no histórico
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {dados.map(([rotulo, valor, falta]) => (
                <span key={rotulo} className="flex flex-col">
                  <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-media uppercase">
                    {rotulo}
                  </span>
                  <span
                    className={`text-[13.5px] ${falta ? 'text-alerta' : ''}`}
                  >
                    {valor}
                  </span>
                </span>
              ))}
            </div>

            {p.observacao ? (
              <p className="rounded-[11px] bg-superficie-suave px-3 py-2 text-[12.5px] text-tinta-media">
                {p.observacao}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="flex gap-2 text-[12px] text-tinta-media">
            <span className="rounded-[9px] bg-positivo-fundo px-2.5 py-1 font-medium text-positivo">
              {presencas} presença{presencas === 1 ? '' : 's'}
            </span>
            {faltas > 0 ? (
              <span className="rounded-[9px] bg-alerta-fundo px-2.5 py-1 font-medium text-alerta">
                {faltas} falta{faltas === 1 ? '' : 's'}
              </span>
            ) : null}
          </span>
          <EditarPessoa
            pessoa={{
              id: p.id,
              nome: p.nome,
              telefone: p.telefone,
              email: p.email,
              identificadorExterno: p.identificadorExterno,
              nascimento: p.nascimento,
              vencimentoPlano: p.vencimentoPlano,
              observacao: p.observacao,
              ativo: p.ativo,
            }}
          />
        </div>
      </article>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3.5">
          <section className="rounded-[20px] border border-linha bg-superficie p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
              <h2 className="font-titulo text-[17px] font-semibold">
                {rotulos.vaga.plural}
              </h2>
              <span className="text-[12px] text-tinta-media">
                a {rotulos.vaga.singular.toLowerCase()} tem vigência — encerrar
                não apaga o passado
              </span>
            </div>
            <Vagas
              pessoaId={p.id}
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

          <section className="rounded-[20px] border border-linha bg-superficie p-4">
            <h2 className="pb-1 font-titulo text-[17px] font-semibold">Histórico</h2>
            <p className="pb-3 text-[12px] text-tinta-media">
              É o que responde &quot;ela vem mesmo?&quot; — a pergunta que hoje se
              responde folheando meses de planilha.
            </p>

            {ficha.historico.length === 0 ? (
              <p className="py-4 text-[13px] text-tinta-media">
                Ainda não há histórico. Quem acabou de ser cadastrado começa
                assim — não é falha de carregamento.
              </p>
            ) : (
              <ul className="flex flex-col">
                {ficha.historico.slice(0, 60).map((x) => (
                  <li key={x.id}>
                    <Link
                      href={`/sessao/${x.sessaoId}`}
                      className="flex items-center gap-3 border-b border-[#F4F7F5] py-2.5 last:border-b-0 hover:bg-[#FBFCFB]"
                    >
                      <span className="w-14 shrink-0 font-mono text-[12px] text-tinta-media">
                        {curta(x.data)}
                      </span>
                      <span className="w-12 shrink-0 font-mono text-[12px] text-tinta-media">
                        {x.hora}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {x.servico}
                      </span>
                      {x.origem !== 'recorrente' ? (
                        <span
                          className={`rounded-[6px] px-1.5 py-[3px] text-[10px] font-semibold tracking-[.08em] uppercase ${
                            {
                              positivo: 'bg-positivo-fundo text-positivo',
                              atencao: 'bg-atencao-fundo text-atencao',
                              alerta: 'bg-alerta-fundo text-alerta',
                              info: 'bg-info-fundo text-info',
                              licenca: 'bg-licenca-fundo text-licenca',
                              neutro: 'bg-neutro-fundo text-tinta-media',
                            }[TINTA_ORIGEM[x.origem as keyof typeof TINTA_ORIGEM] ?? 'neutro']
                          }`}
                        >
                          {x.origem}
                        </span>
                      ) : null}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-[5px] text-[11.5px] font-medium ${
                          {
                            positivo: 'bg-positivo-fundo text-positivo',
                            atencao: 'bg-atencao-fundo text-atencao',
                            alerta: 'bg-alerta-fundo text-alerta',
                            info: 'bg-info-fundo text-info',
                            licenca: 'bg-licenca-fundo text-licenca',
                            neutro: 'bg-neutro-fundo text-tinta-media',
                          }[TINTA_PRESENCA[x.status as keyof typeof TINTA_PRESENCA] ?? 'neutro']
                        }`}
                      >
                        <span aria-hidden>
                          {GLIFO_PRESENCA[x.status as keyof typeof GLIFO_PRESENCA]}
                        </span>
                        {ROTULO_STATUS[x.status] ?? x.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-3.5">
          <section className="rounded-[20px] border border-linha bg-superficie p-4">
            <h2 className="pb-3 font-titulo text-[17px] font-semibold">
              Próximos horários
            </h2>
            {ficha.proximas.length === 0 ? (
              <p className="text-[12.5px] text-tinta-media">Nada marcado à frente.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {ficha.proximas.map((x) => (
                  <li key={x.id}>
                    <Link
                      href={`/sessao/${x.sessaoId}`}
                      className="flex items-center gap-2.5 rounded-[11px] bg-superficie-suave px-3 py-2.5 hover:bg-[#EDF3F0]"
                    >
                      <span className="font-mono text-[12px] text-tinta-media">
                        {curta(x.data)} {x.hora}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {x.servico}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[20px] border border-linha bg-superficie p-4">
            <h2 className="pb-1 font-titulo text-[17px] font-semibold">
              Reposições em aberto
            </h2>
            <p className="pb-3 text-[12px] text-tinta-media">
              falta que virou crédito e ninguém usou
            </p>
            {ficha.reposicoesAbertas.length === 0 ? (
              <p className="text-[12.5px] text-tinta-media">
                Nenhuma. Nada a cobrar de volta.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {ficha.reposicoesAbertas.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2.5 rounded-[11px] bg-atencao-fundo px-3 py-2.5 text-atencao"
                  >
                    <span className="font-mono text-[12px]">
                      {curta(r.data)} {r.hora}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {r.servico}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-3 text-[11.5px] leading-relaxed text-tinta-media">
              Para usar um crédito, encaixe a pessoa num horário e aponte a falta
              pelo menu dela na tela da {rotulos.sessao.singular.toLowerCase()}.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
