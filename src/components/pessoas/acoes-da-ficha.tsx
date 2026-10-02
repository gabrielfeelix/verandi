'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { Campo, ListaImpacto, entrada } from '@/components/ui/pecas'
import { anonimizarPessoa, editarPessoa } from '@/server/pessoas/acoes'
import { CampoData } from '@/components/ui/campo-data'
import { useAviso } from '@/components/ui/desfazer'

/**
 * Inativar: some do padrão das listas e **continua no histórico**.
 *
 * Pede confirmação porque é a ação que mais parece "apagar" sem ser, e a
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
  const avisar = useAviso()

  return (
    <>
      <Botao tom="secundario" className="w-full" onClick={() => setAberto(true)}>
        {ativo ? 'Inativar' : 'Reativar'}
      </Botao>

      <Modal
        aberto={aberto}
        perigo={ativo}
        largura="confirmacao"
        titulo={ativo ? `Inativar o cadastro de ${nome}?` : `Reativar o cadastro de ${nome}?`}
        primario={ativo ? 'Inativar' : 'Reativar'}
        secundario="Voltar"
        pendente={pendente}
        aoFechar={() => setAberto(false)}
        aoConfirmar={() => {
          setAberto(false)
          iniciar(async () => {
            await editarPessoa(pessoaId, { ativo: !ativo })
            avisar({ texto: ativo ? 'Cadastro inativado' : 'Cadastro reativado' })
          })
        }}
      >
        <p className="text-[14px] leading-[1.55] text-tinta-media">
          {ativo
            ? `Sai da lista padrão de ${rotuloPessoa.toLowerCase()} e das escolhas de horário novo. ` +
              'Nada é apagado: presenças, faltas e reposições continuam no histórico.'
            : 'Volta para a lista padrão e para as escolhas de horário novo. O histórico já estava lá o tempo todo.'}
        </p>
      </Modal>
    </>
  )
}

/**
 * O aviso de "cadastrado" mora na ficha, não no formulário: cadastrar navega
 * para a pessoa nova, e o aviso disparado antes da troca de tela sumia com ela.
 * O `?novo=1` sai da URL para que recarregar não repita o aviso.
 */
export function AvisoDeCadastro() {
  const avisar = useAviso()
  const router = useRouter()
  const caminho = usePathname()
  const feito = useRef(false)
  useEffect(() => {
    if (feito.current) return
    feito.current = true
    avisar({ texto: 'Cadastro criado' })
    router.replace(caminho, { scroll: false })
  }, [avisar, router, caminho])
  return null
}

/**
 * Atender ao pedido de exclusão do titular do dado.
 *
 * Mora junto de "Editar" e "Inativar", no topo da ficha, desde
 * 01/out/2026: no pé da coluna lateral ninguém achava. A proteção contra o
 * clique distraído não é a distância, é o modal, que pede o nome digitado.
 *
 * **Discreta não é escondida, e a diferença custou três mensagens.** Quem
 * testou procurou como excluir e não achou: *"não tem opção de excluir aluno /
 * pera / escondido / achei"*. Era um texto sublinhado em cinza claro, que não
 * se lê como coisa clicável, e a palavra que ele procurava, "excluir", não
 * aparecia em lugar nenhum: o rótulo dizia "Atender pedido de exclusão", que é
 * o nome certo do ato e o termo errado para procurar.
 *
 * O lugar continua o mesmo, e a confirmação também. O que muda é dar a ela
 * forma de botão e as duas palavras: quem tem o pedido na mão acha, e quem não
 * tem continua sem esbarrar, porque ela segue no pé da coluna, em cinza, longe
 * das ações do dia.
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
        className="min-h-11 w-full cursor-pointer rounded-media border border-linha bg-superficie px-4 text-[14.5px] text-alerta transition-colors hover:border-alerta-linha hover:bg-alerta-superficie"
      >
        Excluir dados
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
 * Valor, forma de pagamento e recibo não moram aqui: isso é financeiro, e
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
  // sem data ainda não há o que renovar: "Registrar renovação" de um plano que
  // nunca teve vencimento fazia a recepção procurar a renovação anterior
  const rotulo = vencimento ? 'Registrar renovação' : 'Definir vencimento'

  return (
    <>
      <Botao tom="secundario" className="w-full" onClick={() => setAberto(true)}>
        {rotulo}
      </Botao>

      <Modal
        aberto={aberto}
        glifo="↺"
        largura="confirmacao"
        titulo={rotulo}
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
