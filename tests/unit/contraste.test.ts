import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/*
 * O contraste dos tokens de texto, medido e não prometido.
 *
 * O protótipo desce até `#8B9691`, que dá 3,06:1 sobre branco. A regra antiga
 * era "use só em 14px ou maior", e ela não protegia nada: a isenção de texto
 * grande da WCAG começa em 24px (ou 18,66px negrito), não em 14. Enquanto a
 * regra era prosa num documento, quatro tokens reprovavam ao mesmo tempo e
 * ninguém sabia.
 *
 * Aqui ela é número. Se alguém clarear um token de texto para "ficar mais
 * parecido com o protótipo", este teste diz exatamente quanto ficou.
 *
 * A régua de fundo não é o branco: é `#F1F5F3`, a superfície mais clara que
 * ainda recebe texto pequeno (cabeçalho de lista, chip, contagem). Um token que
 * só passa no branco reprova em metade das telas.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8')

function token(nome: string): string {
  const m = CSS.match(new RegExp(`--color-${nome}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --color-${nome} não existe mais em globals.css`)
  return m[1]
}

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(frente: string, fundo: string): number {
  const [a, b] = [luminancia(frente), luminancia(fundo)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

/** o mínimo da WCAG AA para texto de corpo */
const MINIMO = 4.5

describe('contraste dos tokens de texto', () => {
  /** cada tom de texto contra a superfície mais clara em que ele aparece */
  const pares: Array<[string, string, string]> = [
    ['tinta', 'superficie-mais-suave', 'o texto de corpo'],
    ['tinta-media', 'superficie-mais-suave', 'o texto de apoio'],
    ['tinta-apagada', 'superficie-mais-suave', 'a nota de rodapé da ficha'],
    ['tinta-fraca', 'superficie-mais-suave', 'rótulo, contagem, hora'],
    // cada tinta com significado sobre o próprio fundo dela: é a etiqueta,
    // 11px dentro de um chip claro, e é onde se lê "falta" e "presente"
    ['positivo', 'positivo-fundo', 'presente, vaga fixa'],
    ['alerta', 'alerta-fundo', 'falta, lotado, pendente'],
    ['atencao', 'atencao-fundo', 'falta avisada, reposição'],
    ['info', 'info-fundo', 'avulso'],
    ['licenca', 'licenca-fundo', 'licença'],
    ['neutro', 'neutro-fundo', 'esperada, reserva, cancelada'],
    // e sobre a superfície pálida, que é o fundo da Nota e das faixas
    ['positivo', 'positivo-superficie', 'a faixa que explica'],
    ['alerta', 'alerta-superficie', 'a faixa destrutiva'],
    ['atencao', 'atencao-superficie', 'a faixa de aviso'],
  ]

  for (const [frente, fundo, onde] of pares) {
    it(`${frente} sobre ${fundo} passa em AA (${onde})`, () => {
      const r = contraste(token(frente), token(fundo))
      expect(
        Number(r.toFixed(2)),
        `${token(frente)} sobre ${token(fundo)} dá ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(MINIMO)
    })
  }

  it('o texto do trilho escuro passa sobre o escuro dele', () => {
    for (const t of ['tinta-clara', 'tinta-escura-media', 'tinta-escura-fraca']) {
      const r = contraste(token(t), token('escuro-2'))
      expect(Number(r.toFixed(2)), `${t} dá ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(MINIMO)
    }
  })

  /*
   * `tinta-inativa` é a única isenta, e a isenção é estreita: a WCAG 1.4.3
   * dispensa **controle desabilitado**, não texto apagado em geral. Ela vale
   * para `:disabled`, e o teste existe para o dia em que alguém a usar num
   * `<span>` achando que "inativa" quer dizer "discreta".
   */
  it('tinta-inativa só existe onde a WCAG isenta, e o CSS diz isso', () => {
    expect(CSS).toMatch(/tinta-inativa[\s\S]{0,200}?:disabled|:disabled[\s\S]{0,200}?tinta-inativa/)
  })
})
