'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { criarPessoa } from '@/server/pessoas/acoes'

/**
 * Cadastro com **nome apenas** como mínimo. Exigir telefone é o jeito mais
 * rápido de fazer a recepção inventar um número.
 *
 * Em modal, como no protótipo e como todo criar-item do sistema (Configuração
 * faz assim em Modalidades, Salas e Professores). Antes isto abria uma faixa de
 * campos embutida no cabeçalho da lista: ela empurrava o título e os filtros
 * para o lado, ficava flutuando sobre a tabela e não tinha onde crescer quando
 * o formulário ganhou identificador. Formulário que nasce dentro de um
 * cabeçalho é formulário que não cabe.
 */
export function NovaPessoa({
  rotuloPessoa, aoCriar,
}: {
  rotuloPessoa: string
  aoCriar?: (id: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const rotulo = rotuloPessoa.toLowerCase()

  function fechar() {
    setAberto(false)
    setErro(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-11 rounded-padrao bg-escuro px-3.5 text-[13px] font-medium text-tinta-clara hover:bg-escuro-hover"
      >
        Cadastrar {rotulo}
      </button>

      {aberto ? (
        <ModalFormulario
          aberto
          glifo="+"
          titulo={`Cadastrar ${rotulo}`}
          sub="só o nome é obrigatório"
          primario="Cadastrar"
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => iniciar(async () => {
            setErro(null)
            try {
              const { id } = await criarPessoa({
                nome: String(f.get('nome') ?? ''),
                telefone: String(f.get('telefone') ?? ''),
                identificadorExterno: String(f.get('identificador') ?? ''),
              })
              fechar()
              if (aoCriar) aoCriar(id)
              else router.push(`/pessoas/${id}`)
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'não deu para cadastrar')
            }
          })}
        >
          <Campo rotulo="Nome" htmlFor="np-nome">
            <input id="np-nome" name="nome" required autoFocus className={entrada} />
          </Campo>

          <div className="flex flex-wrap gap-3">
            <Campo rotulo="Telefone" dica="opcional" htmlFor="np-fone">
              <input
                id="np-fone" name="telefone" type="tel" inputMode="tel"
                placeholder="(11) 99999-9999"
                className={`${entrada} min-w-[180px]`}
              />
            </Campo>
            <Campo
              rotulo="Identificador" dica="opcional" htmlFor="np-id"
            >
              <input
                id="np-id" name="identificador"
                placeholder="o número da ficha antiga"
                className={`${entrada} min-w-[150px]`}
              />
            </Campo>
          </div>

          <Nota>
            Sem telefone não dá para avisar cancelamento nem cobrar reposição —
            é o campo que mais falta e mais custa. Dá para preencher depois, na
            ficha.
          </Nota>

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}
