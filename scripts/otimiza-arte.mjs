/**
 * Prepara a arte das telas de acesso para o produto.
 *
 * A fonte é PNG de 1 MB com fundo transparente. Servir isso é servir um segundo
 * de tela vazia no primeiro contato com o produto — a arte tem de estar lá
 * quando a página pinta, não depois.
 *
 * O que este script faz: reduz para o dobro do tamanho em que a arte aparece e
 * grava em WebP. O ganho é de ~20x.
 *
 * **Não recorta o transparente.** As quatro artes vêm na mesma moldura de
 * 1448×1086, e o protótipo posiciona cada uma por porcentagem dessa moldura.
 * Recortar economiza uns poucos KB (transparente comprime a quase nada) e em
 * troca desalinha as quatro entre si — cada uma passaria a precisar do seu
 * ajuste à mão, que é exatamente o tipo de número que ninguém revisa depois.
 *
 *   node scripts/otimiza-arte.mjs
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const ORIGEM = 'Design system Verandi-att/assets'
const DESTINO = 'public/acesso'

/*
 * O painel escuro tem ~467px de largura e a arte ocupa até 108% dele: 880px
 * cobre tela retina com folga.
 *
 * Acima disso o arquivo cresce sem aparecer — 1010px custa 30% a mais de bytes
 * para pixels que nenhuma tela mostra. Abaixo de 74 de qualidade o degradê do
 * 3D começa a fazer faixa, e o ganho é de 3 KB.
 */
const LARGURA = 880
const QUALIDADE = 74

const arquivos = (await readdir(ORIGEM)).filter((n) => n.endsWith('.png'))
await mkdir(DESTINO, { recursive: true })

const linhas = []
for (const nome of arquivos) {
  const base = nome.replace(/\.png$/, '')
  const entrada = sharp(join(ORIGEM, nome))
  const antes = (await entrada.metadata()).size ?? 0

  const webp = await entrada
    .clone()
    .resize({ width: LARGURA, withoutEnlargement: true })
    .webp({ quality: QUALIDADE, effort: 6 })
    .toBuffer()

  const saida = join(DESTINO, `${base}.webp`)
  await writeFile(saida, webp)

  const meta = await sharp(webp).metadata()
  linhas.push(
    `${base.padEnd(18)} ${String(Math.round(antes / 1024)).padStart(5)} KB → ` +
      `${String(Math.round(webp.length / 1024)).padStart(4)} KB  ${meta.width}×${meta.height}`,
  )
}

console.log(linhas.join('\n'))
