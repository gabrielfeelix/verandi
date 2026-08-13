import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/** As séries vigentes e as encerradas. */
export default function Carregando() {
  return <EsqueletoTela tituloLargura={'220px'} blocos={[{ tipo: 'tabela', itens: 4 }, { tipo: 'tabela', itens: 3 }]} />
}
