import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

export default function Carregando() {
  return <EsqueletoTela tituloLargura={'170px'} blocos={[{ tipo: 'cards', quantos: 4 }, { tipo: 'tabela', itens: 3 }]} />
}
