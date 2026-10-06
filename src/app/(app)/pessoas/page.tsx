import Link from 'next/link'
import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import {
  contarPessoas, listarPessoas, POR_PAGINA, type FiltroPessoa,
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
}

/** Etiqueta da conta com a primeira letra maiúscula: "lesão" e "Idoso" lado a lado parecia descuido. */
const capitular = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

type Busca = Promise<{ q?: string; f?: string | string[]; t?: string; p?: string }>

function quando(iso: string | null) {
  if (!iso) return 'Sem presença'
  const dias = Math.floor((Date.parse(new Date().toDateString()) - Date.parse(iso)) / 864e5)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 30) return `Há ${dias} dias`
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export default async function Pessoas({ searchParams }: { searchParams: Busca }) {
  const { q, f, t: tag, p: pag } = await searchParams
  const conta = await exigirPapel(OPERA, 'Pessoas')
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const filtros = (Array.isArray(f) ? f : f ? [f] : []) as FiltroPessoa[]
  const pagina = Math.max(1, Number(pag) || 1)

  const [{ linhas: pessoas, total }, contagem] = await Promise.all([
    listarPessoas(db, conta.contaId, {
      busca: q, filtros, tag, fuso: conta.fuso, pagina,
    }),
    contarPessoas(db, conta.contaId, { busca: q, fuso: conta.fuso }),
  ])

  // quem da página está de licença: a situação diz isso em vez de "ativa"
  const { data: licencas } = pessoas.length
    ? await db.from('licenca').select('pessoa_id').eq('conta_id', conta.contaId)
        .is('encerrada_em', null).in('pessoa_id', pessoas.map((x) => x.id))
    : { data: [] }
  const emLicenca = new Set((licencas ?? []).map((l) => l.pessoa_id))

  const cadastrados = contagem.ativos + contagem.inativos
  const semFiltro = filtros.length === 0 && !tag

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

  const daPagina = (n: number) => endereco((b) => { if (n > 1) b.set('p', String(n)) })
  const exportar = endereco(() => {}).replace('/pessoas', '/pessoas/exportar')

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[28px] leading-[1.05] font-semibold tracking-[-.02em]">
            {rotulos.pessoa.plural}
          </h1>
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
        <Chip href={endereco((b) => { b.delete('f'); b.delete('t') })} ativo={semFiltro}>
          Todos <Contador ativo={semFiltro}>{contagem.ativos}</Contador>
        </Chip>

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

        {/* inativo não é problema a resolver: é outra lista, e fica de lado */}
        <Chip href={alternar('inativa')} ativo={filtros.includes('inativa')}>
          Inativos <Contador ativo={filtros.includes('inativa')}>{contagem.porFiltro.inativa ?? 0}</Contador>
        </Chip>
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
        <Tabela largura={820} soNoDesktop rotulo={rotulos.pessoa.plural}>
          <Cabecalho>
            <Th fixa>Nome</Th>
            <Th className="max-md:hidden">Telefone</Th>
            <Th className="max-md:hidden">Horário fixo</Th>
            <Th className="max-md:hidden">Última presença</Th>
            <Th className="max-md:text-right">Situação</Th>
          </Cabecalho>
          <tbody>
            {pessoas.map((p) => {
              const [fundo, frente] = paresDe(p.nome)
              const situacao = situacaoDe({ ...p, deLicenca: emLicenca.has(p.id) })
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
                          {p.tags.map((x) => (
                            <span
                              key={x}
                              className={`shrink-0 rounded-minima px-1.5 py-[3px] text-[12px] font-semibold ${TINTA.atencao}`}
                            >
                              {capitular(x)}
                            </span>
                          ))}
                        </span>
                        {p.identificadorExterno ? (
                          <span className="truncate text-[12px] text-tinta-media">
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
          nota={NOTA_INATIVA}
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
