import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/*
 * O que sai no papel, guardado como lint.
 *
 * Estes dois defeitos não quebravam nada e não apareciam em nenhuma tela: o
 * primeiro só aparece com uma folha impressa na mão, e o segundo só quando
 * alguém lê o rodapé do recibo que já foi entregue. São os dois da família que
 * este projeto já pagou caro para aprender a testar.
 *
 * É um lint sobre o código, e não teste de comportamento, porque comportamento
 * de `@media print` não roda em `jsdom`: o que dá para garantir aqui é que as
 * decisões não sumam num refactor.
 */

const LAYOUT = readFileSync('src/app/(app)/layout.tsx', 'utf8')
const CSS = readFileSync('src/app/globals.css', 'utf8')
const FOLHA = readFileSync('src/components/recibo/folha.tsx', 'utf8')
const EMISSAO = readFileSync('src/server/recibo/acoes.ts', 'utf8')

describe('o que o papel não leva', () => {
  /*
   * O trilho, a barra do celular e o rodapé legal imprimiam junto com o
   * recibo. Não como cabeçalho: **por baixo** da folha, com o nome das telas
   * atravessando o texto que o aluno leva embora.
   */
  it('o trilho, a barra do celular e o rodapé estão marcados para sair', () => {
    const marcados = LAYOUT.split('data-imprimir="fora"').length - 1
    expect(marcados).toBeGreaterThanOrEqual(4)
  })

  it('a regra que apaga o marcado continua no CSS', () => {
    expect(CSS).toContain("[data-imprimir='fora']")
    expect(CSS).toMatch(/\[data-imprimir='fora'\]\s*\{\s*display:\s*none\s*!important/)
  })

  /*
   * Tirar a folha do fluxo a fazia flutuar por cima do que sobrasse na página
   * em vez de ocupá-la. Enquanto o trilho ainda imprimia, era isso que punha o
   * menu por baixo do recibo.
   */
  it('a folha do recibo imprime no fluxo, e não posicionada por cima', () => {
    const bloco = CSS.slice(CSS.indexOf('[data-folha]'))
      .slice(0, CSS.slice(CSS.indexOf('[data-folha]')).indexOf('}'))
    expect(bloco).not.toContain('position: absolute')
  })

  it('a folha tem tamanho e margem de papel definidos', () => {
    expect(CSS).toMatch(/@page\s*\{[^}]*size:\s*A4/)
  })
})

describe('o e-mail de quem emite não vai para o papel', () => {
  /*
   * Quem responde pelo negócio raramente está cadastrado como profissional, e
   * o caminho antigo caía em `user.email`: o endereço pessoal do dono do
   * estúdio, impresso na via de cada aluno que pagou.
   */
  it('a emissão não usa o e-mail do usuário como quem emitiu', () => {
    const linha = EMISSAO.split('\n').find((l) => l.includes('emitidoPor:'))
    expect(linha).toBeDefined()
    expect(linha).not.toContain('email')
  })

  it('a folha só imprime quem emitiu passando por `quemEmitiu`', () => {
    expect(FOLHA).toContain('quemEmitiu')
    // nada de ler `corpo.emitidoPor` cru na hora de desenhar
    expect(FOLHA).not.toContain('{corpo.emitidoPor}')
  })
})

describe('o que um recibo precisa dizer', () => {
  /*
   * Título em destaque, valor em algarismos e por extenso, local e data de
   * emissão, e a assinatura com o nome de quem recebeu. Faltavam quatro dos
   * cinco, e nenhum teste percebia porque a folha renderizava.
   */
  it('a folha tem título, valor por extenso, local e data, e assinatura', () => {
    expect(FOLHA).toContain('Recibo')
    expect(FOLHA).toContain('valorPorExtenso')
    expect(FOLHA).toContain('localDeEmissao')
    expect(FOLHA).toContain('dataPorExtenso')
    expect(FOLHA).toContain('emitenteNome')
  })
})
