import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo, type SessaoResumo } from '@/server/agenda/consultas'
import { listarPendencias } from '@/server/pendencias/consultas'
import { somarDias } from '@/core/agenda/datas'
import { agoraMs, hojeEm, horaEm, quantoFalta } from '@/server/agenda/fuso'
import { BuscaRapida } from '@/components/hoje/busca-rapida'
import { Sino } from '@/components/ui/sino'
import { notificacoesDaConta } from '@/server/notificacoes'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { Abas } from '@/components/ui/abas'
import { Icone } from '@/components/ui/icones'
import { NavegadorPeriodo } from '@/components/ui/navegador-periodo'
import { ProximaTurma } from '@/components/hoje/proxima-turma'
import {
  Bloco, CartaoNumero, FaixaPeriodo, LinhaAgenda, AvatarProf,
} from '@/components/hoje/pecas'
import { cartao } from '@/components/ui/pecas'
import { ArrumarHome } from '@/components/hoje/arrumar'
import { arranjoSalvo } from '@/server/home/consultas'
import { arranjoEfetivo, daFaixa } from '@/core/home/blocos'
import { caixaDoMes } from '@/server/financeiro/consultas'
import { variacao } from '@/core/financeiro/metricas'
import { emReais } from '@/core/planos/plano'

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
  const notificacoes = podeVerTodos
    ? await notificacoesDaConta(db, conta.contaId)
    : []
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

  /*
   * O arranjo da tela, desta pessoa.
   *
   * Quem nunca mexeu não tem linha no banco, e `arranjoEfetivo` monta o padrão:
   * é o caminho da esmagadora maioria das aberturas, e ele não escreve nada.
   */
  const arranjo = arranjoEfetivo(
    user ? await arranjoSalvo(db, conta.contaId, user.id) : null,
    { operacional: podeVerTodos },
  )
  const mostra = (id: string) => arranjo.some((b) => b.id === id && b.visivel)

  /*
   * O caixa só é consultado se o bloco estiver ligado. Quem desligou não paga
   * a consulta, e quem não pode ver dinheiro nem chega aqui.
   */
  const caixa = mostra('caixa') ? await caixaDoMes(db, conta.contaId, hoje) : null
  const variou = caixa ? variacao(caixa.recebidoCent, caixa.recebidoAntesCent) : null

  const blocosPrincipais = daFaixa(arranjo, 'principal')
  const blocosLaterais = daFaixa(arranjo, 'lateral')
  /*
   * Cada bloco é montado uma vez, num objeto, e a ordem quem dá é o arranjo.
   *
   * Montar aqui e escolher depois é o que permite a mesma tela sair em ordens
   * diferentes para duas pessoas sem duplicar o desenho de nada. O que não está
   * no arranjo simplesmente não é lido do objeto, e o custo dele é o de
   * construir JSX que ninguém renderiza.
   */
  const PRINCIPAL: Record<string, React.ReactNode> = {
    numeros: (
      <div key="numeros" className="grid gap-3 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
        <CartaoNumero
          rotulo={`${rotulos.sessao.plural} hoje`}
          valor={vivas.length}
          sub={ultima ? `Até ${ultima.hora}` : 'Nada marcado'}
          glifo="≡"
          tom="info"
        />
        <CartaoNumero
          rotulo="Chamadas pendentes"
          valor={pendentes}
          sub="De turmas passadas"
          glifo="!"
          tom={pendentes > 0 ? 'alerta' : 'atencao'}
        />
        <CartaoNumero
          rotulo="Presenças"
          valor={presencas}
          sub="Registradas no dia"
          glifo="✓"
          tom="positivo"
        />
        <CartaoNumero
          rotulo="Reposições em aberto"
          valor={reposicoes.length}
          sub={maisAntiga ? `Mais antiga: ${maisAntiga} dias` : 'Nenhuma esperando'}
          glifo="↺"
          tom={reposicoes.length > 0 ? 'alerta' : 'info'}
        />
      </div>
    ),

    /*
     * O caixa na tela inicial.
     *
     * O rail já traz o número de cobranças em atraso, e ele resolve "tem
     * alguém para ligar?". O que ele não resolve é "quanto", que é a pergunta
     * que faz alguém abrir o Financeiro: a lista de atraso com dez linhas de
     * R$ 90 e a com dez linhas de R$ 700 pedem manhãs diferentes.
     */
    caixa: caixa ? (
      <section key="caixa" className={`flex flex-wrap items-center gap-x-6 gap-y-3.5 ${cartao} px-5 py-4`}>
        <Link
          href="/financeiro?aba=pagas"
          className="flex flex-col gap-0.5 rounded-media px-1 py-0.5 hover:bg-superficie-mais-suave"
        >
          <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
            Entrou neste mês
          </span>
          <span className="font-titulo text-[24px] leading-none font-semibold text-positivo">
            {emReais(caixa.recebidoCent)}
          </span>
          {/*
            * A comparação é com o **mesmo trecho** do mês passado.
            *
            * No dia 5, comparar cinco dias com um mês inteiro diria que o
            * faturamento caiu 80%, e número que mente é pior que número que
            * falta. Quando não há com o que comparar, a linha some: sair de
            * zero para quatro mil não é aumento infinito, é o primeiro mês.
            */}
          <span className="text-[12.5px] text-tinta-media">
            {variou === null
              ? 'sem mês anterior para comparar'
              : `${variou >= 0 ? '+' : ''}${variou}% ante o mesmo trecho do mês passado`}
          </span>
        </Link>

        <span aria-hidden className="w-px self-stretch bg-linha-fina" />

        <Link
          href="/financeiro?aba=a_vencer"
          className="flex flex-col gap-0.5 rounded-media px-1 py-0.5 hover:bg-superficie-mais-suave"
        >
          <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
            Ainda vence neste mês
          </span>
          <span className="font-titulo text-[24px] leading-none font-semibold">
            {emReais(caixa.aVencerCent)}
          </span>
          <span className="text-[12.5px] text-tinta-media">o que falta entrar</span>
        </Link>

        <span aria-hidden className="w-px self-stretch bg-linha-fina" />

        <Link
          href="/financeiro?aba=atrasadas"
          className="flex flex-col gap-0.5 rounded-media px-1 py-0.5 hover:bg-superficie-mais-suave"
        >
          <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
            Em atraso
          </span>
          <span
            className={`font-titulo text-[24px] leading-none font-semibold ${caixa.atrasadas ? 'text-alerta' : ''}`}
          >
            {emReais(caixa.atrasadoCent)}
          </span>
          <span className="text-[12.5px] text-tinta-media">
            {caixa.atrasadas === 0
              ? 'nada vencido'
              : `${caixa.atrasadas} ${caixa.atrasadas === 1 ? 'cobrança' : 'cobranças'}, de qualquer mês`}
          </span>
        </Link>

        <Link
          href="/financeiro?aba=fechamento"
          className="ml-auto rounded-padrao border border-linha bg-superficie-suave px-4 py-2.5 text-[14px] hover:bg-[#EDF3F0]"
        >
          Ver o fechamento
        </Link>
      </section>
    ) : null,

    proxima: (
      <div key="proxima" className="contents">
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
              <span className="text-[12px] font-semibold tracking-[.12em] text-tinta-media uppercase">
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
                <span className="text-[12.5px] text-tinta-media">{r.rotulo}</span>
              </div>
            ))}
            {!ehHoje ? (
              <Link
                href={link(hoje)}
                className="ml-auto rounded-padrao border border-linha bg-superficie-suave px-4 py-2.5 text-[14px] hover:bg-[#EDF3F0]"
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
          className="flex size-11 items-center justify-center rounded-media bg-superficie-mais-suave font-mono text-[18px] text-tinta-media"
        >
          ◷
        </span>
        <span className="font-titulo text-[18px] font-semibold">
          Nada marcado neste dia
        </span>
        <span className="max-w-[340px] text-[14px] leading-relaxed text-tinta-media">
          Pode ser domingo, feriado ou dia fechado na configuração de
          funcionamento. Não é falha de carregamento.
        </span>
        <div className="flex flex-wrap justify-center gap-2 pt-1.5">
          <Link
            href="/semana"
            className="rounded-padrao border border-linha bg-superficie-suave px-4 py-2.5 text-[14px] hover:bg-[#EDF3F0]"
          >
            Ver a semana
          </Link>
          {!ehHoje ? (
            <Link
              href={link(hoje)}
              className="rounded-padrao bg-escuro px-4 py-2.5 text-[14px] font-medium text-tinta-clara hover:bg-escuro-hover"
            >
              Voltar para hoje
            </Link>
          ) : null}
        </div>
      </section>
    ) : (
      <section key="agenda" className={`flex flex-col ${cartao} px-2 pt-1.5 pb-2.5`}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <h2 className="font-titulo text-[18px] font-semibold">Agenda do dia</h2>
          <span className="text-[13px] text-tinta-media">
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
    ),
  }

  const LATERAL: Record<string, React.ReactNode> = {
    pendencias: (
      <Bloco
        key="pendencias"
        titulo="Pendências"
        acao={
          <Link href="/pendencias" className="text-[13px] font-medium text-marca">
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
                className={`flex size-7.5 items-center justify-center rounded-peca text-[14px] font-semibold ${TINTA_PENDENCIA[g.tipo] ?? 'bg-neutro-fundo text-neutro'}`}
              >
                {g.itens.length}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[14px] font-medium">{g.titulo}</span>
                <span className="truncate text-[12.5px] text-tinta-media">
                  {g.itens[0]?.detalhe ?? g.sub}
                </span>
              </span>
              <span aria-hidden className="ml-auto font-mono text-[14px] text-[#A9B3AE]">
                ›
              </span>
            </Link>
          ))}
          {grupos.every((g) => g.itens.length === 0) ? (
            <p className="px-1 py-2 text-[13.5px] text-tinta-media">
              Nada esperando por você.
            </p>
          ) : null}
        </div>
      </Bloco>
    ),

    equipe: (
      <Bloco key="equipe" titulo={`${rotulos.profissional.plural} hoje`}>
        <div className="flex flex-col gap-3">
          {profs.map((p) => (
            <div key={p.nome} className="flex items-center gap-2.5">
              <AvatarProf nome={p.nome} cor={p.cor} tamanho={30} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="truncate text-[14px] font-medium">{p.nome}</span>
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
              <span className="font-mono text-[12.5px] text-tinta-media">
                {p.n}{' '}
                {(p.n === 1 ? rotulos.sessao.singular : rotulos.sessao.plural).toLowerCase()}
              </span>
            </div>
          ))}
          {profs.length === 0 ? (
            <p className="text-[13.5px] text-tinta-media">
              Ninguém da equipe tem {rotulos.sessao.singular.toLowerCase()}
              {' '}neste dia.
            </p>
          ) : null}
        </div>
      </Bloco>
    ),

    dica: (
      <section key="dica" className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie-suave p-4">
        <p className="text-[13.5px] leading-relaxed text-tinta-media">
          Lotação cheia não é bloqueio:{' '}
          <strong className="font-semibold text-tinta">5/4</strong> aparece em
          laranja e o encaixe segue permitido, quem decide é quem está na
          recepção, com nome e registro.
        </p>
      </section>
    ),
  }

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
            <p className="pt-[3px] text-[14.5px] text-tinta-media">
              {dataLonga(dia, fuso)} · {conta.nome}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <BuscaRapida rotuloPessoa={rotulos.pessoa.singular} />

            {/* o sino fica ao lado da busca, e só para quem responde pelo
                negócio: professor não precisa saber do encaixe da recepção */}
            {podeVerTodos ? <Sino itens={notificacoes} /> : null}

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

            {/* arrumar a tela mora na tela que se arruma: a pergunta nasce
                olhando para ela, e quem precisa sair daqui para responder não
                responde */}
            <ArrumarHome
              inicial={arranjo.map((b) => ({
                id: b.id,
                titulo: b.titulo,
                sobre: b.sobre,
                faixa: b.faixa,
                fixo: Boolean(b.fixo),
                visivel: b.visivel,
              }))}
            />
          </div>
        </header>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_316px]">
          <div className="flex min-w-0 flex-col gap-3.5">
            {blocosPrincipais.map((b) => PRINCIPAL[b.id] ?? null)}
          </div>

          <div className="flex min-w-0 flex-col gap-3.5">
            {blocosLaterais.map((b) => LATERAL[b.id] ?? null)}
          </div>
        </div>
      </div>
    </ProvedorDeAviso>
  )
}

function primeiro(nome: string) {
  return (nome.split('@')[0] ?? nome).trim().split(/\s+/)[0] ?? nome
}
