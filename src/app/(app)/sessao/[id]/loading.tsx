import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** O cabeçalho da turma e a lista de chamada. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'260px'} blocos={[{ tipo: 'destaque' }, { tipo: 'tabela', itens: 4 }]} />
}
