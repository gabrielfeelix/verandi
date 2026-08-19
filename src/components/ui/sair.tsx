import { sair } from '@/app/contas/acoes'

/** Fica no pé do rail escuro, por isso a tinta clara. */
export function Sair() {
  return (
    <form action={sair} className="shrink-0">
      <button
        type="submit"
        title="Sair"
        className="min-h-9 rounded-peca px-2 text-[13px] text-tinta-escura-fraca underline hover:text-tinta-clara"
      >
        Sair
      </button>
    </form>
  )
}
