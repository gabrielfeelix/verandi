'use client'

import { useMemo, useRef, useState } from 'react'
import { Icone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** `2026-08-16` → `16/08/2026`, que é como se lê data em português. */
function paraTela(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** `16/08/2026` → `2026-08-16`, e `''` quando ainda não é data. */
function paraIso(tela: string): string {
  const m = tela.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  const [, d, mes, a] = m
  const data = new Date(Number(a), Number(mes) - 1, Number(d))
  // 31/02 vira 03/03 no construtor: só é data quem volta igual ao que entrou
  if (data.getDate() !== Number(d) || data.getMonth() !== Number(mes) - 1) return ''
  return `${a}-${mes}-${d}`
}

/** Escreve as barras enquanto se digita, sem exigir que a pessoa as digite. */
function mascara(bruto: string): string {
  const n = bruto.replace(/\D/g, '').slice(0, 8)
  if (n.length <= 2) return n
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`
}

function hojeLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * O campo de data da casa, no lugar do `<input type="date">`.
 *
 * O nativo pinta um calendário do navegador — azul do Chrome, "Limpar/Hoje" em
 * outro idioma, tipografia do sistema — dentro de um produto que cuidou de cada
 * borda. Pior: o seletor de mês fica atrás de um menuzinho, e mudar de ano são
 * três cliques em alvos de 12px.
 *
 * Este escreve as barras sozinho enquanto se digita (quem sabe a data não quer
 * calendário nenhum), e o calendário abre com mês e ano navegáveis, "hoje"
 * marcado e um atalho para ele.
 *
 * O valor viaja em ISO num `<input type="hidden">`, que é o que o servidor
 * espera — a tela mostra `dd/mm/aaaa` e o banco continua recebendo
 * `aaaa-mm-dd`.
 */
export function CampoData({
  nome, valorInicial = '', id, aoTrocar, limpavel = true, autoFocus = false,
}: {
  nome: string
  valorInicial?: string
  id?: string
  aoTrocar?: (iso: string) => void
  /** datas opcionais podem voltar a ficar vazias; a de vigência, não */
  limpavel?: boolean
  autoFocus?: boolean
}) {
  const [iso, setIso] = useState(valorInicial)
  const [texto, setTexto] = useState(paraTela(valorInicial))
  const [aberto, setAberto] = useState(false)
  const hoje = hojeLocal()
  const [mesVisto, setMesVisto] = useState(() => (valorInicial || hoje).slice(0, 7))
  const caixa = useRef<HTMLDivElement>(null)
  const painel = usePosicionar(caixa, aberto, 292, 300)
  useFecharFora([caixa, painel], aberto, () => setAberto(false))

  function definir(novo: string) {
    setIso(novo)
    setTexto(paraTela(novo))
    aoTrocar?.(novo)
  }

  function digitou(bruto: string) {
    const t = mascara(bruto)
    setTexto(t)
    const novo = paraIso(t)
    if (novo) {
      setIso(novo)
      setMesVisto(novo.slice(0, 7))
      aoTrocar?.(novo)
    } else if (t === '') {
      setIso('')
      aoTrocar?.('')
    }
  }

  const [ano, mes] = mesVisto.split('-').map(Number)

  const celulas = useMemo(() => {
    const primeiro = new Date(ano, mes - 1, 1)
    const dias = new Date(ano, mes, 0).getDate()
    const antes = primeiro.getDay()
    const p = (n: number) => String(n).padStart(2, '0')
    return [
      ...Array.from({ length: antes }, () => null),
      ...Array.from({ length: dias }, (_, i) => `${ano}-${p(mes)}-${p(i + 1)}`),
    ]
  }, [ano, mes])

  function andarMes(passo: number) {
    const d = new Date(ano, mes - 1 + passo, 1)
    setMesVisto(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <>
      <input type="hidden" name={nome} value={iso} />
      <div
        ref={caixa}
        className="campo-caixa flex items-center gap-1 pr-1 pl-3.5"
      >
        <input
          id={id}
          value={texto}
          autoFocus={autoFocus}
          onChange={(e) => digitou(e.target.value)}
          onFocus={() => setAberto(false)}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          aria-label="Data, no formato dia, mês e ano"
          className="min-w-0 flex-1 bg-transparent py-3 text-[14px] outline-none placeholder:text-tinta-fraca"
        />
        <button
          type="button"
          onClick={() => { setMesVisto((iso || hoje).slice(0, 7)); setAberto((a) => !a) }}
          aria-label="Abrir o calendário"
          aria-expanded={aberto}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-padrao text-tinta-media hover:bg-superficie-mais-suave hover:text-tinta"
        >
          <Icone nome="hoje" tamanho={18} />
        </button>
      </div>

      {aberto ? (
        <div
          ref={painel}
          style={{ position: 'fixed', zIndex: 70 }}
          className="rounded-grande border border-linha bg-superficie p-3 shadow-modal"
          onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false) }}
        >
          <div className="flex items-center justify-between pb-2">
            <button
              type="button" onClick={() => andarMes(-1)} aria-label="Mês anterior"
              className="flex size-8 cursor-pointer items-center justify-center rounded-padrao text-tinta-media hover:bg-superficie-mais-suave hover:text-tinta"
            >
              <Icone nome="antes" tamanho={16} />
            </button>
            <span className="text-[13.5px] font-medium">
              {MESES[mes - 1]} de {ano}
            </span>
            <button
              type="button" onClick={() => andarMes(1)} aria-label="Próximo mês"
              className="flex size-8 cursor-pointer items-center justify-center rounded-padrao text-tinta-media hover:bg-superficie-mais-suave hover:text-tinta"
            >
              <Icone nome="depois" tamanho={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 pb-1">
            {DIAS.map((d, i) => (
              <span
                key={i}
                aria-hidden
                className="flex h-7 items-center justify-center text-[11px] font-semibold text-tinta-fraca"
              >
                {d}
              </span>
            ))}
          </div>

          <div role="grid" className="grid grid-cols-7 gap-0.5">
            {celulas.map((dia, i) =>
              dia === null ? (
                <span key={`v${i}`} />
              ) : (
                <button
                  key={dia}
                  type="button"
                  aria-current={dia === hoje ? 'date' : undefined}
                  aria-pressed={dia === iso}
                  onClick={() => { definir(dia); setAberto(false) }}
                  className={`flex h-9 cursor-pointer items-center justify-center rounded-padrao text-[13px] transition-colors duration-100 ${
                    dia === iso
                      ? 'bg-escuro font-semibold text-tinta-clara'
                      : dia === hoje
                        ? 'border border-marca font-medium text-marca hover:bg-positivo-superficie'
                        : 'hover:bg-superficie-mais-suave'
                  }`}
                >
                  {Number(dia.slice(8))}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center justify-between border-t border-linha-fina pt-2.5 mt-2.5">
            <button
              type="button"
              onClick={() => { definir(hoje); setMesVisto(hoje.slice(0, 7)); setAberto(false) }}
              className="cursor-pointer rounded-padrao px-2 py-1 text-[12.5px] font-medium text-marca hover:bg-positivo-superficie"
            >
              Hoje
            </button>
            {limpavel ? (
              <button
                type="button"
                onClick={() => { definir(''); setAberto(false) }}
                className="cursor-pointer rounded-padrao px-2 py-1 text-[12.5px] text-tinta-media hover:bg-superficie-mais-suave"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
