import { notFound } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessaoDetalhe } from '@/server/agenda/consultas'
import { ListaParticipacao } from '@/components/sessao/lista-participacao'
import { PainelVaga } from '@/components/sessao/painel-vaga'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

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

  const diaSemana = DIAS[new Date(`${sessao.data}T12:00:00Z`).getUTCDay()]
  const cancelada = sessao.status === 'cancelada'

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">
          {rotulos.sessao.singular} de {diaSemana}, {sessao.hora}
        </h1>
        <p className="opacity-80">
          {sessao.servico}
          {sessao.profissional ? ` · ${sessao.profissional}` : ''}
          {sessao.local ? ` · ${sessao.local}` : ''}
          {' · '}
          <span className={sessao.ocupacao.excedida ? 'font-bold' : undefined}>
            {sessao.ocupacao.ocupadas}/{sessao.ocupacao.capacidade}
          </span>
        </p>

        {cancelada ? (
          <p role="alert" className="mt-2 rounded border p-2">
            Horário cancelado — {sessao.motivoCancelamento}
          </p>
        ) : null}

        {sessao.chamada === 'pendente' && !cancelada ? (
          <p className="mt-2">Chamada pendente.</p>
        ) : null}
      </header>

      <ListaParticipacao
        participacoes={sessao.participacoes}
        sessaoId={sessao.id}
        podeRegistrar={!cancelada}
        rotuloPessoas={rotulos.pessoa.plural}
      />

      <PainelVaga
        sessaoId={sessao.id}
        ocupacao={sessao.ocupacao}
        cancelada={cancelada}
        quantasPessoas={sessao.participacoes.length}
        candidatos={candidatos}
        rotuloPessoa={rotulos.pessoa.singular}
      />
    </div>
  )
}
