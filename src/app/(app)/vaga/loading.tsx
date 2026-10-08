import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/**
 * A vaga, enquanto ela não chega: navegação estreita à esquerda e o conteúdo à
 * direita, a mesma forma da tela, para nada saltar de lado quando o dado vem.
 */
export default function Carregando() {
  return <EsqueletoTela tituloLargura="180px" blocos={[{ tipo: 'lateral', itens: 5 }]} />
}
