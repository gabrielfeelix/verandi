import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { horariosLivres } from '@/server/agenda/disponibilidade'
import { somarDias, diaDaSemanaDe } from '@/core/agenda/datas'
import { hojeEm } from '@/server/agenda/fuso'
import { AvatarProf } from '@/components/hoje/pecas'
import { cartao, Chip, Rotulo, Vazio } from '@/components/ui/pecas'
import type { SessaoResumo } from '@/server/agenda/consultas'

type Busca = Promise<{
  dias?: string
  turno?: string
  servico?: string
  profissional?: string
  local?: string
  lotados?: string
}>

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Uma linha de resultado: livre ou lotada, na mesma lista. */
type Linha = SessaoResumo & { lotada: boolean }

function porDia(linhas: Linha[]) {
  const mapa = new Map<string, Linha[]>()
  for (const s of linhas) mapa.set(s.data, [...(mapa.get(s.data) ?? []), s])
  return [...mapa.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([data, itens]) => [data, itens.sort((a, b) => a.hora.localeCompare(b.hora))] as const)
}

function porExtenso(data: string) {
  return `${DIAS[diaDaSemanaDe(data)]}, ${Number(data.slice(8))} de ${MESES[Number(data.slice(5, 7)) - 1]}`
}

export default async function BuscarVaga({ searchParams }: { searchParams: Busca }) {
  const p = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  /*
   * Sete dias por padrão, e não catorze.
   *
   * "Quando tem horário?" é uma pergunta de balcão, com a pessoa esperando do
   * outro lado: a resposta útil cabe numa tela. Catorze dias faziam uma página
   * de nove mil pixels em que ninguém rolava até o fim.
   */
  const janela = p.dias === '15' ? 15 : 7
  const turno = p.turno === 'manha' || p.turno === 'noite' ? p.turno : null
  const comLotados = p.lotados === 'sim'

  const hoje = hojeEm(conta.fuso)
  const ate = somarDias(hoje, janela - 1)

  const [{ data: servicos }, { data: profissionais }, { data: locais }] = await Promise.all([
    db.from('servico').select('id, nome').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome'),
    db.from('profissional').select('id, nome, cor').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome')
      ,
    db.from('local').select('id, nome').eq('conta_id', conta.contaId)
      .eq('ativo', true).order('nome'),
  ])

  const { livres, cheios } = await horariosLivres(db, conta.contaId, {
    de: hoje, ate, servicoId: p.servico, profissionalId: p.profissional,
  })

  // local e turno o servidor não filtra: são recortes da mesma resposta
  const cabe = (s: SessaoResumo) => {
    if (p.local && s.localId !== p.local) return false
    if (turno === 'manha' && s.hora >= '12:00') return false
    if (turno === 'noite' && s.hora < '18:00') return false
    return true
  }

  const doDia: Linha[] = [
    ...livres.filter(cabe).map((s) => ({ ...s, lotada: false })),
    ...(comLotados ? cheios.filter(cabe).map((s) => ({ ...s, lotada: true })) : []),
  ]

  const nLivres = doDia.filter((s) => !s.lotada).length
  const nLotados = doDia.filter((s) => s.lotada).length
  const vagasTotais = doDia
    .filter((s) => !s.lotada)
    .reduce((n, s) => n + s.ocupacao.livres, 0)

  const q = (extra: Record<string, string | undefined>) => {
    const base: Record<string, string> = {}
    if (p.dias) base.dias = p.dias
    if (turno) base.turno = turno
    if (p.servico) base.servico = p.servico
    if (p.profissional) base.profissional = p.profissional
    if (p.local) base.local = p.local
    if (comLotados) base.lotados = 'sim'
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) delete base[k]
      else base[k] = v
    }
    const busca = new URLSearchParams(base).toString()
    return busca ? `/vaga?${busca}` : '/vaga'
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Buscar vaga
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            &quot;Quando tem horário?&quot;, a mesma resposta que o robô dá pela API
          </p>
        </div>
        <span className="pb-1 text-[12px] text-tinta-fraca">
          {nLivres} {nLivres === 1 ? 'horário' : 'horários'} · {vagasTotais} vagas
          {comLotados ? ` · inclui ${nLotados} lotados` : ''}
        </span>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        <section data-guia="vaga-busca" className={`flex flex-col gap-4 ${cartao} p-4`}>
          <Grupo rotulo={rotulos.servico.singular}>
            <Chip href={q({ servico: undefined })} ativo={!p.servico}>Todos</Chip>
            {(servicos ?? []).map((s) => (
              <Chip
                key={s.id}
                href={q({ servico: p.servico === s.id ? undefined : s.id })}
                ativo={p.servico === s.id}
              >
                {s.nome}
              </Chip>
            ))}
          </Grupo>

          <Grupo rotulo={rotulos.profissional.singular}>
            <Chip href={q({ profissional: undefined })} ativo={!p.profissional}>
              Qualquer
            </Chip>
            {(profissionais ?? []).map((x) => (
              <Chip
                key={x.id}
                href={q({ profissional: p.profissional === x.id ? undefined : x.id })}
                ativo={p.profissional === x.id}
                ponto={x.cor ?? '#8B9691'}
              >
                {x.nome}
              </Chip>
            ))}
          </Grupo>

          {(locais ?? []).length > 1 ? (
            <Grupo rotulo={rotulos.local.plural}>
              <Chip href={q({ local: undefined })} ativo={!p.local}>Todos</Chip>
              {(locais ?? []).map((l) => (
                <Chip
                  key={l.id}
                  href={q({ local: p.local === l.id ? undefined : l.id })}
                  ativo={p.local === l.id}
                >
                  {l.nome}
                </Chip>
              ))}
            </Grupo>
          ) : null}

          <Grupo rotulo="Faixa de dias">
            <Chip href={q({ dias: undefined })} ativo={janela === 7}>Próximos 7 dias</Chip>
            <Chip href={q({ dias: '15' })} ativo={janela === 15}>Próximos 15</Chip>
            <Chip href={q({ turno: turno === 'manha' ? undefined : 'manha' })} ativo={turno === 'manha'}>
              Manhã
            </Chip>
            <Chip href={q({ turno: turno === 'noite' ? undefined : 'noite' })} ativo={turno === 'noite'}>
              Noite
            </Chip>
          </Grupo>

          {/*
           * O lotado não some da busca: ele entra na mesma lista, marcado, com
           * "Encaixar" no lugar de "Marcar". Numa lista à parte lá embaixo,
           * ninguém rolava — e a recepção prometia vaga sem ver o quase-cheio.
           */}
          <Link
            href={q({ lotados: comLotados ? undefined : 'sim' })}
            aria-pressed={comLotados}
            className="flex items-center justify-between gap-3 rounded-media border border-linha-suave bg-superficie-suave px-3 py-3 transition-colors duration-150 hover:bg-superficie-mais-suave"
          >
            <span className="flex flex-col leading-[1.35]">
              <span className="text-[13px] font-medium">Incluir lotados</span>
              <span className="text-[11.5px] text-tinta-fraca">para encaixe</span>
            </span>
            <span
              aria-hidden
              className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-200 ${
                comLotados ? 'bg-marca' : 'bg-linha-tracejada'
              }`}
            >
              <span
                className="absolute top-[3px] size-5 rounded-full bg-superficie shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200"
                style={{ left: comLotados ? 21 : 3 }}
              />
            </span>
          </Link>
        </section>

        <div className="flex min-w-0 flex-col gap-3.5">
          {doDia.length === 0 ? (
            <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie">
              <Vazio
                icone="vaga"
                titulo="Nenhum horário livre neste período"
                texto={
                  comLotados
                    ? 'Com esses filtros não sobra nada, nem lotado. Amplie a faixa de dias ou tire um filtro.'
                    : 'Com esses filtros não sobra vaga. Ligue "incluir lotados" para ver o quase-cheio, amplie a faixa de dias, ou tire um filtro.'
                }
              />
            </section>
          ) : (
            porDia(doDia).map(([data, itens]) => {
              const livresNoDia = itens.filter((s) => !s.lotada).length
              const lotadosNoDia = itens.length - livresNoDia
              return (
                <section key={data} className={`overflow-hidden ${cartao}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha-fina bg-superficie-tenue px-[18px] py-3">
                    <h2 className="font-titulo text-[13.5px] font-semibold">
                      {porExtenso(data)}
                    </h2>
                    <span className="text-[12px] text-tinta-fraca">
                      {livresNoDia} {livresNoDia === 1 ? 'livre' : 'livres'}
                      {lotadosNoDia > 0
                        ? ` · ${lotadosNoDia} ${lotadosNoDia === 1 ? 'lotado' : 'lotados'}`
                        : ''}
                    </span>
                  </div>

                  <ul aria-label={`Horários em ${data}`}>
                    {itens.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/sessao/${s.id}#encaixar`}
                          className={`grid grid-cols-[74px_30px_minmax(0,1fr)_auto_auto] items-center gap-3.5 border-b border-linha-fina px-[18px] py-3 last:border-b-0 transition-colors duration-150 ${
                            s.lotada
                              ? 'bg-alerta-superficie hover:bg-alerta-fundo'
                              : 'hover:bg-superficie-tenue'
                          }`}
                        >
                          <span className="font-mono text-[15px]">{s.hora}</span>
                          <span>
                            {s.profissional ? (
                              <AvatarProf
                                nome={s.profissional}
                                cor={s.corProfissional}
                                tamanho={28}
                              />
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-col leading-[1.35]">
                            <span className="truncate text-[14px] font-medium">
                              {s.servico}
                            </span>
                            <span className="truncate text-[12px] text-tinta-fraca">
                              {[s.profissional, s.local].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span
                            className={`rounded-peca px-2.5 py-1 font-mono text-[12px] ${
                              s.lotada
                                ? 'bg-alerta-fundo text-alerta'
                                : 'bg-positivo-fundo text-positivo'
                            }`}
                          >
                            {s.lotada
                              ? `${s.ocupacao.ocupadas}/${s.ocupacao.capacidade} lotada`
                              : `${s.ocupacao.livres} vaga(s)`}
                          </span>
                          <span
                            className={`rounded-peca px-3.5 py-2 text-[12.5px] font-medium whitespace-nowrap ${
                              s.lotada
                                ? 'border border-alerta-linha bg-superficie text-alerta'
                                : 'bg-escuro text-tinta-clara'
                            }`}
                          >
                            {s.lotada ? 'Encaixar' : 'Marcar'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}

          <p className="text-[12px] text-tinta-fraca">
            Livre e lotado são respostas diferentes, e as duas resolvem: sem
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
      <Rotulo>{rotulo}</Rotulo>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
