import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** A lista, sem fileira de números — esta tela não tem. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'190px'} blocos={[{ tipo: 'tabela', itens: 7 }]} />
}
