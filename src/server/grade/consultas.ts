import type { Db } from '../supabase'
import { hojeEm } from '../agenda/fuso'

/**
 * A grade fixa é configuração, não agenda: ler esta tela **não materializa
 * sessão nenhuma**. Quem materializa é `/hoje` e `/semana`, que mostram o
 * resultado da grade — aqui se mostra a regra.
 */

export type SerieLinha = {
  id: string
  diaSemana: number
  /** hora local, `HH:MM` */
  horaInicio: string
  duracaoMin: number
  servicoId: string
  servico: string
  profissionalId: string | null
  profissional: string | null
  localId: string | null
  local: string | null
  capacidade: number
  /** quantas vagas recorrentes estão vivas hoje */
  ocupadas: number
  vigenciaInicio: string
  vigenciaFim: string | null
  encerrada: boolean
}

type Embutido = { nome: string } | null

type LinhaSerie = {
  id: string
  dia_semana: number
  hora_inicio: string
  duracao_min: number
  capacidade: number
  vigencia_inicio: string
  vigencia_fim: string | null
  servico_id: string
  profissional_id: string | null
  local_id: string | null
  servico: Embutido
  profissional: Embutido
  local: Embutido
  vaga: { inicio: string; fim: string | null }[]
}

/** O Postgres devolve `time` como `HH:MM:SS`; a tela quer `HH:MM`. */
function semSegundos(hora: string): string {
  return hora.slice(0, 5)
}

/**
 * Todas as séries ativas da conta, com quantas vagas estão ocupadas hoje.
 *
 * "Ocupada" é a vaga viva **hoje**, não a soma histórica: quem saiu em julho não
 * ocupa horário em agosto, mas continua no histórico dele. Sem esse recorte, a
 * grade de um estúdio de dois anos mostraria toda turma como lotada.
 *
 * Série encerrada não some — vem marcada, para a tela mostrar em lista separada.
 * Série `ativo = false` some: é o desfazer de quem criou errado.
 */
export async function listarSeries(
  db: Db, contaId: string, fuso: string,
): Promise<SerieLinha[]> {
  const hoje = hojeEm(fuso)

  const { data, error } = await db
    .from('serie')
    .select(`
      id, dia_semana, hora_inicio, duracao_min, capacidade,
      vigencia_inicio, vigencia_fim, servico_id, profissional_id, local_id,
      servico:servico_id(nome),
      profissional:profissional_id(nome),
      local:local_id(nome),
      vaga(inicio, fim)
    `)
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .order('dia_semana')
    .order('hora_inicio')
    

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: l.id,
    diaSemana: l.dia_semana,
    horaInicio: semSegundos(l.hora_inicio),
    duracaoMin: l.duracao_min,
    servicoId: l.servico_id,
    servico: l.servico?.nome ?? 'sem registro',
    profissionalId: l.profissional_id,
    profissional: l.profissional?.nome ?? null,
    localId: l.local_id,
    local: l.local?.nome ?? null,
    capacidade: l.capacidade,
    ocupadas: l.vaga.filter((v) => v.inicio <= hoje && (v.fim === null || v.fim >= hoje)).length,
    vigenciaInicio: l.vigencia_inicio,
    vigenciaFim: l.vigencia_fim,
    encerrada: l.vigencia_fim !== null && l.vigencia_fim < hoje,
  }))
}

/** O catálogo que o editor de série precisa para oferecer escolha. */
export type CatalogoGrade = {
  servicos: { id: string; nome: string; duracaoMin: number; capacidadePadrao: number }[]
  profissionais: { id: string; nome: string }[]
  locais: { id: string; nome: string }[]
  funcionamento: { diaSemana: number; abre: string; fecha: string }[]
}

export async function catalogoDaGrade(db: Db, contaId: string): Promise<CatalogoGrade> {
  const [servicos, profissionais, locais, funcionamento] = await Promise.all([
    db.from('servico').select('id, nome, duracao_min, capacidade_padrao')
      .eq('conta_id', contaId).eq('ativo', true).order('nome')
      ,
    db.from('profissional').select('id, nome')
      .eq('conta_id', contaId).eq('ativo', true).order('nome')
      ,
    db.from('local').select('id, nome')
      .eq('conta_id', contaId).eq('ativo', true).order('nome')
      ,
    db.from('funcionamento').select('dia_semana, abre, fecha')
      .eq('conta_id', contaId).order('dia_semana')
      ,
  ])

  return {
    servicos: (servicos.data ?? []).map((s) => ({
      id: s.id, nome: s.nome,
      duracaoMin: s.duracao_min, capacidadePadrao: s.capacidade_padrao,
    })),
    profissionais: profissionais.data ?? [],
    locais: locais.data ?? [],
    funcionamento: (funcionamento.data ?? []).map((f) => ({
      diaSemana: f.dia_semana,
      abre: semSegundos(f.abre),
      fecha: semSegundos(f.fecha),
    })),
  }
}
