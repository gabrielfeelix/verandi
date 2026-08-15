import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

/**
 * A prova de aceite, e o cadeado dela.
 *
 * A tabela não é dado de conta: é o registro que a 4YU guarda de que alguém
 * aceitou um documento dela, e ela carrega endereço de rede. Um usuário logado
 * não pode ler nem escrever ali, e o motivo de haver teste é o `alter default
 * privileges` da `0030`, que concede a `authenticated` tudo que nasce em
 * `app_verandi` — foi assim que a `migrations_aplicadas` nasceu aberta.
 */
describe('aceite de termos', () => {
  let usuarioId: string
  let cliente: Awaited<ReturnType<typeof comoUsuario>>['cliente']
  const marca = Date.now()

  beforeAll(async () => {
    const u = await comoUsuario(`aceite-${marca}@teste.local`)
    usuarioId = u.usuarioId
    cliente = u.cliente

    await admin().from('aceite_de_termos').insert({
      usuario_id: usuarioId, documento: 'termos', versao: '1.0',
      origem: 'entrada', ip: '203.0.113.7', agente: 'teste',
    })
  })

  it('quem está logado não lê o registro de ninguém, nem o próprio', async () => {
    const { data } = await cliente.from('aceite_de_termos').select('id')
    expect(data ?? []).toEqual([])
  })

  it('quem está logado não escreve nem apaga', async () => {
    const escreve = await cliente.from('aceite_de_termos').insert({
      usuario_id: usuarioId, documento: 'termos', versao: '9.9', origem: 'entrada',
    })
    expect(escreve.error).not.toBeNull()

    await cliente.from('aceite_de_termos').delete().eq('usuario_id', usuarioId)
    const { count } = await admin()
      .from('aceite_de_termos')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
    expect(count).toBe(1)
  })

  it('a mesma versão não vira linha nova', async () => {
    // quem entra toda manhã não precisa de uma linha por manhã
    const { error } = await admin().from('aceite_de_termos').insert({
      usuario_id: usuarioId, documento: 'termos', versao: '1.0', origem: 'entrada',
    })
    expect(error?.code).toBe('23505')
  })

  it('versão nova vira linha nova, que é o ponto de guardar a versão', async () => {
    const { error } = await admin().from('aceite_de_termos').insert({
      usuario_id: usuarioId, documento: 'termos', versao: '1.1', origem: 'entrada',
    })
    expect(error).toBeNull()
  })

  it('documento que não existe não entra', async () => {
    const { error } = await admin().from('aceite_de_termos').insert({
      usuario_id: usuarioId, documento: 'contrato', versao: '1.0', origem: 'entrada',
    })
    expect(error?.code).toBe('23514')
  })
})
