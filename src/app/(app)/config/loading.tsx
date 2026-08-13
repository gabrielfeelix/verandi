import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** As sete seções à esquerda e a seção aberta à direita. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'330px'} blocos={[{ tipo: 'lateral', itens: 3 }]} />
}
