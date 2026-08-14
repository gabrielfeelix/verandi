'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarSeries } from '@/server/grade/acoes'
import type { Colisao, NovaSerie } from '@/core/agenda/serie'
import type { CatalogoGrade } from '@/server/grade/consultas'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Montar 70 horários na mão é o pior momento do cliente com o produto — por
 * isso escolher vários dias de uma vez é o caminho principal deste formulário,
 * não uma opção escondida.
 */
export function EditorSerie({
  catalogo, rotuloSerie,
}: {
  catalogo: CatalogoGrade
  rotuloSerie: string
}) {
  const [aberto, setAberto] = useState(false)
  const [colisoes, setColisoes] = useState<Colisao[]>([])
  /**
   * O que foi pedido, guardado.
   *
   * React reseta os campos do formulário depois que a action termina, então
   * reler o `FormData` no "criar mesmo assim" leria um formulário vazio — e o
   * segundo clique não criaria nada, sem dizer por quê.
   */
  const [pedido, setPedido] = useState<NovaSerie | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  // data local do navegador: `toISOString` é UTC e já daria amanhã às 21h
  const hoje = new Date().toLocaleDateString('en-CA')

  function salvar(entrada: NovaSerie, confirmarColisao: boolean) {
    iniciar(async () => {
      setErro(null)
      try {
        const r = await criarSeries(entrada, { confirmarColisao })
        if (r.ok) {
          setColisoes([])
          setPedido(null)
          setAberto(false)
          router.refresh()
        } else {
          setColisoes(r.colisoes)
          setPedido(entrada)
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para salvar')
      }
    })
  }

  function doFormulario(f: FormData): NovaSerie {
    return {
      servicoId: String(f.get('servicoId') ?? ''),
      profissionalId: String(f.get('profissionalId') ?? '') || null,
      localId: String(f.get('localId') ?? '') || null,
      diasSemana: f.getAll('dias').map(Number),
      horaInicio: String(f.get('horaInicio') ?? ''),
      duracaoMin: Number(f.get('duracaoMin') ?? 60),
      capacidade: Number(f.get('capacidade') ?? 1),
      vigenciaInicio: String(f.get('vigenciaInicio') ?? hoje),
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-11 rounded-padrao bg-escuro px-3.5 text-[13px] font-medium text-tinta-clara hover:bg-escuro-hover"
      >
        Criar {rotuloSerie.toLowerCase()}
      </button>
    )
  }

  if (catalogo.servicos.length === 0) {
    return (
      <p className="rounded-media border border-linha-suave bg-superficie p-3 text-[12.5px] leading-relaxed">
        Antes de montar a grade, cadastre um serviço em Configuração.
      </p>
    )
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-grande border border-linha-suave bg-superficie-suave p-4"
      action={(f) => salvar(doFormulario(f), false)}
    >
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1">Dias da semana</legend>
        {DIAS.map((d, i) => (
          <label key={d} className="flex items-center gap-1">
            <input type="checkbox" name="dias" value={i} />
            {d}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="horaInicio">Começa às</label>
          <input
            id="horaInicio" name="horaInicio" type="time" required
            className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="duracaoMin">Duração (min)</label>
          <input
            id="duracaoMin" name="duracaoMin" type="number" min={1} defaultValue={60}
            className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px] w-24"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="capacidade">Capacidade</label>
          <input
            id="capacidade" name="capacidade" type="number" min={1} defaultValue={1}
            className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px] w-24"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="servicoId">Serviço</label>
          <select id="servicoId" name="servicoId" required className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
            {catalogo.servicos.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="profissionalId">Profissional</label>
          <select id="profissionalId" name="profissionalId" className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
            <option value="">, sem definir ,</option>
            {catalogo.profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="localId">Local</label>
          <select id="localId" name="localId" className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
            <option value="">, sem definir ,</option>
            {catalogo.locais.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="vigenciaInicio">Vale a partir de</label>
          <input
            id="vigenciaInicio" name="vigenciaInicio" type="date" defaultValue={hoje}
            className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
          />
        </div>
      </div>

      {catalogo.funcionamento.length > 0 ? (
        <p className="text-sm opacity-70">
          Funcionamento:{' '}
          {catalogo.funcionamento
            .map((f) => `${DIAS[f.diaSemana]} ${f.abre}–${f.fecha}`)
            .join(' · ')}
        </p>
      ) : null}

      {/* Colisão não bloqueia: dois profissionais na mesma sala pode ser real.
          Quem opera é que sabe, então a tela conta o que achou e deixa seguir. */}
      {colisoes.length > 0 ? (
        <div className="rounded-media border border-linha-suave bg-superficie p-3 text-[12.5px] leading-relaxed">
          <p className="font-medium">Esse horário já tem coisa marcada:</p>
          <ul className="list-inside list-disc">
            {colisoes.map((c, i) => (
              <li key={`${c.serieId}-${i}`}>
                {DIAS[c.diaSemana]} às {c.horaInicio}, {c.ocupadoPor} já ocupa
                {c.tipo === 'profissional' ? ' esse horário' : ' esse local'}
              </li>
            ))}
          </ul>
          {pedido ? (
            <button
              type="button"
              disabled={pendente}
              onClick={() => salvar(pedido, true)}
              className="mt-2 min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
            >
              Criar mesmo assim
            </button>
          ) : null}
        </div>
      ) : null}

      {erro ? <p className="rounded-padrao bg-alerta-fundo px-3 py-2 text-[12.5px] text-alerta">{erro}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
          Salvar
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false); setColisoes([]); setPedido(null); setErro(null)
          }}
          className="px-2 py-2 underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
