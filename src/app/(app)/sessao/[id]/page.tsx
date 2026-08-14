import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessaoDetalhe, faltasEmAberto, type FaltaEmAberto } from '@/server/agenda/consultas'
import { agoraMs, quantoFalta } from '@/server/agenda/fuso'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { ListaParticipacao } from '@/components/sessao/lista-participacao'
import { HistoricoDaTurma } from '@/components/sessao/historico-turma'
import { ModalEncaixe } from '@/components/sessao/modal-encaixe'
import { ModalCancelar } from '@/components/sessao/modal-cancelar'
import {
  ProvedorChamada, BarraChamada, BotaoCancelarTurma, BotaoEncaixar,
  BotaoMarcarTodos, EtiquetaEstado, NotaDeRegistro, ResumoChamada,
} from '@/components/sessao/chamada'
import { TrocarProfissional } from '@/components/sessao/trocar-profissional'
import { AvatarProf } from '@/components/hoje/pecas'
import { cartao } from '@/components/ui/pecas'

// a migalha é uma linha de 12,5px entre duas barras; "Quinta-feira" empurra o
// nome da turma para longe e não acrescenta nada que a data já não diga
const DIAS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta',
  'Quinta', 'Sexta', 'Sábado',
]
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** "09:00" + 50 min → "09:50". Serve só para a linha do cabeçalho. */
function terminaEm(hora: string, duracaoMin: number) {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + duracaoMin
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${
    String(total % 60).padStart(2, '0')}`
}

export default async function Sessao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conta = await exigirConta()
  const db = await clienteServidor()

  const sessao = await sessaoDetalhe(db, id)
  if (!sessao) notFound()

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const { data: pessoas } = await db
    .from('pessoa')
    .select('id, nome, telefone, identificador_externo')
    .eq('conta_id', conta.contaId)
    .eq('ativo', true)
    .order('nome')
    .returns<{ id: string; nome: string; telefone: string | null; identificador_externo: string | null }[]>()

  const candidatos = (pessoas ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    // algo que desambigua: nomes se repetem e são escritos de formas diferentes
    detalhe: p.telefone ?? p.identificador_externo ?? 'sem telefone',
  }))

  const { data: equipe } = await db
    .from('profissional')
    .select('id, nome, cor')
    .eq('conta_id', conta.contaId)
    .eq('ativo', true)
    .order('nome')
    .returns<{ id: string; nome: string; cor: string | null }[]>()

  // as faltas em aberto de quem está aqui: é o que o menu de reposição oferece
  const faltasPorPessoa: Record<string, FaltaEmAberto[]> = {}
  for (const p of sessao.participacoes) {
    faltasPorPessoa[p.pessoaId] = await faltasEmAberto(db, conta.contaId, p.pessoaId)
  }

  const cancelada = sessao.status === 'cancelada'
  const podeRegistrar = !cancelada && conta.papel !== 'suporte'

  const dia = new Date(`${sessao.data}T12:00:00Z`)
  const dataLonga = `${DIAS[dia.getUTCDay()]}, ${dia.getUTCDate()} de ${MESES[dia.getUTCMonth()]}`
  const dataCurta = `${dia.getUTCDate()} ${MESES_CURTOS[dia.getUTCMonth()]}`

  // a contagem do cabeçalho: quem chega antes da turma quer saber quanto falta
  const falta = quantoFalta(sessao.inicio, agoraMs())
  const comecaEm = cancelada || falta === 'já começou'
    ? null
    : `${rotulos.sessao.singular.toLowerCase()} ${falta}`

  return (
    <ProvedorDeAviso>
      <ProvedorChamada
        participacoes={sessao.participacoes}
        sessaoId={sessao.id}
        podeRegistrar={podeRegistrar}
      >
        <div className="flex flex-col gap-4">
          <nav className="flex items-center gap-2.5 text-[12.5px] text-tinta-media">
            <Link href="/hoje" className="font-medium text-marca">Hoje</Link>
            <span aria-hidden className="font-mono">/</span>
            <span>{dataLonga}</span>
            <span aria-hidden className="font-mono">/</span>
            <span className="text-tinta">{sessao.servico} {sessao.hora}</span>
          </nav>

          <article className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4.5 ${cartao} px-5.5 py-5`}>
            <div className="flex min-w-0 flex-[1_1_340px] items-start gap-5.5">
              <div className="flex flex-col gap-1 border-r border-linha-suave pr-5.5">
                <span className="font-titulo text-[34px] leading-none font-semibold tracking-[-.03em]">
                  {sessao.hora}
                </span>
                <span className="text-[12px] whitespace-nowrap text-tinta-media">
                  {sessao.duracaoMin} min · até {terminaEm(sessao.hora, sessao.duracaoMin)}
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-titulo text-[24px] leading-tight font-semibold">
                    {sessao.servico}
                  </h1>
                  <span
                    className={`rounded-peca px-2.5 py-1 font-mono text-[12px] ${
                      sessao.ocupacao.excedida
                        ? 'bg-alerta-fundo text-alerta'
                        : 'bg-superficie-mais-suave text-tinta-media'
                    }`}
                  >
                    {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
                  </span>
                  <EtiquetaEstado cancelada={cancelada} />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[13px] text-tinta-media">
                  {sessao.profissional ? (
                    <span className="inline-flex items-center gap-2">
                      <AvatarProf
                        nome={sessao.profissional}
                        cor={sessao.corProfissional}
                        tamanho={26}
                      />
                      {sessao.profissional}
                    </span>
                  ) : (
                    <span>sem {rotulos.profissional.singular.toLowerCase()} definido</span>
                  )}
                  {sessao.local ? (
                    <>
                      <span aria-hidden className="opacity-40">·</span>
                      <span>{sessao.local}</span>
                    </>
                  ) : null}
                  {conta.papel !== 'profissional' && !cancelada ? (
                    <>
                      <span aria-hidden className="opacity-40">·</span>
                      <TrocarProfissional
                        sessaoId={sessao.id}
                        atual={sessao.profissionalId}
                        equipe={equipe ?? []}
                        rotulo={rotulos.profissional.singular}
                        rotuloSessao={rotulos.sessao.singular}
                      />
                    </>
                  ) : null}
                </div>

                <NotaDeRegistro comecaEm={comecaEm} />

                {cancelada ? (
                  <p className="rounded-padrao bg-alerta-fundo px-3 py-2 text-[12.5px] text-alerta">
                    {rotulos.sessao.singular} cancelada — {sessao.motivoCancelamento}.
                    O que já foi registrado continua no histórico.
                  </p>
                ) : null}
              </div>
            </div>

            {/* As duas ações da tela ficam no canto, juntas: registrar a turma
                inteira, e mexer em quem está nela. Dentro do cartão de conteúdo
                elas competiam com a lista. */}
            <div className="flex min-w-[214px] flex-[1_1_214px] flex-col gap-2.5">
              <BotaoMarcarTodos />
              <div className="flex gap-2">
                <BotaoEncaixar
                  rotulo={`Encaixar ${rotulos.pessoa.singular.toLowerCase()}`}
                  className="flex-1"
                />
                <BotaoCancelarTurma
                  rotulo={`Cancelar ${rotulos.sessao.singular.toLowerCase()}`}
                />
              </div>
            </div>
          </article>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_316px]">
            <ListaParticipacao
              titulo={`${rotulos.pessoa.plural} nesta ${rotulos.sessao.singular.toLowerCase()}`}
              rotuloPessoa={rotulos.pessoa.singular}
              rotuloPessoas={rotulos.pessoa.plural}
              rotuloSessao={rotulos.sessao.singular}
              livres={sessao.ocupacao.livres}
              faltasPorPessoa={faltasPorPessoa}
            />

            <div className="flex flex-col gap-3.5">
              <ResumoChamada />

              <HistoricoDaTurma eventos={sessao.historico} />

              <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie-suave p-4">
                <p className="text-[12.5px] leading-relaxed text-tinta-media">
                  O registro aplica na hora e sincroniza depois. Sem sinal nada se
                  perde — o aviso aparece e a chamada continua.
                </p>
              </section>
            </div>
          </div>

          <BarraChamada cancelada={cancelada} />
        </div>

        <ModalEncaixe
          sessaoId={sessao.id}
          ocupacao={sessao.ocupacao}
          candidatos={candidatos}
          rotuloPessoa={rotulos.pessoa.singular}
          ondeQuando={`${sessao.servico} · ${dataCurta} ${sessao.hora}`}
        />
        <ModalCancelar
          sessaoId={sessao.id}
          titulo={`${sessao.servico} ${sessao.hora}`}
          quantasPessoas={sessao.participacoes.length}
        />
      </ProvedorChamada>
    </ProvedorDeAviso>
  )
}
