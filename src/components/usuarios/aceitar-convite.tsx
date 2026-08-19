'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Campo, Nota } from '@/components/ui/pecas'
import { aceitarConvite } from '@/server/usuarios/acoes'
import { erroLegivel } from '@/core/erro-legivel'

const RECUSA: Record<string, string> = {
  expirado: 'Este convite passou do prazo.',
  ja_aceito: 'Este convite já foi usado, é só entrar.',
  revogado: 'Este convite foi cancelado.',
  inexistente: 'Não encontramos este convite.',
}

/**
 * Define a senha e entra.
 *
 * O e-mail vem do convite e não é editável: quem escolhe para quem o acesso vai
 * é quem convidou, não quem abre o link.
 */
export function AceitarConvite({ token, email }: { token: string; email: string }) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  return (
    <form
      className="flex flex-col gap-4"
      action={(f) => iniciar(async () => {
        setErro(null)
        const senha = String(f.get('senha') ?? '')
        const repete = String(f.get('repete') ?? '')
        if (senha !== repete) {
          setErro('as duas senhas precisam ser iguais')
          return
        }
        try {
          const r = await aceitarConvite(token, senha)
          if (!r.ok) {
            setErro(RECUSA[r.motivo])
            return
          }
          /*
           * O e-mail vai junto, e a entrada chega preenchida.
           *
           * Antes daqui o botão levava a `/entrar?novo=1`, um parâmetro que
           * ninguém lia: quem acabou de criar a senha caía num formulário vazio
           * e tinha que digitar de novo o endereço que o sistema mostrou dois
           * parágrafos acima. Estava anotado no `HANDOFF` como atrito conhecido.
           */
          router.push(`/entrar?email=${encodeURIComponent(email)}`)
        } catch (e) {
          setErro(erroLegivel(e))
        }
      })}
    >
      {/* o e-mail já aparece na frase acima; repeti-lo num campo travado é
          formulário fingindo que dá para editar o que não dá */}
      <Campo rotulo="Senha" htmlFor="c-senha" dica="Ao menos 8 caracteres">
        <input
          id="c-senha" name="senha" type="password" required minLength={8}
          autoFocus autoComplete="new-password"
          className="min-h-12 rounded-media border border-linha-suave bg-superficie-suave px-4 text-[15px] focus:border-marca focus:bg-superficie"
        />
      </Campo>

      <Campo rotulo="Repita a senha" htmlFor="c-repete">
        <input
          id="c-repete" name="repete" type="password" required minLength={8}
          autoComplete="new-password"
          className="min-h-12 rounded-media border border-linha-suave bg-superficie-suave px-4 text-[15px] focus:border-marca focus:bg-superficie"
        />
      </Campo>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <Botao
        type="submit" disabled={pendente}
        className="mt-1 min-h-13 w-full rounded-media text-[15px] font-semibold"
      >
        Entrar na conta
      </Botao>
    </form>
  )
}
