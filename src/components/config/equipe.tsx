'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Avatar, Campo, Cartao, Chip, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
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
  equipe, servicos, rotuloProfissional,
}: {
  equipe: ProfissionalLinha[]
  servicos: ServicoOpcao[]
  rotuloProfissional: string
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

  return (
    <Cartao
      titulo="Equipe"
      acao={
        <Botao miudo onClick={() => setAberto('novo')}>
          Novo {rotuloProfissional.toLowerCase()}
        </Botao>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-tinta-media">
          Quem atende. A cor identifica a pessoa na grade da semana.
        </p>

        {aberto === 'novo' ? (
          <Formulario
            servicos={servicos}
            pendente={pendente}
            erro={erro}
            aoCancelar={() => setAberto(null)}
            aoSalvar={(f) => comErro(
              async () => { await salvarProfissional(f) },
              'Profissional criado',
              () => setAberto(null),
            )}
          />
        ) : null}

        {equipe.length === 0 && aberto !== 'novo' ? (
          <Nota tom="neutro">
            Ninguém cadastrado ainda. Horário fixo funciona sem profissional
            definido, mas a grade fica mais clara com nome e cor.
          </Nota>
        ) : null}

        <ul className="flex flex-col gap-2">
          {equipe.map((p) => (
            <li key={p.id} className="rounded-[--radius-padrao] border border-linha-suave p-3">
              {aberto === p.id ? (
                <Formulario
                  profissional={p}
                  servicos={servicos}
                  pendente={pendente}
                  erro={erro}
                  aoCancelar={() => setAberto(null)}
                  aoSalvar={(f) => comErro(
                    async () => { await salvarProfissional(f) },
                    'Profissional atualizado',
                    () => setAberto(null),
                  )}
                  aoRemoverFoto={() => comErro(
                    () => removerFoto(p.id),
                    'Foto removida',
                  )}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Avatar
                    nome={p.nome} foto={p.fotoUrl} tamanho={40}
                    anel={p.cor ?? undefined} decorativo
                  />
                  <span className="font-medium">{p.nome}</span>
                  {p.email ? (
                    <span className="text-[12.5px] text-tinta-media">{p.email}</span>
                  ) : null}
                  {p.temLogin ? (
                    <Etiqueta tinta="positivo">tem login</Etiqueta>
                  ) : (
                    <Etiqueta tinta="neutro">só na grade</Etiqueta>
                  )}
                  {p.servicoIds.length > 0 ? (
                    <Etiqueta tinta="info">{p.servicoIds.length} serviço(s)</Etiqueta>
                  ) : null}
                  {p.emUso > 0 ? <Etiqueta tinta="neutro">{p.emUso} na grade</Etiqueta> : null}
                  {!p.ativo ? <Etiqueta tinta="neutro">inativo</Etiqueta> : null}
                  <Botao tom="texto" miudo className="ml-auto" onClick={() => setAberto(p.id)}>
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
  profissional, servicos, aoSalvar, aoCancelar, aoRemoverFoto, pendente, erro,
}: {
  profissional?: ProfissionalLinha
  servicos: ServicoOpcao[]
  aoSalvar: (f: FormData) => void
  aoCancelar: () => void
  aoRemoverFoto?: () => void
  pendente: boolean
  erro: string | null
}) {
  const [cor, setCor] = useState(profissional?.cor ?? CORES_PROFISSIONAL[0].valor)
  const [escolhidos, setEscolhidos] = useState<string[]>(profissional?.servicoIds ?? [])

  return (
    <form
      action={aoSalvar}
      className="flex flex-col gap-4 rounded-[--radius-padrao] bg-superficie-suave p-3"
    >
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
        <span className="text-[12.5px] font-medium">Cor na grade</span>
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
        <span className="text-[12.5px] font-medium">Serviços que atende</span>
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
            <Botao type="button" tom="texto" miudo onClick={aoRemoverFoto}>
              Remover foto
            </Botao>
          </>
        ) : null}
        <label className="flex items-center gap-2 pb-3 text-[12.5px]">
          <input type="checkbox" name="ativo" defaultChecked={profissional?.ativo ?? true} />
          Ativo
        </label>
      </div>

      <Nota tom="atencao">
        Desativar tira das escolhas novas e mantém no passado: a sessão de ontem
        continua com o nome de quem atendeu.
      </Nota>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <div className="flex gap-2">
        <Botao type="submit" miudo disabled={pendente}>Salvar</Botao>
        <Botao type="button" tom="texto" miudo onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  )
}
