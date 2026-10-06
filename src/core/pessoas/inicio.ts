/**
 * Desde quando a pessoa é cliente: a data mais antiga entre o cadastro, o
 * início do primeiro contrato e a primeira aula registrada.
 *
 * Só o cadastro não serve. Quem chega por importação (a planilha de um estúdio
 * que já existia) tem o `criado_em` do dia da importação, e virava "aluno desde
 * out/26" com presença em agosto, e o fechamento contava a escola inteira como
 * clientes novos no mês da migração.
 */
export function inicioDaPessoa(datas: ReadonlyArray<string | null | undefined>): string {
  const dias = datas
    .filter((d): d is string => !!d)
    .map((d) => d.slice(0, 10))
    .sort()
  return dias[0] ?? ''
}
