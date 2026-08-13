'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Campo, Cartao, Chip, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { salvarPadroes } from '@/server/config/acoes'
import type { Padroes } from '@/server/config/consultas'

/**
 * A seção Padrões: os números que o resto do sistema assume quando ninguém diz
 * o contrário, e as duas regras que mudam o comportamento da agenda.
 */
export function SecaoPadroes({ padroes }: { padroes: Padroes }) {
  const [horarios, setHorarios] = useState(padroes.horariosSugeridos)
  const [novoHorario, setNovoHorario] = useState('')
  const [encaixe, setEncaixe] = useState(padroes.encaixeAcima)
  const [credito, setCredito] = useState(padroes.creditoFaltaAvisada)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function acrescentar() {
    const h = novoHorario.trim()
    if (!h || horarios.includes(h)) return
    setHorarios([...horarios, h].sort())
    setNovoHorario('')
  }

  return (
    <Cartao titulo="Padrões">
      <form
        className="flex flex-col gap-5"
        action={(f) => iniciar(async () => {
          setErro(null)
          try {
            await salvarPadroes({
              capacidadePadrao: Number(f.get('capacidade')),
              duracaoPadraoMin: Number(f.get('duracao')),
              intervaloMin: Number(f.get('intervalo')),
              prazoReposicaoDias: Number(f.get('prazo')),
              encaixeAcima: encaixe,
              creditoFaltaAvisada: credito,
              horariosSugeridos: horarios,
            })
            avisar({ texto: 'Padrões salvos' })
            router.refresh()
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'não deu para salvar')
          }
        })}
      >
        <div className="flex flex-wrap gap-4">
          <Campo
            rotulo="Vagas por sessão" htmlFor="p-cap"
            dica="usado quando o serviço não tem capacidade própria"
          >
            <input id="p-cap" name="capacidade" type="number" min={1}
              defaultValue={padroes.capacidadePadrao} className={`${entrada} w-28`} />
          </Campo>

          <Campo rotulo="Duração da sessão" htmlFor="p-dur" dica="minutos">
            <input id="p-dur" name="duracao" type="number" min={1}
              defaultValue={padroes.duracaoPadraoMin} className={`${entrada} w-28`} />
          </Campo>

          <Campo
            rotulo="Intervalo entre sessões" htmlFor="p-int"
            dica="folga entre uma e a próxima, em minutos"
          >
            <input id="p-int" name="intervalo" type="number" min={0}
              defaultValue={padroes.intervaloMin} className={`${entrada} w-28`} />
          </Campo>

          <Campo
            rotulo="Prazo da reposição" htmlFor="p-prazo"
            dica="dias até o crédito de uma falta expirar"
          >
            <input id="p-prazo" name="prazo" type="number" min={1}
              defaultValue={padroes.prazoReposicaoDias} className={`${entrada} w-28`} />
          </Campo>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium">Horários sugeridos</span>
          <p className="text-[11.5px] text-tinta-media">
            Os atalhos que aparecem ao montar a grade. Sempre dá para digitar
            outro na mão.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {horarios.map((h) => (
              <Chip
                key={h} ativo
                onClick={() => setHorarios(horarios.filter((x) => x !== h))}
                aria-label={`remover ${h}`}
              >
                <span className="font-mono">{h}</span> ×
              </Chip>
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
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium">Encaixe acima da capacidade</span>
          <div className="flex flex-wrap gap-2">
            <Chip ativo={encaixe} onClick={() => setEncaixe(true)}>Permitir com aviso</Chip>
            <Chip ativo={!encaixe} onClick={() => setEncaixe(false)}>Bloquear</Chip>
          </div>
          {/* A metade do princípio antigo que continua de pé, e o motivo dela */}
          <Nota tom="atencao">
            Vale para quem está na recepção decidindo abrir exceção. A busca de
            vaga e o robô continuam sem enxergar horário cheio de qualquer jeito —
            5/4 é sempre alguém decidindo, nunca o sistema deixando passar.
          </Nota>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium">Falta avisada gera crédito</span>
          <div className="flex flex-wrap gap-2">
            <Chip ativo={credito} onClick={() => setCredito(true)}>Sim</Chip>
            <Chip ativo={!credito} onClick={() => setCredito(false)}>Não</Chip>
          </div>
          <Nota tom="neutro">
            Exigir antecedência mínima depende de saber a que horas a pessoa
            avisou. Hoje só sabemos quando a recepção registrou — a opção entra
            quando o aviso chegar pelo robô.
          </Nota>
        </div>

        {erro ? <Nota tom="alerta">{erro}</Nota> : null}

        <div>
          <Botao type="submit" disabled={pendente}>Salvar padrões</Botao>
        </div>
      </form>
    </Cartao>
  )
}
