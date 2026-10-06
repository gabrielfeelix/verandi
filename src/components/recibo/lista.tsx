'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from '@/components/ui/menu'
import { EnviarRecibo } from './enviar'
import { ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Nota, Vazio, entrada } from '@/components/ui/pecas'
import { CELULA, CELULA_FIXA, Cabecalho, LINHA, Tabela, Th } from '@/components/ui/tabela'
import { useAviso } from '@/components/ui/desfazer'
import { cancelarRecibo, corrigirRecibo } from '@/server/recibo/acoes'
import type { ReciboLinha } from '@/server/recibo/consultas'
import { descricaoDoRecibo, motivoDoRecibo } from '@/core/recibo/recibo'
import { emReais } from '@/core/planos/plano'
import { dataCurta } from '@/core/agenda/datas'
import { erroLegivel } from '@/core/erro-legivel'

const TINTA: Record<string, string> = {
  valido: 'bg-positivo-fundo text-positivo',
  cancelado: 'bg-alerta-fundo text-alerta',
  substituido: 'bg-neutro-fundo text-tinta-media',
}

const ROTULO: Record<string, string> = {
  valido: 'Válido',
  cancelado: 'Cancelado',
  substituido: 'Substituído',
}

/**
 * O arquivo de recibos.
 *
 * É o "deverá ser arquivado" do documento: o cliente guarda em pasta de papel
 * porque não tinha onde, e o que ele quer é achar depois. Cancelado e
 * substituído continuam na lista, porque a via antiga continua na mão de
 * alguém e é preciso poder explicá-la.
 */
export function ListaDeRecibos({
  linhas, envios = {}, emails = {},
}: {
  linhas: ReciboLinha[]
  /** o último envio de cada recibo, por id: responde "já mandei isso?" */
  envios?: Record<string, { para: string; em: string }>
  /** o e-mail da ficha de cada pagador, por id de pessoa */
  emails?: Record<string, string>
}) {
  const [modo, setModo] = useState<
    { tipo: 'cancelar' | 'corrigir'; r: ReciboLinha } | null
  >(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function agir(
    fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, texto: string,
  ) {
    setErro(null)
    comecar(async () => {
      try {
        const r = await fn()
        if (!r.ok) return setErro(r.erro)
        avisar({ texto })
        setModo(null)
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  if (linhas.length === 0) {
    return (
      <Vazio
        icone="lista"
        desenho="dinheiro"
        titulo="Nenhum recibo ainda"
        texto="Para emitir, abra o menu de uma cobrança paga em Cobranças e escolha Emitir recibo."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        * Tabela, como Cobranças: número, pessoa, valor e situação em coluna
        * fixa, tenha a linha três ações ou nenhuma. Corrigir e cancelar moram
        * no "⋮"; enviar fica à vista, porque mandar o comprovante é o que se
        * faz com um recibo tanto quanto imprimi-lo.
        */}
      <Tabela largura={900} rotulo="Recibos">
        <Cabecalho>
          <Th fixa>Recibo</Th>
          <Th>Emitido em</Th>
          <Th className="text-right">Valor</Th>
          <Th>Situação</Th>
          <Th>Envio</Th>
          <Th className="text-right"><span className="sr-only">Ações</span></Th>
        </Cabecalho>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.id} className={LINHA}>
              <td className={CELULA_FIXA}>
                <span className="flex min-w-[220px] items-center gap-3">
                  <Avatar nome={r.pessoaNome} tamanho={32} decorativo />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/recibos/${r.id}`}
                      className={`truncate text-[14.5px] font-medium hover:text-marca ${
                        r.status === 'cancelado' ? 'text-tinta-media line-through' : ''
                      }`}
                    >
                      {descricaoDoRecibo(r)}
                    </Link>
                    <span className="truncate text-[13.5px] text-tinta-media">{r.pessoaNome}</span>
                    {r.motivo ? (
                      <span className="max-w-[320px] text-[12px] whitespace-normal text-tinta-media">
                        {motivoDoRecibo(r.status, r.motivo)}
                      </span>
                    ) : null}
                  </span>
                </span>
              </td>

              <td className={`${CELULA} text-[13.5px] whitespace-nowrap text-tinta-media`}>
                {dataCurta(r.emitidoEm.slice(0, 10))}
              </td>

              {/* coluna de dinheiro que dança não se soma de olho */}
              <td className={`${CELULA} text-right text-[14.5px] whitespace-nowrap tabular-nums`}>
                {emReais(r.valorCent)}
              </td>

              <td className={CELULA}>
                <span
                  className={`inline-block rounded-peca px-2.5 py-[5px] text-[12px] font-medium whitespace-nowrap ${TINTA[r.status]}`}
                >
                  {ROTULO[r.status]}
                </span>
              </td>

              <td className={CELULA}>
                <span className="flex flex-col items-start gap-1">
                  {/* recibo cancelado ou substituído não vale como comprovante:
                      mandar por e-mail seria mandar um papel que diz "CANCELADO" */}
                  {r.status === 'valido' ? (
                    <EnviarRecibo
                      reciboId={r.id}
                      numero={descricaoDoRecibo(r)}
                      pagadorNome={r.pessoaNome}
                      emailDaFicha={r.pessoaId ? emails[r.pessoaId] ?? null : null}
                      botao="linha"
                      jaEnviado={envios[r.id] ?? null}
                    />
                  ) : null}
                  {envios[r.id] ? (
                    <span className="text-[12px] whitespace-nowrap text-tinta-media">
                      Enviado para {envios[r.id].para} em {envios[r.id].em}
                    </span>
                  ) : r.status === 'valido' ? null : (
                    <span className="text-[13.5px] text-tinta-fraca">Não se aplica</span>
                  )}
                </span>
              </td>

              <td className={CELULA}>
                <span className="flex justify-end gap-2">
                  <Link
                    href={`/recibos/${r.id}`}
                    className="inline-flex min-h-9 items-center rounded-peca border border-linha bg-superficie px-3 text-[13.5px] font-medium whitespace-nowrap hover:bg-superficie-mais-suave"
                  >
                    Ver e imprimir
                  </Link>
                  {r.status === 'valido' ? (
                    <Menu
                      titulo={`Mais sobre o recibo ${descricaoDoRecibo(r)}`}
                      itens={[
                        {
                          rotulo: 'Corrigir o texto',
                          icone: 'lapis',
                          aoEscolher: () => setModo({ tipo: 'corrigir', r }),
                        },
                        {
                          rotulo: 'Cancelar o recibo',
                          icone: 'proibido',
                          perigo: true,
                          aoEscolher: () => setModo({ tipo: 'cancelar', r }),
                        },
                      ]}
                    />
                  ) : (
                    // o vazio ocupa o lugar do menu: "Ver e imprimir" fica no prumo
                    <span aria-hidden className="w-9" />
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {/* o botão de fechar não pode se chamar "Cancelar" numa tela cuja ação é
          cancelar: os dois ficavam lado a lado dizendo a mesma palavra para
          coisas opostas */}
      {modo?.tipo === 'cancelar' ? (
        <ModalFormulario
          aberto
          glifo="⨯"
          tom="alerta"
          titulo="Cancelar o recibo"
          sub={descricaoDoRecibo(modo.r)}
          primario="Confirmar cancelamento"
          secundario="Voltar"
          perigo
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => agir(
            () => cancelarRecibo(modo.r.id, String(f.get('motivo') ?? '')),
            'Recibo cancelado')}
        >
          <Campo rotulo="Motivo" htmlFor="rc-motivo" obrigatorio>
            <input
              id="rc-motivo" name="motivo" maxLength={120} className={entrada}
              placeholder="Exemplo: valor errado, emitido para a pessoa errada"
            />
          </Campo>
          <Nota tom="atencao">
            O número continua ocupado e o recibo continua na lista, com o motivo
            à vista. Buraco na numeração é a primeira coisa que uma fiscalização
            pergunta.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {modo?.tipo === 'corrigir' ? (
        <ModalFormulario
          aberto
          glifo="✎"
          tom="neutro"
          titulo="Corrigir o recibo"
          sub={descricaoDoRecibo(modo.r)}
          primario="Corrigir"
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => agir(() => corrigirRecibo(modo.r.id, {
            pagadorNome: String(f.get('nome') ?? ''),
            pagadorDocumento: String(f.get('documento') ?? ''),
            referente: String(f.get('referente') ?? ''),
          }, String(f.get('motivo') ?? '')), 'Recibo corrigido')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome de quem pagou" htmlFor="rr-nome">
              <input
                id="rr-nome" name="nome" maxLength={120} className={entrada}
                defaultValue={modo.r.corpo.pagadorNome}
              />
            </Campo>
            <Campo rotulo="CPF de quem pagou" htmlFor="rr-doc">
              <input
                id="rr-doc" name="documento" maxLength={14} className={entrada}
                defaultValue={modo.r.corpo.pagadorDocumento ?? ''}
              />
            </Campo>
          </div>
          <Campo rotulo="Referente a" htmlFor="rr-ref">
            <input
              id="rr-ref" name="referente" maxLength={160} className={entrada}
              defaultValue={modo.r.corpo.referente}
            />
          </Campo>
          <Campo rotulo="O que estava errado" htmlFor="rr-motivo" obrigatorio>
            <input
              id="rr-motivo" name="motivo" maxLength={120} className={entrada}
              placeholder="Exemplo: nome incompleto"
            />
          </Campo>
          <Nota tom="neutro">
            Sai um recibo novo com o mesmo número e a correção anotada, e o
            anterior fica guardado como substituído: a via impressa continua na
            pasta de quem pagou, e o sistema não pode discordar dela.
            {' '}O valor não muda aqui: valor errado se resolve estornando o
            pagamento e registrando o certo.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {erro && !modo ? <Nota tom="alerta">{erro}</Nota> : null}
    </div>
  )
}

function Miudo({
  children, perigo = false, ...resto
}: {
  children: React.ReactNode
  perigo?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      className={`min-h-9 cursor-pointer rounded-peca border px-3 text-[13.5px] disabled:opacity-50 ${
        perigo
          ? 'border-alerta-linha bg-superficie text-alerta hover:bg-alerta-superficie'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {children}
    </button>
  )
}
