'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { hojeEm } from '../agenda/fuso'
import { abrirLicenca, encerrarLicenca, prorrogarLicenca } from './licencas'

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
}

/** "Prorrogar" em Pendências: nova data, ou sem data. */
export async function mudarVolta(licencaId: string, voltaPrevista: string | null): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') throw new Error('pendências são da operação')
  const db = await clienteServidor()
  await prorrogarLicenca(db, conta.contaId, licencaId, dataOuNulo(voltaPrevista))
  revalidatePath('/pendencias')
  revalidatePath('/hoje')
}

/** "Voltou" em Pendências: encerra sem precisar esperar a próxima chamada. */
export async function marcarVolta(pessoaId: string): Promise<void> {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') throw new Error('pendências são da operação')
  const db = await clienteServidor()
  await encerrarLicenca(db, conta.contaId, [pessoaId], 'operador')
  revalidatePath('/pendencias')
  revalidatePath('/hoje')
}
