import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** As abas e a lista de cobranças, uma linha embaixo da outra. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'200px'} blocos={[{ tipo: 'tabela', itens: 6 }]} />
}
