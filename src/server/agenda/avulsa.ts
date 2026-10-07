'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { hojeEm, instante } from './fuso'
import { encaixar } from './acoes'
import { materializarCobrancas } from '../financeiro/materializar'

/**
 * Aula avulsa fora da grade: "a aluna quer uma ventosa na terça".
 *
 * Pedido do MGM (07/out/2026): para cobrar uma aula avulsa era preciso criar
 * plano, ligar na modalidade e só então matricular, e marcar só funcionava em
 * aula que a grade já tinha gerado. Aqui é um passo: a aula nasce na agenda
 * com um lugar, a pessoa entra como avulso e, com valor, sai a cobrança.
 *
 * A cobrança precisa de contrato (`cobranca.contrato_id` é obrigatório), e o
 * contrato de plano: o plano "Aula avulsa" da modalidade é criado uma vez e
 * reaproveitado. O valor de cada aula fica no contrato, não no plano, então
 * duas avulsas de preços diferentes não mexem uma na outra.
 */

type Entrada = {
  pessoaId: string
  /** modalidade existente, ou `null` com `novoServico` para criar ali mesmo */
  servicoId: string | null
  novoServico?: string
  data: string
  hora: string
  duracaoMin: number
  profissionalId: string | null
  /** zero: aula sem cobrança (cortesia, experimental) */
  valorCent: number
}

type Resultado = { ok: true; sessaoId: string } | { ok: false; erro: string }

export async function profissionaisParaAvulsa(): Promise<Array<{ id: string; nome: string }>> {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const { data } = await db.from('profissional').select('id, nome')
    .eq('conta_id', conta.contaId).eq('ativo', true).order('nome')
  return data ?? []
}

export async function marcarAulaAvulsa(e: Entrada): Promise<Resultado> {
  try {
    const conta = await exigirConta()
    if (conta.papel !== 'dono' && conta.papel !== 'recepcao' && conta.papel !== 'suporte') {
      return { ok: false, erro: 'Quem marca aula avulsa é a recepção ou quem responde pelo negócio.' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data) || !/^\d{2}:\d{2}$/.test(e.hora)) {
      return { ok: false, erro: 'Escolha o dia e a hora da aula.' }
    }
    const duracao = Math.round(e.duracaoMin)
    if (!(duracao >= 5 && duracao <= 600)) return { ok: false, erro: 'A duração vai de 5 a 600 minutos.' }
    if (!(e.valorCent >= 0)) return { ok: false, erro: 'O valor não pode ser negativo.' }

    const db = await clienteServidor()

    let servicoId = e.servicoId
    if (!servicoId) {
      const nome = (e.novoServico ?? '').trim()
      if (nome.length < 2) return { ok: false, erro: 'Escolha a modalidade ou escreva o nome da nova.' }
      const { data: existente } = await db.from('servico').select('id')
        .eq('conta_id', conta.contaId).ilike('nome', nome).maybeSingle()
      if (existente) {
        servicoId = existente.id
      } else {
        const { data: criado, error } = await db.from('servico').insert({
          conta_id: conta.contaId, nome, duracao_min: duracao, capacidade_padrao: 1,
        }).select('id').single()
        if (error) throw error
        servicoId = criado.id
      }
    }

    let contratoId: string | null = null
    if (e.valorCent > 0) {
      contratoId = await contratoAvulso(db, conta.contaId, e.pessoaId, servicoId!, e.data, e.valorCent)
    }

    const { data: sessao, error: erroSessao } = await db.from('sessao').insert({
      conta_id: conta.contaId,
      serie_id: null,
      servico_id: servicoId!,
      profissional_id: e.profissionalId,
      local_id: null,
      inicio: instante(e.data, e.hora, conta.fuso),
      duracao_min: duracao,
      capacidade: 1,
      status: 'prevista',
    }).select('id').single()
    if (erroSessao) throw erroSessao

    // pelo mesmo caminho de todo encaixe: o evento para o bot e a ligação com o
    // contrato com saldo (o avulso que acabou de nascer) saem de lá
    const r = await encaixar({ sessaoId: sessao.id, pessoaId: e.pessoaId, origem: 'avulso' })
    if (!r.ok) {
      await db.from('sessao').delete().eq('id', sessao.id)
      if (contratoId) await db.from('contrato').delete().eq('id', contratoId)
      return { ok: false, erro: 'Não foi possível marcar a pessoa nesta aula.' }
    }

    if (contratoId) await materializarCobrancas(db, conta.contaId, hojeEm(conta.fuso), contratoId)

    revalidatePath(`/pessoas/${e.pessoaId}`)
    revalidatePath('/semana')
    revalidatePath('/financeiro')
    return { ok: true, sessaoId: sessao.id }
  } catch (erro) {
    console.error('aula avulsa', erro)
    return { ok: false, erro: 'Não foi possível criar a aula avulsa. Tente de novo.' }
  }
}

type Db = Awaited<ReturnType<typeof clienteServidor>>

async function contratoAvulso(
  db: Db, contaId: string, pessoaId: string, servicoId: string, dia: string, valorCent: number,
): Promise<string> {
  const { data: plano } = await db.from('plano').select('id')
    .eq('conta_id', contaId).eq('servico_id', servicoId)
    .eq('recorrencia', 'avulsa').eq('ativo', true)
    .order('criado_em').limit(1).maybeSingle()

  let planoId = plano?.id
  if (!planoId) {
    // o código é único na conta: "AV" mais o primeiro número livre
    const { data: codigos } = await db.from('plano').select('codigo').eq('conta_id', contaId)
    const usados = new Set((codigos ?? []).map((c) => c.codigo))
    let n = 1
    while (usados.has(`AV${n}`)) n++
    const { data: novo, error } = await db.from('plano').insert({
      conta_id: contaId, servico_id: servicoId, codigo: `AV${n}`, nome: 'Aula avulsa',
      recorrencia: 'avulsa', preco_vinculado_cent: valorCent, preco_avulso_cent: valorCent,
    }).select('id').single()
    if (error) throw error
    planoId = novo.id
  }

  const { data: { user } } = await db.auth.getUser()
  const { data: contrato, error } = await db.from('contrato').insert({
    conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
    inicio: dia, fim: dia, preco_aplicado_cent: valorCent,
    criado_por_usuario_id: user?.id ?? null,
  }).select('id').single()
  if (error) throw error
  return contrato.id
}
