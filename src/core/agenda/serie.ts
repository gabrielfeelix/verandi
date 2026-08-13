import type { DiaSemana } from './tipos'

/**
 * A matemática de manter a grade fixa: criar série em vários dias de uma vez,
 * apontar colisão, e decidir o que uma edição alcança.
 *
 * Puro como o resto do `core/`: não sabe o que é banco, fuso ou tela.
 */

export type NovaSerie = {
  servicoId: string
  profissionalId?: string | null
  localId?: string | null
  diasSemana: number[]
  /** hora local, `HH:MM` ou `HH:MM:SS` */
  horaInicio: string
  duracaoMin: number
  capacidade: number
  /** `YYYY-MM-DD` */
  vigenciaInicio: string
  vigenciaFim?: string | null
}

/**
 * Uma linha pronta para o insert, em `snake_case` porque é o nome da coluna.
 *
 * O tipo é fechado de propósito: é ele que garante que toda linha do lote
 * carregue o mesmo conjunto de chaves.
 */
export type LinhaSerie = {
  conta_id: string
  servico_id: string
  profissional_id: string | null
  local_id: string | null
  dia_semana: number
  hora_inicio: string
  duracao_min: number
  capacidade: number
  vigencia_inicio: string
  vigencia_fim: string | null
  ativo: boolean
}

/**
 * Uma série por dia pedido — "a turma das 7h acontece segunda, quarta e sexta"
 * são três séries, não uma com três dias. É o que permite mudar só a de quarta
 * depois.
 *
 * **Toda linha carrega todas as chaves, sempre.** O PostgREST normaliza o lote
 * para o mesmo conjunto de colunas e preenche o que falta com `NULL`: o default
 * da coluna não é aplicado, e uma linha com uma chave a menos derruba o lote
 * inteiro com `23502`. Por isso o opcional ausente vira `null` explícito em vez
 * de chave omitida.
 */
export function linhasDaSerie(nova: NovaSerie, contaId: string): LinhaSerie[] {
  const dias = [...new Set(nova.diasSemana)]
  return dias.map((dia) => ({
    conta_id: contaId,
    servico_id: nova.servicoId,
    profissional_id: nova.profissionalId ?? null,
    local_id: nova.localId ?? null,
    dia_semana: dia,
    hora_inicio: nova.horaInicio,
    duracao_min: nova.duracaoMin,
    capacidade: nova.capacidade,
    vigencia_inicio: nova.vigenciaInicio,
    vigencia_fim: nova.vigenciaFim ?? null,
    ativo: true,
  }))
}

export type SerieBase = {
  diaSemana: DiaSemana | number
  horaInicio: string
  duracaoMin: number
  profissionalId: string | null
  localId: string | null
}

/** `HH:MM` ou `HH:MM:SS` em minutos desde a meia-noite. */
function emMinutos(hora: string): number {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m)
}

function sobrepoe(a: SerieBase, b: SerieBase): boolean {
  const ia = emMinutos(a.horaInicio)
  const ib = emMinutos(b.horaInicio)
  // intervalo semiaberto: 7h–8h e 8h–9h dividem só a borda, e borda não é conflito
  return ia < ib + b.duracaoMin && ib < ia + a.duracaoMin
}

/**
 * Duas séries colidem quando caem no mesmo dia, se sobrepõem no tempo, e
 * dividem o profissional ou o local.
 *
 * Profissional ganha de local porque é o conflito mais grave: sala se divide
 * com biombo, gente não se divide.
 *
 * Colidir **não é proibido** — dois profissionais na mesma sala pode ser real.
 * Quem chama decide se avisa ou se bloqueia; aqui só se constata.
 */
export function colide(a: SerieBase, b: SerieBase): 'profissional' | 'local' | null {
  if (a.diaSemana !== b.diaSemana) return null
  if (!sobrepoe(a, b)) return null
  if (a.profissionalId !== null && a.profissionalId === b.profissionalId) {
    return 'profissional'
  }
  if (a.localId !== null && a.localId === b.localId) return 'local'
  return null
}

export type SessaoParaReconciliar = {
  id: string
  /** instante absoluto, ISO */
  inicio: string
  status: 'prevista' | 'realizada' | 'cancelada'
  capacidade: number
}

/**
 * O que uma edição de série alcança, e o que ela tem que deixar em paz.
 *
 * Editar a grade **não reescreve o passado** — é a promessa mais importante da
 * arquitetura e a confusão mais provável do sistema. Fica preservada:
 *
 * - a sessão que já começou (passado não se reescreve)
 * - a que já foi realizada ou cancelada (tem decisão registrada)
 * - a que teve a capacidade mexida à mão (alguém decidiu abrir vaga naquele
 *   dia; configuração não pode desfazer isso, senão "lotada é lotada" vira
 *   promessa vazia)
 *
 * `capacidadeAtualDaSerie` é a capacidade **antes** da edição: é comparando com
 * ela que se sabe se a sessão foi ajustada à mão.
 */
export function alcanceDaEdicao(
  sessoes: SessaoParaReconciliar[],
  capacidadeAtualDaSerie: number,
  agora: Date,
): { atualiza: string[]; preserva: string[] } {
  const atualiza: string[] = []
  const preserva: string[] = []
  const limite = agora.getTime()

  for (const s of sessoes) {
    const jaComecou = new Date(s.inicio).getTime() <= limite
    const temDecisao = s.status !== 'prevista'
    const mexidaAMao = s.capacidade !== capacidadeAtualDaSerie
    if (jaComecou || temDecisao || mexidaAMao) preserva.push(s.id)
    else atualiza.push(s.id)
  }
  return { atualiza, preserva }
}
