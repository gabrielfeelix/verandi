'use client'

import { useState } from 'react'
import { Visor } from './visor'
import { cartao, Chip } from '../ui/pecas'
import { Escolha } from '../ui/escolha'
import { dataCurta } from '@/core/agenda/datas'
import { parPadrao } from '@/core/avaliacao/comparar'
import type { AvaliacaoNaTela, PosicaoNaTela } from './tipos'

/**
 * Duas datas da mesma posição, lado a lado.
 *
 * É o pedido inteiro do cliente numa tela: "melhorou" não convence ninguém, e
 * a mesma foto em duas datas convence em três segundos. Quem escolhe o par
 * inicial é `parPadrao`, que abre na primeira contra a última, porque é onde a
 * diferença aparece.
 *
 * A linha de prumo é um traço vertical no meio, e não uma grade inteira: o que
 * se confere numa foto de frente é o desvio em relação ao eixo, e grade cheia
 * de linhas some com a pessoa que está sendo olhada.
 */
export function Comparador({
  posicoes, avaliacoes,
}: {
  posicoes: PosicaoNaTela[]
  avaliacoes: AvaliacaoNaTela[]
}) {
  const [posicaoId, setPosicaoId] = useState(posicoes[0]?.id ?? '')
  const par = parPadrao(avaliacoes.map((a) => a.data))
  const [antes, setAntes] = useState(par?.antes ?? '')
  const [depois, setDepois] = useState(par?.depois ?? '')
  const [prumo, setPrumo] = useState(true)
  /*
   * A foto grande a partir daqui.
   *
   * O documento do cliente termina o item 9 pedindo que as imagens sejam
   * grandes e permitam ampliar, e o visor existe desde o módulo 14. Só que ele
   * abria pela matriz, e a matriz é a leitura secundária: quem compara duas
   * datas lado a lado é quem mais precisa aproximar o olho, e clicar na foto
   * aqui não fazia nada.
   */
  const [ampliada, setAmpliada] = useState<string | null>(null)

  if (!par) {
    return (
      <section className={`${cartao} px-[18px] py-6`}>
        <p className="text-[13px] text-tinta-media">
          A comparação aparece a partir da segunda avaliação. Esta é a primeira,
          e ela já está guardada: não é falha de carregamento.
        </p>
      </section>
    )
  }

  const posicao = posicoes.find((p) => p.id === posicaoId)
  const fotoDe = (data: string) =>
    avaliacoes.find((a) => a.data === data)?.fotos.find((f) => f.posicaoId === posicaoId)

  /*
   * As setas do visor andam pelas datas que **têm foto desta posição**, e não
   * por todas as avaliações: parar numa tela vazia no meio da comparação é o
   * jeito mais rápido de alguém achar que a foto sumiu.
   */
  const comFoto = avaliacoes.filter((a) => fotoDe(a.data)).map((a) => a.data)

  const opcoes = avaliacoes.map((a) => ({
    valor: a.data,
    rotulo: dataCurta(a.data),
    detalhe: a.profissional ?? undefined,
  }))

  return (
    <section className={cartao}>
      <header className="flex flex-wrap items-center gap-2 border-b border-linha-fina px-[18px] py-3.5">
        <h2 className="mr-2 font-titulo text-[17px] font-semibold">Comparar</h2>
        {posicoes.map((p) => (
          <Chip key={p.id} ativo={p.id === posicaoId} onClick={() => setPosicaoId(p.id)}>
            {p.nome}
          </Chip>
        ))}
        {/* o `ml-auto` vai no invólucro: o `<Chip>` escreve o próprio
            `className` depois do spread, e o de fora sumiria calado */}
        <span className="ml-auto">
          <Chip ativo={prumo} onClick={() => setPrumo((v) => !v)}>
            Linha de prumo
          </Chip>
        </span>
      </header>

      <div className="grid gap-px bg-linha-fina md:grid-cols-2">
        <Lado
          rotulo="Antes"
          data={antes}
          opcoes={opcoes}
          aoTrocar={setAntes}
          avaliacoes={avaliacoes}
          posicaoId={posicaoId}
          posicoes={posicoes}
          prumo={prumo}
          aoAmpliar={() => setAmpliada(antes)}
        />
        <Lado
          rotulo="Depois"
          data={depois}
          opcoes={opcoes}
          aoTrocar={setDepois}
          aoAmpliar={() => setAmpliada(depois)}
          avaliacoes={avaliacoes}
          posicaoId={posicaoId}
          posicoes={posicoes}
          prumo={prumo}
        />
      </div>

      {/* uma instância para os dois lados: `ampliada` guarda qual data abriu, e
          as setas continuam andando pelas datas da mesma posição */}
      {ampliada && fotoDe(ampliada) ? (
        <Visor
          aberto
          posicao={posicao?.nome ?? ''}
          data={ampliada}
          url={fotoDe(ampliada)!.url}
          observacao={fotoDe(ampliada)!.observacao}
          temAnterior={comFoto.indexOf(ampliada) > 0}
          temProxima={comFoto.indexOf(ampliada) < comFoto.length - 1}
          aoAndar={(passo) => {
            const i = comFoto.indexOf(ampliada) + passo
            if (i >= 0 && i < comFoto.length) setAmpliada(comFoto[i])
          }}
          aoFechar={() => setAmpliada(null)}
        />
      ) : null}
    </section>
  )
}

function Lado({
  rotulo, data, opcoes, aoTrocar, avaliacoes, posicaoId, posicoes, prumo,
  aoAmpliar,
}: {
  rotulo: string
  data: string
  opcoes: Array<{ valor: string; rotulo: string; detalhe?: string }>
  aoTrocar: (v: string) => void
  avaliacoes: AvaliacaoNaTela[]
  posicaoId: string
  posicoes: PosicaoNaTela[]
  prumo: boolean
  aoAmpliar: () => void
}) {
  const avaliacao = avaliacoes.find((a) => a.data === data)
  const foto = avaliacao?.fotos.find((f) => f.posicaoId === posicaoId)
  const nome = posicoes.find((p) => p.id === posicaoId)?.nome ?? ''

  return (
    <div className="flex flex-col gap-3 bg-superficie px-[18px] py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
          {rotulo}
        </span>
        <Escolha
          nome={`avaliacao-${rotulo.toLowerCase()}`}
          opcoes={opcoes}
          valorInicial={data}
          aoTrocar={aoTrocar}
        />
      </div>

      <div className="relative flex h-[480px] items-center justify-center overflow-hidden rounded-grande border border-linha-suave bg-superficie-mais-suave">
        {foto ? (
          // um fragmento, e não a imagem solta: o ramo do ternário aceita uma
          // expressão só, e o comentário ao lado da imagem já são duas
          <>
            {/* `<img>` e não `next/image`: o endereço é assinado e expira, e o
                otimizador do Next guardaria uma imagem privada de saúde atrás
                de uma URL que não expira junto. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt={`${nome} em ${dataCurta(data)}`}
              className="size-full object-contain"
            />
            {/*
              * O botão cobre a foto inteira em vez de ser um ícone no canto:
              * o gesto que a pessoa faz para ver de perto é tocar na imagem, e
              * um alvo de 480px de altura não precisa ser descoberto.
              */}
            <button
              type="button"
              onClick={aoAmpliar}
              aria-label={`Ampliar ${nome.toLowerCase()} de ${dataCurta(data)}`}
              className="absolute inset-0 cursor-zoom-in"
            />
          </>
        ) : (
          <p className="max-w-[240px] px-4 text-center text-[12.5px] text-tinta-media">
            Nesta avaliação ninguém fotografou {nome.toLowerCase()}. Não é falha
            de carregamento.
          </p>
        )}

        {prumo && foto ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-menta"
          />
        ) : null}
      </div>

      {foto?.observacao ? (
        <p className="text-[12.5px] leading-relaxed text-tinta-media">{foto.observacao}</p>
      ) : null}
    </div>
  )
}
