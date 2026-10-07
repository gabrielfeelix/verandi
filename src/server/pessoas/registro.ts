import { erroDoTelefone, normalizarTelefone } from '@/core/telefone'
import type { Db } from '../supabase'

/**
 * Cadastrar alguém, sem saber quem está pedindo.
 *
 * Mesma razão de `encaixarNaSessao`: a ação de tela lê `cookies()` e a rota da
 * API não tem cookie nenhum. A regra desce para cá e as duas chamam, senão a
 * rota nasce com uma segunda versão de "o que é um cadastro válido" e as duas
 * divergem na primeira mudança.
 *
 * **Nome é o único campo obrigatório, de propósito.** Exigir telefone é o jeito
 * mais rápido de fazer a recepção inventar um número: no dado real, 30% das
 * pessoas não têm telefone cadastrado. Pelo bot vale ainda mais, porque quem
 * está conversando pode não querer dar o número antes de saber se há vaga.
 */
export async function inserirPessoa(
  db: Db,
  contaId: string,
  entrada: {
    nome: string; telefone?: string | null; identificadorExterno?: string | null
    /** aluno do Gympass/Wellhub */
    gympass?: boolean
  },
): Promise<{ id: string }> {
  const nome = entrada.nome.trim()
  if (!nome) throw new Error('nome é obrigatório')

  // telefone continua opcional; o que não se aceita é telefone pela metade:
  // nove dígitos sem DDD é um número que não disca e ninguém adivinha depois
  const erroFone = erroDoTelefone(entrada.telefone)
  if (erroFone) throw new Error(erroFone)

  const digitado = entrada.identificadorExterno?.trim()
  if (digitado) await recusarNumeroEmUso(db, contaId, digitado)

  // o banco recusa número repetido: dois cadastros juntos pegam o mesmo
  // "próximo", e o segundo tenta o seguinte
  for (let tentativa = 0; ; tentativa++) {
    const { data, error } = await db.from('pessoa').insert({
      conta_id: contaId,
      nome,
      telefone: normalizarTelefone(entrada.telefone),
      identificador_externo: digitado || await proximoNumero(db, contaId),
      gympass: entrada.gympass ?? false,
    }).select('id').single()

    if (!error) return { id: data.id }
    if (error.code !== NUMERO_REPETIDO) throw error
    if (digitado) await recusarNumeroEmUso(db, contaId, digitado)
    if (digitado || tentativa >= 2) throw new Error(NUMERO_ACABOU_DE_SER_USADO)
  }
}

/** Violação do índice `pessoa_numero_da_ficha_unico` (migration 0073). */
export const NUMERO_REPETIDO = '23505'
export const NUMERO_ACABOU_DE_SER_USADO = 'Esse Nº da ficha acabou de ser usado. Salve de novo.'

/** "072" e "72" são o mesmo número de ficha; o que não é número compara como texto. */
const mesmoNumero = (a: string, b: string) =>
  /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) === Number(b) : a === b

async function numerosDaConta(db: Db, contaId: string) {
  const { data, error } = await db.from('pessoa')
    .select('id, nome, identificador_externo')
    .eq('conta_id', contaId).not('identificador_externo', 'is', null)
  if (error) throw error
  return data ?? []
}

/**
 * O próximo Nº da ficha livre na conta.
 *
 * Todo aluno tem número: em branco no cadastro, ele nasce com o seguinte ao
 * maior que já existe, com zeros à esquerda no tamanho dos outros ("440" numa
 * conta que veio da planilha com "001" a "439"). Conta nova começa em "001".
 */
export async function proximoNumero(db: Db, contaId: string): Promise<string> {
  const numericos = (await numerosDaConta(db, contaId))
    .map((p) => p.identificador_externo!)
    .filter((x) => /^\d+$/.test(x))
  const maior = Math.max(0, ...numericos.map(Number))
  const largura = Math.max(3, ...numericos.filter((x) => Number(x) === maior).map((x) => x.length))
  return String(maior + 1).padStart(largura, '0')
}

/** Dois alunos com o mesmo número é ficha trocada no balcão. */
export async function recusarNumeroEmUso(
  db: Db, contaId: string, numero: string, exceto?: string,
): Promise<void> {
  const dono = (await numerosDaConta(db, contaId))
    .find((p) => p.id !== exceto && mesmoNumero(p.identificador_externo!, numero))
  if (dono) throw new Error(`O Nº ${numero} já é de ${dono.nome}. Use outro, ou deixe em branco para gerar o próximo.`)
}
