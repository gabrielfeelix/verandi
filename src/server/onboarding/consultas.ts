import { clienteServidor } from '../conta'
import type { Db } from '../supabase'

export type Roteiro = 'boas-vindas' | 'primeiros-passos'

export type EstadoRoteiro = {
  passo: number
  concluido: boolean
  pulado: boolean
}

const NOVO: EstadoRoteiro = { passo: 0, concluido: false, pulado: false }

type Linha = {
  roteiro: Roteiro
  passo: number
  concluido_em: string | null
  pulado_em: string | null
}

/**
 * O que esta pessoa já viu, nesta conta.
 *
 * Linha ausente é o estado inicial e não é erro: quem nunca entrou não tem
 * progresso. Guardar uma linha vazia no primeiro acesso só criaria escrita numa
 * leitura de página.
 */
export async function estadoDoOnboarding(
  db: Db, contaId: string, usuarioId: string,
): Promise<Record<Roteiro, EstadoRoteiro>> {
  /*
   * `.returns<>()` porque `onboarding.roteiro` é `text` com `check`, e o
   * arquivo gerado diz `string`. A união é `Roteiro`, e é o que faz o `saida[
   * l.roteiro]` abaixo ser seguro em vez de um `any` disfarçado.
   */
  const { data } = await db
    .from('onboarding')
    .select('roteiro, passo, concluido_em, pulado_em')
    .eq('conta_id', contaId)
    .eq('usuario_id', usuarioId)
    .returns<{
      roteiro: Roteiro; passo: number
      concluido_em: string | null; pulado_em: string | null
    }[]>()

  const saida: Record<Roteiro, EstadoRoteiro> = {
    'boas-vindas': { ...NOVO },
    'primeiros-passos': { ...NOVO },
  }

  for (const l of data ?? []) {
    saida[l.roteiro] = {
      passo: l.passo,
      concluido: l.concluido_em != null,
      pulado: l.pulado_em != null,
    }
  }
  return saida
}

/** `true` quando não há mais nada a mostrar: já concluiu ou já disse não. */
export function encerrado(e: EstadoRoteiro): boolean {
  return e.concluido || e.pulado
}

/**
 * A conta ainda não começou a operar?
 *
 * As boas-vindas valem para qualquer um, mas apontar "monte o primeiro horário"
 * para quem já tem a semana no ar é o tutorial falando de um problema que a
 * pessoa resolveu sozinha.
 *
 * O que conta é **grade e gente**, não catálogo: a conta criada pelo suporte já
 * nasce com serviço e local, e mesmo assim está inteira por montar. Duas
 * contagens com `head`, sem trazer linha nenhuma.
 */
export async function contaVazia(db: Db, contaId: string): Promise<boolean> {
  // `'serie' | 'pessoa'`, e não `string`: com os tipos do banco gerados,
  // `db.from(string)` não compila mais, e é bom que não compile. Nome de tabela
  // em variável solta é como se erra o nome sem nada avisar.
  const quantos = async (tabela: 'serie' | 'pessoa') => {
    const { count } = await db.from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('conta_id', contaId)
    return count ?? 0
  }
  return (await quantos('serie')) === 0 && (await quantos('pessoa')) === 0
}

/** Atalho para telas de servidor que já têm conta e usuário na mão. */
export async function dbEUsuario() {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  return { db, usuarioId: user?.id ?? null }
}
