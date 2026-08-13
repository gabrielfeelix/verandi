import { lerConvite } from '@/server/usuarios/acoes'
import { AceitarConvite } from '@/components/usuarios/aceitar-convite'
import { PainelAcesso } from '@/components/ui/painel-acesso'

const PAPEL: Record<string, string> = {
  dono: 'dono da conta — mexe em tudo, inclusive configuração e usuários',
  recepcao: 'recepção — marca, remarca e cadastra, sem mexer na configuração',
  profissional: 'profissional — a sua agenda e as suas pessoas',
  suporte: 'suporte da 4YU — acesso registrado em toda ação',
}

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
    <PainelAcesso tela="convite">
      <h1 className="font-titulo text-[25px] leading-tight font-semibold tracking-[-.02em]">
        {r.ok ? 'Você foi convidada' : 'Este link não vale mais'}
      </h1>

      {r.ok ? (
        <>
          <p className="pt-2 pb-4 text-[13.5px] leading-relaxed text-tinta-media">
            Você entra em <strong className="text-tinta">{r.contaNome}</strong>{' '}
            com o e-mail <strong className="text-tinta">{r.email}</strong>.
          </p>

          {/* qual conta e qual papel, antes de aceitar: sem isso a pessoa não
              sabe no que está entrando */}
          {r.tipo === 'acesso' ? (
            <p className="mb-5 rounded-media border border-linha-suave bg-superficie-suave px-3.5 py-3 text-[12.5px] leading-relaxed text-tinta-media">
              <span className="font-medium text-tinta">
                Como {PAPEL[r.papel]?.split(' — ')[0] ?? r.papel}
              </span>
              {PAPEL[r.papel] ? ` — ${PAPEL[r.papel].split(' — ')[1]}` : ''}
            </p>
          ) : (
            <p className="mb-5 rounded-media border border-atencao-fundo bg-[#FDF8EE] px-3.5 py-3 text-[12.5px] leading-relaxed text-atencao">
              Este link é para redefinir a sua senha. O acesso que você já tinha
              continua o mesmo.
            </p>
          )}
          <AceitarConvite token={token} />
        </>
      ) : (
        <>
          {/* estado recusado precisa dizer o que fazer, não dar erro genérico */}
          <p className="pt-2 pb-5 text-[13.5px] leading-relaxed text-tinta-media">
            {RECUSA[r.motivo]}
          </p>
          <a
            href="/entrar"
            className="inline-flex min-h-12 items-center justify-center rounded-media bg-escuro px-4 text-[14px] font-semibold text-tinta-clara"
          >
            Ir para a entrada
          </a>
        </>
      )}
    </PainelAcesso>
  )
}
