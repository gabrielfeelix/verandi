'use client'

import { useState, useTransition } from 'react'
import { editarPessoa } from '@/server/pessoas/acoes'
import { Botao } from '@/components/ui/botao'

type Pessoa = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  identificadorExterno: string | null
  nascimento: string | null
  vencimentoPlano: string | null
  observacao: string | null
  observacaoVisivel: 'profissionais' | 'todos'
  /** existe anotação de quem atende, e quem está lendo não pode vê-la */
  observacaoRestrita: boolean
  ativo: boolean
}

export function EditarPessoa({
  pessoa, className = '',
}: {
  pessoa: Pessoa
  /** para o par de botões da ficha dividir a largura por igual */
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [visivel, setVisivel] = useState(pessoa.observacaoVisivel)

  if (!aberto) {
    return (
      <Botao tom="secundario" onClick={() => setAberto(true)} className={className}>
        Editar dados
      </Botao>
    )
  }

  return (
    <form
      className="flex w-[min(420px,80vw)] flex-col gap-3 rounded-grande border border-linha-suave bg-superficie-suave p-3.5"
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
            /*
              * Restrita, a observação nem vai no pacote: mandar `''` daqui
              * apagaria a anotação de quem atende, e o servidor recusaria a
              * gravação inteira junto com o resto do formulário.
              */
            ...(pessoa.observacaoRestrita
              ? {}
              : {
                  observacao: String(f.get('observacao') ?? ''),
                  observacaoVisivel: visivel,
                }),
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
                 className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]" />
        </div>
      ))}

      {pessoa.observacaoRestrita ? (
        <p className="rounded-padrao border border-linha-suave bg-superficie px-3 py-2.5 text-[12.5px] leading-relaxed text-tinta-media">
          A observação desta ficha foi escrita para quem atende. O resto dos
          dados continua editável daqui.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor="observacao">Observação</label>
          <textarea
            id="observacao" name="observacao" rows={3}
            defaultValue={pessoa.observacao ?? ''}
            className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
          />
          {/* quem escreve escolhe quem lê, na hora de escrever: é o único
              momento em que a pessoa sabe se está anotando "prefere a maca do
              fundo" ou "hérnia de disco". O padrão fecha, e é decisão. */}
          <fieldset className="flex flex-col gap-1.5 pt-1.5">
            <legend className="pb-1.5 text-[11px] font-semibold tracking-[.08em] text-tinta-media uppercase">
              Visível para
            </legend>
            {([
              ['profissionais', 'Só quem atende'],
              ['todos', 'Todo mundo da conta'],
            ] as const).map(([valor, texto]) => (
              <label key={valor} className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio" name="observacaoVisivel" value={valor}
                  checked={visivel === valor}
                  onChange={() => setVisivel(valor)}
                />
                {texto}
              </label>
            ))}
            <p className="text-[11.5px] text-tinta-media">
              {visivel === 'profissionais'
                ? 'A recepção não lê. É onde vai o que é de saúde.'
                : 'Aparece para quem abrir esta ficha, inclusive a recepção.'}
            </p>
          </fieldset>
        </div>
      )}

      <label className="flex items-center gap-2">
        <input type="checkbox" name="ativo" defaultChecked={pessoa.ativo} />
        Ativa
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
          Salvar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="px-2 underline">
          Cancelar
        </button>
      </div>
    </form>
  )
}
