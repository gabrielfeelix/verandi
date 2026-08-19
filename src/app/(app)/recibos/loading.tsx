import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** A lista de recibos, uma linha embaixo da outra. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'160px'} blocos={[{ tipo: 'tabela', itens: 6 }]} />
}
