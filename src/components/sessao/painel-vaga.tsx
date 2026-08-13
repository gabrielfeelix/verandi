'use client'

import { useState, useTransition } from 'react'
import type { Ocupacao } from '@/core/agenda/ocupacao'
import { ajustarCapacidade, cancelarSessao, encaixar } from '@/server/agenda/acoes'

type Candidato = { id: string; nome: string; detalhe: string }

type Props = {
  sessaoId: string
  ocupacao: Ocupacao
  cancelada: boolean
  quantasPessoas: number
  candidatos: Candidato[]
  rotuloPessoa: string
}

export function PainelVaga({
  sessaoId, ocupacao, cancelada, quantasPessoas, candidatos, rotuloPessoa,
}: Props) {
  const [pendente, iniciar] = useTransition()
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<'avulso' | 'reposicao' | 'encaixe' | 'reserva'>('avulso')
  const [aviso, setAviso] = useState<string | null>(null)
  /** quem está esperando a confirmação de passar da capacidade */
  const [excedente, setExcedente] = useState<string | null>(null)

  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

  const achados = busca.trim().length < 2
    ? []
    : candidatos
        .filter((c) => normalizar(c.nome).includes(normalizar(busca)))
        .slice(0, 8)

  /**
   * Encaixar acima da capacidade **pede confirmação explícita**.
   *
   * A tela mostra 4/4; sem o segundo passo, o excedente viraria acidente de
   * clique em vez de decisão de quem está no balcão.
   */
  function adicionar(pessoaId: string, confirmarAcima = false) {
    setAviso(null)
    iniciar(async () => {
      const r = await encaixar({ sessaoId, pessoaId, origem, confirmarAcima })
      if (r.ok) {
        setBusca('')
        setExcedente(null)
        return
      }
      if (r.motivo === 'acima_da_capacidade') {
        setExcedente(pessoaId)
        return
      }
      setExcedente(null)
      setAviso(
        r.motivo === 'lotada'
          ? 'Este horário está cheio. Para caber mais um, aumente a capacidade abaixo.'
          : `Essa ${rotuloPessoa.toLowerCase()} já está neste horário.`,
      )
    })
  }

  return (
    <section
      id="encaixar"
      className="flex flex-col gap-4 rounded-cartao border border-linha bg-superficie p-4"
    >
      <div>
        <h2 className="font-titulo text-[17px] font-semibold">Vagas</h2>
        <p className={`text-[12.5px] ${ocupacao.excedida ? 'font-medium text-alerta' : 'text-tinta-media'}`}>
          {ocupacao.ocupadas}/{ocupacao.capacidade}
          {ocupacao.lotada ? ' — cheio' : ` — ${ocupacao.livres} livre(s)`}
        </p>
      </div>

      {!cancelada ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="busca-pessoa" className="text-[12.5px] font-medium">
            Colocar alguém neste horário
          </label>

          <select
            aria-label="Tipo"
            value={origem}
            onChange={(e) => setOrigem(e.target.value as typeof origem)}
            className="min-h-10 rounded-padrao border border-linha bg-superficie px-2.5 text-[13px]"
          >
            <option value="avulso">Avulso</option>
            <option value="reposicao">Reposição</option>
            <option value="encaixe">Encaixe</option>
            <option value="reserva">Reserva</option>
          </select>

          <input
            id="busca-pessoa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px] placeholder:text-tinta-fraca"
          />

          {achados.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {achados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => adicionar(c.id)}
                    className="w-full rounded-padrao border border-linha-suave px-3 py-2.5 text-left text-[13px] hover:border-marca hover:bg-[#F9FCFB]"
                  >
                    {c.nome}
                    <span className="ml-2 text-[11.5px] text-tinta-media">{c.detalhe}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Passa da capacidade: a tela conta o que vai acontecer e pede o
              segundo toque. 5/4 é decisão de quem está no balcão, com nome e
              registro — nunca o sistema deixando passar. */}
          {excedente ? (
            <div className="flex flex-col gap-2 rounded-media border border-alerta-linha bg-alerta-superficie p-3">
              <p className="text-[12.5px] leading-relaxed text-alerta-texto">
                Este horário já está com {ocupacao.ocupadas}/{ocupacao.capacidade}.
                Encaixar deixa {ocupacao.ocupadas + 1}/{ocupacao.capacidade}, e fica
                registrado como decisão sua.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => adicionar(excedente, true)}
                  className="min-h-10 rounded-padrao bg-alerta px-3 text-[12.5px] font-medium text-white"
                >
                  Encaixar mesmo assim
                </button>
                <button
                  type="button"
                  onClick={() => setExcedente(null)}
                  className="min-h-10 px-2 text-[12.5px] text-tinta-media underline"
                >
                  Não encaixar
                </button>
              </div>
            </div>
          ) : null}

          {aviso ? (
            <p role="alert" className="rounded-padrao bg-atencao-fundo px-3 py-2 text-[12.5px] text-atencao">
              {aviso}
            </p>
          ) : null}
        </div>
      ) : null}

      <form
        action={(f) => {
          const n = Number(f.get('capacidade'))
          iniciar(async () => {
            await ajustarCapacidade(sessaoId, n)
            setAviso(null)
          })
        }}
        className="flex items-end gap-2 border-t border-linha-fina pt-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="capacidade" className="text-[12.5px] font-medium">
            Capacidade só deste dia
          </label>
          <input
            id="capacidade" name="capacidade" type="number" min={1}
            defaultValue={ocupacao.capacidade}
            className="min-h-10 w-24 rounded-padrao border border-linha bg-superficie px-2.5 text-center font-mono text-[14px]"
          />
        </div>
        <button
          type="submit" disabled={pendente}
          className="min-h-10 rounded-padrao border border-linha bg-superficie px-3 text-[12.5px] hover:bg-superficie-suave"
        >
          Salvar
        </button>
      </form>
      <p className="text-[11.5px] leading-relaxed text-tinta-media">
        Muda só este horário. A grade fixa das outras semanas continua igual.
      </p>

      {!cancelada ? (
        <form
          action={(f) => {
            const motivo = String(f.get('motivo') ?? '').trim()
            if (!motivo) return
            const quantos = quantasPessoas
            if (!confirm(`Cancelar este horário? ${quantos} pessoa(s) serão avisadas.`)) return
            iniciar(() => cancelarSessao(sessaoId, motivo))
          }}
          className="flex items-end gap-2 border-t border-linha-fina pt-3"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="motivo" className="text-[12.5px] font-medium">
              Cancelar este horário
            </label>
            <input
              id="motivo" name="motivo" required placeholder="Motivo"
              className="min-h-10 rounded-padrao border border-linha bg-superficie px-2.5 text-[13px] placeholder:text-tinta-fraca"
            />
          </div>
          <button
            type="submit" disabled={pendente}
            className="min-h-10 rounded-padrao border border-alerta-linha-forte bg-alerta-superficie px-3 text-[12.5px] font-medium text-alerta hover:bg-alerta-fundo"
          >
            Cancelar horário
          </button>
        </form>
      ) : null}
    </section>
  )
}
