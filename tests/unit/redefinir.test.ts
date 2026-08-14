import { describe, it, expect } from 'vitest'
import { montaRedefinicao } from '@/core/email/redefinir'

const base = { link: 'https://verandi.4yu.com.br/convite/abc123', minutosAteExpirar: 30 }

describe('e-mail de senha nova', () => {
  it('leva o link nas duas versões', () => {
    const { html, texto } = montaRedefinicao(base)
    expect(html).toContain(base.link)
    expect(texto).toContain(base.link)
  })

  it('diz o prazo, que é curto de propósito', () => {
    const { html, texto } = montaRedefinicao(base)
    expect(texto).toContain('30 minutos')
    expect(html).toContain('30 minutos')
  })

  it('diz o que fazer se não foi a pessoa que pediu', () => {
    const { texto, html } = montaRedefinicao(base)
    expect(texto).toContain('ignorar')
    expect(html).toContain('Não foi você?')
  })

  it('não nomeia conta nem estúdio', () => {
    // quem pede senha está olhando a tela da Verandi, e o remetente do Auth é
    // fixo por projeto: citar estúdio aqui seria inventar contexto
    const { html } = montaRedefinicao(base)
    expect(html).not.toMatch(/estúdio l[óo]tus/i)
  })

  it('a versão em texto não leva marcação', () => {
    expect(montaRedefinicao(base).texto).not.toMatch(/<[a-z/]/i)
  })
})

describe('nada de travessão em texto que o usuário lê', () => {
  it('nem no html, nem no texto, nem no assunto', () => {
    // travessão tem cara de texto gerado por máquina, e este e-mail precisa
    // parecer escrito por gente
    const e = montaRedefinicao(base)
    expect(e.assunto).not.toContain('—')
    expect(e.texto).not.toContain('—')
    expect(e.html).not.toContain('—')
  })
})
