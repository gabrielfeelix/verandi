import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
 * A régua do vocabulário, aplicada ao produto inteiro e não só ao onboarding.
 *
 * O gênero é da palavra e a palavra é do cliente. Quem escreve a tela não pode
 * saber se `servico` vai ser "Serviço", "Modalidade" ou "Procedimento", então
 * qualquer coisa que **concorde** com a palavra é erro de português esperando o
 * primeiro cliente que não seja igual ao exemplo da cabeça de quem escreveu:
 *
 *   "um ${servico}"        -> "um modalidade"
 *   "${serie.plural} ativas" -> "turmas fixas ativos"
 *   "${sessao.singular} cancelada" -> "atendimento cancelada"
 *
 * Isto não é teste de comportamento: é um lint que roda com os testes, porque
 * o defeito não aparece em nenhuma tela que se abra em português neutro. Ele
 * aparece na conta do cliente, depois de vendida.
 *
 * O jeito de passar não é achar sinônimo: é **tirar o qualificador de perto da
 * palavra**. "Vagas ativas" vira "Vagas em vigor"; "3 serviços desativados"
 * vira "3 serviços fora de uso"; "Sessão cancelada, motivo" vira "Sessão não
 * vai acontecer: motivo". Onde o artigo é inevitável, a frase muda.
 */

const RAIZ = 'src'

/** as expressões que rendem palavra do cliente em tempo de execução */
const CHAVE = 'pessoa|profissional|servico|local|serie|sessao|vaga'
const EXPRESSAO = new RegExp(
  // rotulos.sessao.singular · r.serie.plural · p.palavras.local.singular
  `(?:[A-Za-z_$][\\w$]*\\.)?(?:${CHAVE})\\.(?:singular|plural)` +
  // ou uma prop que carrega a palavra: rotuloPessoa, rotuloSerie, rotuloSeries
  `|rotulo(?:s)?(?:Pessoas?|Profissional|Servicos?|Locais?|Locals?|Series?|Sessoes|Sessao|Vagas?|Plural)`,
  'g',
)

/**
 * Artigo, contração e determinante: tudo que muda de forma conforme o gênero
 * da palavra que vem depois.
 */
const ANTES = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas',
  'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'neste', 'nesta', 'nestes', 'nestas', 'nesse', 'nessa', 'nesses', 'nessas',
  'deste', 'desta', 'destes', 'destas', 'desse', 'dessa', 'desses', 'dessas',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'naquele', 'naquela',
  'todo', 'toda', 'todos', 'todas', 'outro', 'outra', 'outros', 'outras',
  'novo', 'nova', 'novos', 'novas', 'nenhum', 'nenhuma', 'nenhuns', 'nenhumas',
  'próximo', 'próxima', 'próximos', 'próximas',
  'último', 'última', 'últimos', 'últimas',
  'meu', 'minha', 'seu', 'sua', 'muito', 'muita', 'muitos', 'muitas',
  'quanto', 'quanta', 'quantos', 'quantas',
])

/** adjetivo e particípio que concordariam com a palavra do cliente */
const DEPOIS = new Set([
  'ativo', 'ativa', 'ativos', 'ativas',
  'cheio', 'cheia', 'cheios', 'cheias',
  'vazio', 'vazia', 'vazios', 'vazias',
  'novo', 'nova', 'novos', 'novas',
  'aberto', 'aberta', 'abertos', 'abertas',
  'pronto', 'pronta', 'prontos', 'prontas',
  'mesmo', 'mesma', 'mesmos', 'mesmas',
  'inteiro', 'inteira', 'inteiros', 'inteiras',
  'próprio', 'própria', 'próprios', 'próprias',
  'único', 'única', 'únicos', 'únicas',
])

/** "cancelada", "desativados", "definido": particípio concorda sempre */
const PARTICIPIO = /^[a-zà-ú]{3,}(?:ad|id)[oa]s?$/

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(caminho) ? [caminho] : []
  })
}

/** o que sobra depois de tirar a abertura de interpolação e o `.toLowerCase()` */
function palavraAntes(trecho: string): string | null {
  const limpo = trecho
    .replace(/\$?\{\s*$/, ' ')      // `${` e `{` de JSX
    .replace(/\(\s*$/, ' ')          // `(` de `(n === 1 ? …`
    .replace(/['"`]\s*$/, ' ')
  const m = limpo.match(/([A-Za-zÀ-ú]+)\s+$/)
  return m ? m[1].toLowerCase() : null
}

function palavraDepois(trecho: string): string | null {
  const limpo = trecho
    .replace(/^(?:\.toLowerCase\(\))?(?:\.replace\([^)]*\))?/, '')
    .replace(/^\s*\}+/, ' ')
    .replace(/^\s*\)+(?:\.toLowerCase\(\))?\s*\}?/, ' ')
    .replace(/^['"`]/, ' ')
  const m = limpo.match(/^\s+([A-Za-zÀ-ú]+)/)
  return m ? m[1].toLowerCase() : null
}

/** comentário não vai para a tela, e a régua não vale para ele */
function ehComentario(linha: string): boolean {
  return /^\s*(\/\/|\/?\*)/.test(linha)
}

describe('a régua do vocabulário vale no produto inteiro', () => {
  const fontes = arquivos(RAIZ)

  it('acha os arquivos que fala', () => {
    expect(fontes.length).toBeGreaterThan(40)
  })

  it('nenhum artigo cola na palavra do cliente', () => {
    const achados: string[] = []
    for (const arq of fontes) {
      readFileSync(arq, 'utf8').split('\n').forEach((linha, i) => {
        if (ehComentario(linha)) return
        for (const m of linha.matchAll(EXPRESSAO)) {
          const antes = palavraAntes(linha.slice(0, m.index))
          if (antes && ANTES.has(antes)) {
            achados.push(`${arq}:${i + 1}  "${antes} ${m[0]}"`)
          }
        }
      })
    }
    expect(achados, achados.join('\n')).toEqual([])
  })

  it('nenhum adjetivo concorda com a palavra do cliente', () => {
    const achados: string[] = []
    for (const arq of fontes) {
      readFileSync(arq, 'utf8').split('\n').forEach((linha, i) => {
        if (ehComentario(linha)) return
        for (const m of linha.matchAll(EXPRESSAO)) {
          const resto = linha.slice(m.index + m[0].length)
          const depois = palavraDepois(resto)
          if (depois && (DEPOIS.has(depois) || PARTICIPIO.test(depois))) {
            achados.push(`${arq}:${i + 1}  "${m[0]} ${depois}"`)
          }
        }
      })
    }
    expect(achados, achados.join('\n')).toEqual([])
  })
})
