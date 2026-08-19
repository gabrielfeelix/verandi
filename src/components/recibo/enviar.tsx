'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { enviarReciboPorEmail } from '@/server/recibo/acoes'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * Mandar o recibo por e-mail.
 *
 * Imprimir não é a única saída, e para a maioria dos alunos não é nem a
 * provável: o estúdio recebe no pix e o aluno pede o comprovante sem chegar
 * perto de uma impressora.
 *
 * O endereço vem preenchido com o da ficha e continua editável, porque o aluno
 * dita outro no balcão o tempo todo, e obrigar a editar o cadastro antes de
 * mandar um comprovante é atrito no lugar errado. **O que for digitado aqui não
 * volta para a ficha**: mandar para o e-mail do marido não muda de quem é a
 * ficha.
 */
export function EnviarRecibo({
  reciboId, numero, paraSugerido, jaEnviado, botao = 'miudo',
}: {
  reciboId: string
  numero: string
  paraSugerido: string | null
  /** o último envio, quando houve: é o que responde "já mandei?" */
  jaEnviado: { para: string; em: string } | null
  botao?: 'miudo' | 'linha'
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const classe = botao === 'linha'
    ? 'cursor-pointer text-[11.5px] text-marca underline disabled:opacity-50'
    : 'min-h-9 cursor-pointer rounded-peca border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:bg-superficie-mais-suave'

  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); setErro(null) }}
        className={classe}
      >
        {jaEnviado ? 'Enviar de novo' : 'Enviar por e-mail'}
      </button>

      {aberto ? (
        <ModalFormulario
          aberto
          glifo="@"
          tom="neutro"
          titulo="Enviar o recibo por e-mail"
          sub={numero}
          primario="Enviar"
          secundario="Fechar"
          pendente={pendente}
          aoFechar={() => { setAberto(false); setErro(null) }}
          aoEnviar={(f) => {
            const para = String(f.get('para') ?? '').trim()
            setErro(null)
            comecar(async () => {
              try {
                const r = await enviarReciboPorEmail(reciboId, para)
                if (!r.ok) return setErro(r.erro)
                avisar({ texto: `Recibo enviado para ${r.valor}` })
                setAberto(false)
                router.refresh()
              } catch (e) {
                setErro(erroLegivel(e))
              }
            })
          }}
        >
          <Campo rotulo="Para" htmlFor="rc-email" obrigatorio>
            <input
              id="rc-email" name="para" type="email" className={entrada}
              defaultValue={paraSugerido ?? ''}
              placeholder="nome@email.com"
            />
          </Campo>

          {jaEnviado ? (
            <Nota tom="neutro">
              O último envio foi para {jaEnviado.para}, em {jaEnviado.em}.
              Reenviar é normal, e cada envio fica registrado.
            </Nota>
          ) : null}

          <Nota tom="neutro">
            O recibo vai no corpo da mensagem, e não como anexo: quem recebe abre
            no telefone e precisa ver o comprovante ali, sem baixar nada. O
            endereço digitado aqui não altera a ficha.
          </Nota>

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}
