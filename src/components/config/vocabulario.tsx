'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Campo, Cartao, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { salvarVocabulario } from '@/server/config/acoes'
import type { ChaveVocabulario } from '@/core/vocabulario/padrao'

type Item = {
  chave: ChaveVocabulario
  singular: string
  plural: string
  padrao: { singular: string; plural: string }
  explica: string
}

/**
 * A seção que carrega a promessa do produto: é aqui que a Verandi deixa de ser
 * genérica e vira "o sistema do estúdio".
 *
 * Mostra o efeito **antes de salvar** — a pessoa escreve como o negócio dela
 * chama quem é atendido e vê, ali, onde isso vai aparecer. Sem a prévia, é um
 * formulário de sete campos que ninguém entende para que serve.
 */
export function SecaoVocabulario({ itens }: { itens: Item[] }) {
  const [valores, setValores] = useState(itens)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function muda(chave: ChaveVocabulario, campo: 'singular' | 'plural', v: string) {
    setValores(valores.map((i) => (i.chave === chave ? { ...i, [campo]: v } : i)))
  }

  const de = (c: ChaveVocabulario) => valores.find((i) => i.chave === c)!

  return (
    <Cartao titulo="Vocabulário">
      <div className="flex flex-col gap-5">
        <p className="text-[12.5px] text-tinta-media">
          Como este negócio chama cada coisa. Muda o texto de todas as telas —
          e só o texto: nada nos dados é reescrito.
        </p>

        <div className="flex flex-col gap-4">
          {valores.map((i) => (
            <div key={i.chave} className="flex flex-wrap items-start gap-3">
              <div className="w-full sm:w-40">
                <span className="text-[12.5px] font-medium">{i.padrao.singular}</span>
                <p className="text-[11.5px] text-tinta-media">{i.explica}</p>
              </div>
              <Campo rotulo="Singular" htmlFor={`v-${i.chave}-s`}>
                <input
                  id={`v-${i.chave}-s`} className={entrada} value={i.singular}
                  onChange={(e) => muda(i.chave, 'singular', e.target.value)}
                />
              </Campo>
              <Campo rotulo="Plural" htmlFor={`v-${i.chave}-p`}>
                <input
                  id={`v-${i.chave}-p`} className={entrada} value={i.plural}
                  onChange={(e) => muda(i.chave, 'plural', e.target.value)}
                />
              </Campo>
            </div>
          ))}
        </div>

        {/* A prévia é o que faz a seção fazer sentido antes de salvar */}
        <div className="flex flex-col gap-2 rounded-[--radius-padrao] bg-superficie-suave p-3">
          <span className="text-[12.5px] font-medium">Vai aparecer assim</span>
          <ul className="flex flex-col gap-1 text-[12.5px] text-tinta-media">
            <li>
              Menu: <strong className="text-tinta">{de('pessoa').plural}</strong>
            </li>
            <li>
              Tela de {de('sessao').singular.toLowerCase()}:{' '}
              <strong className="text-tinta">
                {de('pessoa').plural} nesta {de('sessao').singular.toLowerCase()} · 3/4
              </strong>
            </li>
            <li>
              Botão de encaixe:{' '}
              <strong className="text-tinta">
                Encaixar {de('pessoa').singular.toLowerCase()}
              </strong>
            </li>
            <li>
              Grade fixa:{' '}
              <strong className="text-tinta">
                Criar {de('serie').singular.toLowerCase()}
              </strong>
            </li>
          </ul>
        </div>

        {erro ? <Nota tom="alerta">{erro}</Nota> : null}

        <div>
          <Botao
            disabled={pendente}
            onClick={() => iniciar(async () => {
              setErro(null)
              try {
                await salvarVocabulario(valores.map((i) => ({
                  chave: i.chave, singular: i.singular, plural: i.plural,
                })))
                avisar({ texto: 'Vocabulário atualizado em todas as telas' })
                router.refresh()
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'não deu para salvar')
              }
            })}
          >
            Salvar vocabulário
          </Botao>
        </div>
      </div>
    </Cartao>
  )
}
