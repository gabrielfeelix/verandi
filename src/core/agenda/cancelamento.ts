/**
 * Avisou a tempo?
 *
 * O estúdio dá a aula de volta para quem avisa com antecedência, e não para
 * quem manda mensagem quinze minutos antes: a vaga já não dá tempo de ser
 * ocupada por mais ninguém, e a aula foi perdida de qualquer jeito. A regra é
 * antiga no balcão e era invisível no sistema — o `DELETE` da API dava crédito
 * para todo mundo, inclusive para quem cancelou com a professora já na sala.
 *
 * Puro e sem banco, como `encaixe.ts` e `experimental.ts`: é conta sobre tempo,
 * e o caso que mais interessa (faltam duas horas e um minuto) é impossível de
 * reproduzir à mão contra um banco de verdade.
 */

export type Veredito = {
  /** a pessoa fica com o direito de repor essa aula? */
  temCredito: boolean
  /** quanto faltava para a aula quando ela avisou, em horas */
  horasDeAntecedencia: number
  /** o que a conta exige */
  horasExigidas: number
}

/**
 * `avisadoEm` é quando **a pessoa** avisou — não quando a recepção digitou.
 * `inicio` é o começo da aula. Ambos são instantes (ISO), e a conta é feita em
 * UTC de propósito: subtração de instantes não tem fuso, e converter para o
 * fuso da conta antes de subtrair só criaria a chance de errar no horário de
 * verão.
 *
 * **`horasExigidas = 0` devolve crédito sempre**, que é como o sistema se
 * comportou até existir esta função. Conta que não configurou nada não pode
 * começar a negar reposição sozinha.
 *
 * Avisar **depois** que a aula começou nunca gera crédito, mesmo com exigência
 * zero: não é aviso, é ausência contada depois do fato.
 */
export function avaliarAviso(
  avisadoEm: Date,
  inicio: Date,
  horasExigidas: number,
): Veredito {
  const horas = (inicio.getTime() - avisadoEm.getTime()) / 3_600_000

  if (horas <= 0) {
    return { temCredito: false, horasDeAntecedencia: horas, horasExigidas }
  }

  return {
    temCredito: horas >= horasExigidas,
    horasDeAntecedencia: horas,
    horasExigidas,
  }
}

/**
 * A frase que o bot diz **antes** de cancelar, quando já não dá mais tempo.
 *
 * Existe porque o pedido é literalmente esse: *"Você está tentando cancelar a
 * aula do dia xxxx fora do período permitido, caso realize o cancelamento essa
 * aula não poderá ser reposta, deseja prosseguir?"* — a pessoa decide sabendo
 * o que perde, em vez de descobrir depois que a reposição não existe.
 *
 * `null` quando está dentro do prazo: não há nada a avisar, e um aviso que
 * aparece sempre é um aviso que ninguém lê.
 */
export function avisoDeForaDoPrazo(
  veredito: Veredito,
  quando: string,
): string | null {
  if (veredito.temCredito) return null

  return (
    `Você está tentando cancelar a aula ${quando} fora do prazo de ` +
    `${veredito.horasExigidas}h. Se confirmar, essa aula não poderá ser reposta. ` +
    `Deseja prosseguir?`
  )
}
