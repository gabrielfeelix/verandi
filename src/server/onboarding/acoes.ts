'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { predefinicao, ehTipoDeNegocio } from '@/core/vocabulario/predefinicoes'
import type { ChaveVocabulario } from '@/core/vocabulario/padrao'
import type { Roteiro } from './consultas'

/**
 * Onde a pessoa parou.
 *
 * Uma linha por (pessoa, conta, roteiro), sempre por `upsert`: gravar progresso
 * não pode falhar porque a linha ainda não existia, e o primeiro passo é a
 * primeira gravação.
 */
async function gravar(roteiro: Roteiro, campos: Record<string, unknown>) {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return

  const { error } = await db.from('onboarding').upsert(
    { conta_id: conta.contaId, usuario_id: user.id, roteiro, ...campos },
    { onConflict: 'usuario_id,conta_id,roteiro' },
  )
  if (error) throw error
}

/** Guarda o passo atual, para quem fechar a aba recomeçar de onde estava. */
export async function marcarPasso(roteiro: Roteiro, passo: number): Promise<void> {
  await gravar(roteiro, { passo })
}

export async function concluir(roteiro: Roteiro): Promise<void> {
  await gravar(roteiro, { concluido_em: new Date().toISOString() })
}

/**
 * Pular é resposta, e é definitiva.
 *
 * Reoferecer amanhã o que a pessoa recusou hoje é desrespeito com quem já disse
 * não, e é como um produto ganha fama de insistente.
 */
export async function pular(roteiro: Roteiro): Promise<void> {
  await gravar(roteiro, { pulado_em: new Date().toISOString() })
}

/**
 * O tipo de negócio, que escreve o vocabulário inteiro de uma vez.
 *
 * É a primeira pergunta do produto porque muda o texto de todas as telas
 * seguintes: quem abre um estúdio e lê "Pessoa" e "Sessão" conclui que o
 * sistema é de outro ramo e vai embora antes de cadastrar nada.
 *
 * Não sobrescreve o que já foi ajustado à mão: se a conta já tem vocabulário
 * próprio, escolher um tipo agora seria apagar decisão de gente com
 * predefinição de fábrica.
 */
export async function escolherTipoDeNegocio(tipo: string): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só o dono da conta escolhe o tipo de negócio')
  }
  if (!ehTipoDeNegocio(tipo)) throw new Error('tipo de negócio desconhecido')

  const db = await clienteServidor()
  const { palavras } = predefinicao(tipo)

  const { data: jaTem } = await db.from('vocabulario')
    .select('chave').eq('conta_id', conta.contaId)
    .returns<{ chave: ChaveVocabulario }[]>()
  const escolhidas = new Set((jaTem ?? []).map((l) => l.chave))

  const linhas = (Object.keys(palavras) as ChaveVocabulario[])
    .filter((chave) => !escolhidas.has(chave))
    .map((chave) => ({
      conta_id: conta.contaId,
      chave,
      singular: palavras[chave].singular,
      plural: palavras[chave].plural,
    }))

  if (linhas.length) {
    const { error } = await db.from('vocabulario').insert(linhas)
    if (error) throw error
  }

  await registrar(db, {
    contaId: conta.contaId, entidade: 'vocabulario', acao: 'editou',
    detalhe: { tipoDeNegocio: tipo },
  })

  // o vocabulário aparece em toda tela; o shell inteiro precisa recarregar
  revalidatePath('/', 'layout')
}
