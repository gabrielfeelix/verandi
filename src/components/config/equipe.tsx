'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Chip, Nota, Rotulo, entrada } from '@/components/ui/pecas'
import { BotaoLinha, LinhaConfig, PainelConfig } from './casca'
import { useAviso } from '@/components/ui/desfazer'
import { CORES_PROFISSIONAL } from '@/components/ui/tintas'
import { salvarProfissional, removerFoto } from '@/server/config/acoes'
import type { ProfissionalLinha } from '@/server/config/equipe'

type ServicoOpcao = { id: string; nome: string }

/**
 * A equipe.
 *
 * Profissional **existe sem usuário**: um nome na grade não precisa de acesso
 * ao sistema. Dar login é outro ato, e ele mora no convite — por isso aqui só
 * se mostra quem já tem.
 */
export function SecaoEquipe({
  equipe, servicos, rotuloProfissional, rotuloPlural,
}: {
  equipe: ProfissionalLinha[]
  servicos: ServicoOpcao[]
  rotuloProfissional: string
  /** o título é o plural da conta: "Profissionais", "Professores", "Doutores" */
  rotuloPlural: string
}) {
  const [aberto, setAberto] = useState<string | 'novo' | null>(null)
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
        setErro(e instanceof Error ? e.message : 'não deu para salvar')
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
  function desativar(p: ProfissionalLinha) {
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
          Novo {rotuloProfissional.toLowerCase()}
        </Botao>
      }
    >
      {equipe.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Ninguém cadastrado ainda. Horário fixo funciona sem{' '}
          {rotuloProfissional.toLowerCase()} definido, mas a grade fica mais
          clara com nome e cor.
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
                  <BotaoLinha
                    title={`Desativar ${p.nome}`}
                    aria-label={`Desativar ${p.nome}`}
                    disabled={pendente}
                    onClick={() => desativar(p)}
                    className="px-0"
                  >
                    <span aria-hidden className="block w-8 text-center">×</span>
                  </BotaoLinha>
                ) : (
                  <span className="rounded-peca bg-neutro-fundo px-2.5 py-[5px] text-[11.5px] font-medium text-tinta-media">
                    Desativado
                  </span>
                )}
              </span>
            </LinhaConfig>
      ))}

      {aberto ? (
        <ModalFormulario
          aberto
          key={aberto}
          glifo={emEdicao ? '✎' : '+'}
          titulo={
            emEdicao
              ? `Editar ${rotuloProfissional.toLowerCase()}`
              : `Novo ${rotuloProfissional.toLowerCase()}`
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
            emEdicao ? 'Profissional atualizado' : 'Profissional criado',
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

      <div className="flex flex-wrap items-start gap-3">
        <Campo rotulo="Nome" htmlFor="pf-nome" dica="como aparece na grade">
          <input id="pf-nome" name="nome" required className={entrada}
            defaultValue={profissional?.nome} />
        </Campo>
        <Campo rotulo="E-mail" htmlFor="pf-email" dica="opcional">
          <input id="pf-email" name="email" type="email" className={entrada}
            defaultValue={profissional?.email ?? ''} />
        </Campo>
        <Campo rotulo="Telefone" htmlFor="pf-tel" dica="opcional">
          <input id="pf-tel" name="telefone" className={entrada}
            defaultValue={profissional?.telefone ?? ''} />
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

      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Foto" htmlFor="pf-foto" dica="JPEG, PNG ou WEBP, até 2 MB">
          <input id="pf-foto" name="foto" type="file"
            accept="image/jpeg,image/png,image/webp" className="text-[12.5px]" />
        </Campo>
        {profissional?.fotoUrl && aoRemoverFoto ? (
          <>
            <Avatar nome={profissional.nome} foto={profissional.fotoUrl} tamanho={40} decorativo />
            <Botao type="button" tom="fantasma" miudo onClick={aoRemoverFoto}>
              Remover foto
            </Botao>
          </>
        ) : null}
      </div>

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
