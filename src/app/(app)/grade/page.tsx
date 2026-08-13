import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarSeries, catalogoDaGrade, type SerieLinha } from '@/server/grade/consultas'
import { EditorSerie } from '@/components/grade/editor-serie'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * A grade fixa: a estrutura que se repete. É configuração — usada muito no
 * começo e pouco depois.
 *
 * `profissional` não alcança esta tela: ele opera a agenda, não a monta.
 */
export default async function Grade() {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') redirect('/hoje')

  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const [series, catalogo] = await Promise.all([
    listarSeries(db, conta.contaId),
    catalogoDaGrade(db, conta.contaId),
  ])

  const podeEscrever = conta.papel === 'dono' || conta.papel === 'suporte'
  const vigentes = series.filter((s) => !s.encerrada)
  const encerradas = series.filter((s) => s.encerrada)

  const porDia = DIAS.map((nome, dia) => ({
    nome,
    dia,
    linhas: vigentes.filter((s) => s.diaSemana === dia),
  })).filter((g) => g.linhas.length > 0)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Grade fixa</h1>
        <span className="opacity-70">
          {vigentes.length} {rotulos.serie.plural.toLowerCase()}
        </span>
      </header>

      {podeEscrever ? (
        <EditorSerie catalogo={catalogo} rotuloSerie={rotulos.serie.singular} />
      ) : null}

      {/* Vazio é estado de projeto, não acidente: conta nova não tem série
          nenhuma, e a tela precisa dizer qual é o próximo passo. */}
      {vigentes.length === 0 ? (
        <p className="opacity-70">
          A grade está vazia. Crie {rotulos.serie.singular.toLowerCase()} para
          dizer que horários existem — é o que faz {rotulos.sessao.plural.toLowerCase()}{' '}
          aparecerem em Hoje e na Semana.
        </p>
      ) : (
        porDia.map((g) => (
          <section key={g.dia} className="flex flex-col gap-2">
            <h2 className="font-medium">{g.nome}</h2>
            <ul className="flex flex-col gap-2" aria-label={g.nome}>
              {g.linhas.map((s) => <Linha key={s.id} serie={s} rotuloVaga={rotulos.vaga.plural} />)}
            </ul>
          </section>
        ))
      )}

      {encerradas.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Encerradas</h2>
          <ul className="flex flex-col gap-2" aria-label="Encerradas">
            {encerradas.map((s) => (
              <Linha key={s.id} serie={s} rotuloVaga={rotulos.vaga.plural} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Linha({ serie, rotuloVaga }: { serie: SerieLinha; rotuloVaga: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 rounded border p-3">
      <span className="font-medium">{serie.horaInicio}</span>
      <span>{serie.servico}</span>
      <span className="text-sm opacity-70">{serie.duracaoMin} min</span>
      {serie.profissional ? <span className="text-sm">{serie.profissional}</span> : null}
      {serie.local ? <span className="text-sm opacity-70">{serie.local}</span> : null}

      {/* Ocupação sempre no formato ocupadas/capacidade, sem esconder nem truncar */}
      <span className="text-sm">
        {serie.ocupadas}/{serie.capacidade} {rotuloVaga.toLowerCase()}
      </span>

      <span className="text-sm opacity-70">
        {serie.encerrada
          ? `encerrada em ${serie.vigenciaFim}`
          : `desde ${serie.vigenciaInicio}`}
      </span>
    </li>
  )
}
