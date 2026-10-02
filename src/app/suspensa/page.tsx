import { redirect } from 'next/navigation'
import { contaAtiva, contasDoUsuario } from '@/server/conta'
import { CascaAcesso } from '@/components/ui/painel-acesso'
import { ACESSO } from '@/components/ui/arte-acesso'
import { Botao } from '@/components/ui/botao'
import { CONTATO } from '@/core/erro-legivel'
import { sair } from '../contas/acoes'

/**
 * Onde para quem trabalha numa conta suspensa.
 *
 * Fica fora do `(app)` de propósito: o layout de lá pede `exigirConta`, que é
 * quem manda para cá, e morar dentro dele seria laço. A tela não diz o motivo
 * da suspensão porque quem lê pode ser a recepção, e motivo de suspensão é
 * conversa da 4YU com o dono.
 */
export default async function Suspensa() {
  const conta = await contaAtiva()
  if (!conta) redirect('/entrar')
  if (!conta.suspensa || conta.papel === 'suporte') redirect('/')

  // quem trabalha em outra conta que segue ativa não fica preso aqui
  const outras = (await contasDoUsuario()).length > 1

  return (
    <CascaAcesso
      titulo="Conta suspensa."
      texto="Os dados continuam guardados. Nada foi apagado."
      arte={ACESSO.contas.arte}
    >
      <h1 className="font-titulo text-[25px] leading-tight font-semibold tracking-[-.02em]">
        {conta.nome} está suspensa
      </h1>
      <p className="pt-2 pb-5 text-[14.5px] leading-relaxed text-tinta-media">
        O acesso a esta conta foi pausado pela 4YU. A agenda, as pessoas e o
        financeiro continuam guardados e voltam do jeito que estavam quando a
        conta for reativada. Para entender o motivo, o dono da conta pode falar
        com <a href={`mailto:${CONTATO}`} className="text-marca underline">{CONTATO}</a>.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {outras ? (
          <a
            href="/contas"
            className="inline-flex min-h-11 items-center rounded-media bg-escuro px-4 text-[14.5px] font-semibold text-tinta-clara hover:bg-escuro-hover"
          >
            Trocar de conta
          </a>
        ) : null}
        <form action={sair}>
          <Botao type="submit" tom="secundario">Sair</Botao>
        </form>
      </div>
    </CascaAcesso>
  )
}
