'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { buscarCandidatos } from '@/server/agenda/acoes'
import { Botao } from '@/components/ui/botao'
import { Icone } from '@/components/ui/icones'
import { Avatar, Campo, Chip, Nota, entrada } from '@/components/ui/pecas'
import { marcarAulaAvulsa, profissionaisParaAvulsa } from '@/server/agenda/avulsa'
import { criarPessoa } from '@/server/pessoas/acoes'
import {
  fixarNaTurma, situacaoDoContrato, turmasDaModalidade,
  type HorarioFixo, type SituacaoDoContrato, type Turma,
} from '@/server/agenda/fixo'
import { erroDoTelefone, mascararTelefone } from '@/core/telefone'
import { Escolha } from '@/components/ui/escolha'
import { CampoDinheiro } from '@/components/ui/campo-dinheiro'
import { CampoData } from '@/components/ui/campo-data'
import { emCentavos } from '@/core/planos/plano'

type Servico = { id: string; nome: string }
type Tipo = 'avulso' | 'experimental' | 'fixo'
const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const rotuloDoFixo = (h: HorarioFixo) => `${DIA_CURTO[h.dia]} ${h.hora}${h.codigo ? ` (${h.codigo})` : ''}`
/** o que o servidor devolveu e que pede uma decisão de quem está marcando */
type Decisao =
  | { tipo: 'lotada'; ocupadas: number; capacidade: number }
  | { tipo: 'limite'; plano: string; porSemana: number; usados: HorarioFixo[] }
  | { tipo: 'sem_contrato' }
type Aluno = { id: string; nome: string }
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
  pessoaId, servicos, servicoInicial, aoConcluir, aoVoltar, rotuloBotao,
  tipoInicial = 'avulso', alunoInicial = null,
}: {
  /** "Marcar outra experimental" volta com o tipo e o aluno da anterior */
  tipoInicial?: Tipo
  alunoInicial?: Aluno | null
  /** o texto do botão principal: "Marcar neste dia e hora" no Marcar aula */
  rotuloBotao?: string
  /** `null`: a Agenda, onde se escolhe (ou não) o aluno aqui */
  pessoaId: string | null
  servicos: Servico[]
  servicoInicial: string | null
  aoConcluir: (texto: string, sessaoId: string | null, marcada: { tipo: Tipo; aluno: Aluno | null }) => void
  aoVoltar?: () => void
}) {
  const [aluno, setAluno] = useState<Aluno | null>(alunoInicial)
  /*
   * Aluno novo só é gravado junto com a aula. Cadastrar ao abrir o campo
   * deixaria ficha órfã de toda experimental desistida no meio do caminho.
   */
  const [novoAluno, setNovoAluno] = useState<{ nome: string; telefone: string } | null>(null)
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<Array<{ id: string; nome: string; detalhe: string }>>([])
  const quem = pessoaId ?? aluno?.id ?? null

  useEffect(() => {
    if (pessoaId || aluno || novoAluno || termo.trim().length < 2) return
    const t = setTimeout(() => {
      buscarCandidatos(termo).then(setAchados).catch(() => setAchados([]))
    }, 250)
    return () => clearTimeout(t)
  }, [termo, pessoaId, aluno, novoAluno])

  const [servico, setServico] = useState(servicoInicial ?? servicos[0]?.id ?? NOVA)
  const [novo, setNovo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState('60')
  const [lugares, setLugares] = useState('1')
  const [profissional, setProfissional] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState<Tipo>(tipoInicial)
  const experimental = tipo === 'experimental'
  const fixo = tipo === 'fixo'
  // o aluno é obrigatório em tudo que não é avulsa: é dele a primeira aula, ou o horário
  const exigeAluno = experimental || fixo

  /* ---- Fixo: turmas da modalidade, o contrato do aluno e a decisão pendente ---- */
  // guardadas com a chave de quem pediu: troca de modalidade ou de aluno não
  // mostra a resposta velha enquanto a nova não chega
  const [turmasDe, setTurmasDe] = useState<{ chave: string; turmas: Turma[] } | null>(null)
  const [turmaId, setTurmaId] = useState('')
  const [desde, setDesde] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [situacaoDe, setSituacaoDe] = useState<{ chave: string; situacao: SituacaoDoContrato } | null>(null)
  const [decisao, setDecisao] = useState<Decisao | null>(null)
  const [trocar, setTrocar] = useState('')
  /** o que já foi decidido nesta escolha de turma: o reenvio leva tudo junto */
  const [aceitos, setAceitos] = useState<{ aumentar?: boolean; trocar?: string; semContrato?: boolean }>({})
  function decidir(c: { aumentar?: boolean; trocar?: string; semContrato?: boolean }) {
    const juntos = { ...aceitos, ...c }
    setAceitos(juntos)
    salvar(juntos)
  }
  const servicoDoFixo = fixo && servico !== NOVA ? servico : null
  const chaveDaSituacao = servicoDoFixo && quem ? `${quem}:${servicoDoFixo}` : null
  const turmas = servicoDoFixo && turmasDe?.chave === servicoDoFixo ? turmasDe.turmas : null
  const situacao = chaveDaSituacao && situacaoDe?.chave === chaveDaSituacao ? situacaoDe.situacao : null

  useEffect(() => {
    if (!servicoDoFixo) return
    turmasDaModalidade(servicoDoFixo)
      .then((t) => setTurmasDe({ chave: servicoDoFixo, turmas: t }))
      .catch(() => setTurmasDe({ chave: servicoDoFixo, turmas: [] }))
  }, [servicoDoFixo])

  useEffect(() => {
    if (!servicoDoFixo || !quem || !chaveDaSituacao) return
    situacaoDoContrato(quem, servicoDoFixo)
      .then((r) => setSituacaoDe({ chave: chaveDaSituacao, situacao: r }))
      .catch(() => {})
  }, [servicoDoFixo, quem, chaveDaSituacao])
  const [profs, setProfs] = useState<Array<{ id: string; nome: string; cor: string | null; foto: string | null }> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  useEffect(() => {
    profissionaisParaAvulsa().then(setProfs).catch(() => setProfs([]))
  }, [])

  /** as decisões já tomadas na tela, que o reenvio leva junto */
  type Confirmar = { aumentar?: boolean; trocar?: string; semContrato?: boolean }
  function salvar(confirmar: Confirmar = {}) {
    setErro(null)
    setDecisao(null)
    const temAluno = Boolean(quem || novoAluno)
    // Experimental não se cobra: o valor nem aparece.
    const valorCent = !experimental && temAluno && valor.trim() ? emCentavos(valor) : 0
    if (valorCent === null) return setErro('Valor inválido. Exemplo: 120,00')
    if (experimental && !temAluno) return setErro('Na aula experimental, escolha o aluno ou cadastre um novo.')
    if (fixo && !temAluno) return setErro('No horário fixo, escolha o aluno ou cadastre um novo.')
    if (fixo && !turmaId) return setErro('Escolha a turma.')
    if (novoAluno) {
      if (novoAluno.nome.trim().length < 2) return setErro('Escreva o nome do novo aluno.')
      const erroTel = novoAluno.telefone.trim() ? erroDoTelefone(novoAluno.telefone) : null
      if (erroTel) return setErro(erroTel)
    }
    iniciar(async () => {
      let alunoDaAula: Aluno | null = pessoaId ? null : aluno
      let idDoAluno = quem
      if (novoAluno) {
        try {
          const criado = await criarPessoa({
            nome: novoAluno.nome.trim(),
            telefone: novoAluno.telefone.trim() || undefined,
          })
          alunoDaAula = { id: criado.id, nome: novoAluno.nome.trim() }
          idDoAluno = criado.id
          // Se a aula falhar logo abaixo, a nova tentativa usa a ficha já criada.
          setAluno(alunoDaAula)
          setNovoAluno(null)
        } catch (e) {
          return setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar o aluno.')
        }
      }
      if (fixo) {
        const f = await fixarNaTurma({
          serieId: turmaId, pessoaId: idDoAluno!, desde,
          aumentarTurma: confirmar.aumentar, trocarVagaId: confirmar.trocar, semContrato: confirmar.semContrato,
        })
        if (!f.ok) {
          if (f.motivo === 'lotada') return setDecisao({ tipo: 'lotada', ocupadas: f.ocupadas, capacidade: f.capacidade })
          if (f.motivo === 'limite') {
            setTrocar(f.usados[0]?.vagaId ?? '')
            return setDecisao({ tipo: 'limite', plano: f.plano, porSemana: f.porSemana, usados: f.usados })
          }
          if (f.motivo === 'sem_contrato') return setDecisao({ tipo: 'sem_contrato' })
          if (f.motivo === 'dia_nao_permitido') return setErro(`O plano ${f.plano} vale só ${f.dias.map((d) => DIA_CURTO[d]).join(', ')}.`)
          return setErro(f.erro)
        }
        const t = turmas?.find((x) => x.id === turmaId)
        const [a, m, d] = desde.split('-')
        aoConcluir(`horário fixo ${t ? `${DIA_CURTO[t.dia]} ${t.hora}` : ''} a partir de ${d}/${m}/${a}.`, f.sessaoId,
          { tipo, aluno: alunoDaAula ?? (idDoAluno ? { id: idDoAluno, nome: '' } : null) })
        return
      }
      const r = await marcarAulaAvulsa({
        pessoaId: idDoAluno,
        servicoId: servico === NOVA ? null : servico,
        novoServico: servico === NOVA ? novo : undefined,
        data, hora,
        duracaoMin: Number(duracao) || 0,
        profissionalId: profissional || null,
        capacidade: Number(lugares) || 0,
        valorCent,
        origem: tipo,
      })
      if (!r.ok) return setErro(r.erro)
      const nomeServico = servico === NOVA ? novo.trim() : servicos.find((s) => s.id === servico)?.nome
      const [a, m, d] = data.split('-')
      aoConcluir(`aula ${experimental ? 'experimental' : 'avulsa'} de ${nomeServico} em ${d}/${m}/${a}, ${hora}${
        valorCent ? `, cobrança de R$ ${(valorCent / 100).toFixed(2).replace('.', ',')}` : ''}.`, r.sessaoId,
      { tipo, aluno: alunoDaAula })
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* O tipo vem primeiro: ele decide se o aluno é obrigatório e se há valor. */}
      <Campo rotulo="Tipo da aula">
        <div role="group" aria-label="Tipo da aula" className="flex flex-wrap gap-1.5">
          <Chip type="button" ativo={!experimental} onClick={() => setTipo('avulso')}>Avulsa</Chip>
          <Chip type="button" ativo={experimental} onClick={() => setTipo('experimental')}>Experimental</Chip>
          <Chip type="button" ativo={fixo} onClick={() => setTipo('fixo')}>Fixo</Chip>
        </div>
      </Campo>

      {pessoaId ? null : (
        <Campo rotulo="Aluno" htmlFor="av-aluno" obrigatorio={exigeAluno}
          dica={fixo
            ? 'Quem vai ter este horário toda semana. Não achou? Cadastre na hora.'
            : experimental
            ? 'Quem vem conhecer o estúdio. Não achou? Cadastre na hora.'
            : 'Opcional. Mais alunos entram depois pela tela da aula.'}>
          {novoAluno ? (
            <div className="flex flex-col gap-2 rounded-padrao border border-linha-suave bg-superficie-suave p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input id="av-aluno" aria-label="Nome do novo aluno" value={novoAluno.nome}
                  onChange={(e) => setNovoAluno({ ...novoAluno, nome: e.target.value })}
                  placeholder="Exemplo: Maria Souza" className={entrada} autoComplete="off" />
                <input aria-label="Telefone do novo aluno" type="tel" inputMode="tel" value={novoAluno.telefone}
                  onChange={(e) => setNovoAluno({ ...novoAluno, telefone: mascararTelefone(e.target.value) })}
                  placeholder="Exemplo: (11) 99999-9999" className={entrada} autoComplete="off" />
              </div>
              <span className="flex items-center justify-between gap-2 text-[12.5px] text-tinta-media">
                A ficha é criada junto com a aula.
                <button type="button" onClick={() => setNovoAluno(null)}
                  className="cursor-pointer text-[13.5px] text-tinta-media hover:text-tinta">Buscar um aluno</button>
              </span>
            </div>
          ) : aluno ? (
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
              {termo.trim().length >= 2 ? (
                <ul className="flex max-h-52 flex-col overflow-y-auto rounded-padrao border border-linha-suave bg-superficie">
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
                  <li>
                    <button type="button"
                      onClick={() => { setNovoAluno({ nome: termo.trim(), telefone: '' }); setAchados([]) }}
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-marca hover:bg-superficie-suave">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-linha">
                        <Icone nome="mais" tamanho={14} />
                      </span>
                      <span className="truncate text-[14.5px] font-medium">Cadastrar &ldquo;{termo.trim()}&rdquo; como novo aluno</span>
                    </button>
                  </li>
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
          aoTrocar={(v) => { setServico(v); setTurmaId(''); setDecisao(null); setAceitos({}) }}
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

      {fixo ? (
        <div className="flex flex-col gap-3.5">
          {/* O contrato primeiro: é ele que diz se cabe mais um horário. */}
          {novoAluno ? (
            <Nota tom="atencao">
              Aluno novo ainda não tem contrato: o horário fixo entra sem cobrança até o contrato ser criado na ficha.
            </Nota>
          ) : !quem ? null : situacao === null ? (
            <p className="text-[13px] text-tinta-media">Conferindo o contrato…</p>
          ) : situacao.contrato ? (
            <Nota tom="info">
              {situacao.contrato.plano} ·{' '}
              {situacao.contrato.porSemana
                ? `${situacao.usados.length} de ${situacao.contrato.porSemana} horários fixos usados`
                : 'sem limite de aulas por semana'}
              {situacao.usados.length ? ` · já tem ${situacao.usados.map(rotuloDoFixo).join(', ')}` : ''}
            </Nota>
          ) : (
            <Nota tom="atencao">
              Sem contrato desta modalidade: horário fixo sem contrato é aula sem cobrança.{' '}
              <a href={`/pessoas/${quem}?aba=contratos`} className="font-semibold underline">Criar contrato</a>
            </Nota>
          )}

          <Campo rotulo="A partir de" htmlFor="av-desde" obrigatorio>
            <CampoData id="av-desde" nome="desde" valorInicial={desde} aoTrocar={setDesde} limpavel={false} />
          </Campo>

          <Campo rotulo="Turma" obrigatorio>
            {turmas === null ? (
              <span className="campo flex items-center text-tinta-fraca">Carregando…</span>
            ) : turmas.length === 0 ? (
              <p className="text-[13.5px] text-tinta-media">
                Nenhuma turma desta modalidade na grade fixa.{' '}
                <a href="/grade" className="font-semibold text-marca underline">Criar na grade</a>
              </p>
            ) : (
              <div role="group" aria-label="Turma" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {turmas.map((t) => {
                  const cheia = t.ocupadas >= t.capacidade
                  const ja = situacao?.usados.some((u) => u.serieId === t.id) ?? false
                  const foraDoPlano = situacao?.contrato?.dias ? !situacao.contrato.dias.includes(t.dia) : false
                  const escolhida = turmaId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={ja || foraDoPlano}
                      aria-pressed={escolhida}
                      onClick={() => { setTurmaId(t.id); setDecisao(null); setAceitos({}) }}
                      className={`flex cursor-pointer flex-col items-start gap-0.5 rounded-grande border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        escolhida ? 'border-marca bg-superficie-suave ring-1 ring-marca' : 'border-linha-suave bg-superficie hover:bg-superficie-suave'
                      }`}
                    >
                      <span className="font-titulo text-[16px] font-semibold">{DIA_CURTO[t.dia]} {t.hora}</span>
                      <span className="truncate text-[12.5px] text-tinta-media">
                        {t.profissional ?? 'Sem professor'}{t.codigo ? ` · ${t.codigo}` : ''}
                      </span>
                      <span className={`text-[12px] ${cheia && !ja ? 'text-alerta' : 'text-tinta-fraca'}`}>
                        {ja ? 'já é horário dela' : foraDoPlano ? 'fora do plano' : cheia
                          ? `cheia (${t.ocupadas}/${t.capacidade})`
                          : `${t.capacidade - t.ocupadas} de ${t.capacidade} livres`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Campo>

          {/* O que pede decisão de quem está no balcão: nada disso acontece calado. */}
          {decisao ? (
            <div className="flex flex-col gap-2 rounded-media border border-alerta-linha bg-alerta-superficie p-3">
              <p className="text-[13.5px] leading-relaxed text-alerta-texto">
                {decisao.tipo === 'lotada'
                  ? `Turma cheia (${decisao.ocupadas}/${decisao.capacidade}). Para entrar, ela passa a ter ${decisao.ocupadas + 1} lugares, desta data em diante.`
                  : decisao.tipo === 'limite'
                    ? `O plano ${decisao.plano} dá ${decisao.porSemana} ${decisao.porSemana === 1 ? 'aula' : 'aulas'} por semana, e ${decisao.porSemana === 1 ? 'ela já tem' : 'todas já têm'} horário. Trocar qual por este?`
                    : 'Sem contrato desta modalidade: o horário entra como aula sem cobrança.'}
              </p>
              {decisao.tipo === 'limite' ? (
                <div role="group" aria-label="Horário a trocar" className="flex flex-wrap gap-1.5">
                  {decisao.usados.map((u) => (
                    <Chip key={u.vagaId} type="button" ativo={trocar === u.vagaId} onClick={() => setTrocar(u.vagaId)}>
                      {rotuloDoFixo(u)}
                    </Chip>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Botao
                  tom="perigo"
                  miudo
                  disabled={pendente || (decisao.tipo === 'limite' && !trocar)}
                  onClick={() => decidir(
                    decisao.tipo === 'lotada' ? { aumentar: true }
                      : decisao.tipo === 'limite' ? { trocar }
                        : { semContrato: true },
                  )}
                >
                  {decisao.tipo === 'lotada'
                    ? `Aumentar para ${decisao.ocupadas + 1} e fixar`
                    : decisao.tipo === 'limite' ? 'Trocar e fixar' : 'Seguir sem contrato'}
                </Botao>
                <Botao tom="fantasma" miudo onClick={() => setDecisao(null)}>Agora não</Botao>
              </div>
            </div>
          ) : null}
        </div>
      ) : (<>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(10rem,1.5fr)_1fr_1fr_1fr]">
        <Campo rotulo="Dia" htmlFor="av-data" obrigatorio>
          <CampoData id="av-data" nome="data" valorInicial={data} aoTrocar={setData} limpavel={false} />
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
        {experimental ? null : (
          <Campo rotulo="Valor" htmlFor="av-valor"
            dica={quem || novoAluno ? 'Em branco: sem cobrança.' : 'A cobrança sai quando há aluno.'}>
            <CampoDinheiro id="av-valor" valor={valor} aoMudar={setValor} disabled={!quem && !novoAluno} />
          </Campo>
        )}
      </div>
      </>)}

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {aoVoltar ? (
          <Botao tom="secundario" onClick={aoVoltar} disabled={pendente}>Voltar aos horários</Botao>
        ) : null}
        <Botao onClick={() => salvar(aceitos)} disabled={pendente}>
          {pendente ? 'Marcando…' : rotuloBotao ?? (fixo ? 'Colocar no horário fixo' : experimental ? 'Marcar aula experimental' : 'Criar aula avulsa')}
        </Botao>
      </div>
    </div>
  )
}

/**
 * O botão "Nova aula" da Agenda: avulsa ou experimental, em qualquer dia e hora.
 *
 * A avulsa abre a tela da aula ao terminar, como sempre. A experimental para
 * numa confirmação, porque quem vem conhecer o estúdio costuma experimentar
 * mais de uma modalidade: "Marcar outra" volta ao formulário com o mesmo aluno.
 */
export function NovaAulaAvulsa({ servicos }: { servicos: Servico[] }) {
  const [aberto, setAberto] = useState(false)
  const [feita, setFeita] = useState<{ texto: string; sessaoId: string; aluno: Aluno | null } | null>(null)
  const [rodada, setRodada] = useState(0)
  // o aluno da última experimental, para "Marcar outra" já vir com ele
  const [ultimoAluno, setUltimoAluno] = useState<Aluno | null>(null)
  const router = useRouter()

  function fechar() {
    setAberto(false)
    setFeita(null)
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}><Icone nome="mais" tamanho={16} />Nova aula</Botao>
      {aberto ? (
        <Modal
          aberto
          glifo="+"
          titulo="Nova aula"
          sub="Avulsa ou experimental, em qualquer dia e hora."
          largura="lista"
          secundario="Fechar"
          aoFechar={fechar}
        >
          {feita ? (
            <div className="flex flex-col gap-3.5">
              <Nota tom="positivo">
                {feita.aluno ? `${feita.aluno.nome}: ` : ''}{feita.texto.charAt(0).toUpperCase() + feita.texto.slice(1)}
              </Nota>
              <div className="flex flex-wrap justify-end gap-2">
                <Botao tom="secundario" onClick={() => { setFeita(null); setRodada((n) => n + 1) }}>
                  Marcar outra experimental
                </Botao>
                <Botao onClick={() => { fechar(); router.push(`/sessao/${feita.sessaoId}`) }}>Abrir a aula</Botao>
              </div>
            </div>
          ) : (
            <FormAulaAvulsa
              key={rodada}
              pessoaId={null}
              servicos={servicos}
              servicoInicial={null}
              tipoInicial={rodada > 0 ? 'experimental' : 'avulso'}
              alunoInicial={rodada > 0 ? ultimoAluno : null}
              aoConcluir={(texto, sessaoId, marcada) => {
                if (marcada.tipo === 'fixo') {
                  fechar()
                  router.push(sessaoId ? `/sessao/${sessaoId}` : `/pessoas/${marcada.aluno?.id ?? ''}`)
                  return
                }
                if (marcada.tipo === 'experimental') {
                  setUltimoAluno(marcada.aluno)
                  if (sessaoId) setFeita({ texto, sessaoId, aluno: marcada.aluno })
                  return
                }
                fechar()
                router.push(`/sessao/${sessaoId}`)
              }}
            />
          )}
        </Modal>
      ) : null}
    </>
  )
}
