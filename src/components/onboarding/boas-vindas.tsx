'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Nota } from '@/components/ui/pecas'
import { PREDEFINICOES, type TipoDeNegocio } from '@/core/vocabulario/predefinicoes'
import { concluir, marcarPasso, pular, escolherTipoDeNegocio } from '@/server/onboarding/acoes'
import type { Cartao } from '@/core/onboarding/boas-vindas'

/**
 * As boas-vindas, **por dentro do sistema**.
 *
 * Não é uma tela antes de entrar, e a diferença não é de gosto: quem acabou de
 * digitar a senha precisa ver o produto carregado, com o nome do negócio no
 * trilho e a agenda no lugar. Uma segunda tela com a mesma cara do login faz a
 * pessoa achar que o login não funcionou, e é exatamente o defeito que o acerto
 * do plano 07 corrigiu do outro lado.
 *
 * Então o sistema abre inteiro e isto vem por cima, no mesmo modal de todo o
 * resto do produto: fundo escurecido, rolagem travada, `Esc` fechando.
 *
 * A escolha do tipo de negócio é o **último** cartão, não o primeiro:
 * perguntar "que tipo de negócio é o seu" para quem ainda não sabe o que o
 * sistema faz é pedir decisão sem contexto.
 */
export function BoasVindas({
  cartoes, passoInicial, perguntarTipo,
}: {
  cartoes: Cartao[]
  passoInicial: number
  /**
   * A conta ainda fala a língua de fábrica, e quem está lendo pode mudá-la.
   * Com as palavras já escolhidas, perguntar de novo seria propor desfazer
   * decisão que ninguém pediu para rever.
   */
  perguntarTipo: boolean
}) {
  const total = cartoes.length + (perguntarTipo ? 1 : 0)
  const [i, setI] = useState(Math.min(passoInicial, total - 1))
  const [tipo, setTipo] = useState<TipoDeNegocio | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  const noTipo = perguntarTipo && i === cartoes.length
  const cartao = cartoes[Math.min(i, cartoes.length - 1)]
  const ultimo = i + 1 >= total

  function fechar(comoPulado: boolean) {
    iniciar(async () => {
      setErro(null)
      try {
        if (!comoPulado && noTipo && tipo) await escolherTipoDeNegocio(tipo)
        await (comoPulado ? pular('boas-vindas') : concluir('boas-vindas'))
        // o vocabulário escolhido muda o texto de todas as telas, inclusive a
        // que está atrás deste modal
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para salvar')
      }
    })
  }

  function seguir() {
    if (ultimo) return fechar(false)
    const proximo = i + 1
    setI(proximo)
    void marcarPasso('boas-vindas', proximo)
  }

  return (
    <Modal
      aberto
      largura="lista"
      glifo={noTipo ? 'A' : '✦'}
      titulo={noTipo ? 'Como o seu negócio chama as coisas?' : cartao.titulo}
      sub={
        noTipo
          ? 'O sistema usa as suas palavras em todas as telas, e dá para trocar cada uma depois em Configuração.'
          : cartao.texto
      }
      primario={ultimo ? 'Começar' : 'Próxima'}
      aoConfirmar={seguir}
      secundario="Pular"
      aoFechar={() => fechar(true)}
      // sem tipo escolhido o botão fica desabilitado, e não sumido: botão que
      // desaparece deixa a pessoa procurando o que fazer
      pendente={pendente || (noTipo && !tipo)}
    >
      {noTipo ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PREDEFINICOES.map((p) => (
            <button
              key={p.tipo}
              type="button"
              aria-pressed={tipo === p.tipo}
              onClick={() => setTipo(p.tipo)}
              className={`flex cursor-pointer flex-col gap-1 rounded-media border p-3.5 text-left transition-colors duration-150 ${
                tipo === p.tipo
                  ? 'border-escuro bg-positivo-superficie'
                  : 'border-linha bg-superficie hover:bg-superficie-mais-suave'
              }`}
            >
              <span className="text-[13.5px] font-medium">{p.nome}</span>
              <span className="text-[12px] leading-[1.45] text-tinta-media">
                {p.exemplos}
              </span>
              {/* as palavras aparecem antes de serem escolhidas: é o que a
                  pessoa vai ler em toda tela depois, e ninguém deveria
                  descobrir isso na tela seguinte */}
              <span className="pt-0.5 font-mono text-[11px] text-tinta-fraca">
                {p.palavras.pessoa.plural} · {p.palavras.sessao.singular} ·{' '}
                {p.palavras.local.singular}
              </span>
            </button>
          ))}
        </div>
      ) : (
        /*
         * A ilustração é o que separa "aviso do sistema" de "alguém desenhou
         * esta tela". Ela é decorativa, e o texto dela vive no registro, não
         * aqui: quem troca a arte troca a descrição junto.
         */
        <div className="flex justify-center overflow-hidden rounded-cartao bg-[linear-gradient(165deg,var(--color-escuro)_0%,var(--color-escuro-2)_62%,var(--color-escuro-3)_100%)] px-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cartao.arte.arquivo}
            alt={cartao.arte.descricao}
            width={880}
            height={660}
            className="h-[188px] w-auto max-w-none object-contain object-bottom drop-shadow-[0_18px_26px_rgba(0,0,0,.32)]"
          />
        </div>
      )}

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <div className="flex items-center gap-3">
        {/* os pontos dizem quanto falta sem obrigar a ler o número */}
        <div aria-hidden className="flex flex-1 gap-1.5">
          {Array.from({ length: total }, (_, n) => (
            <span
              key={n}
              className={`h-[3px] flex-1 rounded-sm transition-colors duration-200 ${
                n <= i ? 'bg-escuro' : 'bg-linha'
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-[11px] text-tinta-fraca">
          {i + 1} de {total}
        </span>
      </div>
    </Modal>
  )
}
