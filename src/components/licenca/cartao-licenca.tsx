'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ModalVolta } from './modal-volta'
import { marcarVolta, mudarVolta } from '@/server/licencas/acoes'
import { useAviso } from '@/components/ui/desfazer'

function curta(data: string) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`
}

/**
 * A licença aberta, na ficha.
 *
 * Até aqui ela só aparecia em Pendências e na API: quem abria a ficha de uma
 * aluna afastada não via que ela estava afastada. As duas ações são as mesmas
 * de Pendências, e a recepção não precisa sair da ficha para usá-las.
 */
export function CartaoLicenca({
  pessoaId, nome, licencaId, inicio, voltaPrevista, podeMexer,
}: {
  pessoaId: string
  nome: string
  licencaId: string
  inicio: string
  voltaPrevista: string | null
  podeMexer: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [encerrada, setEncerrada] = useState(false)
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()
  const router = useRouter()
  const primeiro = nome.split(' ')[0]

  if (encerrada) return null

  return (
    <section className="rounded-grande border border-licenca-fundo bg-licenca-fundo/40 px-4 py-4">
      <p className="text-[12px] font-semibold text-licenca">De licença</p>
      <p className="pt-1.5 text-[14.5px] leading-[1.5]">
        Desde {curta(inicio)}.{' '}
        {voltaPrevista ? `Volta prevista em ${curta(voltaPrevista)}.` : 'Sem data de volta.'}
      </p>
      {podeMexer ? (
        <div className="flex flex-wrap gap-2 pt-3">
          <button
            type="button"
            disabled={pendente}
            onClick={() => iniciar(async () => {
              // some na hora: o aviso confirma, o servidor acompanha por trás
              setEncerrada(true)
              await marcarVolta(pessoaId)
              avisar({ texto: `${primeiro} voltou da licença.` })
              router.refresh()
            })}
            className="min-h-10 cursor-pointer rounded-padrao bg-escuro px-3.5 text-[14.5px] font-medium text-tinta-clara hover:bg-escuro-hover disabled:opacity-60"
          >
            Voltou
          </button>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="min-h-10 cursor-pointer rounded-padrao border border-linha bg-superficie px-3.5 text-[14.5px] hover:bg-superficie-mais-suave"
          >
            {voltaPrevista ? 'Mudar a volta' : 'Definir volta'}
          </button>
        </div>
      ) : null}

      <ModalVolta
        aberto={aberto}
        nome={nome}
        valorInicial={voltaPrevista ?? ''}
        pendente={pendente}
        aoFechar={() => setAberto(false)}
        aoSalvar={(data) => {
          setAberto(false)
          iniciar(async () => {
            await mudarVolta(licencaId, data)
            avisar({ texto: data ? `Volta de ${primeiro} em ${curta(data)}.` : `${primeiro}: volta sem data.` })
            router.refresh()
          })
        }}
      />
    </section>
  )
}
