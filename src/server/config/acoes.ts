'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { hojeEm, instante } from '../agenda/fuso'
import type { ChaveVocabulario } from '@/core/vocabulario/padrao'

/**
 * Configuração é de quem manda na conta. A RLS recusa igual; aqui a recusa
 * fala, e a mensagem é o que a tela mostra.
 */
async function exigirDono() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta mexe na configuração')
  }
  return conta
}

// ---------------------------------------------------------------------------
// Padrões
// ---------------------------------------------------------------------------

export async function salvarPadroes(p: {
  capacidadePadrao: number
  duracaoPadraoMin: number
  intervaloMin: number
  prazoReposicaoDias: number
  encaixeAcima: boolean
  creditoFaltaAvisada: boolean
  horariosSugeridos: string[]
}): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  if (p.capacidadePadrao < 1) throw new Error('a capacidade padrão precisa ser ao menos 1')
  if (p.duracaoPadraoMin < 1) throw new Error('a duração padrão precisa ser ao menos 1 minuto')
  if (p.intervaloMin < 0) throw new Error('o intervalo não pode ser negativo')
  if (p.prazoReposicaoDias < 1) throw new Error('o prazo da reposição precisa ser ao menos 1 dia')

  const horarios = [...new Set(p.horariosSugeridos.filter(Boolean))].sort()

  const { error } = await db.from('conta').update({
    capacidade_padrao: p.capacidadePadrao,
    duracao_padrao_min: p.duracaoPadraoMin,
    intervalo_min: p.intervaloMin,
    prazo_reposicao_dias: p.prazoReposicaoDias,
    encaixe_acima: p.encaixeAcima,
    credito_falta_avisada: p.creditoFaltaAvisada,
    horarios_sugeridos: horarios,
  }).eq('id', conta.contaId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'conta', entidadeId: conta.contaId,
    acao: 'editou', detalhe: { padroes: p },
  })
  revalidatePath('/config')
  revalidatePath('/grade')
}

// ---------------------------------------------------------------------------
// Serviço, local
// ---------------------------------------------------------------------------

export async function salvarServico(e: {
  id?: string
  nome: string
  duracaoMin: number
  capacidadePadrao: number
  ativo: boolean
}): Promise<{ id: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const nome = e.nome.trim()
  if (!nome) throw new Error('o serviço precisa de nome')
  if (e.duracaoMin < 1) throw new Error('a duração precisa ser ao menos 1 minuto')
  if (e.capacidadePadrao < 1) throw new Error('a capacidade precisa ser ao menos 1')

  const linha = {
    conta_id: conta.contaId,
    nome,
    duracao_min: e.duracaoMin,
    capacidade_padrao: e.capacidadePadrao,
    ativo: e.ativo,
  }

  const r = e.id
    ? await db.from('servico').update(linha).eq('id', e.id).select('id').single<{ id: string }>()
    : await db.from('servico').insert(linha).select('id').single<{ id: string }>()
  if (r.error) throw r.error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'servico', entidadeId: r.data.id,
    acao: e.id ? (e.ativo ? 'editou' : 'desativou') : 'criou',
    detalhe: { nome },
  })
  revalidatePath('/config')
  return { id: r.data.id }
}

export async function salvarLocal(e: {
  id?: string
  nome: string
  capacidade?: number | null
  ativo: boolean
}): Promise<{ id: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const nome = e.nome.trim()
  if (!nome) throw new Error('o local precisa de nome')
  if (e.capacidade != null && e.capacidade < 1) {
    throw new Error('a capacidade do local precisa ser ao menos 1')
  }

  const linha = {
    conta_id: conta.contaId,
    nome,
    capacidade: e.capacidade ?? null,
    ativo: e.ativo,
  }

  const r = e.id
    ? await db.from('local').update(linha).eq('id', e.id).select('id').single<{ id: string }>()
    : await db.from('local').insert(linha).select('id').single<{ id: string }>()
  if (r.error) throw r.error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'local', entidadeId: r.data.id,
    acao: e.id ? (e.ativo ? 'editou' : 'desativou') : 'criou',
    detalhe: { nome },
  })
  revalidatePath('/config')
  return { id: r.data.id }
}

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

/**
 * O vocabulário muda **só o texto**. Nada nos dados é reescrito: a conta que
 * chama pessoa de "Aluno" continua com as mesmas linhas em `pessoa`.
 */
export async function salvarVocabulario(
  itens: { chave: ChaveVocabulario; singular: string; plural: string }[],
): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const linhas = itens
    .map((i) => ({
      conta_id: conta.contaId,
      chave: i.chave,
      singular: i.singular.trim(),
      plural: i.plural.trim(),
    }))
    .filter((i) => i.singular && i.plural)

  if (!linhas.length) return

  const { error } = await db.from('vocabulario')
    .upsert(linhas, { onConflict: 'conta_id,chave' })
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'vocabulario', acao: 'editou',
    detalhe: { chaves: linhas.map((l) => l.chave) },
  })

  // o vocabulário aparece em toda tela; o shell inteiro precisa recarregar
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Funcionamento e datas fechadas
// ---------------------------------------------------------------------------

/**
 * Dia sem linha é dia fechado.
 *
 * Guardar um `aberto: false` junto de um horário seria duas fontes para o mesmo
 * fato, e um dia elas discordam.
 */
export async function salvarFuncionamento(
  dias: { diaSemana: number; abre: string | null; fecha: string | null }[],
): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const abertos = dias.filter((d) => d.abre && d.fecha)
  for (const d of abertos) {
    if (d.fecha! <= d.abre!) {
      throw new Error('o horário de fechar precisa ser depois do de abrir')
    }
  }

  const fechados = dias.filter((d) => !d.abre || !d.fecha).map((d) => d.diaSemana)
  if (fechados.length) {
    const { error } = await db.from('funcionamento')
      .delete().eq('conta_id', conta.contaId).in('dia_semana', fechados)
    if (error) throw error
  }

  if (abertos.length) {
    const { error } = await db.from('funcionamento').upsert(
      abertos.map((d) => ({
        conta_id: conta.contaId,
        dia_semana: d.diaSemana,
        abre: d.abre!,
        fecha: d.fecha!,
      })),
      { onConflict: 'conta_id,dia_semana' },
    )
    if (error) throw error
  }

  await registrar(db, {
    contaId: conta.contaId, entidade: 'funcionamento', acao: 'editou',
    detalhe: { abertos: abertos.length },
  })
  revalidatePath('/config')
  revalidatePath('/grade')
}

/**
 * Marca um dia como feriado ou fechado.
 *
 * Com `cancelar_avisar`, as sessões **já materializadas** daquele dia são
 * canceladas na hora. Sem isso, marcar o feriado depois que a semana já foi
 * aberta deixaria a aula na grade — e a materialização nunca apaga, então
 * ninguém corrigiria isso depois.
 */
export async function salvarDataFechada(e: {
  id?: string
  data: string
  tipo: 'feriado' | 'fechado'
  descricao?: string
  acao: 'cancelar_avisar' | 'so_marcar'
}): Promise<{ sessoesCanceladas: number }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const linha = {
    conta_id: conta.contaId,
    data: e.data,
    tipo: e.tipo,
    descricao: e.descricao?.trim() || null,
    acao: e.acao,
  }

  const r = await db.from('excecao_calendario')
    .upsert(linha, { onConflict: 'conta_id,data' })
    .select('id').single<{ id: string }>()
  if (r.error) throw r.error

  let sessoesCanceladas = 0
  if (e.acao === 'cancelar_avisar' && e.data >= hojeEm(conta.fuso)) {
    const de = instante(e.data, '00:00', conta.fuso)
    const ate = instante(e.data, '23:59', conta.fuso)

    const { data: alvo, error } = await db.from('sessao')
      .update({
        status: 'cancelada',
        motivo_cancelamento: `Dia marcado como ${e.tipo}${linha.descricao ? ` — ${linha.descricao}` : ''}`,
      })
      .eq('conta_id', conta.contaId)
      .eq('status', 'prevista')
      .gte('inicio', de).lte('inicio', ate)
      .select('id')
      .returns<{ id: string }[]>()
    if (error) throw error
    sessoesCanceladas = alvo?.length ?? 0
  }

  await registrar(db, {
    contaId: conta.contaId, entidade: 'excecao_calendario', entidadeId: r.data.id,
    acao: e.id ? 'editou' : 'criou',
    detalhe: { data: e.data, tipo: e.tipo, acaoEscolhida: e.acao, sessoesCanceladas },
  })

  revalidatePath('/config')
  revalidatePath('/semana')
  revalidatePath('/hoje')
  return { sessoesCanceladas }
}

export async function removerDataFechada(id: string): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { error } = await db.from('excecao_calendario').delete().eq('id', id)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'excecao_calendario', entidadeId: id,
    acao: 'removeu',
  })
  revalidatePath('/config')
}
