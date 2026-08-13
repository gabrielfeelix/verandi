import { sair } from '@/app/contas/acoes'

/** Fica no pé do rail escuro, por isso a tinta clara. */
export function Sair() {
  return (
    <form action={sair} className="shrink-0">
      <button
        type="submit"
        title="Sair"
        className="min-h-9 rounded-[--radius-peca] px-2 text-[12px] text-[#8FA8A0] underline hover:text-tinta-clara"
      >
        Sair
      </button>
    </form>
  )
}
