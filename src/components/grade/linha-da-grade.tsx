'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  previewEdicao, editarSerie, duplicarSerie, encerrarSerie,
  type MudancaSerie, type Preview,
} from '@/server/grade/acoes'
import type { Colisao } from '@/core/agenda/serie'
import type { CatalogoGrade, SerieLinha } from '@/server/grade/consultas'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Modo = null | 'editar' | 'duplicar' | 'encerrar'

export function LinhaDaGrade({
  serie, catalogo, rotuloVaga, rotuloPessoa, podeEscrever,
}: {
  serie: SerieLinha
  catalogo: CatalogoGrade
  rotuloVaga: string
  rotuloPessoa: string
  podeEscrever: boolean
}) {
  const [modo, setModo] = useState<Modo>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  // o que a edição vai fazer, perguntado antes de fazer
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mudanca, setMudanca] = useState<MudancaSerie | null>(null)
  const [colisoes, setColisoes] = useState<Colisao[]>([])
  const [diasDuplicar, setDiasDuplicar] = useState<number[]>([])
  const [vagasNoCaminho, setVagasNoCaminho] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // data local do navegador: `toISOString` é UTC e já daria amanhã às 21h
  const hoje = new Date().toLocaleDateString('en-CA')

  function fechar() {
    setModo(null); setPreview(null); setMudanca(null)
    setColisoes([]); setDiasDuplicar([]); setVagasNoCaminho(null); setErro(null)
  }

  function comErro(fn: () => Promise<void>) {
    iniciar(async () => {
      setErro(null)
      try { await fn() } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para salvar')
      }
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded border p-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-medium">{serie.horaInicio}</span>
        <span>{serie.servico}</span>
        <span className="text-sm opacity-70">{serie.duracaoMin} min</span>
        {serie.profissional ? <span className="text-sm">{serie.profissional}</span> : null}
        {serie.local ? <span className="text-sm opacity-70">{serie.local}</span> : null}

        {/* ocupadas/capacidade, sempre visível e nunca truncado */}
        <span className="text-sm">
          {serie.ocupadas}/{serie.capacidade} {rotuloVaga.toLowerCase()}
        </span>

        <span className="text-sm opacity-70">
          {serie.encerrada
            ? `encerrada em ${serie.vigenciaFim}`
            : `desde ${serie.vigenciaInicio}`}
        </span>

        {podeEscrever && !serie.encerrada ? (
          <span className="ml-auto flex gap-3">
            <button type="button" className="underline" onClick={() => setModo('editar')}>
              Editar
            </button>
            <button type="button" className="underline" onClick={() => setModo('duplicar')}>
              Duplicar
            </button>
            <button type="button" className="underline" onClick={() => setModo('encerrar')}>
              Encerrar
            </button>
          </span>
        ) : null}
      </div>

      {modo === 'editar' ? (
        <form
          className="flex flex-col gap-3 border-t pt-3"
          action={(f) => {
            const m: MudancaSerie = {
              diaSemana: Number(f.get('diaSemana')),
              horaInicio: String(f.get('horaInicio') ?? ''),
              duracaoMin: Number(f.get('duracaoMin')),
              capacidade: Number(f.get('capacidade')),
              servicoId: String(f.get('servicoId') ?? ''),
              profissionalId: String(f.get('profissionalId') ?? '') || null,
              localId: String(f.get('localId') ?? '') || null,
            }
            comErro(async () => {
              setMudanca(m)
              setPreview(await previewEdicao(serie.id, m))
            })
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              Dia
              <select name="diaSemana" defaultValue={serie.diaSemana} className="rounded border px-3 py-2">
                {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Começa às
              <input name="horaInicio" type="time" defaultValue={serie.horaInicio}
                className="rounded border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              Duração (min)
              <input name="duracaoMin" type="number" min={1} defaultValue={serie.duracaoMin}
                className="w-24 rounded border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              Capacidade
              <input name="capacidade" type="number" min={1} defaultValue={serie.capacidade}
                className="w-24 rounded border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              Serviço
              <select name="servicoId" defaultValue={serie.servicoId} className="rounded border px-3 py-2">
                {catalogo.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Profissional
              <select name="profissionalId" defaultValue={serie.profissionalId ?? ''}
                className="rounded border px-3 py-2">
                <option value="">— sem definir —</option>
                {catalogo.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Local
              <select name="localId" defaultValue={serie.localId ?? ''}
                className="rounded border px-3 py-2">
                <option value="">— sem definir —</option>
                {catalogo.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
          </div>

          {/* A confusão mais provável do sistema inteiro é achar que editar a
              grade reescreve o passado. A tela diz o contrário em número. */}
          {preview ? (
            <div className="flex flex-col gap-1 rounded border p-3">
              <p>A mudança vale daqui para frente. O que já passou fica como está.</p>
              <p>{preview.sessoesAfetadas} futuro(s) mudam.</p>
              {preview.sessoesPreservadas > 0 ? (
                <p>
                  {preview.sessoesPreservadas} ficam como estão, porque já têm
                  decisão registrada.
                </p>
              ) : null}
              {preview.sessoesCanceladas > 0 ? (
                <p>
                  {preview.sessoesCanceladas} saem da grade e ficam cancelados,
                  com o motivo.
                </p>
              ) : null}
              {preview.capacidadeMenorQueOcupacao ? (
                <p>
                  Atenção: {preview.vagasAtivas} {rotuloPessoa.toLowerCase()}(s)
                  ocupam este horário, e a capacidade nova é menor.
                </p>
              ) : null}
            </div>
          ) : null}

          {erro ? <p className="rounded border p-2">{erro}</p> : null}

          <div className="flex gap-2">
            {preview && mudanca ? (
              <button
                type="button" disabled={pendente} className="rounded border px-3 py-2"
                onClick={() => comErro(async () => {
                  await editarSerie(serie.id, mudanca)
                  fechar()
                  router.refresh()
                })}
              >
                Confirmar
              </button>
            ) : (
              <button type="submit" disabled={pendente} className="rounded border px-3 py-2">
                Ver o que muda
              </button>
            )}
            <button type="button" className="px-2 py-2 underline" onClick={fechar}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {modo === 'duplicar' ? (
        <div className="flex flex-col gap-3 border-t pt-3">
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1">Repetir este horário em</legend>
            {DIAS.map((d, i) => (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox" checked={diasDuplicar.includes(i)}
                  onChange={(e) => setDiasDuplicar((atual) =>
                    e.target.checked ? [...atual, i] : atual.filter((x) => x !== i))}
                />
                {d}
              </label>
            ))}
          </fieldset>

          {colisoes.length > 0 ? (
            <div className="rounded border p-3">
              <p className="font-medium">Esse horário já tem coisa marcada:</p>
              <ul className="list-inside list-disc">
                {colisoes.map((c, i) => (
                  <li key={`${c.serieId}-${i}`}>
                    {DIAS[c.diaSemana]} às {c.horaInicio} — {c.ocupadoPor} já ocupa
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {erro ? <p className="rounded border p-2">{erro}</p> : null}

          <div className="flex gap-2">
            <button
              type="button" disabled={pendente || diasDuplicar.length === 0}
              className="rounded border px-3 py-2"
              onClick={() => comErro(async () => {
                const r = await duplicarSerie(serie.id, diasDuplicar, {
                  confirmarColisao: colisoes.length > 0,
                })
                if (r.ok) { fechar(); router.refresh() } else setColisoes(r.colisoes)
              })}
            >
              {colisoes.length > 0 ? 'Duplicar mesmo assim' : 'Duplicar nestes dias'}
            </button>
            <button type="button" className="px-2 py-2 underline" onClick={fechar}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {modo === 'encerrar' ? (
        <form
          className="flex flex-col gap-3 border-t pt-3"
          action={(f) => {
            const fim = String(f.get('fim') ?? hoje)
            comErro(async () => {
              const r = await encerrarSerie(serie.id, fim, {
                confirmar: vagasNoCaminho !== null,
              })
              if (r.ok) { fechar(); router.refresh() } else setVagasNoCaminho(r.vagasAtivas)
            })
          }}
        >
          <label className="flex w-fit flex-col gap-1">
            Encerrar a partir de
            <input name="fim" type="date" defaultValue={hoje} className="rounded border px-3 py-2" />
          </label>

          <p className="text-sm opacity-70">
            O histórico continua: encerrar não apaga o que já aconteceu.
          </p>

          {vagasNoCaminho !== null ? (
            <p className="rounded border p-3">
              {vagasNoCaminho} {rotuloPessoa.toLowerCase()}(s) ocupam este horário.
              Encerrar tira ele da grade daqui para frente.
            </p>
          ) : null}

          {erro ? <p className="rounded border p-2">{erro}</p> : null}

          <div className="flex gap-2">
            <button type="submit" disabled={pendente} className="rounded border px-3 py-2">
              {vagasNoCaminho !== null ? 'Encerrar mesmo assim' : 'Encerrar nesta data'}
            </button>
            <button type="button" className="px-2 py-2 underline" onClick={fechar}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </li>
  )
}
