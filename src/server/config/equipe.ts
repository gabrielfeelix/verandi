import type { Db } from '../supabase'

export const BALDE_FOTO = 'foto-profissional'

export type ProfissionalLinha = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  cor: string | null
  ativo: boolean
  temLogin: boolean
  fotoPath: string | null
  /** URL assinada, de vida curta — o balde é privado de propósito */
  fotoUrl: string | null
  servicoIds: string[]
  emUso: number
}

type Linha = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  cor: string | null
  ativo: boolean
  usuario_id: string | null
  foto_path: string | null
  profissional_servico: { servico_id: string }[]
  serie: { id: string }[]
}

/**
 * A equipe, com foto quando houver.
 *
 * A URL da foto é assinada **em lote**: uma chamada para todas, em vez de uma
 * por profissional. Com seis pessoas a diferença é invisível; com sessenta é a
 * tela travando por um segundo.
 */
export async function listarEquipe(db: Db, contaId: string): Promise<ProfissionalLinha[]> {
  const { data, error } = await db
    .from('profissional')
    .select(`id, nome, email, telefone, cor, ativo, usuario_id, foto_path,
             profissional_servico(servico_id), serie(id)`)
    .eq('conta_id', contaId)
    .order('nome')
    .returns<Linha[]>()

  if (error) throw error
  const linhas = data ?? []

  const caminhos = linhas.map((l) => l.foto_path).filter((p): p is string => !!p)
  const assinadas = new Map<string, string>()
  if (caminhos.length) {
    const { data: urls } = await db.storage
      .from(BALDE_FOTO)
      .createSignedUrls(caminhos, 60 * 60)
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) assinadas.set(u.path, u.signedUrl)
    }
  }

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    cor: l.cor,
    ativo: l.ativo,
    temLogin: l.usuario_id !== null,
    fotoPath: l.foto_path,
    fotoUrl: l.foto_path ? (assinadas.get(l.foto_path) ?? null) : null,
    servicoIds: l.profissional_servico.map((s) => s.servico_id),
    emUso: l.serie.length,
  }))
}
