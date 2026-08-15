import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo, type SessaoResumo } from '@/server/agenda/consultas'
import { listarPendencias } from '@/server/pendencias/consultas'
import { somarDias } from '@/core/agenda/datas'
import { agoraMs, hojeEm, horaEm, quantoFalta } from '@/server/agenda/fuso'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { Abas } from '@/components/ui/abas'
import { Icone } from '@/components/ui/icones'
import { NavegadorPeriodo } from '@/components/ui/navegador-periodo'
import { ProximaTurma } from '@/components/hoje/proxima-turma'
import {
  Bloco, CartaoNumero, FaixaPeriodo, LinhaAgenda, AvatarProf,
} from '@/components/hoje/pecas'
import { cartao } from '@/components/ui/pecas'

type Busca = Promise<{ dia?: string; todos?: string }>

/** Manhã até 12h, tarde até 18h, noite depois — a divisão que o protótipo usa. */
function periodoDe(hora: string) {
  const h = Number(hora.slice(0, 2))
  return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite'
}

/**
 * Cada grupo de pendência tem a sua tinta: chamada não feita é alerta, crédito
 * de reposição é atenção, reserva é informação, cadastro incompleto é neutro.
 * Quatro números laranja lado a lado não hierarquizam nada.
 */
const TINTA_PENDENCIA: Record<string, string> = {
  chamada_nao_feita: 'bg-alerta-fundo text-alerta',
  reposicao_aberta: 'bg-atencao-fundo text-atencao',
  reserva_esperando: 'bg-info-fundo text-info',
  cadastro_incompleto: 'bg-neutro-fundo text-neutro',
}

function saudacao(hora: number) {
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
}

/** "Quarta, 12 de agosto" — sem o ano, que quem opera já sabe. */
function dataLonga(dia: string, fuso: string) {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: fuso,
  }).format(new Date(`${dia}T12:00:00Z`))
  const [semana, resto] = texto.split(', ')
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${resto}`
}

export default async function Hoje({ searchParams }: { searchParams: Busca }) {
  const { dia: diaParam, todos } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const fuso = conta.fuso
  const hoje = hojeEm(fuso)
  const dia = diaParam ?? hoje
  const ehHoje = dia === hoje

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const { data: { user } } = await db.auth.getUser()
  const { data: eu } = await db
    .from('profissional').select('id, nome')
    .eq('conta_id', conta.contaId)
    .eq('usuario_id', user?.id ?? '')
    .maybeSingle()

  const podeVerTodos = conta.papel !== 'profissional'
  const verTodos = podeVerTodos && todos === '1'
  const filtro = !verTodos && eu ? { profissionalId: eu.id } : {}

  const sessoes = await sessoesDoIntervalo(db, conta.contaId, dia, dia, filtro)

  // as pendências só existem para quem opera; o profissional não dispensa nada
  const grupos = podeVerTodos
    ? await listarPendencias(db, conta.contaId, conta.fuso)
    : []

  const agora = agoraMs()
  const passou = (s: SessaoResumo) =>
    new Date(s.inicio).getTime() + s.duracaoMin * 60000 < agora

  const vivas = sessoes.filter((s) => s.status !== 'cancelada')
  const proxima = ehHoje
    ? vivas.find((s) => !passou(s) && s.chamada !== 'sem_ninguem') ??
      vivas.find((s) => !passou(s))
    : undefined

  const pendentes = sessoes.filter(
    (s) => passou(s) && s.chamada === 'pendente' && s.status !== 'cancelada',
  ).length
  const presencas = sessoes.reduce(
    (n, s) => n + s.pessoas.filter((p) => p.status === 'presente').length,
    0,
  )
  const reposicoes = grupos.find((g) => g.tipo === 'reposicao_aberta')?.itens ?? []
  const maisAntiga = reposicoes.reduce(
    (n, r) => Math.max(n, r.diasEmAberto ?? 0), 0,
  )
  const ultima = vivas.at(-1)

  // uma coluna por profissional que atende hoje, para a carga do dia
  const carga = new Map<string, { nome: string; cor: string | null; n: number }>()
  for (const s of vivas) {
    if (!s.profissional) continue
    const atual = carga.get(s.profissional)
    carga.set(s.profissional, {
      nome: s.profissional,
      cor: s.corProfissional,
      n: (atual?.n ?? 0) + 1,
    })
  }
  const profs = [...carga.values()].sort((a, b) => b.n - a.n)
  const maiorCarga = profs[0]?.n ?? 1

  const link = (d: string, t = verTodos) => `/hoje?dia=${d}${t ? '&todos=1' : ''}`

  const horaLocal = horaEm(fuso, agora)

  const porPeriodo = ['Manhã', 'Tarde', 'Noite']
    .map((p) => ({ periodo: p, itens: sessoes.filter((s) => periodoDe(s.hora) === p) }))
    .filter((g) => g.itens.length > 0)

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4.5">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
              {ehHoje
                ? `${saudacao(horaLocal)}, ${primeiro(eu?.nome ?? user?.email ?? '')}`
                : dataLonga(dia, fuso)}
            </h1>
            <p className="pt-[3px] text-[13.5px] text-tinta-media">
              {dataLonga(dia, fuso)} · {conta.nome}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* A busca global do protótipo ainda não existe no sistema. O espaço
                fica reservado, desabilitado e dizendo o porquê, inventar a
                funcionalidade aqui seria pior do que deixá-la faltando. */}
            <span
              title="A busca geral entra no próximo marco"
              className="hidden min-w-[210px] items-center gap-2 rounded-padrao border border-linha bg-superficie px-3.5 py-2.5 text-[13px] text-tinta-fraca lg:flex"
            >
              <span aria-hidden className="font-mono">/</span>
              Buscar {rotulos.pessoa.singular.toLowerCase()} ou horário
            </span>

            <NavegadorPeriodo
              antes={{ href: link(somarDias(dia, -1)), rotulo: 'Dia anterior' }}
              meio={{
                href: link(hoje),
                texto: ehHoje ? 'Hoje' : dia.slice(8) + '/' + dia.slice(5, 7),
              }}
              depois={{ href: link(somarDias(dia, 1)), rotulo: 'Próximo dia' }}
            />

            {podeVerTodos ? (
              <Abas
                rotuloDoGrupo="De quem é a agenda"
                ativo={verTodos ? 'todos' : 'minha'}
                itens={[
                  { id: 'minha', rotulo: 'Minha agenda', href: link(dia, false) },
                  { id: 'todos', rotulo: 'Todos', href: link(dia, true) },
                ]}
              />
            ) : null}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CartaoNumero
            rotulo={`${rotulos.sessao.plural} hoje`}
            valor={vivas.length}
            sub={ultima ? `até ${ultima.hora}` : 'nada marcado'}
            glifo="≡"
          />
          <CartaoNumero
            rotulo="Chamadas pendentes"
            valor={pendentes}
            sub="de turmas passadas"
            glifo="!"
            tom={pendentes > 0 ? 'alerta' : 'neutro'}
          />
          <CartaoNumero
            rotulo="Presenças"
            valor={presencas}
            sub="registradas no dia"
            glifo="✓"
            tom={presencas > 0 ? 'positivo' : 'neutro'}
          />
          <CartaoNumero
            rotulo="Reposições em aberto"
            valor={reposicoes.length}
            sub={maisAntiga ? `mais antiga: ${maisAntiga} dias` : 'nenhuma esperando'}
            glifo="↺"
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_316px]">
          <div className="flex flex-col gap-3.5">
            {proxima ? (
              <div data-guia="hoje-proxima">
                <ProximaTurma
                  sessao={proxima}
                  rotulo={rotulos.sessao.singular}
                  rotuloPessoa={rotulos.pessoa.singular}
                  faltam={quantoFalta(proxima.inicio, agora)}
                  podeRegistrar={conta.papel !== 'suporte'}
                />
              </div>
            ) : null}

            {!proxima && sessoes.length > 0 ? (
              <section className={`flex flex-wrap items-center gap-x-5.5 gap-y-3.5 ${cartao} px-5 py-4.5`}>
                <div className="flex flex-col gap-[3px]">
                  <span className="text-[10.5px] font-semibold tracking-[.12em] text-tinta-media uppercase">
                    {ehHoje ? 'Dia encerrado' : 'Dia fechado'}
                  </span>
                  <span className="font-titulo text-[20px] font-semibold tracking-[-.01em]">
                    {dataLonga(dia, fuso)}
                  </span>
                </div>
                <span aria-hidden className="w-px self-stretch bg-linha-fina" />
                {[
                  { n: vivas.length, rotulo: rotulos.sessao.plural.toLowerCase(), cor: 'text-tinta' },
                  { n: presencas, rotulo: 'presenças', cor: 'text-positivo' },
                  { n: pendentes, rotulo: 'chamadas pendentes', cor: pendentes ? 'text-alerta' : 'text-tinta' },
                ].map((r) => (
                  <div key={r.rotulo} className="flex flex-col gap-0.5">
                    <span className={`font-titulo text-[24px] leading-none font-semibold ${r.cor}`}>
                      {r.n}
                    </span>
                    <span className="text-[11.5px] text-tinta-media">{r.rotulo}</span>
                  </div>
                ))}
                {!ehHoje ? (
                  <Link
                    href={link(hoje)}
                    className="ml-auto rounded-padrao border border-linha bg-superficie-suave px-4 py-2.5 text-[13px] hover:bg-[#EDF3F0]"
                  >
                    Voltar para hoje
                  </Link>
                ) : null}
              </section>
            ) : null}

            {sessoes.length === 0 ? (
              <section className="flex flex-col items-center gap-2.5 rounded-cartao border border-dashed border-linha-tracejada bg-superficie px-6 py-8.5 text-center">
                <span
                  aria-hidden
                  className="flex size-11 items-center justify-center rounded-media bg-superficie-mais-suave font-mono text-[17px] text-tinta-media"
                >
                  ◷
                </span>
                <span className="font-titulo text-[18px] font-semibold">
                  Nada marcado neste dia
                </span>
                <span className="max-w-[340px] text-[13px] leading-relaxed text-tinta-media">
                  Pode ser domingo, feriado ou dia fechado na configuração de
                  funcionamento. Não é falha de carregamento.
                </span>
                <div className="flex gap-2 pt-1.5">
                  <Link
                    href="/semana"
                    className="rounded-padrao border border-linha bg-superficie-suave px-4 py-2.5 text-[13px] hover:bg-[#EDF3F0]"
                  >
                    Ver a semana
                  </Link>
                  {!ehHoje ? (
                    <Link
                      href={link(hoje)}
                      className="rounded-padrao bg-escuro px-4 py-2.5 text-[13px] font-medium text-tinta-clara hover:bg-escuro-hover"
                    >
                      Voltar para hoje
                    </Link>
                  ) : null}
                </div>
              </section>
            ) : (
              <section className={`flex flex-col ${cartao} px-2 pt-1.5 pb-2.5`}>
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <h2 className="font-titulo text-[17px] font-semibold">Agenda do dia</h2>
                  <span className="text-[12px] text-tinta-media">
                    {vivas.length} {rotulos.sessao.plural.toLowerCase()} ·{' '}
                    {pendentes} chamada(s) pendente(s)
                  </span>
                </div>

                <div className="flex flex-col" aria-label={rotulos.sessao.plural}>
                  {porPeriodo.map((g) => (
                    <div key={g.periodo}>
                      <FaixaPeriodo
                        titulo={g.periodo}
                        n={g.itens.length}
                        rotulo={rotulos.sessao}
                      />
                      {g.itens.map((s) => (
                        <LinhaAgenda
                          key={s.id}
                          sessao={s}
                          passou={passou(s)}
                          agora={s.id === proxima?.id}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            {podeVerTodos ? (
              <Bloco
                titulo="Pendências"
                acao={
                  <Link href="/pendencias" className="text-[12px] font-medium text-marca">
                    Ver tudo
                  </Link>
                }
              >
                <div className="flex flex-col gap-2">
                  {grupos.filter((g) => g.itens.length > 0).slice(0, 4).map((g) => (
                    <Link
                      key={g.tipo}
                      href="/pendencias"
                      className="flex items-center gap-3 rounded-media bg-superficie-suave px-3 py-2.5 hover:bg-[#EDF3F0]"
                    >
                      <span
                        className={`flex size-7.5 items-center justify-center rounded-peca text-[13px] font-semibold ${TINTA_PENDENCIA[g.tipo] ?? 'bg-neutro-fundo text-neutro'}`}
                      >
                        {g.itens.length}
                      </span>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="text-[13px] font-medium">{g.titulo}</span>
                        <span className="truncate text-[11.5px] text-tinta-media">
                          {g.itens[0]?.detalhe ?? g.sub}
                        </span>
                      </span>
                      <span aria-hidden className="ml-auto font-mono text-[13px] text-[#A9B3AE]">
                        ›
                      </span>
                    </Link>
                  ))}
                  {grupos.every((g) => g.itens.length === 0) ? (
                    <p className="px-1 py-2 text-[12.5px] text-tinta-media">
                      Nada esperando por você.
                    </p>
                  ) : null}
                </div>
              </Bloco>
            ) : null}

            <Bloco titulo={`${rotulos.profissional.plural} hoje`}>
              <div className="flex flex-col gap-3">
                {profs.map((p) => (
                  <div key={p.nome} className="flex items-center gap-2.5">
                    <AvatarProf nome={p.nome} cor={p.cor} tamanho={30} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="truncate text-[13px] font-medium">{p.nome}</span>
                      <span className="block h-[5px] overflow-hidden rounded-[3px] bg-neutro-fundo">
                        <span
                          className="block h-[5px] rounded-[3px]"
                          style={{
                            width: `${Math.round((p.n / maiorCarga) * 100)}%`,
                            background: p.cor ?? '#0E7C6B',
                          }}
                        />
                      </span>
                    </div>
                    <span className="font-mono text-[11.5px] text-tinta-media">
                      {p.n}{' '}
                      {(p.n === 1 ? rotulos.sessao.singular : rotulos.sessao.plural).toLowerCase()}
                    </span>
                  </div>
                ))}
                {profs.length === 0 ? (
                  <p className="text-[12.5px] text-tinta-media">
                    Ninguém da equipe tem {rotulos.sessao.singular.toLowerCase()}
                    {' '}neste dia.
                  </p>
                ) : null}
              </div>
            </Bloco>

            <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie-suave p-4">
              <p className="text-[12.5px] leading-relaxed text-tinta-media">
                Lotação cheia não é bloqueio:{' '}
                <strong className="font-semibold text-tinta">5/4</strong> aparece em
                laranja e o encaixe segue permitido, quem decide é quem está na
                recepção, com nome e registro.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ProvedorDeAviso>
  )
}

function primeiro(nome: string) {
  return (nome.split('@')[0] ?? nome).trim().split(/\s+/)[0] ?? nome
}
