import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** O cabeçalho da pessoa e o histórico. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'240px'} blocos={[{ tipo: 'ficha' }, { tipo: 'tabela', itens: 4 }]} />
}
