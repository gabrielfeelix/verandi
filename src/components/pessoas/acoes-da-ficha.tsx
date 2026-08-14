'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { Campo, entrada } from '@/components/ui/pecas'
import { editarPessoa } from '@/server/pessoas/acoes'

/**
 * Marcar inativa: some do padrão das listas e **continua no histórico**.
 *
 * Pede confirmação porque é a ação que mais parece "apagar" sem ser — e a
 * confirmação existe justamente para dizer que não é.
 */
export function MarcarInativa({
  pessoaId, nome, ativo, rotuloPessoa,
}: {
  pessoaId: string
  nome: string
  ativo: boolean
  rotuloPessoa: string
}) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()

  return (
    <>
      <Botao tom="secundario" className="flex-1" onClick={() => setAberto(true)}>
        {ativo ? 'Marcar inativa' : 'Reativar'}
      </Botao>

      <Modal
        aberto={aberto}
        perigo={ativo}
        largura="confirmacao"
        titulo={ativo ? `Marcar ${nome} como inativa?` : `Reativar ${nome}?`}
        primario={ativo ? 'Marcar inativa' : 'Reativar'}
        secundario="Voltar"
        pendente={pendente}
        aoFechar={() => setAberto(false)}
        aoConfirmar={() => {
          setAberto(false)
          iniciar(() => editarPessoa(pessoaId, { ativo: !ativo }))
        }}
      >
        <p className="text-[13px] leading-[1.55] text-tinta-media">
          {ativo
            ? `Sai da lista padrão de ${rotuloPessoa.toLowerCase()} e das escolhas de horário novo. ` +
              'Nada é apagado: as presenças, as faltas e as reposições continuam ' +
              'no histórico, e o março dela continua sendo março.'
            : 'Volta para a lista padrão e para as escolhas de horário novo. O histórico já estava lá o tempo todo.'}
        </p>
      </Modal>
    </>
  )
}

/**
 * Copiar o telefone.
 *
 * Parece supérfluo e é o contrário: quem atende passa o dia mandando mensagem
 * para quem faltou, e selecionar um telefone com o mouse dentro de um cartão é
 * a microtarefa que mais se repete e mais escapa.
 */
export function CopiarTelefone({ telefone }: { telefone: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      title="Copiar telefone"
      aria-label="Copiar telefone"
      onClick={() => {
        navigator.clipboard.writeText(telefone)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      }}
      className="flex w-9 shrink-0 items-center justify-center rounded-padrao border border-linha bg-superficie font-mono text-[12px] text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
    >
      <span aria-hidden>{copiado ? '✓' : '⧉'}</span>
      <span className="sr-only" role="status">
        {copiado ? 'telefone copiado' : ''}
      </span>
    </button>
  )
}

/**
 * Registrar renovação: mexe numa data só, e é a única coisa de plano que a
 * agenda sabe.
 *
 * Valor, forma de pagamento e recibo não moram aqui — isso é financeiro, e
 * misturar os dois é como um sistema de agenda vira um ERP ruim.
 */
export function RegistrarRenovacao({
  pessoaId, vencimento,
}: {
  pessoaId: string
  vencimento: string | null
}) {
  const [aberto, setAberto] = useState(false)
  const [data, setData] = useState(vencimento ?? '')
  const [pendente, iniciar] = useTransition()

  return (
    <>
      <Botao tom="secundario" className="w-full" onClick={() => setAberto(true)}>
        Registrar renovação
      </Botao>

      <Modal
        aberto={aberto}
        glifo="↺"
        largura="confirmacao"
        titulo="Registrar renovação"
        sub="A agenda guarda só até quando o plano vale."
        primario="Salvar"
        pendente={pendente}
        aoFechar={() => setAberto(false)}
        aoConfirmar={() => {
          if (!data) return
          setAberto(false)
          iniciar(() => editarPessoa(pessoaId, { vencimentoPlano: data }))
        }}
      >
        <Campo rotulo="Vence em" htmlFor="renovacao">
          <input
            id="renovacao"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={entrada}
          />
        </Campo>
      </Modal>
    </>
  )
}
