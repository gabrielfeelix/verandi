'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { buscarCandidatos } from '@/server/agenda/acoes'
import { Botao } from '@/components/ui/botao'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { marcarAulaAvulsa, profissionaisParaAvulsa } from '@/server/agenda/avulsa'
import { emCentavos } from '@/core/planos/plano'

type Servico = { id: string; nome: string }
const NOVA = '__nova__'

/**
 * O formulário da aula avulsa: no "Marcar aula" da ficha (a pessoa já vem) e
 * no botão da Agenda (a pessoa é opcional).
 *
 * Modalidade (ou uma nova, escrita ali), dia, hora, duração, lugares,
 * professor e valor. Valor em branco marca sem cobrança; sem pessoa não há
 * cobrança, porque ela é de alguém. O que acontece por trás está em
 * `server/agenda/avulsa.ts`.
 */
export function FormAulaAvulsa({
  pessoaId, servicos, servicoInicial, aoConcluir, aoVoltar,
}: {
  /** `null`: a Agenda, onde se escolhe (ou não) o aluno aqui */
  pessoaId: string | null
  servicos: Servico[]
  servicoInicial: string | null
  aoConcluir: (texto: string, sessaoId: string) => void
  aoVoltar?: () => void
}) {
  const [aluno, setAluno] = useState<{ id: string; nome: string } | null>(null)
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<Array<{ id: string; nome: string; detalhe: string }>>([])
  const quem = pessoaId ?? aluno?.id ?? null

  useEffect(() => {
    if (pessoaId || aluno || termo.trim().length < 2) return
    const t = setTimeout(() => {
      buscarCandidatos(termo).then(setAchados).catch(() => setAchados([]))
    }, 250)
    return () => clearTimeout(t)
  }, [termo, pessoaId, aluno])

  const [servico, setServico] = useState(servicoInicial ?? servicos[0]?.id ?? NOVA)
  const [novo, setNovo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState('60')
  const [lugares, setLugares] = useState('1')
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
    const valorCent = quem && valor.trim() ? emCentavos(valor) : 0
    if (valorCent === null) return setErro('Valor inválido. Exemplo: 120,00')
    iniciar(async () => {
      const r = await marcarAulaAvulsa({
        pessoaId: quem,
        servicoId: servico === NOVA ? null : servico,
        novoServico: servico === NOVA ? novo : undefined,
        data, hora,
        duracaoMin: Number(duracao) || 0,
        profissionalId: profissional || null,
        capacidade: Number(lugares) || 0,
        valorCent,
      })
      if (!r.ok) return setErro(r.erro)
      const nomeServico = servico === NOVA ? novo.trim() : servicos.find((s) => s.id === servico)?.nome
      const [a, m, d] = data.split('-')
      aoConcluir(`aula avulsa de ${nomeServico} em ${d}/${m}/${a}, ${hora}${
        valorCent ? `, cobrança de R$ ${(valorCent / 100).toFixed(2).replace('.', ',')}` : ''}.`, r.sessaoId)
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      {pessoaId ? null : (
        <Campo rotulo="Aluno" htmlFor="av-aluno" dica="Opcional. Mais alunos entram depois pela tela da aula.">
          {aluno ? (
            <span className="flex min-h-11 items-center justify-between gap-2 rounded-padrao border border-linha bg-superficie px-3 text-[14.5px]">
              {aluno.nome}
              <button type="button" onClick={() => { setAluno(null); setTermo('') }}
                className="cursor-pointer text-[13.5px] text-tinta-media hover:text-tinta">Trocar</button>
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              <input id="av-aluno" value={termo} onChange={(e) => setTermo(e.target.value)}
                placeholder="Exemplo: Maria" className={entrada} autoComplete="off" />
              {termo.trim().length >= 2 && achados.length ? (
                <ul className="flex max-h-44 flex-col overflow-y-auto rounded-padrao border border-linha-suave bg-superficie">
                  {achados.slice(0, 8).map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => { setAluno({ id: x.id, nome: x.nome }); setAchados([]) }}
                        className="flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-superficie-suave">
                        <span className="text-[14.5px]">{x.nome}</span>
                        {x.detalhe ? <span className="text-[12px] text-tinta-media">{x.detalhe}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Campo>
      )}

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <Campo rotulo="Lugares" htmlFor="av-lugares">
          <input id="av-lugares" inputMode="numeric" value={lugares}
            onChange={(e) => setLugares(e.target.value.replace(/\D/g, ''))} className={entrada} />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Professor" htmlFor="av-prof">
          <select id="av-prof" value={profissional} onChange={(e) => setProfissional(e.target.value)} className={entrada}>
            <option value="">Sem professor definido</option>
            {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Valor (R$)" htmlFor="av-valor"
          dica={quem ? 'Em branco: sem cobrança.' : 'A cobrança sai quando há aluno.'}>
          <input id="av-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
            disabled={!quem} placeholder="Exemplo: 120,00" className={`${entrada} disabled:opacity-50`} />
        </Campo>
      </div>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {aoVoltar ? (
          <Botao tom="secundario" onClick={aoVoltar} disabled={pendente}>Voltar aos horários</Botao>
        ) : null}
        <Botao onClick={salvar} disabled={pendente}>
          {pendente ? 'Criando…' : 'Criar aula avulsa'}
        </Botao>
      </div>
    </div>
  )
}

/** O botão "Aula avulsa" da Agenda: cria a aula e abre a tela dela. */
export function NovaAulaAvulsa({ servicos }: { servicos: Servico[] }) {
  const [aberto, setAberto] = useState(false)
  const router = useRouter()
  return (
    <>
      <Botao tom="secundario" onClick={() => setAberto(true)}>Aula avulsa</Botao>
      {aberto ? (
        <Modal
          aberto
          glifo="+"
          titulo="Aula avulsa"
          sub="Em qualquer dia e hora, com quantos lugares precisar."
          largura="lista"
          secundario="Fechar"
          aoFechar={() => setAberto(false)}
        >
          <FormAulaAvulsa
            pessoaId={null}
            servicos={servicos}
            servicoInicial={null}
            aoConcluir={(_, sessaoId) => {
              setAberto(false)
              router.push(`/sessao/${sessaoId}`)
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
