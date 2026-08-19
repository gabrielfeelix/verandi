'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { Campo, ListaImpacto, entrada } from '@/components/ui/pecas'
import { anonimizarPessoa, editarPessoa } from '@/server/pessoas/acoes'
import { CampoData } from '@/components/ui/campo-data'

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
        <p className="text-[14px] leading-[1.55] text-tinta-media">
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
 * Atender ao pedido de exclusão do titular do dado.
 *
 * Fica longe de "Editar" e de "Marcar inativa", no pé da coluna lateral, porque
 * é a única ação da ficha que não tem volta. Quem procura isto está com um
 * pedido na mão; quem não está não deve tropeçar nela.
 *
 * Só o dono vê. Recepção atende quem liga, mas decidir que um cadastro some é
 * responsabilidade de quem responde pelo negócio perante o titular.
 */
export function AtenderPedidoDeExclusao({
  pessoaId, nome,
}: {
  pessoaId: string
  nome: string
}) {
  const [aberto, setAberto] = useState(false)
  const [confere, setConfere] = useState('')
  const [pendente, iniciar] = useTransition()

  // digitar o nome não é cerimônia: é o que separa "cliquei sem ler" de "eu
  // quis", e aqui não existe desfazer para consertar depois
  const pode = confere.trim().toLowerCase() === nome.trim().toLowerCase()

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="cursor-pointer self-start text-[13px] text-tinta-fraca underline underline-offset-2 hover:text-alerta"
      >
        Atender pedido de exclusão
      </button>

      <Modal
        aberto={aberto}
        perigo
        largura="lista"
        titulo={`Apagar os dados de ${nome}?`}
        sub="O pedido do titular, cumprido. Não é possível desfazer."
        primario="Apagar os dados"
        secundario="Voltar"
        pendente={pendente || !pode}
        aoFechar={() => { setAberto(false); setConfere('') }}
        aoConfirmar={() => {
          if (!pode) return
          setAberto(false)
          setConfere('')
          iniciar(() => anonimizarPessoa(pessoaId))
        }}
      >
        <ListaImpacto
          rotulo="O que sai"
          itens={[
            { titulo: 'Nome, telefone, e-mail e nascimento', meta: 'apagados' },
            { titulo: 'Observação da ficha e marcações', meta: 'apagadas' },
            { titulo: 'Observação escrita nas chamadas', meta: 'apagada' },
          ]}
        />
        <ListaImpacto
          rotulo="O que fica"
          itens={[
            { titulo: 'Presença, falta e reposição', meta: 'sem nome' },
            { titulo: 'A contagem de cada horário', meta: 'continua batendo' },
          ]}
        />
        <p className="text-[14px] leading-[1.55] text-tinta-media">
          A linha continua existindo sem nada que identifique alguém, porque
          apagar de vez levaria junto a presença de todo mundo que estava na
          mesma aula. Fica registrado quem atendeu ao pedido e quando.
        </p>
        <Campo rotulo={`Escreva "${nome}" para confirmar`} htmlFor="confere-exclusao" obrigatorio>
          <input
            id="confere-exclusao"
            value={confere}
            onChange={(e) => setConfere(e.target.value)}
            className={entrada}
            autoComplete="off"
          />
        </Campo>
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
      className="flex w-9 shrink-0 items-center justify-center rounded-padrao border border-linha bg-superficie font-mono text-[13px] text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
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
        <Campo rotulo="Vence em" htmlFor="renovacao" obrigatorio>
          {/* o campo de data nativo aceitava ano de seis dígitos ("05/04/555555");
              o nosso escreve as barras e para em quatro */}
          <CampoData
            id="renovacao" nome="vencimento" valorInicial={data}
            aoTrocar={setData} limpavel={false}
          />
        </Campo>
      </Modal>
    </>
  )
}
