'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, Chip, Etiqueta, Nota } from '@/components/ui/pecas'
import { Modal } from '@/components/ui/modal'
import { Escolha } from '@/components/ui/escolha'
import { LinhaQueAbre } from '@/components/ui/linha-que-abre'
import { CELULA, CELULA_FIXA, Cabecalho, LINHA, Tabela, Th } from '@/components/ui/tabela'
import { useAviso } from '@/components/ui/desfazer'
import { dispensarPendencia } from '@/server/pendencias/acoes'
import { marcarVolta, mudarVolta } from '@/server/licencas/acoes'
import { ModalVolta } from '@/components/licenca/modal-volta'
import type { GrupoPendencia, Pendencia } from '@/server/pendencias/consultas'
import { SEM_DISPENSAR } from '@/core/pendencias'
import { ACAO_GRUPO, PONTO_GRUPO, ROTULO_TIPO } from './tintas'
import { dataCurta } from '@/core/agenda/datas'
import { MarcarAula, type FaltaParaRepor } from '@/components/pessoas/marcar-aula'

const MOTIVOS = [
  'Já resolvido fora do sistema',
  'Não se aplica',
  'A pessoa desistiu',
  'Erro de cadastro',
]

/** Crédito de seis meses atrás é uma conversa diferente do da semana passada. */
function idade(dias: number | null) {
  if (dias === null) return null
  if (dias === 0) return { texto: 'hoje', tinta: 'neutro' as const }
  if (dias < 7) return { texto: `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tinta: 'neutro' as const }
  if (dias < 30) return { texto: `há ${dias} dias`, tinta: 'atencao' as const }
  return { texto: `há ${dias} dias`, tinta: 'alerta' as const }
}

/**
 * Uma linha da tabela: uma pendência, ou todas as reposições de um aluno.
 *
 * Reposição é por falta, e o aluno com dez faltas virava dez linhas iguais. A
 * pergunta da recepção é "quem eu chamo para repor", então o aluno aparece uma
 * vez, com o total e a mais antiga, e as datas abrem embaixo.
 */
type Linha =
  | { tipo: 'item'; chave: string; p: Pendencia }
  | { tipo: 'aluno'; chave: string; titulo: string; href: string; itens: Pendencia[] }

function agrupar(itens: Pendencia[], chave: (p: Pendencia) => string): Linha[] {
  const porAluno = new Map<string, Pendencia[]>()
  const linhas: Linha[] = []
  for (const p of itens) {
    if (!p.reposicao) { linhas.push({ tipo: 'item', chave: chave(p), p }); continue }
    const lista = porAluno.get(p.reposicao.pessoaId)
    if (lista) lista.push(p)
    else porAluno.set(p.reposicao.pessoaId, [p])
  }
  for (const [pessoaId, lista] of porAluno) {
    lista.sort((a, b) => a.reposicao!.data.localeCompare(b.reposicao!.data))
    linhas.push(lista.length === 1
      ? { tipo: 'item', chave: chave(lista[0]), p: lista[0] }
      : { tipo: 'aluno', chave: `aluno-${pessoaId}`, titulo: lista[0].titulo, href: lista[0].href, itens: lista })
  }
  const nome = (l: Linha) => (l.tipo === 'item' ? l.p.titulo : l.titulo)
  return linhas.sort((a, b) => nome(a).localeCompare(nome(b), 'pt-BR', { sensitivity: 'base' }))
}

const BOTAO = 'inline-flex min-h-9 items-center rounded-padrao border border-linha bg-superficie px-3 text-[13.5px] font-medium whitespace-nowrap text-tinta hover:border-tinta-media hover:bg-superficie-mais-suave disabled:opacity-50'
const FANTASMA = 'min-h-9 cursor-pointer rounded-padrao px-2.5 text-[13.5px] whitespace-nowrap text-tinta-media hover:bg-superficie-suave hover:text-tinta'

/**
 * Pendências numa tabela só, no desenho de Alunos.
 *
 * Antes eram nove cartões empilhados, cada um com três linhas e "Mostrar mais":
 * para ver tudo era rolar e abrir grupo por grupo. Aqui a lista inteira cabe
 * numa vista, em ordem alfabética, e os chips de cima filtram por
 * tipo na hora, com a contagem de cada um. Kanban foi descartado: nove colunas
 * viram rolagem lateral, e no celular não se lê.
 */
type Servico = { id: string; nome: string }

/** A falta no formato que o Marcar aula mostra: "03/04/25 · Pilates aparelho". */
const faltaDe = (p: Pendencia): FaltaParaRepor => ({
  id: p.referenciaId,
  quando: [dataCurta(p.reposicao!.data), p.reposicao!.servico].filter(Boolean).join(' · '),
})

export function ListaPendencias({
  grupos: recebidos, servicos = [], rotuloSessao = 'Aula',
}: {
  grupos: GrupoPendencia[]
  /** o Marcar aula da reposição abre aqui, sem ir para a ficha */
  servicos?: Servico[]
  rotuloSessao?: string
}) {
  const [filtro, setFiltro] = useState<string | null>(null)
  const [dispensando, setDispensando] = useState<Pendencia | null>(null)
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [prorrogando, setProrrogando] = useState<Pendencia | null>(null)
  // "Voltou" e "Dispensar" tiram a linha na hora; o servidor confirma por trás
  const [saiu, setSaiu] = useState<string[]>([])
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const chave = (p: Pendencia) => `${p.tipo}-${p.referenciaId}`
  const grupos = recebidos
    .map((g) => ({ ...g, itens: g.itens.filter((p) => !saiu.includes(chave(p))) }))
    .filter((g) => g.itens.length > 0)
  const total = grupos.reduce((n, g) => n + g.itens.length, 0)
  // o filtro de um grupo que acabou de esvaziar volta para "Todas"
  const ativo = grupos.some((g) => g.tipo === filtro) ? filtro : null
  // de A a Z pelo nome, como a recepção procura o aluno; os chips de cima
  // separam por tipo quando a pergunta é "o que é urgente"
  const linhas = agrupar(grupos.filter((g) => !ativo || g.tipo === ativo).flatMap((g) => g.itens), chave)
  const [abertos, setAbertos] = useState<string[]>([])
  const alternar = (k: string) => setAbertos((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))

  const acoes = (p: Pendencia) => (
    <>{p.licenca ? (
      <>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            const alvo = p
            setSaiu((v) => [...v, chave(alvo)])
            iniciar(async () => {
              await marcarVolta(alvo.licenca!.pessoaId)
              avisar({ texto: `${alvo.titulo}: licença encerrada` })
              router.refresh()
            })
          }}
          className={`${BOTAO} cursor-pointer`}
        >
          Voltou
        </button>
        <button type="button" onClick={() => setProrrogando(p)} className={FANTASMA}>
          {p.licenca.voltaPrevista ? 'Prorrogar' : 'Definir volta'}
        </button>
      </>
    ) : (
      <>
        {p.reposicao ? (
          <MarcarAula
            pessoaId={p.reposicao.pessoaId}
            nome={p.titulo}
            servicos={servicos}
            servicoInicial={p.reposicao.servicoId}
            faltas={[faltaDe(p)]}
            rotuloSessao={rotuloSessao}
            aoMarcar={() => { setSaiu((v) => [...v, chave(p)]); router.refresh() }}
            className={`${BOTAO} cursor-pointer`}
          >
            {ACAO_GRUPO[p.tipo] ?? 'Agendar reposição'}
          </MarcarAula>
        ) : (
          <Link href={p.href} className={BOTAO}>
            {ACAO_GRUPO[p.tipo] ?? 'Abrir'}
          </Link>
        )}
        {/* horário sem contrato e pacote não se escondem: resolvem-se */}
        {SEM_DISPENSAR.has(p.tipo) ? null : (
          <button type="button" onClick={() => setDispensando(p)} className={`${FANTASMA} max-md:hidden`}>
            Dispensar
          </button>
        )}
      </>
    )}</>
  )

  if (total === 0) {
    return <Nota tom="positivo">Nenhuma pendência no momento.</Nota>
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* no celular a faixa rola de lado, como em Alunos */}
      <div
        role="group"
        aria-label="Filtrar por tipo"
        className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] *:shrink-0 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        <Chip ativo={ativo === null} onClick={() => setFiltro(null)}>
          Todas <Contador ativo={ativo === null}>{total}</Contador>
        </Chip>
        {grupos.map((g) => (
          <Chip
            key={g.tipo}
            ativo={ativo === g.tipo}
            ponto={PONTO_GRUPO[g.tipo]}
            onClick={() => setFiltro(ativo === g.tipo ? null : g.tipo)}
          >
            {g.titulo}{' '}
            <Contador ativo={ativo === g.tipo}>
              {g.tipo === 'reposicao_aberta' && alunosDe(g.itens) < g.itens.length
                ? `${g.itens.length} de ${alunosDe(g.itens)} ${alunosDe(g.itens) === 1 ? 'aluno' : 'alunos'}`
                : g.itens.length}
            </Contador>
          </Chip>
        ))}
      </div>

      <Tabela largura={860} soNoDesktop rotulo="Pendências">
        <Cabecalho>
          <Th fixa>Pendência</Th>
          <Th className="max-md:hidden">Tipo</Th>
          <Th className="max-md:hidden">Em aberto</Th>
          <Th className="text-right max-md:hidden">Ação</Th>
        </Cabecalho>
        <tbody>
          {linhas.map((l) => {
            if (l.tipo === 'aluno') {
              return (
                <LinhaDoAluno
                  key={l.chave}
                  linha={l}
                  aberto={abertos.includes(l.chave)}
                  aoAlternar={() => alternar(l.chave)}
                  aoDispensar={setDispensando}
                  servicos={servicos}
                  rotuloSessao={rotuloSessao}
                  aoMarcar={() => router.refresh()}
                />
              )
            }
            const p = l.p
            const i = p.etiqueta ?? idade(p.diasEmAberto)
            return (
              <LinhaQueAbre key={chave(p)} href={p.href} className={LINHA}>
                <td className={`${CELULA_FIXA} max-md:px-3`}>
                  <span className="flex items-start gap-2.5 md:min-w-[280px] md:items-center">
                    {/* chamada não feita é sobre um horário, não sobre alguém:
                        avatar com as iniciais de "Pilates solo" seria enfeite */}
                    {p.tipo === 'chamada_nao_feita' ? (
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-padrao bg-superficie-mais-suave text-[14.5px] text-tinta-media"
                      >
                        ◷
                      </span>
                    ) : (
                      <Avatar nome={p.titulo} tamanho={32} decorativo />
                    )}
                    <span className="flex min-w-0 flex-col leading-[1.35]">
                      <Link href={p.href} className="text-[14.5px] font-medium hover:text-marca">
                        {p.titulo}
                      </Link>
                      <span className="text-[13.5px] text-tinta-media">{p.detalhe}</span>
                      {/* no celular as colunas Tipo e Em aberto somem: vêm aqui */}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 md:hidden">
                        <Tipo tipo={p.tipo} />
                        {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
                      </span>
                      {/* e a ação desce para baixo do texto, em vez de espremer o nome */}
                      <span className="flex flex-wrap items-center gap-1 pt-2 md:hidden">{acoes(p)}</span>
                    </span>
                  </span>
                </td>
                <td className={`${CELULA} max-md:hidden`}><Tipo tipo={p.tipo} /></td>
                <td className={`${CELULA} max-md:hidden`}>
                  {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
                </td>
                <td className={`${CELULA} max-md:hidden`}>
                  <span className="flex flex-wrap items-center justify-end gap-1">{acoes(p)}</span>
                </td>
              </LinhaQueAbre>
            )
          })}
        </tbody>
      </Tabela>

      {prorrogando?.licenca ? (
        <ModalVolta
          aberto
          nome={prorrogando.titulo}
          valorInicial={prorrogando.licenca.voltaPrevista ?? ''}
          pulavel={false}
          pendente={pendente}
          aoFechar={() => setProrrogando(null)}
          aoSalvar={(data) => {
            const alvo = prorrogando
            iniciar(async () => {
              await mudarVolta(alvo.licenca!.id, data)
              setProrrogando(null)
              avisar({ texto: data ? `${alvo.titulo}: nova data de volta` : `${alvo.titulo}: sem data de volta` })
              router.refresh()
            })
          }}
        />
      ) : null}

      <Modal
        aberto={dispensando !== null}
        glifo="×"
        titulo="Dispensar pendência"
        sub={dispensando ? dispensando.titulo : ''}
        primario="Dispensar"
        pendente={pendente}
        aoFechar={() => setDispensando(null)}
        aoConfirmar={() => {
          const alvo = dispensando
          if (!alvo) return
          setSaiu((v) => [...v, chave(alvo)])
          setDispensando(null)
          iniciar(async () => {
            await dispensarPendencia({ tipo: alvo.tipo, referenciaId: alvo.referenciaId, motivo })
            avisar({ texto: 'Pendência dispensada · motivo registrado' })
            router.refresh()
          })
        }}
      >
        <label htmlFor="disp-motivo" className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-medium">Motivo</span>
        </label>
        <Escolha
          id="disp-motivo"
          nome="motivo"
          valorInicial={motivo}
          aoTrocar={setMotivo}
          opcoes={MOTIVOS.map((m) => ({ valor: m, rotulo: m }))}
        />
        <Nota tom="neutro">
          O item sai da lista. O motivo e o responsável ficam registrados.
        </Nota>
      </Modal>
    </div>
  )
}

function Tipo({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-tinta-media">
      <span aria-hidden className="size-2 rounded-full" style={{ background: PONTO_GRUPO[tipo] }} />
      {ROTULO_TIPO[tipo] ?? tipo}
    </span>
  )
}

function Contador({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  return (
    <span className={`text-[12px] ${ativo ? 'opacity-70' : 'text-tinta-fraca'}`}>
      {children}
    </span>
  )
}

const alunosDe = (itens: Pendencia[]) => new Set(itens.map((p) => p.reposicao?.pessoaId ?? p.referenciaId)).size

/** O aluno com várias reposições: o total na linha, as datas ao abrir. */
function LinhaDoAluno({
  linha, aberto, aoAlternar, aoDispensar, servicos, rotuloSessao, aoMarcar,
}: {
  linha: Extract<Linha, { tipo: 'aluno' }>
  aberto: boolean
  aoAlternar: () => void
  aoDispensar: (p: Pendencia) => void
  servicos: Servico[]
  rotuloSessao: string
  aoMarcar: () => void
}) {
  const { itens } = linha
  const maisAntiga = itens[0]
  const i = idade(Math.max(...itens.map((p) => p.diasEmAberto ?? 0)))
  const modalidades = [...new Set(itens.map((p) => p.reposicao!.servico).filter(Boolean))].join(' e ')
  const detalhe = [
    modalidades,
    `mais antiga em ${dataCurta(maisAntiga.reposicao!.data)}`,
  ].filter(Boolean).join(' · ')
  const idDatas = `datas-${linha.chave}`

  const acoes = (
    <>
      {/* repõe a mais antiga, e o próprio modal deixa trocar */}
      <MarcarAula
        pessoaId={maisAntiga.reposicao!.pessoaId}
        nome={linha.titulo}
        servicos={servicos}
        servicoInicial={maisAntiga.reposicao!.servicoId}
        faltas={itens.map(faltaDe)}
        rotuloSessao={rotuloSessao}
        aoMarcar={aoMarcar}
        className={`${BOTAO} cursor-pointer`}
      >
        {ACAO_GRUPO.reposicao_aberta ?? 'Agendar reposição'}
      </MarcarAula>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idDatas}
        onClick={aoAlternar}
        className={`${FANTASMA} inline-flex items-center gap-1.5`}
      >
        {aberto ? 'Fechar' : 'Ver faltas'}
        <span aria-hidden className={`inline-block text-[11px] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}>▾</span>
      </button>
    </>
  )

  return (
    <>
      <LinhaQueAbre href={linha.href} className={aberto ? `${LINHA} border-b-0` : LINHA}>
        <td className={`${CELULA_FIXA} max-md:px-3`}>
          <span className="flex items-start gap-2.5 md:min-w-[280px] md:items-center">
            <Avatar nome={linha.titulo} tamanho={32} decorativo />
            <span className="flex min-w-0 flex-col leading-[1.35]">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Link href={linha.href} className="text-[14.5px] font-medium hover:text-marca">
                  {linha.titulo}
                </Link>
                <span className="rounded-full bg-alerta-superficie px-2 py-px text-[12px] font-semibold text-alerta tabular-nums">
                  {itens.length} reposições
                </span>
              </span>
              <span className="text-[13.5px] text-tinta-media">{detalhe}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 md:hidden">
                <Tipo tipo="reposicao_aberta" />
                {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
              </span>
              <span className="flex flex-wrap items-center gap-1 pt-2 md:hidden">{acoes}</span>
            </span>
          </span>
        </td>
        <td className={`${CELULA} max-md:hidden`}><Tipo tipo="reposicao_aberta" /></td>
        <td className={`${CELULA} max-md:hidden`}>
          {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
        </td>
        <td className={`${CELULA} max-md:hidden`}>
          <span className="flex flex-wrap items-center justify-end gap-1">{acoes}</span>
        </td>
      </LinhaQueAbre>
      {/* as faltas abrem como sub-linhas da própria tabela: a data sob o nome,
          a idade em "Em aberto" e as ações em "Ação", sem cartão dentro de
          tabela nem faixa vazia ao lado */}
      {aberto ? itens.map((p, k) => {
        const ip = idade(p.diasEmAberto)
        const ponto = ip?.tinta === 'alerta' ? 'bg-alerta' : ip?.tinta === 'atencao' ? 'bg-atencao' : 'bg-tinta-fraca'
        const ultima = k === itens.length - 1
        const acoesDaFalta = (
          <span className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => aoDispensar(p)}
              className={`${FANTASMA} md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100`}
            >
              Dispensar
            </button>
            <MarcarAula
              pessoaId={p.reposicao!.pessoaId}
              nome={linha.titulo}
              servicos={servicos}
              servicoInicial={p.reposicao!.servicoId}
              faltas={[]}
              faltaFixa={faltaDe(p)}
              rotuloSessao={rotuloSessao}
              aoMarcar={aoMarcar}
              className="inline-flex min-h-8 cursor-pointer items-center rounded-padrao border border-linha bg-superficie px-2.5 text-[13px] font-medium whitespace-nowrap hover:border-tinta-media"
            >
              Agendar
            </MarcarAula>
          </span>
        )
        return (
          <tr
            key={p.referenciaId}
            id={k === 0 ? idDatas : undefined}
            className={`group hover:bg-superficie-tenue ${ultima ? 'border-b border-linha-suave' : ''}`}
          >
            <td className={`${CELULA_FIXA} relative py-0! max-md:px-3`}>
              {/* o fio que liga as faltas ao aluno de cima */}
              <span aria-hidden className={`absolute left-[31px] w-px bg-linha max-md:left-[27px] ${ultima ? 'top-0 h-1/2' : 'inset-y-0'}`} />
              <span aria-hidden className="absolute top-1/2 left-[31px] h-px w-3 bg-linha max-md:left-[27px]" />
              <span className="flex min-h-11 items-center gap-2.5 pl-[42px] max-md:pl-[34px]">
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${ponto}`} />
                <span className="text-[14px] font-semibold tabular-nums">{dataCurta(p.reposicao!.data)}</span>
                <span className="truncate text-[13.5px] text-tinta-media">{p.reposicao!.motivo}</span>
                <span className="ml-auto md:hidden">{acoesDaFalta}</span>
              </span>
            </td>
            <td className={`${CELULA} max-md:hidden`} />
            <td className={`${CELULA} py-0! text-[12.5px] text-tinta-fraca tabular-nums max-md:hidden`}>{ip?.texto}</td>
            <td className={`${CELULA} py-0! max-md:hidden`}>{acoesDaFalta}</td>
          </tr>
        )
      }) : null}
    </>
  )
}
