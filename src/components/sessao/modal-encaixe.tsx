'use client'

import { useState, useTransition } from 'react'
import type { Ocupacao } from '@/core/agenda/ocupacao'
import { ajustarCapacidade, encaixar } from '@/server/agenda/acoes'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { Avatar, Chip, Nota, Rotulo, entrada } from '@/components/ui/pecas'
import { useChamada } from './chamada'

type Candidato = { id: string; nome: string; detalhe: string }

type Props = {
  sessaoId: string
  ocupacao: Ocupacao
  candidatos: Candidato[]
  rotuloPessoa: string
  /** "Pilates Solo · 12 ago 09:00", para o subtítulo do modal */
  ondeQuando: string
}

/**
 * Encaixar alguém neste horário.
 *
 * É modal, e não painel fixo na lateral, porque a tela de chamada tem uma
 * pergunta só — "quem veio?" — e um formulário de busca parado ao lado dela
 * disputa a atenção com a única coisa que importa enquanto a turma entra.
 */
export function ModalEncaixe({
  sessaoId, ocupacao, candidatos, rotuloPessoa, ondeQuando,
}: Props) {
  const { encaixeAberto, fecharEncaixe } = useChamada()
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
        fecharEncaixe()
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
    <Modal
      aberto={encaixeAberto}
      glifo="+"
      largura="lista"
      titulo={`Encaixar ${rotuloPessoa.toLowerCase()}`}
      sub={`${ondeQuando} · ${ocupacao.ocupadas}/${ocupacao.capacidade}${
        ocupacao.lotada ? ' — cheio' : ` — ${ocupacao.livres} livre(s)`}`}
      secundario="Fechar"
      aoFechar={() => { setAviso(null); setExcedente(null); fecharEncaixe() }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="busca-pessoa">
          <Rotulo>Quem</Rotulo>
        </label>
        <input
          id="busca-pessoa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome"
          className={entrada}
        />

        {achados.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {achados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => adicionar(c.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-media border border-linha-suave px-3 py-2.5 text-left transition-colors duration-150 hover:border-marca hover:bg-superficie-tenue"
                >
                  <Avatar nome={c.nome} tamanho={32} decorativo />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[14px] font-medium">{c.nome}</span>
                    <span className="text-[11.5px] text-tinta-media">{c.detalhe}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* quatro opções curtas: chips, não `<select>`. O menu esconde as
          alternativas atrás de um clique e, no toque, cobre meia tela com uma
          lista do sistema */}
      <div className="flex flex-col gap-2">
        <Rotulo>Origem</Rotulo>
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
      </div>

      {/* Passa da capacidade: a tela conta o que vai acontecer e pede o segundo
          toque. 5/4 é decisão de quem está no balcão, com nome e registro —
          nunca o sistema deixando passar. */}
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

      {/*
        * A capacidade do dia mora aqui, e não numa seção própria da tela.
        *
        * Ela só é procurada quando falta vaga — e é exatamente esse o momento em
        * que este modal está aberto. Fora dele, é um campo numérico pedindo para
        * ser mexido sem motivo.
        */}
      <form
        action={(f) => {
          const n = Number(f.get('capacidade'))
          iniciar(async () => {
            await ajustarCapacidade(sessaoId, n)
            setAviso(null)
          })
        }}
        className="flex items-end gap-2 border-t border-linha-fina pt-3.5"
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
      <p className="pb-1 text-[11.5px] leading-relaxed text-tinta-media">
        Muda só este horário. A grade fixa das outras semanas continua igual.
      </p>
    </Modal>
  )
}
