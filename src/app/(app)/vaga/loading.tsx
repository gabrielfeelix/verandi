import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** Os filtros à esquerda e os horários livres à direita. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'240px'} blocos={[{ tipo: 'lateral', itens: 3 }]} />
}
