'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Avatar, Campo, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { ModalFormulario } from '@/components/ui/modal'
import { BotaoLinha, LinhaConfig, PainelConfig } from './casca'
import { Menu } from '@/components/ui/menu'
import { useAviso } from '@/components/ui/desfazer'
import {
  convidar, revogarConvite, mudarPapel, removerUsuario, gerarLinkDeSenha,
} from '@/server/usuarios/acoes'
import { recadoDaEntrega } from '@/core/email/entrega'
import { PAPEIS_CONVIDAVEIS, NOME_PAPEL, type PapelConvidavel } from '@/core/acesso/papeis'
import type { ConvitePendente, UsuarioLinha } from '@/server/usuarios/consultas'
import { erroLegivel } from '@/core/erro-legivel'

const TINTA_PAPEL: Record<string, 'positivo' | 'info' | 'atencao' | 'neutro'> = {
  dono: 'positivo',
  profissional: 'info',
  recepcao: 'atencao',
  suporte: 'neutro',
}

/**
 * Quem tem acesso, com que papel.
 *
 * O convite **sai por e-mail**, e o link aparece logo abaixo como plano B — não
 * como uma segunda opção a escolher. Quem confia no e-mail nem olha para o
 * link; quem trabalha no WhatsApp copia e segue. Duas ações lado a lado
 * pedindo uma escolha é que confundiria.
 *
 * O plano B não é luxo: domínio de envio novo cai em spam nas primeiras
 * semanas, e sem o link visível o convite viraria chamado para a 4YU. Também é
 * por isso que a tela diz se o e-mail saiu de verdade em vez de afirmar que
 * saiu.
 */
export function SecaoUsuarios({
  usuarios, convites, meuId,
}: {
  usuarios: UsuarioLinha[]
  convites: ConvitePendente[]
  meuId: string
}) {
  const [convidando, setConvidando] = useState(false)
  /*
   * `enviado` só existe para o convite. O link de redefinir senha ainda não sai
   * por e-mail — dizer "o e-mail não saiu" ali seria inventar uma falha que não
   * houve, num painel em que a pessoa confia para saber o que aconteceu.
   */
  const [link, setLink] = useState<
    | { tipo: 'convite'; url: string; para: string; enviado: boolean }
    | { tipo: 'senha'; url: string; para: string }
    | null
  >(null)
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
        setErro(erroLegivel(e))
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
            <ModalFormulario
              aberto
              titulo="Convidar usuário"
              sub="O convite mostra a conta e o papel antes de ser aceito."
              primario="Enviar convite"
              pendente={pendente}
              aoFechar={() => setConvidando(false)}
              aoEnviar={(f) => comErro(async () => {
                const r = await convidar({
                  email: String(f.get('email') ?? ''),
                  papel: String(f.get('papel') ?? 'profissional') as PapelConvidavel,
                })
                setLink({
                  tipo: 'convite',
                  url: urlDe(r.token),
                  para: String(f.get('email') ?? ''),
                  enviado: r.emailEnviado,
                })
                setConvidando(false)
              })}
            >
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
              <Nota tom="positivo">
                O convite vale por 7 dias. Mandamos por e-mail, e o link
                aparece na tela caso você prefira enviar por outro caminho.
              </Nota>
              {erro ? <Nota tom="alerta">{erro}</Nota> : null}
            </ModalFormulario>
          ) : null}

          {link ? (
            <div className="m-4 flex flex-col gap-2 rounded-padrao border border-linha p-3">
              <span className="text-[12.5px] font-medium">
                {link.tipo === 'senha'
                  ? `Link de senha para ${link.para}`
                  : link.enviado
                    ? `Convite enviado para ${link.para}`
                    : `Convite criado para ${link.para}`}
              </span>
              <span className="text-[12.5px] text-suave">
                {link.tipo === 'senha'
                  ? 'Mande para a pessoa:'
                  : link.enviado
                    ? 'Não chegou? Mande o link direto:'
                    : 'O e-mail não saiu. Mande o link direto:'}
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
                <Botao tom="fantasma" miudo onClick={() => setLink(null)}>Fechar</Botao>
              </div>
              <Nota tom="atencao">
                Este link não aparece de novo. Se perder, revogue o convite e
                crie outro, o e-mail que já saiu continua valendo.
              </Nota>
            </div>
          ) : null}

          {erro && !convidando ? (
            <div className="px-5 pb-3"><Nota tom="alerta">{erro}</Nota></div>
          ) : null}

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

                {/*
                  * As ações moram no menu, e não na linha.
                  *
                  * Um `<select>` de papel mais dois botões por usuário fazem
                  * cada linha ter noventa pixels e a lista de nove pessoas
                  * ocupar uma tela inteira — e nenhuma dessas três ações é
                  * feita mais de uma vez por pessoa na vida da conta.
                  */}
                {u.usuarioId === meuId ? (
                  <Etiqueta tinta="neutro">você</Etiqueta>
                ) : (
                  <Menu
                    titulo={`Ações de ${u.email}`}
                    itens={[
                      ...PAPEIS_CONVIDAVEIS
                        .filter((p) => p !== u.papel)
                        .map((p) => ({
                          rotulo: `Tornar ${NOME_PAPEL[p].toLowerCase()}`,
                          aoEscolher: () => comErro(
                            () => mudarPapel(u.usuarioId, p),
                            'Papel atualizado',
                          ),
                        })),
                      {
                        rotulo: 'Redefinir senha',
                        icone: 'chave' as const,
                        aoEscolher: () => comErro(async () => {
                          const r = await gerarLinkDeSenha(u.usuarioId)
                          setLink({ tipo: 'senha', url: urlDe(r.token), para: u.email })
                        }),
                      },
                      {
                        rotulo: 'Remover acesso',
                        perigo: true,
                        aoEscolher: () => comErro(
                          () => removerUsuario(u.usuarioId),
                          'Acesso removido',
                        ),
                      },
                    ]}
                  />
                )}
            </LinhaConfig>
          ))}

          <p className="px-5 py-3.5 text-[12px] text-tinta-media">
            Remover não apaga nada do que a pessoa registrou: a presença marcada
            por ela continua marcada por ela. Se for profissional, o nome segue
            na grade, o que acaba é o acesso.
          </p>
        </div>
      </PainelConfig>

      {convites.length > 0 ? (
        <PainelConfig
          titulo="Convites em aberto"
          sub="O link aparece uma vez. Se perder, revogue e crie outro"
        >
          {convites.map((c) => (
            <LinhaConfig
              key={c.id}
              nome={c.email}
              detalhe={
                /*
                 * O que aconteceu com o e-mail vem antes do prazo: se ele
                 * voltou, saber que "expira em 7 dias" não ajuda ninguém — a
                 * pessoa nunca vai receber. `entrega` nula é silêncio, não
                 * sucesso, e por isso não vira texto nenhum.
                 */
                c.entrega && c.entrega !== 'entregue'
                  ? recadoDaEntrega(c.entrega)
                  : c.expirado
                    ? 'expirado'
                    : `expira ${new Date(c.expiraEm).toLocaleDateString('pt-BR')}`
              }
            >
              {c.entrega && c.entrega !== 'entregue' ? (
                <Etiqueta tinta="atencao">Não chegou</Etiqueta>
              ) : null}
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
