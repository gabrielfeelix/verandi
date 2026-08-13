'use client'

import { useState, useTransition } from 'react'
import { editarPessoa } from '@/server/pessoas/acoes'

type Pessoa = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  identificadorExterno: string | null
  nascimento: string | null
  vencimentoPlano: string | null
  observacao: string | null
  ativo: boolean
}

export function EditarPessoa({ pessoa }: { pessoa: Pessoa }) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)}
        className="self-start rounded border px-3 py-2"
      >
        Editar dados
      </button>
    )
  }

  return (
    <form
      className="flex flex-col gap-3 rounded border p-3"
      action={(f) => {
        iniciar(async () => {
          await editarPessoa(pessoa.id, {
            nome: String(f.get('nome') ?? ''),
            telefone: String(f.get('telefone') ?? ''),
            email: String(f.get('email') ?? ''),
            identificadorExterno: String(f.get('identificador') ?? ''),
            nascimento: String(f.get('nascimento') ?? ''),
            // data que avisa, não valor que cobra — financeiro é outro produto
            vencimentoPlano: String(f.get('vencimento') ?? ''),
            observacao: String(f.get('observacao') ?? ''),
            ativo: f.get('ativo') === 'on',
          })
          setAberto(false)
        })
      }}
    >
      {([
        ['nome', 'Nome', 'text', pessoa.nome],
        ['telefone', 'Telefone', 'text', pessoa.telefone ?? ''],
        ['email', 'E-mail', 'email', pessoa.email ?? ''],
        ['identificador', 'Identificador', 'text', pessoa.identificadorExterno ?? ''],
        ['nascimento', 'Nascimento', 'date', pessoa.nascimento ?? ''],
        ['vencimento', 'Vencimento do plano', 'date', pessoa.vencimentoPlano ?? ''],
      ] as const).map(([n, r, t, v]) => (
        <div key={n} className="flex flex-col gap-1">
          <label htmlFor={n}>{r}</label>
          <input id={n} name={n} type={t} defaultValue={v}
                 className="rounded border px-3 py-2" />
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor="observacao">Observação</label>
        <textarea
          id="observacao" name="observacao" rows={3}
          defaultValue={pessoa.observacao ?? ''}
          className="rounded border px-3 py-2"
        />
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="ativo" defaultChecked={pessoa.ativo} />
        Ativa
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="rounded border px-3 py-2">
          Salvar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="px-2 underline">
          Cancelar
        </button>
      </div>
    </form>
  )
}
