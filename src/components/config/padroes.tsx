'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { cartao, Chip, Nota, entrada } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { useAviso } from '@/components/ui/desfazer'
import { salvarPadroes } from '@/server/config/acoes'
import type { Padroes, UltimaAlteracao } from '@/server/config/consultas'
import { erroLegivel } from '@/core/erro-legivel'

/*
 * O que o banco traz de fábrica, na `0037`. Repetido aqui de propósito: o botão
 * de voltar ao padrão precisa do valor **antes** de qualquer ida ao servidor,
 * senão ele só funcionaria depois de uma volta de rede para descobrir o que
 * é o padrão. Se a migration mudar, muda aqui junto.
 */
const DE_FABRICA = {
  capacidadePadrao: 4,
  duracaoPadraoMin: 50,
  intervaloMin: 10,
  prazoReposicaoDias: 60,
  encaixeAcima: true,
  creditoFaltaAvisada: true,
  horariosSugeridos: [
    '07:00', '08:00', '09:00', '10:00', '11:00',
    '17:00', '18:00', '19:00', '20:00',
  ],
}

/**
 * A seção Padrões: os números que o resto do sistema assume quando ninguém diz
 * o contrário, e as duas regras que mudam o comportamento da agenda.
 *
 * Cada linha é rótulo e consequência de um lado, controle do outro — a forma do
 * protótipo. Um formulário de campos numerados obrigaria a pessoa a adivinhar o
 * que cada número faz.
 */
export function SecaoPadroes({
  padroes, ultima,
}: {
  padroes: Padroes
  ultima: UltimaAlteracao | null
}) {
  const [v, setV] = useState(padroes)
  const [novoHorario, setNovoHorario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const sujo = JSON.stringify(v) !== JSON.stringify(padroes)

  function acrescentar() {
    const h = novoHorario.trim()
    if (!h || v.horariosSugeridos.includes(h)) return
    setV({ ...v, horariosSugeridos: [...v.horariosSugeridos, h].sort() })
    setNovoHorario('')
  }

  function salvar() {
    iniciar(async () => {
      setErro(null)
      try {
        await salvarPadroes({
          capacidadePadrao: v.capacidadePadrao,
          duracaoPadraoMin: v.duracaoPadraoMin,
          intervaloMin: v.intervaloMin,
          prazoReposicaoDias: v.prazoReposicaoDias,
          encaixeAcima: v.encaixeAcima,
          creditoFaltaAvisada: v.creditoFaltaAvisada,
          horariosSugeridos: v.horariosSugeridos,
        })
        avisar({ texto: 'Padrões salvos' })
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  return (
    <section className={`${cartao} px-5 py-4.5`}>
      <h2 className="font-titulo text-[19px] font-semibold">Padrões</h2>
      <p className="pt-1.5 pb-4 text-[13px] text-tinta-media">
        O que já vem preenchido quando você cria algo novo. Sempre dá para mudar
        na hora.
      </p>

      <div className="flex flex-col gap-2.5">
        <LinhaPadrao
          rotulo="Vagas por sessão"
          detalhe="usado quando o serviço não tem capacidade própria"
        >
          <Contador
            rotulo="Vagas por sessão"
            valor={v.capacidadePadrao}
            min={1}
            max={40}
            unidade="pessoas"
            aoMudar={(n) => setV({ ...v, capacidadePadrao: n })}
          />
        </LinhaPadrao>

        <LinhaPadrao
          rotulo="Duração da sessão"
          detalhe="o tamanho de um horário na grade"
        >
          <Contador
            rotulo="Duração da sessão"
            valor={v.duracaoPadraoMin}
            min={5}
            max={240}
            passo={5}
            unidade="minutos"
            aoMudar={(n) => setV({ ...v, duracaoPadraoMin: n })}
          />
        </LinhaPadrao>

        <LinhaPadrao
          rotulo="Intervalo entre sessões"
          detalhe="a folga que separa uma da próxima, é ela que sugere o horário seguinte"
        >
          <Contador
            rotulo="Intervalo entre sessões"
            valor={v.intervaloMin}
            min={0}
            max={120}
            passo={5}
            unidade="minutos"
            aoMudar={(n) => setV({ ...v, intervaloMin: n })}
          />
        </LinhaPadrao>

        <LinhaPadrao
          rotulo="Prazo da reposição"
          detalhe="depois disso o crédito de uma falta expira, e a pendência sai da lista"
        >
          <Contador
            rotulo="Prazo da reposição"
            valor={v.prazoReposicaoDias}
            min={1}
            max={365}
            unidade="dias"
            aoMudar={(n) => setV({ ...v, prazoReposicaoDias: n })}
          />
        </LinhaPadrao>

        <LinhaPadrao
          rotulo="Encaixe acima da capacidade"
          detalhe="vale para quem está na recepção. A busca de vaga e o robô continuam sem enxergar horário cheio, 5/4 é sempre alguém decidindo"
        >
          <Opcoes
            rotulo="Encaixe acima da capacidade"
            valor={v.encaixeAcima}
            opcoes={[
              [true, 'Permitir com aviso'],
              [false, 'Bloquear'],
            ]}
            aoMudar={(b) => setV({ ...v, encaixeAcima: b })}
          />
        </LinhaPadrao>

        <LinhaPadrao
          rotulo="Falta avisada gera crédito"
          detalhe="exigir antecedência mínima depende de saber a que horas a pessoa avisou; hoje só sabemos quando a recepção registrou"
        >
          <Opcoes
            rotulo="Falta avisada gera crédito"
            valor={v.creditoFaltaAvisada}
            opcoes={[
              [true, 'Sim'],
              [false, 'Não'],
            ]}
            aoMudar={(b) => setV({ ...v, creditoFaltaAvisada: b })}
          />
        </LinhaPadrao>

        <LinhaPadrao
          rotulo="Horários sugeridos"
          detalhe="os atalhos que aparecem ao montar a grade; sempre dá para digitar outro na mão"
        >
          <div className="flex flex-wrap items-center gap-2">
            {v.horariosSugeridos.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`remover ${h}`}
                onClick={() =>
                  setV({
                    ...v,
                    horariosSugeridos: v.horariosSugeridos.filter((x) => x !== h),
                  })
                }
                className="inline-flex min-h-9 items-center gap-2 rounded-padrao border border-linha bg-superficie px-3 font-mono text-[12.5px] hover:border-alerta-linha-forte hover:bg-alerta-superficie hover:text-alerta"
              >
                {h}
                <span aria-hidden>×</span>
              </button>
            ))}
            <input
              type="time" value={novoHorario} aria-label="Novo horário"
              onChange={(e) => setNovoHorario(e.target.value)}
              className={`${entrada} w-32`}
            />
            <Botao type="button" tom="secundario" miudo onClick={acrescentar}>
              Acrescentar
            </Botao>
          </div>
        </LinhaPadrao>
      </div>

      <p className="mt-4 rounded-media border border-positivo-linha bg-positivo-superficie px-3.5 py-3 text-[12.5px] leading-relaxed text-[#3E7A6C]">
        Mudar um padrão não mexe em nada que já existe. Vale só para o que for
        criado daqui em diante, cada serviço ainda pode ter a sua própria
        capacidade.
      </p>

      {erro ? <div className="pt-3"><Nota tom="alerta">{erro}</Nota></div> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-linha-fina pt-4">
        {/* "Tudo salvo" responde à máquina; numa conta com quatro pessoas com
            acesso, a pergunta é quem mudou o padrão */}
        <span className="text-[12.5px] text-tinta-media">
          {sujo ? 'Há mudanças não salvas.' : 'Tudo salvo.'}
          {!sujo && ultima ? (
            <>
              {' · última alteração em '}
              {ultima.quando.slice(8, 10)}/{ultima.quando.slice(5, 7)}
              {ultima.quem ? ` por ${ultima.quem}` : ''}
            </>
          ) : null}
        </span>
        <div className="flex flex-wrap gap-2">
          {/* voltar ao que o sistema traz de fábrica: mexer em sete números e
              não saber mais onde estava é o jeito mais rápido de ninguém mais
              encostar nesta tela */}
          <Botao
            tom="fantasma" disabled={pendente}
            className="min-h-10 rounded-padrao"
            onClick={() => { setV(DE_FABRICA); setErro(null) }}
          >
            Voltar ao padrão
          </Botao>
          <Botao
            tom="secundario" disabled={pendente || !sujo}
            className="min-h-10 rounded-padrao"
            onClick={() => { setV(padroes); setErro(null) }}
          >
            Descartar
          </Botao>
          <Botao
            disabled={pendente || !sujo}
            className="min-h-10 rounded-padrao font-semibold"
            onClick={salvar}
          >
            Salvar padrões
          </Botao>
        </div>
      </div>
    </section>
  )
}

function LinhaPadrao({
  rotulo, detalhe, children,
}: {
  rotulo: string
  detalhe: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-grande border border-linha-fina bg-superficie-suave px-4 py-3.5">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
        <span className="text-[14px] font-medium">{rotulo}</span>
        <span className="text-[12px] leading-[1.45] text-tinta-media">{detalhe}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * O `−` valor `+` do protótipo.
 *
 * Tem campo de digitação por baixo (o `input` continua lá, com `aria-label`),
 * porque ir de 60 a 5 no passo de 5 é dezesseis toques.
 */
function Contador({
  rotulo, valor, min, max, passo = 1, unidade, aoMudar,
}: {
  rotulo: string
  valor: number
  min: number
  max: number
  passo?: number
  unidade: string
  aoMudar: (n: number) => void
}) {
  const limitar = (n: number) => Math.min(max, Math.max(min, n))
  return (
    // os botões ficam com "menos" e "mais" secos de propósito: repetir o rótulo
    // do campo neles faria o nome acessível casar com três elementos, e aí nem
    // teste nem leitor de tela consegue apontar o campo. O que dá contexto é a
    // ordem — o rótulo da linha vem imediatamente antes
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center overflow-hidden rounded-padrao border border-linha bg-superficie">
        <button
          type="button"
          aria-label="menos"
          title={`Diminuir ${rotulo.toLowerCase()}`}
          disabled={valor <= min}
          onClick={() => aoMudar(limitar(valor - passo))}
          className="flex h-11 w-11 items-center justify-center text-tinta-media hover:bg-superficie-mais-suave disabled:opacity-40"
        >
          <Icone nome="menos" />
        </button>
        <span aria-hidden className="h-full w-px self-stretch bg-linha-fina" />
        <input
          aria-label={rotulo}
          value={valor}
          inputMode="numeric"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ''))
            if (!Number.isNaN(n)) aoMudar(limitar(n))
          }}
          className="h-11 w-14 bg-transparent text-center font-mono text-[16px] font-medium outline-none"
        />
        <span aria-hidden className="h-full w-px self-stretch bg-linha-fina" />
        <button
          type="button"
          aria-label="mais"
          title={`Aumentar ${rotulo.toLowerCase()}`}
          disabled={valor >= max}
          onClick={() => aoMudar(limitar(valor + passo))}
          className="flex h-11 w-11 items-center justify-center text-tinta-media hover:bg-superficie-mais-suave disabled:opacity-40"
        >
          <Icone nome="mais" />
        </button>
      </div>
      <span className="text-[12px] text-tinta-media">{unidade}</span>
    </div>
  )
}

/** Duas escolhas mutuamente exclusivas, com a ativa em escuro. */
function Opcoes({
  rotulo, valor, opcoes, aoMudar,
}: {
  rotulo: string
  valor: boolean
  opcoes: Array<[boolean, string]>
  aoMudar: (b: boolean) => void
}) {
  return (
    // `Chip` já é botão com `aria-pressed`, não `radiogroup`: são duas escolhas
    // que se alternam, e o papel de botão é o que a tela realmente oferece
    <div aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map(([b, texto]) => (
        <Chip key={texto} ativo={valor === b} onClick={() => aoMudar(b)}>
          {texto}
        </Chip>
      ))}
    </div>
  )
}
