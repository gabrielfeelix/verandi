import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

/**
 * As tabelas do Plano 03 sob a mesma régua das outras: nada vaza entre contas,
 * e quem escreve é quem tem o papel.
 */
describe('isolamento das tabelas de configuração', () => {
  const a = admin()
  let contaA: string
  let contaB: string
  let dono: Awaited<ReturnType<typeof comoUsuario>>
  let recepcao: Awaited<ReturnType<typeof comoUsuario>>
  let suporte: Awaited<ReturnType<typeof comoUsuario>>
  let deFora: Awaited<ReturnType<typeof comoUsuario>>

  beforeAll(async () => {
    const marca = `${Date.now()}-cfg`

    const { data: cA } = await a.from('conta')
      .insert({ nome: 'Estúdio A', slug: `cfg-a-${marca}` }).select().single()
    const { data: cB } = await a.from('conta')
      .insert({ nome: 'Salão B', slug: `cfg-b-${marca}` }).select().single()
    contaA = cA!.id
    contaB = cB!.id

    dono = await comoUsuario(`dono-${marca}@teste.local`)
    recepcao = await comoUsuario(`recepcao-${marca}@teste.local`)
    suporte = await comoUsuario(`suporte-${marca}@teste.local`)
    deFora = await comoUsuario(`fora-${marca}@teste.local`)

    await a.from('usuario_conta').insert([
      { usuario_id: dono.usuarioId, conta_id: contaA, papel: 'dono' },
      { usuario_id: recepcao.usuarioId, conta_id: contaA, papel: 'recepcao' },
      { usuario_id: suporte.usuarioId, conta_id: contaA, papel: 'suporte' },
      { usuario_id: deFora.usuarioId, conta_id: contaB, papel: 'dono' },
    ])

    await a.from('convite').insert({
      conta_id: contaA, email: 'convidada@teste.local', papel: 'recepcao',
      token_hash: `hash-${marca}`,
      expira_em: new Date(Date.now() + 7 * 864e5).toISOString(),
    })
    await a.from('funcionamento').insert({
      conta_id: contaA, dia_semana: 1, abre: '06:00', fecha: '21:00',
    })
    await a.from('pendencia_dispensada').insert({
      conta_id: contaA, tipo: 'cadastro_incompleto',
      referencia_id: crypto.randomUUID(), motivo: 'não usa telefone',
    })
    await a.from('acesso_suporte').insert({
      conta_id: contaA, usuario_id: suporte.usuarioId,
    })
  })

  const tabelas = ['convite', 'funcionamento', 'pendencia_dispensada', 'acesso_suporte']

  it.each(tabelas)('quem é da conta lê %s', async (tabela) => {
    const { data, error } = await dono.cliente.from(tabela).select('conta_id')
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    expect(data!.every((l) => l.conta_id === contaA)).toBe(true)
  })

  it.each(tabelas)('quem é de outra conta não lê %s', async (tabela) => {
    const { data } = await deFora.cliente.from(tabela).select('conta_id')
    expect(data).toEqual([])
  })

  it('o token nunca sai do banco em claro — só o hash é coluna', async () => {
    const { data } = await a.from('convite').select('*').eq('conta_id', contaA)
    const colunas = Object.keys(data![0])
    expect(colunas).toContain('token_hash')
    expect(colunas.some((c) => c === 'token' || c.endsWith('_token'))).toBe(false)
  })

  it('recepção não convida — convidar é de quem manda na conta', async () => {
    const { error } = await recepcao.cliente.from('convite').insert({
      conta_id: contaA, email: 'x@teste.local', papel: 'profissional',
      token_hash: `hash-recepcao-${Date.now()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
    expect(error).not.toBeNull()
  })

  it('dono convida', async () => {
    const { error } = await dono.cliente.from('convite').insert({
      conta_id: contaA, email: 'nova@teste.local', papel: 'profissional',
      token_hash: `hash-dono-${Date.now()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
    expect(error).toBeNull()
  })

  it('dois convites pendentes para o mesmo e-mail são recusados', async () => {
    const email = `duplo-${Date.now()}@teste.local`
    const linha = () => ({
      conta_id: contaA, email, papel: 'profissional' as const,
      token_hash: `hash-${Math.random()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
    const { error: primeiro } = await a.from('convite').insert(linha())
    expect(primeiro).toBeNull()
    const { error: segundo } = await a.from('convite').insert(linha())
    expect(segundo?.code).toBe('23505')
  })

  it('convidar de novo depois de revogar é caminho normal', async () => {
    const email = `revogada-${Date.now()}@teste.local`
    const { data: antigo } = await a.from('convite').insert({
      conta_id: contaA, email, papel: 'profissional',
      token_hash: `hash-rev-${Math.random()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    }).select().single()

    await a.from('convite').update({ revogado_em: new Date().toISOString() })
      .eq('id', antigo!.id)

    const { error } = await a.from('convite').insert({
      conta_id: contaA, email, papel: 'profissional',
      token_hash: `hash-rev2-${Math.random()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
    expect(error).toBeNull()
  })

  it('e-mail em maiúscula não escapa do convite pendente', async () => {
    const email = `Caixa-${Date.now()}@Teste.local`
    const linha = (e: string) => ({
      conta_id: contaA, email: e, papel: 'profissional' as const,
      token_hash: `hash-${Math.random()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
    await a.from('convite').insert(linha(email))
    const { error } = await a.from('convite').insert(linha(email.toLowerCase()))
    expect(error?.code).toBe('23505')
  })

  it('recepção dispensa pendência — é quem opera a tela', async () => {
    const { error } = await recepcao.cliente.from('pendencia_dispensada').insert({
      conta_id: contaA, tipo: 'chamada_nao_feita',
      referencia_id: crypto.randomUUID(), motivo: 'turma não aconteceu',
    })
    expect(error).toBeNull()
  })

  it('dispensar a mesma pendência duas vezes é recusado', async () => {
    const referencia = crypto.randomUUID()
    const linha = {
      conta_id: contaA, tipo: 'reposicao_aberta', referencia_id: referencia,
      motivo: 'combinado por fora',
    }
    expect((await a.from('pendencia_dispensada').insert(linha)).error).toBeNull()
    expect((await a.from('pendencia_dispensada').insert(linha)).error?.code).toBe('23505')
  })

  it('tipo de pendência inventado é recusado pelo banco', async () => {
    const { error } = await a.from('pendencia_dispensada').insert({
      conta_id: contaA, tipo: 'inventado', referencia_id: crypto.randomUUID(),
      motivo: 'x',
    })
    expect(error).not.toBeNull()
  })

  it('dono não registra acesso de suporte no nome dele', async () => {
    const { error } = await dono.cliente.from('acesso_suporte')
      .insert({ conta_id: contaA, usuario_id: dono.usuarioId })
    expect(error).not.toBeNull()
  })

  it('suporte registra o próprio acesso, e não o de outro', async () => {
    const proprio = await suporte.cliente.from('acesso_suporte')
      .insert({ conta_id: contaA, usuario_id: suporte.usuarioId })
    expect(proprio.error).toBeNull()

    const alheio = await suporte.cliente.from('acesso_suporte')
      .insert({ conta_id: contaA, usuario_id: dono.usuarioId })
    expect(alheio.error).not.toBeNull()
  })

  it('funcionamento com fecha antes de abre é recusado', async () => {
    const { error } = await a.from('funcionamento')
      .insert({ conta_id: contaB, dia_semana: 2, abre: '21:00', fecha: '06:00' })
    expect(error).not.toBeNull()
  })

  it('um intervalo por dia da semana em cada conta', async () => {
    const linha = { conta_id: contaB, dia_semana: 3, abre: '08:00', fecha: '18:00' }
    expect((await a.from('funcionamento').insert(linha)).error).toBeNull()
    expect((await a.from('funcionamento').insert(linha)).error?.code).toBe('23505')
  })
})
