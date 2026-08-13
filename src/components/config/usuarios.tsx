'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Avatar, Campo, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { BotaoLinha, FaixaFormulario, LinhaConfig, PainelConfig } from './casca'
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
    <div className="flex flex-col gap-3.5">
      <PainelConfig
        titulo="Usuários"
        sub="Remover usuário nunca apaga o que ele registrou"
        acao={<Botao miudo onClick={() => setConvidando(true)}>Convidar</Botao>}
      >
        <div className="flex flex-col">
          {convidando ? (
            <FaixaFormulario>
            <form
              className="flex flex-col gap-3"
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
            </FaixaFormulario>
          ) : null}

          {/* Aparece uma vez: depois só dá para revogar e criar outro */}
          {link ? (
            <div className="m-4 flex flex-col gap-2 rounded-[--radius-padrao] border border-linha p-3">
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

          {erro ? <div className="px-5 pb-3"><Nota tom="alerta">{erro}</Nota></div> : null}

          {usuarios.filter((u) => u.ativo).map((u) => (
            <LinhaConfig
              key={u.usuarioId}
              antes={<Avatar nome={u.email} tamanho={40} decorativo />}
              nome={u.email.split('@')[0]}
              detalhe={
                <span className="flex flex-col">
                  <span>{u.email}</span>
                  <span className="text-[11.5px] text-tinta-media">
                    {u.ultimoAcesso
                      ? `último acesso ${new Date(u.ultimoAcesso).toLocaleDateString('pt-BR')}`
                      : 'nunca acessou'}
                  </span>
                </span>
              }
            >
                <Etiqueta tinta={TINTA_PAPEL[u.papel] ?? 'neutro'}>
                  {NOME_PAPEL[u.papel] ?? u.papel}
                </Etiqueta>

                {u.usuarioId === meuId ? (
                  <Etiqueta tinta="neutro">você</Etiqueta>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
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
                    <BotaoLinha
                      disabled={pendente}
                      onClick={() => comErro(async () => {
                        const r = await gerarLinkDeSenha(u.usuarioId)
                        setLink({ url: urlDe(r.token), para: u.email })
                      })}
                    >
                      Redefinir senha
                    </BotaoLinha>
                    <BotaoLinha
                      disabled={pendente}
                      onClick={() => comErro(
                        () => removerUsuario(u.usuarioId),
                        'Acesso removido',
                      )}
                    >
                      Remover acesso
                    </BotaoLinha>
                  </span>
                )}
            </LinhaConfig>
          ))}

          <p className="px-5 py-3.5 text-[12px] text-tinta-media">
            Remover não apaga nada do que a pessoa registrou: a presença marcada
            por ela continua marcada por ela. Se for profissional, o nome segue
            na grade — o que acaba é o acesso.
          </p>
        </div>
      </PainelConfig>

      {convites.length > 0 ? (
        <PainelConfig
          titulo="Convites em aberto"
          sub="O link aparece uma vez; perdeu, revoga e cria outro"
        >
          {convites.map((c) => (
            <LinhaConfig
              key={c.id}
              nome={c.email}
              detalhe={
                c.expirado
                  ? 'expirado'
                  : `expira ${new Date(c.expiraEm).toLocaleDateString('pt-BR')}`
              }
            >
              <Etiqueta tinta={c.tipo === 'senha' ? 'atencao' : 'info'}>
                {c.tipo === 'senha' ? 'redefinir senha' : NOME_PAPEL[c.papel]}
              </Etiqueta>
              <BotaoLinha
                disabled={pendente}
                onClick={() => comErro(() => revogarConvite(c.id), 'Convite cancelado')}
              >
                Cancelar convite
              </BotaoLinha>
            </LinhaConfig>
          ))}
        </PainelConfig>
      ) : null}
    </div>
  )
}
