'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { hojeEm, instante } from '../agenda/fuso'
import type { ChaveVocabulario } from '@/core/vocabulario/padrao'
import { BALDE_FOTO } from './equipe'
import { BALDE_ASSINATURA } from './consultas'
import { LIMITE_ENVIO_MB, MB } from '@/core/foto'
import type { Resultado } from '../planos/acoes'

/**
 * A recusa sai como **valor**, e não como exceção.
 *
 * Erro lançado dentro de uma Server Action não atravessa a rede com o texto que
 * escrevemos: o Next entrega ao cliente um erro genérico com identificador, e a
 * tela mostra "alguma coisa quebrou" no lugar de "falta a razão social". Quem
 * precisa da frase é justamente quem pode corrigir sozinho. É a mesma decisão
 * de `planos/acoes.ts`, e ela chegou aqui tarde: as recusas de documento e de
 * série já existiam e nenhuma das duas nunca chegou à tela.
 */
const recusa = (erro: string) => ({ ok: false as const, erro })

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

/**
 * Quem emite o recibo.
 *
 * O documento é conferido só no comprimento: CNPJ tem catorze dígitos e CPF tem
 * onze, e conferir o dígito do CNPJ aqui seria a terceira regra de documento
 * neste sistema para um campo que quem digita é o dono da conta, sobre a
 * própria empresa, uma vez na vida. O CPF do cliente é outra conversa, e esse
 * confere dígito desde o módulo 16: ele é digitado por outra pessoa, às pressas,
 * na recepção.
 */
export async function salvarEmitente(e: {
  razaoSocial: string
  documento: string
  endereco: string
  telefone: string
  serieRecibo: string
  assinaturaNome?: string
  assinaturaCargo?: string
}): Promise<Resultado> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const razaoSocial = e.razaoSocial.trim()
  const documento = e.documento.replace(/\D/g, '')
  if (documento && documento.length !== 11 && documento.length !== 14) {
    return recusa('O documento precisa ser um CPF (11 dígitos) ou um CNPJ (14).')
  }

  /*
   * Meio emitente não é emitente, e salvar meio calado é o defeito.
   *
   * Esta tela tem uma função só: destravar a emissão de recibo. Aceitar o CNPJ
   * sem a razão social gravava metade, respondia "Emitente salvo" e deixava a
   * emissão barrada exatamente como antes — a pessoa saía daqui achando que
   * tinha terminado, e a conta ia descobrir no balcão. Aconteceu em produção,
   * na primeira vez que alguém preencheu esta tela.
   *
   * A recusa mora aqui, e não só na tela: a ação é uma chamada de rede que
   * qualquer sessão autenticada consegue fazer.
   */
  if (!razaoSocial || !documento) {
    const falta = [
      !razaoSocial ? 'a razão social' : null,
      !documento ? 'o CNPJ ou CPF' : null,
    ].filter(Boolean).join(' e ')
    return recusa(
      `Falta ${falta}. Sem os dois a recepção continua sem conseguir emitir ` +
      'recibo, e é por isso que salvar pela metade não ajuda.',
    )
  }

  const serie = e.serieRecibo.trim().toUpperCase() || 'A'
  if (!/^[A-Z0-9]{1,4}$/.test(serie)) {
    return recusa('A série do recibo é de 1 a 4 letras ou números, sem espaço.')
  }

  const { error } = await db.from('conta').update({
    razao_social: razaoSocial,
    documento: documento || null,
    endereco_emitente: e.endereco.trim() || null,
    telefone_emitente: e.telefone.trim() || null,
    serie_recibo: serie,
    assinatura_nome: e.assinaturaNome?.trim() || null,
    assinatura_cargo: e.assinaturaCargo?.trim() || null,
  }).eq('id', conta.contaId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'conta', entidadeId: conta.contaId,
    acao: 'editou', detalhe: { emitente: { razaoSocial, serie } },
  })
  revalidatePath('/config')
  revalidatePath('/recibos')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Serviço, local
// ---------------------------------------------------------------------------

export async function salvarServico(e: {
  id?: string
  nome: string
  duracaoMin: number
  capacidadePadrao: number
  /** agrupa modalidades parecidas na tabela de preços; em branco vira nulo */
  categoria?: string | null
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
    categoria: e.categoria?.trim() || null,
    ativo: e.ativo,
  }

  const r = e.id
    ? await db.from('servico').update(linha).eq('id', e.id).select('id').single()
    : await db.from('servico').insert(linha).select('id').single()
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
    ? await db.from('local').update(linha).eq('id', e.id).select('id').single()
    : await db.from('local').insert(linha).select('id').single()
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
 * aberta deixaria a aula na grade, e a materialização nunca apaga, então
 * ninguém corrigiria isso depois.
 *
 * **E quem tinha lugar naquele dia sai com reposição em aberto.** Cancelar a
 * sessão sem tocar em `participacao` deixava quarenta pessoas sem a aula e sem
 * crédito nenhum: quem perdeu o dia foi o negócio que fechou, não quem faltou.
 * O status é `cancelada`, que é o que `/pendencias` lê como crédito, e nunca
 * `falta_avisada` — essa diria que a pessoa avisou, e ainda dependeria de a
 * conta ter ligado o crédito para falta avisada, que é outra pergunta.
 *
 * O nome do valor no banco continua `cancelar_avisar`, de quando o aviso
 * automático estava previsto para o mesmo passo. O aviso é do Marco 2; a tela
 * diz isso, em vez de prometer mensagem que ninguém manda.
 */
export async function salvarDataFechada(e: {
  id?: string
  data: string
  tipo: 'feriado' | 'fechado'
  descricao?: string
  acao: 'cancelar_avisar' | 'so_marcar'
}): Promise<{ sessoesCanceladas: number; reposicoesAbertas: number }> {
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
    .select('id').single()
  if (r.error) throw r.error

  let sessoesCanceladas = 0
  let reposicoesAbertas = 0
  if (e.acao === 'cancelar_avisar' && e.data >= hojeEm(conta.fuso)) {
    const de = instante(e.data, '00:00', conta.fuso)
    const ate = instante(e.data, '23:59', conta.fuso)

    const { data: alvo, error } = await db.from('sessao')
      .update({
        status: 'cancelada',
        motivo_cancelamento: `Dia marcado como ${e.tipo}${linha.descricao ? `, ${linha.descricao}` : ''}`,
      })
      .eq('conta_id', conta.contaId)
      .eq('status', 'prevista')
      .gte('inicio', de).lte('inicio', ate)
      .select('id')
      
    if (error) throw error
    sessoesCanceladas = alvo?.length ?? 0

    if (sessoesCanceladas > 0) {
      // só quem ainda não tinha registro: presença, falta ou licença já
      // escritas naquele dia são fato, e fato não se reescreve por decreto
      const { data: soltas, error: erroPart } = await db.from('participacao')
        .update({ status: 'cancelada' })
        .eq('conta_id', conta.contaId)
        .in('sessao_id', alvo!.map((s) => s.id))
        .in('status', ['esperada', 'confirmada'])
        .select('id')
        
      if (erroPart) throw erroPart
      reposicoesAbertas = soltas?.length ?? 0
    }
  }

  await registrar(db, {
    contaId: conta.contaId, entidade: 'excecao_calendario', entidadeId: r.data.id,
    acao: e.id ? 'editou' : 'criou',
    detalhe: {
      data: e.data, tipo: e.tipo, acaoEscolhida: e.acao,
      sessoesCanceladas, reposicoesAbertas,
    },
  })

  revalidatePath('/config')
  revalidatePath('/semana')
  revalidatePath('/hoje')
  revalidatePath('/pendencias')
  return { sessoesCanceladas, reposicoesAbertas }
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

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const TAMANHO_MAX = LIMITE_ENVIO_MB * MB

/**
 * Cria ou edita um profissional, com foto opcional.
 *
 * `profissional` existe sem usuário de propósito: um nome na grade não precisa
 * de acesso ao sistema. Dar login é outro ato, e ele mora no convite.
 */
export async function salvarProfissional(entrada: FormData): Promise<{ id: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const id = String(entrada.get('id') ?? '') || undefined
  const nome = String(entrada.get('nome') ?? '').trim()
  if (!nome) throw new Error('o profissional precisa de nome')

  const linha = {
    conta_id: conta.contaId,
    nome,
    email: String(entrada.get('email') ?? '').trim() || null,
    telefone: String(entrada.get('telefone') ?? '').trim() || null,
    cor: String(entrada.get('cor') ?? '').trim() || null,
    ativo: entrada.get('ativo') === 'on',
  }

  const r = id
    ? await db.from('profissional').update(linha).eq('id', id)
        .select('id').single()
    : await db.from('profissional').insert(linha).select('id').single()
  if (r.error) throw r.error
  const profissionalId = r.data.id

  const foto = entrada.get('foto')
  if (foto instanceof File && foto.size > 0) {
    if (!TIPOS_FOTO.includes(foto.type)) {
      throw new Error('a foto precisa ser JPEG, PNG ou WEBP')
    }
    if (foto.size > TAMANHO_MAX) {
      throw new Error(`a foto precisa ter até ${LIMITE_ENVIO_MB} MB depois de reduzida`)
    }

    // a primeira pasta é a conta: é por ela que a política do balde separa um
    // cliente do outro
    const ext = foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg'
    const caminho = `${conta.contaId}/${profissionalId}.${ext}`

    const envio = await db.storage.from(BALDE_FOTO)
      .upload(caminho, foto, { upsert: true, contentType: foto.type })
    if (envio.error) throw envio.error

    const atualiza = await db.from('profissional')
      .update({ foto_path: caminho }).eq('id', profissionalId)
    if (atualiza.error) throw atualiza.error
  }

  const servicos = entrada.getAll('servicos').map(String).filter(Boolean)
  const antigos = await db.from('profissional_servico')
    .delete().eq('profissional_id', profissionalId)
  if (antigos.error) throw antigos.error
  if (servicos.length) {
    const vinculo = await db.from('profissional_servico').insert(
      servicos.map((servicoId) => ({
        conta_id: conta.contaId,
        profissional_id: profissionalId,
        servico_id: servicoId,
      })),
    )
    if (vinculo.error) throw vinculo.error
  }

  await registrar(db, {
    contaId: conta.contaId, entidade: 'profissional', entidadeId: profissionalId,
    acao: id ? (linha.ativo ? 'editou' : 'desativou') : 'criou',
    detalhe: { nome, servicos: servicos.length },
  })

  revalidatePath('/config')
  revalidatePath('/grade')
  return { id: profissionalId }
}

/**
 * Tira a foto, e tira do balde também.
 *
 * Apagar só a coluna deixaria o arquivo lá — dado pessoal órfão que ninguém
 * lembra de existir é o pior tipo de dado pessoal.
 */
export async function removerFoto(profissionalId: string): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { data, error } = await db.from('profissional')
    .select('foto_path').eq('id', profissionalId).single()
  if (error) throw error
  if (!data.foto_path) return

  const apaga = await db.storage.from(BALDE_FOTO).remove([data.foto_path])
  if (apaga.error) throw apaga.error

  const limpa = await db.from('profissional')
    .update({ foto_path: null }).eq('id', profissionalId)
  if (limpa.error) throw limpa.error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'profissional', entidadeId: profissionalId,
    acao: 'editou', detalhe: { foto: 'removida' },
  })
  revalidatePath('/config')
}


// ---------------------------------------------------------------------------
// A assinatura do recibo
// ---------------------------------------------------------------------------

const TIPOS_ASSINATURA = ['image/png', 'image/jpeg', 'image/webp']
const TAMANHO_ASSINATURA = 1024 * 1024

/**
 * Guardar a imagem da assinatura.
 *
 * Vem como `FormData` porque é arquivo: Server Action com `File` dentro de
 * objeto simples não atravessa. Só o dono chega aqui, e a política do balde diz
 * a mesma coisa: a recepção emite recibo o dia inteiro sem precisar poder
 * trocar a marca de quem responde pelo negócio.
 *
 * A imagem substitui a anterior no mesmo caminho, e o caminho leva a extensão:
 * trocar um PNG por um JPEG sem isso deixaria o arquivo velho órfão no balde,
 * que é o defeito que a foto do profissional já pagou uma vez.
 */
export async function salvarAssinatura(entrada: FormData): Promise<Resultado> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const arquivo = entrada.get('assinatura')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return recusa('Escolha a imagem da assinatura.')
  }
  if (!TIPOS_ASSINATURA.includes(arquivo.type)) {
    return recusa('A assinatura precisa ser PNG, JPEG ou WEBP. SVG não entra: é documento com script.')
  }
  if (arquivo.size > TAMANHO_ASSINATURA) {
    return recusa('A assinatura precisa ter até 1 MB. Uma foto da assinatura em fundo branco costuma ter bem menos.')
  }

  const ext = arquivo.type === 'image/png' ? 'png'
    : arquivo.type === 'image/webp' ? 'webp' : 'jpg'
  const caminho = `${conta.contaId}/assinatura.${ext}`

  const envio = await db.storage.from(BALDE_ASSINATURA)
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type })
  if (envio.error) throw envio.error

  // a extensão pode ter mudado: o arquivo antigo vira lixo que ninguém vê
  const { data: antes } = await db.from('conta')
    .select('assinatura_path').eq('id', conta.contaId).maybeSingle()
  if (antes?.assinatura_path && antes.assinatura_path !== caminho) {
    await db.storage.from(BALDE_ASSINATURA).remove([antes.assinatura_path])
  }

  const { error } = await db.from('conta')
    .update({ assinatura_path: caminho }).eq('id', conta.contaId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'conta', entidadeId: conta.contaId,
    acao: 'editou', detalhe: { assinatura: 'enviada' },
  })
  revalidatePath('/config')
  revalidatePath('/recibos')
  return { ok: true }
}

/** Tirar a assinatura: o papel volta a sair com a linha em branco. */
export async function removerAssinatura(): Promise<Resultado> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const { data } = await db.from('conta')
    .select('assinatura_path').eq('id', conta.contaId).maybeSingle()
  if (data?.assinatura_path) {
    await db.storage.from(BALDE_ASSINATURA).remove([data.assinatura_path])
  }

  const { error } = await db.from('conta')
    .update({ assinatura_path: null }).eq('id', conta.contaId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'conta', entidadeId: conta.contaId,
    acao: 'editou', detalhe: { assinatura: 'removida' },
  })
  revalidatePath('/config')
  revalidatePath('/recibos')
  return { ok: true }
}
