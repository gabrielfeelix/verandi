'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  previewEdicao, editarSerie, duplicarSerie, encerrarSerie, quemOcupa,
  type MudancaSerie, type Preview,
} from '@/server/grade/acoes'
import type { Colisao } from '@/core/agenda/serie'
import type { CatalogoGrade, SerieLinha } from '@/server/grade/consultas'
import { mesCurto } from '@/core/agenda/mes-curto'
import { BotaoIcone } from '@/components/ui/botao'
import { Avatar } from '@/components/ui/pecas'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Modo = null | 'editar' | 'duplicar' | 'encerrar' | 'ocupa'
type Ocupante = { pessoaId: string; nome: string; desde: string }

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
  const [ocupantes, setOcupantes] = useState<Ocupante[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // data local do navegador: `toISOString` é UTC e já daria amanhã às 21h
  const hoje = new Date().toLocaleDateString('en-CA')

  function fechar() {
    setModo(null); setPreview(null); setMudanca(null)
    setColisoes([]); setDiasDuplicar([]); setVagasNoCaminho(null)
    setOcupantes(null); setErro(null)
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
    <li className="border-b border-linha-fina last:border-b-0">
      <div className="flex flex-wrap items-center gap-3.5 px-4.5 py-3 hover:bg-superficie-tenue">
        <span className="font-mono text-[14.5px]">{serie.horaInicio}</span>

        <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
          <span
            className={`truncate text-[14px] font-medium ${
              serie.encerrada ? 'text-tinta-media' : ''
            }`}
          >
            {serie.servico}
          </span>
          <span className="truncate text-[12px] text-tinta-media">
            {[
              serie.profissional,
              serie.local,
              serie.encerrada
                ? `${mesCurto(serie.vigenciaInicio)} – ${mesCurto(serie.vigenciaFim!)}`
                : `desde ${mesCurto(serie.vigenciaInicio)}`,
            ].filter(Boolean).join(' · ')}
          </span>
        </span>

        {/* ocupadas/capacidade, sempre visível e nunca truncado */}
        <span
          className={`rounded-peca px-2.5 py-1 font-mono text-[12px] ${
            serie.ocupadas > serie.capacidade
              ? 'bg-alerta-fundo text-alerta'
              : 'bg-superficie-mais-suave text-tinta-media'
          }`}
          title={`${serie.ocupadas} de ${serie.capacidade} ${rotuloVaga.toLowerCase()}`}
        >
          {serie.ocupadas}/{serie.capacidade}
        </span>

        {podeEscrever && !serie.encerrada ? (
          <span className="flex shrink-0 items-center gap-2">
            {/*
              * "Quem ocupa" é texto e as outras três são ícone de propósito: ela
              * é a única que só lê. Encerrar e editar mudam a grade de todo
              * mundo, e ficam do tamanho de um alvo deliberado.
              */}
            <button
              type="button"
              disabled={pendente}
              onClick={() => comErro(async () => {
                setModo('ocupa')
                setOcupantes(await quemOcupa(serie.id))
              })}
              className="min-h-9 cursor-pointer rounded-peca border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:bg-superficie-suave hover:text-tinta"
            >
              Quem ocupa
            </button>
            <span className="flex gap-1.5">
              <BotaoIcone icone="lapis" titulo="Editar" onClick={() => setModo('editar')} />
              <BotaoIcone icone="lista" titulo="Duplicar" onClick={() => setModo('duplicar')} />
              <BotaoIcone
                icone="fechar" titulo="Encerrar" perigo
                onClick={() => setModo('encerrar')}
                className="border-alerta-linha-forte bg-alerta-superficie text-alerta"
              />
            </span>
          </span>
        ) : null}

        {podeEscrever && serie.encerrada ? (
          <button
            type="button"
            onClick={() => setModo('duplicar')}
            className="min-h-9 shrink-0 cursor-pointer rounded-peca border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:bg-superficie-suave hover:text-tinta"
          >
            Duplicar
          </button>
        ) : null}
      </div>

      {modo === 'ocupa' ? (
        <div className="flex flex-col gap-2.5 border-t border-linha-fina bg-superficie-suave px-4.5 py-3.5">
          {ocupantes === null ? (
            <p className="text-[12.5px] text-tinta-media">carregando…</p>
          ) : ocupantes.length === 0 ? (
            <p className="text-[12.5px] text-tinta-media">
              Ninguém tem vaga fixa aqui. Encerrar não avisa ninguém.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {ocupantes.map((o) => (
                <li key={o.pessoaId}>
                  <Link
                    href={`/pessoas/${o.pessoaId}`}
                    className="flex items-center gap-2 rounded-peca border border-linha-suave bg-superficie py-1.5 pr-3 pl-1.5 text-[12.5px] hover:border-marca"
                  >
                    <Avatar nome={o.nome} tamanho={24} decorativo />
                    {o.nome}
                    <span className="font-mono text-[11px] text-tinta-fraca">
                      {mesCurto(o.desde)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="w-fit text-[12.5px] underline" onClick={fechar}>
            Fechar
          </button>
        </div>
      ) : null}

      {modo === 'editar' ? (
        <form
          className="flex flex-col gap-3 border-t border-linha-fina bg-superficie-suave px-4.5 py-4"
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
              <select name="diaSemana" defaultValue={serie.diaSemana} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
                {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Começa às
              <input name="horaInicio" type="time" defaultValue={serie.horaInicio}
                className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]" />
            </label>
            <label className="flex flex-col gap-1">
              Duração (min)
              <input name="duracaoMin" type="number" min={1} defaultValue={serie.duracaoMin}
                className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px] w-24" />
            </label>
            <label className="flex flex-col gap-1">
              Capacidade
              <input name="capacidade" type="number" min={1} defaultValue={serie.capacidade}
                className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px] w-24" />
            </label>
            <label className="flex flex-col gap-1">
              Serviço
              <select name="servicoId" defaultValue={serie.servicoId} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
                {catalogo.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Profissional
              <select name="profissionalId" defaultValue={serie.profissionalId ?? ''}
                className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
                <option value="">— sem definir —</option>
                {catalogo.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Local
              <select name="localId" defaultValue={serie.localId ?? ''}
                className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
                <option value="">— sem definir —</option>
                {catalogo.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
          </div>

          {/* A confusão mais provável do sistema inteiro é achar que editar a
              grade reescreve o passado. A tela diz o contrário em número. */}
          {preview ? (
            <div className="flex flex-col gap-1 rounded-media border border-linha-suave bg-superficie p-3">
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

          {erro ? <p className="rounded-padrao bg-alerta-fundo px-3 py-2 text-[12.5px] text-alerta">{erro}</p> : null}

          <div className="flex gap-2">
            {preview && mudanca ? (
              <button
                type="button" disabled={pendente} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
                onClick={() => comErro(async () => {
                  await editarSerie(serie.id, mudanca)
                  fechar()
                  router.refresh()
                })}
              >
                Confirmar
              </button>
            ) : (
              <button type="submit" disabled={pendente} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
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
        <div className="flex flex-col gap-3 border-t border-linha-fina bg-superficie-suave px-4.5 py-4">
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
            <div className="rounded-media border border-linha-suave bg-superficie p-3 text-[12.5px] leading-relaxed">
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

          {erro ? <p className="rounded-padrao bg-alerta-fundo px-3 py-2 text-[12.5px] text-alerta">{erro}</p> : null}

          <div className="flex gap-2">
            <button
              type="button" disabled={pendente || diasDuplicar.length === 0}
              className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
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
          className="flex flex-col gap-3 border-t border-linha-fina bg-superficie-suave px-4.5 py-4"
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
            <input name="fim" type="date" defaultValue={hoje} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]" />
          </label>

          <p className="text-sm opacity-70">
            O histórico continua: encerrar não apaga o que já aconteceu.
          </p>

          {vagasNoCaminho !== null ? (
            <p className="rounded-media border border-linha-suave bg-superficie p-3 text-[12.5px] leading-relaxed">
              {vagasNoCaminho} {rotuloPessoa.toLowerCase()}(s) ocupam este horário.
              Encerrar tira ele da grade daqui para frente.
            </p>
          ) : null}

          {erro ? <p className="rounded-padrao bg-alerta-fundo px-3 py-2 text-[12.5px] text-alerta">{erro}</p> : null}

          <div className="flex gap-2">
            <button type="submit" disabled={pendente} className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]">
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
