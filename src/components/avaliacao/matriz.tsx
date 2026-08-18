'use client'

import { useState } from 'react'
import { cartao } from '../ui/pecas'
import { Icone } from '../ui/icones'
import { Visor } from './visor'
import { dataCurta } from '@/core/agenda/datas'
import type { AvaliacaoNaTela, PosicaoNaTela } from './tipos'

/**
 * A matriz: uma linha por posição, uma coluna por avaliação.
 *
 * É a leitura que a planilha do cliente já fazia no papel, e ela existe por um
 * motivo que a comparação de duas datas não resolve: o buraco. A visita em que
 * ninguém fotografou as costas precisa aparecer **vazia na coluna dela**, e não
 * sumir da linha, senão as colunas deixam de bater com as datas e a leitura
 * inteira mente.
 */
export function Matriz({
  posicoes, avaliacoes, aoAdicionar,
}: {
  posicoes: PosicaoNaTela[]
  /** da mais antiga para a mais nova, que é como se lê progresso */
  avaliacoes: AvaliacaoNaTela[]
  aoAdicionar?: (posicaoId: string, avaliacaoId: string) => void
}) {
  const [vendo, setVendo] = useState<{ posicaoId: string; passo: number } | null>(null)

  const posicaoAberta = posicoes.find((p) => p.id === vendo?.posicaoId)
  // só as visitas em que aquela posição tem foto, que são por onde as setas andam
  const comFoto = vendo
    ? avaliacoes.filter((a) => a.fotos.some((f) => f.posicaoId === vendo.posicaoId))
    : []
  const atual = vendo ? comFoto[vendo.passo] : undefined
  const fotoAtual = atual?.fotos.find((f) => f.posicaoId === vendo?.posicaoId)

  return (
    <section className={cartao}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linha-fina px-[18px] py-3.5">
        <h2 className="font-titulo text-[17px] font-semibold">
          {avaliacoes.length === 1 ? 'A avaliação' : `As ${avaliacoes.length} avaliações`}
        </h2>
        <span className="text-[12px] text-tinta-fraca">
          {posicoes.length} posições · clique na foto para ampliar
        </span>
      </header>

      <div className="overflow-x-auto px-[18px] py-3">
        <div
          className="grid min-w-max items-center gap-x-3"
          style={{
            gridTemplateColumns: `160px repeat(${avaliacoes.length}, 96px) 120px`,
          }}
        >
          <span className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">Posição</span>
          {avaliacoes.map((a) => (
            <span key={a.id} className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase font-mono">
              {dataCurta(a.data)}
            </span>
          ))}
          <span />

          {posicoes.map((p) => (
            <LinhaDaPosicao
              key={p.id}
              posicao={p}
              avaliacoes={avaliacoes}
              aoAbrir={(passo) => setVendo({ posicaoId: p.id, passo })}
              aoAdicionar={aoAdicionar}
            />
          ))}
        </div>
      </div>

      {vendo && posicaoAberta && atual && fotoAtual ? (
        <Visor
          aberto
          posicao={posicaoAberta.nome}
          data={atual.data}
          url={fotoAtual.url}
          observacao={fotoAtual.observacao}
          temAnterior={vendo.passo > 0}
          temProxima={vendo.passo < comFoto.length - 1}
          aoAndar={(passo) =>
            setVendo((v) => (v ? { ...v, passo: v.passo + passo } : v))}
          aoFechar={() => setVendo(null)}
        />
      ) : null}
    </section>
  )
}

function LinhaDaPosicao({
  posicao, avaliacoes, aoAbrir, aoAdicionar,
}: {
  posicao: PosicaoNaTela
  avaliacoes: AvaliacaoNaTela[]
  aoAbrir: (passo: number) => void
  aoAdicionar?: (posicaoId: string, avaliacaoId: string) => void
}) {
  // o passo é a posição dentro das visitas **que têm foto**, não dentro de
  // todas: é por elas que as setas do visor andam
  let passo = -1

  return (
    <>
      <span className="py-2 text-[13.5px] font-medium">{posicao.nome}</span>

      {avaliacoes.map((a) => {
        const foto = a.fotos.find((f) => f.posicaoId === posicao.id)
        if (foto) passo++
        const meu = passo

        if (!foto) {
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => aoAdicionar?.(posicao.id, a.id)}
              disabled={!aoAdicionar}
              aria-label={`Adicionar ${posicao.nome} em ${dataCurta(a.data)}`}
              className="flex h-24 w-24 items-center justify-center rounded-padrao border border-dashed border-linha-tracejada text-tinta-fraca disabled:opacity-60 hover:not-disabled:bg-superficie-suave hover:not-disabled:text-marca"
            >
              <Icone nome="mais" />
            </button>
          )
        }

        return (
          <button
            key={a.id}
            type="button"
            onClick={() => aoAbrir(meu)}
            aria-label={`Ampliar ${posicao.nome} em ${dataCurta(a.data)}`}
            className="h-24 w-24 overflow-hidden rounded-padrao border border-linha-suave bg-superficie-mais-suave transition-[border-color] duration-150 hover:border-marca"
          >
{/* `<img>` e não `next/image`: o endereço é assinado e expira, e o
                otimizador do Next guardaria uma imagem privada de saúde atrás
                de uma URL que não expira junto. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt={`${posicao.nome} em ${dataCurta(a.data)}`}
              className="size-full object-cover"
            />
          </button>
        )
      })}

      <span className="flex justify-end" />
    </>
  )
}
