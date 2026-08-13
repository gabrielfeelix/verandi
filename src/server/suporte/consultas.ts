import { clienteAdmin, type Db } from '../supabase'

export type ContaSinais = {
  id: string
  nome: string
  slug: string
  criadaEm: string
  ativa: boolean
  /** sessões dos últimos sete dias */
  sessoesSemana: number
  /** quantas delas tiveram a chamada registrada, em porcentagem */
  chamadasFeitasPct: number | null
  ultimoAcesso: string | null
}

/**
 * Confere que quem pergunta é da 4YU.
 *
 * A tela de contas é a única que atravessa o isolamento entre clientes, então a
 * checagem é explícita e vem antes de qualquer leitura — não depende de a
 * consulta seguinte "por acaso" filtrar certo.
 */
export async function ehSuporte(db: Db): Promise<boolean> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return false

  const { data } = await db.from('usuario_conta')
    .select('conta_id')
    .eq('usuario_id', user.id)
    .eq('papel', 'suporte')
    .eq('ativo', true)
    .limit(1)
  return (data ?? []).length > 0
}

/**
 * Todas as contas, com sinais de vida.
 *
 * "Chamada feita" é o sinal que importa: chamada que parou de ser registrada é
 * o primeiro sintoma de abandono, e aparece semanas antes de o cliente
 * reclamar.
 */
export async function listarContas(): Promise<ContaSinais[]> {
  const db = clienteAdmin()
  const semanaAtras = new Date(Date.now() - 7 * 864e5).toISOString()
  const agora = new Date().toISOString()

  const { data: contas, error } = await db
    .from('conta')
    .select('id, nome, slug, criado_em, ativo')
    .order('criado_em', { ascending: false })
    .returns<{
      id: string; nome: string; slug: string; criado_em: string; ativo: boolean
    }[]>()
  if (error) throw error

  const { data: sessoes } = await db
    .from('sessao')
    .select('conta_id, status, participacao(status)')
    .gte('inicio', semanaAtras)
    .lte('inicio', agora)
    .returns<{
      conta_id: string
      status: string
      participacao: { status: string }[]
    }[]>()

  const { data: acessos } = await db
    .from('usuario_conta')
    .select('conta_id, usuario_id')
    .eq('ativo', true)
    .returns<{ conta_id: string; usuario_id: string }[]>()

  const ultimo = new Map<string, string>()
  if (acessos?.length) {
    const porUsuario = await ultimoAcessoPorUsuario(db)
    for (const a of acessos) {
      const quando = porUsuario.get(a.usuario_id)
      if (!quando) continue
      const atual = ultimo.get(a.conta_id)
      if (!atual || quando > atual) ultimo.set(a.conta_id, quando)
    }
  }

  return (contas ?? []).map((c) => {
    const dela = (sessoes ?? []).filter((s) => s.conta_id === c.id)
    const comGente = dela.filter((s) => s.participacao.length > 0)
    const feitas = comGente.filter(
      (s) => !s.participacao.some((p) => p.status === 'esperada' || p.status === 'confirmada'),
    )
    return {
      id: c.id,
      nome: c.nome,
      slug: c.slug,
      criadaEm: c.criado_em,
      ativa: c.ativo,
      sessoesSemana: dela.length,
      chamadasFeitasPct: comGente.length
        ? Math.round((feitas.length / comGente.length) * 100)
        : null,
      ultimoAcesso: ultimo.get(c.id) ?? null,
    }
  })
}

/**
 * O último acesso de cada usuário, percorrendo todas as páginas.
 *
 * `listUsers` tem página de no máximo 1000, e parar na primeira faria a tela
 * dizer "nunca acessaram" para uma conta que acessa todo dia — um número
 * errado com cara de número certo, que é o pior tipo de erro num painel de
 * diagnóstico.
 */
async function ultimoAcessoPorUsuario(
  db: ReturnType<typeof clienteAdmin>,
): Promise<Map<string, string | null>> {
  const porUsuario = new Map<string, string | null>()
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) porUsuario.set(u.id, u.last_sign_in_at ?? null)
    if (data.users.length < 1000) break
  }
  return porUsuario
}

export type AcessoSuporte = {
  id: string
  contaNome: string
  usuarioId: string
  iniciadoEm: string
  encerradoEm: string | null
}

/** O log de quem da 4YU entrou onde, e quando saiu. */
export async function listarAcessosDeSuporte(limite = 30): Promise<AcessoSuporte[]> {
  const db = clienteAdmin()
  const { data, error } = await db
    .from('acesso_suporte')
    .select('id, usuario_id, iniciado_em, encerrado_em, conta:conta_id(nome)')
    .order('iniciado_em', { ascending: false })
    .limit(limite)
    .returns<{
      id: string; usuario_id: string; iniciado_em: string
      encerrado_em: string | null; conta: { nome: string } | null
    }[]>()
  if (error) throw error

  return (data ?? []).map((a) => ({
    id: a.id,
    contaNome: a.conta?.nome ?? '—',
    usuarioId: a.usuario_id,
    iniciadoEm: a.iniciado_em,
    encerradoEm: a.encerrado_em,
  }))
}
