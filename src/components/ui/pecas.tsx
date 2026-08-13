import type { ReactNode } from 'react'
import { TINTA, PARES_AVATAR, type Tinta } from './tintas'

/**
 * As peças burras do design system. Nenhuma decide nada do domínio — quem sabe
 * o que é uma reposição é o `core/`, não um componente.
 */

export function Cartao({
  titulo, acao, children, className = '',
}: {
  titulo?: ReactNode
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[--radius-cartao] border border-linha-suave bg-superficie ${className}`}
    >
      {titulo ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linha-suave px-4 py-3">
          <h2 className="font-titulo text-[17px] font-medium">{titulo}</h2>
          {acao}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Etiqueta só de leitura: origem, status, ocupação. */
export function Etiqueta({
  tinta = 'neutro', glifo, children,
}: {
  tinta?: Tinta
  glifo?: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[--radius-peca] px-2 py-1 text-[11.5px] font-medium ${TINTA[tinta]}`}
    >
      {glifo ? <span aria-hidden>{glifo}</span> : null}
      {children}
    </span>
  )
}

/**
 * Chip de escolha. Ativo é escuro, inativo é branco com linha — o mesmo par do
 * protótipo. `ponto` desenha a cor do profissional antes do rótulo.
 */
export function Chip({
  ativo, ponto, children, ...resto
}: {
  ativo: boolean
  ponto?: string
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      {...resto}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors duration-75 ${
        ativo
          ? 'border-escuro bg-escuro font-medium text-tinta-clara'
          : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-suave'
      }`}
    >
      {ponto ? (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: ponto }}
        />
      ) : null}
      {children}
    </button>
  )
}

/** Rótulo em versalete, o `10.5px` com espaçamento do protótipo. */
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] font-medium tracking-[.1em] text-tinta-fraca uppercase">
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
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium">
        {rotulo}
      </label>
      {children}
      {dica ? <span className="text-[11.5px] text-tinta-media">{dica}</span> : null}
    </div>
  )
}

export const entrada =
  'min-h-11 rounded-[--radius-padrao] border border-linha bg-superficie px-3 text-[13px] ' +
  'placeholder:text-tinta-fraca'

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
    <p className={`rounded-[--radius-padrao] px-3 py-2.5 text-[12.5px] ${TINTA[tom]}`}>
      {children}
    </p>
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
  nome, foto, tamanho = 32, anel, decorativo = false,
}: {
  nome: string
  foto?: string | null
  tamanho?: 24 | 32 | 40
  /** cor do profissional, quando o avatar é de alguém da equipe */
  anel?: string
  /**
   * O nome já está escrito ao lado.
   *
   * Sem isto o leitor de tela lê "Ruth Salgado, Ruth Salgado" em toda linha de
   * lista — que é a forma mais comum de piorar a leitura tentando melhorar.
   */
  decorativo?: boolean
}) {
  const [fundo, frente] = paresDe(nome)
  const fonte = tamanho === 24 ? 10 : tamanho === 32 ? 12 : 14
  return (
    <span
      title={nome}
      aria-hidden={decorativo || undefined}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-cover bg-center font-medium"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: fonte,
        background: foto ? `url(${foto}) center/cover` : fundo,
        color: foto ? 'transparent' : frente,
        boxShadow: anel ? `inset 0 0 0 1.5px ${anel}` : undefined,
      }}
    >
      <span aria-hidden>{foto ? '' : iniciaisDe(nome)}</span>
      {decorativo ? null : <span className="sr-only">{nome}</span>}
    </span>
  )
}

/** Bloco de carregamento. Some quando o dado chega; nunca fica de enfeite. */
export function Esqueleto({
  largura = '100%', altura = 14,
}: {
  largura?: string | number
  altura?: number
}) {
  return (
    <span
      aria-hidden
      className="block rounded-[--radius-peca]"
      style={{
        width: largura,
        height: altura,
        backgroundImage:
          'linear-gradient(90deg,#E4EAE7 25%,#F1F5F3 37%,#E4EAE7 63%)',
        backgroundSize: '400% 100%',
        animation: 'vd-brilha 1.5s ease-in-out infinite',
      }}
    />
  )
}
