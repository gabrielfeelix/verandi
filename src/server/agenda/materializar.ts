import { expandirSerie } from '@/core/agenda/expandir'
import { dentroDaLicenca, type JanelaDeLicenca } from '@/core/agenda/licenca'
import type { Excecao, Serie } from '@/core/agenda/tipos'
import type { Db } from '../supabase'
import { instante, localDe } from './fuso'

type LinhaVaga = { serie_id: string; pessoa_id: string; inicio: string; fim: string | null }

type LinhaSerie = {
  id: string
  servico_id: string
  profissional_id: string | null
  local_id: string | null
  dia_semana: 0 | 1 | 2 | 3 | 4 | 5 | 6
  hora_inicio: string
  duracao_min: number
  capacidade: number
  vigencia_inicio: string
  vigencia_fim: string | null
  ativo: boolean
}

type LinhaSessao = { id: string; inicio: string }

/**
 * Cria as sessões da janela que ainda não existem, e semeia as participações
 * de quem tem vaga recorrente.
 *
 * Idempotente por construção: o `UNIQUE (serie_id, inicio)` e o
 * `UNIQUE (sessao_id, pessoa_id)` transformam corrida em conflito ignorado.
 * Duas abas abrindo a mesma semana ao mesmo tempo não duplicam nada, e não
 * existe job agendado para esquecer de rodar.
 *
 * **Lê antes de escrever, e no caso comum não escreve.** Isto roda em toda
 * visita a `/hoje` e `/semana`, e a esmagadora maioria delas encontra a janela
 * pronta: a primeira abertura da semana cria tudo, as outras cinquenta do dia
 * não têm nada para criar. Mandar mesmo assim um `upsert` por série era uma
 * escrita por leitura de página, com o banco descartando cada linha no índice
 * único: barato numa conta de teste, e a primeira coisa a doer quando a grade
 * tem cem séries e a recepção deixa a aba aberta.
 *
 * A conferência é uma consulta só, das sessões que já existem na janela. O
 * `upsert` continua ali para o que sobrar, porque ele é a garantia contra
 * corrida entre duas abas; o que mudou é que ele deixou de ser o caminho
 * normal.
 */
export async function materializarJanela(
  db: Db,
  contaId: string,
  de: string,
  ate: string,
  /** o fuso da conta, quando quem chama já o tem: poupa uma ida ao banco */
  fusoConhecido?: string,
): Promise<{ criadas: number; participacoesCriadas: number }> {
  let fuso = fusoConhecido
  if (!fuso) {
    const { data: conta, error: erroConta } = await db
      .from('conta').select('fuso').eq('id', contaId).single()
    if (erroConta) throw erroConta
    fuso = conta!.fuso as string
  }

  /*
   * A lista de colunas em **uma string literal**, e não somada com `+`.
   *
   * O supabase-js lê o `select` como tipo literal para saber a forma da
   * resposta; concatenação vira `string` e ele devolve `GenericStringError`,
   * que é aquele erro que fala de tudo menos do problema. Quebrar a linha
   * dentro das aspas mantém o literal.
   */
  const { data: series, error: erroSeries } = await db
    .from('serie')
    .select(`id, servico_id, profissional_id, local_id, dia_semana, hora_inicio,
             duracao_min, capacidade, vigencia_inicio, vigencia_fim, ativo`)
    .eq('conta_id', contaId).eq('ativo', true)
  if (erroSeries) throw erroSeries
  if (!series?.length) return { criadas: 0, participacoesCriadas: 0 }

  /*
   * `.returns<>()` aqui **não** é resquício de antes dos tipos gerados: ele diz
   * o que o gerador não tem como saber. `excecao_calendario.tipo` é `text` com
   * `check (tipo in ('feriado','fechado'))`, e checagem de texto não vira união
   * em TypeScript: o arquivo gerado diz `string`. Quem sabe que são dois
   * valores é a migration, e a união mora em `core/agenda/tipos.ts`.
   */
  const { data: excecoesBrutas } = await db
    .from('excecao_calendario').select('data, tipo')
    .eq('conta_id', contaId).gte('data', de).lte('data', ate)
    .returns<Excecao[]>()
  const excecoes = excecoesBrutas ?? []

  const { data: vagasBrutas } = await db
    .from('vaga').select('serie_id, pessoa_id, inicio, fim').eq('conta_id', contaId)
    
  const vagas = vagasBrutas ?? []

  // quem está de licença: a aula gerada no período já nasce em `licenca`, e o
  // lugar fica livre para encaixe desde o primeiro minuto
  const { data: licencasBrutas, error: erroLicencas } = await db
    .from('licenca').select('pessoa_id, inicio, volta_prevista')
    .eq('conta_id', contaId).is('encerrada_em', null)
  if (erroLicencas) throw erroLicencas
  const licencas = new Map<string, JanelaDeLicenca>(
    (licencasBrutas ?? []).map((l) => [l.pessoa_id, { inicio: l.inicio, voltaPrevista: l.volta_prevista }]),
  )

  /*
   * O que já existe na janela, por `serie_id` e instante.
   *
   * A chave é o milissegundo, e não o texto: o Postgres devolve
   * `2026-08-14 12:00:00+00` e `instante()` monta `2026-08-14T12:00:00.000Z`.
   * Comparar como texto acharia que nada existe e escreveria tudo de novo em
   * toda visita, que é exatamente o defeito que esta consulta veio tirar.
   */
  const { data: existentes } = await db
    .from('sessao').select('serie_id, inicio')
    .eq('conta_id', contaId)
    .gte('inicio', instante(de, '00:00', fuso))
    .lte('inicio', instante(ate, '23:59', fuso))
    

  const jaExiste = new Set(
    (existentes ?? [])
      .filter((s) => s.serie_id !== null)
      .map((s) => `${s.serie_id}@${new Date(s.inicio).getTime()}`),
  )

  let criadas = 0
  let participacoesCriadas = 0

  for (const s of series) {
    const serie: Serie = {
      id: s.id,
      // `dia_semana` é `smallint` com `check (between 0 and 6)`: o gerador diz
      // `number`, e a faixa é conhecida só pela migration
      diaSemana: s.dia_semana as Serie['diaSemana'],
      horaInicio: String(s.hora_inicio).slice(0, 5),
      duracaoMin: s.duracao_min,
      capacidade: s.capacidade,
      vigenciaInicio: s.vigencia_inicio,
      vigenciaFim: s.vigencia_fim,
      ativo: s.ativo,
    }
    const ocorrencias = expandirSerie(serie, de, ate, excecoes)
    if (!ocorrencias.length) continue

    const linhas = ocorrencias
      .map((o) => ({
        conta_id: contaId,
        serie_id: o.serieId,
        servico_id: s.servico_id,
        profissional_id: s.profissional_id,
        local_id: s.local_id,
        inicio: instante(o.data, o.horaInicio, fuso),
        duracao_min: o.duracaoMin,
        capacidade: o.capacidade,
        status: (o.bloqueada ? 'cancelada' : 'prevista') as 'cancelada' | 'prevista',
        motivo_cancelamento: o.bloqueada ? `Dia marcado como ${o.motivo}` : null,
      }))
      .filter((l) => !jaExiste.has(`${l.serie_id}@${new Date(l.inicio).getTime()}`))

    // nada a criar nesta série: a janela já estava materializada, e este é o
    // caso comum de toda visita depois da primeira
    if (!linhas.length) continue

    // `ignoreDuplicates` é o `on conflict do nothing`: o que já existe fica
    // como está, inclusive se a capacidade daquele dia tiver sido alterada
    const { data: inseridas, error } = await db
      .from('sessao')
      .upsert(linhas, { onConflict: 'serie_id,inicio', ignoreDuplicates: true })
      .select('id, inicio')
      
    if (error) throw error
    criadas += inseridas?.length ?? 0

    const dasSerie = vagas.filter((v) => v.serie_id === s.id)
    if (!dasSerie.length || !inseridas?.length) continue

    const participacoes = inseridas.flatMap((sessao) => {
      // a data local da sessão, não o pedaço do ISO: a turma das 21h em Brasília
      // é 00h do dia seguinte em UTC, e a vaga tem vigência em data local
      const dia = localDe(sessao.inicio, fuso).data
      return dasSerie
        .filter((v) => v.inicio <= dia && (v.fim === null || v.fim >= dia))
        .map((v) => {
          const licenca = licencas.get(v.pessoa_id)
          return {
            conta_id: contaId,
            sessao_id: sessao.id,
            pessoa_id: v.pessoa_id,
            origem: 'recorrente' as const,
            status: licenca && dentroDaLicenca(dia, licenca)
              ? ('licenca' as const) : ('esperada' as const),
            registrado_por_origem: 'sistema' as const,
          }
        })
    })
    if (!participacoes.length) continue

    const { data: pInseridas, error: erroP } = await db
      .from('participacao')
      .upsert(participacoes, { onConflict: 'sessao_id,pessoa_id', ignoreDuplicates: true })
      .select('id')
    if (erroP) throw erroP
    participacoesCriadas += pInseridas?.length ?? 0
  }

  return { criadas, participacoesCriadas }
}

/**
 * A vaga nova entra nas aulas que já estavam na agenda.
 *
 * `materializarJanela` só põe gente na sessão que ele mesmo acabou de criar: a
 * semana que já existia não volta a ser gerada. Sem isto, matricular alguém na
 * segunda das 8h deixava a aula desta segunda sem o aluno, e a ficha dizia
 * "nada marcado à frente" logo depois de agendar.
 */
export async function incluirVagasNasSessoes(
  db: Db, contaId: string, fuso: string,
  vagas: Array<{ serie_id: string; pessoa_id: string; inicio: string }>,
): Promise<void> {
  for (const v of vagas) {
    const { data: sessoes, error } = await db.from('sessao')
      .select('id').eq('conta_id', contaId).eq('serie_id', v.serie_id)
      .eq('status', 'prevista')
      .gte('inicio', instante(v.inicio, '00:00', fuso))
    if (error) throw error
    if (!sessoes?.length) continue
    const { error: erroP } = await db.from('participacao').upsert(
      sessoes.map((s) => ({
        conta_id: contaId, sessao_id: s.id, pessoa_id: v.pessoa_id,
        origem: 'recorrente' as const, status: 'esperada' as const,
        registrado_por_origem: 'sistema' as const,
      })),
      { onConflict: 'sessao_id,pessoa_id', ignoreDuplicates: true },
    )
    if (erroP) throw erroP
  }
}

/**
 * Quem perdeu o horário fixo sai das aulas dele que já foram geradas.
 *
 * A agenda gera as sessões algumas semanas à frente, com quem tem vaga. Encerrar
 * a vaga (ou trancar, ou encerrar o contrato) só grava o fim dela: sem isto, a
 * pessoa continuava na chamada dessas semanas, ocupando o lugar que a tela dizia
 * ter devolvido. Só sai a participação do horário fixo, ainda em aberto, em aula
 * prevista depois do fim; reposição e avulso marcados à parte ficam.
 */
export async function tirarDasAulasDepoisDoFim(
  db: Db, contaId: string, fuso: string,
  vagas: Array<{ serie_id: string; pessoa_id: string; fim: string | null }>,
): Promise<string[]> {
  const sessoesLiberadas = new Set<string>()
  for (const v of vagas) {
    if (!v.fim) continue
    const { data, error } = await db.from('participacao')
      .select('id, sessao:sessao_id!inner(id, inicio, serie_id, status)')
      .eq('conta_id', contaId).eq('pessoa_id', v.pessoa_id).eq('origem', 'recorrente')
      .in('status', ['esperada', 'confirmada', 'licenca'])
      .eq('sessao.serie_id', v.serie_id).eq('sessao.status', 'prevista')
      .gt('sessao.inicio', instante(v.fim, '00:00', fuso))
      .returns<Array<{ id: string; sessao: { id: string; inicio: string } }>>()
    if (error) throw error
    const depois = (data ?? []).filter((p) => localDe(p.sessao.inicio, fuso).data > v.fim!)
    if (!depois.length) continue
    const { error: erroDelete } = await db.from('participacao')
      .delete().in('id', depois.map((p) => p.id))
    if (erroDelete) throw erroDelete
    for (const p of depois) sessoesLiberadas.add(p.sessao.id)
  }
  return [...sessoesLiberadas]
}
