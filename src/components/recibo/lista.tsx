'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from '@/components/ui/menu'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, Vazio, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { cancelarRecibo, corrigirRecibo } from '@/server/recibo/acoes'
import type { ReciboLinha } from '@/server/recibo/consultas'
import { descricaoDoRecibo } from '@/core/recibo/recibo'
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
export function ListaDeRecibos({ linhas }: { linhas: ReciboLinha[] }) {
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
        titulo="Nenhum recibo ainda"
        texto="O recibo nasce de um pagamento, no Financeiro: a linha de quem pagou tem o botão de emitir. Nem todo pagamento precisa virar papel."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        * Cada linha tem as mesmas colunas, tenha ela três ações ou nenhuma.
        *
        * Antes, corrigir e cancelar só existiam no recibo válido e ficavam
        * soltos ao lado do valor: a lista com um cancelado no meio saía com
        * número, valor e etiqueta em posições diferentes a cada linha, e o
        * olho perde a coluna que ele estava seguindo. Agora as ações do fim
        * moram no menu, como no Financeiro, e o que varia é o conteúdo do
        * menu, não a largura de nada.
        */}
      {linhas.map((r) => (
        <div
          key={r.id}
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-media border bg-superficie px-3.5 py-3 ${
            r.status === 'cancelado'
              ? 'border-alerta-linha' : 'border-linha-suave'
          }`}
        >
          <span className="flex min-w-[210px] flex-1 flex-col">
            <Link
              href={`/recibos/${r.id}`}
              className={`font-mono text-[13.5px] font-medium hover:underline ${
                r.status === 'cancelado' ? 'text-tinta-media line-through' : ''
              }`}
            >
              {descricaoDoRecibo(r)}
            </Link>
            <span className="text-[12px] text-tinta-media">
              {r.pessoaNome} · emitido em {dataCurta(r.emitidoEm.slice(0, 10))}
            </span>
          </span>

          {/* `tabular-nums` e largura mínima: coluna de dinheiro que dança
              horizontalmente não se soma de olho */}
          <span className="min-w-[104px] text-right font-mono text-[13.5px] tabular-nums">
            {emReais(r.valorCent)}
          </span>

          <span
            className={`w-[92px] shrink-0 rounded-peca px-2.5 py-[5px] text-center text-[11.5px] font-medium ${TINTA[r.status]}`}
          >
            {ROTULO[r.status]}
          </span>

          <span className="flex w-[168px] shrink-0 justify-end gap-2">
            <Link
              href={`/recibos/${r.id}`}
              className="inline-flex min-h-9 items-center rounded-peca border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:bg-superficie-mais-suave"
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
              // o vazio ocupa o mesmo espaço do menu, senão a linha do
              // cancelado encolhe e o "Ver e imprimir" dela sai do prumo
              <span aria-hidden className="w-9" />
            )}
          </span>

          {r.motivo ? (
            <p className="w-full text-[11.5px] text-tinta-media">
              {r.status === 'cancelado' ? 'Cancelado: ' : 'Correção: '}{r.motivo}
            </p>
          ) : null}
        </div>
      ))}

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
              placeholder="Ex.: valor errado, emitido para a pessoa errada"
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
              placeholder="Ex.: nome incompleto"
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
      className={`min-h-9 cursor-pointer rounded-peca border px-3 text-[12.5px] disabled:opacity-50 ${
        perigo
          ? 'border-alerta-linha bg-superficie text-alerta hover:bg-alerta-superficie'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {children}
    </button>
  )
}
