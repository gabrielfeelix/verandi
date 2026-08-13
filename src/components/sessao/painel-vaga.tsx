'use client'

import { useState, useTransition } from 'react'
import type { Ocupacao } from '@/core/agenda/ocupacao'
import { ajustarCapacidade, cancelarSessao, encaixar } from '@/server/agenda/acoes'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { cartao, Chip, Nota, entrada } from '@/components/ui/pecas'

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
  /** o motivo já escrito, esperando a confirmação de cancelar */
  const [aCancelar, setACancelar] = useState<string | null>(null)

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
      className={`flex flex-col gap-4 ${cartao} p-4`}
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

          {/* quatro opções curtas: chips, não `<select>`. O menu esconde as
              alternativas atrás de um clique e, no toque, cobre meia tela com
              uma lista do sistema */}
          <div aria-label="Tipo" className="flex flex-wrap gap-1.5">
            {([
              ['avulso', 'Avulso'],
              ['reposicao', 'Reposição'],
              ['encaixe', 'Encaixe'],
              ['reserva', 'Reserva'],
            ] as const).map(([valor, rotulo]) => (
              <Chip key={valor} ativo={origem === valor} onClick={() => setOrigem(valor)}>
                {rotulo}
              </Chip>
            ))}
          </div>

          <input
            id="busca-pessoa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className={entrada}
          />

          {achados.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {achados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => adicionar(c.id)}
                    className="w-full cursor-pointer rounded-padrao border border-linha-suave px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:border-marca hover:bg-superficie-tenue"
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
                <Botao tom="perigo" miudo disabled={pendente} onClick={() => adicionar(excedente, true)}>
                  Encaixar mesmo assim
                </Botao>
                <Botao tom="fantasma" miudo onClick={() => setExcedente(null)}>
                  Não encaixar
                </Botao>
              </div>
            </div>
          ) : null}

          {aviso ? (
            <div role="alert">
              <Nota tom="atencao">{aviso}</Nota>
            </div>
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
            className={`${entrada} w-24 px-2.5 text-center font-mono`}
          />
        </div>
        <Botao type="submit" tom="secundario" miudo disabled={pendente}>
          Salvar
        </Botao>
      </form>
      <p className="text-[11.5px] leading-relaxed text-tinta-media">
        Muda só este horário. A grade fixa das outras semanas continua igual.
      </p>

      {!cancelada ? (
        <form
          action={(f) => {
            const motivo = String(f.get('motivo') ?? '').trim()
            if (!motivo) return
            setACancelar(motivo)
          }}
          className="flex items-end gap-2 border-t border-linha-fina pt-3"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="motivo" className="text-[12.5px] font-medium">
              Cancelar este horário
            </label>
            <input id="motivo" name="motivo" required placeholder="Motivo" className={entrada} />
          </div>
          <Botao type="submit" tom="perigo" miudo disabled={pendente}>
            Cancelar horário
          </Botao>
        </form>
      ) : null}

      {/*
       * `confirm()` do navegador não cabia aqui: ele não diz o que acontece com
       * o que já existe, não dá para ler com calma e aparece com a cara do
       * sistema operacional no meio do produto.
       */}
      <Modal
        aberto={aCancelar !== null}
        perigo
        largura="confirmacao"
        titulo="Cancelar este horário?"
        sub={aCancelar ?? undefined}
        primario="Cancelar horário"
        secundario="Voltar"
        pendente={pendente}
        aoFechar={() => setACancelar(null)}
        aoConfirmar={() => {
          const motivo = aCancelar
          if (!motivo) return
          setACancelar(null)
          iniciar(() => cancelarSessao(sessaoId, motivo))
        }}
      >
        <p className="text-[13px] leading-[1.55] text-tinta-media">
          {quantasPessoas} pessoa(s) serão avisadas. O horário some da agenda do
          dia e continua no histórico, com o motivo escrito — quem tem vaga fixa
          neste horário ganha crédito de reposição.
        </p>
      </Modal>
    </section>
  )
}
