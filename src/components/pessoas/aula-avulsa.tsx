'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { buscarCandidatos } from '@/server/agenda/acoes'
import { Botao } from '@/components/ui/botao'
import { Avatar, Campo, Nota, entrada } from '@/components/ui/pecas'
import { marcarAulaAvulsa, profissionaisParaAvulsa } from '@/server/agenda/avulsa'
import { Escolha } from '@/components/ui/escolha'
import { CampoDinheiro } from '@/components/ui/campo-dinheiro'
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
  pessoaId, servicos, servicoInicial, aoConcluir, aoVoltar, rotuloBotao = 'Criar aula avulsa',
}: {
  /** o texto do botão principal: "Marcar neste dia e hora" no Marcar aula */
  rotuloBotao?: string
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
  const [profs, setProfs] = useState<Array<{ id: string; nome: string; cor: string | null; foto: string | null }> | null>(null)
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
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar nome={aluno.nome} tamanho={24} decorativo />
                <span className="truncate font-medium">{aluno.nome}</span>
              </span>
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
                        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-superficie-suave">
                        {/* o mesmo desenho do Encaixar aluno e da busca do Hoje */}
                        <Avatar nome={x.nome} tamanho={32} decorativo />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14.5px] font-medium">{x.nome}</span>
                          {x.detalhe ? <span className="text-[12px] text-tinta-media">{x.detalhe}</span> : null}
                        </span>
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
        <Escolha
          id="av-servico"
          nome="servico"
          valorInicial={servico}
          aoTrocar={setServico}
          opcoes={[
            ...servicos.map((s) => ({ valor: s.id, rotulo: s.nome })),
            { valor: NOVA, rotulo: 'Nova modalidade', detalhe: 'Escreva o nome a seguir' },
          ]}
        />
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
          {profs === null ? (
            <span className="campo flex items-center text-tinta-fraca">Carregando…</span>
          ) : (
            <Escolha
              id="av-prof"
              nome="profissional"
              valorInicial={profissional}
              aoTrocar={setProfissional}
              placeholder="Sem professor definido"
              opcoes={[
                { valor: '', rotulo: 'Sem professor definido' },
                ...profs.map((p) => ({
                  valor: p.id, rotulo: p.nome, avatar: { nome: p.nome, foto: p.foto, cor: p.cor },
                })),
              ]}
            />
          )}
        </Campo>
        <Campo rotulo="Valor" htmlFor="av-valor"
          dica={quem ? 'Em branco: sem cobrança.' : 'A cobrança sai quando há aluno.'}>
          <CampoDinheiro id="av-valor" valor={valor} aoMudar={setValor} disabled={!quem} />
        </Campo>
      </div>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {aoVoltar ? (
          <Botao tom="secundario" onClick={aoVoltar} disabled={pendente}>Voltar aos horários</Botao>
        ) : null}
        <Botao onClick={salvar} disabled={pendente}>
          {pendente ? 'Marcando…' : rotuloBotao}
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
