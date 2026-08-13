import { lerConvite } from '@/server/usuarios/acoes'
import { AceitarConvite } from '@/components/usuarios/aceitar-convite'

const RECUSA: Record<string, string> = {
  expirado: 'Este convite passou do prazo. Peça um novo para quem te convidou.',
  ja_aceito: 'Este convite já foi usado. É só entrar com o seu e-mail e senha.',
  revogado: 'Este convite foi cancelado. Fale com quem te convidou.',
  inexistente: 'Não encontramos este convite. Confira se o link veio inteiro.',
}

/**
 * A porta de entrada de quem foi convidado — e de quem esqueceu a senha.
 *
 * Rota pública: quem abre ainda não é ninguém no sistema, e o token é a
 * credencial. Nada aqui aceita identificador vindo do navegador.
 */
export default async function Convite({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const r = await lerConvite(token)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 p-6">
      <header className="flex flex-col gap-1">
        <span className="text-[10.5px] font-medium tracking-[.1em] text-tinta-fraca uppercase">
          Verandi
        </span>
        <h1 className="font-titulo text-[30px] font-semibold tracking-[-.02em]">
          {r.ok ? 'Que bom te ver' : 'Este link não vale mais'}
        </h1>
        {r.ok ? (
          <p className="text-tinta-media">
            Você foi convidada para <strong className="text-tinta">{r.contaNome}</strong>.
            Defina uma senha para entrar.
          </p>
        ) : (
          <p className="text-tinta-media">{RECUSA[r.motivo]}</p>
        )}
      </header>

      {r.ok ? (
        <AceitarConvite token={token} email={r.email} />
      ) : (
        <a href="/entrar" className="text-marca underline">Ir para a entrada</a>
      )}
    </main>
  )
}
