/**
 * O que o negócio vende, e por quanto.
 *
 * Sem banco e sem tela de propósito: a mesma regra é lida pela Configuração,
 * pela matrícula e um dia pela API, e regra copiada em três lugares diverge no
 * dia em que só dois deles forem corrigidos.
 */

export type Recorrencia =
  | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'avulsa' | 'pacote'

export type PlanoBase = {
  recorrencia: Recorrencia
  parcelas: number
  frequenciaSemanal: number | null
  sessoesNoPacote: number | null
  validadeMeses: number | null
  precoVinculadoCent: number
  precoAvulsoCent: number
}

/** Quantas vezes por período a cobrança se repete sozinha. */
export const RECORRENCIAS: Array<{ valor: Recorrencia; rotulo: string }> = [
  { valor: 'mensal', rotulo: 'Todo mês' },
  { valor: 'trimestral', rotulo: 'A cada três meses' },
  { valor: 'semestral', rotulo: 'A cada seis meses' },
  { valor: 'anual', rotulo: 'Uma vez por ano' },
  { valor: 'avulsa', rotulo: 'Uma vez só' },
  { valor: 'pacote', rotulo: 'Pacote de sessões' },
]

/** Plano que se repete tem frequência semanal; pacote e avulsa não têm. */
export const seRepete = (r: Recorrencia): boolean =>
  r !== 'avulsa' && r !== 'pacote'

/**
 * Centavos viram o que a recepção lê em voz alta.
 *
 * O espaço que o `Intl` usa depois do "R$" é o estreito e indivisível, e ele
 * não casa com o espaço que qualquer teste ou busca de tela digita. Trocar por
 * espaço comum é o que faz "R$ 735,00" ser encontrável.
 */
export function emReais(cent: number): string {
  return (cent / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/ | /g, ' ')
}

/**
 * O que a pessoa digitou vira centavos, ou `null`.
 *
 * `null`, e não zero: valor que não deu para ler precisa parar o formulário, e
 * um plano que entra valendo R$ 0,00 só é descoberto na primeira cobrança.
 */
export function emCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null
  // "1.980,00": em português o ponto separa milhar e a vírgula separa decimal
  const normal = limpo.replace(/\./g, '').replace(',', '.')
  const n = Number(normal)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/**
 * Qual dos dois preços vale, e se houve desconto de vínculo.
 *
 * Plano de preço único devolve `vinculo: false` mesmo para quem tem vínculo:
 * anunciar um desconto que não existe faz a recepção procurar na tabela o valor
 * cheio que nunca foi cobrado.
 */
export function precoAplicado(
  plano: Pick<PlanoBase, 'precoVinculadoCent' | 'precoAvulsoCent'>,
  temVinculo: boolean,
): { cent: number; vinculo: boolean } {
  const temDoisPrecos = plano.precoVinculadoCent !== plano.precoAvulsoCent
  const usaVinculo = temVinculo && temDoisPrecos
  return {
    cent: usaVinculo ? plano.precoVinculadoCent : plano.precoAvulsoCent,
    vinculo: usaVinculo,
  }
}

/**
 * A frase da coluna "Cobrança", escrita para quem atende o telefone.
 *
 * "Trimestral" não responde à pergunta que a pessoa do outro lado faz, que é
 * "quanto eu pago e quantas vezes". "3 parcelas · 2 horários" responde.
 */
export function comoCobra(plano: PlanoBase): string {
  if (plano.recorrencia === 'pacote') {
    const partes = [`${plano.sessoesNoPacote} sessões`]
    if (plano.validadeMeses) partes.push(`validade ${plano.validadeMeses} meses`)
    return partes.join(' · ')
  }

  if (plano.recorrencia === 'avulsa') return 'Uma vez'

  const quando = plano.parcelas > 1 ? `${plano.parcelas} parcelas` : 'Todo mês'
  const horarios = plano.frequenciaSemanal
    ? `${plano.frequenciaSemanal} ${plano.frequenciaSemanal === 1 ? 'horário' : 'horários'}`
    : null

  return [quando, horarios].filter(Boolean).join(' · ')
}
