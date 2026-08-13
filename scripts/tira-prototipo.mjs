/**
 * Renderiza o protótipo e salva uma captura de cada tela.
 *
 * O protótipo em `Design system Verandi/` é a especificação de interface. Ler o
 * código-fonte dele não substitui olhar a tela renderizada — foi exatamente esse
 * atalho que produziu telas "com os tokens certos" e nenhuma semelhança com o
 * produto desenhado.
 *
 *   node scripts/tira-prototipo.mjs [pasta-de-saida]
 */
import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const raiz = resolve(import.meta.dirname, '..')
const arquivo = pathToFileURL(
  resolve(raiz, 'Design system Verandi/Verandi.dc.html'),
).href
const saida = resolve(process.argv[2] ?? resolve(raiz, '.prototipo'))
mkdirSync(saida, { recursive: true })

/** Os itens do trilho, pelo rótulo curto que o protótipo mostra. */
const TELAS = ['HOJE', 'SEMANA', 'PEND.', 'ALUNOS', 'VAGA', 'FIXA', '4YU', 'CONFIG']
const SECOES_CONFIG = [
  'Serviços', 'Equipe', 'Locais', 'Padrões',
  'Vocabulário', 'Funcionamento', 'Usuários',
]

const semAcento = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

const nav = await chromium.launch()
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } })
await pag.goto(arquivo, { waitUntil: 'networkidle' })
await pag.waitForTimeout(2500)

for (const tela of TELAS) {
  await pag.locator(`text=${tela}`).first().click({ force: true })
  await pag.waitForTimeout(1200)
  await pag.screenshot({ path: `${saida}/${semAcento(tela)}.png`, fullPage: true })
  console.log('ok', semAcento(tela))

  if (tela === 'CONFIG') {
    for (const secao of SECOES_CONFIG) {
      const alvo = pag.locator(`text=${secao}`).first()
      if (!(await alvo.count())) continue
      await alvo.click({ force: true })
      await pag.waitForTimeout(800)
      await pag.screenshot({ path: `${saida}/config-${semAcento(secao)}.png` })
      console.log('ok config-' + semAcento(secao))
    }
  }
}

await nav.close()
console.log('\ncapturas em', saida)
