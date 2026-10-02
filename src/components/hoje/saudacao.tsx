'use client'

import { useState, useTransition } from 'react'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { salvarMeuNome } from '@/server/usuarios/acoes'
import { erroLegivel } from '@/core/erro-legivel'

function primeiro(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome
}

/**
 * "Bom dia, Daniel".
 *
 * Sem nome guardado, a saudação fica só no "Bom dia" e oferece o lugar de
 * dizer o nome. Antes ela usava o pedaço do e-mail antes da arroba, e
 * cumprimentava o dono do MGM como "dono-1790942173414".
 */
export function Saudacao({
  saudacao, nome: inicial, podeNomear,
}: {
  saudacao: string
  nome: string | null
  /** o profissional tem nome pela grade; para ele não há o que perguntar */
  podeNomear: boolean
}) {
  const [nome, setNome] = useState(inicial)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()

  return (
    <>
      {nome ? `${saudacao}, ${primeiro(nome)}` : saudacao}
      {!nome && podeNomear ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="ml-3 cursor-pointer align-middle font-sans text-[14px] font-medium tracking-normal text-marca underline underline-offset-2"
        >
          Adicionar seu nome
        </button>
      ) : null}

      {aberto ? (
        <ModalFormulario
          aberto
          glifo="✎"
          titulo="Seu nome"
          sub="Aparece na saudação e para a equipe, na lista de usuários."
          primario="Salvar"
          largura="confirmacao"
          pendente={pendente}
          aoFechar={() => { setAberto(false); setErro(null) }}
          aoEnviar={(f) => iniciar(async () => {
            const novo = String(f.get('nome') ?? '').trim()
            try {
              await salvarMeuNome(novo)
              setNome(novo)
              setAberto(false)
              avisar({ texto: 'Nome salvo' })
            } catch (e) {
              setErro(erroLegivel(e))
            }
          })}
        >
          <Campo rotulo="Nome" htmlFor="meu-nome">
            <input id="meu-nome" name="nome" required maxLength={80} autoFocus
              autoComplete="name" placeholder="Exemplo: Ana Paula Souza" className={entrada} />
          </Campo>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}
