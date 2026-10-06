import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarSeries, catalogoDaGrade } from '@/server/grade/consultas'
import { EditorSerie } from '@/components/grade/editor-serie'
import { LinhaDaGrade } from '@/components/grade/linha-da-grade'
import { CapacidadeDaSemana } from '@/components/grade/capacidade-semana'
import { cartao, Vazio } from '@/components/ui/pecas'
import { Abas } from '@/components/ui/abas'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * A grade fixa: a estrutura que se repete. É configuração, usada muito no
 * começo e pouco depois.
 *
 * `profissional` não alcança esta tela: ele opera a agenda, não a monta.
 */
export default async function Grade() {
  const conta = await exigirPapel(OPERA, 'Grade fixa')

  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const [series, catalogo] = await Promise.all([
    listarSeries(db, conta.contaId, conta.fuso),
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[28px] leading-[1.05] font-semibold tracking-[-.02em]">
            Grade fixa
          </h1>
          <p className="pt-[3px] text-[14.5px] text-tinta-media">
            {vigentes.length} {rotulos.serie.plural.toLowerCase()} em uso, que se
            repetem toda semana.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* a grade é uma aba da Agenda: o caminho de volta fica à vista */}
          <Abas
            rotuloDoGrupo="Como ver a agenda"
            ativo="grade"
            itens={[
              { id: 'semana', rotulo: 'Semana', href: '/semana' },
              { id: 'dia', rotulo: 'Dia', href: '/semana?modo=dia' },
              { id: 'grade', rotulo: 'Grade fixa', href: '/grade' },
            ]}
          />
          {podeEscrever ? (
            <div data-guia="grade-criar">
              <EditorSerie catalogo={catalogo} rotulos={rotulos} />
            </div>
          ) : null}
        </div>
      </header>


      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3.5">
      {/* Vazio é estado de projeto, não acidente: conta nova não tem série
          nenhuma, e a tela precisa dizer qual é o próximo passo. */}
      {vigentes.length === 0 ? (
        <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie">
          <Vazio
            icone="grade"
            titulo="A grade está vazia"
            texto="Cadastre os horários que se repetem toda semana. É deles que nasce o que aparece em Hoje e na Agenda."
          />
        </section>
      ) : (
        porDia.map((g) => (
          <section
            key={g.dia}
            className={`overflow-hidden ${cartao}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3">
              <h2 className="text-[14.5px] font-medium">{g.nome}</h2>
              <span className="text-[13.5px] text-tinta-media">
                {g.linhas.length} {(g.linhas.length === 1
                  ? rotulos.serie.singular
                  : rotulos.serie.plural).toLowerCase()}
                {' · '}
                {g.linhas.reduce((n, s) => n + s.capacidade, 0)}{' '}
                {rotulos.vaga.plural.toLowerCase()}
              </span>
            </div>
            <ul aria-label={g.nome} className="flex flex-col gap-2 p-2.5">
              {g.linhas.map((s) => (
                <LinhaDaGrade
                  key={s.id} serie={s} catalogo={catalogo}
                  rotulos={rotulos}
                  podeEscrever={podeEscrever}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {encerradas.length > 0 ? (
        <section className={`overflow-hidden ${cartao}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3">
            <h2 className="text-[14.5px] font-medium">
              {rotulos.serie.plural} que terminaram
            </h2>
          </div>
          <ul aria-label="Encerradas" className="flex flex-col gap-2 p-2.5">
            {encerradas.map((s) => (
              <LinhaDaGrade
                key={s.id} serie={s} catalogo={catalogo}
                rotulos={rotulos}
                podeEscrever={podeEscrever}
              />
            ))}
          </ul>
        </section>
      ) : null}
        </div>

        <div className="flex flex-col gap-3.5">
          <CapacidadeDaSemana series={vigentes} rotuloSerie={rotulos.serie} />

        </div>
      </div>
    </div>
  )
}
