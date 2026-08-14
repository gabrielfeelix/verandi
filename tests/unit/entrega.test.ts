import { describe, it, expect } from 'vitest'
import { estadoDoEvento, piorEntre, recadoDaEntrega } from '@/core/email/entrega'

describe('evento do Brevo vira estado nosso', () => {
  it('traduz o que importa', () => {
    expect(estadoDoEvento('delivered')).toBe('entregue')
    expect(estadoDoEvento('hard_bounce')).toBe('voltou')
    expect(estadoDoEvento('invalid_email')).toBe('voltou')
    expect(estadoDoEvento('spam')).toBe('spam')
    expect(estadoDoEvento('blocked')).toBe('bloqueado')
    expect(estadoDoEvento('unsubscribed')).toBe('bloqueado')
  })

  it('ignora o que não muda decisão de quem opera', () => {
    // `request` a tela já sabe; abrir e clicar é comportamento de quem recebeu,
    // e guardar isso de um e-mail de acesso é vigiar sem necessidade
    expect(estadoDoEvento('request')).toBeNull()
    expect(estadoDoEvento('opened')).toBeNull()
    expect(estadoDoEvento('click')).toBeNull()
    // atraso temporário não é falha: marcar assustaria à toa
    expect(estadoDoEvento('deferred')).toBeNull()
  })

  it('não quebra com evento desconhecido nem com lixo', () => {
    expect(estadoDoEvento('evento_que_o_brevo_inventar')).toBeNull()
    expect(estadoDoEvento('')).toBeNull()
    expect(estadoDoEvento('  DELIVERED  ')).toBe('entregue')
  })
})

describe('estado pior nunca é apagado por um melhor', () => {
  it('o primeiro estado vale quando não havia nada', () => {
    expect(piorEntre(null, 'entregue')).toBe('entregue')
    expect(piorEntre(undefined, 'voltou')).toBe('voltou')
  })

  it('um delivered atrasado não apaga o problema', () => {
    // o Brevo entrega evento fora de ordem; sem isto, a dona perderia
    // justamente o aviso que ela precisa ver
    expect(piorEntre('voltou', 'entregue')).toBe('voltou')
    expect(piorEntre('spam', 'entregue')).toBe('spam')
    expect(piorEntre('bloqueado', 'entregue')).toBe('bloqueado')
  })

  it('piora quando o novo é pior', () => {
    expect(piorEntre('entregue', 'spam')).toBe('spam')
    expect(piorEntre('spam', 'bloqueado')).toBe('bloqueado')
    expect(piorEntre('bloqueado', 'voltou')).toBe('voltou')
  })
})

describe('o recado é para quem convidou, não para o log', () => {
  it('diz o que fazer, não o nome do estado', () => {
    expect(recadoDaEntrega('voltou')).toContain('confira o endereço')
    expect(recadoDaEntrega('spam')).toContain('link direto')
    expect(recadoDaEntrega('bloqueado')).toContain('link direto')
  })

  it('nenhum recado usa jargão do Brevo', () => {
    for (const e of ['entregue', 'voltou', 'spam', 'bloqueado'] as const) {
      expect(recadoDaEntrega(e)).not.toMatch(/bounce|blocked|complaint/i)
    }
  })
})
