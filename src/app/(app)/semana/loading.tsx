import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** A grade de sete colunas, com os buracos que toda semana tem. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'300px'} blocos={[{ tipo: 'grade' }]} />
}
