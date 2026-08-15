import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROTAS } from '@/core/api-doc/referencia'

/*
 * O lint que mantém a documentação honesta.
 *
 * Documentação de API erra sempre do mesmo jeito: alguém acrescenta uma rota,
 * ninguém lembra do arquivo, e meses depois um integrador passa a tarde
 * procurando um campo que não existe. Isso não quebra teste nenhum, não aparece
 * em build, e só é descoberto por quem está de fora, que é a pessoa que menos
 * pode descobrir.
 *
 * Então a régua vira número: o que existe em `src/app/api/v1` tem de estar
 * descrito, e o que está descrito tem de existir.
 */

const RAIZ = join('src', 'app', 'api', 'v1')

/** `pessoas/[id]` e `/pessoas/{pessoaId}` são a mesma rota, escritas diferente */
function normaliza(caminho: string): string {
  return caminho
    .replace(/\[[^\]]+\]/g, '*')
    .replace(/\{[^}]+\}/g, '*')
    .replace(/^\/?/, '/')
}

function rotasNoCodigo(): { metodo: string; caminho: string }[] {
  const achadas: { metodo: string; caminho: string }[] = []

  function varre(dir: string) {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        varre(caminho)
      } else if (nome === 'route.ts') {
        const fonte = readFileSync(caminho, 'utf8')
        const url = normaliza(relative(RAIZ, dir).split(/[\\/]/).join('/'))
        for (const metodo of ['GET', 'POST', 'DELETE', 'PATCH', 'PUT']) {
          if (new RegExp(`export const ${metodo}\\b`).test(fonte)) {
            achadas.push({ metodo, caminho: url })
          }
        }
      }
    }
  }

  varre(RAIZ)
  return achadas
}

describe('a documentação descreve a API que existe', () => {
  const noCodigo = rotasNoCodigo()
  const naDoc = ROTAS.map((r) => ({ metodo: r.metodo, caminho: normaliza(r.caminho) }))
  const chave = (r: { metodo: string; caminho: string }) => `${r.metodo} ${r.caminho}`

  it('acha as rotas do código', () => {
    expect(noCodigo.length).toBeGreaterThan(4)
  })

  it('toda rota do código está documentada', () => {
    const documentadas = new Set(naDoc.map(chave))
    const faltando = noCodigo.map(chave).filter((r) => !documentadas.has(r))
    expect(faltando, `sem documentação: ${faltando.join(', ')}`).toEqual([])
  })

  it('toda rota documentada existe no código', () => {
    const existentes = new Set(noCodigo.map(chave))
    const fantasmas = naDoc.map(chave).filter((r) => !existentes.has(r))
    expect(fantasmas, `documentadas e inexistentes: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('cada rota tem âncora única, exemplo e resposta', () => {
    const ids = ROTAS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    ROTAS.forEach((r) => {
      expect(r.id, r.caminho).toMatch(/^[a-z0-9-]+$/)
      expect(r.exemplo, r.caminho).toContain('curl')
      expect(r.resposta.length, r.caminho).toBeGreaterThan(10)
    })
  })

  it('nada de travessão, que é a régua do texto do produto', () => {
    ROTAS.forEach((r) => {
      const tudo = [r.titulo, r.resumo, r.atencao ?? '', ...(r.parametros ?? []).map((c) => c.descricao)]
      tudo.forEach((t) => expect(t, r.caminho).not.toContain('—'))
    })
  })

  it('o exemplo de escrita mostra a Idempotency-Key, que é o que evita duplicidade', () => {
    ROTAS.filter((r) => r.metodo === 'POST').forEach((r) => {
      expect(r.exemplo, r.caminho).toContain('Idempotency-Key')
    })
  })
})
