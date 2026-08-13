import Link from 'next/link'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { sessoesDoIntervalo } from '@/server/agenda/consultas'
import { diaDaSemanaDe, somarDias } from '@/core/agenda/datas'
import { hojeEm } from '@/server/agenda/fuso'
import { GradeSemana } from '@/components/grade/grade-semana'
import { AlternarModo, DiaPorRecurso } from '@/components/grade/dia-por-recurso'
import { LinhaAgenda, AvatarProf } from '@/components/hoje/pecas'

type Busca = Promise<{
  de?: string
  profissional?: string
  local?: string
  dia?: string
  modo?: string
  eixo?: string
}>

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** A segunda-feira da semana que contém a data. */
function segundaDe(data: string): string {
  const d = diaDaSemanaDe(data)
  return somarDias(data, d === 0 ? -6 : 1 - d)
}

function curta(data: string) {
  return `${data.slice(8)}/${data.slice(5, 7)}`
}

export default async function Semana({ searchParams }: { searchParams: Busca }) {
  const p = await searchParams
  const conta = await exigirConta()
  const db = await clienteServidor()

  const fuso = conta.fuso
  const hoje = hojeEm(fuso)
  const segunda = segundaDe(p.de ?? hoje)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
  const sabado = dias[6]

  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const [{ data: profissionais }, { data: locais }] = await Promise.all([
    db.from('profissional').select('id, nome, cor')
      .eq('conta_id', conta.contaId).eq('ativo', true).order('nome')
      .returns<{ id: string; nome: string; cor: string | null }[]>(),
    db.from('local').select('id, nome')
      .eq('conta_id', conta.contaId).eq('ativo', true).order('nome')
      .returns<{ id: string; nome: string }[]>(),
  ])

  const ehDia = p.modo === 'dia'
  // no modo dia a janela é de um dia só; na semana, os sete
  const diaFoco = p.dia ?? hoje
  const de = ehDia ? diaFoco : segunda
  const ate = ehDia ? diaFoco : sabado

  const sessoes = await sessoesDoIntervalo(db, conta.contaId, de, ate, {
    ...(p.profissional ? { profissionalId: p.profissional } : {}),
    ...(p.local ? { localId: p.local } : {}),
  })

  const { data: excecoes } = await db
    .from('excecao_calendario').select('data, descricao, tipo')
    .eq('conta_id', conta.contaId).gte('data', de).lte('data', ate)
    .returns<{ data: string; descricao: string | null; tipo: string }[]>()

  const feriados = Object.fromEntries(
    (excecoes ?? []).map((e) => [e.data, e.descricao ?? e.tipo]),
  )

  const q = (extra: Record<string, string | undefined>) => {
    const base: Record<string, string> = { de: segunda }
    if (p.profissional) base.profissional = p.profissional
    if (p.local) base.local = p.local
    if (p.dia) base.dia = p.dia
    if (p.modo) base.modo = p.modo
    if (p.eixo) base.eixo = p.eixo
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) delete base[k]
      else base[k] = v
    }
    return `/semana?${new URLSearchParams(base)}`
  }

  const vagas = sessoes.reduce(
    (acc, s) => ({
      ocupadas: acc.ocupadas + s.ocupacao.ocupadas,
      total: acc.total + s.ocupacao.capacidade,
    }),
    { ocupadas: 0, total: 0 },
  )
  const porcento = vagas.total
    ? Math.round((vagas.ocupadas / vagas.total) * 100)
    : 0

  // colunas do modo dia: sala é o padrão, porque é o recurso físico que se
  // esgota; profissional é a alternativa para quem separa por pessoa
  const porLocal = (p.eixo ?? 'local') === 'local'
  const doDia = sessoes.filter((s) => s.data === diaFoco)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            {ehDia ? 'Dia por recurso' : 'Grade da semana'}
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {ehDia
              ? `${DIAS_CURTOS[diaDaSemanaDe(diaFoco)]} ${curta(diaFoco)}`
              : `${curta(segunda)} a ${curta(sabado)}`}
            {' · '}
            {sessoes.length} {rotulos.sessao.plural.toLowerCase()}
            {vagas.total > 0 ? ` · ${porcento}% das vagas ocupadas` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <AlternarModo
            semana={q({ modo: undefined })}
            dia={q({ modo: 'dia', dia: diaFoco })}
            ehDia={ehDia}
          />

          <div className="flex items-center overflow-hidden rounded-[12px] border border-linha bg-superficie">
            <Link
              href={ehDia
                ? q({ dia: somarDias(diaFoco, -1) })
                : q({ de: somarDias(segunda, -7) })}
              aria-label={ehDia ? 'Dia anterior' : 'Semana anterior'}
              className="px-3 py-2.5 font-mono text-[13px] text-tinta-media hover:bg-superficie-mais-suave"
            >
              ‹
            </Link>
            <Link
              href={ehDia ? q({ dia: hoje }) : q({ de: segundaDe(hoje) })}
              className="px-3 py-2.5 text-[13px] font-medium whitespace-nowrap hover:bg-superficie-mais-suave"
            >
              {ehDia ? 'Hoje' : 'Esta semana'}
            </Link>
            <Link
              href={ehDia
                ? q({ dia: somarDias(diaFoco, 1) })
                : q({ de: somarDias(segunda, 7) })}
              aria-label={ehDia ? 'Próximo dia' : 'Próxima semana'}
              className="px-3 py-2.5 font-mono text-[13px] text-tinta-media hover:bg-superficie-mais-suave"
            >
              ›
            </Link>
          </div>
        </div>
      </header>

      {/* Filtro por pessoa é o mais usado — a pergunta frequente é "como está a
          semana da Marina". O de local só aparece quando há mais de um lugar. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip href={q({ profissional: undefined })} ativo={!p.profissional}>
          {`Todos os ${rotulos.profissional.plural.toLowerCase()}`}
        </Chip>
        {(profissionais ?? []).map((pr) => (
          <Chip
            key={pr.id}
            href={q({ profissional: p.profissional === pr.id ? undefined : pr.id })}
            ativo={p.profissional === pr.id}
          >
            <AvatarProf nome={pr.nome} cor={pr.cor} tamanho={20} />
            {pr.nome}
          </Chip>
        ))}

        {(locais ?? []).length > 1 ? (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-linha" />
            <Chip href={q({ local: undefined })} ativo={!p.local}>
              Todos os locais
            </Chip>
            {(locais ?? []).map((l) => (
              <Chip
                key={l.id}
                href={q({ local: p.local === l.id ? undefined : l.id })}
                ativo={p.local === l.id}
              >
                {l.nome}
              </Chip>
            ))}
          </>
        ) : null}
      </div>

      {ehDia ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-tinta-media">Colunas por</span>
            <Chip href={q({ eixo: 'local' })} ativo={porLocal}>Local</Chip>
            <Chip href={q({ eixo: 'profissional' })} ativo={!porLocal}>
              {rotulos.profissional.singular}
            </Chip>
            {feriados[diaFoco] ? (
              <span className="rounded-[9px] bg-atencao-fundo px-2.5 py-1 text-[11.5px] font-medium text-atencao">
                {feriados[diaFoco]}
              </span>
            ) : null}
          </div>

          <DiaPorRecurso
            sessoes={sessoes}
            eixo={porLocal ? 'Local' : rotulos.profissional.singular}
            recursos={
              porLocal
                ? (locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))
                : (profissionais ?? []).map((pr) => ({
                    id: pr.id, nome: pr.nome, cor: pr.cor,
                  }))
            }
            chaveDe={(s) => (porLocal ? s.localId : s.profissionalId)}
            vazio={`Nada marcado neste dia. Pode ser feriado ou dia fechado na configuração de funcionamento — não é falha de carregamento.`}
          />
        </>
      ) : (
        <>
          <div className="hidden md:block">
            <GradeSemana
              sessoes={sessoes}
              dias={dias}
              feriados={feriados}
              hoje={hoje}
            />
          </div>

          {/* Em celular sete colunas não cabem: vira um dia por vez. */}
          <div className="md:hidden">
            <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Dias da semana">
              {dias.map((d) => (
                <Link
                  key={d}
                  href={q({ dia: d })}
                  aria-current={d === diaFoco ? 'page' : undefined}
                  className={`flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[11px] border px-2 ${
                    d === diaFoco
                      ? 'border-escuro bg-escuro text-tinta-clara'
                      : 'border-linha bg-superficie'
                  }`}
                >
                  <span className="text-[10px] uppercase">
                    {DIAS_CURTOS[diaDaSemanaDe(d)]}
                  </span>
                  <span className="font-mono text-[13px]">{d.slice(8)}</span>
                </Link>
              ))}
            </nav>

            {feriados[diaFoco] ? (
              <p className="mb-2 rounded-[11px] bg-atencao-fundo px-3 py-2 text-[12.5px] text-atencao">
                {feriados[diaFoco]}
              </p>
            ) : null}

            {doDia.length === 0 ? (
              <p className="rounded-[15px] border border-dashed border-[#C6D2CD] px-4 py-6 text-center text-[13px] text-tinta-media">
                Nada marcado neste dia.
              </p>
            ) : (
              <ul
                className="flex flex-col rounded-[20px] border border-linha bg-superficie p-1.5"
                aria-label={rotulos.sessao.plural}
              >
                {doDia.map((s) => (
                  <LinhaAgenda key={s.id} sessao={s} passou={false} agora={false} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-tinta-media">
        {[
          ['bg-superficie-suave border-linha-suave', 'horário normal'],
          ['bg-[#FFF6F1] border-[#F7DACB]', 'acima da capacidade'],
          ['bg-superficie-mais-suave border-linha', 'cancelado'],
          ['bg-atencao-fundo border-atencao-fundo', 'feriado ou fechado'],
        ].map(([cor, rotulo]) => (
          <span key={rotulo} className="inline-flex items-center gap-2">
            <span aria-hidden className={`size-2.5 rounded-[3px] border ${cor}`} />
            {rotulo}
          </span>
        ))}
        <span className="text-tinta-fraca">Em celular a grade vira um dia por vez.</span>
      </div>
    </div>
  )
}

function Chip({
  href, ativo, children,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px] ${
        ativo
          ? 'border-escuro bg-escuro font-medium text-tinta-clara'
          : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-suave'
      }`}
    >
      {children}
    </Link>
  )
}
