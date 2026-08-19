'use client'

import { useEffect, useState, useTransition } from 'react'
import type { Ocupacao } from '@/core/agenda/ocupacao'
import { ajustarCapacidade, buscarCandidatos, encaixar } from '@/server/agenda/acoes'
import { Botao } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { Avatar, Chip, Nota, Rotulo, entrada } from '@/components/ui/pecas'
import { useChamada } from './chamada'
import { CampoNumero } from '@/components/ui/campo-numero'

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
 * pergunta só — "quem veio?" — e um formulário de busca parado ao lado dela
 * disputa a atenção com a única coisa que importa enquanto a turma entra.
 */
export function ModalEncaixe({
  sessaoId, ocupacao, rotuloPessoa, ondeQuando,
}: Props) {
  const { encaixeAberto, fecharEncaixe } = useChamada()
  const [pendente, iniciar] = useTransition()
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<'avulso' | 'reposicao' | 'encaixe' | 'reserva'>('avulso')
  const [aviso, setAviso] = useState<string | null>(null)
  /** quem está esperando a confirmação de passar da capacidade */
  const [excedente, setExcedente] = useState<string | null>(null)

  const [achados, setAchados] = useState<Candidato[]>([])

  /*
   * A busca acontece no servidor, e não numa lista baixada de véspera.
   *
   * Descer a conta inteira para filtrar aqui era rápido de escrever e caro em
   * toda abertura de chamada: 800 cadastros viravam 800 linhas de nome e
   * telefone no HTML da página, para uma busca que só começa com duas letras.
   *
   * Os 200ms de espera existem porque quem digita "cec" não quer três buscas;
   * e `cancelado` protege contra a resposta velha chegar depois da nova e
   * repintar o resultado errado.
   */
  // o que aparece é derivado do texto: com menos de duas letras não há lista,
  // sem um setState dentro do efeito só para esvaziá-la
  const lista = busca.trim().length < 2 ? [] : achados

  useEffect(() => {
    if (busca.trim().length < 2) return
    let cancelado = false
    const t = setTimeout(async () => {
      const r = await buscarCandidatos(busca)
      if (!cancelado) setAchados(r)
    }, 200)
    return () => { cancelado = true; clearTimeout(t) }
  }, [busca])

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
          : `Quem você escolheu já está neste horário.`,
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
        ocupacao.lotada ? ', cheio' : `, ${ocupacao.livres} livre(s)`}`}
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

        {/*
          * A lista rola por dentro, com altura de três nomes e meio.
          *
          * Antes ela crescia com o resultado: digitar duas letras trazia oito
          * pessoas, o modal esticava até o pé da janela e "Origem" saía da
          * vista. Meio nome cortado na borda é o que diz que há mais para rolar.
          */}
        {lista.length > 0 ? (
          <ul className="flex max-h-[216px] flex-col gap-1.5 overflow-y-auto">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => adicionar(c.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-media border border-linha-suave px-3 py-2.5 text-left transition-colors duration-150 hover:border-marca hover:bg-superficie-tenue"
                >
                  <Avatar nome={c.nome} tamanho={32} decorativo />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-medium">{c.nome}</span>
                    <span className="text-[12.5px] text-tinta-media">{c.detalhe}</span>
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
      {/*
        * "Aplicar", e não "Salvar", e dentro de uma caixa com nome.
        *
        * Solto ao lado do campo, encostado no rodapé, ele parecia o botão que
        * salva o modal inteiro — e o "Fechar" logo abaixo virava o par dele.
        * São coisas diferentes: encaixar já acontece no toque do nome; isto
        * aqui só muda o número de vagas deste dia.
        */}
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
        <p className="text-[12.5px] leading-relaxed text-tinta-media">
          Muda só este horário. A grade fixa das outras semanas continua igual.
        </p>
      </form>
    </Modal>
  )
}
