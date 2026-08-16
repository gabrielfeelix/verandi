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
import type { Rotulo } from '@/core/vocabulario/padrao'
import type { ServicoLinha, LocalLinha } from '@/server/config/consultas'
import { erroLegivel } from '@/core/erro-legivel'
import { CampoNumero } from '@/components/ui/campo-numero'

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
        setErro(erroLegivel(e))
      }
    })
  }
  return { pendente, erro, setErro, salvar }
}

export function SecaoServicos({
  servicos, rotulo, rotuloSerie, rotuloSessoes,
}: {
  servicos: ServicoLinha[]
  /*
   * "Serviço" estava escrito à mão aqui, do título ao aviso de sucesso. É
   * palavra de vocabulário como qualquer outra: quem chama de "modalidade"
   * abria a Configuração e lia o nome do sistema, não o do negócio dele.
   */
  rotulo: Rotulo
  rotuloSerie: Rotulo
  rotuloSessoes: string
}) {
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
      titulo={rotulo.plural}
      sub="Desativar não quebra histórico: sai das escolhas novas, continua no passado"
      acao={
        <Botao miudo onClick={() => setEdicao('novo')}>
          Cadastrar {rotulo.singular.toLowerCase()}
        </Botao>
      }
    >
      {servicos.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Nada cadastrado ainda. É o primeiro cadastro da conta: sem isso não
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
          /* "desativados" concordaria com a palavra do cliente. "fora de uso"
             não concorda com nada, e diz a mesma coisa. */
          rotulo={`${inativos.length} ${(inativos.length === 1
            ? rotulo.singular : rotulo.plural).toLowerCase()} fora de uso`}
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
          titulo={emEdicao
            ? `Editar ${rotulo.singular.toLowerCase()}`
            : `Cadastrar ${rotulo.singular.toLowerCase()}`}
          sub={
            emEdicao
              ? `${emEdicao.nome} · a mudança vale daqui para frente`
              : `Aparece nas escolhas de ${rotuloSerie.plural.toLowerCase()} e ${rotuloSessoes.toLowerCase()}.`
          }
          primario={emEdicao ? 'Salvar' : 'Criar'}
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
            emEdicao ? 'Cadastro salvo' : 'Cadastro criado',
            fechar,
          )}
        >
          <Campo rotulo="Nome" htmlFor="srv-nome" obrigatorio>
            <input id="srv-nome" name="nome" required autoFocus
              placeholder={`Ex.: ${rotulo.singular === 'Serviço' ? 'Pilates aparelho' : rotulo.singular}`}
              defaultValue={emEdicao?.nome} className={entrada} />
          </Campo>
          <Campo rotulo="Duração" htmlFor="srv-dur">
            <span className="block w-32">
              <CampoNumero id="srv-dur" nome="duracaoMin" min={1} max={600} sufixo="min"
                valorInicial={emEdicao?.duracaoMin ?? 50} required />
            </span>
          </Campo>
          <Campo
            rotulo="Capacidade padrão" htmlFor="srv-cap"
            dica={
              emEdicao
                ? 'vale para horários novos, os existentes mantêm a sua'
                : `cada ${rotuloSerie.singular.toLowerCase()} daqui nasce com esse número`
            }
          >
            <span className="block w-32">
              <CampoNumero id="srv-cap" nome="capacidade" min={1} max={999}
                valorInicial={emEdicao?.capacidadePadrao ?? 4} required />
            </span>
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
                ? `Em uso agora: ${emEdicao.emUso} em ${rotuloSerie.plural.toLowerCase()}.`
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
  locais, rotulo, rotuloSeries, rotuloSessoes,
}: {
  locais: LocalLinha[]
  /** como a conta chama o lugar: "Sala", "Cadeira", "Consultório" */
  rotulo: Rotulo
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
      titulo={rotulo.plural}
      sub="Sala, cadeira, consultório, domicílio. A capacidade é o limite físico, avisa, não bloqueia"
    >
      {locais.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Nada cadastrado ainda. A grade funciona sem isso: cadastre quando
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
              {/* com a palavra: um lápis e um × sozinhos não dizem se aquilo
                  edita, apaga ou fecha o cartão */}
              <BotaoLinha tom="marca" onClick={() => setEdicao(l)}>Editar</BotaoLinha>
              {/* desativar não acontece no clique: o protótipo desenha modal
                  destrutivo aqui, e é onde a pessoa fica sabendo quantas
                  séries e sessões dependem do que ela está tirando */}
              <BotaoLinha
                tom="perigo"
                aria-label={`Desativar ${l.nome}`}
                disabled={pendente}
                onClick={() => setADesativar(l)}
              >
                Desativar
              </BotaoLinha>
            </span>
          ))}

          <button
            type="button"
            onClick={() => setEdicao('novo')}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-padrao border border-dashed border-linha-tracejada px-3.5 text-[13px] whitespace-nowrap text-marca hover:bg-superficie-suave"
          >
            + Cadastrar {rotulo.singular.toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="px-5 pb-4">
          <Botao miudo tom="tracejado" onClick={() => setEdicao('novo')}>
            + Cadastrar {rotulo.singular.toLowerCase()}
          </Botao>
        </div>
      )}

      {inativos.length > 0 ? (
        <Recolhivel
          rotulo={`${inativos.length} ${(inativos.length === 1
            ? rotulo.singular : rotulo.plural).toLowerCase()} fora de uso`}
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
          sub="Sai das escolhas novas e continua no que já aconteceu."
          primario="Desativar"
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
            'Cadastro desativado',
            () => setADesativar(null),
          )}
        >
          <ListaImpacto
            rotulo="Hoje aparece em"
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
            apontando para cá, e o nome para de aparecer nas escolhas novas.
            Para tirar de vez, troque o lugar em cada um antes.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}

      {edicao ? (
        <ModalFormulario
          aberto
          key={emEdicao?.id ?? 'novo'}
          glifo={emEdicao ? '✎' : '+'}
          titulo={emEdicao
            ? `Editar ${rotulo.singular.toLowerCase()}`
            : `Cadastrar ${rotulo.singular.toLowerCase()}`}
          sub={
            emEdicao
              ? `${emEdicao.nome} · aparece em ${rotuloSeries.toLowerCase()} e ${rotuloSessoes.toLowerCase()}`
              : 'Sala, cadeira, consultório ou domicílio.'
          }
          primario={emEdicao ? 'Salvar' : 'Criar'}
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
            emEdicao ? 'Cadastro salvo' : 'Cadastro criado',
            fechar,
          )}
        >
          <Campo rotulo="Nome" htmlFor="loc-nome" obrigatorio>
            <input id="loc-nome" name="nome" required autoFocus placeholder="Ex.: Sala 1"
              defaultValue={emEdicao?.nome} className={entrada} />
          </Campo>
          <Campo rotulo="Capacidade" htmlFor="loc-cap"
            dica="quantas pessoas cabem aqui (opcional)">
            <span className="block w-32">
              <CampoNumero id="loc-cap" nome="capacidade" min={1} max={999}
                valorInicial={emEdicao?.capacidade ?? ''} />
            </span>
          </Campo>
          {emEdicao ? (
            <>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" name="ativo" defaultChecked={emEdicao.ativo} />
                Ativo
              </label>
              <Nota tom="atencao">
                Renomear muda o nome em {rotuloSessoes.toLowerCase()} antigas
                também, não só nas novas.
              </Nota>
            </>
          ) : null}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </PainelConfig>
  )
}
