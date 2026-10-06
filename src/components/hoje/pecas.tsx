import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SessaoResumo } from '@/server/agenda/consultas'
import { PARES_AVATAR, fonteDasIniciais } from '@/components/ui/tintas'
import { cartao } from '@/components/ui/pecas'

/**
 * As peças da tela Hoje, com as medidas literais do protótipo.
 *
 * Elas moram aqui e não em `ui/` porque decidem coisa de layout desta tela: o
 * que é primitivo (avatar, etiqueta, botão) continua vindo de `ui/`.
 */

export function paresDe(nome: string): readonly [string, string] {
  let soma = 0
  for (const c of nome) soma = (soma + c.codePointAt(0)!) % 997
  return PARES_AVATAR[soma % PARES_AVATAR.length]
}

export function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome
}

/** O avatar redondo de quem atende, com o anel na cor dele. */
export function AvatarProf({
  nome, cor, tamanho = 28,
}: {
  nome: string
  cor?: string | null
  tamanho?: number
}) {
  const [fundo, frente] = paresDe(nome)
  return (
    <span
      title={nome}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full leading-none font-semibold tracking-[-.02em]"
      style={{
        width: tamanho,
        height: tamanho,
        // o anel de 1,5px entra no círculo e come a folga das letras
        fontSize: fonteDasIniciais(tamanho - 3),
        background: fundo,
        color: frente,
        boxShadow: `inset 0 0 0 1.5px ${cor ?? frente}`,
      }}
    >
      {iniciaisDe(nome)}
    </span>
  )
}

/** A pilha de avatares de quem está na turma, sobrepostos como no protótipo. */
export function PilhaPessoas({
  pessoas, apagado = false,
}: {
  pessoas: Array<{ nome: string }>
  apagado?: boolean
}) {
  return (
    /* o `pr` compensa o `marginRight` negativo do último avatar: sem ele a
       pilha fica 6px mais estreita que o conteúdo e o primeiro rosto aparece
       cortado pela coluna ao lado. Seis e não nove: com nove o rosto de cima
       cobria a segunda inicial do de baixo */
    <span className="flex items-center pr-[6px]" style={{ opacity: apagado ? 0.55 : 1 }}>
      {pessoas.slice(0, 5).map((p, i) => {
        const [fundo, frente] = paresDe(p.nome)
        return (
          <span
            key={`${p.nome}-${i}`}
            title={p.nome}
            className="flex size-[27px] items-center justify-center rounded-full border-2 border-superficie leading-none font-semibold tracking-[-.02em]"
            style={{ background: fundo, color: frente, marginRight: -6, fontSize: fonteDasIniciais(23) }}
          >
            <span aria-hidden>{iniciaisDe(p.nome)}</span>
            <span className="sr-only">{p.nome}</span>
          </span>
        )
      })}
      {pessoas.length > 5 ? (
        <span className="flex size-[27px] items-center justify-center rounded-full border-2 border-superficie bg-superficie-mais-suave text-[10px] leading-none font-semibold tracking-[-.02em] text-tinta-media">
          +{pessoas.length - 5}
        </span>
      ) : null}
    </span>
  )
}

const ESTADO: Record<string, { rotulo: string; bg: string; fg: string }> = {
  feita: { rotulo: 'Feita', bg: 'bg-positivo-fundo', fg: 'text-positivo' },
  pendente: { rotulo: 'Pendente', bg: 'bg-alerta-fundo', fg: 'text-alerta' },
  sem_ninguem: { rotulo: 'Vazia', bg: 'bg-neutro-fundo', fg: 'text-neutro' },
  aberta: { rotulo: 'Aberta', bg: 'bg-neutro-fundo', fg: 'text-neutro' },
  cancelada: { rotulo: 'Cancelada', bg: 'bg-neutro-fundo', fg: 'text-neutro' },
}

/** A pílula com o ponto: cor nunca informa sozinha, o texto vem junto. */
export function SeloEstado({ estado }: { estado: keyof typeof ESTADO | string }) {
  const e = ESTADO[estado] ?? ESTADO.aberta
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-[5px] text-[12.5px] font-medium ${e.bg} ${e.fg}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {e.rotulo}
    </span>
  )
}

/**
 * Uma turma na agenda do dia.
 *
 * A grade de cinco colunas é a do protótipo: hora, quem atende, o que é, quem
 * está, e como está a chamada.
 */
export function LinhaAgenda({
  sessao, passou, agora,
}: {
  sessao: SessaoResumo
  passou: boolean
  agora: boolean
}) {
  const cancelada = sessao.status === 'cancelada'
  const estado = cancelada
    ? 'cancelada'
    : passou
      ? sessao.chamada
      : 'aberta'

  const nota = [
    sessao.local,
    cancelada
      ? `cancelada, ${sessao.motivoCancelamento ?? 'Sem motivo'}`
      : agora
        ? 'próxima'
        : passou && sessao.chamada === 'feita'
          ? resumoDaChamada(sessao)
          : passou && sessao.chamada === 'pendente'
            ? 'ninguém registrou'
            : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/sessao/${sessao.id}`}
      // no celular as cinco colunas não cabem: o avatar sai (o nome do
      // professor já está na nota), e rostos e ocupação descem para baixo do
      // nome, em vez de espremê-lo até o professor sumir
      className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[66px_30px_minmax(0,1fr)_auto_auto] sm:gap-3.5 rounded-media p-3 transition-[background-color,transform] duration-200 hover:translate-x-0.5 hover:bg-superficie-mais-suave ${
        agora ? 'bg-[#F3F8F6]' : ''
      }`}
    >
      <span className="flex flex-col">
        <span
          className={`font-mono text-[16px] ${cancelada ? 'text-tinta-fraca line-through' : passou ? 'text-tinta-media' : 'text-tinta'}`}
        >
          {sessao.hora}
        </span>
        <span className="text-[12px] text-tinta-media">{sessao.duracaoMin} min</span>
      </span>

      <span
        className="hidden items-center justify-center self-stretch sm:flex"
        style={{ opacity: passou ? 0.6 : 1 }}
      >
        {sessao.profissional ? (
          <AvatarProf nome={sessao.profissional} cor={sessao.corProfissional} />
        ) : null}
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span
          className={`truncate text-[16px] font-medium ${cancelada ? 'text-tinta-fraca line-through' : ''}`}
        >
          {sessao.servico}
        </span>
        <span className="truncate text-[13px] text-tinta-media">
          {[sessao.profissional, nota].filter(Boolean).join(' · ')}
        </span>
      </span>

      <span className="col-start-2 row-start-2 flex items-center sm:col-start-auto sm:row-start-auto">
        <PilhaPessoas pessoas={sessao.pessoas} apagado={passou} />
        <span className="w-[18px]" />
        <span
          className={`rounded-peca px-2 py-[3px] font-mono text-[13px] ${
            // laranja só acima da capacidade, como no protótipo: turma cheia é
            // estado normal do dia, e pintar toda turma de alerta apagaria o
            // único caso que pede olho: o 5/4
            sessao.ocupacao.excedida
              ? 'bg-alerta-fundo text-alerta'
              : 'bg-superficie-mais-suave text-tinta-media'
          }`}
        >
          {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
        </span>
      </span>

      <SeloEstado estado={estado} />
    </Link>
  )
}

function resumoDaChamada(s: SessaoResumo) {
  const presentes = s.pessoas.filter((p) => p.status === 'presente').length
  const faltas = s.pessoas.filter(
    (p) => p.status === 'falta' || p.status === 'falta_avisada',
  ).length
  const partes = [
    presentes ? `${presentes} presença${presentes > 1 ? 's' : ''}` : null,
    faltas ? `${faltas} falta${faltas > 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(', ') : 'registrada'
}

/** O cabeçalho de período: MANHÃ, TARDE, NOITE. */
export function FaixaPeriodo({
  titulo, n, rotulo,
}: {
  titulo: string
  n: number
  /** o vocabulário da conta: "turmas" no pilates, "atendimentos" na clínica */
  rotulo: { singular: string; plural: string }
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-2">
      <span className="text-[12px] font-semibold tracking-[.12em] text-tinta-media uppercase">
        {titulo}
      </span>
      <span aria-hidden className="h-px flex-1 bg-linha-fina" />
      <span className="text-[12.5px] text-tinta-media">
        {n} {(n === 1 ? rotulo.singular : rotulo.plural).toLowerCase()}
      </span>
    </div>
  )
}

/** Cartão branco de 20px de raio: a caixa padrão do protótipo. */
export function Bloco({
  titulo, acao, children, className = '',
}: {
  titulo?: ReactNode
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`${cartao} p-4 ${className}`}
    >
      {titulo ? (
        <div className="flex items-baseline justify-between pb-3">
          <h2 className="font-titulo text-[18px] font-semibold">{titulo}</h2>
          {acao}
        </div>
      ) : null}
      {children}
    </section>
  )
}
