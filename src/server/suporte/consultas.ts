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

  // o vínculo que vale é o da conta interna. Entrar como suporte cria vínculo
  // temporário em conta de cliente, e sair apaga esse vínculo — se ele também
  // respondesse por "é da 4YU", sair de uma conta tiraria o acesso à tela.
  const { data } = await db.from('usuario_conta')
    .select('conta_id, conta:conta_id!inner(interna)')
    .eq('usuario_id', user.id)
    .eq('papel', 'suporte')
    .eq('ativo', true)
    .eq('conta.interna', true)
    .limit(1)
  return (data ?? []).length > 0
}

/** Vinte por página, a mesma régua de `/pessoas` e do design system. */
export const CONTAS_POR_PAGINA = 20

/**
 * Uma página de contas, com sinais de vida.
 *
 * "Chamada feita" é o sinal que importa: chamada que parou de ser registrada é
 * o primeiro sintoma de abandono, e aparece semanas antes de o cliente
 * reclamar.
 *
 * **Pagina no banco, não na tela.** Antes vinham todas as contas de uma vez, e
 * as três consultas seguintes carregavam sessão e vínculo de todo mundo para
 * montar os sinais. Isso ia bem com dezenas de clientes e mal com centenas, e o
 * banco de desenvolvimento já mostrava o defeito: as contas que os testes
 * deixam para trás passaram de mil linhas na tela.
 *
 * As consultas de sinal ficaram amarradas à página: `in_` nos vinte ids, e não
 * "todas as sessões da semana do mundo". É o que faz a tela parar de crescer
 * junto com a base.
 */
export async function listarContas(opcoes: {
  /** nome ou identificador; vazio traz tudo */
  busca?: string
  /** 1-indexada; sem ela vem a página 1 */
  pagina?: number
} = {}): Promise<{ linhas: ContaSinais[]; total: number }> {
  const db = clienteAdmin()
  const semanaAtras = new Date(Date.now() - 7 * 864e5).toISOString()
  const agora = new Date().toISOString()
  const pagina = Math.max(1, opcoes.pagina ?? 1)
  const de = (pagina - 1) * CONTAS_POR_PAGINA

  let q = db
    .from('conta')
    .select('id, nome, slug, criado_em, ativo', { count: 'exact' })
    // a conta da própria 4YU não é cliente: listá-la seria oferecer "entrar
    // como suporte" na conta onde o suporte mora
    .eq('interna', false)

  /*
   * Busca por nome **ou** identificador: quem atende chamado tem na mão um dos
   * dois, e nunca sabe qual dos dois é. `%` e `,` viram vazio porque `or()`
   * recebe um filtro em texto, e vírgula ali separa condição.
   */
  const busca = (opcoes.busca ?? '').trim().replace(/[%,()]/g, '')
  if (busca) q = q.or(`nome.ilike.%${busca}%,slug.ilike.%${busca}%`)

  const { data: contas, count, error } = await q
    .order('criado_em', { ascending: false })
    .range(de, de + CONTAS_POR_PAGINA - 1)
    
  if (error) throw error

  const ids = (contas ?? []).map((c) => c.id)
  if (ids.length === 0) return { linhas: [], total: count ?? 0 }

  const { data: sessoes } = await db
    .from('sessao')
    .select('conta_id, status, participacao(status)')
    .in('conta_id', ids)
    .gte('inicio', semanaAtras)
    .lte('inicio', agora)
    

  const { data: acessos } = await db
    .from('usuario_conta')
    .select('conta_id, usuario_id')
    .in('conta_id', ids)
    .eq('ativo', true)
    

  const ultimo = new Map<string, string>()
  if (acessos?.length) {
    const porUsuario = await ultimoAcessoPorUsuario(
      db, new Set(acessos.map((a) => a.usuario_id)),
    )
    for (const a of acessos) {
      const quando = porUsuario.get(a.usuario_id)
      if (!quando) continue
      const atual = ultimo.get(a.conta_id)
      if (!atual || quando > atual) ultimo.set(a.conta_id, quando)
    }
  }

  const linhas = (contas ?? []).map((c) => {
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

  return { linhas, total: count ?? linhas.length }
}

/**
 * O último acesso dos usuários pedidos, percorrendo as páginas até achá-los.
 *
 * `listUsers` tem página de no máximo 1000, e parar na primeira faria a tela
 * dizer "nunca acessaram" para uma conta que acessa todo dia — um número
 * errado com cara de número certo, que é o pior tipo de erro num painel de
 * diagnóstico.
 *
 * `procurados` é a lista de quem tem vínculo com as contas **desta página**, e
 * o laço para assim que todos aparecem. Sem isso, paginar a tela não adiantaria
 * nada aqui: continuaria varrendo o `auth.users` inteiro a cada visita, que é a
 * parte mais cara da tela quando a base cresce.
 */
async function ultimoAcessoPorUsuario(
  db: ReturnType<typeof clienteAdmin>,
  procurados: Set<string>,
): Promise<Map<string, string | null>> {
  const porUsuario = new Map<string, string | null>()
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (procurados.has(u.id)) porUsuario.set(u.id, u.last_sign_in_at ?? null)
    }
    if (porUsuario.size >= procurados.size) break
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
    
  if (error) throw error

  return (data ?? []).map((a) => ({
    id: a.id,
    contaNome: a.conta?.nome ?? 'sem registro',
    usuarioId: a.usuario_id,
    iniciadoEm: a.iniciado_em,
    encerradoEm: a.encerrado_em,
  }))
}
