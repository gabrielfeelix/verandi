'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { CampoData } from '@/components/ui/campo-data'
import { Chip } from '@/components/ui/pecas'

/** Hoje mais `dias`, no relógio de quem está na tela. */
function daqui(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

const ATALHOS: Array<[string, number]> = [
  ['1 semana', 7],
  ['15 dias', 15],
  ['1 mês', 30],
  ['2 meses', 60],
]

/**
 * "Quando volta?", a pergunta que transforma licença em acompanhamento.
 *
 * Abre depois do toque em "Licença" na chamada, e em "Prorrogar" de
 * Pendências. Os atalhos existem porque a resposta da aluna quase nunca é uma
 * data: é "umas duas semanas", "um mês". Pular é válido; a licença sem data
 * também aparece em Pendências, só que sem o lembrete do dia.
 */
export function ModalVolta({
  aberto, nome, valorInicial = '', aoFechar, aoSalvar, pendente = false, pulavel = true,
}: {
  aberto: boolean
  nome: string
  valorInicial?: string
  aoFechar: () => void
  aoSalvar: (data: string | null) => void
  pendente?: boolean
  /** na chamada dá para seguir sem data; em Prorrogar o botão é "Cancelar" */
  pulavel?: boolean
}) {
  const [data, setData] = useState(valorInicial)
  // o CampoData guarda o próprio estado: trocar a chave faz ele aceitar o atalho
  const [versao, setVersao] = useState(0)

  return (
    <Modal
      aberto={aberto}
      icone="licenca"
      tom="licenca"
      titulo="Quando volta?"
      sub={`${nome} fica em licença com o horário guardado. Na data de volta, o nome aparece em Pendências para alguém entrar em contato.`}
      primario="Salvar data"
      aoConfirmar={() => aoSalvar(data || null)}
      secundario={pulavel ? 'Sem data por enquanto' : 'Cancelar'}
      aoFechar={aoFechar}
      pendente={pendente}
      largura="confirmacao"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ATALHOS.map(([rotulo, dias]) => {
            const alvo = daqui(dias)
            return (
              <Chip
                key={rotulo}
                type="button"
                ativo={data === alvo}
                onClick={() => { setData(alvo); setVersao((v) => v + 1) }}
              >
                {rotulo}
              </Chip>
            )
          })}
        </div>
        <CampoData
          key={versao}
          nome="volta"
          valorInicial={data}
          aoTrocar={setData}
        />
      </div>
    </Modal>
  )
}
