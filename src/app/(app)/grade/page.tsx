import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarSeries, catalogoDaGrade } from '@/server/grade/consultas'
import { EditorSerie } from '@/components/grade/editor-serie'
import { LinhaDaGrade } from '@/components/grade/linha-da-grade'

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
            {vigentes.length} {rotulos.serie.plural.toLowerCase()} ativas ·
            configuração, usada muito no começo e pouco depois
          </p>
        </div>

        {podeEscrever ? (
          <EditorSerie catalogo={catalogo} rotuloSerie={rotulos.serie.singular} />
        ) : null}
      </header>

      {/* A confusão mais provável do sistema inteiro mora aqui, e por isso ela
          é dita antes de qualquer edição, não depois. */}
      <p className="flex items-start gap-2.5 rounded-[14px] border border-[#CFEBE1] bg-[#F3FAF7] px-3.5 py-3 text-[13px] leading-relaxed text-[#2F6659]">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#CFEBE1] font-mono text-[11px]"
        >
          i
        </span>
        <span>
          Editar {rotulos.serie.singular.toLowerCase()} vale{' '}
          <strong className="font-semibold">daqui para frente</strong>.{' '}
          {rotulos.sessao.plural} que já aconteceram não são reescritas.
        </span>
      </p>

      {/* Vazio é estado de projeto, não acidente: conta nova não tem série
          nenhuma, e a tela precisa dizer qual é o próximo passo. */}
      {vigentes.length === 0 ? (
        <section className="flex flex-col items-center gap-2.5 rounded-[20px] border border-dashed border-[#C6D2CD] bg-superficie px-6 py-8.5 text-center">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-[14px] bg-superficie-mais-suave font-mono text-[17px] text-tinta-media"
          >
            ⊞
          </span>
          <span className="font-titulo text-[18px] font-semibold">
            A grade está vazia
          </span>
          <span className="max-w-[400px] text-[13px] leading-relaxed text-tinta-media">
            Conta nova começa assim — não é falha de carregamento. Criar{' '}
            {rotulos.serie.singular.toLowerCase()} é dizer que horários existem,
            e é o que faz {rotulos.sessao.plural.toLowerCase()} aparecerem em
            Hoje e na Semana.
          </span>
        </section>
      ) : (
        porDia.map((g) => (
          <section
            key={g.dia}
            className="overflow-hidden rounded-[20px] border border-linha bg-superficie"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFF3F1] bg-[#FBFCFB] px-4.5 py-3">
              <h2 className="text-[13px] font-medium">{g.nome}</h2>
              <span className="text-[12px] text-tinta-media">
                {g.linhas.length} {(g.linhas.length === 1
                  ? rotulos.serie.singular
                  : rotulos.serie.plural).toLowerCase()}
                {' · '}
                {g.linhas.reduce((n, s) => n + s.ocupadas, 0)}/
                {g.linhas.reduce((n, s) => n + s.capacidade, 0)} ocupadas
              </span>
            </div>
            <ul aria-label={g.nome}>
              {g.linhas.map((s) => (
                <LinhaDaGrade
                  key={s.id} serie={s} catalogo={catalogo}
                  rotuloVaga={rotulos.vaga.plural} rotuloPessoa={rotulos.pessoa.singular}
                  podeEscrever={podeEscrever}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {encerradas.length > 0 ? (
        <section className="overflow-hidden rounded-[20px] border border-linha bg-superficie">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFF3F1] bg-[#FBFCFB] px-4.5 py-3">
            <h2 className="text-[13px] font-medium">Encerradas</h2>
            <span className="text-[12px] text-tinta-media">
              continuam existindo no histórico
            </span>
          </div>
          <ul aria-label="Encerradas">
            {encerradas.map((s) => (
              <LinhaDaGrade
                key={s.id} serie={s} catalogo={catalogo}
                rotuloVaga={rotulos.vaga.plural} rotuloPessoa={rotulos.pessoa.singular}
                podeEscrever={podeEscrever}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
