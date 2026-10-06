'use client'

import { nomesDosDias } from '@/core/planos/plano'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { Ocupacao } from '@/core/agenda/ocupacao'
import { filtrarPorNome } from '@/core/pessoas/busca'
import {
  ajustarCapacidade, buscarCandidatos, encaixar, faltasParaRepor, listarCandidatos,
} from '@/server/agenda/acoes'
import type { FaltaEmAberto } from '@/server/agenda/consultas'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { Avatar, Chip, Nota, Rotulo, entrada } from '@/components/ui/pecas'
import { useChamada } from './chamada'
import { CampoNumero } from '@/components/ui/campo-numero'
import { Icone } from '@/components/ui/icones'

type Candidato = { id: string; nome: string; detalhe: string }

type Props = {
  sessaoId: string
  ocupacao: Ocupacao
  rotuloPessoa: string
  /** "Pilates Solo · 12 ago 09:00", para o subtítulo do modal */
  ondeQuando: string
}

/**
 * Encaixar alguém neste horário.
 *
 * É modal, e não painel fixo na lateral, porque a tela de chamada tem uma
 * pergunta só ("quem veio?"), e um formulário de busca parado ao lado dela
 * disputa a atenção com a única coisa que importa enquanto a turma entra.
 */
export function ModalEncaixe({
  sessaoId, ocupacao, rotuloPessoa, ondeQuando,
}: Props) {
  const { encaixeAberto, fecharEncaixe } = useChamada()
  const [pendente, iniciar] = useTransition()
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<'avulso' | 'reposicao'>('avulso')
  /** a falta mais antiga ainda sem reposição de quem foi escolhido */
  const [falta, setFalta] = useState<FaltaEmAberto | null>(null)
  const [trocando, setTrocando] = useState(false)
  // quem trocou a origem à mão manda: a sugestão que chega depois não passa por cima
  const manual = useRef(false)
  const [aviso, setAviso] = useState<string | null>(null)
  /** quem foi tocado na lista: o toque escolhe, o botão do rodapé grava */
  const [escolhido, setEscolhido] = useState<Candidato | null>(null)
  /** quem está esperando a confirmação de passar da capacidade */
  const [excedente, setExcedente] = useState<string | null>(null)
  // plano de horário livre que já usou a semana: a recepção decide se abre exceção
  const [noLimite, setNoLimite] = useState<{ pessoaId: string; texto: string } | null>(null)

  const [achados, setAchados] = useState<Candidato[]>([])
  /** a conta inteira, baixada uma vez ao abrir; `null` enquanto não chegou ou
   *  quando a conta é grande demais para caber no navegador */
  const [emMemoria, setEmMemoria] = useState<Candidato[] | null>(null)

  /*
   * A lista desce uma vez, quando o modal abre, e a busca acontece aqui.
   *
   * Buscar no servidor a cada tecla custava três idas em série (validar a
   * sessão, descobrir a conta, e só então procurar), e quem está no balcão com
   * a turma entrando sente isso como um campo que não responde.
   *
   * Isto não é o que havia no começo, que era descer a conta inteira no HTML de
   * **toda** abertura de chamada, inclusive quando ninguém ia encaixar ninguém.
   * Aqui nada desce enquanto o modal não abre.
   *
   * Conta grande demais para caber no navegador continua buscando no servidor,
   * com os 200ms de espera de sempre: quem digita "cec" não quer três buscas, e
   * `cancelado` protege contra a resposta velha chegar depois da nova e
   * repintar o resultado errado.
   */
  useEffect(() => {
    if (!encaixeAberto) return
    let cancelado = false
    listarCandidatos().then((r) => {
      if (!cancelado) setEmMemoria(r.completa ? r.lista : null)
    }).catch(() => {
      // sem a lista em memória a busca no servidor continua valendo: o campo
      // fica mais lento, não quebrado
      if (!cancelado) setEmMemoria(null)
    })
    return () => { cancelado = true }
  }, [encaixeAberto])

  useEffect(() => {
    if (emMemoria || busca.trim().length < 2) return
    let cancelado = false
    const t = setTimeout(async () => {
      const r = await buscarCandidatos(busca)
      if (!cancelado) setAchados(r)
    }, 200)
    return () => { cancelado = true; clearTimeout(t) }
  }, [busca, emMemoria])

  // o que aparece é derivado do texto: com menos de duas letras não há lista,
  // sem um setState dentro do efeito só para esvaziá-la
  const termo = busca.trim()
  const lista = termo.length < 2
    ? []
    : emMemoria
      ? filtrarPorNome(emMemoria, termo)
      : achados

  /**
   * Encaixar acima da capacidade **pede confirmação explícita**.
   *
   * A tela mostra 4/4; sem o segundo passo, o excedente viraria acidente de
   * clique em vez de decisão de quem está no balcão.
   */
  function adicionar(pessoaId: string, confirmarAcima = false, passarDoLimite = false) {
    setAviso(null)
    setNoLimite(null)
    iniciar(async () => {
      const r = await encaixar({
        sessaoId, pessoaId, origem, confirmarAcima, passarDoLimite,
        reposicaoDeId: origem === 'reposicao' ? falta?.participacaoId : undefined,
      })
      if (r.ok) {
        setBusca('')
        setExcedente(null)
        setEscolhido(null)
        fecharEncaixe()
        return
      }
      if (r.motivo === 'acima_da_capacidade') {
        setExcedente(pessoaId)
        return
      }
      if (r.motivo === 'dia_nao_permitido') {
        setNoLimite({
          pessoaId,
          texto: `O plano ${r.plano} vale só ${nomesDosDias(r.dias)}.`,
        })
        return
      }
      if (r.motivo === 'limite_da_semana') {
        setNoLimite({
          pessoaId,
          texto: `O plano ${r.plano} dá direito a ${r.limite} ${r.limite === 1 ? 'aula' : 'aulas'} por semana, e esta semana já ${r.limite === 1 ? 'foi usada' : 'foram usadas'}.`,
        })
        return
      }
      setExcedente(null)
      setAviso(
        r.motivo === 'lotada'
          ? 'Este horário está cheio. Para caber mais um, aumente a capacidade abaixo.'
          : `Quem você escolheu já está neste horário.`,
      )
    })
  }

  /*
   * A origem é deduzida, não perguntada: quem tem falta para repor entra como
   * Reposição (da falta mais antiga), o resto é Avulso, e "Trocar" fica para a
   * exceção. "Encaixe" e "Reserva" saíram da escolha: passar da capacidade já
   * pede confirmação própria, e Reserva ocupava lugar igual a Avulso, sem ser a
   * fila de espera de verdade (`espera`), o que só confundia.
   */
  const ORIGENS = [
    ['avulso', 'Avulso'],
    ['reposicao', 'Reposição'],
  ] as const
  const nomeDaOrigem = ORIGENS.find(([v]) => v === origem)?.[1] ?? 'Avulso'

  function escolher(c: Candidato) {
    setEscolhido(c); setExcedente(null); setAviso(null); setTrocando(false)
    setFalta(null)
    manual.current = false
    setOrigem('avulso')
    iniciar(async () => {
      const faltas = await faltasParaRepor(c.id)
      // a lista vem da mais nova para a mais antiga; repõe primeiro a que vence antes
      const antiga = faltas.at(-1) ?? null
      setFalta(antiga)
      if (antiga && !manual.current) setOrigem('reposicao')
    })
  }

  function fechar() {
    setAviso(null); setExcedente(null); setEscolhido(null); setBusca('')
    setFalta(null); setTrocando(false)
    fecharEncaixe()
  }

  const porQue = origem === 'reposicao'
    ? falta
      ? `repõe a falta de ${falta.data.slice(8, 10)}/${falta.data.slice(5, 7)}`
      : 'sem falta em aberto para apontar'
    : 'só desta vez'

  return (
    <Modal
      aberto={encaixeAberto}
      glifo="+"
      largura="lista"
      titulo={`Encaixar ${rotuloPessoa.toLowerCase()}`}
      sub={`${ondeQuando} · ${ocupacao.ocupadas}/${ocupacao.capacidade}${
        ocupacao.lotada
          ? ', cheio'
          : `, ${ocupacao.livres} ${ocupacao.livres === 1 ? 'vaga livre' : 'vagas livres'}`}`}
      secundario="Fechar"
      /*
       * Gravar é o botão, não o toque no nome. Antes o toque já encaixava, e a
       * origem escolhida depois não valia: tudo entrava como Avulso. O botão
       * diz a origem com que vai gravar, então ninguém grava sem ver.
       */
      primario={escolhido && !excedente ? `Encaixar como ${nomeDaOrigem}` : undefined}
      aoConfirmar={escolhido && !excedente ? () => adicionar(escolhido.id) : undefined}
      pendente={pendente}
      aoFechar={fechar}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="busca-pessoa">
          <Rotulo>Quem</Rotulo>
        </label>
        <input
          id="busca-pessoa"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setEscolhido(null); setExcedente(null) }}
          placeholder="Buscar por nome"
          className={entrada}
        />

        {/*
          * A lista rola por dentro, com altura de três nomes e meio.
          *
          * Antes ela crescia com o resultado: digitar duas letras trazia oito
          * pessoas, o modal esticava até o pé da janela e o botão saía da
          * vista. Meio nome cortado na borda é o que diz que há mais para rolar.
          */}
        {lista.length > 0 ? (
          <ul className="flex max-h-[216px] flex-col gap-1.5 overflow-y-auto">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={pendente}
                  aria-pressed={escolhido?.id === c.id}
                  onClick={() => escolher(c)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-media border px-3 py-2.5 text-left transition-colors duration-150 ${
                    escolhido?.id === c.id
                      ? 'border-marca bg-positivo-superficie'
                      : 'border-linha-suave hover:border-marca hover:bg-superficie-tenue'
                  }`}
                >
                  <Avatar nome={c.nome} tamanho={32} decorativo />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[14.5px] font-medium">{c.nome}</span>
                    <span className="text-[12px] text-tinta-media">{c.detalhe}</span>
                  </span>
                  {escolhido?.id === c.id ? (
                    <span className="ml-auto text-marca"><Icone nome="check" tamanho={18} /></span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {escolhido ? (
        <div className="flex flex-col gap-2 rounded-media border border-linha-suave bg-superficie-suave p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14.5px]">
              Entra como <strong className="font-semibold">{nomeDaOrigem}</strong>
              <span className="text-tinta-media">, {porQue}</span>
            </p>
            <button
              type="button"
              onClick={() => setTrocando(!trocando)}
              className="shrink-0 cursor-pointer text-[13.5px] font-medium text-marca hover:underline"
            >
              {trocando ? 'Pronto' : 'Trocar'}
            </button>
          </div>
          {trocando ? (
            <div role="group" aria-label="Origem" className="flex flex-wrap gap-1.5">
              {ORIGENS.map(([valor, rotulo]) => (
                <Chip
                  key={valor}
                  ativo={origem === valor}
                  onClick={() => { manual.current = true; setOrigem(valor) }}
                >
                  {rotulo}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Passa da capacidade: a tela conta o que vai acontecer e pede o segundo
          toque. 5/4 é decisão de quem está no balcão, com nome e registro ,
          nunca o sistema deixando passar. */}
      {excedente ? (
        <div className="flex flex-col gap-2 rounded-media border border-alerta-linha bg-alerta-superficie p-3">
          <p className="text-[13.5px] leading-relaxed text-alerta-texto">
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

      {noLimite ? (
        <div className="flex flex-col gap-2 rounded-media border border-atencao-linha bg-atencao-superficie p-3">
          <p className="text-[13.5px] leading-relaxed text-atencao">
            {noLimite.texto} Marcar mesmo assim fica registrado como decisão sua.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao miudo disabled={pendente} onClick={() => adicionar(noLimite.pessoaId, false, true)}>
              Marcar mesmo assim
            </Botao>
            <Botao tom="fantasma" miudo onClick={() => setNoLimite(null)}>
              Não marcar
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
        * Ela só é procurada quando falta vaga: e é exatamente esse o momento em
        * que este modal está aberto. Fora dele, é um campo numérico pedindo para
        * ser mexido sem motivo.
        */}
      {/*
        * "Aplicar", e não "Salvar", e dentro de uma caixa com nome.
        *
        * Solto ao lado do campo, encostado no rodapé, ele parecia o botão que
        * salva o modal inteiro: e o "Fechar" logo abaixo virava o par dele.
        * São coisas diferentes: encaixar é o botão do rodapé; isto
        * aqui só muda o número de vagas deste dia.
        */}
      {/* só aparece quando falta vaga: com lugar sobrando, é um campo pedindo
          para ser mexido sem motivo */}
      {ocupacao.lotada || aviso || excedente ? (
        <form
          action={(f) => {
            const n = Number(f.get('capacidade'))
            iniciar(async () => {
              await ajustarCapacidade(sessaoId, n)
              setAviso(null)
            })
          }}
          className="flex flex-col gap-2 rounded-media border border-linha-suave bg-superficie-suave p-3"
        >
          <label htmlFor="capacidade">
            <Rotulo>Capacidade só deste dia</Rotulo>
          </label>
          <div className="flex items-center gap-2">
            <span className="w-24">
              <CampoNumero id="capacidade" nome="capacidade" min={1} max={999} valorInicial={ocupacao.capacidade} />
            </span>
            <Botao type="submit" tom="secundario" miudo disabled={pendente}>
              Aplicar
            </Botao>
          </div>
          <p className="text-[12px] leading-relaxed text-tinta-media">
            Muda só este horário. A grade fixa das outras semanas continua igual.
          </p>
        </form>
      ) : null}
    </Modal>
  )
}
