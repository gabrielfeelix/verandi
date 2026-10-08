'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { hojeEm } from '../agenda/fuso'
import { abrirLicenca, encerrarLicenca, prorrogarLicenca } from './licencas'
import { corrigirProrrogacao } from './prorrogacao'
import { registrar } from '../log'

const DATA = /^\d{4}-\d{2}-\d{2}$/

function dataOuNulo(v: string | null | undefined) {
  if (!v) return null
  if (!DATA.test(v)) throw new Error('data inválida')
  return v
}

/**
 * A data de volta dita logo depois de marcar licença na chamada.
 *
 * A licença já está aberta nessa hora (o toque em "Licença" abriu); isto só
 * grava a data. Se por corrida ela ainda não existir, abre com início hoje.
 */
export async function definirVolta(pessoaId: string, voltaPrevista: string | null): Promise<void> {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  const volta = dataOuNulo(voltaPrevista)
  if (!volta) return
  await abrirLicenca(db, conta.contaId, pessoaId, {
    inicio: hojeEm(conta.fuso), voltaPrevista: volta, usuarioId: user?.id ?? null,
  })
  revalidatePath('/pendencias')
  revalidatePath('/hoje')
  revalidatePath('/semana')
}

/** "Prorrogar" em Pendências: nova data, ou sem data. */
export async function mudarVolta(licencaId: string, voltaPrevista: string | null): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') throw new Error('pendências são da operação')
  const db = await clienteServidor()
  await prorrogarLicenca(db, conta.contaId, licencaId, dataOuNulo(voltaPrevista))
  revalidatePath('/pendencias')
  revalidatePath('/hoje')
  revalidatePath('/semana')
}

/** "Voltou" em Pendências: encerra sem precisar esperar a próxima chamada. */
export async function marcarVolta(pessoaId: string): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') throw new Error('pendências são da operação')
  const db = await clienteServidor()
  await encerrarLicenca(db, conta.contaId, [pessoaId], 'operador')
  revalidatePath('/pendencias')
  revalidatePath('/hoje')
  revalidatePath('/semana')
}

/**
 * "Corrigir" no cartão do plano: quantos dias a licença devolveu.
 *
 * Erro volta como valor, pela mesma razão de `contratos/acoes.ts`: a frase do
 * teto ("o plano devolve até 7 dias") é o que deixa a recepção acertar sozinha.
 */
export async function corrigirDiasDaLicenca(
  licencaId: string, pessoaId: string, dias: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const conta = await exigirConta()
    if (conta.papel === 'profissional') {
      return { ok: false, erro: 'Quem corrige o plano é a recepção ou o dono.' }
    }
    const db = await clienteServidor()
    const r = await corrigirProrrogacao(db, conta.contaId, licencaId, dias)
    if (!r.ok) return r
    await registrar(db, {
      contaId: conta.contaId, entidade: 'pessoa', entidadeId: pessoaId,
      acao: 'editou', detalhe: { licenca: licencaId, diasProrrogados: r.dias },
    })
    revalidatePath(`/pessoas/${pessoaId}`)
    revalidatePath('/pessoas')
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível corrigir.' }
  }
}
