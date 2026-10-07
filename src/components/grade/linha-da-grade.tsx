'use client'

import { useState, useTransition } from 'react'
import { Menu } from '@/components/ui/menu'
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
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Chip, Nota, entrada } from '@/components/ui/pecas'
import { Escolha } from '@/components/ui/escolha'
import { CampoData } from '@/components/ui/campo-data'
import { erroLegivel } from '@/core/erro-legivel'
import { CampoNumero } from '@/components/ui/campo-numero'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/* por extenso e com maiúscula na escolha: "seg" é abreviação de grade cheia,
   não de campo de formulário, onde há espaço para a palavra inteira */
const DIAS_INTEIROS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
]

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
 * etiquetas, e a ocupação com barra, que é o que se procura varrendo a grade.
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
        setErro(erroLegivel(e))
      }
    })
  }

  const editavel = podeEscrever && !serie.encerrada
  const lotada = serie.ocupadas >= serie.capacidade
  const proporcao = Math.min(1, serie.ocupadas / Math.max(1, serie.capacidade))

  return (
    <li>
      {/* a linha inteira abre a edição, que é o que mais se faz aqui; as
          outras ações moram no menu, e eram quatro botões em cada horário */}
      <div
        onClick={editavel ? () => setModo('editar') : undefined}
        className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-grande border p-3.5 transition-colors duration-150 ${editavel ? 'cursor-pointer' : ''} ${
          serie.encerrada
            ? 'border-linha-fina bg-superficie-tenue'
            : 'border-linha-suave bg-superficie hover:border-linha hover:bg-superficie-tenue'
        }`}
      >
        <span
          className={`flex h-14 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-media leading-none ${
            serie.encerrada
              ? 'bg-superficie-mais-suave text-tinta-fraca'
              : 'bg-escuro text-tinta-clara'
          }`}
        >
          {/* a hora num andar só: "08" em cima de "00" se lia como dois números */}
          <span className="text-[16px] font-semibold">{serie.horaInicio.slice(0, 5)}</span>
          {/* conta que não numera horário não pode ganhar uma linha vazia */}
          {serie.codigo ? (
            <span className="text-[12px] opacity-60">
              {serie.codigo}
            </span>
          ) : null}
        </span>

        <span className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <span
            className={`truncate text-[14.5px] font-medium ${
              serie.encerrada ? 'text-tinta-media' : ''
            }`}
          >
            {serie.servico}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-tinta-media">
            {serie.profissional ? (
              <span className="flex items-center gap-1.5">
                <Avatar nome={serie.profissional} tamanho={24} decorativo />
                {serie.profissional}
              </span>
            ) : null}
            {serie.local ? (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span>{serie.local}</span>
              </>
            ) : null}
            <span aria-hidden className="opacity-40">·</span>
            <span>{serie.duracaoMin} min</span>
            {/* "desde jul/26" em toda linha ativa não mudava decisão; a
                vigência só importa no horário que já foi encerrado */}
            {serie.encerrada ? (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span className="text-tinta-fraca">
                  {`${mesCurto(serie.vigenciaInicio)} a ${mesCurto(serie.vigenciaFim!)}`}
                </span>
              </>
            ) : null}
          </span>
        </span>

        {/* ocupação em número e em barra: o número é a verdade, a barra é o que
            se lê varrendo trinta horários de uma vez */}
        <span className="flex w-[86px] shrink-0 flex-col gap-1.5">
          <span
            className={`text-right text-[13.5px] ${
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
          // o clique nas ações não pode cair na linha e abrir a edição junto
          <span className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Menu
              titulo={`Ações das ${serie.horaInicio.slice(0, 5)}`}
              itens={[
                // "Quem ocupa" era um botão em cada uma das quarenta linhas
                ...(!serie.encerrada
                  ? [
                      {
                        rotulo: 'Quem ocupa', icone: 'pessoas' as const,
                        aoEscolher: () => comErro(async () => {
                          setModo('ocupa')
                          setOcupantes(await quemOcupa(serie.id))
                        }),
                      },
                      { rotulo: 'Editar', icone: 'lapis' as const, aoEscolher: () => setModo('editar') },
                    ]
                  : []),
                { rotulo: 'Duplicar', icone: 'copiar' as const, aoEscolher: () => setModo('duplicar') },
                ...(!serie.encerrada
                  ? [{ rotulo: 'Encerrar', icone: 'proibido' as const, perigo: true, aoEscolher: () => setModo('encerrar') }]
                  : []),
              ]}
            />
          </span>
        ) : null}
      </div>

      {modo === 'ocupa' ? (
        <Modal
          aberto
          largura="lista"
          glifo="◍"
          titulo={`Ocupação das ${serie.horaInicio}`}
          sub={`${DIAS[serie.diaSemana]} · ${serie.servico}`}
          secundario="Fechar"
          aoFechar={fechar}
        >
          {ocupantes === null ? (
            <p className="text-[13.5px] text-tinta-media">Carregando…</p>
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
                    className="flex items-center gap-2.5 rounded-padrao border border-linha-suave bg-superficie-suave px-2.5 py-2 text-[14.5px] hover:border-marca hover:bg-superficie"
                  >
                    <Avatar nome={o.nome} tamanho={32} decorativo />
                    <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                    <span className="text-[12px] text-tinta-fraca">
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
          primario={preview && mudanca ? 'Confirmar e salvar' : 'Salvar'}
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
              codigo: String(f.get('codigo') ?? '') || null,
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
            <Campo rotulo="Dia da semana" htmlFor={`d-${serie.id}`} obrigatorio>
              <Escolha
                id={`d-${serie.id}`} nome="diaSemana"
                valorInicial={String(serie.diaSemana)}
                opcoes={DIAS_INTEIROS.map((d, i) => ({ valor: String(i), rotulo: d }))}
              />
            </Campo>
            <Campo rotulo="Começa às" htmlFor={`h-${serie.id}`} obrigatorio>
              <input
                id={`h-${serie.id}`} name="horaInicio" type="time" required
                defaultValue={serie.horaInicio} className={`${entrada} w-full`}
              />
            </Campo>
            <Campo
              rotulo="Número" htmlFor={`t-${serie.id}`}
              dica="Opcional, e único na conta"
            >
              <input
                id={`t-${serie.id}`} name="codigo" maxLength={12}
                defaultValue={serie.codigo ?? ''} placeholder="Exemplo: 001"
                className={`${entrada} w-full`}
              />
            </Campo>
            <Campo rotulo="Duração (min)" htmlFor={`m-${serie.id}`}>
              <CampoNumero id={`m-${serie.id}`} nome="duracaoMin" min={1} max={600} sufixo="min" valorInicial={serie.duracaoMin} required />
            </Campo>
            <Campo rotulo="Capacidade" htmlFor={`c-${serie.id}`}>
              <CampoNumero id={`c-${serie.id}`} nome="capacidade" min={1} max={999} valorInicial={serie.capacidade} required />
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
                  ...catalogo.profissionais.map((p) => ({ valor: p.id, rotulo: p.nome, avatar: { nome: p.nome, cor: p.cor } })),
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
              Confira antes de confirmar; dá para mudar os campos acima ou
              cancelar. A mudança vale daqui para frente; o que já passou fica como está.{' '}
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
          glifo="+"
          titulo={`Duplicar ${rotulos.serie.singular.toLowerCase()}`}
          sub={`${serie.horaInicio} · ${serie.servico} · repete em outros dias`}
          primario={colisoes.length > 0 ? 'Duplicar mesmo assim' : 'Duplicar'}
          pendente={pendente || diasDuplicar.length === 0}
          aoFechar={fechar}
          aoConfirmar={() => comErro(async () => {
            const r = await duplicarSerie(serie.id, diasDuplicar, {
              confirmarColisao: colisoes.length > 0,
            })
            if (r.ok) { fechar(); router.refresh() }
            else if (r.colisoes) setColisoes(r.colisoes)
            // duplicar não carrega número de horário, então a recusa por frase
            // não acontece aqui; se um dia acontecer, ela é dita e não sumida
            else throw new Error(r.erro)
          })}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 text-[12px] font-semibold text-tinta-fraca">
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
              Dois horários na mesma sala podem ser intencionais: confira antes de salvar.
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
          <Campo rotulo="Último dia" htmlFor={`f-${serie.id}`} dica="A aula deste dia ainda acontece">
            <CampoData id={`f-${serie.id}`} nome="fim" valorInicial={hoje} limpavel={false} />
          </Campo>

          <Nota>O histórico continua: encerrar não apaga o que já aconteceu.</Nota>

          {vagasNoCaminho !== null ? (
            <Nota tom="atencao">
              {vagasNoCaminho}{' '}
              {(vagasNoCaminho === 1
                ? rotulos.pessoa.singular
                : rotulos.pessoa.plural).toLowerCase()}{' '}
              {vagasNoCaminho === 1 ? 'ocupa' : 'ocupam'} este horário. O horário
              fixo termina no mesmo dia, e quem marcou uma aula depois dele fica
              com reposição em aberto.
            </Nota>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </li>
  )
}
