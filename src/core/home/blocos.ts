/**
 * Quais blocos a tela inicial tem, e em que ordem eles saem.
 *
 * Sem banco e sem tela, como o resto de `core/`: quem monta a página e quem
 * desenha o painel de arrumar precisam da mesma lista na mesma ordem, e duas
 * listas escritas em dois lugares divergem no dia em que só uma ganhar o bloco
 * novo.
 *
 * **A faixa é do bloco, e não da pessoa.** A agenda do dia é larga e a lista de
 * pendências é estreita: deixar arrastar uma para a coluna da outra é oferecer
 * um arranjo que a tela não sabe desenhar. Então cada bloco nasce numa faixa, e
 * o que se arruma é a ordem dentro dela e se ele aparece.
 */

export type Faixa = 'principal' | 'lateral'

export type Bloco = {
  id: string
  titulo: string
  /** o que ele responde, escrito para quem está decidindo se quer vê-lo */
  sobre: string
  faixa: Faixa
  /** blocos que a tela não consegue montar sem: não se desligam */
  fixo?: boolean
  /** só para quem pode ver dinheiro e pendência */
  operacional?: boolean
}

/**
 * O catálogo, na ordem em que a tela nasce para quem nunca mexeu.
 *
 * A ordem daqui é o padrão, e o padrão é o que a maioria precisa: os números do
 * dia primeiro porque respondem sem leitura, a próxima turma depois porque é a
 * única coisa com hora marcada, e a agenda em seguida. Na lateral, pendência na
 * frente de equipe porque pendência pede ação e equipe é conferência.
 */
export const BLOCOS: Bloco[] = [
  {
    id: 'numeros',
    titulo: 'Números do dia',
    sobre: 'aulas, chamadas pendentes, presenças e reposições em aberto',
    faixa: 'principal',
  },
  {
    id: 'proxima',
    titulo: 'Próxima turma',
    sobre: 'quem entra na sala agora, e em quanto tempo',
    faixa: 'principal',
  },
  {
    id: 'agenda',
    titulo: 'Agenda do dia',
    sobre: 'a lista de turmas do dia, por período',
    faixa: 'principal',
    fixo: true,
  },
  {
    id: 'pendencias',
    titulo: 'Pendências',
    sobre: 'o que exige decisão humana hoje',
    faixa: 'lateral',
    operacional: true,
  },
  {
    id: 'equipe',
    titulo: 'Equipe hoje',
    sobre: 'quantas aulas cada profissional aplica no dia',
    faixa: 'lateral',
  },
  /*
   * O caixa é da coluna estreita, e vem depois da equipe.
   *
   * Ele nasceu na coluna larga, em cima da agenda, e ali disputava a atenção
   * com o que a tela existe para responder: quem entra na sala agora. Dinheiro
   * na tela inicial serve para dar o pulso do mês de relance, e o pulso cabe
   * num cartão estreito ao lado — quem quiser detalhe abre o Financeiro, que é
   * onde ele mora.
   */
  {
    id: 'caixa',
    titulo: 'Caixa do mês',
    sobre: 'quanto entrou, quanto ainda vence e quanto está em atraso',
    faixa: 'lateral',
    operacional: true,
  },
]

export type Arranjo = { id: string; visivel: boolean }

/**
 * O que veio do banco, casado com o que a tela tem hoje.
 *
 * Três coisas acontecem aqui, e as três são o motivo de isto não ser uma
 * leitura direta do `jsonb`:
 *
 * 1. **Bloco que o arranjo não conhece entra no fim, visível.** É o bloco novo
 *    que a tela ganhou depois de a pessoa ter arrumado a dela. Nascer escondido
 *    faria a novidade não existir para justamente quem mais usa o produto.
 * 2. **Bloco salvo que não existe mais some.** Arranjo antigo não pode segurar
 *    um `id` que ninguém desenha.
 * 3. **Bloco fixo aparece sempre.** Guardar `visivel: false` para a agenda do
 *    dia entregaria uma tela inicial sem tela.
 *
 * Também filtra o que o papel não alcança: para quem só atende, caixa e
 * pendências não existem, e não devem sequer aparecer no painel de arrumar como
 * uma caixa desmarcada que ela nunca vai poder marcar.
 */
export function arranjoEfetivo(
  salvo: Arranjo[] | null | undefined,
  opcoes: { operacional: boolean } = { operacional: true },
): Array<Bloco & { visivel: boolean }> {
  const disponiveis = BLOCOS.filter((b) => opcoes.operacional || !b.operacional)
  const porId = new Map(disponiveis.map((b) => [b.id, b]))

  const vistos = new Set<string>()
  const ordenados: Array<Bloco & { visivel: boolean }> = []

  for (const linha of salvo ?? []) {
    const b = porId.get(linha?.id)
    if (!b || vistos.has(b.id)) continue
    vistos.add(b.id)
    ordenados.push({ ...b, visivel: b.fixo ? true : linha.visivel !== false })
  }

  for (const b of disponiveis) {
    if (vistos.has(b.id)) continue
    ordenados.push({ ...b, visivel: true })
  }

  return ordenados
}

/** Os blocos de uma faixa, na ordem, já sem os desligados. */
export function daFaixa(
  arranjo: Array<Bloco & { visivel: boolean }>, faixa: Faixa,
): Array<Bloco & { visivel: boolean }> {
  return arranjo.filter((b) => b.faixa === faixa && b.visivel)
}

/**
 * Trocar um bloco de lugar com o vizinho **da mesma faixa**.
 *
 * O vizinho de cima na tela não é o vizinho de cima na lista: as duas faixas
 * moram no mesmo array, e trocar com o índice anterior mandaria a pendência
 * para o meio da coluna larga. Então a troca procura o vizinho pela faixa, e
 * quando não há vizinho a lista volta como veio, sem erro: bloco no topo que
 * não sobe é um botão que não faz nada, e não uma falha.
 */
export function mover(
  arranjo: Arranjo[], id: string, direcao: 'cima' | 'baixo',
  faixaDe: (id: string) => Faixa | undefined,
): Arranjo[] {
  const i = arranjo.findIndex((b) => b.id === id)
  if (i < 0) return arranjo
  const faixa = faixaDe(id)
  if (!faixa) return arranjo

  const passo = direcao === 'cima' ? -1 : 1
  let j = i + passo
  while (j >= 0 && j < arranjo.length && faixaDe(arranjo[j].id) !== faixa) {
    j += passo
  }
  if (j < 0 || j >= arranjo.length) return arranjo

  const copia = [...arranjo]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}

/**
 * O que vai para o banco: só `id` e `visivel`, nunca o bloco inteiro.
 *
 * Gravar título e texto junto congelaria a redação do dia em que a pessoa
 * mexeu, e a tela passaria a mostrar o rótulo velho para quem arrumou e o novo
 * para quem não arrumou.
 */
export function paraGravar(
  arranjo: Array<{ id: string; visivel: boolean }>,
): Arranjo[] {
  return arranjo.map((b) => ({ id: b.id, visivel: b.visivel }))
}
