'use client'

import { useState, useTransition } from 'react'
import { ModalFormulario } from '../ui/modal'
import { Campo, Nota, entrada } from '../ui/pecas'
import { CampoData } from '../ui/campo-data'
import { CampoFoto } from '../ui/campo-foto'
import { Escolha } from '../ui/escolha'
import { Botao } from '../ui/botao'
import type { PosicaoNaTela } from './tipos'

/**
 * Registrar a visita e as fotos dela, num modal só.
 *
 * Quem usa isto é quem acabou de fotografar, com a pessoa ainda na sala. Pedir
 * para criar a avaliação numa tela, salvar, e só então subir foto por foto em
 * outra é garantir avaliação vazia no banco toda vez que alguém for chamado no
 * meio. Aqui é um envio: a visita nasce e as fotos sobem em seguida.
 *
 * As posições aparecem todas, e nenhuma é obrigatória. Ninguém fotografa as
 * seis toda vez, e obrigar transformaria "faltou a de costas" em "não consigo
 * salvar".
 */
export function NovaAvaliacao({
  pessoaId, pessoaNome, posicoes, profissionais, aoRegistrar, aoAdicionarPosicao,
}: {
  pessoaId: string
  pessoaNome: string
  posicoes: PosicaoNaTela[]
  profissionais: Array<{ id: string; nome: string }>
  /**
   * Cria a visita e sobe as fotos. Recebe o `FormData` inteiro porque é dele
   * que saem os arquivos, um por posição, com o nome `foto-<posicaoId>`.
   */
  aoRegistrar: (dados: FormData) => Promise<void>
  aoAdicionarPosicao: (nome: string) => Promise<void>
}) {
  const [aberto, setAberto] = useState(false)
  const [novaPosicao, setNovaPosicao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()

  const hoje = new Date().toLocaleDateString('en-CA')

  function enviar(dados: FormData) {
    // o `FormData` é lido agora e guardado: o React reseta o formulário assim
    // que a ação termina, e reler num segundo passo lê um formulário vazio
    dados.set('pessoaId', pessoaId)
    setErro(null)
    comecar(async () => {
      try {
        await aoRegistrar(dados)
        setAberto(false)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível registrar a avaliação.')
      }
    })
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>Nova avaliação</Botao>

      <ModalFormulario
        aberto={aberto}
        glifo="+"
        tom="positivo"
        titulo="Nova avaliação"
        sub={pessoaNome}
        primario="Registrar"
        pendente={pendente}
        largura="lista"
        aoEnviar={enviar}
        aoFechar={() => setAberto(false)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Campo rotulo="Data da avaliação" htmlFor="data-avaliacao" obrigatorio>
            <CampoData nome="data" id="data-avaliacao" valorInicial={hoje} limpavel={false} />
          </Campo>

          <Campo rotulo="Quem avaliou" htmlFor="profissional-avaliacao">
            <Escolha
              nome="profissionalId"
              id="profissional-avaliacao"
              placeholder="Sem profissional"
              opcoes={profissionais.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            />
          </Campo>
        </div>

        <Campo rotulo="Observação da visita" htmlFor="observacao-avaliacao">
          <textarea
            id="observacao-avaliacao"
            name="observacao"
            rows={2}
            placeholder="Ex.: primeira avaliação depois da alta da fisioterapia"
            className={`${entrada} resize-y py-3`}
          />
        </Campo>

        <div className="flex flex-col gap-3">
          <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
            As fotos
          </span>

          <div className="grid gap-4 md:grid-cols-2">
            {posicoes.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">{p.nome}</span>
                <CampoFoto
                  nome={`foto-${p.id}`}
                  alt={`Foto de ${p.nome.toLowerCase()}`}
                  dica="JPEG, PNG ou WEBP, até 5 MB"
                />
                <input
                  name={`observacao-${p.id}`}
                  placeholder="Ex.: ombro direito 2 cm acima"
                  className={`${entrada} min-h-11 text-[13px]`}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-media border border-dashed border-linha-tracejada p-3">
            <Campo rotulo="Faltou uma posição?" htmlFor="nova-posicao">
              <input
                id="nova-posicao"
                value={novaPosicao}
                onChange={(e) => setNovaPosicao(e.target.value)}
                placeholder="Ex.: Perfil direito"
                className={`${entrada} min-h-11`}
              />
            </Campo>
            <Botao
              type="button"
              tom="secundario"
              miudo
              disabled={!novaPosicao.trim() || pendente}
              onClick={() => comecar(async () => {
                await aoAdicionarPosicao(novaPosicao.trim())
                setNovaPosicao('')
              })}
            >
              Acrescentar
            </Botao>
          </div>
        </div>

        {erro ? <Nota tom="alerta">{erro}</Nota> : null}

        <Nota tom="neutro">
          As fotos ficam visíveis para quem atende e para quem responde pelo
          negócio. A recepção não vê. Se a pessoa pedir exclusão dos dados dela,
          as imagens saem junto.
        </Nota>
      </ModalFormulario>
    </>
  )
}
