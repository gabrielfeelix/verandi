import { describe, it, expect } from 'vitest'
import {
  CONTATO,
  DOCUMENTOS,
  LINKS_LEGAIS,
  PRIVACIDADE,
  SUBPROCESSADORES,
  TERMOS,
  type Documento,
} from '@/core/legal'
import { montaConvite } from '@/core/email/convite'
import { montaRedefinicao } from '@/core/email/redefinir'

/*
 * O que um documento legal não pode perder sem ninguém notar.
 *
 * O silêncio é o defeito: uma política de privacidade que deixou de citar um
 * fornecedor continua bonita na tela e passa a estar errada. Nenhuma destas
 * afirmações aparece em teste de comportamento, então elas viram lint aqui, do
 * mesmo jeito que a régua do vocabulário e o contraste viraram.
 */

const TODOS = Object.values(DOCUMENTOS)

/** todo texto que a tela renderiza, seção por seção */
function textos(doc: Documento): string[] {
  return [
    doc.titulo,
    doc.resumo,
    ...doc.secoes.flatMap((s) => [
      s.titulo,
      ...s.blocos.flatMap((b) => {
        if (b.tipo === 'p' || b.tipo === 'nota') return [b.texto]
        if (b.tipo === 'lista') return b.itens
        return [...b.cabecalho, ...b.linhas.flat()]
      }),
    ]),
  ]
}

describe('a forma dos documentos', () => {
  it.each(TODOS)('$slug tem versão, data e seções', (doc) => {
    expect(doc.versao).toMatch(/^\d+\.\d+$/)
    expect(doc.vigenteDesde).not.toBe('')
    expect(doc.secoes.length).toBeGreaterThan(5)
  })

  it.each(TODOS)('$slug tem âncora única em cada seção', (doc) => {
    const ids = doc.secoes.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // âncora é URL: espaço e maiúscula ali quebram o link que alguém colou
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/))
  })

  it.each(TODOS)('$slug não tem bloco vazio', (doc) => {
    doc.secoes.forEach((s) => {
      expect(s.blocos.length, s.titulo).toBeGreaterThan(0)
      s.blocos.forEach((b) => {
        if (b.tipo === 'lista') expect(b.itens.length, s.titulo).toBeGreaterThan(0)
        if (b.tipo === 'tabela') {
          expect(b.linhas.length, s.titulo).toBeGreaterThan(0)
          // linha com menos célula que cabeçalho renderiza tabela torta
          b.linhas.forEach((l) => expect(l.length).toBe(b.cabecalho.length))
        }
      })
    })
  })

  it('nada de travessão: a régua do produto vale para o texto legal também', () => {
    TODOS.forEach((doc) => {
      textos(doc).forEach((t) => expect(t, `${doc.slug}: ${t}`).not.toContain('—'))
    })
  })

  it('o par de links aponta para documento que existe', () => {
    LINKS_LEGAIS.forEach((l) => {
      expect(DOCUMENTOS[l.href.replace('/', '') as Documento['slug']]).toBeDefined()
    })
  })
})

describe('o que a política de privacidade não pode deixar de dizer', () => {
  const tudo = textos(PRIVACIDADE).join('\n')

  /*
   * A frase que estrutura o produto inteiro. Sem os dois papéis separados com
   * todas as letras, o documento vira modelo genérico de internet, e é
   * exatamente isso que ele não pode ser: quem coletou o dado foi o cliente.
   */
  it('separa operadora de controladora', () => {
    expect(tudo).toContain('operadora')
    expect(tudo).toContain('controladora')
    expect(tudo).toMatch(/art\. 39|instruções/)
  })

  it('nomeia os três fornecedores e onde o dado fica', () => {
    SUBPROCESSADORES.forEach((s) => {
      expect(tudo, s.nome).toContain(s.nome)
      expect(tudo, s.onde).toContain(s.onde)
    })
  })

  it('declara a transferência internacional, e diz em que ela se apoia', () => {
    expect(tudo).toMatch(/transferência internacional|transferências internacionais/)
    // adequação da União Europeia: é o que dispensa cláusula contratual no envio
    // de e-mail, e some do texto no dia em que alguém "simplificar" a seção
    expect(tudo).toContain('adequado')
  })

  it('publica o endereço do encarregado', () => {
    expect(tudo).toContain(CONTATO.privacidade)
  })

  it('fala de dado de saúde, de anonimização e de direitos do titular', () => {
    expect(tudo).toMatch(/dado sensível|saúde/)
    expect(tudo).toContain('anonimiz')
    expect(tudo).toMatch(/portabilidade/)
  })
})

describe('o que os termos não podem deixar de dizer', () => {
  const tudo = textos(TERMOS).join('\n')

  it('diz o que acontece com o dado depois do fim', () => {
    expect(tudo).toMatch(/encerr/i)
    expect(tudo).toContain('30 dias')
  })

  it('diz que o conteúdo da conta é do cliente', () => {
    expect(tudo).toMatch(/pertence ao cliente/)
    expect(tudo).toContain('inteligência artificial')
  })

  it('remete à política de privacidade', () => {
    expect(tudo).toContain('política de privacidade')
  })
})

describe('o link vai junto no e-mail', () => {
  /*
   * Documento que ninguém acha é documento que não existe, e o e-mail é o único
   * lugar onde a Verandi fala com quem ainda não entrou.
   */
  const convite = montaConvite({
    nomeDaConta: 'Estúdio Lótus',
    papel: 'recepcao',
    link: 'https://verandi.4yu.com.br/convite/abc',
    quemConvidou: null,
    diasAteExpirar: 7,
  })
  const senha = montaRedefinicao({
    link: 'https://verandi.4yu.com.br/convite/abc',
    minutosAteExpirar: 30,
  })

  it.each([
    ['convite', convite.html],
    ['senha', senha.html],
  ])('%s leva os dois documentos no rodapé', (_nome, html) => {
    expect(html).toContain('https://verandi.4yu.com.br/termos')
    expect(html).toContain('https://verandi.4yu.com.br/privacidade')
  })
})
