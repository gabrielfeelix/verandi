import { createHash, randomBytes } from 'node:crypto'
import { clienteAdmin, type Db } from '../supabase'
import { PREFIXO, estadoDaChave, prefixoVisivel, segredoDoCabecalho } from '@/core/api/chave'

/** o hash é o que fica no banco; o segredo some depois de mostrado uma vez */
export function hashDe(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex')
}

/**
 * Um segredo novo, e o que se guarda dele.
 *
 * 32 bytes, o mesmo tamanho do token de convite: o suficiente para adivinhar
 * não ser um caminho. `base64url` porque a chave vai viajar em cabeçalho HTTP e
 * em campo de configuração de outro sistema, onde `+` e `/` viram problema.
 */
export function novaChave(): { segredo: string; hash: string; prefixo: string } {
  const segredo = PREFIXO + randomBytes(32).toString('base64url')
  return { segredo, hash: hashDe(segredo), prefixo: prefixoVisivel(segredo) }
}

export type ContaDaChave = { contaId: string; chaveId: string }

/**
 * Quem está chamando a API, a partir do cabeçalho `Authorization`.
 *
 * Devolve `null` para qualquer coisa que não seja uma chave viva: ausente, mal
 * formada, inexistente ou revogada. Quem chama recebe 401 sem detalhe nos
 * quatro casos, porque "essa chave existiu" já é informação demais para quem
 * está tentando.
 *
 * **Usa a chave de serviço**, e é o único jeito: quem chama a API não tem
 * sessão, então não há `auth.uid()` para a RLS avaliar. O isolamento entre
 * contas passa a ser responsabilidade de quem escreve a rota, que precisa
 * filtrar por `contaId` em toda consulta. É a mesma regra da tela da 4YU, e
 * está anotada no `ESTADO.md`.
 */
export async function contaDaChave(cabecalho: string | null): Promise<ContaDaChave | null> {
  const segredo = segredoDoCabecalho(cabecalho)
  if (!segredo) return null

  const db = clienteAdmin()
  const { data } = await db
    .from('chave_api')
    .select('id, conta_id, revogada_em, conta:conta_id(ativo)')
    .eq('hash', hashDe(segredo))
    .maybeSingle()

  if (estadoDaChave(data ? { revogadaEm: data.revogada_em } : null) !== 'valida') {
    return null
  }
  // conta suspensa é conta sem API: senão o bot continua marcando aula numa
  // conta que a 4YU desligou, e o cliente descobre pelo WhatsApp
  if (data!.conta?.ativo === false) return null

  /*
   * O carimbo de uso é gravado sem esperar, de propósito.
   *
   * Ele serve para o dono responder "posso revogar esta?", e nada mais depende
   * dele. Fazer a chamada de API esperar uma escrita para responder seria pagar
   * latência em toda requisição por um dado que ninguém lê em tempo real.
   */
  void db.from('chave_api')
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq('id', data!.id)
    .then(() => {}, () => {})

  return { contaId: data!.conta_id, chaveId: data!.id }
}

export type ChaveLinha = {
  id: string
  nome: string
  prefixo: string
  ultimoUsoEm: string | null
  revogadaEm: string | null
  criadoEm: string
}

/** As chaves da conta, viva e revogada, a viva primeiro. */
export async function listarChaves(db: Db, contaId: string): Promise<ChaveLinha[]> {
  const { data, error } = await db
    .from('chave_api')
    .select('id, nome, prefixo, ultimo_uso_em, revogada_em, criado_em')
    .eq('conta_id', contaId)
    .order('revogada_em', { ascending: true, nullsFirst: true })
    .order('criado_em', { ascending: false })
  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    prefixo: c.prefixo,
    ultimoUsoEm: c.ultimo_uso_em,
    revogadaEm: c.revogada_em,
    criadoEm: c.criado_em,
  }))
}
