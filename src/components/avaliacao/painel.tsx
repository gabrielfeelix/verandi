'use client'

import { useEffect, useState } from 'react'
import { Matriz } from './matriz'
import { Comparador } from './comparador'
import { NovaAvaliacao } from './nova-avaliacao'
import { Vazio } from '../ui/pecas'
import { BlocoEsqueleto } from '../ui/esqueleto-tela'
import type { AvaliacaoNaTela, PosicaoNaTela } from './tipos'

type Dados = {
  avaliacoes: AvaliacaoNaTela[]
  posicoes: PosicaoNaTela[]
  profissionais: Array<{ id: string; nome: string }>
}

/**
 * A aba de avaliação, que busca o que precisa quando é aberta.
 *
 * As outras abas da ficha já vêm prontas do servidor e trocam sem ir a lugar
 * nenhum. Esta não pode vir junto: são vinte e quatro endereços assinados no
 * Storage para uma pessoa com quatro visitas, e pagar isso em toda abertura de
 * ficha seria pagar pelo que quase ninguém abre.
 *
 * Então ela abre **na hora**, com esqueleto no lugar das fotos, e o dado entra
 * quando chega. É a mesma promessa das outras abas: a tela muda no primeiro
 * quadro, o conteúdo alcança depois.
 */
export function PainelDeAvaliacao({
  pessoaId, pessoaNome, carregar, aoRegistrar, aoAdicionarPosicao,
}: {
  pessoaId: string
  pessoaNome: string
  carregar: (pessoaId: string) => Promise<Dados>
  aoRegistrar: (dados: FormData) => Promise<void>
  aoAdicionarPosicao: (nome: string) => Promise<void>
}) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    carregar(pessoaId)
      .then((d) => { if (vivo) setDados(d) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [carregar, pessoaId])

  if (erro) {
    return (
      <Vazio
        icone="aviso"
        titulo="Não deu para carregar a avaliação"
        texto="Atualize a página. Se continuar, o problema é do servidor e não do cadastro."
      />
    )
  }

  if (!dados) {
    return (
      <div className="flex flex-col gap-3.5">
        <BlocoEsqueleto bloco={{ tipo: 'cards' }} />
        <BlocoEsqueleto bloco={{ tipo: 'tabela', itens: 3 }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-titulo text-[19px] font-semibold">
          Acompanhamento por foto
        </h2>
        <NovaAvaliacao
          pessoaId={pessoaId}
          pessoaNome={pessoaNome}
          posicoes={dados.posicoes}
          profissionais={dados.profissionais}
          aoRegistrar={aoRegistrar}
          aoAdicionarPosicao={aoAdicionarPosicao}
        />
      </div>

      {dados.avaliacoes.length === 0 ? (
        <Vazio
          icone="pessoas"
          titulo="Nenhuma avaliação ainda"
          texto="A comparação aparece a partir da segunda. Não é falha de carregamento: ninguém registrou a primeira."
        />
      ) : (
        <>
          <Comparador posicoes={dados.posicoes} avaliacoes={dados.avaliacoes} />
          <Matriz posicoes={dados.posicoes} avaliacoes={dados.avaliacoes} />
        </>
      )}
    </div>
  )
}
