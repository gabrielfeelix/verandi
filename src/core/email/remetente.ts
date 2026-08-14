/**
 * Como o nome de quem envia aparece na caixa de entrada.
 *
 * Quem recebe o convite é a recepcionista que a dona acabou de contratar: ela
 * conhece "Estúdio Lótus" e nunca ouviu falar de Verandi. Um e-mail assinado só
 * "Verandi" pedindo para ela criar senha é indistinguível de golpe.
 *
 * O `via Verandi` também não é enfeite. Nome de exibição que não bate com o
 * domínio é sinal de phishing para vários clientes de e-mail, e o Gmail já
 * acrescenta "via" por conta própria quando os domínios diferem — melhor
 * escrever do jeito que se quer do que deixar o cliente inventar.
 *
 * Nada disto vale para os e-mails do Supabase Auth (senha e confirmação): lá o
 * nome do remetente é um só por projeto e não varia por conta. E está certo que
 * seja — quem clicou em "esqueci a senha" está olhando a tela da Verandi
 * naquele segundo.
 */

export const PRODUTO = 'Verandi'

/** Cabeçalho de e-mail quebra em 78 colunas; nome maior que isso é dobrado. */
const LIMITE = 78

/**
 * Tudo que pode terminar o nome e começar outra coisa dentro do cabeçalho.
 *
 * `\r\n` é o caso grave: abre um cabeçalho novo, e um `Bcc:` forjado sai daí.
 * O nome vem de `conta.nome`, que é texto que o cliente digita — então isto não
 * é higiene, é a fronteira entre um campo e um cabeçalho de verdade.
 */
// Escrito com escape `\u`, nunca com o caractere literal: byte de controle
// no fonte é invisível na revisão, e o primeiro editor distraído o come sem
// avisar — levando junto a proteção, sem quebrar teste nenhum.
const PERIGOSO = /[\u0000-\u001F\u007F"<>]/g

function limpa(bruto: string | null | undefined): string {
  return (bruto ?? '')
    .replace(PERIGOSO, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * `"Estúdio Lótus via Verandi"`, ou só `"Verandi"` quando não há nome usável.
 */
export function nomeDeRemetente(nomeDaConta: string | null | undefined): string {
  const conta = limpa(nomeDaConta)
  if (!conta) return PRODUTO
  if (conta.toLowerCase() === PRODUTO.toLowerCase()) return conta

  const sufixo = ` via ${PRODUTO}`
  const cabe = LIMITE - sufixo.length
  // corta a conta, nunca o sufixo: sem o produto o "via" fica órfão
  const nome = conta.length > cabe ? conta.slice(0, cabe).trimEnd() : conta
  return nome + sufixo
}
