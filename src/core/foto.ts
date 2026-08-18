/**
 * As regras de foto, num lugar só.
 *
 * Antes eram três números diferentes para a mesma coisa: o campo recusava
 * acima de 2 MB, a ação do servidor acima de 5 MB, a dica na tela dizia 5 MB,
 * e o Next cortava em 1 MB antes de qualquer um deles opinar. O resultado é o
 * pior tipo de defeito: a tela aceita a foto, promete que cabe, e o envio
 * morre com erro que não explica nada.
 *
 * Agora o número é um, e mora aqui. Quem valida no navegador e quem valida no
 * servidor leem a mesma linha.
 */

export const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp']

/**
 * O que a pessoa pode escolher. É o tamanho do arquivo que sai do celular,
 * antes de qualquer coisa que o sistema faça com ele.
 */
export const LIMITE_FOTO_MB = 10

/**
 * O que chega ao servidor, depois de comprimir. Foto de avaliação sobe em
 * grupo de até seis num envio só, então o que importa não é uma foto caber, é
 * a soma caber: seis a 2 MB ainda passariam do teto da requisição.
 *
 * Na prática a compressão entrega entre 200 e 500 KB, e este número é folga,
 * não meta.
 */
export const LIMITE_ENVIO_MB = 2

/**
 * Quanto a foto é reduzida antes de subir.
 *
 * 1600px no lado maior é mais do que qualquer tela do sistema mostra: a maior
 * é o visor da comparação, e mesmo em monitor grande ela não passa de 800px de
 * largura por foto. Guardar 4000px é pagar banda e espaço para exibir 800.
 *
 * A qualidade em 0,82 é o ponto em que o JPEG deixa de encolher sem começar a
 * sujar contorno, que é justamente o que se olha numa foto de postura.
 */
export const LADO_MAIOR = 1600
export const QUALIDADE = 0.82

export const MB = 1024 * 1024

/** O que está errado com o arquivo escolhido, ou `null` quando serve. */
export function erroDaFoto(arquivo: { type: string; size: number }): string | null {
  if (!TIPOS_DE_FOTO.includes(arquivo.type)) {
    return 'A foto precisa ser JPEG, PNG ou WEBP.'
  }
  if (arquivo.size > LIMITE_FOTO_MB * MB) {
    const tem = (arquivo.size / MB).toFixed(1).replace('.', ',')
    return `Esta foto tem ${tem} MB, e o limite é ${LIMITE_FOTO_MB} MB. Escolha outra, ou reduza o tamanho antes de enviar.`
  }
  return null
}
