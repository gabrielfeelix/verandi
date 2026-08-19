'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { useAviso } from '@/components/ui/desfazer'
import { enviarReciboPorEmail } from '@/server/recibo/acoes'
import { erroLegivel } from '@/core/erro-legivel'

const MAXIMO_DE_COPIAS = 5

/**
 * Mandar o recibo por e-mail.
 *
 * Imprimir não é a única saída, e para a maioria dos alunos não é nem a
 * provável: o estúdio recebe no pix e o aluno pede o comprovante sem chegar
 * perto de uma impressora.
 *
 * **O destino não é uma pergunta.** O recibo é de quem pagou, e o e-mail de
 * quem pagou está na ficha; perguntar "para onde?" a cada envio é pedir que a
 * recepção digite de novo, toda vez, um dado que o sistema já tem. Aqui ele
 * aparece como fato, e o que se acrescenta são **cópias**: o marido que cuida
 * das contas, a empresa que reembolsa, a contadora.
 *
 * O único caso em que se digita um endereço é a ficha sem e-mail, e então ele
 * **entra na ficha**: guardar só para este envio deixaria a próxima pessoa na
 * mesma parede.
 */
export function EnviarRecibo({
  reciboId, numero, pagadorNome, emailDaFicha, jaEnviado, botao = 'miudo',
}: {
  reciboId: string
  numero: string
  pagadorNome: string
  /** o e-mail da ficha de quem pagou; `null` quando a ficha está sem */
  emailDaFicha: string | null
  /** o último envio, quando houve: é o que responde "já mandei?" */
  jaEnviado: { para: string; em: string } | null
  botao?: 'miudo' | 'linha'
}) {
  const [aberto, setAberto] = useState(false)
  const [copias, setCopias] = useState<string[]>([])
  const [rascunho, setRascunho] = useState('')
  const [doPagador, setDoPagador] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const destino = emailDaFicha ?? doPagador.trim()

  function abrir() {
    setCopias([])
    setRascunho('')
    setDoPagador('')
    setErro(null)
    setAberto(true)
  }

  function acrescentar() {
    const email = rascunho.trim().toLowerCase()
    if (!email) return
    if (copias.length >= MAXIMO_DE_COPIAS) {
      return setErro(`São no máximo ${MAXIMO_DE_COPIAS} cópias por envio.`)
    }
    if (email === destino.toLowerCase()) {
      // em `to` e em `cc` a mesma pessoa recebe duas mensagens iguais
      return setErro(`${email} já é quem recebe o recibo.`)
    }
    if (copias.includes(email)) return setRascunho('')
    setErro(null)
    setCopias([...copias, email])
    setRascunho('')
  }

  function enviar() {
    setErro(null)
    comecar(async () => {
      try {
        const r = await enviarReciboPorEmail(reciboId, {
          copias,
          emailDoPagador: emailDaFicha ? null : doPagador.trim(),
        })
        if (!r.ok) return setErro(r.erro)
        avisar({
          texto: r.valor.copias.length
            ? `Recibo enviado para ${r.valor.para} e mais ${r.valor.copias.length}`
            : `Recibo enviado para ${r.valor.para}`,
        })
        setAberto(false)
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  const classe = botao === 'linha'
    ? 'cursor-pointer text-[12.5px] text-marca underline disabled:opacity-50'
    : 'min-h-9 cursor-pointer rounded-peca border border-linha-suave bg-superficie px-3 text-[13.5px] text-tinta-media hover:bg-superficie-mais-suave'

  return (
    <>
      <button type="button" onClick={abrir} className={classe}>
        {jaEnviado ? 'Enviar de novo' : 'Enviar por e-mail'}
      </button>

      {aberto ? (
        <Modal
          aberto
          glifo="@"
          tom="neutro"
          titulo="Enviar o recibo por e-mail"
          sub={`${numero} · ${pagadorNome}`}
          primario="Enviar"
          secundario="Fechar"
          aoConfirmar={enviar}
          pendente={pendente || !destino}
          aoFechar={() => setAberto(false)}
        >
          {emailDaFicha ? (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
                Vai para
              </span>
              <span className="rounded-media border border-linha-suave bg-superficie-mais-suave px-3.5 py-2.5 text-[14.5px]">
                {emailDaFicha}
              </span>
              <span className="text-[12.5px] text-tinta-media">
                é o e-mail da ficha de {pagadorNome}. Para trocar, edite a ficha.
              </span>
            </div>
          ) : (
            /*
             * A ficha sem e-mail é a única vez em que se digita um endereço, e
             * ele vai para a ficha: o endereço de quem paga é dado de cadastro,
             * e guardá-lo só para este envio deixaria a próxima pessoa aqui de
             * novo.
             */
            <Campo rotulo={`E-mail de ${pagadorNome}`} htmlFor="rc-pagador" obrigatorio>
              <input
                id="rc-pagador" type="email" className={entrada}
                value={doPagador}
                onChange={(e) => setDoPagador(e.target.value)}
                placeholder="nome@email.com"
              />
              <span className="pt-1 text-[12.5px] text-tinta-media">
                A ficha está sem e-mail. Este endereço fica salvo nela, e os
                próximos recibos já saem sozinhos.
              </span>
            </Campo>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
              Cópias
            </span>

            {copias.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {copias.map((email) => (
                  <li
                    key={email}
                    className="flex items-center gap-1.5 rounded-peca border border-linha-suave bg-superficie px-2.5 py-1.5 text-[13.5px]"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => setCopias(copias.filter((x) => x !== email))}
                      aria-label={`Tirar ${email} das cópias`}
                      className="cursor-pointer text-tinta-media hover:text-alerta"
                    >
                      <Icone nome="fechar" tamanho={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  // Enter acrescenta em vez de enviar: quem digita três
                  // endereços seguidos mandaria a mensagem no primeiro
                  if (e.key === 'Enter') { e.preventDefault(); acrescentar() }
                }}
                aria-label="E-mail para receber cópia"
                placeholder="marido@email.com"
                className={`${entrada} min-w-[200px] flex-1`}
              />
              <button
                type="button"
                onClick={acrescentar}
                disabled={!rascunho.trim() || copias.length >= MAXIMO_DE_COPIAS}
                className="min-h-11 cursor-pointer rounded-padrao border border-linha bg-superficie px-3.5 text-[14px] hover:bg-superficie-mais-suave disabled:opacity-40"
              >
                Acrescentar
              </button>
            </div>
            <span className="text-[12.5px] text-tinta-media">
              Quem paga vê quem recebeu cópia. São até {MAXIMO_DE_COPIAS}.
            </span>
          </div>

          {jaEnviado ? (
            <Nota tom="neutro">
              O último envio foi para {jaEnviado.para}, em {jaEnviado.em}.
              Reenviar é normal, e cada envio fica registrado.
            </Nota>
          ) : null}

          <Nota tom="neutro">
            O recibo vai no corpo da mensagem, e não como anexo: quem recebe abre
            no telefone e precisa ver o comprovante ali, sem baixar nada.
          </Nota>

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}
    </>
  )
}
