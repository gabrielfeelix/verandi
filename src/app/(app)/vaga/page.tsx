import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { horariosLivres } from '@/server/agenda/disponibilidade'
import { somarDias, diaDaSemanaDe } from '@/core/agenda/datas'
import { hojeEm } from '@/server/agenda/fuso'
import { AvatarProf } from '@/components/hoje/pecas'
import type { SessaoResumo } from '@/server/agenda/consultas'

type Busca = Promise<{
  de?: string; ate?: string; servico?: string; profissional?: string; local?: string
}>

const DIAS = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
]

function porDia(sessoes: SessaoResumo[]) {
  const mapa = new Map<string, SessaoResumo[]>()
  for (const s of sessoes) mapa.set(s.data, [...(mapa.get(s.data) ?? []), s])
  return [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
}

export default async function BuscarVaga({ searchParams }: { searchParams: Busca }) {
  const p = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const hoje = hojeEm(conta.fuso)
  const de = p.de ?? hoje
  const ate = p.ate ?? somarDias(de, 13)

  const [{ data: servicos }, { data: profissionais }] = await Promise.all([
    db.from('servico').select('id, nome').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome').returns<{ id: string; nome: string }[]>(),
    db.from('profissional').select('id, nome, cor').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome')
      .returns<{ id: string; nome: string; cor: string | null }[]>(),
  ])

  const { livres, cheios } = await horariosLivres(db, conta.contaId, {
    de, ate, servicoId: p.servico, profissionalId: p.profissional,
  })

  const q = (extra: Record<string, string | undefined>) => {
    const base: Record<string, string> = { de, ate }
    if (p.servico) base.servico = p.servico
    if (p.profissional) base.profissional = p.profissional
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) delete base[k]
      else base[k] = v
    }
    return `/vaga?${new URLSearchParams(base)}`
  }

  const vagasTotais = livres.reduce((n, s) => n + s.ocupacao.livres, 0)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Buscar vaga
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            &quot;Quando tem horário?&quot; — a mesma resposta que o robô dá pela API
          </p>
        </div>
        <span className="pb-1 text-[12px] text-tinta-media">
          {livres.length} horários com vaga · {vagasTotais} vagas livres ·{' '}
          {cheios.length} cheios
        </span>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[268px_minmax(0,1fr)]">
        <section className="flex flex-col gap-4 rounded-[20px] border border-linha bg-superficie p-4">
          <div className="flex flex-col gap-2">
            <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-media uppercase">
              Período
            </span>
            <form className="flex flex-col gap-2">
              {p.servico ? <input type="hidden" name="servico" value={p.servico} /> : null}
              {p.profissional ? (
                <input type="hidden" name="profissional" value={p.profissional} />
              ) : null}
              <span className="flex items-center gap-2">
                <label htmlFor="de" className="w-8 text-[12.5px] text-tinta-media">De</label>
                <input
                  id="de" name="de" type="date" defaultValue={de}
                  className="min-h-10 flex-1 rounded-[11px] border border-linha bg-superficie px-2.5 font-mono text-[12.5px]"
                />
              </span>
              <span className="flex items-center gap-2">
                <label htmlFor="ate" className="w-8 text-[12.5px] text-tinta-media">Até</label>
                <input
                  id="ate" name="ate" type="date" defaultValue={ate}
                  className="min-h-10 flex-1 rounded-[11px] border border-linha bg-superficie px-2.5 font-mono text-[12.5px]"
                />
              </span>
              <button
                type="submit"
                className="min-h-10 rounded-[11px] border border-linha bg-superficie-suave text-[12.5px] font-medium hover:bg-[#EDF3F0]"
              >
                Aplicar período
              </button>
            </form>
          </div>

          <Grupo rotulo={rotulos.servico.singular}>
            <Opcao href={q({ servico: undefined })} ativo={!p.servico}>Todos</Opcao>
            {(servicos ?? []).map((s) => (
              <Opcao
                key={s.id}
                href={q({ servico: p.servico === s.id ? undefined : s.id })}
                ativo={p.servico === s.id}
              >
                {s.nome}
              </Opcao>
            ))}
          </Grupo>

          <Grupo rotulo={rotulos.profissional.singular}>
            <Opcao href={q({ profissional: undefined })} ativo={!p.profissional}>
              Todos
            </Opcao>
            {(profissionais ?? []).map((x) => (
              <Opcao
                key={x.id}
                href={q({ profissional: p.profissional === x.id ? undefined : x.id })}
                ativo={p.profissional === x.id}
              >
                <span
                  aria-hidden
                  className="size-[7px] rounded-full"
                  style={{ background: x.cor ?? '#8B9691' }}
                />
                {x.nome}
              </Opcao>
            ))}
          </Grupo>

          <p className="rounded-[13px] bg-superficie-suave px-3 py-2.5 text-[11.5px] leading-relaxed text-tinta-media">
            Horário cheio não aparece como resultado, e isso não é
            configurável. Ele fica na lista separada, embaixo — é a mesma
            resposta que o robô recebe pela API.
          </p>
        </section>

        <div className="flex flex-col gap-3.5">
          {livres.length === 0 ? (
            <section className="flex flex-col items-center gap-2.5 rounded-[20px] border border-dashed border-[#C6D2CD] bg-superficie px-6 py-8.5 text-center">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-[14px] bg-superficie-mais-suave font-mono text-[17px] text-tinta-media"
              >
                ⌕
              </span>
              <span className="font-titulo text-[18px] font-semibold">
                Nenhum horário livre neste período
              </span>
              <span className="max-w-[380px] text-[13px] leading-relaxed text-tinta-media">
                Com esses filtros não sobra vaga. Amplie o período, tire um
                filtro, ou veja os cheios abaixo — abrir vaga num deles é
                decisão de quem dá a aula.
              </span>
            </section>
          ) : (
            porDia(livres).map(([data, doDia]) => (
              <section
                key={data}
                className="overflow-hidden rounded-[20px] border border-linha bg-superficie"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFF3F1] bg-[#FBFCFB] px-4.5 py-3">
                  <h2 className="text-[13px] font-medium">
                    {DIAS[diaDaSemanaDe(data)]}, {data.slice(8)}/{data.slice(5, 7)}
                  </h2>
                  <span className="text-[12px] text-tinta-media">
                    {doDia.length} horários ·{' '}
                    {doDia.reduce((n, s) => n + s.ocupacao.livres, 0)} vagas
                  </span>
                </div>

                <ul aria-label={`Horários com vaga em ${data}`}>
                  {doDia.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/sessao/${s.id}#encaixar`}
                        className="flex flex-wrap items-center gap-3.5 border-b border-[#F4F7F5] px-4.5 py-3 last:border-b-0 hover:bg-[#FBFCFB]"
                      >
                        <span className="font-mono text-[15px]">{s.hora}</span>
                        {s.profissional ? (
                          <AvatarProf
                            nome={s.profissional}
                            cor={s.corProfissional}
                            tamanho={28}
                          />
                        ) : null}
                        <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                          <span className="truncate text-[14px] font-medium">
                            {s.servico}
                          </span>
                          <span className="truncate text-[12px] text-tinta-media">
                            {[s.profissional, s.local].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="rounded-[9px] bg-positivo-fundo px-2.5 py-[5px] text-[11.5px] font-medium text-positivo">
                          {s.ocupacao.livres}{' '}
                          {s.ocupacao.livres === 1 ? 'vaga' : 'vagas'}
                        </span>
                        <span className="rounded-[11px] border border-linha bg-superficie px-3 py-2 text-[12.5px] font-medium">
                          Marcar
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {/* cheio vem separado e rotulado: misturar com o livre é o que faz a
              recepção prometer vaga que não existe. A única coisa que dá para
              fazer a partir daqui é ir na sessão e aumentar a capacidade. */}
          {cheios.length > 0 ? (
            <section className="overflow-hidden rounded-[20px] border border-linha bg-superficie">
              <div className="border-b border-[#EFF3F1] bg-[#FBFCFB] px-4.5 py-3">
                <h2 className="text-[13px] font-medium">Cheios ({cheios.length})</h2>
                <p className="pt-0.5 text-[12px] text-tinta-media">
                  Não são resultado de busca. Para abrir vaga, aumente a
                  capacidade do dia na tela do horário — decisão de quem dá a
                  aula, não de quem atende o telefone.
                </p>
              </div>
              <ul aria-label="Horários cheios">
                {cheios.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sessao/${s.id}`}
                      className="flex flex-wrap items-center gap-3.5 border-b border-[#F4F7F5] px-4.5 py-2.5 last:border-b-0 hover:bg-[#FBFCFB]"
                    >
                      <span className="font-mono text-[12.5px] text-tinta-media">
                        {s.data.slice(8)}/{s.data.slice(5, 7)} {s.hora}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {s.servico}
                        {s.profissional ? ` · ${s.profissional}` : ''}
                      </span>
                      <span className="rounded-[8px] bg-alerta-fundo px-2 py-1 font-mono text-[11.5px] text-alerta">
                        {s.ocupacao.ocupadas}/{s.ocupacao.capacidade}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[12px] text-tinta-media">
            Livre e cheio são respostas diferentes, e as duas resolvem: sem
            vaga, a recepção quer ver o quase-cheio.
          </p>
        </div>
      </div>
    </div>
  )
}

function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-media uppercase">
        {rotulo}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Opcao({
  href, ativo, children,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={`inline-flex min-h-9 items-center gap-2 rounded-[11px] border px-3 text-[12.5px] ${
        ativo
          ? 'border-escuro bg-escuro font-medium text-tinta-clara'
          : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-suave'
      }`}
    >
      {children}
    </Link>
  )
}
