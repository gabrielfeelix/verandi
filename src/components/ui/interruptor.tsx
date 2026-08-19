'use client'

/**
 * O interruptor: liga e desliga uma coisa só, e aplica na hora.
 *
 * Não é caixa de seleção nem par de chips. A diferença importa: caixa de
 * seleção é resposta de formulário, que só vale quando alguém salva; chip é
 * escolha entre alternativas. Isto aqui é um estado binário de algo que já
 * existe — "segunda abre" —, e a alavanca é a única forma que diz, sem texto,
 * de que lado a coisa está.
 *
 * `role="switch"` e não `checkbox`: o leitor de tela anuncia "ativado /
 * desativado" em vez de "marcado", que é o que a pessoa quer ouvir aqui.
 * O rótulo visível fica fora — ele acompanha, não substitui o nome acessível.
 */
export function Interruptor({
  ligado, aoMudar, rotulo, desligado = false, textoLigado, textoDesligado,
}: {
  ligado: boolean
  aoMudar: (novo: boolean) => void
  /** o nome acessível: "Segunda abre", "Receber aviso por e-mail" */
  rotulo: string
  desligado?: boolean
  /** o texto que aparece ao lado; sem ele, só a alavanca */
  textoLigado?: string
  textoDesligado?: string
}) {
  const texto = ligado ? textoLigado : textoDesligado

  return (
    <span className="inline-flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        disabled={desligado}
        onClick={() => aoMudar(!ligado)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
          ligado
            ? 'border-marca bg-marca'
            : 'border-linha bg-neutro-fundo'
        }`}
      >
        {/*
          * A bolinha anda 20px. Em `prefers-reduced-motion` a transição some por
          * conta da regra global — e o interruptor continua correto, porque
          * quem informa o estado é a posição, não o movimento.
          */}
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(20,26,24,.3)] transition-[left] duration-150 ${
            ligado ? 'left-[23px]' : 'left-[2px]'
          }`}
        />
      </button>

      {texto ? (
        <span
          aria-hidden
          className={`text-[13px] font-medium ${ligado ? 'text-marca' : 'text-tinta-media'}`}
        >
          {texto}
        </span>
      ) : null}
    </span>
  )
}
