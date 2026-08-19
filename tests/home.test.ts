import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

/**
 * O arranjo da tela inicial é da **pessoa**, e não da conta.
 *
 * Todas as outras tabelas param o isolamento na conta, porque o dado é do
 * negócio: quem divide a conta divide a agenda, o caixa e a ficha. Esta não,
 * e é a primeira do produto assim. Quem senta ao lado não tem por que ler, e
 * muito menos escrever, o arranjo de tela de quem senta do outro lado.
 *
 * Vale testar contra o banco e não contra `src/server` porque a garantia é da
 * RLS: um `select` que esquecesse de filtrar por usuário continuaria devolvendo
 * uma linha só, e o defeito só apareceria na conta com duas pessoas dentro.
 */
describe('a preferência da tela inicial, no banco', () => {
  const a = admin()
  const marca = Date.now()
  let contaId: string
  let dono: Awaited<ReturnType<typeof comoUsuario>>
  let recepcao: Awaited<ReturnType<typeof comoUsuario>>

  beforeAll(async () => {
    const { data: c } = await a.from('conta')
      .insert({ nome: 'Estúdio da home', slug: `home-${marca}` }).select().single()
    contaId = c!.id

    dono = await comoUsuario(`home-dono-${marca}@teste.local`)
    recepcao = await comoUsuario(`home-recepcao-${marca}@teste.local`)
    await a.from('usuario_conta').insert([
      { usuario_id: dono.usuarioId, conta_id: contaId, papel: 'dono' },
      { usuario_id: recepcao.usuarioId, conta_id: contaId, papel: 'recepcao' },
    ])
  })

  it('cada pessoa grava a sua, e lê só a sua', async () => {
    await dono.cliente.from('preferencia_home').insert({
      conta_id: contaId, usuario_id: dono.usuarioId,
      blocos: [{ id: 'caixa', visivel: true }],
    })
    await recepcao.cliente.from('preferencia_home').insert({
      conta_id: contaId, usuario_id: recepcao.usuarioId,
      blocos: [{ id: 'pendencias', visivel: true }],
    })

    const doDono = await dono.cliente.from('preferencia_home')
      .select('usuario_id, blocos').eq('conta_id', contaId)
    expect(doDono.data).toHaveLength(1)
    expect(doDono.data![0].usuario_id).toBe(dono.usuarioId)
    expect(doDono.data![0].blocos).toEqual([{ id: 'caixa', visivel: true }])

    const daRecepcao = await recepcao.cliente.from('preferencia_home')
      .select('usuario_id').eq('conta_id', contaId)
    expect(daRecepcao.data).toHaveLength(1)
    expect(daRecepcao.data![0].usuario_id).toBe(recepcao.usuarioId)
  })

  /*
   * O dono enxerga a equipe inteira em `usuario_conta`, de propósito. Aqui ele
   * não enxerga nada: "responder pelo negócio" não inclui decidir a tela de
   * quem trabalha nele.
   */
  it('nem o dono escreve na tela da recepção', async () => {
    const { error } = await dono.cliente.from('preferencia_home').upsert({
      conta_id: contaId, usuario_id: recepcao.usuarioId,
      blocos: [{ id: 'dica', visivel: false }],
    })
    expect(error).not.toBeNull()

    // e a da recepção continua como ela deixou
    const dela = await recepcao.cliente.from('preferencia_home')
      .select('blocos').eq('conta_id', contaId).single()
    expect(dela.data!.blocos).toEqual([{ id: 'pendencias', visivel: true }])
  })

  it('quem não é da conta não grava nada nela', async () => {
    const forasteiro = await comoUsuario(`home-fora-${marca}@teste.local`)
    const { error } = await forasteiro.cliente.from('preferencia_home').insert({
      conta_id: contaId, usuario_id: forasteiro.usuarioId,
      blocos: [{ id: 'agenda', visivel: true }],
    })
    expect(error).not.toBeNull()
  })

  /*
   * O `jsonb` guarda uma lista, e o banco garante só isso: qual bloco existe é
   * assunto de `core/home/blocos.ts`, que ignora o que não conhece. Um objeto
   * solto no lugar da lista quebraria a leitura antes de chegar lá.
   */
  it('o banco recusa o que não é lista', async () => {
    const { error } = await dono.cliente.from('preferencia_home').upsert({
      conta_id: contaId, usuario_id: dono.usuarioId,
      blocos: { id: 'caixa' },
    })
    expect(error).not.toBeNull()
  })

  it('gravar de novo troca o arranjo, e não cria uma segunda linha', async () => {
    await dono.cliente.from('preferencia_home').upsert({
      conta_id: contaId, usuario_id: dono.usuarioId,
      blocos: [{ id: 'agenda', visivel: true }],
    }, { onConflict: 'conta_id,usuario_id' })

    const { data } = await dono.cliente.from('preferencia_home')
      .select('blocos').eq('conta_id', contaId)
    expect(data).toHaveLength(1)
    expect(data![0].blocos).toEqual([{ id: 'agenda', visivel: true }])
  })
})
