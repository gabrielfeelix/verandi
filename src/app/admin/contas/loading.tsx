import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

export default function Carregando() {
  return <EsqueletoTela tituloLargura={'170px'} blocos={[{ tipo: 'tabela', itens: 5 }]} />
}
