import Link from 'next/link'
import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { aulasDoPlanoDaConta, pacotesDaConta } from '@/server/contratos/pacotes'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import {
  contarPessoas, listarPessoas, POR_PAGINA, type FiltroPessoa, type OrdemPessoas,
} from '@/server/pessoas/consultas'
import { telefoneMascarado } from '@/core/pessoas/telefone'
import { situacaoDe, DIAS_CURTOS } from '@/core/pessoas/situacao'
import { NovaPessoa } from '@/components/pessoas/nova-pessoa'
import { SeletorDeEtiqueta } from '@/components/pessoas/etiquetas'
import { BuscaDePessoas } from '@/components/pessoas/busca'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { cartao, Chip, Paginacao, Vazio } from '@/components/ui/pecas'
import { LinhaQueAbre } from '@/components/ui/linha-que-abre'
import { CELULA, CELULA_FIXA, Cabecalho, LINHA, Tabela, Th } from '@/components/ui/tabela'
import { TINTA } from '@/components/ui/tintas'
import { AreaQueTroca } from '@/components/ui/troca'
import Carregando from './loading'
import { TituloDaTela } from '@/components/ui/titulo-da-tela'
import { EtiquetaGympass } from '@/components/pessoas/etiqueta-gympass'

/*
 * Cinco perguntas, e não dez. Cada uma é uma ligação a fazer: quem sumiu sem
 * avisar, quem está afastado, quem precisa renovar, quem não dá para avisar.
 * "Duas faltas seguidas" saiu (contava faltas quaisquer, não seguidas) e
 * "Sem horário fixo" também: em plano de horário livre isso é o normal.
 * Vencido e vencendo viraram uma só, porque a conversa é a mesma.
 */
const FILTROS: Array<{ valor: FiltroPessoa; rotulo: string }> = [
  // falta sem aviso nos últimos 30 dias: quem precisa de uma ligação
  { valor: 'faltou_sem_avisar', rotulo: 'Faltas recentes' },
  // licença aberta, a mesma de Pendências
  { valor: 'de_licenca',        rotulo: 'Em licença' },
  { valor: 'plano_a_renovar',   rotulo: 'Plano a renovar' },
  { valor: 'sem_telefone',      rotulo: 'Sem telefone' },
]

/*
 * Sem gênero e sem interpolar o rótulo da conta.
 *
 * O vocabulário é escolhido por quem usa, e há rótulo masculino e feminino
 * entre as escolhas possíveis: juntar o rótulo com "inativa" produz frases
 * que só aparecem depois de a conta trocar a palavra, muito longe daqui.
 */
const NOTA_INATIVA = 'Inativos aparecem no filtro Inativos.'

/*
 * O rótulo da situação na tela. O valor de `situacaoDe` também sai na API
 * (`situacao` da ficha) e o bot lê esse texto: a tela traduz, a API não muda.
 * "faltando" e "ativa" soavam informais e com gênero presumido.
 */
const SITUACAO_NA_TELA: Record<string, string> = {
  inativa: 'Inativo',
  'de licença': 'Em licença',
  'plano vencido': 'Plano vencido',
  'plano vencendo': 'Plano vencendo',
  faltando: 'Faltas recentes',
  ativa: 'Em dia',
  'pacote esgotado': 'Pacote esgotado',
  'pacote acabando': 'Pacote acabando',
  'pacote parado': 'Aulas a fazer',
}

/**
 * O pacote de aulas entra na situação só nesta tela.
 *
 * `situacaoDe` também responde a API do bot, que não conhece esses valores.
 * Esgotado e acabando passam na frente de "Em dia" e "Plano vencendo" (é a
 * mesma conversa, a renovação); aulas a fazer só na frente de "Em dia".
 */
function comPacote(
  s: ReturnType<typeof situacaoDe>, aviso: 'esgotado' | 'acabando' | 'parado' | undefined,
): { rotulo: string; tinta: ReturnType<typeof situacaoDe>['tinta'] } {
  if (!aviso) return s
  if (aviso === 'esgotado' && (s.rotulo === 'ativa' || s.rotulo === 'plano vencendo')) {
    return { rotulo: 'pacote esgotado', tinta: 'alerta' }
  }
  if (aviso === 'acabando' && (s.rotulo === 'ativa' || s.rotulo === 'plano vencendo')) {
    return { rotulo: 'pacote acabando', tinta: 'atencao' }
  }
  if (aviso === 'parado' && s.rotulo === 'ativa') return { rotulo: 'pacote parado', tinta: 'neutro' }
  return s
}

/** Etiqueta da conta com a primeira letra maiúscula: "lesão" e "Idoso" lado a lado parecia descuido. */
const capitular = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

type Busca = Promise<{ q?: string; f?: string | string[]; t?: string; p?: string; o?: string }>

/** `o=numero` sobe, `o=-numero` desce; sem `o`, nome de A a Z */
function lerOrdem(o: string | undefined): OrdemPessoas {
  const descendo = o?.startsWith('-') ?? false
  const campo = o?.replace(/^-/, '')
  return campo === 'numero' || campo === 'presenca'
    ? { campo, descendo }
    : { campo: 'nome', descendo: campo === 'nome' && descendo }
}

function quando(iso: string | null) {
  if (!iso) return 'Sem presença'
  const dias = Math.floor((Date.parse(new Date().toDateString()) - Date.parse(iso)) / 864e5)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 30) return `Há ${dias} dias`
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export default async function Pessoas({ searchParams }: { searchParams: Busca }) {
  const { q, f, t: tag, p: pag, o } = await searchParams
  const ordem = lerOrdem(o)
  const conta = await exigirPapel(OPERA, 'Pessoas')
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const filtros = (Array.isArray(f) ? f : f ? [f] : []) as FiltroPessoa[]
  const pagina = Math.max(1, Number(pag) || 1)
  // a situação é uma escolha só (ativos, inativos ou todos), e os filtros de
  // problema somam com ela
  const situacao: 'ativos' | 'inativa' | 'todas' =
    filtros.includes('todas') ? 'todas' : filtros.includes('inativa') ? 'inativa' : 'ativos'

  const [{ linhas: pessoas, total }, contagem] = await Promise.all([
    listarPessoas(db, conta.contaId, {
      busca: q, filtros, tag, fuso: conta.fuso, pagina, ordem,
    }),
    contarPessoas(db, conta.contaId, {
      busca: q, fuso: conta.fuso, situacao: situacao === 'ativos' ? undefined : situacao,
    }),
  ])

  // quem da página está de licença: a situação diz isso em vez de "ativa"
  const { data: licencas } = pessoas.length
    ? await db.from('licenca').select('pessoa_id').eq('conta_id', conta.contaId)
        .is('encerrada_em', null).in('pessoa_id', pessoas.map((x) => x.id))
    : { data: [] }
  const emLicenca = new Set((licencas ?? []).map((l) => l.pessoa_id))

  // o aviso do pacote de aulas, o mesmo de Pendências; quem tem dois pacotes
  // com aviso mostra o mais urgente
  const URGENCIA = { esgotado: 3, acabando: 2, parado: 1 } as const
  const avisoDoPacote = new Map<string, keyof typeof URGENCIA>()
  // falha aqui não derruba a lista: o aviso é extra, a lista é o essencial
  const pacotes = await pacotesDaConta(db, conta.contaId, conta.fuso)
    .catch((e) => { console.error('pacotes em Alunos', e); return [] })
  for (const k of pacotes) {
    const atual = avisoDoPacote.get(k.pessoaId)
    if (k.aviso && (!atual || URGENCIA[k.aviso] > URGENCIA[atual])) avisoDoPacote.set(k.pessoaId, k.aviso)
  }
  // plano semanal com aula do mês por marcar entra como "Aulas a fazer"
  const planos = await aulasDoPlanoDaConta(db, conta.contaId, conta.fuso)
    .catch((e) => { console.error('aulas do plano em Alunos', e); return [] })
  for (const k of planos) {
    if (!avisoDoPacote.has(k.pessoaId)) avisoDoPacote.set(k.pessoaId, 'parado')
  }

  const cadastrados = contagem.ativos + contagem.inativos

  /*
   * O contador do topo conta a busca inteira, não a página: com paginação, "24
   * cadastrados" tinha virado "20 cadastrados" a cada vez que a lista passasse
   * de uma página, um número errado que ninguém desconfiaria.
   */
  const endereco = (mudanca: (b: URLSearchParams) => void) => {
    const base = new URLSearchParams()
    if (q) base.set('q', q)
    for (const x of filtros) base.append('f', x)
    if (tag) base.set('t', tag)
    if (o) base.set('o', o)
    mudanca(base)
    const s = base.toString()
    return s ? `/pessoas?${s}` : '/pessoas'
  }

  // trocar de filtro sempre volta para a página 1: a página 4 do filtro
  // anterior quase nunca existe no novo
  const alternar = (valor: FiltroPessoa) =>
    endereco((b) => {
      b.delete('f')
      for (const x of filtros) if (x !== valor) b.append('f', x)
      if (!filtros.includes(valor)) b.append('f', valor)
    })

  // trocar a situação limpa os outros filtros: "Inativos" com "Faltas
  // recentes" ligado de antes dava uma lista vazia sem motivo aparente
  const deSituacao = (valor: typeof situacao) =>
    endereco((b) => {
      b.delete('f'); b.delete('t')
      if (valor !== 'ativos') b.append('f', valor)
    })

  // clicar na coluna que já ordena inverte o sentido; outra coluna começa subindo
  const ordenarPor = (campo: OrdemPessoas['campo']) =>
    endereco((b) => {
      b.delete('p')
      const valor = ordem.campo === campo && !ordem.descendo ? `-${campo}` : campo
      if (valor === 'nome') b.delete('o')
      else b.set('o', valor)
    })
  const Ordena = ({ campo, children }: { campo: OrdemPessoas['campo']; children: React.ReactNode }) => {
    const aqui = ordem.campo === campo
    return (
      <Link
        href={ordenarPor(campo)}
        aria-sort={aqui ? (ordem.descendo ? 'descending' : 'ascending') : undefined}
        className={`inline-flex items-center gap-1 hover:text-tinta ${aqui ? 'text-tinta' : ''}`}
      >
        {children}
        <span aria-hidden className={`text-[11px] ${aqui ? '' : 'opacity-0'}`}>
          {aqui && ordem.descendo ? '↓' : '↑'}
        </span>
      </Link>
    )
  }

  const daPagina = (n: number) => endereco((b) => { if (n > 1) b.set('p', String(n)) })
  const exportar = endereco(() => {}).replace('/pessoas', '/pessoas/exportar')

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <TituloDaTela tela="pessoas">
            {rotulos.pessoa.plural}
          </TituloDaTela>
          {/* três números, não um: "28 cadastrados" sozinho esconde que três
              pessoas pararam, e é justamente quem parou que se quer achar */}
          <p className="pt-[3px] text-[14.5px] text-tinta-media">
            {cadastrados} {cadastrados === 1 ? 'cadastrado' : 'cadastrados'}
            {' · '}{contagem.ativos} {contagem.ativos === 1 ? 'ativo' : 'ativos'}
            {' · '}{contagem.inativos} {contagem.inativos === 1 ? 'inativo' : 'inativos'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BuscaDePessoas
            valorInicial={q ?? ''}
            filtros={filtros}
            tag={tag}
            placeholder="Nome, telefone ou nº da ficha"
          />

          <a
            href={exportar}
            download
            className="hidden min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[14.5px] font-medium hover:bg-superficie-mais-suave md:inline-flex"
          >
            Exportar
          </a>

          <div data-guia="pessoas-novo">
            <NovaPessoa rotuloPessoa={rotulos.pessoa.singular} />
          </div>
        </div>
      </header>

      {/* Os filtros são o motivo desta tela existir: a planilha já dá a lista,
          o que ela não dá é "quem está sumindo" e "quem eu não consigo avisar".
          O número em cada chip é o que faz reparar sem precisar clicar. */}
      {/* no celular a faixa rola de lado, como na Agenda */}
      <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] *:shrink-0 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {([
          ['ativos', 'Ativos', contagem.ativos],
          ['inativa', 'Inativos', contagem.inativos],
          ['todas', 'Todos', contagem.ativos + contagem.inativos],
        ] as const).map(([valor, rotulo, n]) => (
          <Chip key={valor} href={deSituacao(valor)} ativo={situacao === valor}>
            {rotulo} <Contador ativo={situacao === valor}>{n}</Contador>
          </Chip>
        ))}

        <span aria-hidden className="mx-1 h-5 w-px bg-linha" />

        {FILTROS.map((x) => {
          const ativo = filtros.includes(x.valor)
          return (
            <Chip key={x.valor} href={alternar(x.valor)} ativo={ativo}>
              {x.rotulo} <Contador ativo={ativo}>{contagem.porFiltro[x.valor] ?? 0}</Contador>
            </Chip>
          )
        })}

        <span aria-hidden className="mx-1 h-5 w-px bg-linha" />

        {/* as etiquetas são da conta, não do código: "gestante" aqui é escolha
            do estúdio, e outra conta terá outras */}
        <SeletorDeEtiqueta
          atual={tag}
          limpar={endereco((b) => b.delete('t'))}
          opcoes={contagem.etiquetas.map((e) => ({
            tag: e.tag, n: e.n, href: endereco((b) => b.set('t', e.tag)),
          }))}
        />

      </div>

      {/* Tabela de verdade, como Cobranças: o cabeçalho de antes era uma
          grade desenhada por cima de uma lista, e no celular as colunas
          sumiam. Aqui a tabela rola de lado com o nome preso à esquerda. */}
      {pessoas.length === 0 ? (
        <section className={cartao}>
          <Vazio
            icone="pessoas"
            titulo="Nenhum resultado"
            texto="Ajuste os filtros ou cadastre um aluno pelo botão acima."
          />
        </section>
      ) : (
        <Tabela largura={880} soNoDesktop rotulo={rotulos.pessoa.plural}>
          <Cabecalho>
            <Th fixa><Ordena campo="nome">Nome</Ordena></Th>
            <Th className="max-md:hidden"><Ordena campo="numero">Nº</Ordena></Th>
            <Th className="max-md:hidden">Telefone</Th>
            <Th className="max-md:hidden">Horário fixo</Th>
            <Th className="max-md:hidden"><Ordena campo="presenca">Última presença</Ordena></Th>
            <Th className="max-md:text-right">Situação</Th>
          </Cabecalho>
          <tbody>
            {pessoas.map((p) => {
              const [fundo, frente] = paresDe(p.nome)
              const situacao = comPacote(
                situacaoDe({ ...p, deLicenca: emLicenca.has(p.id) }),
                avisoDoPacote.get(p.id),
              )
              const fone = telefoneMascarado(p.telefone)

              return (
                // a linha inteira abre a ficha; o link continua sendo só o nome
                <LinhaQueAbre key={p.id} href={`/pessoas/${p.id}`} className={LINHA}>
                  <td className={`${CELULA_FIXA} max-md:px-3`}>
                    <span className="flex items-center gap-2.5 md:min-w-[220px]">
                      <span
                        aria-hidden
                        className="flex size-8.5 shrink-0 items-center justify-center rounded-full text-[13.5px] leading-none font-semibold tracking-[-.02em]"
                        style={{ background: fundo, color: frente, opacity: p.ativo ? 1 : 0.55 }}
                      >
                        {iniciaisDe(p.nome)}
                      </span>
                      <span className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/pessoas/${p.id}`}
                            className="max-w-full text-[14.5px] font-medium hover:text-marca md:truncate"
                          >
                            {p.nome}
                          </Link>
                          {p.gympass ? <EtiquetaGympass /> : null}
                          {p.tags.map((x) => (
                            <span
                              key={x}
                              className={`shrink-0 rounded-minima px-1.5 py-[3px] text-[12px] font-semibold ${TINTA.atencao}`}
                            >
                              {capitular(x)}
                            </span>
                          ))}
                        </span>
                        {/* no desktop o número tem coluna própria */}
                        {p.identificadorExterno ? (
                          <span className="truncate text-[12px] text-tinta-media md:hidden">
                            Ficha nº {p.identificadorExterno}
                          </span>
                        ) : null}
                        {/* no celular a coluna Telefone some; o número desce para cá */}
                        <span className={`truncate text-[12px] md:hidden ${fone ? 'text-tinta-media' : 'text-alerta'}`}>
                          {fone ?? 'Sem telefone'}
                        </span>
                      </span>
                    </span>
                  </td>

                  <td className={`${CELULA} whitespace-nowrap text-[13.5px] tabular-nums text-tinta-media max-md:hidden`}>
                    {p.identificadorExterno ?? <span className="text-tinta-fraca">Sem nº</span>}
                  </td>

                  <td className={`${CELULA} whitespace-nowrap max-md:hidden`}>
                    <span
                      title={fone ? undefined : 'Sem telefone cadastrado'}
                      className={`text-[13.5px] ${fone ? 'text-tinta-media' : 'text-alerta'}`}
                    >
                      {fone ?? 'Sem telefone'}
                    </span>
                  </td>

                  <td className={`${CELULA} whitespace-nowrap text-[14.5px] max-md:hidden ${p.horarioFixo ? 'text-tinta-media' : 'text-tinta-fraca'}`}>
                    {p.horarioFixo ? (
                      <>
                        {DIAS_CURTOS[p.horarioFixo.diaSemana]} {p.horarioFixo.hora}
                        {p.vagasAtivas > 1 ? (
                          <span
                            className="ml-1.5 rounded-minima bg-superficie-mais-suave px-1.5 py-[2px] text-[12px] text-tinta-media"
                            title={`Mais ${p.vagasAtivas - 1} ${p.vagasAtivas - 1 === 1 ? 'horário' : 'horários'}`}
                          >
                            +{p.vagasAtivas - 1}
                          </span>
                        ) : null}
                      </>
                    ) : 'Sem horário fixo'}
                  </td>

                  <td className={`${CELULA} whitespace-nowrap text-[14.5px] text-tinta-media max-md:hidden`}>
                    {quando(p.ultimaPresenca)}
                  </td>

                  <td className={`${CELULA} max-md:pl-0 max-md:pr-3 max-md:text-right`}>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-[5px] text-[12px] font-medium whitespace-nowrap ${TINTA[situacao.tinta]}`}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {SITUACAO_NA_TELA[situacao.rotulo] ?? situacao.rotulo}
                    </span>
                  </td>
                </LinhaQueAbre>
              )
            })}
          </tbody>
        </Tabela>
      )}

      {total > 0 ? (
        <Paginacao
          pagina={pagina}
          total={total}
          porPagina={POR_PAGINA}
          hrefDe={daPagina}
          nota={situacao === 'ativos' ? NOTA_INATIVA : undefined}
        />
      ) : null}
    </div>
    </AreaQueTroca>
  )
}

/** O número dentro do chip: mesma linha, peso menor, nunca disputa o rótulo. */
function Contador({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  return (
    <span className={`text-[12px] ${ativo ? 'opacity-70' : 'text-tinta-fraca'}`}>
      {children}
    </span>
  )
}
