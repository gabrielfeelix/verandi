'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao, BotaoIcone } from '@/components/ui/botao'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Campo, ListaImpacto, Nota, entrada } from '@/components/ui/pecas'
import {
  BotaoLinha, Dado, Estado, LinhaConfig, PainelConfig, Recolhivel,
} from './casca'
import { useAviso } from '@/components/ui/desfazer'
import { salvarServico, salvarLocal } from '@/server/config/acoes'
import type { ServicoLinha, LocalLinha } from '@/server/config/consultas'

/**
 * Serviços e locais.
 *
 * Nenhum dos dois tem `excluir`: desativar tira das escolhas novas e mantém no
 * histórico. Serviço apagado levaria junto o nome da sessão de ontem.
 *
 * Criar e editar acontecem **em modal**, como no protótipo: a lista continua
 * inteira atrás, e a linha não sai do lugar para abrir espaço a um formulário.
 * Faixa embutida aqui só existiria para poupar um clique, ao custo de a lista
 * pular sob o cursor.
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
  return { pendente, erro, setErro, salvar }
}

export function SecaoServicos({ servicos }: { servicos: ServicoLinha[] }) {
  /** `'novo'`, ou o serviço em edição. `null` é modal fechado. */
  const [edicao, setEdicao] = useState<ServicoLinha | 'novo' | null>(null)
  const { pendente, erro, setErro, salvar } = useSalvar()

  const ativos = servicos.filter((s) => s.ativo)
  const inativos = servicos.filter((s) => !s.ativo)

  function fechar() {
    setEdicao(null)
    setErro(null)
  }

  const emEdicao = edicao === 'novo' ? null : edicao

  return (
    <PainelConfig
      titulo="Serviços"
      sub="Desativar não quebra histórico: sai das escolhas novas, continua no passado"
      acao={<Botao miudo onClick={() => setEdicao('novo')}>Novo serviço</Botao>}
    >
      {servicos.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Nenhum serviço ainda. É o primeiro cadastro da conta, sem serviço não
          dá para montar a grade.
        </p>
      ) : null}

      {ativos.map((s) => (
        <LinhaConfig
          key={s.id}
          nome={s.nome}
          detalhe={
            <>
              {s.duracaoMin} min
              {s.emUso > 0 ? ` · ${s.emUso} na grade` : ''}
            </>
          }
        >
          <Dado>cap. {s.capacidadePadrao}</Dado>
          <Estado ativo />
          <BotaoLinha onClick={() => setEdicao(s)}>Editar</BotaoLinha>
        </LinhaConfig>
      ))}

      {inativos.length > 0 ? (
        <Recolhivel
          rotulo={`${inativos.length} serviço${inativos.length > 1 ? 's' : ''} desativado${inativos.length > 1 ? 's' : ''}`}
        >
          {inativos.map((s) => (
            <LinhaConfig
              key={s.id}
              apagado
              nome={s.nome}
              detalhe={`${s.duracaoMin} min${s.emUso > 0 ? ` · ${s.emUso} na grade` : ''}`}
            >
              <Dado>cap. {s.capacidadePadrao}</Dado>
              <Estado ativo={false} />
              <BotaoLinha tom="marca" onClick={() => setEdicao(s)}>Editar</BotaoLinha>
            </LinhaConfig>
          ))}
        </Recolhivel>
      ) : null}

      {edicao ? (
        <ModalFormulario
          aberto
          key={emEdicao?.id ?? 'novo'}
          glifo={emEdicao ? '✎' : '+'}
          titulo={emEdicao ? 'Editar serviço' : 'Novo serviço'}
          sub={
            emEdicao
              ? `${emEdicao.nome} · a mudança vale daqui para frente`
              : 'Aparece nas escolhas de série, sessão e agendamento.'
          }
          primario={emEdicao ? 'Salvar' : 'Criar serviço'}
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => salvar(
            async () => {
              await salvarServico({
                id: emEdicao?.id,
                nome: String(f.get('nome') ?? ''),
                duracaoMin: Number(f.get('duracaoMin')),
                capacidadePadrao: Number(f.get('capacidade')),
                ativo: emEdicao ? f.get('ativo') === 'on' : true,
              })
            },
            emEdicao ? 'Serviço atualizado' : 'Serviço criado',
            fechar,
          )}
        >
          <Campo rotulo="Nome" htmlFor="srv-nome">
            <input id="srv-nome" name="nome" required autoFocus
              defaultValue={emEdicao?.nome} className={entrada} />
          </Campo>
          <Campo rotulo="Duração (min)" htmlFor="srv-dur">
            <input id="srv-dur" name="duracaoMin" type="number" min={1}
              defaultValue={emEdicao?.duracaoMin ?? 50} className={`${entrada} w-28`} />
          </Campo>
          <Campo
            rotulo="Capacidade padrão" htmlFor="srv-cap"
            dica={
              emEdicao
                ? 'vale para horários novos, os existentes mantêm a sua'
                : 'todo horário fixo deste serviço começa com esse número'
            }
          >
            <input id="srv-cap" name="capacidade" type="number" min={1}
              defaultValue={emEdicao?.capacidadePadrao ?? 4} className={`${entrada} w-28`} />
          </Campo>
          {emEdicao ? (
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" name="ativo" defaultChecked={emEdicao.ativo} />
              Ativo
            </label>
          ) : null}
          {emEdicao && (!emEdicao.ativo || emEdicao.emUso > 0) ? (
            <Nota tom="atencao">
              Desativado, some das escolhas novas e continua aparecendo no
              histórico.{' '}
              {emEdicao.emUso > 0
                ? `${emEdicao.emUso} horário(s) fixo(s) usam este serviço.`
                : ''}
            </Nota>
          ) : null}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </PainelConfig>
  )
}

export function SecaoLocais({
  locais, rotuloSeries, rotuloSessoes,
}: {
  locais: LocalLinha[]
  /** plurais do vocabulário da conta, para a lista de impacto da confirmação */
  rotuloSeries: string
  rotuloSessoes: string
}) {
  const [edicao, setEdicao] = useState<LocalLinha | 'novo' | null>(null)
  /** o local que está prestes a ser desativado; `null` sem confirmação aberta */
  const [aDesativar, setADesativar] = useState<LocalLinha | null>(null)
  const { pendente, erro, setErro, salvar } = useSalvar()

  const ativos = locais.filter((l) => l.ativo)
  const inativos = locais.filter((l) => !l.ativo)

  function fechar() {
    setEdicao(null)
    setErro(null)
  }

  const emEdicao = edicao === 'novo' ? null : edicao

  return (
    <PainelConfig
      titulo="Locais"
      sub="Sala, cadeira, consultório, domicílio. A capacidade é o limite físico, avisa, não bloqueia"
    >
      {locais.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Nenhum local ainda. Horário fixo funciona sem local, cadastre quando
          houver mais de um lugar para separar.
        </p>
      ) : null}

      {/*
        * Local é chip, e não linha de lista.
        *
        * São três ou quatro nomes curtos — "Sala 1", "Domicílio". Uma linha
        * inteira para cada um faz a seção parecer tão pesada quanto Serviços,
        * que tem duração, capacidade e estado por item. Aqui o que existe é
        * nome e quantas séries usam. É a fileira de chips do protótipo.
        */}
      {ativos.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {ativos.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-2 rounded-padrao border border-linha-suave bg-superficie py-1.5 pr-1.5 pl-3 text-[13.5px] font-medium"
            >
              {l.nome}
              <span className="font-mono text-[11.5px] font-normal text-tinta-fraca">
                {l.emUso > 0 ? `${l.emUso} na grade` : 'sem uso'}
              </span>
              {l.capacidade ? (
                <span className="font-mono text-[11.5px] font-normal text-tinta-fraca">
                  cabe {l.capacidade}
                </span>
              ) : null}
              <BotaoIcone
                icone="lapis"
                titulo={`Editar ${l.nome}`}
                onClick={() => setEdicao(l)}
              />
              {/* desativar não acontece no clique: o protótipo desenha modal
                  destrutivo aqui, e é onde a pessoa fica sabendo quantas
                  séries e sessões dependem do que ela está tirando */}
              <BotaoIcone
                icone="fechar"
                titulo={`Desativar ${l.nome}`}
                perigo
                disabled={pendente}
                onClick={() => setADesativar(l)}
              />
            </span>
          ))}

          <button
            type="button"
            onClick={() => setEdicao('novo')}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-padrao border border-dashed border-linha-tracejada px-3.5 text-[13px] whitespace-nowrap text-marca hover:bg-superficie-suave"
          >
            + Novo local
          </button>
        </div>
      ) : (
        <div className="px-5 pb-4">
          <Botao miudo tom="tracejado" onClick={() => setEdicao('novo')}>
            + Novo local
          </Botao>
        </div>
      )}

      {inativos.length > 0 ? (
        <Recolhivel
          rotulo={`${inativos.length} local${inativos.length > 1 ? 'is' : ''} desativado${inativos.length > 1 ? 's' : ''}`}
        >
          {inativos.map((l) => (
            <LinhaConfig key={l.id} apagado nome={l.nome}
              detalhe={l.emUso > 0 ? `${l.emUso} na grade` : undefined}>
              {l.capacidade ? <Dado>cabe {l.capacidade}</Dado> : null}
              <Estado ativo={false} />
              <BotaoLinha tom="marca" onClick={() => setEdicao(l)}>Editar</BotaoLinha>
            </LinhaConfig>
          ))}
        </Recolhivel>
      ) : null}

      {erro && !edicao ? (
        <div className="px-5 pb-4"><Nota tom="alerta">{erro}</Nota></div>
      ) : null}

      {aDesativar ? (
        <Modal
          aberto
          perigo
          largura="lista"
          titulo={`Desativar ${aDesativar.nome}?`}
          sub="O local sai das escolhas novas e continua no que já aconteceu."
          primario="Desativar local"
          pendente={pendente}
          aoFechar={() => setADesativar(null)}
          aoConfirmar={() => salvar(
            async () => {
              await salvarLocal({
                id: aDesativar.id,
                nome: aDesativar.nome,
                capacidade: aDesativar.capacidade,
                ativo: false,
              })
            },
            'Local desativado',
            () => setADesativar(null),
          )}
        >
          <ListaImpacto
            rotulo="Hoje ele é usado em"
            /* o qualificador fica na coluna da direita, nunca colado na
               palavra do cliente: "locais ativos" vira "salas ativos" */
            itens={[
              {
                titulo: `${rotuloSeries} na grade`,
                meta: `${aDesativar.emUso}, seguem apontando para cá`,
              },
              {
                titulo: `${rotuloSessoes} que já estão na agenda`,
                meta: `${aDesativar.sessoesFuturas}, seguem apontando para cá`,
              },
            ]}
          />
          <Nota tom="alerta">
            Nada é apagado e nada muda de lugar: o que já existe continua
            apontando para este local, e ele para de aparecer nas escolhas
            novas. Para tirar de vez, troque o local em cada um antes.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}

      {edicao ? (
        <ModalFormulario
          aberto
          key={emEdicao?.id ?? 'novo'}
          glifo={emEdicao ? '✎' : '+'}
          titulo={emEdicao ? 'Editar local' : 'Novo local'}
          sub={
            emEdicao
              ? `${emEdicao.nome} · usado em séries e sessões`
              : 'Sala, cadeira, consultório ou domicílio.'
          }
          primario={emEdicao ? 'Salvar local' : 'Criar local'}
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => salvar(
            async () => {
              const cap = String(f.get('capacidade') ?? '')
              await salvarLocal({
                id: emEdicao?.id,
                nome: String(f.get('nome') ?? ''),
                capacidade: cap ? Number(cap) : null,
                ativo: emEdicao ? f.get('ativo') === 'on' : true,
              })
            },
            emEdicao ? 'Local atualizado' : 'Local criado',
            fechar,
          )}
        >
          <Campo rotulo="Nome" htmlFor="loc-nome">
            <input id="loc-nome" name="nome" required autoFocus
              defaultValue={emEdicao?.nome} className={entrada} />
          </Campo>
          <Campo rotulo="Capacidade" htmlFor="loc-cap"
            dica="quantas pessoas cabem aqui (opcional)">
            <input id="loc-cap" name="capacidade" type="number" min={1}
              defaultValue={emEdicao?.capacidade ?? undefined}
              className={`${entrada} w-28`} />
          </Campo>
          {emEdicao ? (
            <>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" name="ativo" defaultChecked={emEdicao.ativo} />
                Ativo
              </label>
              <Nota tom="atencao">
                Renomear muda o nome em todas as sessões, inclusive nas antigas.
              </Nota>
            </>
          ) : null}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </PainelConfig>
  )
}
