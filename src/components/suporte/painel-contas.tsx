'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Campo, Cartao, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
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
      <Cartao
        titulo="Contas"
        acao={<Botao miudo onClick={() => setCriando(true)}>Nova conta</Botao>}
      >
        <div className="flex flex-col gap-3">
          {criando ? (
            <form
              className="flex flex-col gap-3 rounded-[--radius-padrao] bg-superficie-suave p-3"
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
                <Botao type="button" tom="texto" miudo onClick={() => setCriando(false)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          ) : null}

          {convite ? (
            <div className="flex flex-col gap-2 rounded-[--radius-padrao] border border-linha p-3">
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
                <Botao tom="texto" miudo onClick={() => setConvite(null)}>Fechar</Botao>
              </div>
            </div>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}

          <ul className="flex flex-col gap-2">
            {contas.map((c) => (
              <li key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border border-linha-suave p-3">
                <div className="flex min-w-48 flex-col">
                  <span className="font-medium">{c.nome}</span>
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

                <span className="ml-auto flex flex-wrap gap-2">
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
                    tom="texto" miudo disabled={pendente}
                    onClick={() => comErro(
                      () => suspenderConta(c.id, !c.ativa),
                      c.ativa ? 'Conta suspensa' : 'Conta reativada',
                    )}
                  >
                    {c.ativa ? 'Suspender' : 'Reativar'}
                  </Botao>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Cartao>

      <Cartao titulo="Log de acesso da 4YU">
        <p className="mb-3 text-[12.5px] text-tinta-media">
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
      </Cartao>
    </div>
  )
}
