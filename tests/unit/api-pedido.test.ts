import { describe, it, expect } from 'vitest'
import {
  JANELA_MAXIMA_DIAS, dataValida, escolha, idObrigatorio, idValido,
  intervaloValido, primeiro, texto,
} from '@/core/api/pedido'

describe('a data que entra na API', () => {
  it('aceita o formato local, que é o único que a API fala', () => {
    expect(dataValida('2026-08-15', 'de')).toBeNull()
  })

  it('recusa o que falta', () => {
    expect(dataValida(null, 'de')?.campo).toBe('de')
    expect(dataValida('', 'de')?.mensagem).toContain('obrigatório')
  })

  it('recusa instante em UTC, que é o erro mais provável de quem integra', () => {
    // mandar `2026-08-15T00:00:00Z` "funciona" em muitas APIs e aqui não pode:
    // a agenda é local da conta, e a turma das 21h em Brasília é 00h do dia
    // seguinte em UTC. Aceitar isso é aceitar marcar aula no dia errado
    expect(dataValida('2026-08-15T00:00:00Z', 'de')).not.toBeNull()
    expect(dataValida('15/08/2026', 'de')).not.toBeNull()
    expect(dataValida('2026-8-5', 'de')).not.toBeNull()
  })

  it('recusa data que casa com o formato e não existe', () => {
    // `new Date('2026-02-31')` rola para março sem reclamar, e a busca
    // silenciosamente responderia por outro dia
    expect(dataValida('2026-02-31', 'de')?.mensagem).toContain('não é uma data')
    expect(dataValida('2026-13-01', 'de')).not.toBeNull()
    expect(dataValida('2026-00-10', 'de')).not.toBeNull()
  })

  it('aceita 29 de fevereiro em ano bissexto e recusa fora dele', () => {
    expect(dataValida('2028-02-29', 'de')).toBeNull()
    expect(dataValida('2026-02-29', 'de')).not.toBeNull()
  })
})

describe('o intervalo pedido', () => {
  it('aceita a janela normal de uma conversa de bot', () => {
    expect(intervaloValido('2026-08-15', '2026-08-22')).toBeNull()
    expect(intervaloValido('2026-08-15', '2026-08-15')).toBeNull()
  })

  it('recusa o fim antes do começo', () => {
    expect(intervaloValido('2026-08-22', '2026-08-15')?.campo).toBe('ate')
  })

  it('recusa janela grande demais, porque ler a agenda materializa', () => {
    /*
     * Não é limite de gosto. `sessoesDoIntervalo` cria as sessões da janela que
     * ainda não existem: um pedido de dois anos, por ano digitado errado,
     * criaria milhares de linhas de uma vez.
     */
    expect(intervaloValido('2026-01-01', '2026-12-31')).not.toBeNull()
    expect(intervaloValido('2026-08-15', '2028-08-15')?.mensagem)
      .toContain(String(JANELA_MAXIMA_DIAS))
  })

  it('o limite é inclusivo na borda', () => {
    const fim = new Date(Date.parse('2026-08-15T12:00:00Z') + JANELA_MAXIMA_DIAS * 864e5)
      .toISOString().slice(0, 10)
    expect(intervaloValido('2026-08-15', fim)).toBeNull()
  })
})

describe('o id que vem na URL', () => {
  it('vazio é ausência de filtro, não erro', () => {
    expect(idValido(null, 'servico')).toBeNull()
    expect(idValido('', 'servico')).toBeNull()
  })

  it('aceita uuid e recusa o resto', () => {
    expect(idValido('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'servico')).toBeNull()
    for (const lixo of ['1', 'abc', "' or 1=1--", '3f2504e0-4f89-41d3-9a0c']) {
      expect(idValido(lixo, 'servico'), lixo).not.toBeNull()
    }
  })
})

describe('primeiro', () => {
  it('conta um erro por vez: quem integra corrige um por vez', () => {
    expect(primeiro(null, null)).toBeNull()
    expect(primeiro(null, { campo: 'ate', mensagem: 'x' })?.campo).toBe('ate')
    expect(
      primeiro({ campo: 'de', mensagem: 'x' }, { campo: 'ate', mensagem: 'y' })?.campo,
    ).toBe('de')
  })
})

describe('o que a escrita aceita', () => {
  it('texto obrigatório recusa vazio, nulo e só espaço', () => {
    for (const bruto of [undefined, null, '', '   ']) {
      expect(texto(bruto, 'nome', { obrigatorio: true, max: 10 }).erro?.campo).toBe('nome')
    }
  })

  it('texto some com o espaço das pontas, que vira duplicata invisível na busca', () => {
    expect(texto('  Marina  ', 'nome', { obrigatorio: true, max: 10 }).valor).toBe('Marina')
  })

  it('texto opcional vazio vira nulo, e não string vazia', () => {
    // string vazia no banco é telefone que existe e não serve para ligar
    const r = texto('', 'telefone', { max: 40 })
    expect(r.erro).toBeNull()
    expect(r.valor).toBeNull()
  })

  it('texto recusa o que passa do limite, dizendo o limite', () => {
    const r = texto('x'.repeat(11), 'nome', { max: 10 })
    expect(r.erro?.mensagem).toContain('10')
  })

  it('texto recusa o que não é texto', () => {
    expect(texto(42, 'nome', { max: 10 }).erro).not.toBeNull()
    expect(texto({}, 'nome', { max: 10 }).erro).not.toBeNull()
  })

  it('escolha cai no padrão quando não vem, e aceita o que está na lista', () => {
    const aceitos = ['avulso', 'reposicao'] as const
    expect(escolha(undefined, 'origem', aceitos, 'avulso').valor).toBe('avulso')
    expect(escolha('reposicao', 'origem', aceitos, 'avulso').valor).toBe('reposicao')
  })

  it('escolha errada diz quais são as certas', () => {
    // erro que recusa sem dizer o que aceitar para a integração no meio
    const r = escolha('inventada', 'origem', ['avulso', 'reposicao'] as const, 'avulso')
    expect(r.erro?.mensagem).toContain('avulso')
    expect(r.erro?.mensagem).toContain('reposicao')
  })

  it('id obrigatório recusa ausência e formato', () => {
    expect(idObrigatorio(undefined, 'pessoaId')?.campo).toBe('pessoaId')
    expect(idObrigatorio('nao-e-uuid', 'pessoaId')?.campo).toBe('pessoaId')
    expect(idObrigatorio('3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607', 'pessoaId')).toBeNull()
  })
})
