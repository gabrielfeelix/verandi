'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Menu } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import {
  cartao, Campo, Etiqueta, Nota, Paginacao, entrada,
} from '@/components/ui/pecas'
import { paresDe } from '@/components/hoje/pecas'
import { mesCurto } from '@/core/agenda/mes-curto'
import { useAviso } from '@/components/ui/desfazer'
import { criarConta, entrarComoSuporte, suspenderConta } from '@/server/suporte/acoes'
import type { AcessoSuporte, ContaSinais } from '@/server/suporte/consultas'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * A tela da 4YU.
 *
 * Os sinais de vida respondem "o cliente está usando?" antes de ele reclamar —
 * chamada que parou de ser feita é o primeiro sintoma de abandono. Por isso a
 * lista é tabela e não cartão: as três colunas de número existem para serem
 * comparadas de cima a baixo, e cartão empilhado não deixa comparar nada.
 */
export function PainelContas({
  contas, acessos, busca, pagina, total, porPagina,
}: {
  /** só a página atual: a lista inteira não cabe mais na tela nem na memória */
  contas: ContaSinais[]
  acessos: AcessoSuporte[]
  busca: string
  pagina: number
  /** quantas contas a busca encontrou ao todo, não quantas vieram */
  total: number
  porPagina: number
}) {
  /* o endereço de cada página é montado aqui: função não atravessa a fronteira
     de Server para Client Component */
  const hrefDaPagina = (n: number) => {
    const b = new URLSearchParams()
    if (busca) b.set('q', busca)
    if (n > 1) b.set('p', String(n))
    const s = b.toString()
    return s ? `/contas-4yu?${s}` : '/contas-4yu'
  }

  const [criando, setCriando] = useState(false)
  const [vendoLog, setVendoLog] = useState(false)
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
        setErro(erroLegivel(e))
      }
    })
  }

  const COLUNAS = 'grid-cols-[minmax(0,1fr)_112px_150px_120px_auto]'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Contas
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {/* o número é o da busca inteira, não o da página: "20 contas"
                a cada página seria um número errado que ninguém desconfiaria */}
            Painel da 4YU · {total} {total === 1 ? 'conta' : 'contas'}
            {busca ? ' encontradas' : ''} · sinais de vida antes da reclamação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* busca por GET, como em /pessoas: o endereço vira o link que se
              manda no chat, e o voltar desfaz a busca */}
          <form className="relative flex items-center" action="/contas-4yu">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 font-mono text-[13px] text-tinta-fraca"
            >
              ⌕
            </span>
            <input
              id="q" name="q" defaultValue={busca} aria-label="Buscar conta"
              placeholder="Nome ou identificador"
              className="min-h-11 min-w-[228px] rounded-padrao border border-linha bg-superficie pr-3.5 pl-9 text-[13px] placeholder:text-tinta-fraca"
            />
            <button type="submit" className="sr-only focus:not-sr-only focus:ml-2">
              Buscar
            </button>
          </form>
          <Botao tom="secundario" onClick={() => setVendoLog(true)}>
            Log de suporte
          </Botao>
          <Botao onClick={() => setCriando(true)}>Nova conta</Botao>
        </div>
      </header>

      <section className={`overflow-hidden ${cartao}`}>
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
              <Campo rotulo="Identificador" htmlFor="nc-slug" dica="Minúsculas, números e hífen">
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
              Convite do dono ({convite.para}), copie agora
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

        {erro ? <div className="px-4.5 pt-3"><Nota tom="alerta">{erro}</Nota></div> : null}

        <div
          className={`hidden gap-3.5 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3 md:grid ${COLUNAS}`}
        >
          {['Conta', 'Sessões/sem', 'Chamadas', 'Último acesso', ''].map((c, i) => (
            <span
              key={c || i}
              className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-media uppercase"
            >
              {c}
            </span>
          ))}
        </div>

        {contas.length === 0 ? (
          <p className="px-4.5 py-6 text-[13px] text-tinta-media">
            {busca
              ? `Nenhuma conta com "${busca}".`
              : 'Nenhuma conta de cliente ainda.'}
          </p>
        ) : null}

        <ul>
          {contas.map((c) => {
            const [fundo, frente] = paresDe(c.nome)
            return (
              <li
                key={c.id}
                className={`flex flex-wrap items-center gap-3.5 border-b border-linha-fina px-4.5 py-3 last:border-b-0 hover:bg-superficie-tenue md:grid ${COLUNAS}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-padrao font-titulo text-[14px] font-bold"
                    style={{ background: fundo, color: frente }}
                  >
                    {c.nome.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-col leading-[1.35]">
                    <span className="flex items-center gap-2 truncate text-[14px] font-medium">
                      {c.nome}
                      {!c.ativa ? <Etiqueta tinta="alerta">suspensa</Etiqueta> : null}
                    </span>
                    <span className="truncate text-[11.5px] text-tinta-media">
                      <span className="font-mono">{c.slug}</span>
                      {' · criada em '}{mesCurto(c.criadaEm.slice(0, 10))}
                    </span>
                  </span>
                </span>

                <span className="font-mono text-[13px] text-tinta-media">
                  {c.sessoesSemana}
                </span>

                {/* chamada que despenca é o primeiro sintoma de abandono */}
                <span className="justify-self-start">
                  {c.chamadasFeitasPct === null ? (
                    <Etiqueta tinta="neutro">sem dados</Etiqueta>
                  ) : (
                    <Etiqueta tinta={c.chamadasFeitasPct >= 70 ? 'positivo' : 'alerta'}>
                      {c.chamadasFeitasPct}% feitas
                    </Etiqueta>
                  )}
                </span>

                <span
                  className={`text-[12px] ${
                    c.ultimoAcesso ? 'text-tinta-media' : 'font-medium text-alerta'
                  }`}
                >
                  {c.ultimoAcesso
                    ? new Date(c.ultimoAcesso).toLocaleDateString('pt-BR')
                    : 'nunca'}
                </span>

                <span className="flex items-center gap-1.5 justify-self-end">
                  <Botao
                    tom="secundario" miudo disabled={pendente}
                    onClick={() => comErro(async () => {
                      await entrarComoSuporte(c.id)
                      router.push('/hoje')
                    })}
                  >
                    Entrar
                  </Botao>
                  <Menu
                    titulo={`Ações de ${c.nome}`}
                    itens={[{
                      rotulo: c.ativa ? 'Suspender conta' : 'Reativar conta',
                      perigo: c.ativa,
                      aoEscolher: () => comErro(
                        () => suspenderConta(c.id, !c.ativa),
                        c.ativa ? 'Conta suspensa' : 'Conta reativada',
                      ),
                    }]}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={porPagina}
        hrefDe={hrefDaPagina}
        nota="conta suspensa continua na lista"
      />

      {/* Entrar na conta de um cliente é o acesso mais forte do sistema, e a
          tela diz isso, depois da lista, onde ele fecha a leitura em vez de
          atrasá-la todo dia. */}
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

      <Modal
        aberto={vendoLog}
        glifo="≡"
        tom="neutro"
        largura="lista"
        titulo="Log de acesso da 4YU"
        sub="Toda entrada em conta de cliente fica registrada, com início e fim."
        secundario="Fechar"
        aoFechar={() => setVendoLog(false)}
      >
        {acessos.length === 0 ? (
          <Nota tom="neutro">Ninguém entrou em conta de cliente ainda.</Nota>
        ) : (
          <ul className="flex flex-col gap-2 pb-1">
            {acessos.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-media border border-linha-fina px-3 py-2.5 text-[12.5px]"
              >
                <span className="flex-1 font-medium">{a.contaNome}</span>
                <span className="font-mono text-[11.5px] text-tinta-media">
                  {new Date(a.iniciadoEm).toLocaleString('pt-BR')}
                </span>
                <Etiqueta tinta={a.encerradoEm ? 'neutro' : 'atencao'}>
                  {a.encerradoEm ? 'encerrado' : 'em aberto'}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
