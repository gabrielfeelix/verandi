import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  JANELA_SEGUNDOS, MAXIMO_DE_TENTATIVAS, proximaEspera, textoAssinado,
} from '@/core/webhook/assinatura'

describe('assinatura do webhook', () => {
  it('o instante entra no texto assinado, e não só no cabeçalho', () => {
    /*
     * Se só o corpo fosse assinado, quem interceptasse uma entrega poderia
     * repeti-la amanhã com a assinatura ainda válida. Com o instante dentro da
     * conta, mudar o instante quebra a assinatura, e quem recebe consegue
     * recusar o que é velho demais.
     */
    const corpo = '{"evento":"sessao.cancelada"}'
    expect(textoAssinado(1786820400, corpo)).toBe(`1786820400.${corpo}`)
    expect(textoAssinado(1786820401, corpo)).not.toBe(textoAssinado(1786820400, corpo))
  })

  it('a conferência que a documentação ensina bate com a que a gente faz', () => {
    // este teste existe para o exemplo da página não envelhecer sozinho
    const segredo = 'whsec_exemplo'
    const corpo = '{"evento":"participacao.cancelada"}'
    const instante = 1786820400

    const nosso = createHmac('sha256', segredo).update(textoAssinado(instante, corpo)).digest('hex')
    const deles = createHmac('sha256', segredo).update(`${instante}.${corpo}`).digest('hex')

    expect(deles).toBe(nosso)
  })

  it('a janela é curta o bastante para não valer repetição', () => {
    expect(JANELA_SEGUNDOS).toBeLessThanOrEqual(600)
  })
})

describe('quando tentar de novo', () => {
  it('a espera cresce, porque insistir de segundo em segundo vira ataque', () => {
    const esperas = Array.from({ length: MAXIMO_DE_TENTATIVAS }, (_, i) => proximaEspera(i)!)
    esperas.forEach((e, i) => {
      if (i > 0) expect(e).toBeGreaterThan(esperas[i - 1])
    })
    expect(esperas[0]).toBeLessThanOrEqual(60)
  })

  it('e para, porque fila que tenta para sempre enche para sempre', () => {
    expect(proximaEspera(MAXIMO_DE_TENTATIVAS)).toBeNull()
    expect(proximaEspera(99)).toBeNull()
  })

  it('as tentativas cobrem mais de uma hora, que é a queda que acontece', () => {
    const total = Array.from({ length: MAXIMO_DE_TENTATIVAS }, (_, i) => proximaEspera(i)!)
      .reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(3600)
  })
})
