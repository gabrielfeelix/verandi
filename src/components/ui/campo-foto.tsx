'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Icone } from './icones'
import { erroDaFoto, LIMITE_FOTO_MB } from '@/core/foto'
import { comprimirFoto, grandeDemaisParaEnviar } from './comprimir-foto'
import { Camera, temCamera } from './camera'

/**
 * A área de foto: arrasta, clica e escolhe, ou tira na hora pela câmera.
 *
 * O `<input type="file">` cru é o único pedaço de tela que o navegador desenha
 * sozinho — "Escolher ficheiro / Nenhum ficheiro selecionado", em português de
 * Portugal, com a fonte do sistema. Fora o visual, ele não aceita arrastar, não
 * mostra o que foi escolhido, e não deixa desistir sem reabrir o seletor.
 *
 * Aqui a moldura tracejada é a zona de soltar (o `border/dashed` do design
 * system, que existe justamente para "adicionar" e "zona vazia"), a prévia
 * aparece assim que o arquivo entra, e trocar ou remover são um clique.
 *
 * O arquivo continua saindo num `<input type="file">` de verdade, escondido:
 * o `FormData` do formulário chega ao servidor igual ao que já existia.
 */
export function CampoFoto({
  nome = 'foto', atual, alt, aoRemover,
  dica = `JPEG, PNG ou WEBP, até ${LIMITE_FOTO_MB} MB`,
}: {
  nome?: string
  /** a foto já salva, quando existe */
  atual?: string | null
  alt: string
  /** quando existe, some a foto salva no servidor (não só a escolha da tela) */
  aoRemover?: () => void
  dica?: string
}) {
  const [previa, setPrevia] = useState<string | null>(null)
  const [sobre, setSobre] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [filmando, setFilmando] = useState(false)
  // só depois de montar: no servidor não há `navigator`, e decidir lá daria
  // uma tela diferente da que o navegador desenha
  const podeFilmar = useSyncExternalStore(semAssinatura, temCamera, () => false)
  const campo = useRef<HTMLInputElement>(null)
  const id = useId()

  // a prévia é um endereço de memória; sem devolver, cada troca de foto deixa
  // o arquivo inteiro pendurado no navegador
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  /** tira do input o que foi recusado: recusado que continua lá sobe junto */
  function limpar() {
    if (campo.current) campo.current.value = ''
  }

  /*
   * A foto entra, é conferida, e **é encolhida antes de virar o que o
   * formulário manda**. Sem isso, o arquivo de 8 MB do celular atravessa a
   * rede inteira para o servidor recusá-lo no fim, e a recusa chega como erro
   * sem texto porque o corte acontece antes do nosso código rodar.
   */
  async function receber(arquivo: File | undefined) {
    if (!arquivo) return
    setFilmando(false)

    const problema = erroDaFoto(arquivo)
    if (problema) { limpar(); return setErro(problema) }

    setErro(null)
    setOcupado(true)
    try {
      const pronta = await comprimirFoto(arquivo)
      if (grandeDemaisParaEnviar(pronta)) {
        limpar()
        return setErro(
          'Não foi possível reduzir esta foto o bastante para enviar. Tente outra, ou salve-a de novo pelo celular antes.',
        )
      }
      // é a comprimida que vai no formulário, não a que a pessoa escolheu
      const lista = new DataTransfer()
      lista.items.add(pronta)
      if (campo.current) campo.current.files = lista.files
      setPrevia((velha) => { if (velha) URL.revokeObjectURL(velha); return URL.createObjectURL(pronta) })
    } catch {
      // navegador sem `createImageBitmap` ou arquivo corrompido: melhor dizer
      // agora do que deixar o envio falhar depois
      limpar()
      setErro('Não foi possível ler esta foto. Tente outra.')
    } finally {
      setOcupado(false)
    }
  }

  function soltou(e: React.DragEvent) {
    e.preventDefault()
    setSobre(false)
    const arquivo = e.dataTransfer.files?.[0]
    if (!arquivo || !campo.current) return
    // o input precisa receber o arquivo de verdade: é ele que vai no formulário
    const lista = new DataTransfer()
    lista.items.add(arquivo)
    campo.current.files = lista.files
    receber(arquivo)
  }

  const mostra = previa ?? atual ?? null

  return (
    // `@container`: o lado a lado depende da largura do campo, não da tela. Na
    // avaliação são quatro fotos em duas colunas, e pela tela o campo achava
    // que tinha espaço e espremia o texto numa palavra por linha
    <div className="@container flex flex-col gap-2">
      <input
        ref={campo}
        id={id}
        name={nome}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => receber(e.target.files?.[0])}
        className="sr-only"
      />

      {filmando ? (
        <Camera aoTirar={(foto) => receber(foto)} aoFechar={() => setFilmando(false)} />
      ) : (
      <div className="flex flex-col gap-2 @[440px]:flex-row">
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
        onDragLeave={() => setSobre(false)}
        onDrop={soltou}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 rounded-grande border border-dashed p-3.5 transition-colors duration-150 ${
          sobre
            ? 'border-marca bg-positivo-superficie'
            : 'border-linha-tracejada bg-superficie-suave hover:border-marca hover:bg-superficie-mais-suave'
        }`}
      >
        {mostra ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mostra} alt={alt}
            className="size-14 shrink-0 rounded-media object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-media border border-linha-tracejada bg-superficie text-tinta-fraca"
          >
            <Icone nome="clipe" tamanho={20} />
          </span>
        )}

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14.5px] font-medium">
            {mostra ? 'Trocar a foto' : 'Arraste a foto aqui, ou clique para escolher'}
          </span>
          <span className="text-[13.5px] text-tinta-fraca">
            {ocupado ? 'Preparando a foto…' : dica}
          </span>
        </span>
      </label>

      {podeFilmar ? (
        <button
          type="button"
          onClick={() => { setErro(null); setFilmando(true) }}
          className="flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-grande border border-linha bg-superficie px-4 py-3 text-[14.5px] font-medium transition-colors duration-150 hover:border-marca hover:bg-positivo-superficie @[440px]:flex-col @[440px]:gap-1.5 @[440px]:px-5"
        >
          <IconeCamera />
          Tirar foto
        </button>
      ) : null}
      </div>
      )}

      {erro ? <span className="text-[13.5px] text-alerta">{erro}</span> : null}

      {(previa || atual) ? (
        <div className="flex gap-3">
          {previa ? (
            <button
              type="button"
              onClick={() => {
                limpar()
                setPrevia((v) => { if (v) URL.revokeObjectURL(v); return null })
              }}
              className="cursor-pointer text-[13.5px] text-tinta-media underline underline-offset-2 hover:text-tinta"
            >
              Desfazer a escolha
            </button>
          ) : null}
          {atual && aoRemover ? (
            <button
              type="button"
              onClick={aoRemover}
              className="cursor-pointer text-[13.5px] text-alerta underline underline-offset-2"
            >
              Remover a foto salva
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** a câmera não existe no vocabulário de ícones; desenhada no mesmo traço */
function IconeCamera() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-marca">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  )
}

/** a câmera não aparece nem some com a página aberta: não há o que assinar */
function semAssinatura() {
  return () => {}
}
