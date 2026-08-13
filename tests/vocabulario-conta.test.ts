import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { admin } from './setup/supabase'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'

describe('vocabulário por conta', () => {
  const db = admin()
  let pilates: string
  let salao: string
  let semConfig: string

  beforeAll(async () => {
    const m = Date.now()
    const criar = async (nome: string, slug: string) => {
      const { data } = await db.from('conta')
        .insert({ nome, slug: `${slug}-${m}` }).select().single()
      return data!.id as string
    }
    pilates = await criar('Estúdio', 'voc-pilates')
    salao = await criar('Salão', 'voc-salao')
    semConfig = await criar('Sem config', 'voc-sem')

    await db.from('vocabulario').insert([
      { conta_id: pilates, chave: 'pessoa', singular: 'Aluno', plural: 'Alunos' },
      { conta_id: pilates, chave: 'serie', singular: 'Turma', plural: 'Turmas' },
      { conta_id: salao, chave: 'pessoa', singular: 'Cliente', plural: 'Clientes' },
    ])
  })

  it('cada conta recebe o vocabulário dela', async () => {
    expect(resolverRotulos(await carregarVocabulario(db, pilates)).pessoa.plural)
      .toBe('Alunos')
    expect(resolverRotulos(await carregarVocabulario(db, salao)).pessoa.plural)
      .toBe('Clientes')
  })

  it('o que a conta não configurou cai no padrão neutro', async () => {
    const r = resolverRotulos(await carregarVocabulario(db, salao))
    expect(r.pessoa.singular).toBe('Cliente')
    expect(r.serie.singular).toBe('Horário fixo')
  })

  it('conta sem configuração nenhuma funciona inteira no padrão', async () => {
    const r = resolverRotulos(await carregarVocabulario(db, semConfig))
    expect(r.pessoa.plural).toBe('Pessoas')
    expect(r.sessao.plural).toBe('Sessões')
  })
})

describe('nenhuma tela escreve vocabulário de cliente fixo', () => {
  const PROIBIDAS = ['Aluno', 'Alunos', 'Turma', 'Turmas', 'Paciente', 'Pacientes',
                     'Professor', 'Professora', 'Matrícula']

  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) return arquivos(p)
      return /\.tsx?$/.test(n) ? [p] : []
    })
  }

  it('src/app e src/components estão limpos', () => {
    const achados: string[] = []
    for (const dir of ['src/app', 'src/components']) {
      for (const arq of arquivos(dir)) {
        const texto = readFileSync(arq, 'utf8')
        for (const palavra of PROIBIDAS) {
          if (new RegExp(`\\b${palavra}\\b`).test(texto)) {
            achados.push(`${arq}: ${palavra}`)
          }
        }
      }
    }
    // se isto falhar, o rótulo tem que vir do `vocabulario` da conta.
    // é o que permite vender para o barbeiro sem tocar em código.
    expect(achados).toEqual([])
  })
})
