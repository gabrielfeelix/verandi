import { LADO_MAIOR, QUALIDADE, LIMITE_ENVIO_MB, MB } from '@/core/foto'

/**
 * Encolher a foto no navegador, antes de enviar.
 *
 * Foto de celular hoje sai com 3 a 12 MB e 4000px de lado. O sistema mostra
 * essa foto num quadro de 800px, e manda até seis num envio só. Subir o
 * original é pagar banda de 30 MB para exibir o equivalente a 2, e é o que
 * fazia o envio morrer no teto da requisição sem dizer por quê.
 *
 * Comprimir aqui, e não no servidor, é o que resolve o problema de verdade: o
 * servidor só recebe o arquivo depois que ele já atravessou a rede, e é
 * justamente a travessia que estava falhando.
 *
 * O EXIF some no caminho, e isso é de propósito: foto de celular carrega
 * localização, e essas fotos são de corpo de cliente.
 */
export async function comprimirFoto(arquivo: File): Promise<File> {
  const bitmap = await createImageBitmap(arquivo)
  try {
    const escala = Math.min(1, LADO_MAIOR / Math.max(bitmap.width, bitmap.height))
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura
    const pincel = tela.getContext('2d')
    if (!pincel) return arquivo
    pincel.drawImage(bitmap, 0, 0, largura, altura)

    const bloco = await new Promise<Blob | null>((pronto) =>
      tela.toBlob(pronto, 'image/jpeg', QUALIDADE))

    // se o navegador não entregou, ou se comprimir engordou o arquivo (que
    // acontece com PNG pequeno e chapado), vale mais o original
    if (!bloco || bloco.size >= arquivo.size) return arquivo

    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([bloco], nome, { type: 'image/jpeg', lastModified: arquivo.lastModified })
  } finally {
    bitmap.close()
  }
}

/** O arquivo comprimido ainda passa do que a requisição aguenta? */
export const grandeDemaisParaEnviar = (arquivo: File): boolean =>
  arquivo.size > LIMITE_ENVIO_MB * MB
