'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Botao } from './botao'
import { Icone } from './icones'
import { TINTA, type Tinta } from './tintas'

/** 452 para confirmar, 520 para formulário, 588 quando há lista dentro. */
export type LarguraModal = 'confirmacao' | 'formulario' | 'lista'

const LARGURA: Record<LarguraModal, string> = {
  confirmacao: 'w-[min(92vw,452px)]',
  formulario: 'w-[min(92vw,520px)]',
  lista: 'w-[min(92vw,588px)]',
}

const ALTURA = 'max-h-[calc(100dvh-56px)]'

/*
 * Quantos modais estão abertos.
 *
 * O `<dialog>` nativo prende o foco e deixa o resto inerte, mas **não** trava a
 * rolagem: a roda do mouse fora do card continua rolando a página atrás, e o
 * DESIGN-SYSTEM 4.7 é absoluto quanto a isso. Travar é do documento, não do
 * componente, então o contador existe para dois modais abertos ao mesmo tempo
 * não destravarem a página quando o primeiro fechar.
 */
let abertos = 0

function travarPagina() {
  abertos++
  if (abertos > 1) return
  const corpo = document.body
  // a barra de rolagem some junto com o `hidden`; sem compensar, a página
  // inteira pula uns 15px para a direita no instante em que o modal abre
  const folga = window.innerWidth - document.documentElement.clientWidth
  corpo.dataset.rolagemAnterior = corpo.style.overflow
  corpo.dataset.folgaAnterior = corpo.style.paddingRight
  corpo.style.overflow = 'hidden'
  if (folga > 0) corpo.style.paddingRight = `${folga}px`
}

function destravarPagina() {
  abertos = Math.max(0, abertos - 1)
  if (abertos > 0) return
  const corpo = document.body
  corpo.style.overflow = corpo.dataset.rolagemAnterior ?? ''
  corpo.style.paddingRight = corpo.dataset.folgaAnterior ?? ''
  delete corpo.dataset.rolagemAnterior
  delete corpo.dataset.folgaAnterior
}

type Cabecalho = {
  glifo?: string
  tom?: Tinta
  titulo: string
  sub?: string
  perigo?: boolean
}

/**
 * A casca do modal: `<dialog>` nativo, fundo escurecido, e o `pop` de .26s.
 *
 * Usa `<dialog>` porque ele já traz o que costuma ser reimplementado errado —
 * foco preso dentro, `Esc` para fechar, e o resto da página inerte para o leitor
 * de tela.
 *
 * **Quem rola é o corpo, nunca a página.** Cabeçalho e rodapé ficam parados: um
 * modal de confirmação cuja lista de afetados empurra o botão "Encerrar" para
 * fora da tela é um modal que faz a pessoa confirmar às cegas.
 */
function Casca({
  aberto, aoFechar, largura, children,
}: {
  aberto: boolean
  aoFechar: () => void
  largura: LarguraModal
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    travarPagina()
    return destravarPagina
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => { if (e.target === ref.current) aoFechar() }}
      className={`m-auto ${ALTURA} overflow-hidden rounded-modal bg-superficie p-0 shadow-modal backdrop:bg-escuro/42 backdrop:backdrop-blur-[3px] ${LARGURA[largura]}`}
      /*
       * `backwards`, e não `both`.
       *
       * Com `both` a animação **continua aplicada** depois de terminar: o
       * último quadro diz `transform: none`, mas o computado vira
       * `matrix(1,0,0,1,0,0)` — e qualquer transform, mesmo a identidade, faz
       * do elemento um bloco de contenção. Aí todo `position: fixed` dentro do
       * modal passa a se posicionar contra o card em vez da tela, e o
       * `overflow: hidden` daqui corta o que sair. Foi assim que o calendário
       * do campo de data abriu 148px acima do topo da janela, invisível.
       *
       * `backwards` mantém a entrada igual (o quadro inicial vale antes de
       * começar) e devolve o elemento ao estado dele quando acaba.
       */
      style={{ animation: aberto ? 'vd-pop .26s var(--ease-pop) backwards' : undefined }}
    >
      <div className={`relative flex ${ALTURA} flex-col`}>
        {/* o X no canto: fechar sem procurar o botão, como em todo modal que a
            pessoa já usou na vida. O `Cancelar` do rodapé continua, porque ele
            é o que diz "desisti" para quem estava preenchendo */}
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-padrao text-tinta-fraca transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta"
        >
          <Icone nome="fechar" tamanho={16} />
        </button>
        {children}
      </div>
    </dialog>
  )
}

function Titulo({ glifo = '+', tom = 'positivo', titulo, sub, perigo = false }: Cabecalho) {
  return (
    <header className="flex shrink-0 items-start gap-3 px-6 pt-[22px] pr-14 pb-4">
      <span
        aria-hidden
        className={`flex size-9 shrink-0 items-center justify-center rounded-padrao text-[15px] ${TINTA[perigo ? 'alerta' : tom]}`}
      >
        {perigo ? '!' : glifo}
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-titulo text-[20px] font-semibold tracking-[-.02em]">
          {titulo}
        </h2>
        {sub ? <p className="text-[12.5px] text-tinta-apagada">{sub}</p> : null}
      </div>
    </header>
  )
}

/** O corpo que rola. `gap-4` é o espaço entre campos do protótipo. */
function Corpo({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-1">
      {children}
    </div>
  )
}

/**
 * O rodapé, sempre igual: o secundário ocupa a esquerda e empurra o primário
 * para a direita, então a ação que confirma fica no mesmo canto em todo modal.
 */
function Rodape({ children }: { children: ReactNode }) {
  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-linha-fina px-6 pt-4 pb-5">
      {children}
    </footer>
  )
}

/**
 * O modal do protótipo: ícone com tinta, título, subtítulo, corpo e duas ações.
 *
 * Este é o de **confirmar**. Quem tem campos para preencher usa
 * `<ModalFormulario>`, que é a mesma casca com um `<form>` de verdade em volta
 * do corpo e do rodapé.
 */
export function Modal({
  aberto, glifo, tom, titulo, sub,
  primario, aoConfirmar, secundario = 'Cancelar', aoFechar,
  perigo = false, pendente = false, largura = 'formulario', children,
}: Cabecalho & {
  aberto: boolean
  /**
   * A ação que confirma. Opcional porque nem todo modal confirma alguma coisa:
   * o de encaixe aplica no toque do nome e só precisa de um "Fechar".
   */
  primario?: string
  aoConfirmar?: () => void
  secundario?: string
  aoFechar: () => void
  pendente?: boolean
  largura?: LarguraModal
  children?: ReactNode
}) {
  return (
    <Casca aberto={aberto} aoFechar={aoFechar} largura={largura}>
      <Titulo glifo={glifo} tom={tom} titulo={titulo} sub={sub} perigo={perigo} />
      {children ? <Corpo>{children}</Corpo> : null}
      <Rodape>
        <Botao tom="secundario" onClick={aoFechar} className="flex-1">
          {secundario}
        </Botao>
        {primario && aoConfirmar ? (
          <Botao
            tom={perigo ? 'perigo' : 'primario'}
            onClick={aoConfirmar}
            disabled={pendente}
          >
            {primario}
          </Botao>
        ) : null}
      </Rodape>
    </Casca>
  )
}

/**
 * O modal que **preenche**: cadastrar serviço, editar profissional, convidar
 * usuário, criar horário fixo.
 *
 * O protótipo usa modal para tudo que é criar e editar item de lista, e faixa
 * embutida só onde a tela inteira é o formulário (Padrões, Vocabulário). Por
 * isso este componente existe em vez de um `<form>` solto dentro do `<Modal>`:
 * o botão que confirma precisa ser o `submit` do formulário, senão `Enter` no
 * campo não envia e a validação nativa do navegador não roda.
 */
export function ModalFormulario({
  aberto, glifo, tom, titulo, sub,
  primario, aoEnviar, secundario = 'Cancelar', aoFechar,
  perigo = false, pendente = false, largura = 'formulario', children,
}: Cabecalho & {
  aberto: boolean
  primario: string
  /** recebe o `FormData` do formulário, como qualquer `action` do React */
  aoEnviar: (dados: FormData) => void
  secundario?: string
  aoFechar: () => void
  pendente?: boolean
  largura?: LarguraModal
  children: ReactNode
}) {
  return (
    <Casca aberto={aberto} aoFechar={aoFechar} largura={largura}>
      <Titulo glifo={glifo} tom={tom} titulo={titulo} sub={sub} perigo={perigo} />
      {/* o `form` começa depois do título e envolve corpo e rodapé, para o
          primário ser o `submit` sem deixar o cabeçalho rolar junto */}
      <form action={aoEnviar} className="flex min-h-0 flex-1 flex-col">
        <Corpo>{children}</Corpo>
        <Rodape>
          <Botao type="button" tom="secundario" onClick={aoFechar} className="flex-1">
            {secundario}
          </Botao>
          <Botao type="submit" tom={perigo ? 'perigo' : 'primario'} disabled={pendente}>
            {primario}
          </Botao>
        </Rodape>
      </form>
    </Casca>
  )
}
