'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { BALDE_AVALIACAO, podeVerAvaliacao } from './consultas'
import { proximaOrdem } from '@/core/avaliacao/posicoes'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const LIMITE = 5 * 1024 * 1024

async function exigirQuemAtende() {
  const conta = await exigirConta()
  if (!podeVerAvaliacao(conta.papel)) {
    throw new Error('a avaliação é de quem atende e de quem responde pelo negócio')
  }
  return conta
}

/**
 * A visita.
 *
 * A data é escolhida por quem registra, e não é `now()`: fotografar hoje e
 * cadastrar amanhã é o que acontece de verdade num estúdio cheio, e uma data
 * automática colocaria a avaliação na coluna errada da comparação.
 */
export async function criarAvaliacao(entrada: {
  pessoaId: string
  data: string
  profissionalId?: string | null
  observacao?: string | null
}): Promise<{ id: string }> {
  const conta = await exigirQuemAtende()
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()

  const { data, error } = await db.from('avaliacao').insert({
    conta_id: conta.contaId,
    pessoa_id: entrada.pessoaId,
    data: entrada.data,
    profissional_id: entrada.profissionalId || null,
    observacao: entrada.observacao || null,
    criado_por_usuario_id: user?.id ?? null,
  }).select('id').single<{ id: string }>()
  if (error) throw error

  revalidatePath(`/pessoas/${entrada.pessoaId}`)
  return { id: data.id }
}

/**
 * A foto de uma posição.
 *
 * Uma por posição por visita: subir de novo troca a que estava lá, e o arquivo
 * velho é sobrescrito no mesmo caminho. Guardar as duas encheria o balde de
 * tentativa, e a comparação passaria a depender de qual delas a tela escolheu
 * mostrar, que é uma decisão que ninguém tomou.
 */
export async function salvarFotoDaAvaliacao(
  avaliacaoId: string, posicaoId: string, foto: File, observacao?: string,
): Promise<void> {
  const conta = await exigirQuemAtende()
  if (!TIPOS.includes(foto.type)) throw new Error('a foto precisa ser JPEG, PNG ou WEBP')
  if (foto.size > LIMITE) throw new Error('a foto precisa ter até 5 MB')

  const db = await clienteServidor()
  const { data: av } = await db.from('avaliacao')
    .select('pessoa_id').eq('id', avaliacaoId).eq('conta_id', conta.contaId)
    .maybeSingle<{ pessoa_id: string }>()
  if (!av) throw new Error('avaliação não encontrada')

  const ext = foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg'
  const caminho = `${conta.contaId}/${av.pessoa_id}/${avaliacaoId}/${posicaoId}.${ext}`

  const envio = await db.storage.from(BALDE_AVALIACAO)
    .upload(caminho, foto, { upsert: true, contentType: foto.type })
  if (envio.error) throw envio.error

  const r = await db.from('avaliacao_foto').upsert({
    conta_id: conta.contaId,
    avaliacao_id: avaliacaoId,
    posicao_id: posicaoId,
    path: caminho,
    observacao: observacao || null,
  }, { onConflict: 'avaliacao_id,posicao_id' })
  if (r.error) throw r.error

  revalidatePath(`/pessoas/${av.pessoa_id}`)
}

/**
 * Uma posição nova, escrita pela conta.
 *
 * "Flexão de coluna" é do pilates, "Perfil direito" é da ortodontia, e a lista
 * não cabe no código. Entra no fim, que é onde quem acabou de criar espera
 * encontrá-la.
 */
export async function criarPosicao(nome: string): Promise<{ id: string }> {
  const conta = await exigirQuemAtende()
  const limpo = nome.trim()
  if (!limpo) throw new Error('a posição precisa de um nome')

  const db = await clienteServidor()
  const { data: atuais } = await db.from('posicao_avaliacao')
    .select('nome, ordem').eq('conta_id', conta.contaId)
    .returns<Array<{ nome: string; ordem: number }>>()

  const { data, error } = await db.from('posicao_avaliacao').insert({
    conta_id: conta.contaId,
    nome: limpo,
    ordem: proximaOrdem(atuais ?? []),
    ativo: true,
  }).select('id').single<{ id: string }>()

  // `23505` é o único da lista que a pessoa consegue resolver sozinha, e a
  // mensagem do Postgres não diz o que fazer
  if (error?.code === '23505') throw new Error(`Esta conta já tem a posição ${limpo}.`)
  if (error) throw error

  return { id: data.id }
}

/**
 * Apagar a visita inteira.
 *
 * Não há "desativar" aqui: uma avaliação registrada na pessoa errada é o caso
 * comum, e ela precisa sumir de verdade, com as imagens junto. Quem apaga é
 * quem responde pelo negócio.
 */
export async function apagarAvaliacao(id: string): Promise<void> {
  const conta = await exigirQuemAtende()
  const db = await clienteServidor()

  const { data: av } = await db.from('avaliacao')
    .select('pessoa_id').eq('id', id).eq('conta_id', conta.contaId)
    .maybeSingle<{ pessoa_id: string }>()
  if (!av) return

  const { data: fotos } = await db.from('avaliacao_foto')
    .select('path').eq('avaliacao_id', id).eq('conta_id', conta.contaId)
    .returns<Array<{ path: string }>>()

  // o arquivo primeiro: apagar a linha antes deixaria a imagem no balde sem
  // ninguém que soubesse que ela existe
  if (fotos && fotos.length > 0) {
    await db.storage.from(BALDE_AVALIACAO).remove(fotos.map((f) => f.path))
  }

  const r = await db.from('avaliacao').delete()
    .eq('id', id).eq('conta_id', conta.contaId)
  if (r.error) throw r.error

  revalidatePath(`/pessoas/${av.pessoa_id}`)
}
