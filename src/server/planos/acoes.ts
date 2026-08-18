'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import type { Db } from '../supabase'
import type { Recorrencia } from '@/core/planos/plano'

/**
 * O resultado sai como **valor**, e não como exceção.
 *
 * Erro lançado dentro de uma Server Action não atravessa a rede com o texto
 * que escrevemos: o Next entrega ao cliente um erro genérico com identificador,
 * e a tela acaba mostrando "alguma coisa quebrou" no lugar de "o código 002 já
 * é de Mensal, 2x por semana". Quem precisa da frase é justamente quem pode
 * corrigir sozinho, então a frase viaja como dado.
 *
 * É o mesmo formato que `grade/acoes.ts` já usa para colisão de horário.
 */
export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { valor: T }))
  | { ok: false; erro: string }

function falha(e: unknown): { ok: false; erro: string } {
  const m = e instanceof Error ? e.message : ''
  return {
    ok: false,
    erro: m || 'Não foi possível salvar o plano. Tente de novo.',
  }
}

export type EntradaDePlano = {
  codigo: string
  nome: string
  servicoId: string
  recorrencia: Recorrencia
  parcelas: number
  frequenciaSemanal: number | null
  sessoesNoPacote: number | null
  validadeMeses: number | null
  precoVinculadoCent: number
  precoAvulsoCent: number
}

/**
 * Preço é do dono, e a Configuração inteira já é.
 *
 * A conferência fica aqui mesmo assim: a tela some, mas a ação continua sendo
 * uma chamada de rede que qualquer sessão autenticada consegue fazer, e RLS
 * isola conta, não papel.
 */
async function exigirDono() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só quem responde pelo negócio mexe em preço')
  }
  return conta
}

function paraLinha(e: EntradaDePlano) {
  return {
    codigo: e.codigo.trim(),
    nome: e.nome.trim(),
    servico_id: e.servicoId,
    recorrencia: e.recorrencia,
    parcelas: e.parcelas,
    frequencia_semanal: e.frequenciaSemanal,
    sessoes_no_pacote: e.sessoesNoPacote,
    validade_meses: e.validadeMeses,
    preco_vinculado_cent: e.precoVinculadoCent,
    preco_avulso_cent: e.precoAvulsoCent,
  }
}

/**
 * O código repetido é o único erro desta tela que a pessoa resolve sozinha, e a
 * mensagem do Postgres não diz o que fazer.
 *
 * O documento que originou o módulo tem o código 104 em dois planos e o 119 em
 * quatro linhas. Recusar sem dizer **de quem** é o código transforma a correção
 * numa caça ao tesouro por quarenta e duas linhas.
 */
async function comCodigoLegivel<T>(
  db: Db, contaId: string, codigo: string, excluindo: string | null,
  executar: () => Promise<T>,
): Promise<T> {
  try {
    return await executar()
  } catch (e) {
    const erro = e as { code?: string }
    if (erro.code !== '23505') throw e

    let q = db.from('plano').select('nome')
      .eq('conta_id', contaId).eq('codigo', codigo.trim())
    if (excluindo) q = q.neq('id', excluindo)
    const { data } = await q.maybeSingle<{ nome: string }>()

    throw new Error(
      data
        ? `O código ${codigo.trim()} já é de "${data.nome}". Escolha outro.`
        : `O código ${codigo.trim()} já está em uso nesta conta.`,
    )
  }
}

export async function criarPlano(
  entrada: EntradaDePlano,
): Promise<Resultado<string>> {
  try {
    const conta = await exigirDono()
    const db = await clienteServidor()

    const id = await comCodigoLegivel(db, conta.contaId, entrada.codigo, null, async () => {
      const { data, error } = await db.from('plano')
        .insert({ conta_id: conta.contaId, ...paraLinha(entrada) })
        .select('id').single<{ id: string }>()
      if (error) throw error
      return data.id
    })

    await registrar(db, {
      contaId: conta.contaId, entidade: 'plano', entidadeId: id, acao: 'criou',
    })
    revalidatePath('/config')
    return { ok: true, valor: id }
  } catch (e) {
    return falha(e)
  }
}

export async function editarPlano(
  id: string, entrada: EntradaDePlano,
): Promise<Resultado> {
  try {
    const conta = await exigirDono()
    const db = await clienteServidor()

    await comCodigoLegivel(db, conta.contaId, entrada.codigo, id, async () => {
      const { error } = await db.from('plano')
        .update(paraLinha(entrada)).eq('id', id).eq('conta_id', conta.contaId)
      if (error) throw error
    })

    await registrar(db, {
      contaId: conta.contaId, entidade: 'plano', entidadeId: id, acao: 'editou',
    })
    revalidatePath('/config')
    return { ok: true }
  } catch (e) {
    return falha(e)
  }
}

/**
 * Desativar, e não apagar.
 *
 * Um plano que já foi vendido continua nomeando contrato e recibo antigos, e
 * apagá-lo faria o histórico apontar para nada. O que a tela oferece é tirar da
 * lista de escolhas novas, que é o que a pessoa quer quando diz "esse plano não
 * existe mais".
 */
export async function alternarPlano(
  id: string, ativo: boolean,
): Promise<Resultado> {
  try {
    const conta = await exigirDono()
    const db = await clienteServidor()

    const { error } = await db.from('plano')
      .update({ ativo }).eq('id', id).eq('conta_id', conta.contaId)
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'plano', entidadeId: id,
      acao: ativo ? 'reativou' : 'desativou',
    })
    revalidatePath('/config')
    return { ok: true }
  } catch (e) {
    return falha(e)
  }
}
