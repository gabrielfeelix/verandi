'use client'

import { useState, useTransition } from 'react'
import { cancelarSessao, reabrirSessao } from '@/server/agenda/acoes'
import { Modal } from '@/components/ui/modal'
import { Botao } from '@/components/ui/botao'
import { useAviso } from '@/components/ui/desfazer'
import { Rotulo, entrada } from '@/components/ui/pecas'
import { useChamada } from './chamada'

/**
 * Cancelar o horário inteiro.
 *
 * `confirm()` do navegador não cabia aqui: ele não diz o que acontece com o que
 * já existe, não dá para ler com calma e aparece com a cara do sistema
 * operacional no meio do produto. O motivo é obrigatório porque "cancelada" sem
 * motivo é a linha que ninguém consegue explicar três semanas depois.
 */
export function ModalCancelar({
  sessaoId, titulo, quantasPessoas,
}: {
  sessaoId: string
  /** "Pilates Solo 09:00" */
  titulo: string
  quantasPessoas: number
}) {
  const { cancelarAberto, fecharCancelar } = useChamada()
  const avisar = useAviso()
  const [pendente, iniciar] = useTransition()
  const [motivo, setMotivo] = useState('')

  return (
    <Modal
      aberto={cancelarAberto}
      perigo
      largura="confirmacao"
      titulo={`Cancelar ${titulo}?`}
      primario="Cancelar turma"
      secundario="Voltar"
      pendente={pendente || motivo.trim().length === 0}
      aoFechar={() => { setMotivo(''); fecharCancelar() }}
      aoConfirmar={() => {
        const m = motivo.trim()
        if (!m) return
        setMotivo('')
        fecharCancelar()
        iniciar(async () => {
          await cancelarSessao(sessaoId, m)
          avisar({ texto: 'Turma cancelada', desfazer: () => iniciar(() => reabrirSessao(sessaoId)) })
        })
      }}
    >
      <p className="text-[14.5px] leading-[1.55] text-tinta-media">
        <strong className="font-medium text-tinta">
          {quantasPessoas === 1 ? '1 pessoa será avisada.' : `${quantasPessoas} pessoas serão avisadas.`}
        </strong>{' '}
        O horário continua na agenda, riscado e com o motivo escrito, quem tem
        vaga fixa neste horário ganha crédito de reposição.
      </p>

      <div className="flex flex-col gap-1.5 pb-1">
        <label htmlFor="motivo">
          <Rotulo>Motivo</Rotulo>
        </label>
        <input
          id="motivo"
          name="motivo"
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Exemplo: profissional doente, sala interditada"
          className={entrada}
        />
      </div>
    </Modal>
  )
}

/**
 * O caminho de volta de um cancelamento, para depois que o "Desfazer" sumiu.
 *
 * Sem confirmação: reabrir não destrói nada. Quem saiu com crédito volta para a
 * lista, menos quem já usou o crédito numa reposição (`devolverASessao`).
 */
export function BotaoReabrir({ sessaoId }: { sessaoId: string }) {
  const avisar = useAviso()
  const [pendente, iniciar] = useTransition()
  return (
    <Botao
      tom="secundario"
      disabled={pendente}
      onClick={() => iniciar(async () => {
        await reabrirSessao(sessaoId)
        avisar({ texto: 'Turma reaberta' })
      })}
    >
      {pendente ? 'Reabrindo…' : 'Reabrir turma'}
    </Botao>
  )
}
