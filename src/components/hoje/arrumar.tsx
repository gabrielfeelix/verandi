'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Nota } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { useAviso } from '@/components/ui/desfazer'
import {
  restaurarArranjoDaHome, salvarArranjoDaHome,
} from '@/server/home/acoes'
import {
  BLOCOS, mover, paraGravar, type Arranjo, type Faixa,
} from '@/core/home/blocos'
import { erroLegivel } from '@/core/erro-legivel'

type Linha = { id: string; titulo: string; sobre: string; faixa: Faixa; fixo: boolean; visivel: boolean }

const NOME_DA_FAIXA: Record<Faixa, string> = {
  principal: 'Coluna larga',
  lateral: 'Coluna estreita',
}

/**
 * Arrumar a tela inicial: o que aparece, e em que ordem.
 *
 * Fica atrás de um ícone, e não numa aba de configuração, porque a pergunta
 * nasce olhando a tela: "isto aqui em cima não me serve". Ter que sair da tela
 * para mudar a tela é o caminho que ninguém percorre.
 *
 * **O arranjo é de quem está usando, e não da conta.** O dono abre o dia para
 * saber quanto entrou, a recepção abre para saber quem falta chamar, e a mesma
 * home para os dois obriga um dos dois a rolar até o que interessa, todo dia.
 *
 * Setas, e não arrastar. Arrastar é bonito e exige mão firme num balcão, com
 * uma pessoa esperando na frente; e num celular ele briga com o rolar da
 * página. Duas setas fazem a mesma coisa e funcionam com teclado sem eu
 * escrever nada.
 */
export function ArrumarHome({ inicial }: { inicial: Linha[] }) {
  const [aberto, setAberto] = useState(false)
  const [linhas, setLinhas] = useState<Linha[]>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const faixaDe = (id: string) => BLOCOS.find((b) => b.id === id)?.faixa

  function abrir() {
    setLinhas(inicial)
    setErro(null)
    setAberto(true)
  }

  function moverLinha(id: string, direcao: 'cima' | 'baixo') {
    setLinhas((atual) => {
      const ordem = mover(
        atual.map((l) => ({ id: l.id, visivel: l.visivel })), id, direcao, faixaDe,
      )
      return ordem.map((o) => atual.find((l) => l.id === o.id)!)
    })
  }

  function alternar(id: string) {
    setLinhas((atual) => atual.map((l) =>
      l.id === id && !l.fixo ? { ...l, visivel: !l.visivel } : l))
  }

  function salvar() {
    setErro(null)
    comecar(async () => {
      try {
        const r = await salvarArranjoDaHome(paraGravar(linhas) as Arranjo[])
        if (!r.ok) return setErro(r.erro)
        avisar({ texto: 'Tela arrumada' })
        setAberto(false)
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  function restaurar() {
    setErro(null)
    comecar(async () => {
      try {
        const r = await restaurarArranjoDaHome()
        if (!r.ok) return setErro(r.erro)
        avisar({ texto: 'Tela de volta ao padrão' })
        setAberto(false)
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  const faixas: Faixa[] = ['principal', 'lateral']

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Arrumar a tela inicial"
        aria-label="Arrumar a tela inicial"
        className="flex size-10 cursor-pointer items-center justify-center rounded-padrao border border-linha bg-superficie text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Icone nome="arrumar" tamanho={18} />
      </button>

      {aberto ? (
        <Modal
          aberto
          glifo="≡"
          tom="neutro"
          titulo="Arrumar a tela inicial"
          sub="vale só para você, nesta conta"
          largura="lista"
          primario="Salvar"
          aoConfirmar={salvar}
          pendente={pendente}
          aoFechar={() => setAberto(false)}
        >
          <div className="flex flex-col gap-4">
            {faixas.map((faixa) => {
              const daFaixa = linhas.filter((l) => l.faixa === faixa)
              if (daFaixa.length === 0) return null
              return (
                <section key={faixa} className="flex flex-col gap-1.5">
                  <h3 className="text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
                    {NOME_DA_FAIXA[faixa]}
                  </h3>
                  {daFaixa.map((l, i) => (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 rounded-media border px-3 py-2.5 ${
                        l.visivel
                          ? 'border-linha-suave bg-superficie'
                          : 'border-linha-fina bg-superficie-mais-suave'
                      }`}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={l.visivel}
                          disabled={l.fixo}
                          onChange={() => alternar(l.id)}
                          className="size-4 shrink-0 accent-[#0E7C6B] disabled:opacity-40"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className={`text-[14.5px] font-medium ${l.visivel ? '' : 'text-tinta-media'}`}>
                            {l.titulo}
                            {l.fixo ? (
                              <span className="pl-2 text-[12px] font-normal text-tinta-fraca">
                                {' '}sempre visível
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[12.5px] leading-[1.5] text-tinta-media">
                            {l.sobre}
                          </span>
                        </span>
                      </label>

                      <span className="flex shrink-0 gap-1">
                        <Seta
                          direcao="cima"
                          rotulo={`Subir ${l.titulo}`}
                          desligada={i === 0}
                          onClick={() => moverLinha(l.id, 'cima')}
                        />
                        <Seta
                          direcao="baixo"
                          rotulo={`Descer ${l.titulo}`}
                          desligada={i === daFaixa.length - 1}
                          onClick={() => moverLinha(l.id, 'baixo')}
                        />
                      </span>
                    </div>
                  ))}
                </section>
              )
            })}

            <Nota tom="neutro">
              A coluna larga e a estreita não trocam de conteúdo: a agenda do dia
              precisa da largura, e a lista de pendências não. O que se arruma é
              a ordem dentro de cada uma, e o que aparece.
            </Nota>

            <button
              type="button"
              onClick={restaurar}
              disabled={pendente}
              className="cursor-pointer self-start text-[13.5px] text-tinta-media underline disabled:opacity-50"
            >
              Voltar ao padrão
            </button>

            {erro ? <Nota tom="alerta">{erro}</Nota> : null}
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function Seta({
  direcao, rotulo, desligada, onClick,
}: {
  direcao: 'cima' | 'baixo'
  rotulo: string
  desligada: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desligada}
      aria-label={rotulo}
      title={rotulo}
      className="flex size-8 cursor-pointer items-center justify-center rounded-peca border border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave disabled:cursor-default disabled:opacity-30"
    >
      <Icone nome={direcao === 'cima' ? 'acima' : 'abaixo'} tamanho={15} />
    </button>
  )
}
