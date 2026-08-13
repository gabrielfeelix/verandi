'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { cartao, Campo, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { paresDe } from '@/components/hoje/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { criarConta, entrarComoSuporte, suspenderConta } from '@/server/suporte/acoes'
import type { AcessoSuporte, ContaSinais } from '@/server/suporte/consultas'

/**
 * A tela da 4YU.
 *
 * Os sinais de vida respondem "o cliente está usando?" antes de ele reclamar —
 * chamada que parou de ser feita é o primeiro sintoma de abandono.
 */
export function PainelContas({
  contas, acessos,
}: {
  contas: ContaSinais[]
  acessos: AcessoSuporte[]
}) {
  const [criando, setCriando] = useState(false)
  const [convite, setConvite] = useState<{ url: string; para: string } | null>(null)
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

  return (
    <div className="flex flex-col gap-4">
      {/* Entrar na conta de um cliente é o acesso mais forte do sistema, e a
          tela diz isso antes de oferecer o botão. */}
      <p className="flex items-start gap-2.5 rounded-media border border-atencao-fundo bg-[#FDF8EE] px-3.5 py-3 text-[13px] leading-relaxed text-[#7A5E1E]">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-atencao-fundo font-mono text-[11px]"
        >
          !
        </span>
        <span>
          Entrar como suporte mostra uma faixa dentro da conta enquanto durar, e
          toda ação fica registrada com quem fez. Ver dado de cliente sem que
          ninguém saiba é constrangedor de propósito.
        </span>
      </p>

      <section className={`overflow-hidden ${cartao}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha-fina px-4.5 py-3.5">
          <h2 className="font-titulo text-[19px] font-semibold">Contas</h2>
          <Botao miudo onClick={() => setCriando(true)}>Nova conta</Botao>
        </div>
        <div className="flex flex-col">
          {criando ? (
            <form
              className="flex flex-col gap-3 border-b border-linha-fina bg-superficie-suave px-4.5 py-4"
              action={(f) => comErro(async () => {
                const r = await criarConta({
                  nome: String(f.get('nome') ?? ''),
                  slug: String(f.get('slug') ?? ''),
                  fuso: String(f.get('fuso') ?? '') || undefined,
                  emailDono: String(f.get('email') ?? ''),
                })
                setConvite({
                  url: `${window.location.origin}/convite/${r.token}`,
                  para: String(f.get('email') ?? ''),
                })
                setCriando(false)
              })}
            >
              <div className="flex flex-wrap items-start gap-3">
                <Campo rotulo="Nome do negócio" htmlFor="nc-nome">
                  <input id="nc-nome" name="nome" required className={entrada} autoFocus />
                </Campo>
                <Campo rotulo="Identificador" htmlFor="nc-slug" dica="minúsculas, números e hífen">
                  <input id="nc-slug" name="slug" required className={entrada}
                    placeholder="studio-aurora" />
                </Campo>
                <Campo rotulo="Fuso" htmlFor="nc-fuso">
                  <input id="nc-fuso" name="fuso" className={entrada}
                    defaultValue="America/Sao_Paulo" />
                </Campo>
                <Campo rotulo="E-mail do dono" htmlFor="nc-email">
                  <input id="nc-email" name="email" type="email" required className={entrada} />
                </Campo>
              </div>
              <Nota tom="positivo">
                A conta nasce vazia: sem horário fixo, sem pessoa, sem sessão. O
                dono recebe um convite e monta a grade dele.
              </Nota>
              <div className="flex gap-2">
                <Botao type="submit" miudo disabled={pendente}>Criar conta</Botao>
                <Botao type="button" tom="fantasma" miudo onClick={() => setCriando(false)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          ) : null}

          {convite ? (
            <div className="m-4 flex flex-col gap-2 rounded-media border border-linha p-3">
              <span className="text-[12.5px] font-medium">
                Convite do dono ({convite.para}) — copie agora
              </span>
              <input readOnly value={convite.url} aria-label="Link do convite"
                className={`${entrada} font-mono text-[12px]`}
                onFocus={(e) => e.currentTarget.select()} />
              <div className="flex gap-2">
                <Botao tom="secundario" miudo
                  onClick={() => {
                    navigator.clipboard?.writeText(convite.url)
                    avisar({ texto: 'Link copiado' })
                  }}>
                  Copiar link
                </Botao>
                <Botao tom="fantasma" miudo onClick={() => setConvite(null)}>Fechar</Botao>
              </div>
            </div>
          ) : null}

          {erro ? <div className="px-4.5 pb-3"><Nota tom="alerta">{erro}</Nota></div> : null}

          <ul>
            {contas.map((c) => {
              const [fundo, frente] = paresDe(c.nome)
              return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3.5 border-b border-linha-fina px-4.5 py-3.5 last:border-b-0 hover:bg-superficie-tenue"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-padrao font-titulo text-[14px] font-bold"
                  style={{ background: fundo, color: frente }}
                >
                  {c.nome.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}
                </span>

                <div className="flex min-w-40 flex-1 flex-col leading-[1.35]">
                  <span className="text-[14px] font-medium">{c.nome}</span>
                  <span className="font-mono text-[11.5px] text-tinta-media">{c.slug}</span>
                </div>

                <Etiqueta tinta="neutro">{c.sessoesSemana} na semana</Etiqueta>

                {/* chamada que despenca é o primeiro sintoma de abandono */}
                {c.chamadasFeitasPct === null ? (
                  <Etiqueta tinta="neutro">sem chamada ainda</Etiqueta>
                ) : (
                  <Etiqueta tinta={c.chamadasFeitasPct >= 70 ? 'positivo' : 'alerta'}>
                    {c.chamadasFeitasPct}% de chamadas feitas
                  </Etiqueta>
                )}

                <span className="text-[11.5px] text-tinta-media">
                  {c.ultimoAcesso
                    ? `acesso ${new Date(c.ultimoAcesso).toLocaleDateString('pt-BR')}`
                    : 'nunca acessaram'}
                </span>

                {!c.ativa ? <Etiqueta tinta="alerta">suspensa</Etiqueta> : null}

                <span className="flex flex-wrap gap-1.5">
                  <Botao
                    tom="secundario" miudo disabled={pendente}
                    onClick={() => comErro(async () => {
                      await entrarComoSuporte(c.id)
                      router.push('/hoje')
                    })}
                  >
                    Entrar como suporte
                  </Botao>
                  <Botao
                    tom="fantasma" miudo disabled={pendente}
                    onClick={() => comErro(
                      () => suspenderConta(c.id, !c.ativa),
                      c.ativa ? 'Conta suspensa' : 'Conta reativada',
                    )}
                  >
                    {c.ativa ? 'Suspender' : 'Reativar'}
                  </Botao>
                </span>
              </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className={`${cartao} p-4`}>
        <h2 className="font-titulo text-[19px] font-semibold">Log de acesso da 4YU</h2>
        <p className="pt-1 pb-3 text-[12.5px] text-tinta-media">
          Toda entrada em conta de cliente fica registrada, com início e fim.
        </p>
        {acessos.length === 0 ? (
          <Nota tom="neutro">Ninguém entrou em conta de cliente ainda.</Nota>
        ) : (
          <ul className="flex flex-col gap-2">
            {acessos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 text-[12.5px]">
                <span className="font-medium">{a.contaNome}</span>
                <span className="text-tinta-media">
                  {new Date(a.iniciadoEm).toLocaleString('pt-BR')}
                </span>
                <Etiqueta tinta={a.encerradoEm ? 'neutro' : 'atencao'}>
                  {a.encerradoEm ? 'encerrado' : 'em aberto'}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
