/**
 * Captura as telas do produto, na mesma viewport do protótipo (1440×1000).
 *
 * O par de `tira-prototipo.mjs`: sem as duas capturas lado a lado, "vestir"
 * vira memória, e memória foi exatamente o que falhou da primeira vez.
 *
 *   npm run dev                      # em outro terminal
 *   node scripts/tira-produto.mjs [pasta-de-saida]
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:3000'
const EMAIL = process.env.EMAIL ?? 'dono@dev.local'
const SENHA = process.env.SENHA ?? 'senha-de-teste-123'

const raiz = resolve(import.meta.dirname, '..')
const saida = resolve(process.argv[2] ?? resolve(raiz, '.produto'))
mkdirSync(saida, { recursive: true })

const ROTAS = [
  ['hoje', '/hoje'],
  ['semana', '/semana'],
  ['pend-', '/pendencias'],
  ['alunos', '/pessoas'],
  ['vaga', '/vaga'],
  ['fixa', '/grade'],
  ['config', '/config'],
  ['config-servicos', '/config?secao=servicos'],
  ['config-equipe', '/config?secao=profissionais'],
  ['config-locais', '/config?secao=locais'],
  ['config-padroes', '/config?secao=padroes'],
  ['config-vocabulario', '/config?secao=vocabulario'],
  ['config-funcionamento', '/config?secao=funcionamento'],
  ['config-usuarios', '/config?secao=usuarios'],
]

const nav = await chromium.launch()
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } })

await pag.goto(`${BASE}/entrar`)
await pag.screenshot({ path: `${saida}/entrar.png` })

await pag.getByLabel('E-mail').fill(EMAIL)
await pag.getByLabel('Senha').fill(SENHA)
await pag.getByRole('button', { name: 'Entrar' }).click()
await pag.waitForURL((u) => !u.pathname.startsWith('/entrar'))
console.log('entrou como', EMAIL)

for (const [nome, rota] of ROTAS) {
  await pag.goto(`${BASE}${rota}`)
  await pag.waitForLoadState('networkidle')
  await pag.screenshot({ path: `${saida}/${nome}.png`, fullPage: true })
  console.log('ok', nome)
}

// a sessão precisa de um id real: pega o primeiro link que a agenda do dia der
await pag.goto(`${BASE}/hoje`)
const link = pag.locator('a[href^="/sessao/"]').first()
if (await link.count()) {
  await link.click()
  await pag.waitForLoadState('networkidle')
  await pag.screenshot({ path: `${saida}/sessao.png`, fullPage: true })
  console.log('ok sessao')
}

await pag.goto(`${BASE}/pessoas`)
const ficha = pag.locator('a[href^="/pessoas/"]').first()
if (await ficha.count()) {
  await ficha.click()
  await pag.waitForLoadState('networkidle')
  await pag.screenshot({ path: `${saida}/ficha.png`, fullPage: true })
  console.log('ok ficha')
}

await nav.close()
console.log('\ncapturas em', saida)
