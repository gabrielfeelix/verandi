'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Abas } from '@/components/ui/abas'
import { Avatar, Campo, Etiqueta, Nota, cartao, entrada } from '@/components/ui/pecas'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { useAviso } from '@/components/ui/desfazer'
import { NOME_PAPEL } from '@/core/acesso/papeis'
import { erroLegivel } from '@/core/erro-legivel'
import { mesCurto } from '@/core/agenda/mes-curto'
import { CabecalhoAdmin } from './pecas'
import { editarConta, linkDeSenha } from '@/server/admin/acoes'
import { entrarComoSuporte, suspenderConta } from '@/server/suporte/acoes'
import type { ContaDetalhe } from '@/server/admin/consultas'

type AbaDaConta = 'dados' | 'pessoas' | 'log'

/**
 * A tela de uma conta de cliente.
 *
 * Gerenciar a equipe (convidar, trocar papel, remover) **não** mora aqui: isso
 * é da Configuração do estúdio, e o admin chega lá pelo "Entrar". Duplicar a
 * tela de equipe na administração daria duas portas para a mesma regra, e a
 * regra de "sempre sobra um dono" passaria a ter dois lugares para quebrar.
 */
export function DetalheDaConta({
  conta, aba, children,
}: {
  conta: ContaDetalhe
  aba: AbaDaConta
  /** o conteúdo da aba Log, lido no servidor */
  children?: ReactNode
}) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [suspendendo, setSuspendendo] = useState(false)
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

  const base = `/admin/empresas/${conta.id}`
  const ativos = conta.pessoas.filter((p) => p.ativo)

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/empresas" className="self-start text-[13.5px] text-tinta-media hover:text-tinta">
        ‹ Empresas
      </Link>

      <CabecalhoAdmin
        titulo={<span className="flex flex-wrap items-center gap-3">
          {conta.nome}
          {conta.ativa ? null : <Etiqueta tinta="alerta">Suspensa</Etiqueta>}
        </span>}
        sub={<>
          <span className="font-mono">{conta.slug}</span>
          {' · criada em '}{mesCurto(conta.criadaEm.slice(0, 10))}
          {' · '}{ativos.length} {ativos.length === 1 ? 'pessoa' : 'pessoas'} com acesso
        </>}
      >
        <Botao
          disabled={pendente}
          onClick={() => rodar(async () => {
            await entrarComoSuporte(conta.id)
            router.push('/hoje')
          })}
        >
          Entrar como suporte
        </Botao>
      </CabecalhoAdmin>

      <Abas
        rotuloDoGrupo="Seções da empresa"
        ativo={aba}
        className="self-start"
        itens={[
          { id: 'dados', rotulo: 'Dados', href: base },
          { id: 'pessoas', rotulo: 'Pessoas', contagem: ativos.length, href: `${base}?aba=pessoas` },
          { id: 'log', rotulo: 'Log', href: `${base}?aba=log` },
        ]}
      />

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      {aba === 'dados' ? (
        <>
          <form
            className={`flex flex-col gap-4 p-4.5 ${cartao}`}
            action={(f) => rodar(() => editarConta(conta.id, {
              nome: String(f.get('nome') ?? ''),
              fuso: String(f.get('fuso') ?? ''),
            }), 'Dados salvos')}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Campo rotulo="Nome do negócio" htmlFor="dc-nome" obrigatorio>
                <input id="dc-nome" name="nome" required defaultValue={conta.nome} className={entrada} />
              </Campo>
              <Campo rotulo="Fuso" htmlFor="dc-fuso" dica="Exemplo: America/Sao_Paulo">
                <input id="dc-fuso" name="fuso" required defaultValue={conta.fuso} className={entrada} />
              </Campo>
              <Campo rotulo="Identificador" dica="Não muda: está em links e na API">
                <input readOnly value={conta.slug} className={`${entrada} cursor-default font-mono text-tinta-media`} aria-label="Identificador" />
              </Campo>
              <Campo rotulo="Razão social e documento" dica="O dono edita em Configuração, porque sai no recibo">
                <input readOnly aria-label="Razão social e documento"
                  value={[conta.razaoSocial, conta.documento].filter(Boolean).join(' · ') || 'não preenchido'}
                  className={`${entrada} cursor-default text-tinta-media`} />
              </Campo>
            </div>
            <Botao type="submit" disabled={pendente} className="self-start">Salvar dados</Botao>
          </form>

          {/* a zona de perigo fica por último e separada, como no resto do produto */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-cartao border border-alerta/30 bg-superficie p-4.5">
            <span className="flex max-w-[60ch] flex-col gap-1">
              <span className="text-[14.5px] font-medium">
                {conta.ativa ? 'Suspender empresa' : 'Reativar empresa'}
              </span>
              <span className="text-[13.5px] leading-[1.5] text-tinta-media">
                {conta.ativa
                  ? 'A equipe da empresa para de entrar e a API para de responder. Nada é apagado: reativar devolve tudo como estava.'
                  : 'A equipe volta a entrar e a API volta a responder, com tudo como estava.'}
              </span>
            </span>
            {conta.ativa ? (
              <Botao tom="perigo-leve" disabled={pendente} onClick={() => setSuspendendo(true)}>
                Suspender empresa
              </Botao>
            ) : (
              <Botao tom="secundario" disabled={pendente}
                onClick={() => rodar(() => suspenderConta(conta.id, true), 'Empresa reativada')}>
                Reativar empresa
              </Botao>
            )}
          </section>
        </>
      ) : null}

      {aba === 'pessoas' ? (
        <>
          <section className={`overflow-hidden ${cartao}`}>
            {conta.pessoas.length === 0 ? (
              <p className="px-4.5 py-6 text-[14.5px] text-tinta-media">Ninguém aceitou convite ainda.</p>
            ) : null}
            <ul>
              {conta.pessoas.map((p) => (
                <li key={p.usuarioId}
                  className="flex flex-wrap items-center gap-3.5 border-b border-linha-fina px-4.5 py-3 last:border-b-0">
                  <Avatar nome={p.nome ?? p.email} tamanho={32} decorativo />
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                    <span className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
                      <span className="truncate">{p.nome ?? p.email}</span>
                      <Etiqueta tinta={p.papel === 'dono' ? 'positivo' : 'neutro'}>
                        {NOME_PAPEL[p.papel] ?? p.papel}
                      </Etiqueta>
                      {p.ativo ? null : <Etiqueta tinta="neutro">Removido</Etiqueta>}
                      {p.suspensa ? <Etiqueta tinta="alerta">Suspenso</Etiqueta> : null}
                    </span>
                    <span className="truncate text-[12px] text-tinta-media">
                      {p.nome ? `${p.email} · ` : ''}
                      {p.ultimoAcesso
                        ? `último acesso em ${new Date(p.ultimoAcesso).toLocaleDateString('pt-BR')}`
                        : 'nunca entrou'}
                    </span>
                  </span>
                  <Botao tom="secundario" miudo disabled={pendente}
                    onClick={() => rodar(async () => {
                      const r = await linkDeSenha(p.usuarioId)
                      setLink({ email: p.email, url: r.link, enviado: r.enviado })
                    })}>
                    Link de senha
                  </Botao>
                </li>
              ))}
            </ul>
          </section>

          {conta.convites.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-titulo text-[18px] font-semibold">Convites esperando resposta</h2>
              <ul className={`overflow-hidden ${cartao}`}>
                {conta.convites.map((c) => (
                  <li key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-linha-fina px-4.5 py-3 text-[14.5px] last:border-b-0">
                    <span>{c.email} <span className="text-tinta-media">· {NOME_PAPEL[c.papel] ?? c.papel}</span></span>
                    <span className="text-[13.5px] text-tinta-media">
                      vence em {new Date(c.expiraEm).toLocaleDateString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Nota tom="neutro">
            Convidar, trocar papel e remover alguém é feito dentro da empresa, em
            Configuração. Use &quot;Entrar como suporte&quot; para chegar lá.
          </Nota>
        </>
      ) : null}

      {aba === 'log' ? children : null}

      <Modal
        aberto={suspendendo}
        icone="aviso"
        tom="alerta"
        perigo
        largura="confirmacao"
        titulo={`Suspender ${conta.nome}?`}
        sub="A equipe da empresa para de entrar e a API para de responder ao bot. Nada é apagado, e reativar devolve tudo como estava."
        primario="Suspender empresa"
        pendente={pendente}
        aoFechar={() => setSuspendendo(false)}
        aoConfirmar={() => {
          setSuspendendo(false)
          rodar(() => suspenderConta(conta.id, false), 'Empresa suspensa')
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
              className={`${entrada} font-mono text-[13.5px]`}
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
