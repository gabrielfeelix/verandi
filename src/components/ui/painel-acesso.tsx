import type { ReactNode } from 'react'

/**
 * O cartão duplo das telas de acesso: promessa do produto de um lado, o
 * formulário do outro.
 *
 * O protótipo põe uma ilustração no pé do painel escuro. Enquanto a arte não
 * existe, o gradiente e o halo seguram a composição sozinhos — slot vazio com
 * borda pontilhada é coisa de protótipo, não de produto no ar.
 */
export function PainelAcesso({
  titulo, texto, children,
}: {
  titulo: string
  texto: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 md:p-7">
      <div className="grid w-full max-w-[1000px] gap-5 rounded-[26px] bg-superficie p-4 shadow-[0_40px_70px_-44px_rgba(20,26,24,.45)] md:grid-cols-2 md:p-5">
        <section
          aria-hidden
          className="relative hidden min-h-[556px] flex-col justify-between overflow-hidden rounded-[20px] bg-[linear-gradient(165deg,#12211C_0%,#1B3A31_62%,#245045_100%)] p-8 md:flex"
        >
          <span className="pointer-events-none absolute -top-16 -right-16 size-[260px] rounded-full bg-[radial-gradient(circle,rgba(42,195,163,.24),transparent_70%)]" />

          <div className="relative flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-[12px] bg-menta font-titulo text-[19px] font-bold text-escuro">
              V
            </span>
            <span className="font-titulo text-[18px] font-semibold text-tinta-clara">
              Verandi
            </span>
          </div>

          <div className="relative pt-6">
            <p className="font-titulo text-[30px] leading-[1.16] font-semibold tracking-[-.025em] text-pretty text-tinta-clara">
              {titulo}
            </p>
            <span className="my-4 block h-[3px] w-15 rounded-sm bg-menta" />
            <p className="max-w-[290px] text-[13.5px] leading-relaxed text-[#9FB5AE]">
              {texto}
            </p>
          </div>

          <span />
        </section>

        <section className="flex flex-col justify-center px-2 py-4 md:px-7">
          {/* a marca também aparece aqui: em celular o painel escuro não existe */}
          <div className="flex items-center gap-3 pb-6 md:hidden">
            <span className="flex size-9 items-center justify-center rounded-[12px] bg-menta font-titulo text-[19px] font-bold text-escuro">
              V
            </span>
            <span className="font-titulo text-[18px] font-semibold">Verandi</span>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}
