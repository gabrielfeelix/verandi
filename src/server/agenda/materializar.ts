import { expandirSerie } from '@/core/agenda/expandir'
import type { Excecao, Serie } from '@/core/agenda/tipos'
import type { Db } from '../supabase'

/**
 * `2026-08-03` + `07:00` + `America/Sao_Paulo` → instante absoluto.
 *
 * Descobre o deslocamento do fuso naquela data formatando um palpite em UTC e
 * medindo a diferença. Funciona com horário de verão e sem ele — o Brasil não
 * tem desde 2019, mas o produto não é só do Brasil e a conta escolhe o fuso.
 */
function instante(data: string, hora: string, fuso: string): string {
  const palpite = new Date(`${data}T${hora}:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(
    fmt.formatToParts(palpite)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>

  const comoLocal = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second),
  )
  const deslocamento = comoLocal - palpite.getTime()
  return new Date(palpite.getTime() - deslocamento).toISOString()
}

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
 */
export async function materializarJanela(
  db: Db,
  contaId: string,
  de: string,
  ate: string,
): Promise<{ criadas: number; participacoesCriadas: number }> {
  const { data: conta, error: erroConta } = await db
    .from('conta').select('fuso').eq('id', contaId).single()
  if (erroConta) throw erroConta
  const fuso = conta!.fuso as string

  // `.returns<>()` porque o cliente não tem os tipos do banco gerados: sem
  // isso o supabase-js devolve `GenericStringError` e o tsc recusa tudo
  const { data: series, error: erroSeries } = await db
    .from('serie')
    .select(
      'id, servico_id, profissional_id, local_id, dia_semana, hora_inicio, ' +
      'duracao_min, capacidade, vigencia_inicio, vigencia_fim, ativo',
    )
    .eq('conta_id', contaId).eq('ativo', true)
    .returns<LinhaSerie[]>()
  if (erroSeries) throw erroSeries
  if (!series?.length) return { criadas: 0, participacoesCriadas: 0 }

  const { data: excecoesBrutas } = await db
    .from('excecao_calendario').select('data, tipo')
    .eq('conta_id', contaId).gte('data', de).lte('data', ate)
    .returns<Excecao[]>()
  const excecoes = excecoesBrutas ?? []

  const { data: vagasBrutas } = await db
    .from('vaga').select('serie_id, pessoa_id, inicio, fim').eq('conta_id', contaId)
    .returns<LinhaVaga[]>()
  const vagas = vagasBrutas ?? []

  let criadas = 0
  let participacoesCriadas = 0

  for (const s of series) {
    const serie: Serie = {
      id: s.id,
      diaSemana: s.dia_semana,
      horaInicio: String(s.hora_inicio).slice(0, 5),
      duracaoMin: s.duracao_min,
      capacidade: s.capacidade,
      vigenciaInicio: s.vigencia_inicio,
      vigenciaFim: s.vigencia_fim,
      ativo: s.ativo,
    }
    const ocorrencias = expandirSerie(serie, de, ate, excecoes)
    if (!ocorrencias.length) continue

    const linhas = ocorrencias.map((o) => ({
      conta_id: contaId,
      serie_id: o.serieId,
      servico_id: s.servico_id,
      profissional_id: s.profissional_id,
      local_id: s.local_id,
      inicio: instante(o.data, o.horaInicio, fuso),
      duracao_min: o.duracaoMin,
      capacidade: o.capacidade,
      status: o.bloqueada ? 'cancelada' : 'prevista',
      motivo_cancelamento: o.bloqueada ? `Dia marcado como ${o.motivo}` : null,
    }))

    // `ignoreDuplicates` é o `on conflict do nothing`: o que já existe fica
    // como está, inclusive se a capacidade daquele dia tiver sido alterada
    const { data: inseridas, error } = await db
      .from('sessao')
      .upsert(linhas, { onConflict: 'serie_id,inicio', ignoreDuplicates: true })
      .select('id, inicio')
      .returns<LinhaSessao[]>()
    if (error) throw error
    criadas += inseridas?.length ?? 0

    const dasSerie = vagas.filter((v) => v.serie_id === s.id)
    if (!dasSerie.length || !inseridas?.length) continue

    const participacoes = inseridas.flatMap((sessao) => {
      const dia = String(sessao.inicio).slice(0, 10)
      return dasSerie
        .filter((v) => v.inicio <= dia && (v.fim === null || v.fim >= dia))
        .map((v) => ({
          conta_id: contaId,
          sessao_id: sessao.id,
          pessoa_id: v.pessoa_id,
          origem: 'recorrente' as const,
          status: 'esperada' as const,
          registrado_por_origem: 'sistema' as const,
        }))
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
