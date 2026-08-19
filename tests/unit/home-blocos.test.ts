import { describe, it, expect } from 'vitest'
import {
  BLOCOS, arranjoEfetivo, daFaixa, mover, paraGravar, type Arranjo,
} from '@/core/home/blocos'

const ids = (a: Array<{ id: string }>) => a.map((b) => b.id)
const faixaDe = (id: string) => BLOCOS.find((b) => b.id === id)?.faixa

describe('o arranjo de quem nunca mexeu', () => {
  it('é o catálogo inteiro, na ordem do catálogo, tudo visível', () => {
    const a = arranjoEfetivo(null)
    expect(ids(a)).toEqual(ids(BLOCOS))
    expect(a.every((b) => b.visivel)).toBe(true)
  })

  it('para quem só atende, o que é de dinheiro e pendência nem aparece', () => {
    const a = arranjoEfetivo(null, { operacional: false })
    expect(ids(a)).not.toContain('caixa')
    expect(ids(a)).not.toContain('pendencias')
    expect(ids(a)).toContain('agenda')
  })
})

describe('o arranjo salvo, casado com a tela de hoje', () => {
  it('respeita a ordem gravada', () => {
    const salvo: Arranjo[] = [
      { id: 'agenda', visivel: true },
      { id: 'numeros', visivel: true },
    ]
    expect(ids(arranjoEfetivo(salvo)).slice(0, 2)).toEqual(['agenda', 'numeros'])
  })

  /*
   * O bloco que a tela ganhou depois de a pessoa ter arrumado a dela. Nascer
   * escondido faria a novidade não existir para justamente quem mais usa o
   * produto.
   */
  it('bloco que o arranjo não conhece entra no fim, e entra visível', () => {
    const salvo: Arranjo[] = [{ id: 'agenda', visivel: true }]
    const a = arranjoEfetivo(salvo)
    expect(a[0].id).toBe('agenda')
    expect(a).toHaveLength(BLOCOS.length)
    expect(a.find((b) => b.id === 'caixa')?.visivel).toBe(true)
  })

  it('bloco salvo que não existe mais some, e não segura lugar', () => {
    const salvo: Arranjo[] = [
      { id: 'bloco-que-morreu', visivel: true },
      { id: 'agenda', visivel: true },
    ]
    expect(ids(arranjoEfetivo(salvo))).not.toContain('bloco-que-morreu')
  })

  it('id repetido no arranjo entra uma vez só', () => {
    const salvo: Arranjo[] = [
      { id: 'numeros', visivel: true },
      { id: 'numeros', visivel: false },
    ]
    const a = arranjoEfetivo(salvo)
    expect(a.filter((b) => b.id === 'numeros')).toHaveLength(1)
  })

  /* tela inicial sem tela é o que acontece se a agenda puder ser desligada */
  it('bloco fixo aparece mesmo gravado como escondido', () => {
    const salvo: Arranjo[] = [{ id: 'agenda', visivel: false }]
    expect(arranjoEfetivo(salvo).find((b) => b.id === 'agenda')?.visivel).toBe(true)
  })

  it('o desligado continua no arranjo, e some só de `daFaixa`', () => {
    const salvo: Arranjo[] = [{ id: 'dica', visivel: false }]
    const a = arranjoEfetivo(salvo)
    expect(ids(a)).toContain('dica')
    expect(ids(daFaixa(a, 'lateral'))).not.toContain('dica')
  })
})

describe('mover um bloco', () => {
  /*
   * O vizinho de cima na tela não é o vizinho de cima na lista: as duas faixas
   * moram no mesmo array. Trocar com o índice anterior mandaria a pendência,
   * que é estreita, para o meio da coluna larga.
   */
  it('troca com o vizinho da mesma faixa, e pula o da outra', () => {
    const arranjo: Arranjo[] = [
      { id: 'numeros', visivel: true },     // principal
      { id: 'pendencias', visivel: true },  // lateral
      { id: 'agenda', visivel: true },      // principal
    ]
    const depois = mover(arranjo, 'agenda', 'cima', faixaDe)
    expect(depois.map((b) => b.id)).toEqual(['agenda', 'pendencias', 'numeros'])
  })

  it('quem já está no topo da faixa fica onde está, sem erro', () => {
    const arranjo: Arranjo[] = [
      { id: 'numeros', visivel: true },
      { id: 'agenda', visivel: true },
    ]
    expect(mover(arranjo, 'numeros', 'cima', faixaDe)).toEqual(arranjo)
  })

  it('quem já está no fim da faixa fica onde está', () => {
    const arranjo: Arranjo[] = [
      { id: 'numeros', visivel: true },
      { id: 'agenda', visivel: true },
    ]
    expect(mover(arranjo, 'agenda', 'baixo', faixaDe)).toEqual(arranjo)
  })

  it('id que não está na lista não mexe em nada', () => {
    const arranjo: Arranjo[] = [{ id: 'agenda', visivel: true }]
    expect(mover(arranjo, 'inexistente', 'cima', faixaDe)).toEqual(arranjo)
  })

  it('não perde nem duplica bloco ao mover', () => {
    const arranjo = arranjoEfetivo(null).map((b) => ({ id: b.id, visivel: b.visivel }))
    const depois = mover(arranjo, 'agenda', 'cima', faixaDe)
    expect(depois).toHaveLength(arranjo.length)
    expect(new Set(depois.map((b) => b.id)).size).toBe(arranjo.length)
  })
})

describe('o que vai para o banco', () => {
  /*
   * Gravar título e texto junto congelaria a redação do dia em que a pessoa
   * mexeu, e a tela mostraria o rótulo velho para quem arrumou e o novo para
   * quem não arrumou.
   */
  it('é só id e visível, e nada do texto da tela', () => {
    const gravado = paraGravar(arranjoEfetivo(null))
    for (const linha of gravado) {
      expect(Object.keys(linha).sort()).toEqual(['id', 'visivel'])
    }
  })
})

describe('o catálogo', () => {
  it('não tem id repetido', () => {
    expect(new Set(BLOCOS.map((b) => b.id)).size).toBe(BLOCOS.length)
  })

  it('tem exatamente um bloco fixo, e ele é a agenda', () => {
    expect(BLOCOS.filter((b) => b.fixo).map((b) => b.id)).toEqual(['agenda'])
  })
})
