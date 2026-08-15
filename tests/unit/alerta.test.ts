import { describe, it, expect } from 'vitest'
import { SILENCIO_MINUTOS, assinaturaDoErro, normaliza } from '@/core/alerta/assinatura'

/*
 * Quando dois erros são o mesmo erro.
 *
 * É a única regra difícil do monitoramento barato, e errá-la estraga as duas
 * pontas: frouxa demais esconde o segundo defeito dentro do primeiro; estrita
 * demais faz um defeito virar quatrocentos e-mails, porque o id muda a cada
 * requisição, e aí todo mundo aprende a filtrar o remetente.
 */
describe('a assinatura de um erro', () => {
  it('o mesmo defeito em pessoas diferentes é um erro só', () => {
    const a = 'pessoa 3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607 não encontrada'
    const b = 'pessoa 91aa22cc-1111-4222-8333-444455556666 não encontrada'
    expect(normaliza(a)).toBe(normaliza(b))
  })

  it('data e contagem também variam sem mudar o defeito', () => {
    expect(normaliza('janela de 2026-08-17 vazia')).toBe(normaliza('janela de 2026-03-02 vazia'))
    expect(normaliza('esperava 1200 linhas')).toBe(normaliza('esperava 4310 linhas'))
  })

  it('a mesma mensagem em rotas diferentes são dois defeitos', () => {
    // juntá-los faria o segundo nunca ser avisado
    expect(assinaturaDoErro('api /v1/pessoas', 'não encontrado'))
      .not.toBe(assinaturaDoErro('api /v1/sessoes', 'não encontrado'))
  })

  it('defeitos diferentes no mesmo lugar continuam separados', () => {
    expect(assinaturaDoErro('/hoje', 'timeout no banco'))
      .not.toBe(assinaturaDoErro('/hoje', 'coluna inexistente'))
  })

  it('a mensagem é cortada, para o assunto do e-mail não virar um parágrafo', () => {
    expect(normaliza('x'.repeat(900)).length).toBeLessThanOrEqual(300)
  })

  it('o silêncio cabe num turno de trabalho', () => {
    // curto para o defeito aparecer no mesmo turno, longo para não encher a caixa
    expect(SILENCIO_MINUTOS).toBeGreaterThanOrEqual(15)
    expect(SILENCIO_MINUTOS).toBeLessThanOrEqual(180)
  })
})
