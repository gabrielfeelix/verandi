import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarSeries, catalogoDaGrade } from '@/server/grade/consultas'
import { EditorSerie } from '@/components/grade/editor-serie'
import { LinhaDaGrade } from '@/components/grade/linha-da-grade'
import { CapacidadeDaSemana } from '@/components/grade/capacidade-semana'
import { cartao, Vazio } from '@/components/ui/pecas'

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
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Grade fixa
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {vigentes.length} {rotulos.serie.plural.toLowerCase()} em uso ·
            configuração, usada muito no começo e pouco depois
          </p>
        </div>

        {podeEscrever ? (
          <div data-guia="grade-criar">
            <EditorSerie catalogo={catalogo} rotulos={rotulos} />
          </div>
        ) : null}
      </header>

      {/* A confusão mais provável do sistema inteiro mora aqui, e por isso ela
          é dita antes de qualquer edição, não depois. */}
      <p className="flex items-start gap-2.5 rounded-media border border-positivo-linha bg-positivo-superficie px-3.5 py-3 text-[13px] leading-relaxed text-[#2F6659]">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-positivo-linha font-mono text-[11px]"
        >
          i
        </span>
        <span>
          Editar {rotulos.serie.singular.toLowerCase()} vale{' '}
          <strong className="font-semibold">daqui para frente</strong>.{' '}
          {rotulos.sessao.plural} que já aconteceram ficam como estão.
        </span>
      </p>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3.5">
      {/* Vazio é estado de projeto, não acidente: conta nova não tem série
          nenhuma, e a tela precisa dizer qual é o próximo passo. */}
      {vigentes.length === 0 ? (
        <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie">
          <Vazio
            icone="grade"
            titulo="A grade está vazia"
            texto={`Conta nova começa assim. Não é falha de carregamento. Criar ${rotulos.serie.singular.toLowerCase()} é dizer que horários existem, e é o que faz ${rotulos.sessao.plural.toLowerCase()} aparecerem em Hoje e na Semana.`}
          />
        </section>
      ) : (
        porDia.map((g) => (
          <section
            key={g.dia}
            className={`overflow-hidden ${cartao}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha-fina bg-superficie-tenue px-4.5 py-3">
              <h2 className="text-[13px] font-medium">{g.nome}</h2>
              <span className="text-[12px] text-tinta-media">
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
            <h2 className="text-[13px] font-medium">
              {rotulos.serie.plural} que terminaram
            </h2>
            <span className="text-[12px] text-tinta-media">
              continuam existindo no histórico
            </span>
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

          {/* As duas ações que assustam, explicadas antes de serem clicadas. */}
          <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie-suave p-4">
            <p className="text-[12.5px] leading-relaxed text-tinta-media">
              Encerrar {rotulos.serie.singular.toLowerCase()} avisa quantas
              pessoas ocupam vaga ali antes de confirmar. Duplicar existe porque
              montar {vigentes.length} {rotulos.serie.plural.toLowerCase()} à mão
              é o pior momento da implantação.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
