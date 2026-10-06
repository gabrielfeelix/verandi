'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Vazio } from '@/components/ui/pecas'
import { MarcarAula } from './marcar-aula'

type Credito = {
  /** a participação da falta, que a reposição vai pagar */
  id: string
  sessaoId: string
  servicoId: string | null
  servico: string
  titulo: string
  sub: string
}

/**
 * Os créditos em aberto, e o jeito de usar cada um sem sair da ficha.
 *
 * Marcar some com o crédito na hora, sem recarregar a tela: quem está no
 * balcão já sabe que deu certo pelo aviso.
 */
export function ReposicoesAbertas({
  pessoaId, nome, servicos, rotuloSessao, creditos, podeAgendar,
}: {
  pessoaId: string
  nome: string
  servicos: Array<{ id: string; nome: string }>
  rotuloSessao: string
  creditos: Credito[]
  podeAgendar: boolean
}) {
  const [usados, setUsados] = useState<string[]>([])
  const visiveis = creditos.filter((c) => !usados.includes(c.id))

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <h2 className="font-titulo text-[18px] font-semibold">Reposições em aberto</h2>
        <span className="flex size-6 items-center justify-center rounded-peca bg-atencao-fundo text-[13px] font-semibold text-atencao">
          {visiveis.length}
        </span>
      </div>

      {visiveis.length === 0 ? (
        <Vazio
          icone="check"
          titulo="Nenhuma. Nada a cobrar de volta."
          texto="Faltas que geraram crédito e ainda não foram repostas aparecem aqui."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2.5 rounded-media border border-atencao-linha bg-superficie px-3 py-[11px]"
            >
              {/* a base de 200px é o que faz os botões descerem no celular,
                  em vez de espremerem o nome da aula até "Pilat..." */}
              <span className="flex min-w-0 flex-[1_1_200px] flex-col leading-[1.35]">
                <span className="truncate text-[14.5px] font-medium">{c.titulo}</span>
                <span className="text-[12.5px] text-tinta-fraca">{c.sub}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/sessao/${c.sessaoId}`}
                  className="rounded-peca px-2.5 py-2 text-[13.5px] text-tinta-media underline-offset-2 hover:underline"
                >
                  Ver a aula
                </Link>
                {podeAgendar ? (
                  // o mesmo "Marcar aula" do topo da ficha, preso a esta falta
                  <MarcarAula
                    pessoaId={pessoaId}
                    nome={nome}
                    servicos={servicos}
                    servicoInicial={c.servicoId}
                    faltas={[]}
                    faltaFixa={{ id: c.id, quando: c.titulo }}
                    rotuloSessao={rotuloSessao}
                    aoMarcar={() => setUsados((u) => [...u, c.id])}
                    className="cursor-pointer rounded-peca bg-atencao px-3 py-2 text-[13.5px] font-medium text-white transition-colors duration-150 hover:bg-[#75591C]"
                  >
                    Agendar reposição
                  </MarcarAula>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

    </>
  )
}
