'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone } from './icones'

/**
 * Tirar a foto ali mesmo, pela câmera do computador ou do celular.
 *
 * Na avaliação a pessoa está na frente da câmera: salvar no celular, passar
 * para o computador e procurar o arquivo é o caminho que faz ninguém tirar
 * foto nenhuma. Aqui a imagem ao vivo abre no lugar da área de foto, o clique
 * congela o quadro, e "Usar esta foto" entrega um arquivo comum para o mesmo
 * caminho de quem escolheu do disco (conferir, encolher, enviar).
 *
 * A prévia ao vivo da câmera frontal é espelhada, porque é assim que a pessoa
 * espera se ver; a foto tirada **não**, porque numa avaliação de postura o lado
 * esquerdo precisa continuar sendo o esquerdo.
 */
export function Camera({
  aoTirar, aoFechar,
}: {
  aoTirar: (foto: File) => void
  aoFechar: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const fluxo = useRef<MediaStream | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [qual, setQual] = useState<string | null>(null)
  const [frontal, setFrontal] = useState(true)
  const [pronta, setPronta] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tirada, setTirada] = useState<{ url: string; arquivo: File } | null>(null)
  const [contagem, setContagem] = useState<number | null>(null)
  const [comTempo, setComTempo] = useState(false)

  const parar = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop())
    fluxo.current = null
  }, [])

  useEffect(() => {
    let vivo = true
    async function ligar() {
      parar()
      setPronta(false)
      setErro(null)
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: qual
            ? { deviceId: { exact: qual }, width: { ideal: 1920 }, height: { ideal: 1440 } }
            : { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return }
        fluxo.current = s
        const trilha = s.getVideoTracks()[0]
        const modo = trilha?.getSettings().facingMode
        setFrontal(modo ? modo === 'user' : true)
        if (video.current) {
          video.current.srcObject = s
          await video.current.play().catch(() => {})
        }
        // a lista só traz os nomes depois que a permissão foi dada
        const todas = await navigator.mediaDevices.enumerateDevices()
        if (vivo) setCameras(todas.filter((d) => d.kind === 'videoinput'))
        if (vivo) setPronta(true)
      } catch (e) {
        if (!vivo) return
        const nome = (e as DOMException)?.name
        setErro(
          nome === 'NotAllowedError' || nome === 'SecurityError'
            ? 'O navegador não liberou a câmera. Clique no cadeado ao lado do endereço do site, permita a câmera e tente de novo.'
            : nome === 'NotFoundError' || nome === 'OverconstrainedError'
              ? 'Nenhuma câmera encontrada neste aparelho.'
              : nome === 'NotReadableError'
                ? 'A câmera está sendo usada por outro programa, como uma chamada de vídeo. Feche-o e tente de novo.'
                : 'Não foi possível abrir a câmera.',
        )
      }
    }
    ligar()
    return () => { vivo = false; parar() }
  }, [qual, parar])

  // a foto congelada é um endereço de memória: devolve ao sair ou ao refazer
  useEffect(() => () => { if (tirada) URL.revokeObjectURL(tirada.url) }, [tirada])

  function capturar() {
    const v = video.current
    if (!v || !v.videoWidth) return
    const tela = document.createElement('canvas')
    tela.width = v.videoWidth
    tela.height = v.videoHeight
    tela.getContext('2d')?.drawImage(v, 0, 0)
    tela.toBlob((blob) => {
      if (!blob) return setErro('Não foi possível tirar a foto. Tente de novo.')
      const quando = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const arquivo = new File([blob], `foto-${quando}.jpg`, { type: 'image/jpeg' })
      setTirada({ url: URL.createObjectURL(blob), arquivo })
    }, 'image/jpeg', 0.92)
  }

  function disparar() {
    if (!comTempo) return capturar()
    let n = 3
    setContagem(n)
    const relogio = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(relogio)
        setContagem(null)
        capturar()
      } else {
        setContagem(n)
      }
    }, 1000)
  }

  function trocarCamera() {
    if (cameras.length < 2) return
    const atual = fluxo.current?.getVideoTracks()[0]?.getSettings().deviceId
    const i = cameras.findIndex((c) => c.deviceId === atual)
    setQual(cameras[(i + 1) % cameras.length].deviceId)
  }

  function usar() {
    if (!tirada) return
    parar()
    aoTirar(tirada.arquivo)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-grande bg-escuro">
        {/* o vídeo continua montado com a foto por cima: "Tirar outra" volta
            na hora, sem pedir a câmera de novo */}
        <video
          ref={video}
          muted
          playsInline
          aria-label="Imagem da câmera"
          className={`absolute inset-0 size-full object-cover ${frontal ? '-scale-x-100' : ''}`}
        />

        {tirada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tirada.url} alt="Foto tirada" className="absolute inset-0 size-full object-cover" />
        ) : null}

        {!pronta && !erro ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-tinta-clara">
            <span className="size-6 animate-spin rounded-full border-2 border-tinta-clara/30 border-t-tinta-clara" />
            <span className="text-[13.5px]">Abrindo a câmera…</span>
          </div>
        ) : null}

        {erro ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="max-w-[340px] text-center text-[14px] leading-relaxed text-tinta-clara">{erro}</p>
          </div>
        ) : null}

        {contagem !== null ? (
          <div className="absolute inset-0 flex items-center justify-center bg-escuro/25">
            <span
              key={contagem}
              className="font-titulo text-[88px] font-semibold text-white drop-shadow-lg"
              style={{ animation: 'vd-pop .5s var(--ease-pop) backwards' }}
            >
              {contagem}
            </span>
          </div>
        ) : null}

        {/* os controles de quem ainda está enquadrando, por cima da imagem */}
        {pronta && !tirada && contagem === null ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-escuro/70 to-transparent px-4 pt-10 pb-4">
            <button
              type="button"
              onClick={() => setComTempo((v) => !v)}
              aria-pressed={comTempo}
              className={`flex h-9 min-w-[64px] cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium backdrop-blur transition-colors ${
                comTempo ? 'bg-white text-escuro' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <Icone nome="relogio" tamanho={14} />
              3 s
            </button>

            <button
              type="button"
              onClick={disparar}
              aria-label="Tirar foto"
              className="group flex size-16 cursor-pointer items-center justify-center rounded-full border-[3px] border-white/90"
            >
              <span className="size-[50px] rounded-full bg-white transition-transform duration-150 group-hover:scale-95 group-active:scale-90" />
            </button>

            {cameras.length > 1 ? (
              <button
                type="button"
                onClick={trocarCamera}
                className="flex h-9 min-w-[64px] cursor-pointer items-center justify-center rounded-full bg-white/15 px-3 text-[13px] font-medium text-white backdrop-blur hover:bg-white/25"
              >
                Trocar
              </button>
            ) : (
              <span className="min-w-[64px]" aria-hidden />
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {tirada ? (
          <>
            <button
              type="button"
              onClick={() => setTirada(null)}
              className="min-h-10 cursor-pointer rounded-padrao border border-linha bg-superficie px-4 text-[14px] text-tinta-media hover:bg-superficie-mais-suave"
            >
              Tirar outra
            </button>
            <button
              type="button"
              onClick={usar}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-padrao bg-escuro px-4 text-[14px] font-medium text-tinta-clara hover:bg-escuro/90"
            >
              <Icone nome="check" tamanho={16} />
              Usar esta foto
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { parar(); aoFechar() }}
            className="min-h-10 cursor-pointer rounded-padrao border border-linha bg-superficie px-4 text-[14px] text-tinta-media hover:bg-superficie-mais-suave"
          >
            Voltar a escolher arquivo
          </button>
        )}
      </div>
    </div>
  )
}

/** Há câmera para pedir? Sem `mediaDevices` (http, navegador antigo), o botão nem aparece. */
export function temCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}
