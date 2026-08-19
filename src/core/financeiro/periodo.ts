import { somarDias } from '../agenda/datas'
import { competenciaDe } from './cobranca'

/**
 * A janela de datas que as telas de lista usam para filtrar.
 *
 * Existe porque três telas passaram a precisar da mesma coisa e da mesma
 * maneira: o Financeiro filtrando por vencimento, os Recibos filtrando por
 * emissão, e o Fechamento somando o período. Escrito em três lugares, o atalho
 * "este mês" ia divergir no dia em que só um deles passasse a contar o mês
 * corrido em vez do mês do calendário.
 *
 * **Nada aqui conhece fuso.** Quem sabe que dia é hoje na conta é `src/server`,
 * e passa o `hoje` já resolvido. Montar "hoje" aqui com `new Date()` daria o dia
 * do servidor, que depois das 21h no Brasil já é amanhã.
 */

export type Periodo = { de: string; ate: string }

export type Atalho = {
  id: string
  rotulo: string
  /** monta a janela a partir do dia de hoje na conta */
  janela: (hoje: string) => Periodo
}

/**
 * Os atalhos oferecidos, na ordem em que se pensa neles.
 *
 * Dia, semana, mês e ano são as quatro janelas que o documento do cliente pede.
 * "Ontem" e "Mês passado" entraram porque a pergunta real de quem fecha o caixa
 * não é "quanto entrou hoje", é "bateu com o de ontem" e "como fomos no mês que
 * fechou".
 */
export const ATALHOS: Atalho[] = [
  { id: 'hoje', rotulo: 'Hoje', janela: (h) => ({ de: h, ate: h }) },
  {
    id: 'ontem',
    rotulo: 'Ontem',
    janela: (h) => ({ de: somarDias(h, -1), ate: somarDias(h, -1) }),
  },
  {
    id: '7d',
    rotulo: '7 dias',
    janela: (h) => ({ de: somarDias(h, -6), ate: h }),
  },
  {
    id: '30d',
    rotulo: '30 dias',
    janela: (h) => ({ de: somarDias(h, -29), ate: h }),
  },
  {
    id: 'mes',
    rotulo: 'Este mês',
    janela: (h) => ({ de: competenciaDe(h), ate: h }),
  },
  {
    id: 'mes-passado',
    rotulo: 'Mês passado',
    janela: (h) => {
      const primeiroDeste = competenciaDe(h)
      const ultimoDoPassado = somarDias(primeiroDeste, -1)
      return { de: competenciaDe(ultimoDoPassado), ate: ultimoDoPassado }
    },
  },
  {
    id: 'ano',
    rotulo: 'Este ano',
    janela: (h) => ({ de: `${h.slice(0, 4)}-01-01`, ate: `${h.slice(0, 4)}-12-31` }),
  },
]

/** Qual atalho descreve esta janela, se algum. É o que fica aceso na barra. */
export function atalhoDe(p: Periodo | null, hoje: string): string | null {
  if (!p) return null
  for (const a of ATALHOS) {
    const j = a.janela(hoje)
    if (j.de === p.de && j.ate === p.ate) return a.id
  }
  return null
}

/**
 * A janela pedida pela URL, ou nenhuma.
 *
 * **Nenhuma é uma resposta legítima, e é o padrão das listas.** Uma tela de
 * cobranças que abre filtrada por "este mês" esconde quem deve desde junho, que
 * é exatamente a pessoa para quem se liga hoje. O período é uma pergunta que
 * alguém faz, e não um estado em que a tela nasce.
 *
 * Data que não é data some, e as duas fora de ordem se invertem em vez de
 * devolverem lista vazia: quem digitou 30/09 a 01/09 quis setembro.
 */
export function periodoDaBusca(
  de: string | undefined, ate: string | undefined,
): Periodo | null {
  const d = dataValida(de)
  const a = dataValida(ate)
  if (!d && !a) return null
  if (d && a) return d <= a ? { de: d, ate: a } : { de: a, ate: d }
  // uma ponta só é uma pergunta legítima: "de setembro em diante", "até ontem"
  return { de: d ?? '0001-01-01', ate: a ?? '9999-12-31' }
}

function dataValida(bruta: string | undefined): string | null {
  if (!bruta) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruta)) return null
  const [, mes, dia] = bruta.split('-').map(Number)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return bruta
}

/** Como a janela se lê numa frase: "de 01/09/26 a 30/09/26". */
export function periodoPorExtenso(p: Periodo | null): string | null {
  if (!p) return null
  const curta = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4)
  if (p.de === p.ate) return `em ${curta(p.de)}`
  if (p.de === '0001-01-01') return `até ${curta(p.ate)}`
  if (p.ate === '9999-12-31') return `de ${curta(p.de)} em diante`
  return `de ${curta(p.de)} a ${curta(p.ate)}`
}
