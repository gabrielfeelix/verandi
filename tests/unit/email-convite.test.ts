import { describe, it, expect } from 'vitest'
import { montaConvite, apelidoDe } from '@/core/email/convite'

const base = {
  nomeDaConta: 'Estúdio Lótus',
  papel: 'recepcao' as const,
  link: 'https://verandi.4yu.com.br/convite/abc123',
  quemConvidou: 'Joana',
  diasAteExpirar: 7,
}

describe('e-mail de convite', () => {
  it('diz no assunto qual conta, porque a pessoa não conhece a Verandi', () => {
    expect(montaConvite(base).assunto).toContain('Estúdio Lótus')
  })

  it('carrega o link nas duas versões', () => {
    const { html, texto } = montaConvite(base)
    expect(html).toContain(base.link)
    expect(texto).toContain(base.link)
  })

  it('diz o papel por extenso, não o nome do código', () => {
    const { html, texto } = montaConvite(base)
    expect(html).toContain('Recepção')
    expect(texto).toContain('Recepção')
    expect(texto).not.toContain('recepcao')
  })

  it('diz quem convidou e por quanto tempo vale', () => {
    const { texto } = montaConvite(base)
    expect(texto).toContain('Joana')
    expect(texto).toContain('7 dias')
  })

  it('escapa o que vem do cliente, senão o nome da conta injeta HTML', () => {
    const { html } = montaConvite({
      ...base,
      nomeDaConta: '<script>alert(1)</script>',
      quemConvidou: 'a & b',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &amp; b')
  })

  it('a versão em texto não leva marcação nenhuma', () => {
    const { texto } = montaConvite(base)
    expect(texto).not.toMatch(/<[a-z/]/i)
  })

  it('funciona sem saber quem convidou', () => {
    const { texto, html } = montaConvite({ ...base, quemConvidou: null })
    expect(texto).toContain(base.link)
    expect(html).toContain(base.link)
    expect(texto).not.toContain('null')
  })
})

describe('apelido de quem convidou', () => {
  it('tira o domínio e deixa o nome apresentável', () => {
    expect(apelidoDe('joana@estudiolotus.com.br')).toBe('Joana')
    expect(apelidoDe('maria.silva@x.com')).toBe('Maria Silva')
    expect(apelidoDe('ana_paula@x.com')).toBe('Ana Paula')
    expect(apelidoDe('joao-pedro@x.com')).toBe('Joao Pedro')
  })

  it('descarta número, que é ruído e nunca é nome', () => {
    expect(apelidoDe('joana2024@x.com')).toBe('Joana')
  })

  it('quando não sobra nada, devolve o e-mail em vez de vazio', () => {
    // `123@x.com` viraria string vazia, e "  te convidou" pareceria defeito
    expect(apelidoDe('123@x.com')).toBe('123@x.com')
  })
})
