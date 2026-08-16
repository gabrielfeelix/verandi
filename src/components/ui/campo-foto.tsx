'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Icone } from './icones'

/**
 * A área de foto: arrasta, ou clica e escolhe.
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
  nome = 'foto', atual, alt, aoRemover, dica = 'JPEG, PNG ou WEBP, até 2 MB',
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
  const campo = useRef<HTMLInputElement>(null)
  const id = useId()

  // a prévia é um endereço de memória; sem devolver, cada troca de foto deixa
  // o arquivo inteiro pendurado no navegador
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  function receber(arquivo: File | undefined) {
    if (!arquivo) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      return setErro('A foto precisa ser JPEG, PNG ou WEBP.')
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      return setErro('A foto precisa ter até 2 MB.')
    }
    setErro(null)
    setPrevia((velha) => { if (velha) URL.revokeObjectURL(velha); return URL.createObjectURL(arquivo) })
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
    <div className="flex flex-col gap-2">
      <input
        ref={campo}
        id={id}
        name={nome}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => receber(e.target.files?.[0])}
        className="sr-only"
      />

      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
        onDragLeave={() => setSobre(false)}
        onDrop={soltou}
        className={`flex cursor-pointer items-center gap-3.5 rounded-grande border border-dashed p-3.5 transition-colors duration-150 ${
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
          <span className="text-[13.5px] font-medium">
            {mostra ? 'Trocar a foto' : 'Arraste a foto aqui, ou clique para escolher'}
          </span>
          <span className="text-[12px] text-tinta-fraca">{dica}</span>
        </span>
      </label>

      {erro ? <span className="text-[12px] text-alerta">{erro}</span> : null}

      {(previa || atual) ? (
        <div className="flex gap-3">
          {previa ? (
            <button
              type="button"
              onClick={() => {
                if (campo.current) campo.current.value = ''
                setPrevia((v) => { if (v) URL.revokeObjectURL(v); return null })
              }}
              className="cursor-pointer text-[12.5px] text-tinta-media underline underline-offset-2 hover:text-tinta"
            >
              Desfazer a escolha
            </button>
          ) : null}
          {atual && aoRemover ? (
            <button
              type="button"
              onClick={aoRemover}
              className="cursor-pointer text-[12.5px] text-alerta underline underline-offset-2"
            >
              Remover a foto salva
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
