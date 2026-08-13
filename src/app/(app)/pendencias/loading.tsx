import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** Os grupos de pendência, um embaixo do outro. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'220px'} blocos={[{ tipo: 'tabela', itens: 3 }]} />
}
