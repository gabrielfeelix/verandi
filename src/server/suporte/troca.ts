'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { clienteServidor } from '../conta'
import { clienteAdmin } from '../supabase'
import { ehSuporte } from './consultas'
import { entrarComoSuporte, sairDoSuporte } from './acoes'
import type { Papel } from '@/core/acesso/destino'

export type ContaParaTrocar = { contaId: string; nome: string; ativa: boolean }

/**
 * As empresas que o suporte alcança pelo seletor do topo do rail.
 *
 * O suporte não é membro dos clientes: a lista dele é a da administração, e
 * não `contasDoUsuario`. Trinta por busca, em ordem de nome, porque quem abre o
 * seletor sabe o nome de quem vai atender; a tela inteira, paginada e com os
 * sinais de vida, continua sendo `/admin/empresas`.
 */
export async function contasDoSuporte(busca: string): Promise<ContaParaTrocar[]> {
  const db = await clienteServidor()
  if (!(await ehSuporte(db))) return []

  let q = clienteAdmin()
    .from('conta')
    .select('id, nome, ativo')
    .eq('interna', false)
  // mesma limpeza de `listarContas`: `or()` recebe filtro em texto
  const limpa = busca.trim().replace(/[%,()]/g, '')
  if (limpa) q = q.or(`nome.ilike.%${limpa}%,slug.ilike.%${limpa}%`)

  const { data } = await q.order('nome').limit(30)
  return (data ?? []).map((c) => ({ contaId: c.id, nome: c.nome, ativa: c.ativo }))
}

/**
 * Troca a conta ativa sem passar pela tela de `/contas`.
 *
 * Quem é membro da conta troca o cookie e pronto. O suporte passa pelo mesmo
 * caminho do "Entrar" da administração: o acesso anterior é encerrado e o novo
 * é registrado **antes** da primeira tela, porque ver dado de cliente sem
 * deixar rastro é justamente o que `acesso_suporte` existe para impedir.
 *
 * Devolve o papel na conta nova: quem chamou decide se a tela aberta continua
 * valendo para ele (a profissional não abre o Financeiro).
 */
export async function trocarDeConta(contaId: string): Promise<{ papel: Papel }> {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/entrar')

  const jar = await cookies()
  const atual = jar.get('conta')?.value

  // vínculo próprio: o temporário do suporte não conta como pertencer
  const { data: vinculo } = await db
    .from('usuario_conta')
    .select('papel')
    .eq('usuario_id', user.id)
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .neq('papel', 'suporte')
    .maybeSingle()

  if (vinculo) {
    // sair de um cliente atendido como suporte fecha o registro daquele acesso
    if (atual && atual !== contaId) await sairDoSuporte()
    jar.set('conta', contaId, { httpOnly: true, sameSite: 'lax', path: '/' })
    return { papel: vinculo.papel as Papel }
  }

  if (!(await ehSuporte(db))) throw new Error('você não tem acesso a essa conta')
  if (atual && atual !== contaId) await sairDoSuporte()
  await entrarComoSuporte(contaId)
  return { papel: 'suporte' }
}
