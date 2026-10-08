/**
 * As ilustrações dos estados vazios.
 *
 * Mesmo princípio do AutoFluxos (`autofluxos/src/components/design/ilustracoes.tsx`):
 * desenho nosso, em traço, com `currentColor` e nunca hex. A cor vem de quem
 * envolve, então a ilustração acompanha o tema sem fundo branco embutido.
 *
 * Cada desenho mostra **a tela cheia, em fantasma**: o dia com as aulas, a lista
 * com as pessoas, o recibo com as linhas. Quem nunca viu a tela funcionando
 * entende o que ela vira olhando. Um ícone solto num círculo (o vazio de antes)
 * parecia defeito de carregamento.
 *
 * As artes em `public/acesso/` são pintura de tela cheia; aqui o vazio precisa
 * de algo leve, que ocupe o espaço sem competir com o texto e o botão.
 */
import type { ReactNode } from 'react'

export type Desenho =
  | 'dia'
  | 'semana'
  | 'grade'
  | 'pessoas'
  | 'dinheiro'
  | 'lista'
  | 'tudo-certo'
  | 'erro'
  | 'fotos'
  | 'contrato'
  | 'local'
  | 'servicos'

const TRACO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Barra cheia: título, nome, valor. É o "texto" do desenho. */
function Barra({ x, y, w, o = 0.5, h = 4.5 }: { x: number; y: number; w: number; o?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" opacity={o} />
}

function Tela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 120"
      role="img"
      aria-label={titulo}
      className="ilu mx-auto h-[104px] w-auto text-marca"
    >
      {children}
    </svg>
  )
}

/** O dia: régua de horas à esquerda, aulas encaixadas, um horário livre. */
function Dia() {
  return (
    <Tela titulo="Um dia com aulas em sequência">
      <rect x={30} y={8} width={140} height={104} rx={9} {...TRACO} opacity={0.4} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Barra x={40} y={24 + i * 30} w={14} o={0.45} h={4} />
          <line x1={60} y1={26 + i * 30} x2={160} y2={26 + i * 30} {...TRACO} opacity={0.15} />
        </g>
      ))}
      <rect x={64} y={16} width={88} height={22} rx={5} {...TRACO} opacity={0.75} />
      <Barra x={72} y={22} w={36} o={0.8} />
      <circle cx={76} cy={31.5} r={2.6} fill="currentColor" opacity={0.5} />
      <circle cx={83} cy={31.5} r={2.6} fill="currentColor" opacity={0.5} />
      <circle cx={90} cy={31.5} r={2.6} fill="currentColor" opacity={0.5} />
      <rect x={64} y={46} width={88} height={22} rx={5} {...TRACO} opacity={0.75} />
      <Barra x={72} y={52} w={28} o={0.8} />
      <circle cx={76} cy={61.5} r={2.6} fill="currentColor" opacity={0.5} />
      <circle cx={83} cy={61.5} r={2.6} fill="currentColor" opacity={0.5} />
      <rect x={64} y={76} width={88} height={22} rx={5} {...TRACO} strokeDasharray="3 4" opacity={0.5} />
      <path d="M108 83v8M104 87h8" {...TRACO} opacity={0.6} />
    </Tela>
  )
}

/** A semana: cinco colunas, aulas em alturas diferentes. */
function Semana() {
  const aulas: [number, number][] = [[0, 0], [0, 2], [1, 1], [2, 0], [2, 1], [3, 2], [4, 0], [4, 1]]
  return (
    <Tela titulo="Uma semana com aulas distribuídas pelos dias">
      <rect x={14} y={8} width={172} height={104} rx={9} {...TRACO} opacity={0.4} />
      {[0, 1, 2, 3, 4].map((c) => (
        <Barra key={c} x={26 + c * 32} y={18} w={16} o={0.55} h={4} />
      ))}
      <line x1={22} y1={30} x2={178} y2={30} {...TRACO} opacity={0.2} />
      {aulas.map(([c, l]) => (
        <rect
          key={`${c}-${l}`}
          x={24 + c * 32}
          y={38 + l * 24}
          width={26}
          height={18}
          rx={4}
          {...TRACO}
          opacity={0.7}
        />
      ))}
      {aulas.map(([c, l]) => (
        <Barra key={`b${c}-${l}`} x={29 + c * 32} y={44 + l * 24} w={12} o={0.6} h={3.5} />
      ))}
    </Tela>
  )
}

/** A grade fixa: a mesma semana, os horários que se repetem marcados. */
function Grade() {
  return (
    <Tela titulo="Uma grade de horários fixos que se repetem toda semana">
      <rect x={20} y={8} width={160} height={104} rx={9} {...TRACO} opacity={0.4} />
      {[0, 1, 2, 3].map((l) => (
        <line key={l} x1={28} y1={34 + l * 20} x2={172} y2={34 + l * 20} {...TRACO} opacity={0.15} />
      ))}
      {[0, 1, 2, 3, 4].map((c) => (
        <Barra key={c} x={44 + c * 26} y={18} w={12} o={0.55} h={4} />
      ))}
      {[0, 1, 2].map((l) => (
        <Barra key={`h${l}`} x={30} y={40 + l * 20} w={8} o={0.4} h={4} />
      ))}
      {[[0, 0], [2, 0], [4, 0], [1, 1], [3, 1], [0, 2], [2, 2], [4, 2]].map(([c, l]) => (
        <rect
          key={`${c}-${l}`}
          x={41 + c * 26}
          y={37 + l * 20}
          width={18}
          height={11}
          rx={3}
          fill="currentColor"
          opacity={0.22 + (c % 2) * 0.2}
        />
      ))}
      <Barra x={41} y={98} w={44} o={0.35} h={4} />
    </Tela>
  )
}

/** A lista de pessoas: avatar, nome, situação. */
function Pessoas() {
  return (
    <Tela titulo="Uma lista de pessoas com foto e situação">
      <rect x={30} y={8} width={140} height={104} rx={9} {...TRACO} opacity={0.4} />
      {[0, 1, 2].map((i) => (
        <g key={i} opacity={1 - i * 0.22}>
          <circle cx={52} cy={30 + i * 30} r={9} {...TRACO} />
          <circle cx={52} cy={27.5 + i * 30} r={3} fill="currentColor" opacity={0.6} />
          <path d={`M46.5 ${36 + i * 30}a6 5 0 0 1 11 0`} fill="currentColor" opacity={0.6} />
          <Barra x={68} y={24 + i * 30} w={[48, 38, 44][i]} o={0.75} />
          <Barra x={68} y={33 + i * 30} w={[30, 36, 24][i]} o={0.35} h={3.5} />
          <rect x={136} y={25 + i * 30} width={24} height={10} rx={5} {...TRACO} opacity={0.6} />
        </g>
      ))}
    </Tela>
  )
}

/** Dinheiro: um recibo com as linhas e uma moeda por cima. */
function Dinheiro() {
  return (
    <Tela titulo="Um recibo com valores e uma moeda">
      <path
        d="M58 10h72a5 5 0 0 1 5 5v88l-7 -5 -7 5 -7 -5 -7 5 -7 -5 -7 5 -7 -5 -7 5 -7 -5 -7 5V15a5 5 0 0 1 5 -5z"
        {...TRACO}
        opacity={0.5}
      />
      <Barra x={66} y={22} w={34} o={0.8} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Barra x={66} y={38 + i * 13} w={[30, 24, 34][i]} o={0.35} h={3.5} />
          <Barra x={110} y={38 + i * 13} w={16} o={0.5} h={3.5} />
        </g>
      ))}
      <line x1={66} y1={80} x2={126} y2={80} {...TRACO} opacity={0.3} />
      <Barra x={104} y={86} w={22} o={0.8} />
      <circle cx={146} cy={82} r={17} fill="var(--color-superficie, #fff)" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={146} cy={82} r={12} {...TRACO} opacity={0.4} />
      <path d="M150 76.5h-5.5a3 3 0 0 0 0 6h3a3 3 0 0 1 0 6H142M146 73.5v3M146 88.5v3" {...TRACO} />
    </Tela>
  )
}

/** Lista: uma prancheta com itens registrados. */
function Lista() {
  return (
    <Tela titulo="Uma prancheta com itens registrados">
      <rect x={60} y={14} width={80} height={98} rx={8} {...TRACO} opacity={0.5} />
      <rect x={84} y={8} width={32} height={12} rx={4} {...TRACO} opacity={0.8} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} opacity={1 - i * 0.18}>
          <circle cx={74} cy={38 + i * 18} r={3.5} {...TRACO} />
          <Barra x={84} y={36 + i * 18} w={[40, 32, 44, 28][i]} o={0.55} h={4} />
        </g>
      ))}
    </Tela>
  )
}

/** Tudo certo: um cartão com o sinal de feito e um brilho em volta. */
function TudoCerto() {
  return (
    <Tela titulo="Um sinal de tudo em dia">
      <rect x={52} y={14} width={96} height={92} rx={12} {...TRACO} opacity={0.4} />
      <circle cx={100} cy={52} r={20} fill="currentColor" opacity={0.14} />
      <circle cx={100} cy={52} r={20} {...TRACO} />
      <path d="M91 52.5l6 6 12 -13" {...TRACO} strokeWidth={2.2} />
      <Barra x={76} y={84} w={48} o={0.5} />
      <Barra x={84} y={93} w={32} o={0.3} h={3.5} />
      <path d="M38 30v8M34 34h8M160 22v6M157 25h6M164 70v8M160 74h8" {...TRACO} opacity={0.55} />
    </Tela>
  )
}

/** Erro: o cartão com o aviso no meio e as linhas que não chegaram. */
function Erro() {
  return (
    <Tela titulo="Um cartão que não carregou">
      <rect x={52} y={14} width={96} height={92} rx={12} {...TRACO} opacity={0.4} />
      <path d="M100 34l18 31h-36z" {...TRACO} />
      <path d="M100 46v8" {...TRACO} strokeWidth={2} />
      <circle cx={100} cy={59} r={1.3} fill="currentColor" />
      <line x1={70} y1={82} x2={130} y2={82} {...TRACO} strokeDasharray="3 5" opacity={0.45} />
      <line x1={78} y1={93} x2={122} y2={93} {...TRACO} strokeDasharray="3 5" opacity={0.3} />
    </Tela>
  )
}

/** Fotos: antes e depois, lado a lado, com a seta da comparação. */
function Fotos() {
  return (
    <Tela titulo="Duas fotos lado a lado para comparar">
      {[36, 112].map((x, i) => (
        <g key={x} opacity={i ? 1 : 0.6}>
          <rect x={x} y={16} width={52} height={74} rx={7} {...TRACO} />
          <circle cx={x + 26} cy={40} r={8} {...TRACO} />
          <path d={`M${x + 12} ${78}a14 13 0 0 1 28 0`} {...TRACO} />
          <Barra x={x + 12} y={98} w={28} o={0.45} h={4} />
        </g>
      ))}
      <path d="M93 53h14M103 49l4 4 -4 4" {...TRACO} />
    </Tela>
  )
}

/** O contrato: folha com cláusulas, a linha da assinatura e o selo do plano. */
function Contrato() {
  return (
    <Tela titulo="Um contrato com cláusulas e a linha da assinatura">
      <rect x={58} y={8} width={84} height={104} rx={8} {...TRACO} opacity={0.45} />
      <Barra x={70} y={20} w={40} o={0.8} />
      {[0, 1, 2, 3].map((l) => (
        <Barra key={l} x={70} y={34 + l * 11} w={l === 3 ? 34 : 58} o={0.35} h={3.5} />
      ))}
      <path d="M70 92c6-7 10 4 15-2s8 2 13 0" {...TRACO} opacity={0.75} />
      <line x1={70} y1={99} x2={108} y2={99} {...TRACO} opacity={0.3} />
      <circle cx={126} cy={92} r={10} {...TRACO} strokeDasharray="3 3" opacity={0.6} />
      <path d="M121.5 92l3 3 6-6" {...TRACO} />
    </Tela>
  )
}

/** Os locais: duas salas lado a lado, uma com o marcador de lugar em cima. */
function Local() {
  return (
    <Tela titulo="Duas salas, uma delas marcada como local">
      {[40, 106].map((x, i) => (
        <g key={x} opacity={i ? 0.5 : 1}>
          <path d={`M${x} 56l27-18 27 18v44a4 4 0 0 1-4 4H${x + 4}a4 4 0 0 1-4-4z`} {...TRACO} opacity={0.7} />
          <rect x={x + 19} y={78} width={16} height={26} rx={3} {...TRACO} opacity={0.6} />
        </g>
      ))}
      <path d="M67 10a9 9 0 0 1 9 9c0 7-9 15-9 15s-9-8-9-15a9 9 0 0 1 9-9z" {...TRACO} />
      <circle cx={67} cy={19} r={3} fill="currentColor" opacity={0.6} />
      <path d="M133 26v8M129 30h8" {...TRACO} opacity={0.5} />
    </Tela>
  )
}

/** Os serviços: cartões de modalidade, cada um com a etiqueta de preço. */
function Servicos() {
  return (
    <Tela titulo="Modalidades do estúdio, cada uma com o preço">
      {[0, 1, 2].map((l) => (
        <g key={l} opacity={l === 2 ? 0.5 : 1}>
          <rect x={36} y={12 + l * 34} width={128} height={26} rx={6} {...TRACO}
            strokeDasharray={l === 2 ? '3 4' : undefined} opacity={0.7} />
          {l < 2 ? (
            <>
              <circle cx={50} cy={25 + l * 34} r={5} fill="currentColor" opacity={0.25} />
              <Barra x={62} y={20 + l * 34} w={l ? 30 : 42} o={0.75} />
              <Barra x={62} y={28 + l * 34} w={22} o={0.35} h={3.5} />
              <path d={`M132 ${19 + l * 34}h16l5 6-5 6h-16z`} {...TRACO} opacity={0.75} />
              <circle cx={137} cy={25 + l * 34} r={1.6} fill="currentColor" opacity={0.6} />
            </>
          ) : (
            <path d="M100 85v8M96 89h8" {...TRACO} opacity={0.6} />
          )}
        </g>
      ))}
    </Tela>
  )
}

const DESENHOS: Record<Desenho, () => ReactNode> = {
  dia: Dia,
  semana: Semana,
  grade: Grade,
  pessoas: Pessoas,
  dinheiro: Dinheiro,
  lista: Lista,
  'tudo-certo': TudoCerto,
  erro: Erro,
  fotos: Fotos,
  contrato: Contrato,
  local: Local,
  servicos: Servicos,
}

export function Ilustracao({ desenho }: { desenho: Desenho }) {
  const D = DESENHOS[desenho]
  return <D />
}
