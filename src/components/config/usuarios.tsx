'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Avatar, Campo, Cartao, Chip, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import {
  convidar, revogarConvite, mudarPapel, removerUsuario, gerarLinkDeSenha,
} from '@/server/usuarios/acoes'
import { PAPEIS_CONVIDAVEIS, NOME_PAPEL, type PapelConvidavel } from '@/core/acesso/papeis'
import type { ConvitePendente, UsuarioLinha } from '@/server/usuarios/consultas'

const TINTA_PAPEL: Record<string, 'positivo' | 'info' | 'atencao' | 'neutro'> = {
  dono: 'positivo',
  profissional: 'info',
  recepcao: 'atencao',
  suporte: 'neutro',
}

/**
 * Quem tem acesso, com que papel.
 *
 * O link do convite aparece **uma vez**, aqui, e é copiado para o WhatsApp.
 * Enquanto não houver envio por e-mail, esse é o caminho inteiro — e ele já é o
 * caminho real de quem opera um estúdio.
 */
export function SecaoUsuarios({
  usuarios, convites, meuId,
}: {
  usuarios: UsuarioLinha[]
  convites: ConvitePendente[]
  meuId: string
}) {
  const [convidando, setConvidando] = useState(false)
  const [link, setLink] = useState<{ url: string; para: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function comErro(fn: () => Promise<void>, texto?: string) {
    iniciar(async () => {
      setErro(null)
      try {
        await fn()
        if (texto) avisar({ texto })
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para concluir')
      }
    })
  }

  const urlDe = (token: string) =>
    `${typeof window === 'undefined' ? '' : window.location.origin}/convite/${token}`

  return (
    <div className="flex flex-col gap-4">
      <Cartao
        titulo="Usuários"
        acao={<Botao miudo onClick={() => setConvidando(true)}>Convidar</Botao>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-tinta-media">
            Quem entra no sistema. Profissional que só aparece na grade não
            precisa estar aqui.
          </p>

          {convidando ? (
            <form
              className="flex flex-col gap-3 rounded-[--radius-padrao] bg-superficie-suave p-3"
              action={(f) => comErro(async () => {
                const r = await convidar({
                  email: String(f.get('email') ?? ''),
                  papel: String(f.get('papel') ?? 'profissional') as PapelConvidavel,
                })
                setLink({ url: urlDe(r.token), para: String(f.get('email') ?? '') })
                setConvidando(false)
              })}
            >
              <div className="flex flex-wrap items-start gap-3">
                <Campo rotulo="E-mail" htmlFor="cv-email">
                  <input id="cv-email" name="email" type="email" required
                    className={entrada} autoFocus />
                </Campo>
                <Campo rotulo="Papel" htmlFor="cv-papel">
                  <select id="cv-papel" name="papel" className={entrada}
                    defaultValue="profissional">
                    {PAPEIS_CONVIDAVEIS.map((p) => (
                      <option key={p} value={p}>{NOME_PAPEL[p]}</option>
                    ))}
                  </select>
                </Campo>
              </div>
              <Nota tom="positivo">
                O convite vale por 7 dias. O link aparece uma vez, na tela — é
                você que manda para a pessoa.
              </Nota>
              <div className="flex gap-2">
                <Botao type="submit" miudo disabled={pendente}>Criar convite</Botao>
                <Botao type="button" tom="texto" miudo onClick={() => setConvidando(false)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          ) : null}

          {/* Aparece uma vez: depois só dá para revogar e criar outro */}
          {link ? (
            <div className="flex flex-col gap-2 rounded-[--radius-padrao] border border-linha p-3">
              <span className="text-[12.5px] font-medium">
                Link para {link.para} — copie agora
              </span>
              <input readOnly value={link.url} className={`${entrada} font-mono text-[12px]`}
                aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
              <div className="flex flex-wrap gap-2">
                <Botao
                  tom="secundario" miudo
                  onClick={() => {
                    navigator.clipboard?.writeText(link.url)
                    avisar({ texto: 'Link copiado' })
                  }}
                >
                  Copiar link
                </Botao>
                <Botao tom="texto" miudo onClick={() => setLink(null)}>Fechar</Botao>
              </div>
              <Nota tom="atencao">
                Este link não aparece de novo. Se perder, revogue o convite e
                crie outro.
              </Nota>
            </div>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}

          <ul className="flex flex-col gap-2">
            {usuarios.filter((u) => u.ativo).map((u) => (
              <li key={u.usuarioId}
                className="flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border border-linha-suave p-3">
                <Avatar nome={u.email} decorativo />
                <span className="text-[13px]">{u.email}</span>
                <Etiqueta tinta={TINTA_PAPEL[u.papel] ?? 'neutro'}>
                  {NOME_PAPEL[u.papel] ?? u.papel}
                </Etiqueta>
                <span className="text-[11.5px] text-tinta-media">
                  {u.ultimoAcesso
                    ? `último acesso ${new Date(u.ultimoAcesso).toLocaleDateString('pt-BR')}`
                    : 'nunca acessou'}
                </span>

                {u.usuarioId === meuId ? (
                  <Etiqueta tinta="neutro">você</Etiqueta>
                ) : (
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Papel de ${u.email}`}
                      defaultValue={u.papel}
                      className={`${entrada} min-h-9 py-0 text-[12.5px]`}
                      onChange={(e) => comErro(
                        () => mudarPapel(u.usuarioId, e.target.value as PapelConvidavel),
                        'Papel atualizado',
                      )}
                    >
                      {PAPEIS_CONVIDAVEIS.map((p) => (
                        <option key={p} value={p}>{NOME_PAPEL[p]}</option>
                      ))}
                    </select>
                    <Botao
                      tom="secundario" miudo disabled={pendente}
                      onClick={() => comErro(async () => {
                        const r = await gerarLinkDeSenha(u.usuarioId)
                        setLink({ url: urlDe(r.token), para: u.email })
                      })}
                    >
                      Redefinir senha
                    </Botao>
                    <Botao
                      tom="texto" miudo disabled={pendente}
                      onClick={() => comErro(
                        () => removerUsuario(u.usuarioId),
                        'Acesso removido',
                      )}
                    >
                      Remover acesso
                    </Botao>
                  </span>
                )}
              </li>
            ))}
          </ul>

          <Nota tom="neutro">
            Remover não apaga nada do que a pessoa registrou: a presença marcada
            por ela continua marcada por ela. Se for profissional, o nome segue
            na grade — o que acaba é o acesso.
          </Nota>
        </div>
      </Cartao>

      {convites.length > 0 ? (
        <Cartao titulo="Convites em aberto">
          <ul className="flex flex-col gap-2">
            {convites.map((c) => (
              <li key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border border-linha-suave p-3">
                <span className="text-[13px]">{c.email}</span>
                <Etiqueta tinta={c.tipo === 'senha' ? 'atencao' : 'info'}>
                  {c.tipo === 'senha' ? 'redefinir senha' : NOME_PAPEL[c.papel]}
                </Etiqueta>
                <span className="text-[11.5px] text-tinta-media">
                  {c.expirado
                    ? 'expirado'
                    : `expira ${new Date(c.expiraEm).toLocaleDateString('pt-BR')}`}
                </span>
                <Botao
                  tom="texto" miudo className="ml-auto" disabled={pendente}
                  onClick={() => comErro(() => revogarConvite(c.id), 'Convite cancelado')}
                >
                  Cancelar convite
                </Botao>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </div>
  )
}
