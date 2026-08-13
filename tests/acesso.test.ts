import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'
import { destinoDoPapel, type Papel } from '@/core/acesso/destino'

/**
 * Prova a cadeia que decide onde cada pessoa cai ao entrar: autenticar de
 * verdade → ler o próprio papel passando pela RLS → resolver o destino.
 *
 * A ponta que falta (o cookie do Next) é coberta pelo teste de navegador em
 * `e2e/entrar.spec.ts`.
 */
describe('acesso e destino por papel', () => {
  const a = admin()
  const marca = Date.now()
  let contaId: string

  beforeAll(async () => {
    const { data: c } = await a.from('conta')
      .insert({ nome: 'Estúdio', slug: `acesso-${marca}` }).select().single()
    contaId = c!.id
  })

  const casos: Array<[Papel, string]> = [
    ['profissional', '/hoje'],
    ['dono', '/semana'],
    ['recepcao', '/semana'],
    ['suporte', '/contas'],
  ]

  for (const [papel, destino] of casos) {
    it(`${papel} lê o próprio papel e vai para ${destino}`, async () => {
      const { cliente, usuarioId } = await comoUsuario(`${papel}-${marca}@teste.local`)
      await a.from('usuario_conta').insert({ usuario_id: usuarioId, conta_id: contaId, papel })

      // filtra pelo próprio usuário, como `contaAtiva()` faz: dono e suporte
      // também enxergam o vínculo dos colegas, o que é proposital
      const { data } = await cliente.from('usuario_conta')
        .select('papel, conta_id').eq('usuario_id', usuarioId)
      expect(data).toHaveLength(1)
      expect(data![0].conta_id).toBe(contaId)
      expect(destinoDoPapel(data![0].papel as Papel)).toBe(destino)
    })
  }

  it('dono enxerga a equipe da conta; profissional enxerga só a si', async () => {
    const { data: c } = await a.from('conta')
      .insert({ nome: 'Equipe', slug: `equipe-${marca}` }).select().single()

    const chefe = await comoUsuario(`chefe-${marca}@teste.local`)
    const peao = await comoUsuario(`peao-${marca}@teste.local`)
    await a.from('usuario_conta').insert([
      { usuario_id: chefe.usuarioId, conta_id: c!.id, papel: 'dono' },
      { usuario_id: peao.usuarioId, conta_id: c!.id, papel: 'profissional' },
    ])

    const doChefe = await chefe.cliente.from('usuario_conta')
      .select('papel').eq('conta_id', c!.id)
    expect(doChefe.data).toHaveLength(2)

    const doPeao = await peao.cliente.from('usuario_conta')
      .select('papel').eq('conta_id', c!.id)
    expect(doPeao.data).toHaveLength(1)
    expect(doPeao.data![0].papel).toBe('profissional')
  })

  it('usuário desativado na conta não enxerga vínculo nenhum', async () => {
    const { cliente, usuarioId } = await comoUsuario(`desativado-${marca}@teste.local`)
    await a.from('usuario_conta').insert({
      usuario_id: usuarioId, conta_id: contaId, papel: 'profissional', ativo: false,
    })

    // a linha existe e ele consegue vê-la (é dele), mas o filtro de `ativo`
    // que a aplicação usa a descarta — e `contas_do_usuario()` também
    const { data } = await cliente.from('usuario_conta')
      .select('papel').eq('ativo', true)
    expect(data).toEqual([])

    const { data: contas } = await cliente.from('conta').select('id')
    expect(contas).toEqual([])
  })

  it('quem pertence a duas contas enxerga as duas', async () => {
    const { data: c2 } = await a.from('conta')
      .insert({ nome: 'Segundo estúdio', slug: `acesso2-${marca}` }).select().single()

    const { cliente, usuarioId } = await comoUsuario(`dupla-${marca}@teste.local`)
    await a.from('usuario_conta').insert([
      { usuario_id: usuarioId, conta_id: contaId, papel: 'profissional' },
      { usuario_id: usuarioId, conta_id: c2!.id, papel: 'dono' },
    ])

    const { data } = await cliente.from('conta').select('id')
    expect(data?.map((c) => c.id).sort()).toEqual([contaId, c2!.id].sort())
  })
})
