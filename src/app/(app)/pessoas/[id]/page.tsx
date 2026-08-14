import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { fichaDaPessoa, type Ficha } from '@/server/pessoas/consultas'
import { hojeEm } from '@/server/agenda/fuso'
import { EditarPessoa } from '@/components/pessoas/editar-pessoa'
import {
  AtenderPedidoDeExclusao, CopiarTelefone, MarcarInativa, RegistrarRenovacao,
} from '@/components/pessoas/acoes-da-ficha'
import { Vagas } from '@/components/pessoas/vagas'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { Abas } from '@/components/ui/abas'
import { Etiqueta, Rotulo, Vazio, cartao } from '@/components/ui/pecas'
import { TINTA_PRESENCA, TINTA_ORIGEM, type Tinta } from '@/components/ui/tintas'

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

/** o ponto da linha do tempo: a mesma tinta, chapada */
const PONTO: Record<Tinta, string> = {
  positivo: 'bg-positivo',
  atencao: 'bg-atencao',
  alerta: 'bg-alerta',
  info: 'bg-info',
  licenca: 'bg-licenca',
  neutro: 'bg-linha-tracejada',
}

const PAR: Record<Tinta, string> = {
  positivo: 'bg-positivo-fundo text-positivo',
  atencao: 'bg-atencao-fundo text-atencao',
  alerta: 'bg-alerta-fundo text-alerta',
  info: 'bg-info-fundo text-info',
  licenca: 'bg-licenca-fundo text-licenca',
  neutro: 'bg-neutro-fundo text-tinta-media',
}

type Aba = 'agenda' | 'historico' | 'reposicoes' | 'perfil'
const ABAS: Aba[] = ['agenda', 'historico', 'reposicoes', 'perfil']

function curta(data: string) {
  return `${data.slice(8)}/${data.slice(5, 7)}`
}

function mesAno(iso: string) {
  const m = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
             'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${m[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`
}

/**
 * As doze últimas semanas em doze barrinhas.
 *
 * Responde de relance a pergunta que a lista não responde: "ela está sumindo?".
 * Uma tabela de trinta linhas tem a mesma informação e exige ler trinta linhas.
 */
function semanasDe(historico: Ficha['historico'], hoje: string) {
  const fim = Date.parse(hoje)
  return Array.from({ length: 12 }, (_, i) => {
    const ate = fim - (11 - i) * 7 * 864e5
    const de = ate - 6 * 864e5
    const naSemana = historico.filter((x) => {
      const t = Date.parse(x.data)
      return t >= de && t <= ate
    })

    const veio = naSemana.some((x) => x.status === 'presente')
    const faltou = naSemana.some((x) => x.status === 'falta')
    const avisou = naSemana.some((x) => x.status === 'falta_avisada')

    // a semana ganha a cor do pior que aconteceu nela: uma falta no meio de
    // três presenças é exatamente o que se quer enxergar
    const cor = faltou ? '#FBE4D9' : avisou ? '#F6E7C9' : veio ? '#0E7C6B' : '#EFF3F1'
    const dica = naSemana.length === 0
      ? 'nada marcado'
      : `${naSemana.length} ${naSemana.length === 1 ? 'aula' : 'aulas'}`
    return { cor, dica }
  })
}

export default async function Pessoa({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { id } = await params
  const { aba: abaBruta } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const ficha = await fichaDaPessoa(db, conta.contaId, id)
  if (!ficha) notFound()

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const hoje = hojeEm(conta.fuso)
  const aba: Aba = ABAS.includes(abaBruta as Aba) ? (abaBruta as Aba) : 'agenda'

  const { data: series } = await db
    .from('serie')
    .select('id, dia_semana, hora_inicio, servico:servico_id(nome)')
    .eq('conta_id', conta.contaId).eq('ativo', true)
    .order('dia_semana').order('hora_inicio')
    .returns<Array<{ id: string; dia_semana: number; hora_inicio: string;
                     servico: { nome: string } | null }>>()

  const opcoesSerie = (series ?? []).map((s) => ({
    id: s.id,
    rotulo: `${DIAS[s.dia_semana]} ${String(s.hora_inicio).slice(0, 5)} · ${s.servico?.nome ?? 'sem registro'}`,
  }))

  const p = ficha.pessoa
  const [fundo, frente] = paresDe(p.nome)

  const presencas = ficha.historico.filter((x) => x.status === 'presente').length
  const faltas = ficha.historico.filter(
    (x) => x.status === 'falta' || x.status === 'falta_avisada',
  ).length
  const decididas = presencas + faltas
  const frequencia = decididas === 0 ? null : Math.round((presencas / decididas) * 100)

  const diasParaVencer = p.vencimentoPlano
    ? Math.round((Date.parse(p.vencimentoPlano) - Date.parse(hoje)) / 864e5)
    : null

  // a ficha é a linha entre agenda e CRM: entra histórico, tag, observação e
  // contato. Não entra funil, proposta, valor nem cobrança.
  const dados: Array<[string, string, boolean?]> = [
    ['Telefone', p.telefone ?? 'sem telefone', !p.telefone],
    ['E-mail', p.email ?? 'sem e-mail'],
    ['Identificador', p.identificadorExterno ?? 'sem identificador', !p.identificadorExterno],
    ['Nascimento', p.nascimento ? curta(p.nascimento) : 'sem registro'],
    [`${rotulos.pessoa.singular} desde`, mesAno(p.criadoEm.slice(0, 10))],
  ]

  const semanas = semanasDe(ficha.historico, hoje)

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2.5 text-[12.5px] text-tinta-apagada">
        <Link href="/pessoas" className="font-medium text-marca">
          {rotulos.pessoa.plural}
        </Link>
        <span aria-hidden className="font-mono">/</span>
        <span className="text-tinta">{p.nome}</span>
      </nav>

      {/*
       * O bloco de ações fica no topo à direita, fora de qualquer cartão de
       * conteúdo: são as três coisas que se faz *com a pessoa*, e ficam onde o
       * olho vai primeiro depois do nome.
       */}
      <article className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4 ${cartao} px-[22px] py-5`}>
        <div className="flex min-w-0 flex-[1_1_380px] items-start gap-[18px]">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold"
            style={{ background: fundo, color: frente, opacity: p.ativo ? 1 : 0.55 }}
          >
            {iniciaisDe(p.nome)}
          </span>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-titulo text-[24px] leading-tight font-semibold">
                {p.nome}
              </h1>
              {ficha.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-minima bg-atencao-fundo px-2 py-[3px] text-[10px] font-semibold tracking-[.08em] text-atencao uppercase"
                >
                  {t}
                </span>
              ))}
              {!p.ativo ? (
                <Etiqueta tinta="neutro">Inativa, continua no histórico</Etiqueta>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-x-[22px] gap-y-2">
              {dados.map(([rotulo, valor, falta]) => (
                <span key={rotulo} className="flex flex-col leading-[1.4]">
                  <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-inativa uppercase">
                    {rotulo}
                  </span>
                  <span className={`text-[13.5px] ${falta ? 'text-alerta' : ''}`}>
                    {valor}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-[200px] flex-[1_1_200px] flex-col gap-2.5">
          {/*
            "Agendar" leva ao único lugar onde se marca horário para alguém: o
            formulário de vaga, na aba Agenda. Botão que abre um modal que a
            tela já tem embaixo seria um caminho a mais para o mesmo destino.
          */}
          <Link
            href={`/pessoas/${id}#nova-matricula`}
            className="flex min-h-11 w-full items-center justify-center rounded-media bg-escuro px-4 text-[13.5px] font-semibold text-tinta-clara transition-colors duration-150 hover:bg-escuro-hover"
          >
            Agendar
          </Link>
          <div className="flex gap-2">
            <EditarPessoa
              className="flex-1"
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
            <MarcarInativa
              pessoaId={p.id}
              nome={p.nome}
              ativo={p.ativo}
              rotuloPessoa={rotulos.pessoa.plural}
            />
          </div>
        </div>
      </article>

      <Abas
        className="self-start"
        rotuloDoGrupo="O que ver desta ficha"
        ativo={aba}
        itens={[
          { id: 'agenda', rotulo: 'Agenda', href: `/pessoas/${id}` },
          {
            id: 'historico',
            rotulo: 'Histórico',
            contagem: ficha.historico.length || undefined,
            href: `/pessoas/${id}?aba=historico`,
          },
          {
            id: 'reposicoes',
            rotulo: 'Reposições',
            contagem: ficha.reposicoesAbertas.length || undefined,
            href: `/pessoas/${id}?aba=reposicoes`,
          },
          { id: 'perfil', rotulo: 'Perfil', href: `/pessoas/${id}?aba=perfil` },
        ]}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {aba === 'agenda' ? (
            <>
              <section className={`${cartao} px-[18px] py-4`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                  <h2 className="font-titulo text-[17px] font-semibold">
                    {rotulos.vaga.plural}
                  </h2>
                  <span className="text-[12px] text-tinta-fraca">
                    a {rotulos.vaga.singular.toLowerCase()} tem vigência, encerrar
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

              <section className={`${cartao} px-[18px] py-4`}>
                <h2 className="pb-3 font-titulo text-[17px] font-semibold">
                  Próximas {rotulos.sessao.plural.toLowerCase()}
                </h2>
                {ficha.proximas.length === 0 ? (
                  <Vazio
                    icone="hoje"
                    titulo="Nada marcado à frente"
                    texto={`Quem tem ${rotulos.vaga.singular.toLowerCase()} volta a aparecer aqui assim que a semana for materializada.`}
                  />
                ) : (
                  <ul className="flex flex-col gap-[7px]">
                    {ficha.proximas.slice(0, 8).map((x) => (
                      <li key={x.id}>
                        <Link
                          href={`/sessao/${x.sessaoId}`}
                          className="flex items-center gap-3.5 rounded-media border border-linha-fina px-3 py-[11px] transition-colors duration-150 hover:bg-superficie-tenue"
                        >
                          <span className="w-24 shrink-0 font-mono text-[12.5px] text-tinta-media">
                            {curta(x.data)} {x.hora}
                          </span>
                          <span aria-hidden className="h-[26px] w-[3px] shrink-0 rounded-sm bg-marca" />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                            {x.servico}
                          </span>
                          <span className="text-[12px] text-tinta-fraca">{x.origem}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          {aba === 'historico' ? (
            <section className={`${cartao} px-[18px] py-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                <h2 className="font-titulo text-[17px] font-semibold">Histórico</h2>
                <span className="text-[12px] text-tinta-fraca">
                  {frequencia === null
                    ? 'ainda sem presença registrada'
                    : `veio ${frequencia}% das vezes`}
                </span>
              </div>

              <div className="mb-4 flex flex-col gap-[7px] rounded-media border border-linha-fina bg-superficie-suave px-3 py-3">
                <Rotulo>Últimas 12 semanas</Rotulo>
                <div className="flex gap-1">
                  {semanas.map((w, i) => (
                    <span
                      key={i}
                      title={w.dica}
                      className="h-[26px] flex-1 rounded-minima"
                      style={{ background: w.cor }}
                    />
                  ))}
                </div>
                <div className="flex gap-3.5 pt-0.5">
                  {[['#0E7C6B', 'veio'], ['#F6E7C9', 'avisou'], ['#FBE4D9', 'faltou']].map(
                    ([cor, rotulo]) => (
                      <span key={rotulo} className="inline-flex items-center gap-1.5 text-[10.5px] text-tinta-fraca">
                        <span aria-hidden className="size-2 rounded-[3px]" style={{ background: cor }} />
                        {rotulo}
                      </span>
                    ),
                  )}
                </div>
              </div>

              {ficha.historico.length === 0 ? (
                <Vazio
                  icone="hoje"
                  titulo="Ainda não há histórico"
                  texto="Quem acabou de ser cadastrado começa assim. Não é falha de carregamento."
                />
              ) : (
                <ul className="flex flex-col">
                  {ficha.historico.slice(0, 60).map((x) => (
                    <li key={x.id} className="flex gap-3.5">
                      {/* a linha do tempo à esquerda: o ponto diz o quê, a linha
                          diz que houve outro antes */}
                      <span className="flex flex-col items-center pt-[5px]">
                        <span
                          aria-hidden
                          className={`size-[9px] rounded-full ${
                            PONTO[TINTA_PRESENCA[x.status as keyof typeof TINTA_PRESENCA] ?? 'neutro']
                          }`}
                        />
                        <span aria-hidden className="min-h-6 w-px flex-1 bg-linha-suave" />
                      </span>
                      <Link
                        href={`/sessao/${x.sessaoId}`}
                        className="flex min-w-0 flex-1 items-center gap-3 pb-4"
                      >
                        <span className="w-[74px] shrink-0 font-mono text-[12px] text-tinta-fraca">
                          {curta(x.data)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px]">
                          {x.servico}
                        </span>
                        {x.origem !== 'recorrente' ? (
                          <span
                            className={`shrink-0 rounded-minima px-1.5 py-[3px] text-[10px] font-semibold tracking-[.08em] uppercase ${
                              PAR[TINTA_ORIGEM[x.origem as keyof typeof TINTA_ORIGEM] ?? 'neutro']
                            }`}
                          >
                            {x.origem}
                          </span>
                        ) : null}
                        <span
                          className={`shrink-0 rounded-peca px-2.5 py-1 text-[11.5px] font-medium ${
                            PAR[TINTA_PRESENCA[x.status as keyof typeof TINTA_PRESENCA] ?? 'neutro']
                          }`}
                        >
                          {ROTULO_STATUS[x.status] ?? x.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {aba === 'reposicoes' ? (
            <section className="rounded-cartao border border-atencao-linha bg-atencao-superficie p-4">
              <div className="flex items-center justify-between pb-3">
                <h2 className="font-titulo text-[17px] font-semibold">
                  Reposições em aberto
                </h2>
                <span className="flex size-6 items-center justify-center rounded-peca bg-atencao-fundo text-[12px] font-semibold text-atencao">
                  {ficha.reposicoesAbertas.length}
                </span>
              </div>

              {ficha.reposicoesAbertas.length === 0 ? (
                <Vazio
                  icone="check"
                  titulo="Nenhuma. Nada a cobrar de volta."
                  texto="Falta que virou crédito e ninguém usou aparece aqui."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {ficha.reposicoesAbertas.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2.5 rounded-media border border-atencao-linha bg-superficie px-3 py-[11px]"
                    >
                      <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                        <span className="truncate text-[13.5px] font-medium">
                          {r.servico} · {curta(r.data)} {r.hora}
                        </span>
                        <span className="text-[11.5px] text-tinta-fraca">
                          {ROTULO_STATUS[r.status] ?? r.status}
                        </span>
                      </span>
                      <Link
                        href={`/sessao/${r.sessaoId}`}
                        className="shrink-0 rounded-peca bg-atencao px-3 py-2 text-[12.5px] font-medium text-white transition-colors duration-150 hover:bg-[#75591C]"
                      >
                        Ver a aula
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <p className="pt-3 text-[11.5px] leading-[1.55] text-tinta-apagada">
                Para usar um crédito, encaixe a pessoa num horário e aponte a
                falta pelo menu dela na tela da {rotulos.sessao.singular.toLowerCase()}.
              </p>
            </section>
          ) : null}

          {aba === 'perfil' ? (
            <section className={`${cartao} px-[18px] py-4`}>
              <h2 className="pb-3.5 font-titulo text-[17px] font-semibold">
                Dados cadastrais
              </h2>
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                {dados.map(([rotulo, valor, falta]) => (
                  <div key={rotulo} className="flex flex-col gap-1">
                    <Rotulo>{rotulo}</Rotulo>
                    <span className={`text-[14px] ${falta ? 'text-alerta' : ''}`}>
                      {valor}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-linha-fina pt-4">
                <span className="pr-1">
                  <Rotulo>Marcações</Rotulo>
                </span>
                {ficha.tags.length === 0 ? (
                  <span className="text-[12.5px] text-tinta-fraca">
                    nenhuma, marcação é o que a equipe precisa lembrar antes da aula
                  </span>
                ) : (
                  ficha.tags.map((t) => <Etiqueta key={t} tinta="atencao">{t}</Etiqueta>)
                )}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-3.5 xl:sticky xl:top-4">
          {p.observacao ? (
            <section className="rounded-grande border border-atencao-linha bg-atencao-superficie px-4 py-4">
              <div className="flex items-center gap-2 pb-2.5">
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-minima bg-atencao-fundo font-mono text-[11px] text-atencao"
                >
                  !
                </span>
                <span className="text-[10.5px] font-semibold tracking-[.1em] text-atencao uppercase">
                  Atenção na aula
                </span>
              </div>
              <p className="text-[13px] leading-[1.55] text-[#414A47]">{p.observacao}</p>
            </section>
          ) : null}

          <section className={`${cartao} px-4 py-4`}>
            <div className="pb-3">
              <Rotulo>Contato</Rotulo>
            </div>
            <p
              className={`pb-3 font-mono text-[14px] ${p.telefone ? '' : 'text-alerta'}`}
            >
              {p.telefone ?? 'sem telefone'}
            </p>
            {p.telefone ? (
              <div className="flex gap-[7px]">
                <a
                  href={`https://wa.me/55${p.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center rounded-padrao border border-positivo-linha bg-positivo-superficie px-3 py-2.5 text-[12.5px] font-medium text-marca transition-colors duration-150 hover:bg-positivo-fundo"
                >
                  Mandar mensagem
                </a>
                <CopiarTelefone telefone={p.telefone} />
              </div>
            ) : (
              <p className="text-[12px] leading-[1.5] text-tinta-fraca">
                Sem telefone não dá para avisar de cancelamento nem cobrar
                reposição, é o campo que mais falta e mais custa.
              </p>
            )}
          </section>

          <section className={`${cartao} px-4 py-4`}>
            <div className="flex items-center justify-between pb-3">
              <Rotulo>Plano</Rotulo>
              {diasParaVencer === null ? null : (
                <span
                  className={`rounded-minima px-2 py-1 text-[11px] font-medium ${
                    diasParaVencer < 0
                      ? 'bg-alerta-fundo text-alerta'
                      : diasParaVencer <= 15
                        ? 'bg-atencao-fundo text-atencao'
                        : 'bg-positivo-fundo text-positivo'
                  }`}
                >
                  {diasParaVencer < 0
                    ? `venceu há ${-diasParaVencer} dias`
                    : diasParaVencer === 0
                      ? 'vence hoje'
                      : `vence em ${diasParaVencer} dias`}
                </span>
              )}
            </div>
            <p className="pb-3 text-[13px] leading-[1.5] text-tinta-media">
              {p.vencimentoPlano
                ? `Vence em ${curta(p.vencimentoPlano)}`
                : 'Sem data de vencimento. A agenda guarda só até quando o plano vale, valor e cobrança são de outro sistema.'}
            </p>
            <RegistrarRenovacao pessoaId={p.id} vencimento={p.vencimentoPlano} />
          </section>

          <section className={`${cartao} px-4 py-4`}>
            <div className="pb-3">
              <Rotulo>Em números</Rotulo>
            </div>
            <dl className="flex flex-col gap-2.5">
              {([
                ['Presença', frequencia === null ? 'sem registro' : `${frequencia}%`,
                 frequencia !== null && frequencia >= 80 ? 'text-positivo' : 'text-tinta'],
                ['Faltas nos últimos 30 dias', String(p.faltasRecentes),
                 p.faltasRecentes > 1 ? 'text-alerta' : 'text-tinta'],
                ['Reposições em aberto', String(ficha.reposicoesAbertas.length),
                 ficha.reposicoesAbertas.length > 0 ? 'text-atencao' : 'text-tinta'],
                [`${rotulos.vaga.plural} ativas`, String(ficha.vagas.filter((v) => !v.fim).length),
                 'text-tinta'],
                ['Cadastrada em', mesAno(p.criadoEm.slice(0, 10)), 'text-tinta'],
              ] as const).map(([rotulo, valor, cor]) => (
                <div key={rotulo} className="flex items-baseline justify-between gap-2.5">
                  <dt className="text-[12.5px] text-tinta-media">{rotulo}</dt>
                  <dd className={`font-mono text-[13.5px] ${cor}`}>{valor}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/*
            No pé, e só para quem responde pelo negócio: é a única ação da ficha
            que não tem volta, e ninguém deve tropeçar nela procurando outra
            coisa. Já anonimizada, o lugar do botão vira o registro do que
            aconteceu.
          */}
          {p.anonimizadaEm ? (
            <p className="rounded-media bg-neutro-fundo px-3.5 py-3 text-[12.5px] leading-[1.55] text-tinta-media">
              Os dados desta pessoa foram apagados a pedido dela, em{' '}
              {curta(p.anonimizadaEm.slice(0, 10))}. O que ficou é o histórico
              de presença, sem nada que identifique alguém, e não dá para
              desfazer.
            </p>
          ) : conta.papel === 'dono' || conta.papel === 'suporte' ? (
            <AtenderPedidoDeExclusao pessoaId={p.id} nome={p.nome} />
          ) : null}
        </aside>
      </div>
    </div>
  )
}
