'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { cartao, Nota } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { salvarVocabulario } from '@/server/config/acoes'
import type { ChaveVocabulario } from '@/core/vocabulario/padrao'
import { erroLegivel } from '@/core/erro-legivel'

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

  const sujo = valores.some(
    (i) =>
      i.singular !== itens.find((x) => x.chave === i.chave)!.singular ||
      i.plural !== itens.find((x) => x.chave === i.chave)!.plural,
  )

  return (
    <section className={`${cartao} px-5 py-4.5`}>
      <h2 className="font-titulo text-[19px] font-semibold">Vocabulário</h2>
      <p className="pt-1.5 pb-4 text-[14px] text-tinta-media">
        Escolha os nomes que combinam com o seu negócio. Nada é reescrito nos
        dados: muda só o texto que aparece nas telas.
      </p>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {valores.map((i) => (
          <div key={i.chave} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
              {i.padrao.singular}
            </span>
            {/* singular e plural na mesma caixa: são a mesma decisão, e separar
                em dois campos faz parecer que dá para escolher só um */}
            <div className="flex items-center gap-2 rounded-padrao border border-linha-suave bg-superficie-suave px-3 py-1 focus-within:border-marca focus-within:bg-superficie">
              <input
                aria-label={`${i.explica}, no singular`}
                className="min-h-10 min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
                value={i.singular}
                onChange={(e) => muda(i.chave, 'singular', e.target.value)}
              />
              <input
                aria-label={`${i.explica}, no plural`}
                className="min-h-10 w-20 min-w-0 bg-transparent text-right font-mono text-[12px] text-tinta-media outline-none"
                value={i.plural}
                onChange={(e) => muda(i.chave, 'plural', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* A prévia é o que faz a seção fazer sentido antes de salvar */}
      <div className="mt-4 rounded-grande border border-positivo-linha bg-positivo-superficie p-4">
        <p className="pb-2.5 text-[12px] font-semibold tracking-[.1em] text-[#3E7A6C] uppercase">
          Onde isso aparece, antes de salvar
        </p>
        <ul className="flex flex-col gap-1.5">
          {[
            ['Menu', de('pessoa').plural],
            [
              `Tela de ${de('sessao').singular.toLowerCase()}`,
              `${de('pessoa').plural} nesta ${de('sessao').singular.toLowerCase()} · 3/4`,
            ],
            ['Botão de encaixe', `Encaixar ${de('pessoa').singular.toLowerCase()}`],
            ['Grade fixa', `Criar ${de('serie').singular.toLowerCase()}`],
          ].map(([onde, texto]) => (
            <li
              key={onde}
              className="flex items-center gap-2.5 rounded-padrao border border-positivo-fundo bg-superficie px-3 py-2.5"
            >
              <span className="w-26 shrink-0 text-[12px] text-tinta-media">{onde}</span>
              <span className="flex-1 text-[14.5px]">{texto}</span>
            </li>
          ))}
        </ul>
      </div>

      {erro ? <div className="pt-3"><Nota tom="alerta">{erro}</Nota></div> : null}

      <div className="flex gap-2.5 pt-4">
        <Botao
          disabled={pendente}
          className="min-h-11 rounded-padrao px-4.5 text-[14.5px] font-semibold"
          onClick={() => iniciar(async () => {
            setErro(null)
            try {
              await salvarVocabulario(valores.map((i) => ({
                chave: i.chave, singular: i.singular, plural: i.plural,
              })))
              avisar({ texto: 'Vocabulário atualizado em todas as telas' })
              router.refresh()
            } catch (e) {
              setErro(erroLegivel(e))
            }
          })}
        >
          Salvar vocabulário
        </Botao>
        <Botao
          tom="secundario"
          disabled={pendente || !sujo}
          className="min-h-11 rounded-padrao px-4.5 text-[14.5px]"
          onClick={() => { setValores(itens); setErro(null) }}
        >
          Descartar
        </Botao>
      </div>
    </section>
  )
}
