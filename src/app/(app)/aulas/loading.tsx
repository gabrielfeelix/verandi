import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** A tabela de aulas por profissional. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'240px'} blocos={[{ tipo: 'tabela', itens: 5 }]} />
}
