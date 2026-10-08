import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo, type SessaoResumo } from '@/server/agenda/consultas'
import { listarPendencias, type GrupoPendencia } from '@/server/pendencias/consultas'
import { somarDias } from '@/core/agenda/datas'
import { agoraMs, hojeEm, horaEm, quantoFalta } from '@/server/agenda/fuso'
import { BuscaRapida } from '@/components/hoje/busca-rapida'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { Abas } from '@/components/ui/abas'
import { NavegadorPeriodo } from '@/components/ui/navegador-periodo'
import { ProximaTurma } from '@/components/hoje/proxima-turma'
import { Bloco, FaixaPeriodo, LinhaAgenda } from '@/components/hoje/pecas'
import { AvisoDeAcesso } from '@/components/ui/aviso-de-acesso'
import { Chip, cartao } from '@/components/ui/pecas'
import { Saudacao } from '@/components/hoje/saudacao'
import { TINTA_GRUPO } from '@/components/pendencias/tintas'
import { caixaDoMes } from '@/server/financeiro/consultas'
import { variacao } from '@/core/financeiro/metricas'
import { emReais } from '@/core/planos/plano'
import { AreaQueTroca } from '@/components/ui/troca'
import Carregando from './loading'
import { TituloDaTela } from '@/components/ui/titulo-da-tela'

type Busca = Promise<{
  dia?: string; todos?: string; prof?: string; restrita?: string
}>

/** Manhã até 12h, tarde até 18h, noite depois, a divisão que o protótipo usa. */
function periodoDe(hora: string) {
  const h = Number(hora.slice(0, 2))
  return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite'
}

/*
 * A licença que pede ligação hoje sobe para o topo do cartão. É o lembrete que
 * o estúdio pediu: a data de volta chega e o nome aparece na primeira tela do
 * dia, sem depender de alguém lembrar de abrir Pendências.
 */
const pedeLigacao = (g: GrupoPendencia) =>
  g.tipo === 'licenca' && g.itens.some((p) => p.etiqueta?.tinta === 'alerta' || p.etiqueta?.tinta === 'atencao')

function saudacao(hora: number) {
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
}

/** "Quarta, 12 de agosto", sem o ano, que quem opera já sabe. */
function dataLonga(dia: string, fuso: string) {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: fuso,
  }).format(new Date(`${dia}T12:00:00Z`))
  const [semana, resto] = texto.split(', ')
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${resto}`
}

export default async function Hoje({ searchParams }: { searchParams: Busca }) {
  const { dia: diaParam, todos, prof, restrita } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const fuso = conta.fuso
  const hoje = hojeEm(fuso)
  const dia = diaParam ?? hoje
  const ehHoje = dia === hoje

  const podeVerTodos = conta.papel !== 'profissional'

  /*
   * Tudo de uma vez, e só as sessões esperam por "quem sou eu" (o filtro do
   * professor). Em fila, eram oito idas ao banco a cada troca de dia.
   */
  const euP = (async () => {
    const { data: { user } } = await db.auth.getUser()
    const { data } = await db
      .from('profissional').select('id, nome')
      .eq('conta_id', conta.contaId)
      .eq('usuario_id', user?.id ?? '')
      .maybeSingle()
    return data
  })()
  // quem não dá aula não tem "minha agenda": abria nela vendo a de todos, com
  // a aba errada acesa. Sem cadastro de profissional, é sempre "Todos"
  const verTodosP = euP.then((eu) => podeVerTodos && (todos === '1' || !eu))
  const sessoesP = Promise.all([euP, verTodosP]).then(([eu, verTodos]) =>
    sessoesDoIntervalo(db, conta.contaId, dia, dia,
      !verTodos && eu ? { profissionalId: eu.id } : {}, fuso))

  const [vocabulario, eu, verTodos, sessoes, grupos, caixa] = await Promise.all([
    carregarVocabulario(db, conta.contaId),
    euP,
    verTodosP,
    sessoesP,
    // as pendências só existem para quem opera; o profissional não dispensa nada
    podeVerTodos ? listarPendencias(db, conta.contaId, conta.fuso) : Promise.resolve([]),
    podeVerTodos ? caixaDoMes(db, conta.contaId, hoje) : Promise.resolve(null),
  ])
  const rotulos = resolverRotulos(vocabulario)

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
  // quem atende hoje, para o filtro por profissional da agenda do dia
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

  const link = (d: string, t = verTodos) => `/hoje?dia=${d}${t ? '&todos=1' : ''}`

  const horaLocal = horaEm(fuso, agora)

  /*
   * O recorte rápido da agenda: período e profissional.
   *
   * Uma agenda de quinze aulas cabe na tela e mesmo assim ninguém a lê inteira:
   * quem abre às oito quer a manhã, e quem cobre a Nathália quer a Nathália.
   * O recorte vale **só para a lista**: a próxima turma e os números do dia
   * continuam falando do dia inteiro, porque "quem entra na sala agora" não
   * muda por causa de um filtro.
   */
  const PERIODOS = ['Manhã', 'Tarde', 'Noite'] as const
  const profFiltro = prof && vivas.some((s) => s.profissional === prof) ? prof : null

  const daAgenda = sessoes.filter((s) => !profFiltro || s.profissional === profFiltro)

  const porPeriodo = PERIODOS
    .map((p) => ({ periodo: p, itens: daAgenda.filter((s) => periodoDe(s.hora) === p) }))
    .filter((g) => g.itens.length > 0)

  const recorte = (mudanca: Record<string, string | null>) => {
    const b = new URLSearchParams()
    if (dia !== hoje) b.set('dia', dia)
    if (verTodos) b.set('todos', '1')
    const atual: Record<string, string | null> = { prof: profFiltro, ...mudanca }
    for (const [k, v] of Object.entries(atual)) if (v) b.set(k, v)
    const q = b.toString()
    return q ? `/hoje?${q}` : '/hoje'
  }

  /*
   * A tela tem uma ordem só, igual para todo mundo: a próxima turma, a agenda
   * do dia, o que espera decisão e o caixa. Até 06/out cada pessoa podia
   * arrumar os blocos; ninguém arrumava, e o painel de arrumar era mais uma
   * coisa a entender na tela que mais se abre.
   */
  const variou = caixa ? variacao(caixa.recebidoCent, caixa.recebidoAntesCent) : null

  /*
   * Cada bloco é montado uma vez, num objeto, e a ordem quem dá é o arranjo.
   *
   * Montar aqui e escolher depois é o que permite a mesma tela sair em ordens
   * diferentes para duas pessoas sem duplicar o desenho de nada. O que não está
   * no arranjo simplesmente não é lido do objeto, e o custo dele é o de
   * construir JSX que ninguém renderiza.
   */
  const PRINCIPAL: Record<string, React.ReactNode> = {

    proxima: (
      <div key="proxima" className="contents">
        {proxima ? (
          <div data-guia="hoje-proxima">
            <ProximaTurma
              sessao={proxima}
              rotulo={rotulos.sessao.singular}
              rotuloPessoa={rotulos.pessoa.singular}
              faltam={quantoFalta(proxima.inicio, agora, fuso)}
              podeRegistrar
            />
          </div>
        ) : null}

        {!proxima && sessoes.length > 0 && dia <= hoje ? (
          <section className={`flex flex-wrap items-center gap-x-5.5 gap-y-3.5 ${cartao} px-5 py-4.5`}>
            <div className="flex flex-col gap-[3px]">
              <span className="text-[12px] font-semibold text-tinta-media">
                {ehHoje ? 'Dia encerrado' : 'Resumo do dia'}
              </span>
              <span className="font-titulo text-[18px] font-semibold tracking-[-.01em]">
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
                <span className="text-[12px] text-tinta-media">{r.rotulo}</span>
              </div>
            ))}
            {!ehHoje ? (
              <Link
                href={link(hoje)}
                className="ml-auto rounded-padrao border border-linha bg-superficie px-4 py-2.5 text-[14.5px] font-medium hover:bg-superficie-mais-suave"
              >
                Voltar para hoje
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
    ),

    agenda: sessoes.length === 0 ? (
      <section key="agenda" className="flex flex-col items-center gap-2.5 rounded-cartao border border-dashed border-linha-tracejada bg-superficie px-6 py-8.5 text-center">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-media bg-superficie-mais-suave text-[18px] text-tinta-media"
        >
          ◷
        </span>
        <span className="font-titulo text-[18px] font-semibold">
          Nada marcado neste dia
        </span>
        <div className="flex flex-wrap justify-center gap-2 pt-1.5">
          {podeVerTodos ? (
            <Link
              href="/semana"
              className="rounded-padrao border border-linha bg-superficie px-4 py-2.5 text-[14.5px] font-medium hover:bg-superficie-mais-suave"
            >
              Ver a semana
            </Link>
          ) : null}
          {!ehHoje ? (
            <Link
              href={link(hoje)}
              className="rounded-padrao bg-escuro px-4 py-2.5 text-[14.5px] font-medium text-tinta-clara hover:bg-escuro-hover"
            >
              Voltar para hoje
            </Link>
          ) : null}
        </div>
      </section>
    ) : (
      <section key="agenda" className={`flex flex-col ${cartao} px-2 pt-1.5 pb-2.5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 pt-3 pb-2">
          <h2 className="font-titulo text-[18px] font-semibold">Agenda do dia</h2>
          <span className="text-[13.5px] text-tinta-media">
            {profFiltro
              ? `${daAgenda.length} de ${sessoes.length} ${rotulos.sessao.plural.toLowerCase()}`
              // "0 chamadas pendentes" ao lado de "3 chamadas não feitas" em
              // Pendências parecia contradição: aqui só aparece quando há
              : `${vivas.length} ${rotulos.sessao.plural.toLowerCase()}${pendentes
                ? ` · ${pendentes} ${pendentes === 1 ? 'chamada pendente' : 'chamadas pendentes'}`
                : ''}`}
          </span>
        </div>

        {/*
          * O recorte rápido, dentro do bloco que ele recorta.
          *
          * Período e profissional são as duas perguntas que se faz olhando para
          * a lista: quem abre às oito quer a manhã, e quem está cobrindo a
          * colega quer só as aulas dela. Um período sem aula nenhuma aparece
          * desligado em vez de sumir: some quer dizer "não existe", e desligado
          * quer dizer "hoje não tem", que são coisas diferentes para quem monta
          * a grade.
          */}
        {profs.length > 1 ? (
          <div
            data-imprimir="fora"
            aria-label={`Filtrar por ${rotulos.profissional.singular.toLowerCase()}`}
            className="flex items-center gap-1.5 overflow-x-auto border-b border-linha-fina px-3 pt-1 pb-3 [scrollbar-width:none] *:shrink-0"
          >
            <Chip href={recorte({ prof: null })} ativo={!profFiltro}>
              Todos
            </Chip>
            {profs.map((p) => (
              <Chip
                key={p.nome}
                href={recorte({ prof: p.nome })}
                ativo={profFiltro === p.nome}
                ponto={p.cor ?? undefined}
              >
                {p.nome.split(' ')[0]}
              </Chip>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col" aria-label={rotulos.sessao.plural}>
          {porPeriodo.map((g) => (
            <div key={g.periodo}>
              <FaixaPeriodo titulo={g.periodo} />
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

          {porPeriodo.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-3 py-6 text-[13.5px] text-tinta-media">
              Nada neste filtro.
              <Link
                href={recorte({ prof: null })}
                className="rounded-padrao border border-linha bg-superficie px-4 py-2 text-[13.5px] font-medium text-tinta hover:bg-superficie-mais-suave"
              >
                Ver o dia todo
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    ),
  }

  const LATERAL: Record<string, React.ReactNode> = {
    pendencias: (
      <Bloco
        key="pendencias"
        titulo="Pendências"
        acao={
          <Link href="/pendencias" className="text-[13.5px] font-medium text-marca hover:underline">
            Ver tudo
          </Link>
        }
      >
        <div className="flex flex-col gap-2">
          {grupos.filter((g) => g.itens.length > 0)
            .sort((a, b) => Number(pedeLigacao(b)) - Number(pedeLigacao(a)))
            .slice(0, 5).map((g) => (
            <Link
              key={g.tipo}
              href="/pendencias"
              className="flex items-center gap-3 rounded-media bg-superficie-suave px-3 py-2.5 hover:bg-[#EDF3F0]"
            >
              <span
                className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-peca px-2 text-[13.5px] font-semibold tabular-nums ${TINTA_GRUPO[g.tipo] ?? 'bg-solido-neutro text-white'}`}
              >
                {g.itens.length > 99 ? '99+' : g.itens.length}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[14.5px] font-medium">{g.titulo}</span>
                <span className="line-clamp-2 text-[12px] text-tinta-media">
                  {g.tipo === 'licenca' && g.itens[0]
                    ? `${g.itens[0].titulo} · ${g.itens[0].etiqueta?.texto ?? ''}`
                    : g.itens[0]?.detalhe ?? g.sub}
                </span>
              </span>
              <span aria-hidden className="ml-auto text-[14.5px] text-[#A9B3AE]">
                ›
              </span>
            </Link>
          ))}
          {grupos.every((g) => g.itens.length === 0) ? (
            <p className="px-1 py-2 text-[13.5px] text-tinta-media">
              Nenhuma pendência.
            </p>
          ) : null}
        </div>
      </Bloco>
    ),


    /*
     * O caixa, na coluna estreita e depois da equipe.
     *
     * Ele nasceu na coluna larga e ali disputava a atenção com o que a tela
     * existe para responder: quem entra na sala agora. Dinheiro na tela inicial
     * serve para dar o pulso do mês de relance, e o pulso cabe num cartão ao
     * lado; quem quiser detalhe abre o Financeiro, que é onde ele mora.
     */
    caixa: caixa ? (
      <Bloco
        key="caixa"
        titulo="Caixa do mês"
        acao={
          <Link href="/financeiro" className="text-[13.5px] font-medium text-marca hover:underline">
            Ver tudo
          </Link>
        }
      >
        <div className="flex flex-col gap-2.5">
          <Link
            href="/financeiro?aba=pagas"
            className="flex items-baseline justify-between gap-3 rounded-media px-1 py-0.5 hover:bg-superficie-mais-suave"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-medium">Entrou</span>
              {/*
                * A comparação é com o **mesmo trecho** do mês passado.
                *
                * No dia 5, comparar cinco dias com um mês inteiro diria que o
                * faturamento caiu 80%, e número que mente é pior que número que
                * falta. Sem mês anterior, a linha some: sair de zero para
                * quatro mil não é aumento infinito, é o primeiro mês.
                */}
              {variou === null ? null : (
                <span className="text-[12px] text-tinta-media">
                  {`${variou >= 0 ? '+' : ''}${variou}% em relação ao mesmo período do mês anterior`}
                </span>
              )}
            </span>
            <span className="shrink-0 text-[14.5px] font-semibold text-positivo tabular-nums">
              {emReais(caixa.recebidoCent)}
            </span>
          </Link>

          <Link
            href="/financeiro?aba=a_vencer"
            className="flex items-baseline justify-between gap-3 rounded-media px-1 py-0.5 hover:bg-superficie-mais-suave"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-medium">Ainda vence</span>
              <span className="text-[12px] text-tinta-media">neste mês</span>
            </span>
            <span className="shrink-0 text-[14.5px] font-semibold tabular-nums">
              {emReais(caixa.aVencerCent)}
            </span>
          </Link>

          <Link
            href="/financeiro?aba=atrasadas"
            className="flex items-baseline justify-between gap-3 rounded-media px-1 py-0.5 hover:bg-superficie-mais-suave"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-medium">Em atraso</span>
              <span className="text-[12px] text-tinta-media">
                {caixa.atrasadas === 0
                  ? 'nada vencido'
                  : `${caixa.atrasadas} ${caixa.atrasadas === 1 ? 'cobrança vencida' : 'cobranças vencidas'}`}
              </span>
            </span>
            <span
              className={`shrink-0 text-[14.5px] font-semibold tabular-nums ${caixa.atrasadas ? 'text-alerta' : ''}`}
            >
              {emReais(caixa.atrasadoCent)}
            </span>
          </Link>
        </div>
      </Bloco>
    ) : null,
  }

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <ProvedorDeAviso>
      {restrita ? <AvisoDeAcesso tela={restrita.slice(0, 40)} /> : null}
      <div className="flex flex-col gap-4.5">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <TituloDaTela tela="hoje">
              {ehHoje
                ? (
                  <Saudacao
                    saudacao={saudacao(horaLocal)}
                    nome={eu?.nome ?? conta.meuNome}
                    podeNomear={!eu}
                  />
                )
                : dataLonga(dia, fuso)}
            </TituloDaTela>
            <p className="pt-[3px] text-[14.5px] text-tinta-media">
              {/* a conta já está no rail (e no topo, no celular): repetir aqui
                  era a terceira vez na mesma dobra */}
              {dataLonga(dia, fuso)}
            </p>
          </div>

          {/* quebra no celular: sino, dia, abas e arrumar somam 482px numa
              linha só, e a tela de 390 rolava de lado */}
          <div className="flex flex-wrap items-center gap-2.5">
            <BuscaRapida rotuloPessoa={rotulos.pessoa.singular} />

            {/* o sino foi para o cabeçalho fixo, que aparece em toda tela */}

            <NavegadorPeriodo
              antes={{ href: link(somarDias(dia, -1)), rotulo: 'Dia anterior' }}
              meio={{
                href: link(hoje),
                texto: ehHoje ? 'Hoje' : dia.slice(8) + '/' + dia.slice(5, 7),
              }}
              depois={{ href: link(somarDias(dia, 1)), rotulo: 'Próximo dia' }}
            />

            {podeVerTodos && eu ? (
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

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_316px]">
          <div className="flex min-w-0 flex-col gap-3.5">
            {PRINCIPAL.proxima}
            {PRINCIPAL.agenda}
          </div>

          <div className="flex min-w-0 flex-col gap-3.5">
            {LATERAL.pendencias}
            {LATERAL.caixa}
          </div>
        </div>
      </div>
    </ProvedorDeAviso>
    </AreaQueTroca>
  )
}
