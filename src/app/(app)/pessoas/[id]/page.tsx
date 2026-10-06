import { inicioDaPessoa } from '@/core/pessoas/inicio'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { fichaDaPessoa, type Ficha } from '@/server/pessoas/consultas'
import { hojeEm } from '@/server/agenda/fuso'
import { EditarPessoa } from '@/components/pessoas/editar-pessoa'
import {
  AvisoDeCadastro, CopiarTelefone, MarcarInativa, RegistrarRenovacao,
} from '@/components/pessoas/acoes-da-ficha'
import { ProvedorDeMatricula, Vagas } from '@/components/pessoas/vagas'
import { ReposicoesAbertas } from '@/components/pessoas/reposicoes'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { AbasDaFicha } from '@/components/pessoas/abas-da-ficha'
import { Etiqueta, Rotulo, Vazio, cartao } from '@/components/ui/pecas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { Voltar } from '@/components/ui/voltar'
import { TINTA_PRESENCA, TINTA_ORIGEM, type Tinta } from '@/components/ui/tintas'
import { erroDoTelefone, exibirTelefone, telefoneValido } from '@/core/telefone'
import { PainelDeAvaliacao } from '@/components/avaliacao/painel'
import { NovaMatricula, ContratosDaFicha } from '@/components/contratos/matricula'
import { contratosDaPessoa, modalidadesDaPessoa, servicosDaPessoa } from '@/server/contratos/consultas'
import { MarcarAula } from '@/components/pessoas/marcar-aula'
import { CartaoLicenca } from '@/components/licenca/cartao-licenca'
import { licencaDaPessoa } from '@/server/licencas/licencas'
import { cobrancasDaPessoa } from '@/server/financeiro/consultas'
import { recibosDaPessoa, ultimosEnvios } from '@/server/recibo/consultas'
import { ListaDeRecibos } from '@/components/recibo/lista'
import { FaixaDeNumeros } from '@/components/ui/faixa-numeros'
import { resumoDaPessoa } from '@/core/financeiro/metricas'
import { ROTULO_FORMA, type Forma } from '@/core/financeiro/fechamento'
import { emReais } from '@/core/planos/plano'
import { ListaDeCobrancas } from '@/components/financeiro/lista'
import { listarPlanos } from '@/server/planos/consultas'
import { listarSeries } from '@/server/grade/consultas'
import { podeVerAvaliacao } from '@/server/avaliacao/consultas'
import {
  criarPosicao, painelDeAvaliacao, registrarAvaliacao,
} from '@/server/avaliacao/acoes'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const POR_RECORRENCIA: Record<string, string> = {
  mensal: ' por mês', trimestral: ' por trimestre', semestral: ' por semestre', anual: ' por ano',
}

const ROTULO_STATUS: Record<string, string> = {
  esperada: 'Sem registro',
  confirmada: 'Confirmada',
  presente: 'Presente',
  falta: 'Falta',
  falta_avisada: 'Falta justificada',
  licenca: 'Licença',
  cancelada: 'Cancelada',
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

// "Perfil" saiu em 06/out: repetia os dados do cabeçalho; ?aba=perfil cai na Agenda
type Aba = 'agenda' | 'historico' | 'reposicoes' | 'contratos' | 'avaliacao'
const ABAS: Aba[] = ['agenda', 'historico', 'reposicoes', 'contratos', 'avaliacao']

/** a origem como o banco grava, e como a recepção fala */
const ROTULO_ORIGEM: Record<string, string> = {
  recorrente: 'Horário fixo',
  avulso: 'Avulso',
  reposicao: 'Reposição',
  encaixe: 'Encaixe',
  reserva: 'Reserva',
}

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
    const licenca = naSemana.some((x) => x.status === 'licenca')

    // a semana ganha a cor do pior que aconteceu nela: uma falta no meio de
    // três presenças é exatamente o que se quer enxergar
    // semana só de licença tem cor própria: cinza dizia "nada marcado"
    const cor = faltou ? '#FBE4D9' : avisou ? '#F6E7C9' : veio ? '#0E7C6B'
      : licenca ? '#E9E6F3' : '#EFF3F1'
    const dica = naSemana.length === 0
      ? 'nada marcado'
      : `${naSemana.length} ${naSemana.length === 1 ? 'registro' : 'registros'}`
    return { cor, dica }
  })
}

export default async function Pessoa({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string; novo?: string }>
}) {
  const { id } = await params
  const { aba: abaBruta, novo } = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const ficha = await fichaDaPessoa(db, conta.contaId, id, conta.papel)
  if (!ficha) notFound()

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const hoje = hojeEm(conta.fuso)
  const aba: Aba = ABAS.includes(abaBruta as Aba) ? (abaBruta as Aba) : 'agenda'

  /*
   * Quem atende não matricula ninguém. É a mesma linha que já separa a recepção
   * da avaliação postural, do outro lado: contrato é dinheiro, e dinheiro é da
   * recepção e de quem responde pelo negócio.
   */
  const operacional = conta.papel === 'dono' || conta.papel === 'recepcao'
    || conta.papel === 'suporte'
  /*
   * Contrato e cobrança vêm juntos: "até quando vale" e "ela está em dia" são a
   * mesma conversa no balcão, e mandar quem atende para outra tela no meio dela
   * é o que faz a recepção voltar a anotar num papel.
   */
  const [contratos, cobrancas] = operacional
    ? await Promise.all([
        contratosDaPessoa(db, conta.contaId, id),
        cobrancasDaPessoa(db, conta.contaId, id, hoje),
      ])
    : [[], []]
  const contratosEmVigor = contratos.filter((c) => c.status === 'ativo').length

  /*
   * A modalidade, fora do `if (operacional)` de propósito.
   *
   * O Edu abriu a ficha e não achou o que a pessoa faz. Ela vinha existindo só
   * dentro da aba Contratos, que é operacional: o professor que abre a ficha
   * antes da aula não via modalidade nenhuma. Ela não é dinheiro, e por isso
   * sobe para a faixa que todo papel lê, ao lado do identificador.
   */
  const modalidades = await modalidadesDaPessoa(db, conta.contaId, id)
  const temContrato = operacional ? contratosEmVigor > 0 : modalidades.length > 0
  // o cartão Plano: nome, valor e vencimento; quem atende lê só o nome
  const vigentes: Array<{ id: string; nome: string; detalhe: string | null }> = operacional
    ? contratos.filter((c) => c.status !== 'encerrado').map((c) => ({
        id: c.id,
        nome: c.planoNome,
        detalhe: [
          `${emReais(c.precoAplicadoCent)}${POR_RECORRENCIA[c.recorrencia] ?? ''}`,
          c.diaVencimento ? `vence todo dia ${c.diaVencimento}` : null,
          c.saldo
            ? `${c.saldo.restantes} ${c.saldo.restantes === 1 ? 'sessão restante' : 'sessões restantes'}`
            : null,
          c.status === 'pausado' ? 'pausado' : null,
        ].filter(Boolean).join(' · '),
      }))
    : modalidades.map((m) => ({ id: m, nome: m, detalhe: null }))
  const licenca = await licencaDaPessoa(db, conta.contaId, id)

  // "desde" é o mais antigo entre cadastro, primeiro contrato e primeira aula:
  // quem foi importado tem o cadastro do dia da importação
  const [{ data: primeiroContrato }, { data: primeiraAula }] = await Promise.all([
    db.from('contrato').select('inicio')
      .eq('conta_id', conta.contaId).eq('pessoa_id', id)
      .order('inicio').limit(1).maybeSingle(),
    db.from('sessao').select('inicio, participacao!inner(pessoa_id)')
      .eq('conta_id', conta.contaId).eq('participacao.pessoa_id', id)
      .order('inicio').limit(1).maybeSingle(),
  ])

  // o "Marcar aula" abre na modalidade dela, e deixa trocar entre as da conta
  const [servicosDela, { data: catalogoServicos }] = operacional
    ? await Promise.all([
        servicosDaPessoa(db, conta.contaId, id),
        db.from('servico').select('id, nome').eq('conta_id', conta.contaId)
          .eq('ativo', true).order('nome'),
      ])
    : [[], { data: [] as Array<{ id: string; nome: string }> }]
  // da mais antiga para a mais nova: repõe primeiro a que vence antes
  const faltasParaRepor = [...ficha.reposicoesAbertas]
    .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
    .map((r) => ({ id: r.id, quando: `${curta(r.data)}`, servicoId: r.servicoId }))

  /*
   * O retrato financeiro da pessoa.
   *
   * A aba listava as cobranças e não respondia nenhuma das perguntas que se faz
   * olhando para alguém: está em dia? paga desde quando? deve quanto? Ler dez
   * linhas e somar de cabeça na frente de quem está esperando não é resposta.
   */
  const recibosDela = operacional
    ? await recibosDaPessoa(db, conta.contaId, id) : []
  const enviosDela = recibosDela.length
    ? await ultimosEnvios(db, conta.contaId, recibosDela.map((r) => r.id))
    : new Map<string, { para: string; em: string }>()

  const dinheiro = resumoDaPessoa(
    cobrancas.map((c) => ({
      valorCent: c.valorCent,
      valorPagoCent: c.valorPagoCent,
      situacao: c.situacao,
      vencimento: c.vencimento,
    })),
    cobrancas.flatMap((c) => c.pagamentos.map((p) => ({
      valorCent: p.valorCent,
      recebidoEm: p.recebidoEm,
      forma: p.forma,
      estornado: p.estornado,
    }))),
    hoje,
  )
  /*
   * Os horários que a pessoa pode ocupar, com o que decide a escolha.
   *
   * Quem atende, onde, e **quantas vagas estão ocupadas** vêm junto porque a
   * pergunta de quem agenda não é "qual horário existe", é "onde ainda cabe, e
   * com quem". A contagem é uma consulta só, de todas as matrículas em vigor da
   * conta: são poucas centenas, e evita um `count` por horário.
   */
  const [{ data: series }, { data: ocupacao }] = await Promise.all([
    db.from('serie')
      .select(`id, dia_semana, hora_inicio, capacidade,
               servico:servico_id(nome), profissional:profissional_id(nome),
               local:local_id(nome)`)
      .eq('conta_id', conta.contaId).eq('ativo', true)
      .order('dia_semana').order('hora_inicio'),
    db.from('vaga').select('serie_id, fim').eq('conta_id', conta.contaId),
  ])

  const ocupadas = new Map<string, number>()
  for (const v of ocupacao ?? []) {
    if (v.fim !== null && v.fim < hoje) continue
    ocupadas.set(v.serie_id, (ocupadas.get(v.serie_id) ?? 0) + 1)
  }

  const opcoesSerie = (series ?? []).map((s) => {
    const cheias = ocupadas.get(s.id) ?? 0
    return {
      id: s.id,
      grupo: DIAS[s.dia_semana],
      rotulo: `${String(s.hora_inicio).slice(0, 5)} · ${s.servico?.nome ?? 'Sem registro'}`,
      detalhe: [
        s.profissional?.nome,
        s.local?.nome,
        `${cheias}/${s.capacidade}${cheias >= s.capacidade ? ' · lotada' : ''}`,
      ].filter(Boolean).join(' · '),
      dia: s.dia_semana as number,
      hora: String(s.hora_inicio).slice(0, 5),
      servico: s.servico?.nome ?? null,
      profissional: s.profissional?.nome ?? null,
      ocupadas: cheias,
      capacidade: s.capacidade as number,
    }
  })

  const p = ficha.pessoa
  const [fundo, frente] = paresDe(p.nome)
  const telefoneCompleto = telefoneValido(p.telefone)

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
    // pontuado, como o cartão de contato ao lado já mostrava: o mesmo número
    // aparecendo cru aqui e formatado a três centímetros de distância faz a
    // recepção conferir se são dois números diferentes
    ['Telefone', p.telefone ? exibirTelefone(p.telefone) : 'Sem telefone', !p.telefone],
    ['E-mail', p.email ?? 'Sem e-mail'],
    // sem número não é defeito: quem chegou depois da ficha de papel não tem
    ['Nº da ficha', p.identificadorExterno ?? 'Sem número'],
    /*
     * Ao lado do identificador, que foi onde pediram: *"modalidade tem q ser
     * ali do lado do ID, na ficha mesmo"*. Sem contrato ativo não é falta a
     * corrigir (20 das 83 pessoas estão assim, e a maioria é histórico), então
     * não vai em vermelho.
     */
    ['Modalidade', modalidades.length ? modalidades.join(' + ') : 'Sem contrato ativo'],
    ['Nascimento', p.nascimento ? curta(p.nascimento) : 'Sem registro'],
    [`${rotulos.pessoa.singular} desde`, mesAno(inicioDaPessoa([p.criadoEm, primeiroContrato?.inicio, primeiraAula?.inicio]))],
  ]

  const semanas = semanasDe(ficha.historico, hoje)

  return (
    <ProvedorDeAviso>
    <ProvedorDeMatricula>
    {novo ? <AvisoDeCadastro /> : null}
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2.5 text-[13.5px] text-tinta-apagada">
        {/* voltar de verdade, e não só a trilha: quem chegou aqui pela agenda,
            pela busca do Hoje ou por Pendências quer desfazer o passo que deu,
            e a trilha só sabe levar para a lista */}
        <Voltar />
        <span aria-hidden className="">/</span>
        {/* quem dá aula não tem a lista de pessoas: a trilha sobe para Hoje */}
        {operacional ? (
          <Link href="/pessoas" className="font-medium text-marca">
            {rotulos.pessoa.plural}
          </Link>
        ) : (
          <Link href="/hoje" className="font-medium text-marca">Hoje</Link>
        )}
        <span aria-hidden className="">/</span>
        <span className="text-tinta">{p.nome}</span>
      </nav>

      {/*
       * O bloco de ações fica no topo à direita, fora de qualquer cartão de
       * conteúdo: são as três coisas que se faz *com a pessoa*, e ficam onde o
       * olho vai primeiro depois do nome.
       */}
      <article className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4 ${cartao} px-[22px] py-5`}>
        <div className="flex min-w-0 flex-[1_1_380px] items-start gap-[18px]">
          {/* a foto quando existe, as iniciais quando não: reconhecer quem
              chegou é metade do trabalho da recepção */}
          {p.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.fotoUrl} alt={p.nome}
              className="size-16 shrink-0 rounded-full object-cover"
              style={{ opacity: p.ativo ? 1 : 0.55 }}
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-full text-[24px] leading-none font-semibold tracking-[-.02em]"
              style={{ background: fundo, color: frente, opacity: p.ativo ? 1 : 0.55 }}
            >
              {iniciaisDe(p.nome)}
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-titulo text-[24px] leading-tight font-semibold">
                {p.nome}
              </h1>
              {ficha.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-minima bg-atencao-fundo px-2 py-[3px] text-[12px] font-semibold text-atencao"
                >
                  {t}
                </span>
              ))}
              {!p.ativo ? (
                <Etiqueta tinta="neutro">Cadastro inativo, continua no histórico</Etiqueta>
              ) : null}
              {/* o cartão da licença fica na coluna lateral; o estado precisa
                  estar junto do nome, que é onde o olho bate primeiro */}
              {licenca ? <Etiqueta tinta="licenca">Em licença</Etiqueta> : null}
            </div>

            <div className="flex flex-wrap gap-x-[22px] gap-y-2">
              {dados.map(([rotulo, valor, falta]) => (
                <span key={rotulo} className="flex flex-col leading-[1.4]">
                  <span className="text-[12px] font-semibold text-tinta-fraca">
                    {rotulo}
                  </span>
                  <span className={`text-[14.5px] ${falta ? 'text-alerta' : ''}`}>
                    {valor}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* quem dá aula consulta a ficha, mas cadastro e vaga são da recepção */}
        {operacional ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* lado a lado, cada um do tamanho do texto: empilhados e na
              largura da coluna pareciam faixas, não botões. Editar é
              secundário, marcar aula é o principal, o raro mora no "⋮" */}
          <EditarPessoa
            podeExcluir={!p.anonimizadaEm && (conta.papel === 'dono' || conta.papel === 'suporte')}
            pessoa={{
              id: p.id,
              nome: p.nome,
              telefone: p.telefone,
              email: p.email,
              identificadorExterno: p.identificadorExterno,
              nascimento: p.nascimento,
              vencimentoPlano: p.vencimentoPlano,
              ...p.cadastrais,
              observacao: p.observacao,
              observacaoVisivel: p.observacaoVisivel,
              observacaoRestrita: p.observacaoRestrita,
              fotoUrl: p.fotoUrl,
              ativo: p.ativo,
              condicoes: ficha.tags,
              }}
          />
          <MarcarAula
            pessoaId={p.id}
            nome={p.nome}
            servicos={catalogoServicos ?? []}
            servicoInicial={servicosDela.length === 1 ? servicosDela[0].id : null}
            faltas={faltasParaRepor}
            rotuloSessao={rotulos.sessao.singular}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-media bg-escuro px-4 text-[14.5px] font-semibold whitespace-nowrap text-tinta-clara transition-colors duration-150 hover:bg-escuro-hover"
          >
            Marcar {rotulos.sessao.singular.toLowerCase()}
          </MarcarAula>
          <MarcarInativa
            pessoaId={p.id}
            nome={p.nome}
            ativo={p.ativo}
            rotuloPessoa={rotulos.pessoa.plural}
          />
        </div>
        ) : null}
      </article>

      {/* na tela estreita a coluna lateral desce para o pé da página: a licença
          sobe para antes das abas, que é onde o olho está ao abrir a ficha */}
      {licenca ? (
        <div className="xl:hidden">
          <CartaoLicenca
            pessoaId={p.id}
            nome={p.nome}
            licencaId={licenca.id}
            inicio={licenca.inicio}
            voltaPrevista={licenca.voltaPrevista}
            podeMexer={operacional}
          />
        </div>
      ) : null}

      <AbasDaFicha
        inicial={aba}
        base={`/pessoas/${id}`}
        itens={[
          { id: 'agenda', rotulo: 'Agenda' },
          {
            id: 'historico',
            rotulo: 'Histórico',
            contagem: ficha.historico.length || undefined,
          },
          {
            id: 'reposicoes',
            rotulo: 'Reposições',
            contagem: ficha.reposicoesAbertas.length || undefined,
          },
          // a recepção não vê: foto de corpo é dado de saúde, e quem marca
          // aula não precisa dela para trabalhar
          ...(podeVerAvaliacao(conta.papel)
            ? [{ id: 'avaliacao', rotulo: 'Avaliação' }]
            : []),
          // quem atende não matricula ninguém: contrato é dinheiro, e dinheiro
          // é da recepção e de quem responde pelo negócio
          ...(operacional
            ? [{
                id: 'contratos',
                rotulo: 'Contratos',
                contagem: contratos.filter((c) => c.status !== 'encerrado').length || undefined,
              }]
            : []),
        ]}
        paineis={{
          agenda: (
            <>
              <section className={`${cartao} px-[18px] py-4`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                  <h2 className="font-titulo text-[18px] font-semibold">
                    {rotulos.vaga.plural}
                  </h2>
                </div>
                <Vagas
                  pessoaId={p.id}
                  vagas={ficha.vagas.map((v) => ({
                    id: v.id,
                    rotulo: `${DIAS[v.diaSemana]} ${v.horaInicio} · ${v.servico}` +
                            (v.profissional ? ` · ${v.profissional}` : ''),
                    desde: v.inicio,
                    ate: v.fim,
                    dia: DIAS[v.diaSemana],
                    hora: v.horaInicio,
                    servico: v.servico,
                    profissional: v.profissional,
                  }))}
                  series={opcoesSerie}
                  modalidadesContratadas={operacional ? modalidades : undefined}
                  rotuloVaga={rotulos.vaga.singular}
                  rotuloSerie={rotulos.serie.singular}
                  podeEditar={operacional}
                />
              </section>

              <section className={`${cartao} px-[18px] py-4`}>
                <h2 className="pb-3 font-titulo text-[18px] font-semibold">
                  {rotulos.sessao.plural} à frente
                </h2>
                {ficha.proximas.length === 0 ? (
                  <Vazio
                    icone="hoje"
                    titulo="Nada marcado à frente"
                    texto="Assim que houver agendamento, ele aparece aqui."
                  />
                ) : (
                  <ul className="flex flex-col gap-[7px]">
                    {ficha.proximas.slice(0, 8).map((x) => (
                      <li key={x.id}>
                        <Link
                          href={`/sessao/${x.sessaoId}`}
                          className="flex items-center gap-3.5 rounded-media border border-linha-fina px-3 py-[11px] transition-colors duration-150 hover:bg-superficie-tenue"
                        >
                          <span className="w-24 shrink-0 text-[13.5px] text-tinta-media">
                            {curta(x.data)} {x.hora}
                          </span>
                          <span aria-hidden className="h-[26px] w-[3px] shrink-0 rounded-sm bg-marca" />
                          <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">
                            {x.servico}
                          </span>
                          <span className="text-[13.5px] text-tinta-fraca">{ROTULO_ORIGEM[x.origem] ?? x.origem}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ),

          historico: (
            <section className={`${cartao} px-[18px] py-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                <h2 className="font-titulo text-[18px] font-semibold">Histórico</h2>
                <span className="text-[13.5px] text-tinta-fraca">
                  {frequencia === null
                    ? 'Ainda sem presença registrada'
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
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 pt-0.5">
                  {[['#0E7C6B', 'Presente'], ['#F6E7C9', 'Falta justificada'], ['#FBE4D9', 'Falta'], ['#E9E6F3', 'Licença']].map(
                    ([cor, rotulo]) => (
                      <span key={rotulo} className="inline-flex items-center gap-1.5 text-[12px] text-tinta-fraca">
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
                  texto="As presenças e faltas aparecem aqui conforme forem registradas."
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
                        <span className="w-[74px] shrink-0 text-[13.5px] text-tinta-fraca">
                          {curta(x.data)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px]">
                          {x.servico}
                        </span>
                        {x.origem !== 'recorrente' ? (
                          <span
                            className={`shrink-0 rounded-minima px-1.5 py-[3px] text-[12px] font-semibold ${
                              PAR[TINTA_ORIGEM[x.origem as keyof typeof TINTA_ORIGEM] ?? 'neutro']
                            }`}
                          >
                            {ROTULO_ORIGEM[x.origem] ?? x.origem}
                          </span>
                        ) : null}
                        <span
                          className={`shrink-0 rounded-peca px-2.5 py-1 text-[12px] font-medium ${
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
          ),

          reposicoes: (
            <section className="rounded-cartao border border-atencao-linha bg-atencao-superficie p-4">
              <ReposicoesAbertas
                pessoaId={p.id}
                nome={p.nome}
                servicos={catalogoServicos ?? []}
                rotuloSessao={rotulos.sessao.singular}
                podeAgendar={operacional}
                creditos={ficha.reposicoesAbertas.map((r) => ({
                  id: r.id,
                  sessaoId: r.sessaoId,
                  servicoId: r.servicoId,
                  servico: r.servico,
                  titulo: `${r.servico} · ${curta(r.data)} ${r.hora}`,
                  sub: ROTULO_STATUS[r.status] ?? r.status,
                }))}
              />
            </section>
          ),

          contratos: operacional ? (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-titulo text-[18px] font-semibold">
                  Contratos
                </h2>
                <NovaMatricula
                  pessoaId={id}
                  pessoaNome={ficha.pessoa.nome}
                  planos={await listarPlanos(db, conta.contaId)}
                  horarios={(await listarSeries(db, conta.contaId, conta.fuso))
                    .filter((s) => !s.encerrada)
                    .map((s) => ({
                      id: s.id,
                      diaSemana: s.diaSemana,
                      horaInicio: s.horaInicio,
                      codigo: s.codigo,
                      servicoId: s.servicoId,
                      servico: s.servico,
                      profissional: s.profissional,
                      local: s.local,
                      capacidade: s.capacidade,
                      ocupadas: s.ocupadas,
                      jaOcupa: ficha.vagas.some((v) => v.serieId === s.id
                        && v.contratoId === null && v.fim === null),
                    }))}
                />
              </div>

              <FaixaDeNumeros
                itens={[
                  {
                    rotulo: 'Já pagou',
                    valor: emReais(dinheiro.pagoCent),
                    tom: dinheiro.pagoCent > 0 ? 'positivo' : 'neutro',
                    nota: dinheiro.primeiroPagamento
                      ? `desde ${mesAno(dinheiro.primeiroPagamento)}`
                      : 'nenhum pagamento ainda',
                  },
                  {
                    rotulo: 'Em atraso',
                    valor: emReais(dinheiro.atrasadoCent),
                    tom: dinheiro.atrasadoCent > 0 ? 'alerta' : 'neutro',
                    nota: dinheiro.quantidadeAtrasada > 0
                      ? `${dinheiro.quantidadeAtrasada} ${dinheiro.quantidadeAtrasada === 1 ? 'cobrança vencida' : 'cobranças vencidas'}`
                      : 'nada vencido',
                  },
                  {
                    rotulo: 'Em aberto',
                    valor: emReais(dinheiro.abertoCent),
                    nota: 'vencido e a vencer, somados',
                  },
                  {
                    rotulo: 'Último pagamento',
                    valor: dinheiro.ultimoPagamento
                      ? curta(dinheiro.ultimoPagamento) : 'Nenhum',
                    nota: dinheiro.formaMaisUsada
                      ? `costuma pagar em ${ROTULO_FORMA[dinheiro.formaMaisUsada as Forma] ?? dinheiro.formaMaisUsada}`
                      : 'sem histórico',
                  },
                ]}
              />

              <ContratosDaFicha contratos={contratos} pessoaNome={ficha.pessoa.nome} />

              <div className="flex flex-col gap-2.5">
                <h3 className="font-titulo text-[18px] font-semibold">Cobranças</h3>
                <ListaDeCobrancas
                  linhas={cobrancas}
                  naFicha
                  vazio={{
                    titulo: 'Nenhuma cobrança ainda',
                    texto: 'Elas nascem do contrato, com a data de vencimento que ele diz. Sem contrato em vigor, não há o que cobrar.',
                  }}
                />
              </div>

              {/*
                * Os recibos da pessoa, na ficha dela.
                *
                * O recibo aparecia pendurado na linha do pagamento, e só. Quem
                * pergunta "manda de novo aquele recibo de março" não tinha por
                * onde começar sem abrir cobrança por cobrança.
                */}
              {recibosDela.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  <h3 className="font-titulo text-[18px] font-semibold">Recibos</h3>
                  <ListaDeRecibos
                    linhas={recibosDela}
                    envios={Object.fromEntries([...enviosDela].map(([rid, e]) => [
                      rid, { para: e.para, em: curta(e.em.slice(0, 10)) },
                    ]))}
                    emails={p.email ? { [p.id]: p.email } : {}}
                  />
                </div>
              ) : null}
            </div>
          ) : null,

          avaliacao: podeVerAvaliacao(conta.papel) ? (
            <PainelDeAvaliacao
              pessoaId={id}
              pessoaNome={ficha.pessoa.nome}
              carregar={painelDeAvaliacao}
              aoRegistrar={registrarAvaliacao}
              aoAdicionarPosicao={async (nome: string) => {
                'use server'
                await criarPosicao(nome)
              }}
            />
          ) : null,

        }}
      >
        <aside className="flex flex-col gap-3.5 xl:sticky xl:top-4">
          {licenca ? (
            <div className="hidden xl:block">
              <CartaoLicenca
                pessoaId={p.id}
                nome={p.nome}
                licencaId={licenca.id}
                inicio={licenca.inicio}
                voltaPrevista={licenca.voltaPrevista}
                podeMexer={operacional}
              />
            </div>
          ) : null}
          {p.observacao ? (
            <section className="rounded-grande border border-atencao-linha bg-atencao-superficie px-4 py-4">
              <div className="flex items-center gap-2 pb-2.5">
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-minima bg-atencao-fundo text-[12px] text-atencao"
                >
                  !
                </span>
                <span className="text-[12px] font-semibold text-atencao">
                  Atenção na aula
                </span>
              </div>
              <p className="text-[14.5px] leading-[1.55] text-[#414A47]">{p.observacao}</p>
            </section>
          ) : null}

          {/*
            * Restrita, a faixa continua existindo e diz que existe.
            *
            * Sumir por completo faria a ficha da recepção ficar igual à de quem
            * não tem observação nenhuma, e alguém escreveria por cima achando
            * que o campo estava vazio. Isto é o mesmo que a Sessão já faz com a
            * observação da chamada.
            */}
          {p.observacaoRestrita ? (
            <section className="rounded-grande border border-linha-suave bg-superficie-suave px-4 py-3.5">
              <p className="text-[13.5px] leading-[1.55] text-tinta-media">
                Há uma anotação nesta ficha escrita para quem atende. Se
                precisar dela, peça a quem escreveu.
              </p>
            </section>
          ) : null}

          <section className={`${cartao} px-4 py-4`}>
            <div className="pb-3">
              <Rotulo>Contato</Rotulo>
            </div>
            {/*
              * Telefone sem DDD é telefone que não disca.
              *
              * O cadastro e a API já recusam, mas a base veio de planilha onde
              * o número era anotado como se fala na recepção: "9.8109-1840".
              * Mostrar isso como telefone bom é prometer um aviso que não vai
              * sair: o `wa.me` precisa de país e DDD. Aqui ele aparece do jeito
              * que está, marcado, com o caminho para consertar.
              */}
            <p
              className={`pb-3 text-[14.5px] ${
                p.telefone && telefoneCompleto ? '' : 'text-alerta'
              }`}
            >
              {p.telefone ? exibirTelefone(p.telefone) : 'Sem telefone'}
            </p>
            {p.telefone && telefoneCompleto ? (
              <div className="flex gap-[7px]">
                <a
                  href={`https://wa.me/55${p.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-10 flex-1 items-center justify-center rounded-media border border-linha bg-superficie px-3 text-[13.5px] font-medium text-tinta transition-colors duration-150 hover:bg-superficie-mais-suave"
                >
                  Enviar WhatsApp
                </a>
                <CopiarTelefone telefone={p.telefone} />
              </div>
            ) : p.telefone ? (
              <p className="rounded-media bg-alerta-superficie px-3 py-2.5 text-[13.5px] leading-[1.5] text-alerta">
                {/* o defeito é dito por quem sabe qual é: número curto, DDD que
                    não existe e celular sem o 9 são três problemas diferentes,
                    e "falta o DDD" só acertava o primeiro */}
                {erroDoTelefone(p.telefone)} Sem isso não dá para mandar
                mensagem por aqui: abra &quot;Editar dados&quot; e escreva o
                número completo.
              </p>
            ) : (
              <p className="text-[13.5px] leading-[1.5] text-tinta-fraca">
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
                  className={`rounded-minima px-2 py-1 text-[12px] font-medium ${
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
            {/*
              * O que o plano é, não onde ele está. "O contrato em vigor tem o
              * valor e as parcelas" mandava a pessoa procurar a resposta numa
              * aba ao lado; o cartão agora diz plano, valor e vencimento. Quem
              * atende não vê dinheiro: lê só o nome do plano.
              */}
            {vigentes.length ? (
              <ul className="flex flex-col gap-2.5 pb-3">
                {vigentes.map((c) => (
                  <li key={c.id} className="flex flex-col gap-0.5">
                    <span className="text-[14.5px] font-medium">{c.nome}</span>
                    {c.detalhe ? (
                      <span className="text-[13.5px] text-tinta-media">{c.detalhe}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pb-3 text-[14.5px] text-tinta-media">Sem contrato em vigor.</p>
            )}
            {p.vencimentoPlano ? (
              <p className="pb-3 text-[13.5px] text-tinta-media">
                Válido até {p.vencimentoPlano.split('-').reverse().join('/')}
              </p>
            ) : null}
            {operacional ? (
              <div className="flex flex-wrap gap-2">
                {!temContrato ? (
                  <Link
                    href={`/pessoas/${id}?aba=contratos`}
                    className="flex min-h-10 flex-1 items-center justify-center rounded-media border border-linha bg-superficie px-3 text-[13.5px] font-medium hover:bg-superficie-mais-suave"
                  >
                    Criar contrato
                  </Link>
                ) : null}
              </div>
            ) : null}
            {p.vencimentoPlano || temContrato ? (
              <RegistrarRenovacao pessoaId={p.id} vencimento={p.vencimentoPlano} />
            ) : null}
          </section>


          {/* já anonimizada, fica o registro do que aconteceu; o botão de
              excluir mora junto das outras ações, no topo da ficha */}
          {p.anonimizadaEm ? (
            <p className="rounded-media bg-neutro-fundo px-3.5 py-3 text-[13.5px] leading-[1.55] text-tinta-media">
              Os dados desta pessoa foram apagados a pedido dela, em{' '}
              {curta(p.anonimizadaEm.slice(0, 10))}. O que ficou é o histórico
              de presença, sem nada que identifique alguém, e não dá para
              desfazer.
            </p>
          ) : null}
        </aside>
      </AbasDaFicha>
    </div>
    </ProvedorDeMatricula>
    </ProvedorDeAviso>
  )
}
