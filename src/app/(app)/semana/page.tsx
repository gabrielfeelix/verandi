import Link from 'next/link'
import { Icone } from '@/components/ui/icones'
import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo } from '@/server/agenda/consultas'
import { diaDaSemanaDe, somarDias } from '@/core/agenda/datas'
import { CHAMADA_ABRE_ANTES_MS } from '@/core/agenda/chamada'
import { agoraMs, hojeEm, localDe } from '@/server/agenda/fuso'
import { GradeSemana } from '@/components/grade/grade-semana'
import { BotaoImprimir } from '@/components/ui/imprimir'
import { NovaAulaAvulsa } from '@/components/pessoas/aula-avulsa'
import { GradeMes } from '@/components/agenda/grade-mes'
import { PreCarregar } from '@/components/agenda/pre-carregar'
import { NavegadorPeriodo } from '@/components/ui/navegador-periodo'
import { DiaPorRecurso } from '@/components/grade/dia-por-recurso'
import { LinhaAgenda, AvatarProf } from '@/components/hoje/pecas'
import { Abas } from '@/components/ui/abas'
import { cartao, Chip, Vazio } from '@/components/ui/pecas'
import { Suspenso } from '@/components/ui/suspenso'
import { AreaQueTroca } from '@/components/ui/troca'
import Carregando from './loading'
import { TituloDaTela } from '@/components/ui/titulo-da-tela'

type Busca = Promise<{
  de?: string
  profissional?: string
  local?: string
  dia?: string
  modo?: string
  /** `AAAA-MM` (ou uma data dele) no modo Mês */
  mes?: string
  eixo?: string
  /** `sim`: só horário que ainda vai acontecer e tem lugar */
  vaga?: string
  /** `pendente` ou `feita`: as aulas pelo estado da chamada */
  chamada?: string
}>

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** A segunda-feira da semana que contém a data. */
function segundaDe(data: string): string {
  const d = diaDaSemanaDe(data)
  return somarDias(data, d === 0 ? -6 : 1 - d)
}

const SEMANA_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** "Terça, 6 de outubro": o mesmo jeito de dizer a data que a tela Hoje usa. */
function dataLonga(data: string) {
  return `${SEMANA_LONGA[diaDaSemanaDe(data)]}, ${Number(data.slice(8, 10))} de ${MESES[Number(data.slice(5, 7)) - 1]}`
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * "10 – 16 de agosto", e "28 de setembro – 4 de outubro" quando a semana vira
 * o mês. Dizer o mês duas vezes na mesma faixa é ruído; omiti-lo na virada
 * seria erro.
 */
function faixaDaSemana(de: string, ate: string) {
  const mesDe = Number(de.slice(5, 7)) - 1
  const mesAte = Number(ate.slice(5, 7)) - 1
  const diaDe = Number(de.slice(8, 10))
  const diaAte = Number(ate.slice(8, 10))
  return mesDe === mesAte
    ? `${diaDe} – ${diaAte} de ${MESES[mesAte]}`
    : `${diaDe} de ${MESES[mesDe]} – ${diaAte} de ${MESES[mesAte]}`
}

/** os três primeiros nomes: "Carolina Cristina Molina Santana" cabe no chip como "Carolina Cristina Molina" */
const nomeCurto = (nome: string) => nome.trim().split(/\s+/).slice(0, 3).join(' ')

const MESES_DO_BOTAO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** `2026-09-20` → `20 set` */
const diaCurto = (iso: string) => `${Number(iso.slice(8))} ${MESES_DO_BOTAO[Number(iso.slice(5, 7)) - 1]}`
/** `2026-09` + 1 → `2026-10` */
function mesMais(mes: string, n: number): string {
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function Semana({ searchParams }: { searchParams: Busca }) {
  const p = await searchParams
  const conta = await exigirPapel([...OPERA, 'profissional'], 'Agenda')
  const db = await clienteServidor()

  /*
   * A profissional vê a semana **dela**, e só ela: sem os filtros da equipe,
   * sem aula avulsa e sem grade fixa, que são coisa de quem opera o estúdio.
   * Sem cadastro de profissional ligado ao usuário não há aula dela, e o id
   * nulo garante a lista vazia em vez de cair na semana de todo mundo.
   */
  const ehProf = conta.papel === 'profissional'
  const eu = ehProf
    ? await (async () => {
        const { data: { user } } = await db.auth.getUser()
        const { data } = await db.from('profissional').select('id')
          .eq('conta_id', conta.contaId).eq('usuario_id', user?.id ?? '').maybeSingle()
        return data
      })()
    : null
  const filtroProf = ehProf ? (eu?.id ?? '00000000-0000-0000-0000-000000000000') : p.profissional
  const fuso = conta.fuso
  const hoje = hojeEm(fuso)
  const segunda = segundaDe(p.de ?? hoje)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
  const sabado = dias[6]

  const ehDia = p.modo === 'dia'
  // no modo dia a janela é de um dia só; na semana, os sete
  const diaFoco = p.dia ?? hoje
  // no modo mês, as semanas inteiras que o mês toca: a grade começa na
  // segunda e termina no domingo, como a semana
  const ehMes = p.modo === 'mes'
  const mesFoco = /^\d{4}-\d{2}/.test(p.mes ?? '') ? p.mes!.slice(0, 7) : hoje.slice(0, 7)
  const primeiroDoMes = `${mesFoco}-01`
  const ultimoDoMes = somarDias(`${mesMais(mesFoco, 1)}-01`, -1)
  const de = ehDia ? diaFoco : ehMes ? segundaDe(primeiroDoMes) : segunda
  const ate = ehDia ? diaFoco : ehMes ? somarDias(segundaDe(ultimoDoMes), 6) : sabado

  /*
   * Tudo de uma vez. Uma leitura depois da outra eram sete idas ao banco em
   * fila a cada clique em "próxima semana", e é esse clique que precisa ser
   * instantâneo.
   */
  const [
    { data: servicosAvulsa },
    vocabulario,
    { data: profissionais },
    { data: locais },
    todas,
    { data: aberturas },
    { data: excecoes },
  ] = await Promise.all([
    // as modalidades do botão "Aula avulsa" (a Agenda já é só de quem opera)
    db.from('servico').select('id, nome')
      .eq('conta_id', conta.contaId).eq('ativo', true).order('nome'),
    carregarVocabulario(db, conta.contaId),
    db.from('profissional').select('id, nome, cor')
      .eq('conta_id', conta.contaId).eq('ativo', true).order('nome'),
    db.from('local').select('id, nome')
      .eq('conta_id', conta.contaId).eq('ativo', true).order('nome'),
    sessoesDoIntervalo(db, conta.contaId, de, ate, {
      ...(filtroProf ? { profissionalId: filtroProf } : {}),
      ...(p.local ? { localId: p.local } : {}),
    }, fuso),
    // dia sem linha em `funcionamento` é dia fechado: é o que separa o sábado
    // vazio do sábado que a casa não abre
    db.from('funcionamento').select('dia_semana').eq('conta_id', conta.contaId),
    db.from('excecao_calendario').select('data, descricao, tipo')
      .eq('conta_id', conta.contaId).gte('data', de).lte('data', ate),
  ])
  const rotulos = resolverRotulos(vocabulario)

  /*
   * "Só com vaga" é o "tem horário quinta?" do balcão, respondido na própria
   * agenda: some o que já passou, o cancelado e o cheio. Era uma tela à parte
   * (Buscar vaga), com seis grupos de filtro antes do primeiro resultado.
   */
  const soComVaga = p.vaga === 'sim'
  const agora = new Date().toISOString()
  /*
   * A chamada, para achar o que ficou para trás. "Pendente" é só a aula cuja
   * chamada já abriu: a de amanhã ainda não tem o que fazer, e entrar no
   * filtro esconderia justamente as que faltam.
   */
  const filtroChamada = p.chamada === 'pendente' || p.chamada === 'feita' ? p.chamada : null
  const abertaAte = new Date(Date.parse(agora) + CHAMADA_ABRE_ANTES_MS).toISOString()
  const sessoes = todas.filter((s) => {
    if (soComVaga && !(s.status !== 'cancelada' && s.ocupacao.livres > 0 && s.inicio > agora)) return false
    if (filtroChamada === 'feita' && s.chamada !== 'feita') return false
    if (filtroChamada === 'pendente'
      && !(s.status !== 'cancelada' && s.chamada === 'pendente' && s.inicio <= abertaAte)) return false
    return true
  })

  const abertos = new Set((aberturas ?? []).map((a) => a.dia_semana))
  const fechados = new Set(
    abertos.size === 0 ? [] : [0, 1, 2, 3, 4, 5, 6].filter((d) => !abertos.has(d)),
  )

  const feriados = Object.fromEntries(
    (excecoes ?? []).map((e) => [e.data, e.descricao ?? e.tipo]),
  )

  const q = (extra: Record<string, string | undefined>) => {
    const base: Record<string, string> = { de: segunda }
    if (p.profissional) base.profissional = p.profissional
    if (p.local) base.local = p.local
    if (p.dia) base.dia = p.dia
    if (p.modo) base.modo = p.modo
    if (p.mes) base.mes = p.mes
    if (p.eixo) base.eixo = p.eixo
    if (p.vaga) base.vaga = p.vaga
    if (p.chamada) base.chamada = p.chamada
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) delete base[k]
      else base[k] = v
    }
    return `/semana?${new URLSearchParams(base)}`
  }

  // a ocupação é da semana inteira, mesmo com o filtro de vaga ligado
  const doPeriodo = ehMes ? sessoes.filter((s) => s.data.slice(0, 7) === mesFoco) : sessoes
  const vagas = (ehMes ? todas.filter((s) => s.data.slice(0, 7) === mesFoco) : todas).reduce(
    (acc, s) => ({
      ocupadas: acc.ocupadas + s.ocupacao.ocupadas,
      total: acc.total + s.ocupacao.capacidade,
    }),
    { ocupadas: 0, total: 0 },
  )
  const porcento = vagas.total
    ? Math.round((vagas.ocupadas / vagas.total) * 100)
    : 0

  // colunas do modo dia: sala é o padrão, porque é o recurso físico que se
  // esgota; profissional é a alternativa para quem separa por pessoa
  const porLocal = (p.eixo ?? 'local') === 'local'
  const doDia = sessoes.filter((s) => s.data === diaFoco)
  const localAtivo = (locais ?? []).find((l) => l.id === p.local)

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <PreCarregar
      hrefs={ehMes
        ? [1, -1, 2, -2].map((n) => q({ mes: mesMais(mesFoco, n) }))
        : ehDia
          ? [1, -1, 2, -2, 3, -3].map((n) => q({ dia: somarDias(diaFoco, n) }))
          : [1, -1, 2, -2, 3, -3, 4, -4].map((n) => q({ de: somarDias(segunda, 7 * n) }))}
    />
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <TituloDaTela tela="agenda">
            {ehProf
              ? (ehDia ? 'Meu dia' : ehMes ? 'Meu mês' : 'Minha semana')
              : ehDia ? 'Agenda do dia' : ehMes ? 'Agenda do mês' : 'Agenda da semana'}
          </TituloDaTela>
          <p className="pt-[3px] text-[14.5px] text-tinta-media">
            {ehDia
              ? dataLonga(diaFoco)
              : ehMes
                ? `${MESES[Number(mesFoco.slice(5, 7)) - 1]} de ${mesFoco.slice(0, 4)}`
                : faixaDaSemana(segunda, dias[6])}
            {' · '}
            {doPeriodo.length} {rotulos.sessao.plural.toLowerCase()}
            {vagas.total > 0 ? ` · ${porcento}% das vagas ocupadas` : ''}
          </p>
        </div>

        <div data-imprimir="fora" className="flex flex-wrap items-center gap-2.5">
          <Abas
            rotuloDoGrupo="Como ver a agenda"
            ativo={ehDia ? 'dia' : ehMes ? 'mes' : 'semana'}
            itens={[
              {
                id: 'semana', rotulo: 'Semana',
                href: q({ modo: undefined, mes: undefined, de: ehMes ? (mesFoco === hoje.slice(0, 7) ? hoje : primeiroDoMes) : undefined }),
              },
              {
                id: 'dia', rotulo: 'Dia',
                href: q({ modo: 'dia', mes: undefined, dia: ehMes ? (mesFoco === hoje.slice(0, 7) ? hoje : primeiroDoMes) : diaFoco }),
              },
              {
                id: 'mes', rotulo: 'Mês',
                // a quinta decide o mês da semana que vira a página
                href: q({ modo: 'mes', mes: (ehDia ? diaFoco : somarDias(segunda, 3)).slice(0, 7) }),
              },
            ]}
          />

          <NavegadorPeriodo
            antes={{
              href: ehMes
                ? q({ mes: mesMais(mesFoco, -1) })
                : ehDia
                  ? q({ dia: somarDias(diaFoco, -1) })
                  : q({ de: somarDias(segunda, -7) }),
              rotulo: ehMes ? 'Mês anterior' : ehDia ? 'Dia anterior' : 'Semana anterior',
            }}
            meio={{
              href: ehMes ? q({ mes: hoje.slice(0, 7) }) : ehDia ? q({ dia: hoje }) : q({ de: segundaDe(hoje) }),
              // fora do período atual, o botão diz onde se está: "Esta semana"
              // em cima de setembro fazia achar que a tela não tinha mudado
              texto: ehMes
                ? (mesFoco === hoje.slice(0, 7)
                    ? 'Este mês'
                    : `${MESES_DO_BOTAO[Number(mesFoco.slice(5, 7)) - 1]} ${mesFoco.slice(0, 4)}`)
                : ehDia
                ? (diaFoco === hoje ? 'Hoje' : diaCurto(diaFoco))
                : segunda === segundaDe(hoje)
                  ? 'Esta semana'
                  : `${Number(segunda.slice(8))}–${diaCurto(dias[6])}`,
            }}
            depois={{
              href: ehMes
                ? q({ mes: mesMais(mesFoco, 1) })
                : ehDia
                  ? q({ dia: somarDias(diaFoco, 1) })
                  : q({ de: somarDias(segunda, 7) }),
              rotulo: ehMes ? 'Próximo mês' : ehDia ? 'Próximo dia' : 'Próxima semana',
            }}
            irPara={{
              molde: ehMes ? q({ mes: 'AAAA-MM-DD' }) : ehDia ? q({ dia: 'AAAA-MM-DD' }) : q({ de: 'AAAA-MM-DD' }),
              modo: ehMes ? 'mes' : ehDia ? 'dia' : 'semana',
              atual: ehMes ? primeiroDoMes : ehDia ? diaFoco : segunda,
              hoje,
            }}
          />

          {/* no Dia, o eixo das colunas mora aqui, no lugar do imprimir: na
              faixa de filtros ele quebrava para a linha de baixo em 1440 */}
          {ehDia ? (
            <Abas
              rotuloDoGrupo="O que fica nas colunas"
              ativo={porLocal ? 'local' : 'profissional'}
              itens={[
                { id: 'local', rotulo: 'Por local', href: q({ eixo: 'local' }) },
                {
                  id: 'profissional',
                  rotulo: `Por ${rotulos.profissional.singular.toLowerCase()}`,
                  href: q({ eixo: 'profissional' }),
                },
              ]}
            />
          ) : null}

          {/* a grade fixa é o molde desta agenda, e não um jeito de vê-la: saiu
              do seletor Semana/Dia/Mês, onde parecia mais uma opção de visão */}
          {ehProf ? null : (
            <Link
              href="/grade"
              className="inline-flex min-h-11 items-center gap-2 rounded-media border border-linha bg-superficie px-4 text-[14.5px] font-medium transition-colors duration-150 hover:bg-superficie-mais-suave"
            >
              <Icone nome="grade" tamanho={16} />
              Grade fixa
            </Link>
          )}

          {/* imprimir a semana é coisa de balcão, não de telefone */}
          {!ehDia && !ehMes ? <span className="hidden md:contents"><BotaoImprimir /></span> : null}

          {ehProf ? null : <NovaAulaAvulsa servicos={servicosAvulsa ?? []} />}
        </div>
      </header>

      {/* Filtro por pessoa é o mais usado: a pergunta frequente é "como está a
          semana da Marina". O de local só aparece quando há mais de um lugar. */}
      {/* no celular a faixa rola de lado: quebrando, eram cinco linhas de
          filtro antes da primeira aula */}
      {ehProf ? null : (
      <div
        data-imprimir="fora"
        className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] *:shrink-0 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        <span data-guia="agenda-vaga" className="inline-flex">
          <Chip href={q({ vaga: soComVaga ? undefined : 'sim' })} ativo={soComVaga}>
            Só com vaga
          </Chip>
        </span>
        <span aria-hidden className="mx-1 h-5 w-px bg-linha" />
        <Chip href={q({ profissional: undefined })} ativo={!p.profissional}>
          Equipe inteira
        </Chip>
        {(profissionais ?? []).map((pr) => (
          <Chip
            key={pr.id}
            href={q({ profissional: p.profissional === pr.id ? undefined : pr.id })}
            ativo={p.profissional === pr.id}
          >
            <AvatarProf nome={pr.nome} cor={pr.cor} tamanho={20} />
            {nomeCurto(pr.nome)}
          </Chip>
        ))}

        {(locais ?? []).length > 1 ? (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-linha" />
            {/* local é filtro raro: num menu, em vez de mais três chips à vista */}
            <Suspenso
              rotulo={localAtivo ? localAtivo.nome : 'Todos os locais'}
              ativo={!!localAtivo}
              itens={[
                { rotulo: 'Todos os locais', href: q({ local: undefined }), ativo: !p.local },
                ...(locais ?? []).map((l) => ({
                  rotulo: l.nome, href: q({ local: l.id }), ativo: p.local === l.id,
                })),
              ]}
            />
          </>
        ) : null}

        <span aria-hidden className="mx-1 h-5 w-px bg-linha" />
        {/* menu, e não mais chips: é filtro de conferência, de fim de dia */}
        <Suspenso
          rotulo={filtroChamada === 'pendente' ? 'Chamada pendente'
            : filtroChamada === 'feita' ? 'Chamada realizada' : 'Chamada'}
          ativo={!!filtroChamada}
          itens={[
            { rotulo: 'Todas as aulas', href: q({ chamada: undefined }), ativo: !filtroChamada },
            { rotulo: 'Chamada pendente', href: q({ chamada: 'pendente' }), ativo: filtroChamada === 'pendente' },
            { rotulo: 'Chamada realizada', href: q({ chamada: 'feita' }), ativo: filtroChamada === 'feita' },
          ]}
        />
      </div>
      )}

      {ehMes ? (
        <GradeMes
          sessoes={sessoes}
          mes={mesFoco}
          hoje={hoje}
          fechados={fechados}
          feriados={feriados}
          hrefDoDia={(dia) => q({ modo: 'dia', mes: undefined, dia })}
          rotuloSessoes={rotulos.sessao.plural.toLowerCase()}
        />
      ) : ehDia ? (
        <>
          {feriados[diaFoco] ? (
            <span className="self-start rounded-peca bg-atencao-fundo px-2.5 py-1 text-[12px] font-medium text-atencao">
              {feriados[diaFoco]}
            </span>
          ) : null}

          <DiaPorRecurso
            sessoes={sessoes}
            eixo={porLocal ? 'Local' : rotulos.profissional.singular}
            recursos={
              porLocal
                ? (locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))
                : (profissionais ?? []).filter((pr) => !ehProf || pr.id === eu?.id).map((pr) => ({
                    id: pr.id, nome: pr.nome, cor: pr.cor,
                  }))
            }
            chaveDe={(s) => (porLocal ? s.localId : s.profissionalId)}
            vazio={soComVaga
              ? 'Nenhum horário com vaga neste dia.'
              : ''}
            rotuloSessao={rotulos.sessao}
          />
        </>
      ) : soComVaga && sessoes.length === 0 ? (
        <div className="rounded-grande border border-dashed border-linha-tracejada">
          <Vazio
            icone="semana"
            titulo="Nenhum horário com vaga nesta semana"
            texto="Os horários desta semana estão completos. Veja a próxima semana."
          />
        </div>
      ) : (
        <>
          <div data-imprimir="inteiro" className="hidden md:block print:block">
            <GradeSemana
              sessoes={sessoes}
              dias={dias}
              feriados={feriados}
              hoje={hoje}
              fechados={fechados}
              agora={dias.includes(hoje) ? localDe(new Date(agoraMs()).toISOString(), fuso).hora : null}
              rotuloSessoes={rotulos.sessao.plural.toLowerCase()}
              podeMontar={!ehProf}
            />
          </div>

          {/* Em celular sete colunas não cabem: vira um dia por vez. */}
          <div data-imprimir="fora" className="md:hidden">
            <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Dias da semana">
              {dias.map((d) => (
                <Link
                  key={d}
                  href={q({ dia: d })}
                  aria-current={d === diaFoco ? 'page' : undefined}
                  className={`flex min-h-11 min-w-11 flex-col items-center justify-center rounded-padrao border px-2 ${
                    d === diaFoco
                      ? 'border-escuro bg-escuro text-tinta-clara'
                      : 'border-linha bg-superficie'
                  }`}
                >
                  <span className="text-[12px] font-medium capitalize">
                    {DIAS_CURTOS[diaDaSemanaDe(d)]}
                  </span>
                  <span className="text-[14.5px]">{d.slice(8)}</span>
                </Link>
              ))}
            </nav>

            {feriados[diaFoco] ? (
              <p className="mb-2 rounded-padrao bg-atencao-fundo px-3 py-2 text-[13.5px] text-atencao">
                {feriados[diaFoco]}
              </p>
            ) : null}

            {doDia.length === 0 ? (
              <div className="rounded-grande border border-dashed border-linha-tracejada">
                <Vazio
                  icone="semana"
                  desenho="dia"
                  titulo={soComVaga ? 'Nenhum horário com vaga neste dia' : 'Nada marcado neste dia'}
                  texto={soComVaga ? 'Escolha outro dia acima.' : undefined}
                />
              </div>
            ) : (
              <ul
                className={`flex flex-col ${cartao} p-1.5`}
                aria-label={rotulos.sessao.plural}
              >
                {doDia.map((s) => (
                  <LinhaAgenda key={s.id} sessao={s} passou={false} agora={false} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* a amostra é a célula em miniatura, com a borda reforçada: no tamanho
          real as cores claras sumiam no fundo, e a legenda não se lia */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-tinta-media">
        {[
          ['bg-superficie border-tinta-inativa', 'Com vaga'],
          ['bg-alerta-fundo border-alerta/60', 'Lotada'],
          ['bg-superficie-mais-suave border-tinta-inativa border-dashed', 'Cancelada'],
          ['bg-superficie-tenue border-linha-tracejada', 'Horário vazio'],
          ['bg-neutro-fundo border-tinta-inativa', 'Fechado'],
        ].map(([cor, rotulo]) => (
          <span key={rotulo} className="inline-flex items-center gap-2">
            <span aria-hidden className={`h-3.5 w-5 rounded-[4px] border ${cor}`} />
            {rotulo}
          </span>
        ))}
      </div>
    </div>
    </AreaQueTroca>
  )
}
