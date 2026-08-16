'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import {
  Avatar, Campo, Chip, ListaImpacto, Nota, Rotulo, entrada,
} from '@/components/ui/pecas'
import { BotaoLinha, LinhaConfig, PainelConfig } from './casca'
import { useAviso } from '@/components/ui/desfazer'
import { CORES_PROFISSIONAL } from '@/components/ui/tintas'
import { salvarProfissional, removerFoto } from '@/server/config/acoes'
import type { ProfissionalLinha } from '@/server/config/equipe'
import { CampoFoto } from '@/components/ui/campo-foto'
import { erroLegivel } from '@/core/erro-legivel'
import { CampoTelefone } from '@/components/ui/campo-telefone'

type ServicoOpcao = { id: string; nome: string }

/**
 * A equipe.
 *
 * Profissional **existe sem usuário**: um nome na grade não precisa de acesso
 * ao sistema. Dar login é outro ato, e ele mora no convite — por isso aqui só
 * se mostra quem já tem.
 */
export function SecaoEquipe({
  equipe, servicos, rotuloProfissional, rotuloPlural, rotuloSeries, rotuloSessoes,
}: {
  equipe: ProfissionalLinha[]
  servicos: ServicoOpcao[]
  rotuloProfissional: string
  /** o título é o plural da conta: "Profissionais", "Professores", "Doutores" */
  rotuloPlural: string
  /** plurais do vocabulário, para a lista de impacto da confirmação */
  rotuloSeries: string
  rotuloSessoes: string
}) {
  const [aberto, setAberto] = useState<string | 'novo' | null>(null)
  /** quem está prestes a ser desativado; `null` sem confirmação aberta */
  const [aDesativar, setADesativar] = useState<ProfissionalLinha | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function comErro(fn: () => Promise<void>, texto: string, aoFim?: () => void) {
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

  /**
   * Desativar manda o cadastro inteiro de volta, com `ativo` de fora.
   *
   * Mandar só o `id` apagaria e-mail, cor e os serviços que a pessoa atende —
   * `salvarProfissional` reescreve a linha com o que chega, e o que não chega
   * some.
   */
  function desativar(p: ProfissionalLinha, aoFim?: () => void) {
    const f = new FormData()
    f.set('id', p.id)
    f.set('nome', p.nome)
    f.set('email', p.email ?? '')
    f.set('telefone', p.telefone ?? '')
    f.set('cor', p.cor ?? '')
    p.servicoIds.forEach((id) => f.append('servicos', id))
    comErro(
      async () => { await salvarProfissional(f) },
      `${p.nome} desativado, o histórico continua com o nome dele`,
      aoFim,
    )
  }

  const nomeDoServico = new Map(servicos.map((s) => [s.id, s.nome]))
  /** quem está em edição; `null` com o modal aberto quer dizer cadastro novo */
  const emEdicao = aberto && aberto !== 'novo'
    ? equipe.find((p) => p.id === aberto) ?? null
    : null

  return (
    <PainelConfig
      titulo={rotuloPlural}
      sub="Existe sem usuário: um nome na grade não precisa de acesso ao sistema"
      acao={
        <Botao miudo onClick={() => setAberto('novo')}>
          Cadastrar {rotuloProfissional.toLowerCase()}
        </Botao>
      }
    >
      {equipe.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Ninguém cadastrado ainda. A grade funciona sem isso, e fica mais
          fácil de ler com nome e cor.
        </p>
      ) : null}

      {equipe.map((p) => (
        <LinhaConfig
          key={p.id}
              apagado={!p.ativo}
              antes={
                <Avatar
                  nome={p.nome} foto={p.fotoUrl} tamanho={40}
                  anel={p.cor ?? undefined} decorativo
                />
              }
              nome={p.nome}
              detalhe={
                <span className="flex flex-col">
                  {/* vazio explicado, nunca vazio mudo */}
                  <span>{p.email ?? 'sem e-mail cadastrado'}</span>
                  <span className="text-[11.5px] text-tinta-media">
                    {p.servicoIds.length === 0
                      ? 'atende qualquer serviço'
                      : `atende ${p.servicoIds
                          .map((id) => nomeDoServico.get(id))
                          .filter(Boolean)
                          .join(', ')}`}
                    {p.emUso > 0 ? ` · ${p.emUso} na grade` : ''}
                  </span>
                </span>
              }
            >
              <span
                className={`rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${
                  p.temLogin
                    ? 'bg-positivo-fundo text-positivo'
                    : 'bg-neutro-fundo text-tinta-media'
                }`}
              >
                {p.temLogin ? 'Tem login' : 'Sem usuário'}
              </span>
              <span className="flex gap-1.5">
                <BotaoLinha onClick={() => setAberto(p.id)}>Editar</BotaoLinha>
                {p.ativo ? (
                  /* com a palavra: um × sozinho pode ser desativar, apagar ou
                     fechar, e quem descobre parando o mouse em cima descobre
                     tarde — no celular, nunca */
                  <BotaoLinha
                    tom="perigo"
                    aria-label={`Desativar ${p.nome}`}
                    disabled={pendente}
                    onClick={() => setADesativar(p)}
                  >
                    Desativar
                  </BotaoLinha>
                ) : (
                  <span className="rounded-peca bg-alerta-fundo px-2.5 py-[5px] text-[11.5px] font-medium text-alerta">
                    Desativado
                  </span>
                )}
              </span>
            </LinhaConfig>
      ))}

      {aDesativar ? (
        <Modal
          aberto
          perigo
          largura="lista"
          titulo={`Desativar ${rotuloProfissional.toLowerCase()}?`}
          sub={`${aDesativar.nome} sai das escolhas novas a partir de hoje.`}
          primario="Desativar"
          pendente={pendente}
          aoFechar={() => setADesativar(null)}
          aoConfirmar={() => desativar(aDesativar, () => setADesativar(null))}
        >
          <ListaImpacto
            rotulo="O que acontece"
            /* nem artigo nem adjetivo colado na palavra do cliente: onde o
               plural da conta é feminino, "horários fixos ativos" sai com o
               adjetivo no gênero errado. O que qualifica vai para a coluna da
               direita, onde a frase não precisa concordar com nada. */
            itens={[
              {
                titulo: `${rotuloSessoes} que já aconteceram`,
                meta: 'mantêm o nome',
              },
              {
                titulo: `${rotuloSeries} na grade`,
                meta: `${aDesativar.emUso}, ficam sem quem atenda`,
              },
              {
                titulo: `${rotuloSessoes} que já estão na agenda`,
                meta: `${aDesativar.sessoesFuturas}, mantêm o nome`,
              },
              ...(aDesativar.temLogin
                ? [{ titulo: 'Login', meta: 'continua valendo' }]
                : []),
            ]}
          />
          <Nota tom="alerta">
            Desativar não apaga histórico. Para tirar da grade sem perder nada,
            é isto que você quer. Quem tem login continua entrando: acesso se
            tira em Usuários, que é outra pergunta.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}

      {aberto ? (
        <ModalFormulario
          aberto
          key={aberto}
          glifo={emEdicao ? '✎' : '+'}
          titulo={
            emEdicao
              ? `Editar ${rotuloProfissional.toLowerCase()}`
              : `Cadastrar ${rotuloProfissional.toLowerCase()}`
          }
          sub={
            emEdicao
              ? `${emEdicao.nome} · aparece na grade e na chamada`
              : 'Pode existir só como nome na grade, sem acesso ao sistema.'
          }
          primario={emEdicao ? 'Salvar' : 'Criar'}
          pendente={pendente}
          aoFechar={() => setAberto(null)}
          aoEnviar={(f) => comErro(
            async () => { await salvarProfissional(f) },
            emEdicao ? 'Cadastro salvo' : 'Cadastro criado',
            () => setAberto(null),
          )}
        >
          <Formulario
            profissional={emEdicao ?? undefined}
            servicos={servicos}
            erro={erro}
            aoRemoverFoto={emEdicao ? () => comErro(
              () => removerFoto(emEdicao.id),
              'Foto removida',
            ) : undefined}
          />
        </ModalFormulario>
      ) : null}
    </PainelConfig>
  )
}

/**
 * Os campos do profissional. Sem `<form>` próprio: quem envia é o
 * `<ModalFormulario>` em volta, e o botão dele é o `submit`.
 */
function Formulario({
  profissional, servicos, aoRemoverFoto, erro,
}: {
  profissional?: ProfissionalLinha
  servicos: ServicoOpcao[]
  aoRemoverFoto?: () => void
  erro: string | null
}) {
  const [cor, setCor] = useState(profissional?.cor ?? CORES_PROFISSIONAL[0].valor)
  const [escolhidos, setEscolhidos] = useState<string[]>(profissional?.servicoIds ?? [])

  return (
    <>
      {profissional ? <input type="hidden" name="id" value={profissional.id} /> : null}
      <input type="hidden" name="cor" value={cor} />
      {escolhidos.map((s) => (
        <input key={s} type="hidden" name="servicos" value={s} />
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" htmlFor="pf-nome" dica="como aparece na grade" obrigatorio>
          <input id="pf-nome" name="nome" required className={entrada}
            placeholder="Ex.: Carol" defaultValue={profissional?.nome} />
        </Campo>
        <Campo rotulo="E-mail" htmlFor="pf-email" dica="opcional">
          <input id="pf-email" name="email" type="email" className={entrada}
            placeholder="carol@estudio.com.br"
            defaultValue={profissional?.email ?? ''} />
        </Campo>
        <Campo rotulo="Telefone" htmlFor="pf-tel" dica="opcional, com DDD">
          {/* aceitava "adqeewqeqwe": telefone é número, e o DDD é o que faz
              ele discar depois */}
          <CampoTelefone id="pf-tel" valorInicial={profissional?.telefone ?? ''} />
        </Campo>
      </div>

      <div className="flex flex-col gap-2">
        <Rotulo>Cor na grade</Rotulo>
        <div className="flex flex-wrap gap-2">
          {CORES_PROFISSIONAL.map((c) => (
            <Chip key={c.valor} ativo={cor === c.valor} ponto={c.valor}
              onClick={() => setCor(c.valor)}>
              {c.nome}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rotulo>Serviços que atende</Rotulo>
        <p className="text-[11.5px] text-tinta-media">
          Sem nenhum marcado, atende todos.
        </p>
        <div className="flex flex-wrap gap-2">
          {servicos.map((s) => (
            <Chip
              key={s.id}
              ativo={escolhidos.includes(s.id)}
              onClick={() => setEscolhidos(
                escolhidos.includes(s.id)
                  ? escolhidos.filter((x) => x !== s.id)
                  : [...escolhidos, s.id],
              )}
            >
              {s.nome}
            </Chip>
          ))}
        </div>
      </div>

      <Campo rotulo="Foto">
        <CampoFoto
          atual={profissional?.fotoUrl}
          alt={profissional?.nome ?? 'foto de quem atende'}
          aoRemover={profissional?.fotoUrl && aoRemoverFoto ? aoRemoverFoto : undefined}
        />
      </Campo>

      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" name="ativo" defaultChecked={profissional?.ativo ?? true} />
        Ativo
      </label>

      <Nota tom="atencao">
        Desativar tira das escolhas novas e mantém no passado: a sessão de ontem
        continua com o nome de quem atendeu.
      </Nota>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}
    </>
  )
}
