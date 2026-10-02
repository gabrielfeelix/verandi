import { clienteAdmin, type Db } from '../supabase'
import type { Papel } from '@/core/acesso/destino'

/**
 * As leituras da área de administração da 4YU.
 *
 * Toda função daqui usa a chave de serviço e atravessa o isolamento entre
 * clientes. Quem chama confere `ehSuporte` antes: o layout de `/admin` faz isso
 * para as telas, e cada ação faz de novo para si, porque ação de servidor é
 * endereço público e não passa pelo layout.
 */

/** O que o Auth sabe de cada pessoa e a tela precisa mostrar. */
export type PessoaDoAuth = {
  id: string
  email: string
  criadoEm: string
  ultimoAcesso: string | null
  /** banida pelo Auth: não entra nem renova a sessão */
  suspensa: boolean
}

/**
 * Todo mundo do Auth, num mapa por id.
 *
 * O Auth é do projeto inteiro, mas só a Verandi entra por ele: o AutoFluxos tem
 * login próprio (Better Auth, tabelas `af_*`). Em 02/out/2026 os quatro
 * usuários do Auth tinham vínculo com conta da Verandi. Se um dia o AutoFluxos
 * passar a usar o Auth do Supabase, esta lista passa a mostrar gente dele, e as
 * telas filtram por vínculo para não oferecer ação sobre quem não é daqui.
 *
 * `listUsers` pagina de no máximo 1000; parar na primeira página faria a tela
 * mentir sobre quem existe quando a base passar disso.
 */
export async function pessoasDoAuth(db: Db = clienteAdmin()): Promise<Map<string, PessoaDoAuth>> {
  const mapa = new Map<string, PessoaDoAuth>()
  const agora = Date.now()
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      const banidaAte = (u as { banned_until?: string | null }).banned_until
      mapa.set(u.id, {
        id: u.id,
        email: u.email ?? '(sem e-mail)',
        criadoEm: u.created_at,
        ultimoAcesso: u.last_sign_in_at ?? null,
        suspensa: !!banidaAte && new Date(banidaAte).getTime() > agora,
      })
    }
    if (data.users.length < 1000) break
  }
  return mapa
}

/**
 * Todas as linhas de uma consulta, de mil em mil.
 *
 * O PostgREST corta toda resposta em 1000 linhas sem avisar. Uma tela de
 * administração que lê "todos os vínculos" de uma vez mostraria um retrato
 * parcial com cara de completo, e a pessoa que não aparece na busca é
 * justamente a que alguém está procurando.
 */
async function todas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const linhas: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await pagina(de, de + 999)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) return linhas
  }
}

/** A conta da própria 4YU, onde mora o vínculo que faz alguém ser admin. */
export async function contaInterna(db: Db = clienteAdmin()): Promise<{ id: string; nome: string }> {
  const { data, error } = await db.from('conta')
    .select('id, nome').eq('interna', true).single()
  if (error) throw error
  return data
}

export type VinculoDoUsuario = {
  contaId: string
  contaNome: string
  papel: Papel
  ativo: boolean
}

export type UsuarioDaPlataforma = PessoaDoAuth & {
  nome: string | null
  admin: boolean
  /** vínculos com conta de cliente; o temporário do suporte fica de fora */
  contas: VinculoDoUsuario[]
}

/**
 * Todo usuário da Verandi, com as contas e o papel em cada uma.
 *
 * O vínculo de suporte em conta de cliente não aparece: ele é o rastro de um
 * "Entrar" e some no "Sair do suporte". Listá-lo faria o admin parecer
 * funcionário de todos os clientes que já atendeu.
 */
export async function listarUsuarios(): Promise<UsuarioDaPlataforma[]> {
  const db = clienteAdmin()
  const [auth, vinculos] = await Promise.all([
    pessoasDoAuth(db),
    todas((de, ate) => db.from('usuario_conta')
      .select('usuario_id, conta_id, papel, ativo, nome, conta:conta_id(nome, interna)')
      .order('usuario_id').order('conta_id')
      .range(de, ate)),
  ])

  const porUsuario = new Map<string, UsuarioDaPlataforma>()
  for (const v of vinculos) {
    const pessoa = auth.get(v.usuario_id)
    if (!pessoa) continue
    const u = porUsuario.get(v.usuario_id)
      ?? { ...pessoa, nome: null, admin: false, contas: [] }
    if (!u.nome && v.nome) u.nome = v.nome
    if (v.conta.interna) {
      if (v.papel === 'suporte' && v.ativo) u.admin = true
    } else if (v.papel !== 'suporte') {
      u.contas.push({
        contaId: v.conta_id, contaNome: v.conta.nome, papel: v.papel as Papel, ativo: v.ativo,
      })
    }
    porUsuario.set(v.usuario_id, u)
  }

  // admin primeiro, depois por e-mail: quem opera a plataforma é quem se procura
  // com mais frequência aqui
  return [...porUsuario.values()].sort((a, b) =>
    Number(b.admin) - Number(a.admin) || a.email.localeCompare(b.email))
}

export type ContaDetalhe = {
  id: string
  nome: string
  slug: string
  fuso: string
  ativa: boolean
  criadaEm: string
  razaoSocial: string | null
  documento: string | null
  pessoas: Array<{
    usuarioId: string
    email: string
    nome: string | null
    papel: Papel
    ativo: boolean
    ultimoAcesso: string | null
    suspensa: boolean
  }>
  convites: Array<{ id: string; email: string; papel: string; expiraEm: string }>
}

/** Uma conta de cliente por inteiro, para `/admin/contas/[id]`. */
export async function detalheDaConta(contaId: string): Promise<ContaDetalhe | null> {
  const db = clienteAdmin()
  const { data: c } = await db.from('conta')
    .select('id, nome, slug, fuso, ativo, criado_em, razao_social, documento, interna')
    .eq('id', contaId).maybeSingle()
  // a conta interna não é cliente: a tela dela é Usuários, não esta
  if (!c || c.interna) return null

  const [auth, { data: vinculos }, { data: convites }] = await Promise.all([
    pessoasDoAuth(db),
    db.from('usuario_conta')
      .select('usuario_id, papel, ativo, nome')
      .eq('conta_id', contaId)
      .neq('papel', 'suporte'),
    db.from('convite')
      .select('id, email, papel, expira_em')
      .eq('conta_id', contaId)
      .eq('tipo', 'acesso')
      .is('aceito_em', null)
      .is('revogado_em', null)
      .gt('expira_em', new Date().toISOString()),
  ])

  return {
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    fuso: c.fuso,
    ativa: c.ativo,
    criadaEm: c.criado_em,
    razaoSocial: c.razao_social,
    documento: c.documento,
    pessoas: (vinculos ?? []).map((v) => {
      const p = auth.get(v.usuario_id)
      return {
        usuarioId: v.usuario_id,
        email: p?.email ?? '(fora do Auth)',
        nome: v.nome,
        papel: v.papel as Papel,
        ativo: v.ativo,
        ultimoAcesso: p?.ultimoAcesso ?? null,
        suspensa: p?.suspensa ?? false,
      }
    }).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.email.localeCompare(b.email)),
    convites: (convites ?? []).map((x) => ({
      id: x.id, email: x.email, papel: x.papel, expiraEm: x.expira_em,
    })),
  }
}

/** Uma linha do log da 4YU, venha de onde vier. */
export type EventoDoLog = {
  id: string
  em: string
  quem: string
  /** a conta onde aconteceu; `null` quando o alvo é a plataforma */
  conta: string | null
  contaId: string | null
  /** frase pronta para a tela, no passado */
  oQue: string
  /** acesso em conta de cliente que ainda não foi encerrado */
  emAberto?: boolean
}

const VERBO: Record<string, string> = {
  criou: 'criou', editou: 'editou', desativou: 'suspendeu', reativou: 'reativou',
  removeu: 'removeu', encerrou: 'encerrou', duplicou: 'duplicou', anonimizou: 'anonimizou',
}

/**
 * Frase de uma linha de `log_configuracao` feita pela 4YU.
 *
 * As ações sobre usuário guardam o que aconteceu em `detalhe.oQue`, porque o
 * verbo da coluna `acao` é da lista fechada da tabela e não diz, sozinho, se o
 * que mudou foi a senha ou o acesso de admin.
 */
function fraseDoLog(
  entidade: string, acao: string, detalhe: Record<string, unknown>,
): string {
  if (typeof detalhe.oQue === 'string') return detalhe.oQue
  const verbo = VERBO[acao] ?? acao
  if (entidade === 'conta') return `${verbo} a conta`
  return `${verbo} ${entidade.replace('_', ' ')}`
}

/**
 * O log da 4YU: entradas em conta de cliente e tudo que a área de admin faz.
 *
 * São duas tabelas porque nasceram em momentos diferentes: `acesso_suporte`
 * guarda início e fim de cada visita, e `log_configuracao` guarda as ações,
 * marcadas com `detalhe.porSuporte`. A tela lê as duas como uma só lista, em
 * ordem de tempo, com o e-mail de quem fez, que é o que o log antigo não dizia.
 */
export async function listarLog(opcoes: { contaId?: string; limite?: number } = {}): Promise<EventoDoLog[]> {
  const db = clienteAdmin()
  const limite = opcoes.limite ?? 60

  let qAcessos = db.from('acesso_suporte')
    .select('id, conta_id, usuario_id, iniciado_em, encerrado_em, conta:conta_id(nome)')
    .order('iniciado_em', { ascending: false })
    .limit(limite)
  let qAcoes = db.from('log_configuracao')
    .select('id, conta_id, entidade, acao, detalhe, por_usuario_id, em, conta:conta_id(nome, interna)')
    .eq('detalhe->>porSuporte', 'true')
    .order('em', { ascending: false })
    .limit(limite)
  if (opcoes.contaId) {
    qAcessos = qAcessos.eq('conta_id', opcoes.contaId)
    qAcoes = qAcoes.eq('conta_id', opcoes.contaId)
  }

  const [auth, { data: acessos, error: e1 }, { data: acoes, error: e2 }] = await Promise.all([
    pessoasDoAuth(db), qAcessos, qAcoes,
  ])
  if (e1) throw e1
  if (e2) throw e2

  const quem = (id: string | null) => (id ? auth.get(id)?.email : null) ?? 'alguém removido'

  const eventos: EventoDoLog[] = []
  for (const a of acessos ?? []) {
    eventos.push({
      id: `a-${a.id}`,
      em: a.iniciado_em,
      quem: quem(a.usuario_id),
      conta: a.conta?.nome ?? null,
      contaId: a.conta_id,
      oQue: a.encerrado_em
        ? `entrou como suporte e saiu às ${new Date(a.encerrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`
        : 'entrou como suporte',
      emAberto: !a.encerrado_em,
    })
  }
  for (const l of acoes ?? []) {
    const detalhe = (l.detalhe ?? {}) as Record<string, unknown>
    eventos.push({
      id: `l-${l.id}`,
      em: l.em,
      quem: quem(l.por_usuario_id),
      // ação sobre usuário mora na conta interna só para ter dono; para quem
      // lê, ela é da plataforma, não de uma conta
      conta: l.conta?.interna ? null : l.conta?.nome ?? null,
      contaId: l.conta?.interna ? null : l.conta_id,
      oQue: fraseDoLog(l.entidade, l.acao, detalhe),
    })
  }

  return eventos.sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite)
}

export type Resumo = {
  contasAtivas: number
  contasSuspensas: number
  usuarios: number
  admins: number
  acessosEmAberto: number
  /** contas ativas sem ninguém entrando há sete dias ou mais */
  contasParadas: Array<{ id: string; nome: string; ultimoAcesso: string | null }>
}

/** Os números da visão geral. */
export async function resumoDaPlataforma(): Promise<Resumo> {
  const db = clienteAdmin()
  const [auth, contas, vinculos, { count: abertos }] = await Promise.all([
    pessoasDoAuth(db),
    todas((de, ate) => db.from('conta').select('id, nome, ativo')
      .eq('interna', false).order('id').range(de, ate)),
    todas((de, ate) => db.from('usuario_conta')
      .select('usuario_id, conta_id, papel, ativo, conta:conta_id(interna)')
      .eq('ativo', true)
      .order('usuario_id').order('conta_id')
      .range(de, ate)),
    db.from('acesso_suporte').select('id', { count: 'exact', head: true })
      .is('encerrado_em', null),
  ])

  const usuarios = new Set(vinculos.map((v) => v.usuario_id))
  const admins = new Set(vinculos
    .filter((v) => v.conta.interna && v.papel === 'suporte').map((v) => v.usuario_id))

  // o último acesso de uma conta é o mais recente entre quem trabalha nela;
  // o suporte não conta, senão atender o cliente faria a conta parecer viva
  const ultimo = new Map<string, string>()
  for (const v of vinculos) {
    if (v.papel === 'suporte') continue
    const quando = auth.get(v.usuario_id)?.ultimoAcesso
    if (!quando) continue
    const atual = ultimo.get(v.conta_id)
    if (!atual || quando > atual) ultimo.set(v.conta_id, quando)
  }

  const corte = new Date(Date.now() - 7 * 864e5).toISOString()
  const ativas = contas.filter((c) => c.ativo)

  return {
    contasAtivas: ativas.length,
    contasSuspensas: contas.length - ativas.length,
    usuarios: usuarios.size,
    admins: admins.size,
    acessosEmAberto: abertos ?? 0,
    contasParadas: ativas
      .map((c) => ({ id: c.id, nome: c.nome, ultimoAcesso: ultimo.get(c.id) ?? null }))
      .filter((c) => !c.ultimoAcesso || c.ultimoAcesso < corte),
  }
}
