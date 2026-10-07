'use client'

import { useEffect, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/botao'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { marcarAulaAvulsa, profissionaisParaAvulsa } from '@/server/agenda/avulsa'
import { emCentavos } from '@/core/planos/plano'

type Servico = { id: string; nome: string }
const NOVA = '__nova__'

/**
 * O formulário da aula avulsa fora da grade, dentro do "Marcar aula".
 *
 * Modalidade (ou uma nova, escrita ali), dia, hora, duração, professor e
 * valor. Valor zero marca sem cobrança. O que acontece por trás está em
 * `server/agenda/avulsa.ts`.
 */
export function FormAulaAvulsa({
  pessoaId, servicos, servicoInicial, aoConcluir, aoVoltar,
}: {
  pessoaId: string
  servicos: Servico[]
  servicoInicial: string | null
  aoConcluir: (texto: string) => void
  aoVoltar: () => void
}) {
  const [servico, setServico] = useState(servicoInicial ?? servicos[0]?.id ?? NOVA)
  const [novo, setNovo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState('60')
  const [profissional, setProfissional] = useState('')
  const [valor, setValor] = useState('')
  const [profs, setProfs] = useState<Array<{ id: string; nome: string }>>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  useEffect(() => {
    profissionaisParaAvulsa().then(setProfs).catch(() => setProfs([]))
  }, [])

  function salvar() {
    setErro(null)
    const valorCent = valor.trim() ? emCentavos(valor) : 0
    if (valorCent === null) return setErro('Valor inválido. Exemplo: 120,00')
    iniciar(async () => {
      const r = await marcarAulaAvulsa({
        pessoaId,
        servicoId: servico === NOVA ? null : servico,
        novoServico: servico === NOVA ? novo : undefined,
        data, hora,
        duracaoMin: Number(duracao) || 0,
        profissionalId: profissional || null,
        valorCent,
      })
      if (!r.ok) return setErro(r.erro)
      const nomeServico = servico === NOVA ? novo.trim() : servicos.find((s) => s.id === servico)?.nome
      const [a, m, d] = data.split('-')
      aoConcluir(`${nomeServico} avulsa marcada para ${d}/${m}/${a}, ${hora}${
        valorCent ? `, cobrança de R$ ${(valorCent / 100).toFixed(2).replace('.', ',')}` : ''}.`)
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Campo rotulo="Modalidade" htmlFor="av-servico" obrigatorio>
        <select id="av-servico" value={servico} onChange={(e) => setServico(e.target.value)} className={entrada}>
          {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          <option value={NOVA}>Nova modalidade…</option>
        </select>
      </Campo>
      {servico === NOVA ? (
        <Campo rotulo="Nome da nova modalidade" htmlFor="av-novo" obrigatorio>
          <input id="av-novo" value={novo} onChange={(e) => setNovo(e.target.value)}
            placeholder="Exemplo: Ventosa" className={entrada} />
        </Campo>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Campo rotulo="Dia" htmlFor="av-data" obrigatorio>
          <input id="av-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={entrada} />
        </Campo>
        <Campo rotulo="Hora" htmlFor="av-hora" obrigatorio>
          <input id="av-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={entrada} />
        </Campo>
        <Campo rotulo="Duração (min)" htmlFor="av-duracao">
          <input id="av-duracao" inputMode="numeric" value={duracao}
            onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ''))} className={entrada} />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Professor" htmlFor="av-prof">
          <select id="av-prof" value={profissional} onChange={(e) => setProfissional(e.target.value)} className={entrada}>
            <option value="">Sem professor definido</option>
            {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Valor (R$)" htmlFor="av-valor" dica="Em branco: sem cobrança.">
          <input id="av-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="Exemplo: 120,00" className={entrada} />
        </Campo>
      </div>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Botao tom="secundario" onClick={aoVoltar} disabled={pendente}>Voltar aos horários</Botao>
        <Botao onClick={salvar} disabled={pendente}>
          {pendente ? 'Marcando…' : 'Marcar aula avulsa'}
        </Botao>
      </div>
    </div>
  )
}
