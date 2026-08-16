'use client'

import { useState, useTransition } from 'react'
import { cancelarSessao } from '@/server/agenda/acoes'
import { Modal } from '@/components/ui/modal'
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
        iniciar(() => cancelarSessao(sessaoId, m))
      }}
    >
      <p className="text-[13px] leading-[1.55] text-tinta-media">
        <strong className="font-medium text-tinta">
          {quantasPessoas} pessoa(s) serão avisadas.
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
          placeholder="Ex.: professora doente, sala interditada"
          className={entrada}
        />
      </div>
    </Modal>
  )
}
