import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessaoDetalhe, faltasEmAberto, type FaltaEmAberto } from '@/server/agenda/consultas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { ListaParticipacao } from '@/components/sessao/lista-participacao'
import { PainelVaga } from '@/components/sessao/painel-vaga'
import { TrocarProfissional } from '@/components/sessao/trocar-profissional'
import { AvatarProf } from '@/components/hoje/pecas'
import { cartao } from '@/components/ui/pecas'

const DIAS = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
]
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
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

  const conta_ = {
    presente: sessao.participacoes.filter((p) => p.status === 'presente').length,
    falta: sessao.participacoes.filter((p) => p.status === 'falta').length,
    avisada: sessao.participacoes.filter((p) => p.status === 'falta_avisada').length,
    licenca: sessao.participacoes.filter((p) => p.status === 'licenca').length,
    aguardando: sessao.participacoes.filter(
      (p) => p.status === 'esperada' || p.status === 'confirmada',
    ).length,
  }

  const estado = cancelada
    ? { rotulo: 'Cancelada', cor: 'bg-neutro-fundo text-tinta-media' }
    : sessao.chamada === 'feita'
      ? { rotulo: 'Chamada feita', cor: 'bg-positivo-fundo text-positivo' }
      : conta_.aguardando < sessao.participacoes.length
        ? { rotulo: 'Chamada em andamento', cor: 'bg-atencao-fundo text-atencao' }
        : { rotulo: 'Chamada pendente', cor: 'bg-alerta-fundo text-alerta' }

  const resumoTexto = `${conta_.presente} de ${sessao.participacoes.length} registradas`

  return (
    <ProvedorDeAviso>
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
                <span
                  className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${estado.cor}`}
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  {estado.rotulo}
                </span>
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

              {cancelada ? (
                <p className="rounded-padrao bg-alerta-fundo px-3 py-2 text-[12.5px] text-alerta">
                  {rotulos.sessao.singular} cancelada — {sessao.motivoCancelamento}.
                  O que já foi registrado continua no histórico.
                </p>
              ) : null}
            </div>
          </div>
        </article>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_316px]">
          <ListaParticipacao
            participacoes={sessao.participacoes}
            sessaoId={sessao.id}
            podeRegistrar={podeRegistrar}
            rotuloPessoas={rotulos.pessoa.plural}
            rotuloSessao={rotulos.sessao.singular}
            faltasPorPessoa={faltasPorPessoa}
          />

          <div className="flex flex-col gap-3.5">
            <section className={`${cartao} p-4`}>
              <h2 className="font-titulo text-[17px] font-semibold">
                Resumo da chamada
              </h2>
              <p className="pt-1 pb-3.5 text-[12px] text-tinta-media">{resumoTexto}</p>
              <ul className="flex flex-col gap-2.5">
                {[
                  ['Presentes', conta_.presente, 'bg-positivo'],
                  ['Faltas', conta_.falta, 'bg-alerta'],
                  ['Avisaram', conta_.avisada, 'bg-atencao'],
                  ['Licença', conta_.licenca, 'bg-licenca'],
                  ['Ainda sem registro', conta_.aguardando, 'bg-linha-tracejada'],
                ].map(([rotulo, n, cor]) => (
                  <li key={rotulo as string} className="flex items-center gap-2.5">
                    <span aria-hidden className={`size-2 rounded-full ${cor}`} />
                    <span className="flex-1 text-[13px]">{rotulo}</span>
                    <span className="font-mono text-[13px] text-tinta-media">{n}</span>
                  </li>
                ))}
              </ul>
            </section>

            <PainelVaga
              sessaoId={sessao.id}
              ocupacao={sessao.ocupacao}
              cancelada={cancelada}
              quantasPessoas={sessao.participacoes.length}
              candidatos={candidatos}
              rotuloPessoa={rotulos.pessoa.singular}
            />

            <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie-suave p-4">
              <p className="text-[12.5px] leading-relaxed text-tinta-media">
                O registro aplica na hora e sincroniza depois. Sem sinal nada se
                perde — o aviso aparece e a chamada continua.
              </p>
            </section>
          </div>
        </div>

        {/* A barra que não sai da tela: numa turma longa, rolar até o fim para
            saber se a chamada está feita é o tipo de atrito que faz voltar para
            a planilha. */}
        <div className="sticky bottom-3.5 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-grande border border-linha bg-superficie px-4 py-3 shadow-[0_16px_34px_-22px_rgba(20,26,24,.5)]">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-1.5 text-[12.5px] font-medium ${estado.cor}`}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {estado.rotulo}
            </span>
            <span className="text-[12.5px] text-tinta-media">{resumoTexto}</span>
          </div>

          {podeRegistrar ? (
            <a
              href="#encaixar"
              className="min-h-11 rounded-padrao border border-linha px-4 py-2.5 text-[13px] font-medium hover:bg-superficie-mais-suave"
            >
              Encaixar
            </a>
          ) : null}
        </div>
      </div>
    </ProvedorDeAviso>
  )
}
