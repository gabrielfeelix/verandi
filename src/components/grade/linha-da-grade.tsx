'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  previewEdicao, editarSerie, duplicarSerie, encerrarSerie, quemOcupa,
  type MudancaSerie, type Preview,
} from '@/server/grade/acoes'
import type { Colisao } from '@/core/agenda/serie'
import type { Rotulos } from '@/core/vocabulario/padrao'
import type { CatalogoGrade, SerieLinha } from '@/server/grade/consultas'
import { mesCurto } from '@/core/agenda/mes-curto'
import { Icone } from '@/components/ui/icones'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Chip, Nota, entrada } from '@/components/ui/pecas'
import { Escolha } from '@/components/ui/escolha'
import { CampoData } from '@/components/ui/campo-data'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Modo = null | 'editar' | 'duplicar' | 'encerrar' | 'ocupa'
type Ocupante = { pessoaId: string; nome: string; desde: string }

/**
 * Um horário da grade fixa, como cartão.
 *
 * Era uma linha de tabela que abria sanfona: clicar em "editar" empurrava tudo
 * o que estava embaixo para baixo, o formulário nascia com a largura que
 * sobrava, e com trinta horários na tela ninguém achava de volta a linha que
 * tinha aberto. Agora as quatro ações abrem modal, como o resto do sistema, e
 * a linha vira cartão: hora em destaque à esquerda, quem atende e onde como
 * etiquetas, e a ocupação com barra — que é o que se procura varrendo a grade.
 */
export function LinhaDaGrade({
  serie, catalogo, rotulos, podeEscrever,
}: {
  serie: SerieLinha
  catalogo: CatalogoGrade
  /*
   * O vocabulário inteiro. Antes vinham duas palavras soltas, e o formulário
   * de edição continuava rotulando "Serviço", "Profissional" e "Local" à mão.
   */
  rotulos: Rotulos
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

  const lotada = serie.ocupadas >= serie.capacidade
  const proporcao = Math.min(1, serie.ocupadas / Math.max(1, serie.capacidade))

  return (
    <li>
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-grande border p-3.5 transition-colors duration-150 ${
          serie.encerrada
            ? 'border-linha-fina bg-superficie-tenue'
            : 'border-linha-suave bg-superficie hover:border-linha hover:bg-superficie-tenue'
        }`}
      >
        <span
          className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-media font-mono leading-none ${
            serie.encerrada
              ? 'bg-superficie-mais-suave text-tinta-inativa'
              : 'bg-escuro text-tinta-clara'
          }`}
        >
          <span className="text-[15px] font-semibold">{serie.horaInicio.slice(0, 2)}</span>
          <span className="text-[12px] opacity-70">{serie.horaInicio.slice(3)}</span>
        </span>

        <span className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <span
            className={`truncate text-[14.5px] font-medium ${
              serie.encerrada ? 'text-tinta-media' : ''
            }`}
          >
            {serie.servico}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-tinta-media">
            {serie.profissional ? (
              <span className="flex items-center gap-1.5 rounded-peca bg-superficie-suave py-1 pr-2.5 pl-1">
                <Avatar nome={serie.profissional} tamanho={24} decorativo />
                {serie.profissional}
              </span>
            ) : null}
            {serie.local ? (
              <span className="rounded-peca bg-superficie-suave px-2.5 py-1">
                {serie.local}
              </span>
            ) : null}
            <span className="rounded-peca bg-superficie-suave px-2.5 py-1 font-mono text-[11.5px]">
              {serie.duracaoMin} min
            </span>
            <span className="text-[11.5px] text-tinta-fraca">
              {serie.encerrada
                ? `${mesCurto(serie.vigenciaInicio)} – ${mesCurto(serie.vigenciaFim!)}`
                : `desde ${mesCurto(serie.vigenciaInicio)}`}
            </span>
          </span>
        </span>

        {/* ocupação em número e em barra: o número é a verdade, a barra é o que
            se lê varrendo trinta horários de uma vez */}
        <span className="flex w-[86px] shrink-0 flex-col gap-1.5">
          <span
            className={`text-right font-mono text-[12.5px] ${
              serie.ocupadas > serie.capacidade ? 'text-alerta' : 'text-tinta-media'
            }`}
            title={`${serie.ocupadas} de ${serie.capacidade} ${rotulos.vaga.plural.toLowerCase()}`}
          >
            {serie.ocupadas}/{serie.capacidade}
          </span>
          <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-superficie-mais-suave">
            <span
              className={`block h-full rounded-full ${
                serie.ocupadas > serie.capacidade
                  ? 'bg-alerta'
                  : lotada ? 'bg-atencao' : 'bg-marca'
              }`}
              style={{ width: `${Math.max(4, proporcao * 100)}%` }}
            />
          </span>
        </span>

        {podeEscrever ? (
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {!serie.encerrada ? (
              <BotaoAcao
                icone="pessoas" rotulo="Quem ocupa" pendente={pendente}
                onClick={() => comErro(async () => {
                  setModo('ocupa')
                  setOcupantes(await quemOcupa(serie.id))
                })}
              />
            ) : null}
            {!serie.encerrada ? (
              <BotaoAcao icone="lapis" rotulo="Editar" onClick={() => setModo('editar')} />
            ) : null}
            <BotaoAcao icone="lista" rotulo="Duplicar" onClick={() => setModo('duplicar')} />
            {!serie.encerrada ? (
              <BotaoAcao
                icone="proibido" rotulo="Encerrar" perigo
                onClick={() => setModo('encerrar')}
              />
            ) : null}
          </span>
        ) : null}
      </div>

      {modo === 'ocupa' ? (
        <Modal
          aberto
          largura="lista"
          glifo="◍"
          titulo={`Quem ocupa ${serie.horaInicio}`}
          sub={`${DIAS[serie.diaSemana]} · ${serie.servico}`}
          secundario="Fechar"
          aoFechar={fechar}
        >
          {ocupantes === null ? (
            <p className="text-[12.5px] text-tinta-media">carregando…</p>
          ) : ocupantes.length === 0 ? (
            <Nota>
              Ninguém ocupa este horário. Encerrar não avisa ninguém.
            </Nota>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ocupantes.map((o) => (
                <li key={o.pessoaId}>
                  <Link
                    href={`/pessoas/${o.pessoaId}`}
                    className="flex items-center gap-2.5 rounded-padrao border border-linha-suave bg-superficie-suave px-2.5 py-2 text-[13.5px] hover:border-marca hover:bg-superficie"
                  >
                    <Avatar nome={o.nome} tamanho={32} decorativo />
                    <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                    <span className="font-mono text-[11.5px] text-tinta-fraca">
                      desde {mesCurto(o.desde)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}

      {modo === 'editar' ? (
        <ModalFormulario
          aberto
          largura="lista"
          glifo="✎"
          titulo={`Editar ${rotulos.serie.singular.toLowerCase()}`}
          sub={`${DIAS[serie.diaSemana]} ${serie.horaInicio} · ${serie.servico}`}
          primario={preview && mudanca ? 'Confirmar' : 'Ver o que muda'}
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => {
            if (preview && mudanca) {
              return comErro(async () => {
                await editarSerie(serie.id, mudanca)
                fechar()
                router.refresh()
              })
            }
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Dia" htmlFor={`d-${serie.id}`}>
              <Escolha
                id={`d-${serie.id}`} nome="diaSemana"
                valorInicial={String(serie.diaSemana)}
                opcoes={DIAS.map((d, i) => ({ valor: String(i), rotulo: d }))}
              />
            </Campo>
            <Campo rotulo="Começa às" htmlFor={`h-${serie.id}`}>
              <input
                id={`h-${serie.id}`} name="horaInicio" type="time" required
                defaultValue={serie.horaInicio} className={`${entrada} w-full`}
              />
            </Campo>
            <Campo rotulo="Duração (min)" htmlFor={`m-${serie.id}`}>
              <input
                id={`m-${serie.id}`} name="duracaoMin" type="number" min={1}
                defaultValue={serie.duracaoMin} className={`${entrada} w-full`}
              />
            </Campo>
            <Campo rotulo="Capacidade" htmlFor={`c-${serie.id}`}>
              <input
                id={`c-${serie.id}`} name="capacidade" type="number" min={1}
                defaultValue={serie.capacidade} className={`${entrada} w-full`}
              />
            </Campo>
          </div>

          <Campo rotulo={rotulos.servico.singular} htmlFor={`s-${serie.id}`}>
            <Escolha
              id={`s-${serie.id}`} nome="servicoId" valorInicial={serie.servicoId}
              opcoes={catalogo.servicos.map((s) => ({ valor: s.id, rotulo: s.nome }))}
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo={rotulos.profissional.singular} htmlFor={`p-${serie.id}`}>
              <Escolha
                id={`p-${serie.id}`} nome="profissionalId"
                valorInicial={serie.profissionalId ?? ''}
                opcoes={[
                  { valor: '', rotulo: `Sem ${rotulos.profissional.singular.toLowerCase()}` },
                  ...catalogo.profissionais.map((p) => ({ valor: p.id, rotulo: p.nome })),
                ]}
              />
            </Campo>
            <Campo rotulo={rotulos.local.singular} htmlFor={`l-${serie.id}`}>
              <Escolha
                id={`l-${serie.id}`} nome="localId" valorInicial={serie.localId ?? ''}
                opcoes={[
                  { valor: '', rotulo: `Sem ${rotulos.local.singular.toLowerCase()}` },
                  ...catalogo.locais.map((l) => ({ valor: l.id, rotulo: l.nome })),
                ]}
              />
            </Campo>
          </div>

          {/* A confusão mais provável do sistema inteiro é achar que editar a
              grade reescreve o passado. A tela diz o contrário em número. */}
          {preview ? (
            <Nota tom={preview.capacidadeMenorQueOcupacao ? 'atencao' : 'neutro'}>
              A mudança vale daqui para frente; o que já passou fica como está.{' '}
              {preview.sessoesAfetadas} mudam
              {preview.sessoesPreservadas > 0
                ? `, ${preview.sessoesPreservadas} ficam como estão porque já têm decisão registrada`
                : ''}
              {preview.sessoesCanceladas > 0
                ? `, ${preview.sessoesCanceladas} saem da grade e ficam cancelados com o motivo`
                : ''}
              .
              {preview.capacidadeMenorQueOcupacao ? (
                <>
                  {' '}Atenção: {preview.vagasAtivas}{' '}
                  {(preview.vagasAtivas === 1
                    ? rotulos.pessoa.singular
                    : rotulos.pessoa.plural).toLowerCase()}{' '}
                  {preview.vagasAtivas === 1 ? 'ocupa' : 'ocupam'} este horário, e
                  a capacidade nova é menor.
                </>
              ) : null}
            </Nota>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {modo === 'duplicar' ? (
        <Modal
          aberto
          glifo="⧉"
          titulo={`Duplicar ${rotulos.serie.singular.toLowerCase()}`}
          sub={`${serie.horaInicio} · ${serie.servico} · repete em outros dias`}
          primario={colisoes.length > 0 ? 'Duplicar mesmo assim' : 'Duplicar'}
          pendente={pendente || diasDuplicar.length === 0}
          aoFechar={fechar}
          aoConfirmar={() => comErro(async () => {
            const r = await duplicarSerie(serie.id, diasDuplicar, {
              confirmarColisao: colisoes.length > 0,
            })
            if (r.ok) { fechar(); router.refresh() } else setColisoes(r.colisoes)
          })}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
              Repetir este horário em
            </legend>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d, i) => (
                <Chip
                  key={d}
                  ativo={diasDuplicar.includes(i)}
                  onClick={() => setDiasDuplicar((atual) =>
                    atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i])}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </fieldset>

          {colisoes.length > 0 ? (
            <Nota tom="atencao">
              Esse horário já tem coisa marcada:{' '}
              {colisoes.map((c) => `${DIAS[c.diaSemana]} às ${c.horaInicio}, ${c.ocupadoPor}`).join('; ')}.
              Dois na mesma sala pode ser real — quem opera é que sabe.
            </Nota>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}

      {modo === 'encerrar' ? (
        <ModalFormulario
          aberto
          perigo
          titulo={`Encerrar ${rotulos.serie.singular.toLowerCase()}?`}
          sub={`${DIAS[serie.diaSemana]} ${serie.horaInicio} · ${serie.servico}`}
          primario={vagasNoCaminho !== null ? 'Encerrar mesmo assim' : 'Encerrar'}
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => {
            const fim = String(f.get('fim') ?? hoje)
            comErro(async () => {
              const r = await encerrarSerie(serie.id, fim, {
                confirmar: vagasNoCaminho !== null,
              })
              if (r.ok) { fechar(); router.refresh() } else setVagasNoCaminho(r.vagasAtivas)
            })
          }}
        >
          <Campo rotulo="Encerrar a partir de" htmlFor={`f-${serie.id}`}>
            <CampoData id={`f-${serie.id}`} nome="fim" valorInicial={hoje} limpavel={false} />
          </Campo>

          <Nota>O histórico continua: encerrar não apaga o que já aconteceu.</Nota>

          {vagasNoCaminho !== null ? (
            <Nota tom="atencao">
              {vagasNoCaminho}{' '}
              {(vagasNoCaminho === 1
                ? rotulos.pessoa.singular
                : rotulos.pessoa.plural).toLowerCase()}{' '}
              {vagasNoCaminho === 1 ? 'ocupa' : 'ocupam'} este horário. Encerrar
              tira o horário da grade daqui para frente.
            </Nota>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </li>
  )
}

/**
 * Ação com ícone **e** palavra.
 *
 * Só o glifo é adivinhação: um X pode ser desativar, apagar ou fechar, e quem
 * descobre parando o mouse em cima descobre tarde — no celular, nunca. Em tela
 * estreita a palavra some e sobra o alvo de 44px, com o nome no `aria-label`.
 */
function BotaoAcao({
  icone, rotulo, onClick, perigo = false, pendente = false,
}: {
  icone: 'pessoas' | 'lapis' | 'lista' | 'proibido'
  rotulo: string
  onClick: () => void
  perigo?: boolean
  pendente?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pendente}
      aria-label={rotulo}
      className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-peca border px-2.5 text-[12.5px] transition-colors duration-150 disabled:opacity-60 ${
        perigo
          ? 'border-alerta-linha-forte bg-alerta-superficie text-alerta hover:bg-alerta-fundo'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-suave hover:text-tinta'
      }`}
    >
      <Icone nome={icone} tamanho={15} />
      <span className="hidden sm:inline">{rotulo}</span>
    </button>
  )
}
