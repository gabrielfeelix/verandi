import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { erro, type Contexto } from './rota'

/**
 * A defesa contra a chamada repetida.
 *
 * O bot repete, e não por bug: a rede cai depois de o servidor gravar e antes de
 * a resposta chegar, o WhatsApp reentrega a mensagem, a esteira roda duas vezes.
 * Quem chama não tem como saber se a primeira tentativa funcionou. Sem defesa, a
 * segunda marca a mesma pessoa de novo, e quem descobre é a professora contando
 * cabeças numa turma de quatro.
 *
 * O contrato é o de mercado: quem chama manda `Idempotency-Key`, e a repetição
 * recebe **a mesma resposta, com o mesmo status**, sem executar nada de novo.
 *
 * **É opcional, e a documentação insiste.** Exigir travaria quem só quer
 * experimentar a rota com um `curl`, e uma API que é chata de experimentar é uma
 * API que ninguém liga.
 */

/** O cabeçalho, como quem chama escreve. */
export const CABECALHO = 'Idempotency-Key'

export type Resposta = { status: number; corpo: unknown }

function hash(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

/**
 * Executa uma escrita no máximo uma vez por chave.
 *
 * A ordem das operações é o ponto inteiro desta função, e ela é contraintuitiva:
 * **grava a marca antes de executar**, não depois. Gravar depois deixa uma
 * janela entre executar e registrar, e é exatamente nela que a reentrega cai
 * quando a rede está ruim, que é quando a reentrega acontece.
 *
 * A marca nasce com `status = 0`, que significa "estou executando". Se uma
 * segunda chamada encontra o zero, ela responde 409 em vez de esperar: quem
 * chama repete daqui a pouco e encontra a resposta pronta, e ninguém fica com
 * uma conexão aberta segurando uma transação.
 */
export async function comIdempotencia(
  req: NextRequest,
  ctx: Contexto,
  rota: string,
  corpoBruto: string,
  executar: () => Promise<Resposta>,
): Promise<NextResponse> {
  const chave = req.headers.get(CABECALHO)?.trim()

  if (!chave) {
    const r = await executar()
    return NextResponse.json(r.corpo, { status: r.status })
  }

  if (chave.length > 200) {
    return erro(400, 'Idempotency-Key não pode passar de 200 caracteres')
  }

  const corpoHash = hash(corpoBruto)
  const marca = { conta_id: ctx.contaId, chave, rota }

  const reserva = await ctx.db
    .from('pedido_idempotente')
    .insert({ ...marca, corpo_hash: corpoHash, status: 0, corpo: {} })

  if (reserva.error) {
    // 23505 é a chave duplicada, e aqui ela não é erro: é a reentrega chegando
    if (reserva.error.code !== '23505') throw reserva.error

    const { data: antigo, error } = await ctx.db
      .from('pedido_idempotente')
      .select('corpo_hash, status, corpo')
      .eq('conta_id', ctx.contaId).eq('chave', chave).eq('rota', rota)
      .single()
    if (error) throw error

    /*
     * Mesma chave, corpo diferente. Isso não é reentrega, é bug de quem chama, e
     * devolver a resposta antiga marcaria silenciosamente o horário errado. A
     * recusa é o favor.
     */
    if (antigo.corpo_hash !== corpoHash) {
      return erro(422, `esta ${CABECALHO} já foi usada com outro conteúdo`)
    }

    if (antigo.status === 0) {
      return erro(409, 'este pedido ainda está sendo processado, tente de novo em instantes')
    }

    return NextResponse.json(antigo.corpo, {
      status: antigo.status,
      headers: { 'Idempotent-Replay': 'true' },
    })
  }

  let r: Resposta
  try {
    r = await executar()
  } catch (e) {
    /*
     * Falhou de verdade: a marca sai, senão a chave fica queimada para sempre e
     * quem chama nunca mais consegue tentar aquele pedido. Um 500 é para ser
     * repetido, não para virar sentença.
     */
    await ctx.db.from('pedido_idempotente').delete()
      .eq('conta_id', ctx.contaId).eq('chave', chave).eq('rota', rota)
    throw e
  }

  await ctx.db.from('pedido_idempotente')
    .update({ status: r.status, corpo: r.corpo as never })
    .eq('conta_id', ctx.contaId).eq('chave', chave).eq('rota', rota)

  return NextResponse.json(r.corpo, { status: r.status })
}

/**
 * O corpo de um `POST`, lido uma vez e devolvido nas duas formas.
 *
 * O texto cru é o que entra no hash da idempotência, e ele precisa ser
 * exatamente o que chegou: reserializar o objeto mudaria a ordem das chaves e
 * faria a mesma chamada ter dois hashes diferentes conforme o cliente.
 */
export async function lerCorpo(
  req: NextRequest,
): Promise<{ bruto: string; json: Record<string, unknown> } | null> {
  const bruto = await req.text()
  if (!bruto.trim()) return { bruto: '', json: {} }
  try {
    const json = JSON.parse(bruto)
    if (typeof json !== 'object' || json === null || Array.isArray(json)) return null
    return { bruto, json: json as Record<string, unknown> }
  } catch {
    return null
  }
}
