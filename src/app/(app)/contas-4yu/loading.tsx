import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** A lista de contas. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'170px'} blocos={[{ tipo: 'tabela', itens: 5 }]} />
}
