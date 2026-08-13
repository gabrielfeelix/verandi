import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** Quatro números, a próxima turma em destaque e a agenda do dia. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'230px'} blocos={[{ tipo: 'cards' }, { tipo: 'destaque' }, { tipo: 'tabela', itens: 6 }]} />
}
