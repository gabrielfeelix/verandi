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
 *
 * **A unidade é minuto, e passou a ser na `0062`.** A primeira versão contava
 * horas inteiras porque o primeiro caso pedia 2h. O segundo pediu meia hora, e
 * meia hora não existe em inteiro de horas: vira 0, que dá crédito a todo
 * mundo, ou 1, que é o dobro do combinado. Quem escolhe o prazo é o estúdio, e
 * o sistema não pode arredondar a escolha dele.
 */

export type Veredito = {
  /** a pessoa fica com o direito de repor essa aula? */
  temCredito: boolean
  /** quanto faltava para a aula quando ela avisou, em minutos */
  minutosDeAntecedencia: number
  /** o que a conta exige, em minutos */
  minutosExigidos: number
}

/**
 * `avisadoEm` é quando **a pessoa** avisou — não quando a recepção digitou.
 * `inicio` é o começo da aula. Ambos são instantes (ISO), e a conta é feita em
 * UTC de propósito: subtração de instantes não tem fuso, e converter para o
 * fuso da conta antes de subtrair só criaria a chance de errar no horário de
 * verão.
 *
 * **`minutosExigidos = 0` devolve crédito sempre**, que é como o sistema se
 * comportou até existir esta função. Conta que não configurou nada não pode
 * começar a negar reposição sozinha.
 *
 * Avisar **depois** que a aula começou nunca gera crédito, mesmo com exigência
 * zero: não é aviso, é ausência contada depois do fato.
 */
export function avaliarAviso(
  avisadoEm: Date,
  inicio: Date,
  minutosExigidos: number,
): Veredito {
  const minutos = (inicio.getTime() - avisadoEm.getTime()) / 60_000

  if (minutos <= 0) {
    return { temCredito: false, minutosDeAntecedencia: minutos, minutosExigidos }
  }

  return {
    temCredito: minutos >= minutosExigidos,
    minutosDeAntecedencia: minutos,
    minutosExigidos,
  }
}

/**
 * O prazo escrito como gente fala.
 *
 * `120` vira "2h" e `30` vira "30 minutos", porque é assim que o estúdio diz a
 * regra em voz alta. Imprimir "0.5h" ou "120 minutos" faria a frase do bot soar
 * como relatório, e essa frase é a última coisa que a pessoa lê antes de perder
 * a reposição: ela precisa ser entendida na primeira leitura.
 *
 * Meia hora e uma hora e meia entram como "1h30", que é como se lê um horário
 * em português, e não "90 minutos".
 */
export function prazoPorExtenso(minutos: number): string {
  if (minutos < 60) return `${minutos} minutos`

  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
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
    `${prazoPorExtenso(veredito.minutosExigidos)}. Se confirmar, essa aula não ` +
    `poderá ser reposta. Deseja prosseguir?`
  )
}
