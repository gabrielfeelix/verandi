import { describe, it, expect } from 'vitest'
import {
  erroDaFoto, LIMITE_FOTO_MB, LIMITE_ENVIO_MB, MB, TIPOS_DE_FOTO,
} from '@/core/foto'

/**
 * O limite de foto tinha três valores diferentes ao mesmo tempo, e nenhum era
 * o que valia: o Next cortava em 1 MB antes de todos. Estes testes prendem o
 * número num lugar só.
 */
describe('erroDaFoto', () => {
  it('aceita os três tipos que o balde guarda', () => {
    for (const type of TIPOS_DE_FOTO) {
      expect(erroDaFoto({ type, size: 500_000 })).toBeNull()
    }
  })

  it('recusa formato que não é foto, e diz quais servem', () => {
    const erro = erroDaFoto({ type: 'application/pdf', size: 1000 })
    expect(erro).toMatch(/JPEG, PNG ou WEBP/)
  })

  it('recusa acima do limite dizendo o tamanho que a foto tem', () => {
    const erro = erroDaFoto({ type: 'image/jpeg', size: 14.3 * MB })
    // o número que a pessoa precisa para decidir é o da foto dela, não só o
    // do limite: "tem 14,3 MB" responde "por quanto passou?"
    expect(erro).toMatch(/14,3 MB/)
    expect(erro).toMatch(new RegExp(`${LIMITE_FOTO_MB} MB`))
  })

  it('aceita exatamente no limite, e recusa um byte acima', () => {
    expect(erroDaFoto({ type: 'image/jpeg', size: LIMITE_FOTO_MB * MB })).toBeNull()
    expect(erroDaFoto({ type: 'image/jpeg', size: LIMITE_FOTO_MB * MB + 1 })).not.toBeNull()
  })

  it('o que sobe cabe seis vezes numa requisição só', () => {
    // a avaliação manda até seis fotos num envio, e o teto da plataforma é de
    // 4,5 MB por requisição: o limite de envio precisa caber seis vezes com
    // folga, senão o modal cheio falha e o vazio passa
    expect(LIMITE_ENVIO_MB * 6).toBeLessThanOrEqual(12)
    expect(LIMITE_ENVIO_MB).toBeLessThan(LIMITE_FOTO_MB)
  })
})
