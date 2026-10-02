'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Abas } from '@/components/ui/abas'
import { Avatar, Campo, Etiqueta, Nota, Paginacao, cartao, entrada } from '@/components/ui/pecas'
import { Botao } from '@/components/ui/botao'
import { Menu, type ItemMenu } from '@/components/ui/menu'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { useAviso } from '@/components/ui/desfazer'
import { NOME_PAPEL } from '@/core/acesso/papeis'
import { erroLegivel } from '@/core/erro-legivel'
import { CabecalhoAdmin } from './pecas'
import { definirAdmin, linkDeSenha, novoAdmin, suspenderUsuario } from '@/server/admin/acoes'
import type { UsuarioDaPlataforma } from '@/server/admin/consultas'

type Filtro = 'todos' | 'admin' | 'suspensos'

/** O que pede confirmação antes de ir: tirar acesso nunca acontece num clique só. */
type Confirmacao = {
  titulo: string
  sub: string
  primario: string
  perigo: boolean
  fazer: () => Promise<void>
  aviso: string
}

/**
 * A lista de usuários da plataforma.
 *
 * Tabela, e não cartão, pelo mesmo motivo da lista de contas: o que se procura
 * aqui é comparar de cima a baixo (quem é admin, quem não entra há meses), e
 * cartão empilhado não deixa comparar nada.
 *
 * O que muda acesso de alguém pede confirmação; gerar link de senha não,
 * porque não tira nada de ninguém e o link anterior só deixa de valer.
 */
export function TabelaDeUsuarios({
  usuarios, total, contagem, eu, busca, filtro, pagina, porPagina,
}: {
  usuarios: UsuarioDaPlataforma[]
  total: number
  contagem: Record<Filtro, number>
  /** o id de quem está olhando: ninguém suspende a si mesmo */
  eu: string
  busca: string
  filtro: Filtro
  pagina: number
  porPagina: number
}) {
  const href = (mudar: { f?: Filtro; p?: number }) => {
    const b = new URLSearchParams()
    if (busca) b.set('q', busca)
    const f = mudar.f ?? filtro
    if (f !== 'todos') b.set('f', f)
    const p = mudar.p ?? 1
    if (p > 1) b.set('p', String(p))
    const s = b.toString()
    return s ? `/admin/usuarios?${s}` : '/admin/usuarios'
  }

  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [confirmar, setConfirmar] = useState<Confirmacao | null>(null)
  const [link, setLink] = useState<{ email: string; url: string; enviado: boolean } | null>(null)
  const router = useRouter()
  const avisar = useAviso()

  function rodar(fn: () => Promise<void>, texto?: string) {
    iniciar(async () => {
      setErro(null)
      try {
        await fn()
        if (texto) avisar({ texto })
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  function itensDe(u: UsuarioDaPlataforma): ItemMenu[] {
    const itens: ItemMenu[] = [{
      rotulo: 'Gerar link de senha',
      icone: 'chave',
      aoEscolher: () => rodar(async () => {
        const r = await linkDeSenha(u.id)
        setLink({ email: u.email, url: r.link, enviado: r.enviado })
      }),
    }]
    if (u.id === eu) return itens

    itens.push(u.admin ? {
      rotulo: 'Tirar acesso de admin',
      icone: 'cadeado',
      aoEscolher: () => setConfirmar({
        titulo: `Tirar o acesso de admin de ${u.email}?`,
        sub: 'A pessoa deixa de ver a administração. As contas em que ela trabalha continuam como estão.',
        primario: 'Tirar acesso de admin',
        perigo: true,
        fazer: () => definirAdmin(u.id, false),
        aviso: 'Acesso de admin retirado',
      }),
    } : {
      rotulo: 'Dar acesso de admin',
      icone: 'cadeado',
      aoEscolher: () => setConfirmar({
        titulo: `Dar acesso de admin a ${u.email}?`,
        sub: 'Admin vê todas as contas, entra em qualquer uma como suporte e muda o acesso de qualquer pessoa. É acesso da equipe da 4YU.',
        primario: 'Dar acesso de admin',
        perigo: false,
        fazer: () => definirAdmin(u.id, true),
        aviso: 'Agora é admin',
      }),
    })

    itens.push(u.suspensa ? {
      rotulo: 'Devolver acesso',
      aoEscolher: () => rodar(() => suspenderUsuario(u.id, false), 'Acesso devolvido'),
    } : {
      rotulo: 'Suspender acesso',
      perigo: true,
      aoEscolher: () => setConfirmar({
        titulo: `Suspender ${u.email}?`,
        sub: 'A pessoa não entra mais em nenhuma conta. Quem estiver com a Verandi aberta sai em até uma hora. Os vínculos ficam guardados, e devolver o acesso devolve tudo.',
        primario: 'Suspender acesso',
        perigo: true,
        fazer: () => suspenderUsuario(u.id, true),
        aviso: 'Acesso suspenso',
      }),
    })
    return itens
  }

  const COLUNAS = 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_auto]'

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoAdmin
        titulo="Usuários"
        sub={<>{contagem.todos} {contagem.todos === 1 ? 'pessoa' : 'pessoas'} com acesso · {contagem.admin} {contagem.admin === 1 ? 'admin' : 'admins'}</>}
      >
        <form className="relative flex items-center" action="/admin/usuarios">
          <span aria-hidden className="pointer-events-none absolute left-3.5 font-mono text-[14px] text-tinta-fraca">⌕</span>
          {filtro !== 'todos' ? <input type="hidden" name="f" value={filtro} /> : null}
          <input
            name="q" defaultValue={busca} aria-label="Buscar usuário"
            placeholder="E-mail, nome ou conta"
            className="min-h-11 min-w-[228px] rounded-padrao border border-linha bg-superficie pr-3.5 pl-9 text-[14px] placeholder:text-tinta-fraca"
          />
          <button type="submit" className="sr-only focus:not-sr-only focus:ml-2">Buscar</button>
        </form>
        <Botao onClick={() => { setErro(null); setCriando(true) }}>Novo admin</Botao>
      </CabecalhoAdmin>

      <Abas
        rotuloDoGrupo="Filtrar usuários"
        ativo={filtro}
        itens={[
          { id: 'todos', rotulo: 'Todos', contagem: contagem.todos, href: href({ f: 'todos' }) },
          { id: 'admin', rotulo: 'Admins', contagem: contagem.admin, href: href({ f: 'admin' }) },
          { id: 'suspensos', rotulo: 'Suspensos', contagem: contagem.suspensos, href: href({ f: 'suspensos' }) },
        ]}
        className="self-start"
      />

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <section className={`overflow-hidden ${cartao}`}>
        <div className={`hidden gap-3.5 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3 md:grid ${COLUNAS}`}>
          {['Pessoa', 'Contas', 'Último acesso', ''].map((c, i) => (
            <span key={c || i} className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
              {c}
            </span>
          ))}
        </div>

        {usuarios.length === 0 ? (
          <p className="px-4.5 py-6 text-[14px] text-tinta-media">
            {busca ? `Ninguém com "${busca}".` : 'Ninguém aqui.'}
          </p>
        ) : null}

        <ul>
          {usuarios.map((u) => (
            <li
              key={u.id}
              className={`flex flex-wrap items-center gap-3.5 border-b border-linha-fina px-4.5 py-3 last:border-b-0 hover:bg-superficie-tenue md:grid ${COLUNAS}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar nome={u.nome ?? u.email} tamanho={32} decorativo />
                <span className="flex min-w-0 flex-col leading-[1.35]">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                    <span className="truncate">{u.nome ?? u.email}</span>
                    {u.admin ? <Etiqueta tinta="atencao">Admin</Etiqueta> : null}
                    {u.suspensa ? <Etiqueta tinta="alerta">Suspenso</Etiqueta> : null}
                    {u.id === eu ? <Etiqueta tinta="neutro">Você</Etiqueta> : null}
                  </span>
                  {u.nome ? <span className="truncate text-[12.5px] text-tinta-media">{u.email}</span> : null}
                </span>
              </span>

              <span className="flex min-w-0 flex-wrap gap-1.5">
                {u.contas.length === 0 ? (
                  <span className="text-[13px] text-tinta-fraca">{u.admin ? 'só administração' : 'nenhuma'}</span>
                ) : u.contas.map((c) => (
                  <Link
                    key={c.contaId}
                    href={`/admin/contas/${c.contaId}`}
                    className={`inline-flex items-center gap-1 rounded-peca border border-linha-fina px-2 py-[3px] text-[12.5px] hover:border-tinta-fraca ${c.ativo ? '' : 'text-tinta-fraca line-through'}`}
                    title={c.ativo ? undefined : 'vínculo desligado'}
                  >
                    {c.contaNome}
                    <span className="text-tinta-media">· {NOME_PAPEL[c.papel] ?? c.papel}</span>
                  </Link>
                ))}
              </span>

              <span className={`text-[13px] ${u.ultimoAcesso ? 'text-tinta-media' : 'font-medium text-alerta'}`}>
                {u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString('pt-BR') : 'nunca'}
              </span>

              <span className="justify-self-end">
                <Menu titulo={`Ações de ${u.email}`} itens={itensDe(u)} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={porPagina}
        hrefDe={(p) => href({ p })}
        nota="suspenso continua na lista"
      />

      <ModalFormulario
        aberto={criando}
        icone="cadeado"
        tom="atencao"
        titulo="Novo admin"
        sub="Para alguém da equipe da 4YU. Quem já tem login na Verandi só ganha o acesso, e a senha dele não muda."
        primario="Dar acesso de admin"
        pendente={pendente}
        aoFechar={() => setCriando(false)}
        aoEnviar={(f) => rodar(async () => {
          const r = await novoAdmin({
            email: String(f.get('email') ?? ''),
            senha: String(f.get('senha') ?? ''),
          })
          setCriando(false)
          avisar({ texto: r.criado ? 'Admin cadastrado' : 'Agora é admin' })
        })}
      >
        <div className="flex flex-col gap-3">
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
          <Campo rotulo="E-mail" htmlFor="na-email" obrigatorio>
            <input id="na-email" name="email" type="email" required className={entrada} autoFocus
              placeholder="Exemplo: nome@4yu.com.br" />
          </Campo>
          <Campo rotulo="Senha inicial" htmlFor="na-senha"
            dica="Só para quem ainda não tem login. Pelo menos 8 caracteres; a pessoa troca depois.">
            <input id="na-senha" name="senha" type="text" minLength={8} autoComplete="off" className={entrada} />
          </Campo>
        </div>
      </ModalFormulario>

      <Modal
        aberto={!!confirmar}
        icone="aviso"
        tom={confirmar?.perigo ? 'alerta' : 'atencao'}
        titulo={confirmar?.titulo ?? ''}
        sub={confirmar?.sub}
        primario={confirmar?.primario}
        perigo={confirmar?.perigo}
        pendente={pendente}
        largura="confirmacao"
        aoFechar={() => setConfirmar(null)}
        aoConfirmar={() => {
          const c = confirmar
          if (!c) return
          setConfirmar(null)
          rodar(c.fazer, c.aviso)
        }}
      />

      <Modal
        aberto={!!link}
        icone="chave"
        tom="positivo"
        titulo="Link de senha pronto"
        sub={link?.enviado
          ? `Enviado para ${link.email}. Se não chegar, mande este link pelo WhatsApp. Vale por 24 horas.`
          : `O e-mail não saiu. Mande este link para ${link?.email ?? ''} pelo WhatsApp. Vale por 24 horas.`}
        secundario="Fechar"
        aoFechar={() => setLink(null)}
      >
        {link ? (
          <div className="flex flex-col gap-2">
            <input readOnly value={link.url} aria-label="Link de senha"
              className={`${entrada} font-mono text-[13px]`}
              onFocus={(e) => e.currentTarget.select()} />
            <Botao tom="secundario" miudo className="self-start"
              onClick={() => {
                navigator.clipboard?.writeText(link.url)
                avisar({ texto: 'Link copiado' })
              }}>
              Copiar link
            </Botao>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
