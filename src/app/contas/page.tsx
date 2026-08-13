import { redirect } from 'next/navigation'
import { contasDoUsuario } from '@/server/conta'
import { destinoDoPapel } from '@/core/acesso/destino'
import { PainelAcesso } from '@/components/ui/painel-acesso'
import { Etiqueta } from '@/components/ui/pecas'
import { PARES_AVATAR, type Tinta } from '@/components/ui/tintas'
import { escolherConta } from './acoes'

const PAPEL: Record<string, { rotulo: string; tinta: Tinta }> = {
  dono: { rotulo: 'Dono', tinta: 'positivo' },
  recepcao: { rotulo: 'Recepção', tinta: 'info' },
  profissional: { rotulo: 'Profissional', tinta: 'neutro' },
  suporte: { rotulo: 'Suporte 4YU', tinta: 'atencao' },
}

/** Mesma conta, mesma cor, em qualquer máquina — é o que faz reconhecer de relance. */
function tileDe(nome: string) {
  let soma = 0
  for (const c of nome) soma = (soma + c.codePointAt(0)!) % 997
  const [fundo, frente] = PARES_AVATAR[soma % PARES_AVATAR.length]
  const sigla = nome
    .trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
  return { fundo, frente, sigla }
}

export default async function Contas() {
  const contas = await contasDoUsuario()

  if (contas.length === 0) redirect('/entrar')
  // quem tem uma conta só nunca vê esta tela
  if (contas.length === 1) redirect(destinoDoPapel(contas[0].papel))

  return (
    <PainelAcesso tela="contas">
      <h1 className="font-titulo text-[25px] leading-tight font-semibold tracking-[-.02em]">
        Em qual conta você vai trabalhar?
      </h1>
      <p className="pt-2 pb-4 text-[13.5px] text-tinta-media">
        Quem tem uma conta só nunca vê esta tela.
      </p>

      <ul className="flex flex-col gap-2">
        {contas.map((c) => {
          const { fundo, frente, sigla } = tileDe(c.nome)
          const papel = PAPEL[c.papel] ?? { rotulo: c.papel, tinta: 'neutro' as Tinta }
          return (
            <li key={c.contaId}>
              <form action={escolherConta}>
                <input type="hidden" name="contaId" value={c.contaId} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3.5 rounded-grande border border-linha-suave bg-superficie p-3.5 text-left transition-[border-color,background-color,transform] duration-200 hover:translate-x-0.5 hover:border-marca hover:bg-[#F9FCFB]"
                >
                  <span
                    aria-hidden
                    className="flex size-9.5 shrink-0 items-center justify-center rounded-padrao font-titulo text-[15px] font-bold"
                    style={{ background: fundo, color: frente }}
                  >
                    {sigla}
                  </span>
                  <span className="min-w-0 flex-1 text-[14.5px] font-medium">
                    {c.nome}
                  </span>
                  <Etiqueta tinta={papel.tinta}>{papel.rotulo}</Etiqueta>
                </button>
              </form>
            </li>
          )
        })}
      </ul>

      <p className="pt-4 text-[12px] leading-relaxed text-tinta-media">
        A conta ativa fica visível em todas as telas depois — operar na conta
        errada é o erro mais caro, e é silencioso.
      </p>
    </PainelAcesso>
  )
}
