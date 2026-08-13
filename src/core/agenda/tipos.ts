export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Serie = {
  id: string
  diaSemana: DiaSemana
  /** hora local, `HH:MM` */
  horaInicio: string
  duracaoMin: number
  capacidade: number
  /** `YYYY-MM-DD` */
  vigenciaInicio: string
  vigenciaFim: string | null
  ativo: boolean
}

export type Excecao = {
  data: string
  tipo: 'feriado' | 'fechado'
}

export type Ocorrencia = {
  serieId: string
  data: string
  horaInicio: string
  duracaoMin: number
  capacidade: number
  /** feriado não some da grade: aparece riscado, com o motivo */
  bloqueada: boolean
  motivo?: 'feriado' | 'fechado'
}
