import Link from 'next/link'
import { PainelAcesso } from '@/components/ui/painel-acesso'

/**
 * A tela que aparece depois de pedir a senha nova.
 *
 * Ela é a mesma exista o e-mail ou não, e por isso o texto nunca afirma que
 * algo foi enviado para aquele endereço: diz "se este e-mail estiver
 * cadastrado". Confirmar a existência aqui entregaria, para quem só tem um
 * formulário, a lista de quem trabalha no estúdio.
 */
export default function Enviado() {
  return (
    <PainelAcesso tela="enviado">
      {/* O painel de arte já diz "Olha na caixa de entrada". Repetir aqui fazia
          a tela falar duas vezes a mesma frase, com dois tamanhos de fonte. */}
      <h1 className="font-titulo text-[27px] font-semibold tracking-[-.02em]">
        Link a caminho
      </h1>
      <p className="pt-2 pb-1 text-[14.5px] leading-relaxed text-tinta-media">
        Se este e-mail estiver cadastrado, o link chega em alguns segundos. Ele
        vale por 30 minutos e só funciona uma vez.
      </p>
      <p className="pt-3 text-[14.5px] leading-relaxed text-tinta-media">
        Não veio? Confira o spam. Se ainda assim não chegar, quem convidou você
        consegue gerar o link na hora, em Configuração, Usuários.
      </p>

      <div className="flex flex-col gap-2 pt-6">
        <Link
          href="/entrar"
          className="flex min-h-13 w-full items-center justify-center rounded-media bg-tinta text-[15px] font-semibold text-branco hover:bg-tinta-hover"
        >
          Voltar para entrar
        </Link>
        <Link
          href="/esqueci"
          className="flex min-h-11 w-full items-center justify-center text-[13.5px] font-medium text-marca hover:text-marca-forte"
        >
          Pedir outro link
        </Link>
      </div>
    </PainelAcesso>
  )
}
