'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { BotaoLinha, Dado, Estado, LinhaConfig, PainelConfig } from './casca'
import { Chip } from '@/components/ui/pecas'
import { Escolha } from '@/components/ui/escolha'
import { CampoNumero } from '@/components/ui/campo-numero'
import { useAviso } from '@/components/ui/desfazer'
import { criarPlano, editarPlano, alternarPlano } from '@/server/planos/acoes'
import type { EntradaDePlano } from '@/server/planos/acoes'
import type { PlanoLinha } from '@/server/planos/consultas'
import type { ServicoLinha } from '@/server/config/consultas'
import type { Rotulo } from '@/core/vocabulario/padrao'
import {
  comoCobra, emCentavos, emReais, seRepete, RECORRENCIAS, type Recorrencia,
} from '@/core/planos/plano'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * A tabela de preços do negócio.
 *
 * Ela chega como documento de texto, com quarenta e duas linhas, código
 * repetido e preço que só quem escreveu sabe interpretar. A tela existe para
 * responder três perguntas em um relance: quanto custa, como cobra, e está
 * valendo. Por isso a coluna do meio é uma frase, e não a palavra "trimestral".
 *
 * Os planos aparecem agrupados pela categoria da modalidade, que é como a
 * tabela de origem já vinha escrita: um bloco de pilates, um de terapias.
 */

const SEM_GRUPO = 'Sem categoria'

function grupos(planos: PlanoLinha[]): Array<[string, PlanoLinha[]]> {
  const mapa = new Map<string, PlanoLinha[]>()
  for (const p of planos) {
    const chave = p.categoria?.trim() || SEM_GRUPO
    mapa.set(chave, [...(mapa.get(chave) ?? []), p])
  }
  // "Sem categoria" por último: é o resto, e resto não abre lista
  return [...mapa.entries()].sort(([a], [b]) =>
    a === SEM_GRUPO ? 1 : b === SEM_GRUPO ? -1 : a.localeCompare(b, 'pt-BR'))
}

export function SecaoPlanos({
  planos, servicos, rotuloServico,
}: {
  planos: PlanoLinha[]
  servicos: ServicoLinha[]
  rotuloServico: Rotulo
}) {
  const [edicao, setEdicao] = useState<PlanoLinha | 'novo' | null>(null)
  const [modalidade, setModalidade] = useState<string | null>(null)
  const [soInativos, setSoInativos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const ativos = planos.filter((p) => p.ativo).length

  const visiveis = useMemo(() => planos.filter((p) =>
    (modalidade === null || p.servicoId === modalidade)
    && (soInativos ? !p.ativo : true)), [planos, modalidade, soInativos])

  /*
   * O erro chega como valor, e não como exceção: ver `Resultado` em
   * `server/planos/acoes.ts`. O `catch` continua aqui para o que a rede quebra
   * antes de a ação responder.
   */
  function salvar(
    fn: () => Promise<{ ok: true } | { ok: false; erro: string }>,
    texto: string, aoFim?: () => void,
  ) {
    iniciar(async () => {
      setErro(null)
      try {
        const r = await fn()
        if (!r.ok) return setErro(r.erro)
        avisar({ texto })
        aoFim?.()
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  const emEdicao = edicao === 'novo' ? null : edicao

  return (
    <PainelConfig
      titulo="Planos e valores"
      sub={
        planos.length > 0
          ? `${planos.length} no catálogo, ${ativos} em vigor`
          : 'O que o negócio vende, com código, forma de cobrança e preço'
      }
      acao={
        servicos.length > 0
          ? <Botao miudo onClick={() => { setErro(null); setEdicao('novo') }}>
              Novo plano
            </Botao>
          : null
      }
    >
      {servicos.length === 0 ? (
        <p className="px-5 py-6 text-[14px] text-tinta-media">
          Um plano vende uma modalidade, então o catálogo de{' '}
          {rotuloServico.plural.toLowerCase()} vem antes. Cadastre pelo menos
          {' '}{rotuloServico.singular.toLowerCase() === 'serviço' ? 'um' : 'uma'}{' '}
          e volte aqui.
        </p>
      ) : null}

      {servicos.length > 0 ? (
        <div className="flex flex-col gap-3 px-5 py-4">
          <Nota tom="neutro">
            Um plano, dois preços. Quem já tem plano em vigor de outra
            modalidade paga a tabela de cliente; quem chega só para esta paga a
            cheia. O sistema escolhe no ato da matrícula e mostra qual usou.
          </Nota>

          <div className="flex flex-wrap items-center gap-2">
            <Chip ativo={modalidade === null} onClick={() => setModalidade(null)}>
              Tudo
            </Chip>
            {servicos.map((s) => (
              <Chip
                key={s.id}
                ativo={modalidade === s.id}
                onClick={() => setModalidade(modalidade === s.id ? null : s.id)}
              >
                {s.nome}
              </Chip>
            ))}
            <label className="flex cursor-pointer items-center gap-2 pl-1 text-[13.5px] text-tinta-media">
              <input
                type="checkbox"
                checked={soInativos}
                onChange={(e) => setSoInativos(e.target.checked)}
                className="size-4 cursor-pointer"
              />
              Só os que saíram de uso
            </label>
          </div>
        </div>
      ) : null}

      {servicos.length > 0 && visiveis.length === 0 ? (
        <p className="px-5 pb-6 text-[14px] text-tinta-media">
          {planos.length === 0
            ? 'Nada no catálogo ainda. O primeiro plano é o que faz a matrícula parar de digitar preço à mão.'
            : 'Nenhum plano com esse filtro.'}
        </p>
      ) : null}

      {grupos(visiveis).map(([nome, doGrupo]) => (
        <div key={nome}>
          <p className="border-b border-linha-fina bg-superficie-suave px-5 py-2 text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
            {nome} · {doGrupo.length}
          </p>
          {doGrupo.map((p) => (
            <LinhaConfig
              key={p.id}
              apagado={!p.ativo}
              antes={<Dado>{p.codigo}</Dado>}
              nome={p.nome}
              detalhe={`${p.servicoNome} · ${comoCobra(p)}`}
            >
              <span className="font-mono text-[13.5px]">
                {emReais(p.precoVinculadoCent)}
              </span>
              <span className="font-mono text-[13.5px] text-tinta-media">
                {p.precoAvulsoCent === p.precoVinculadoCent
                  /* repetir o mesmo número duas vezes faz procurar a diferença
                     que não existe */
                  ? 'mesma'
                  : emReais(p.precoAvulsoCent)}
              </span>
              <Estado ativo={p.ativo} />
              <BotaoLinha onClick={() => { setErro(null); setEdicao(p) }}>
                Editar
              </BotaoLinha>
              <BotaoLinha
                tom={p.ativo ? 'perigo' : 'marca'}
                disabled={pendente}
                onClick={() => salvar(
                  () => alternarPlano(p.id, !p.ativo),
                  p.ativo ? 'Plano fora de uso' : 'Plano de volta ao catálogo',
                )}
              >
                {p.ativo ? 'Tirar de uso' : 'Voltar ao uso'}
              </BotaoLinha>
            </LinhaConfig>
          ))}
        </div>
      ))}

      {edicao ? (
        <FormularioDePlano
          plano={emEdicao}
          servicos={servicos}
          rotuloServico={rotuloServico}
          pendente={pendente}
          erro={erro}
          aoFechar={() => { setEdicao(null); setErro(null) }}
          aoEnviar={(dados) => salvar(
            () => emEdicao ? editarPlano(emEdicao.id, dados) : criarPlano(dados),
            emEdicao ? 'Plano salvo' : 'Plano criado',
            () => setEdicao(null),
          )}
        />
      ) : null}
    </PainelConfig>
  )
}

/**
 * O formulário muda de forma conforme a cobrança.
 *
 * Perguntar "quantas sessões" num plano mensal e "quantos horários por semana"
 * num pacote é o jeito mais rápido de a tabela nascer com campo preenchido no
 * lugar errado, e ninguém confere quarenta e duas linhas depois.
 */
function FormularioDePlano({
  plano, servicos, rotuloServico, pendente, erro, aoFechar, aoEnviar,
}: {
  plano: PlanoLinha | null
  servicos: ServicoLinha[]
  rotuloServico: Rotulo
  pendente: boolean
  erro: string | null
  aoFechar: () => void
  aoEnviar: (dados: EntradaDePlano) => void
}) {
  const [recorrencia, setRecorrencia] = useState<Recorrencia>(
    plano?.recorrencia ?? 'mensal')
  const [precoRuim, setPrecoRuim] = useState<string | null>(null)

  return (
    <ModalFormulario
      aberto
      glifo={plano ? '✎' : '+'}
      titulo={plano ? 'Editar plano' : 'Novo plano'}
      sub={plano ? plano.nome : 'O que o negócio vende, e por quanto'}
      primario={plano ? 'Salvar' : 'Criar'}
      pendente={pendente}
      aoFechar={aoFechar}
      aoEnviar={(f) => {
        const vinculado = emCentavos(String(f.get('precoVinculado') ?? ''))
        const avulso = emCentavos(String(f.get('precoAvulso') ?? ''))
        if (vinculado === null || avulso === null) {
          setPrecoRuim('Escreva os dois preços em reais, como 735,00.')
          return
        }
        setPrecoRuim(null)
        aoEnviar({
          codigo: String(f.get('codigo') ?? ''),
          nome: String(f.get('nome') ?? ''),
          servicoId: String(f.get('servicoId') ?? ''),
          recorrencia,
          parcelas: Number(f.get('parcelas') ?? 1) || 1,
          frequenciaSemanal: seRepete(recorrencia)
            ? Number(f.get('frequenciaSemanal') ?? 0) || null
            : null,
          sessoesNoPacote: recorrencia === 'pacote'
            ? Number(f.get('sessoesNoPacote') ?? 0) || null
            : null,
          validadeMeses: recorrencia === 'pacote'
            ? Number(f.get('validadeMeses') ?? 0) || null
            : null,
          precoVinculadoCent: vinculado,
          precoAvulsoCent: avulso,
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
        <Campo rotulo="Código" htmlFor="pl-cod" obrigatorio>
          <input
            id="pl-cod" name="codigo" required maxLength={12}
            defaultValue={plano?.codigo} placeholder="001"
            className={`${entrada} font-mono`}
          />
        </Campo>
        <Campo rotulo="Nome do plano" htmlFor="pl-nome" obrigatorio>
          <input
            id="pl-nome" name="nome" required maxLength={120} autoFocus
            defaultValue={plano?.nome} placeholder="Ex.: Mensal, 2x por semana"
            className={entrada}
          />
        </Campo>
      </div>

      <Campo rotulo={rotuloServico.singular} htmlFor="pl-servico" obrigatorio>
        <Escolha
          id="pl-servico" nome="servicoId"
          valorInicial={plano?.servicoId ?? servicos[0]?.id ?? ''}
          opcoes={servicos.map((s) => ({ valor: s.id, rotulo: s.nome }))}
        />
      </Campo>

      <Campo rotulo="Como cobra" htmlFor="pl-rec" obrigatorio>
        <Escolha
          id="pl-rec" nome="recorrencia"
          valorInicial={recorrencia}
          aoTrocar={(v) => setRecorrencia(v as Recorrencia)}
          opcoes={RECORRENCIAS.map((r) => ({ valor: r.valor, rotulo: r.rotulo }))}
        />
      </Campo>

      <div className="flex flex-wrap items-start gap-3">
        {seRepete(recorrencia) ? (
          <>
            <Campo
              rotulo="Horários por semana" htmlFor="pl-freq"
              dica="quantos lugares fixos a matrícula vai ocupar"
            >
              <span className="block w-32">
                <CampoNumero
                  id="pl-freq" nome="frequenciaSemanal" min={1} max={7}
                  valorInicial={plano?.frequenciaSemanal ?? 1}
                />
              </span>
            </Campo>
            <Campo rotulo="Parcelas" htmlFor="pl-parc" dica="1 quando cobra tudo de uma vez">
              <span className="block w-28">
                <CampoNumero
                  id="pl-parc" nome="parcelas" min={1} max={48}
                  valorInicial={plano?.parcelas ?? 1}
                />
              </span>
            </Campo>
          </>
        ) : null}

        {recorrencia === 'pacote' ? (
          <>
            <Campo rotulo="Sessões no pacote" htmlFor="pl-sess" obrigatorio>
              <span className="block w-32">
                <CampoNumero
                  id="pl-sess" nome="sessoesNoPacote" min={1} max={200}
                  valorInicial={plano?.sessoesNoPacote ?? 10} required
                />
              </span>
            </Campo>
            <Campo
              rotulo="Validade" htmlFor="pl-val"
              dica="em meses, a partir da compra"
            >
              <span className="block w-32">
                <CampoNumero
                  id="pl-val" nome="validadeMeses" min={1} max={60} sufixo="meses"
                  valorInicial={plano?.validadeMeses ?? 6}
                />
              </span>
            </Campo>
          </>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          rotulo="Preço de cliente" htmlFor="pl-pv"
          dica="de quem já tem plano em vigor de outra modalidade"
        >
          <input
            id="pl-pv" name="precoVinculado" required inputMode="decimal"
            defaultValue={plano ? emReais(plano.precoVinculadoCent) : ''}
            placeholder="195,00" className={`${entrada} font-mono`}
          />
        </Campo>
        <Campo
          rotulo="Preço cheio" htmlFor="pl-pa"
          dica="repita o mesmo valor quando o plano tem preço único"
        >
          <input
            id="pl-pa" name="precoAvulso" required inputMode="decimal"
            defaultValue={plano ? emReais(plano.precoAvulsoCent) : ''}
            placeholder="230,00" className={`${entrada} font-mono`}
          />
        </Campo>
      </div>

      {precoRuim ? <Nota tom="alerta">{precoRuim}</Nota> : null}
      {erro ? <Nota tom="alerta">{erro}</Nota> : null}
    </ModalFormulario>
  )
}
