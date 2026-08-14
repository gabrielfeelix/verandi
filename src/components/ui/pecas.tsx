import Link from 'next/link'
import type { ReactNode } from 'react'
import { TINTA, TINTA_CHAPADA, PARES_AVATAR, type Tinta } from './tintas'
import { Icone, type NomeIcone } from './icones'

/**
 * As peças burras do design system. Nenhuma decide nada do domínio — quem sabe
 * o que é uma reposição é o `core/`, não um componente.
 */

/**
 * A superfície do cartão, sem estrutura nenhuma.
 *
 * Existe porque metade das seções do produto tem cabeçalho, rodapé ou grade
 * própria e não cabe dentro do `<Cartao>` — e o que não pode acontecer é cada
 * uma dessas escrever a borda e o raio de novo, cada vez de um jeito. Quem tem
 * título e corpo usa `<Cartao>`; quem não tem, usa esta classe.
 */
export const cartao = 'rounded-cartao border border-linha bg-superficie'

export function Cartao({
  titulo, acao, children, className = '',
}: {
  titulo?: ReactNode
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${cartao} ${className}`}>
      {titulo ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linha-fina px-[18px] py-3.5">
          <h2 className="font-titulo text-[17px] font-semibold">{titulo}</h2>
          {acao}
        </header>
      ) : null}
      <div className="px-[18px] py-4">{children}</div>
    </section>
  )
}

/** Etiqueta só de leitura: origem, status, ocupação. */
export function Etiqueta({
  tinta = 'neutro', glifo, icone, children,
}: {
  tinta?: Tinta
  /** glifo de texto, para quando não há ícone no vocabulário */
  glifo?: string
  icone?: NomeIcone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${TINTA[tinta]}`}
    >
      {icone ? <Icone nome={icone} tamanho={12} /> : null}
      {glifo && !icone ? <span aria-hidden>{glifo}</span> : null}
      {children}
    </span>
  )
}

/**
 * Ocupação: `usadas/capacidade`, sempre.
 *
 * Passar da capacidade **não é erro**. Fica laranja e a turma continua aceitando
 * encaixe — quem decide se cabe mais uma é quem está na sala, não o sistema.
 */
export function Ocupacao({ usadas, capacidade }: { usadas: number; capacidade: number }) {
  const cheia = usadas > capacidade
  return (
    <span
      className={`inline-flex items-center rounded-minima px-2 py-[3px] font-mono text-[12px] ${
        cheia ? 'bg-alerta-fundo text-alerta' : 'bg-superficie-mais-suave text-tinta-media'
      }`}
    >
      {usadas}/{capacidade}
      {cheia ? <span className="sr-only"> — acima da capacidade</span> : null}
    </span>
  )
}

/**
 * Chip de escolha. Ativo é escuro, inativo é branco com linha — o mesmo par do
 * protótipo. `ponto` desenha a cor do profissional antes do rótulo.
 *
 * Com `href` vira link, para filtro que mora na URL: assim a semana filtrada
 * pela Marina é um endereço que se manda por mensagem, e o botão voltar
 * desfaz o filtro em vez de sair da tela.
 */
export function Chip({
  ativo, ponto, href, children, ...resto
}: {
  ativo: boolean
  ponto?: string
  href?: string
  children: ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const estilo = `inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition-colors duration-150 ${
    ativo
      ? 'border-escuro bg-escuro font-medium text-tinta-clara'
      : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
  }`

  const dentro = (
    <>
      {ponto ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: ponto }}
        />
      ) : null}
      {children}
    </>
  )

  if (href) {
    return (
      <Link href={href} aria-current={ativo ? 'page' : undefined} className={estilo}>
        {dentro}
      </Link>
    )
  }

  return (
    <button type="button" aria-pressed={ativo} {...resto} className={estilo}>
      {dentro}
    </button>
  )
}

/** Rótulo em versalete, o `10.5px` com espaçamento do protótipo. */
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
      {children}
    </span>
  )
}

export function Campo({
  rotulo, dica, children, htmlFor,
}: {
  rotulo: string
  dica?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor}>
        <Rotulo>{rotulo}</Rotulo>
      </label>
      {children}
      {dica ? <span className="text-[12px] text-tinta-fraca">{dica}</span> : null}
    </div>
  )
}

/*
 * O campo vazio é branco com borda; o preenchido afunda para cinza. Não é
 * enfeite: numa configuração com trinta campos, é o que deixa ver de relance o
 * que já foi respondido sem ler nada.
 *
 * Os três estados moram no `@utility campo`, em `globals.css` — aqui é só o
 * nome, para nenhuma tela precisar reescrever a lista de classes e errar um
 * estado no caminho.
 */
export const entrada = 'campo'

/**
 * Nota que explica a **consequência**, não a mecânica.
 *
 * "As sessões que já aconteceram continuam no histórico" — não "vigência recebe
 * data de fim". Quem lê não tem o modelo de dados na cabeça.
 */
export function Nota({
  tom = 'neutro', children,
}: {
  tom?: Tinta
  children: ReactNode
}) {
  return (
    <p className={`rounded-media px-3.5 py-3 text-[12.5px] leading-[1.55] ${TINTA[tom]}`}>
      {children}
    </p>
  )
}

/**
 * Estado vazio: ícone, o que aconteceu, e **uma** ação.
 *
 * Dia sem aula é informação, não falha. "Nada marcado" e não "não foi possível
 * carregar" — a segunda frase manda a pessoa procurar um problema que não
 * existe.
 */
export function Vazio({
  icone = 'hoje', titulo, texto, acao,
}: {
  icone?: NomeIcone
  titulo: string
  texto?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-superficie-mais-suave text-tinta-fraca"
      >
        <Icone nome={icone} />
      </span>
      <h3 className="font-titulo text-[16px] font-semibold">{titulo}</h3>
      {texto ? (
        <p className="max-w-[42ch] text-[12.5px] leading-[1.55] text-tinta-apagada text-pretty">
          {texto}
        </p>
      ) : null}
      {acao ? <div className="pt-1">{acao}</div> : null}
    </div>
  )
}

/**
 * Paginação: onde estou, de quanto, e as duas setas.
 *
 * Qualquer lista que passe de ~20 itens ganha isto. Rolagem infinita numa lista
 * de pessoas parece moderna e tira a única coisa que quem procura alguém quer:
 * saber que a lista acabou.
 */
export function Paginacao({
  pagina, total, porPagina, aoIr, hrefDe, nota,
}: {
  pagina: number
  total: number
  porPagina: number
  /** para lista que pagina no cliente */
  aoIr?: (p: number) => void
  /** para lista que pagina pela URL — a página vira endereço e o voltar funciona */
  hrefDe?: (p: number) => string
  /**
   * A ressalva que explica o que a contagem não diz.
   *
   * "1–8 de 28" e, ao lado, "pessoa inativa não some, fica fora do padrão":
   * solta embaixo do cartão, essa frase virava rodapé que ninguém lê; grudada
   * no número, ela responde a pergunta no momento em que ela aparece.
   */
  nota?: string
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const ultimo = Math.min(pagina * porPagina, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[12px] text-tinta-fraca">
        {primeiro}–{ultimo} de {total}
        {nota ? <> · {nota}</> : null}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-tinta-fraca">
          página {pagina} de {paginas}
        </span>
        <Seta
          nome="antes"
          titulo="Página anterior"
          desligada={pagina <= 1}
          aoClicar={aoIr && (() => aoIr(pagina - 1))}
          href={hrefDe?.(pagina - 1)}
        />
        <Seta
          nome="depois"
          titulo="Próxima página"
          desligada={pagina >= paginas}
          aoClicar={aoIr && (() => aoIr(pagina + 1))}
          href={hrefDe?.(pagina + 1)}
        />
      </div>
    </div>
  )
}

const SETA =
  'inline-flex size-11 items-center justify-center rounded-padrao border border-linha ' +
  'text-tinta-media transition-colors duration-150 md:size-[34px]'

function Seta({
  nome, titulo, desligada, aoClicar, href,
}: {
  nome: NomeIcone
  titulo: string
  desligada: boolean
  aoClicar?: () => void
  href?: string
}) {
  /*
   * Desligada vira `<span>`, não link desabilitado: link não tem `disabled`, e
   * um `<a>` sem `href` continua sendo alvo de clique para quem navega por
   * teclado — só que não leva a lugar nenhum.
   */
  if (desligada || (!href && !aoClicar)) {
    return (
      <span aria-hidden className={`${SETA} text-linha-tracejada`}>
        <Icone nome={nome} />
      </span>
    )
  }

  if (href) {
    return (
      <Link href={href} title={titulo} aria-label={titulo} className={`${SETA} hover:bg-superficie-mais-suave`}>
        <Icone nome={nome} />
      </Link>
    )
  }

  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={aoClicar}
      className={`${SETA} cursor-pointer hover:bg-superficie-mais-suave`}
    >
      <Icone nome={nome} />
    </button>
  )
}

function paresDe(nome: string): readonly [string, string] {
  let soma = 0
  for (const c of nome) soma = (soma + c.codePointAt(0)!) % 997
  return PARES_AVATAR[soma % PARES_AVATAR.length]
}

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? '?'
  const segunda = partes[1]?.[0] ?? ''
  return (primeira + segunda).toUpperCase()
}

export function Avatar({
  nome, foto, tamanho = 32, anel, selo, decorativo = false,
}: {
  nome: string
  foto?: string | null
  tamanho?: 24 | 32 | 40 | 56
  /** cor do profissional, quando o avatar é de alguém da equipe */
  anel?: string
  /**
   * O selo do canto: presente, falta, falta avisada, licença.
   *
   * Fica no avatar e não numa coluna à parte porque o que se procura numa lista
   * de chamada é "quem ainda não tem marca" — e isso se vê varrendo os rostos,
   * não lendo linha por linha.
   */
  selo?: { tinta: Tinta; glifo: string }
  /**
   * O nome já está escrito ao lado.
   *
   * Sem isto o leitor de tela lê "Ruth Salgado, Ruth Salgado" em toda linha de
   * lista — que é a forma mais comum de piorar a leitura tentando melhorar.
   */
  decorativo?: boolean
}) {
  const [fundo, frente] = paresDe(nome)
  const fonte = tamanho === 24 ? 10 : tamanho === 32 ? 12 : tamanho === 40 ? 12.5 : 17

  const rosto = (
    <span
      title={nome}
      aria-hidden={decorativo || undefined}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-cover bg-center font-semibold"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: fonte,
        background: foto ? `url(${foto}) center/cover` : fundo,
        color: foto ? 'transparent' : frente,
        // o anel engrossa junto com o avatar; 1.5px some num de 56
        boxShadow: anel ? `inset 0 0 0 ${tamanho >= 38 ? 2 : 1.5}px ${anel}` : undefined,
      }}
    >
      <span aria-hidden>{foto ? '' : iniciaisDe(nome)}</span>
      {decorativo ? null : <span className="sr-only">{nome}</span>}
    </span>
  )

  if (!selo) return rosto

  return (
    <span className="relative inline-flex shrink-0">
      {rosto}
      <span
        aria-hidden
        className={`absolute -right-0.5 -bottom-0.5 flex size-[17px] items-center justify-center rounded-full border-2 border-superficie text-[9px] font-bold text-white ${TINTA_CHAPADA[selo.tinta]}`}
      >
        {selo.glifo}
      </span>
    </span>
  )
}

/** Bloco de carregamento. Some quando o dado chega; nunca fica de enfeite. */
export function Esqueleto({
  largura = '100%', altura = 14, raio, opacidade,
}: {
  largura?: string | number
  altura?: string | number
  raio?: number | string
  /** sobre o painel escuro o mesmo cinza precisa ser rebaixado para não brilhar */
  opacidade?: number
}) {
  return (
    <span
      aria-hidden
      className="block rounded-peca"
      style={{
        width: largura,
        height: altura,
        borderRadius: raio,
        opacity: opacidade,
        backgroundImage:
          'linear-gradient(90deg,#E4EAE7 25%,#F1F5F3 37%,#E4EAE7 63%)',
        backgroundSize: '400% 100%',
        animation: 'vd-brilha 1.5s ease-in-out infinite',
      }}
    />
  )
}
