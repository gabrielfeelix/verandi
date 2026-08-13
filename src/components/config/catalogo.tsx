'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Campo, Cartao, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { salvarServico, salvarLocal } from '@/server/config/acoes'
import type { ServicoLinha, LocalLinha } from '@/server/config/consultas'

/**
 * Serviços e locais.
 *
 * Nenhum dos dois tem `excluir`: desativar tira das escolhas novas e mantém no
 * histórico. Serviço apagado levaria junto o nome da sessão de ontem.
 */

function useSalvar() {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()
  const avisar = useAviso()

  function salvar(fn: () => Promise<void>, texto: string, aoFim?: () => void) {
    iniciar(async () => {
      setErro(null)
      try {
        await fn()
        avisar({ texto })
        aoFim?.()
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para salvar')
      }
    })
  }
  return { pendente, erro, salvar }
}

export function SecaoServicos({ servicos }: { servicos: ServicoLinha[] }) {
  const [novo, setNovo] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const { pendente, erro, salvar } = useSalvar()

  const ativos = servicos.filter((s) => s.ativo)
  const inativos = servicos.filter((s) => !s.ativo)

  return (
    <Cartao
      titulo="Serviços"
      acao={<Botao miudo onClick={() => { setNovo(true); setEditando(null) }}>Novo serviço</Botao>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-tinta-media">
          O que o negócio oferece. Aparece nas escolhas de horário fixo, de sessão
          e de agendamento.
        </p>

        {novo ? (
          <Formulario
            pendente={pendente}
            erro={erro}
            aoCancelar={() => setNovo(false)}
            aoSalvar={(f) => salvar(
              async () => {
                await salvarServico({
                  nome: String(f.get('nome') ?? ''),
                  duracaoMin: Number(f.get('duracaoMin')),
                  capacidadePadrao: Number(f.get('capacidade')),
                  ativo: true,
                })
              },
              'Serviço criado',
              () => setNovo(false),
            )}
          >
            <Campo rotulo="Nome" htmlFor="srv-nome">
              <input id="srv-nome" name="nome" required className={entrada} autoFocus />
            </Campo>
            <Campo rotulo="Duração (min)" htmlFor="srv-dur">
              <input id="srv-dur" name="duracaoMin" type="number" min={1}
                defaultValue={50} className={`${entrada} w-28`} />
            </Campo>
            <Campo
              rotulo="Capacidade padrão" htmlFor="srv-cap"
              dica="todo horário fixo deste serviço começa com esse número"
            >
              <input id="srv-cap" name="capacidade" type="number" min={1}
                defaultValue={4} className={`${entrada} w-28`} />
            </Campo>
          </Formulario>
        ) : null}

        {servicos.length === 0 && !novo ? (
          <Nota tom="neutro">
            Nenhum serviço ainda. É o primeiro cadastro da conta — sem serviço não
            dá para montar a grade.
          </Nota>
        ) : null}

        <ul className="flex flex-col gap-2">
          {[...ativos, ...inativos].map((s) => (
            <li key={s.id} className="rounded-[--radius-padrao] border border-linha-suave p-3">
              {editando === s.id ? (
                <Formulario
                  pendente={pendente}
                  erro={erro}
                  aoCancelar={() => setEditando(null)}
                  aoSalvar={(f) => salvar(
                    async () => {
                      await salvarServico({
                        id: s.id,
                        nome: String(f.get('nome') ?? ''),
                        duracaoMin: Number(f.get('duracaoMin')),
                        capacidadePadrao: Number(f.get('capacidade')),
                        ativo: f.get('ativo') === 'on',
                      })
                    },
                    'Serviço atualizado',
                    () => setEditando(null),
                  )}
                >
                  <Campo rotulo="Nome" htmlFor={`n-${s.id}`}>
                    <input id={`n-${s.id}`} name="nome" defaultValue={s.nome}
                      required className={entrada} />
                  </Campo>
                  <Campo rotulo="Duração (min)" htmlFor={`d-${s.id}`}>
                    <input id={`d-${s.id}`} name="duracaoMin" type="number" min={1}
                      defaultValue={s.duracaoMin} className={`${entrada} w-28`} />
                  </Campo>
                  <Campo rotulo="Capacidade padrão" htmlFor={`c-${s.id}`}>
                    <input id={`c-${s.id}`} name="capacidade" type="number" min={1}
                      defaultValue={s.capacidadePadrao} className={`${entrada} w-28`} />
                  </Campo>
                  <label className="flex items-center gap-2 self-end pb-2 text-[12.5px]">
                    <input type="checkbox" name="ativo" defaultChecked={s.ativo} />
                    Ativo
                  </label>
                  {!s.ativo || s.emUso > 0 ? (
                    <Nota tom="atencao">
                      Desativado, some das escolhas novas e continua aparecendo no
                      histórico. {s.emUso > 0 ? `${s.emUso} horário(s) fixo(s) usam este serviço.` : ''}
                    </Nota>
                  ) : null}
                </Formulario>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{s.nome}</span>
                  <span className="font-mono text-[12.5px] text-tinta-media">
                    {s.duracaoMin} min · {s.capacidadePadrao} vagas
                  </span>
                  {s.emUso > 0 ? (
                    <Etiqueta tinta="neutro">{s.emUso} na grade</Etiqueta>
                  ) : null}
                  {!s.ativo ? <Etiqueta tinta="neutro">inativo</Etiqueta> : null}
                  <Botao tom="texto" miudo className="ml-auto"
                    onClick={() => { setEditando(s.id); setNovo(false) }}>
                    Editar
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Cartao>
  )
}

export function SecaoLocais({ locais }: { locais: LocalLinha[] }) {
  const [novo, setNovo] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const { pendente, erro, salvar } = useSalvar()

  return (
    <Cartao
      titulo="Locais"
      acao={<Botao miudo onClick={() => { setNovo(true); setEditando(null) }}>Novo local</Botao>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-tinta-media">
          Sala, cadeira, consultório, domicílio. A capacidade é o limite físico —
          serve de aviso, não bloqueia.
        </p>

        {novo ? (
          <Formulario
            pendente={pendente}
            erro={erro}
            aoCancelar={() => setNovo(false)}
            aoSalvar={(f) => salvar(
              async () => {
                const cap = String(f.get('capacidade') ?? '')
                await salvarLocal({
                  nome: String(f.get('nome') ?? ''),
                  capacidade: cap ? Number(cap) : null,
                  ativo: true,
                })
              },
              'Local criado',
              () => setNovo(false),
            )}
          >
            <Campo rotulo="Nome" htmlFor="loc-nome">
              <input id="loc-nome" name="nome" required className={entrada} autoFocus />
            </Campo>
            <Campo rotulo="Capacidade" htmlFor="loc-cap" dica="quantas pessoas cabem aqui (opcional)">
              <input id="loc-cap" name="capacidade" type="number" min={1}
                className={`${entrada} w-28`} />
            </Campo>
          </Formulario>
        ) : null}

        {locais.length === 0 && !novo ? (
          <Nota tom="neutro">
            Nenhum local ainda. Horário fixo funciona sem local — cadastre quando
            houver mais de um lugar para separar.
          </Nota>
        ) : null}

        <ul className="flex flex-col gap-2">
          {locais.map((l) => (
            <li key={l.id} className="rounded-[--radius-padrao] border border-linha-suave p-3">
              {editando === l.id ? (
                <Formulario
                  pendente={pendente}
                  erro={erro}
                  aoCancelar={() => setEditando(null)}
                  aoSalvar={(f) => salvar(
                    async () => {
                      const cap = String(f.get('capacidade') ?? '')
                      await salvarLocal({
                        id: l.id,
                        nome: String(f.get('nome') ?? ''),
                        capacidade: cap ? Number(cap) : null,
                        ativo: f.get('ativo') === 'on',
                      })
                    },
                    'Local atualizado',
                    () => setEditando(null),
                  )}
                >
                  <Campo rotulo="Nome" htmlFor={`ln-${l.id}`}>
                    <input id={`ln-${l.id}`} name="nome" defaultValue={l.nome}
                      required className={entrada} />
                  </Campo>
                  <Campo rotulo="Capacidade" htmlFor={`lc-${l.id}`}>
                    <input id={`lc-${l.id}`} name="capacidade" type="number" min={1}
                      defaultValue={l.capacidade ?? undefined} className={`${entrada} w-28`} />
                  </Campo>
                  <label className="flex items-center gap-2 self-end pb-2 text-[12.5px]">
                    <input type="checkbox" name="ativo" defaultChecked={l.ativo} />
                    Ativo
                  </label>
                  <Nota tom="atencao">
                    Renomear muda o nome em todas as sessões, inclusive nas antigas.
                  </Nota>
                </Formulario>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{l.nome}</span>
                  {l.capacidade ? (
                    <span className="font-mono text-[12.5px] text-tinta-media">
                      cabe {l.capacidade}
                    </span>
                  ) : null}
                  {l.emUso > 0 ? <Etiqueta tinta="neutro">{l.emUso} na grade</Etiqueta> : null}
                  {!l.ativo ? <Etiqueta tinta="neutro">inativo</Etiqueta> : null}
                  <Botao tom="texto" miudo className="ml-auto"
                    onClick={() => { setEditando(l.id); setNovo(false) }}>
                    Editar
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Cartao>
  )
}

function Formulario({
  children, aoSalvar, aoCancelar, pendente, erro,
}: {
  children: React.ReactNode
  aoSalvar: (f: FormData) => void
  aoCancelar: () => void
  pendente: boolean
  erro: string | null
}) {
  return (
    <form
      action={aoSalvar}
      className="flex flex-col gap-3 rounded-[--radius-padrao] bg-superficie-suave p-3"
    >
      <div className="flex flex-wrap items-start gap-3">{children}</div>
      {erro ? <Nota tom="alerta">{erro}</Nota> : null}
      <div className="flex gap-2">
        <Botao type="submit" miudo disabled={pendente}>Salvar</Botao>
        <Botao type="button" tom="texto" miudo onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  )
}
