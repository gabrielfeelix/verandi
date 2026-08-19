import { EsqueletoTela } from '@/components/ui/esqueleto-tela'

/**
 * A folha, enquanto ela não chega.
 *
 * Sem este arquivo, quem clicava em "Ver e imprimir" via o esqueleto da
 * **lista**: seis linhas de tabela desenhadas onde vai aparecer um documento em
 * duas vias. Espera com a forma errada é pior que espera sem forma nenhuma,
 * porque ela promete uma tela que não vem.
 */
export default function Carregando() {
  return (
    <EsqueletoTela
      tituloLargura={'120px'}
      blocos={[{ tipo: 'destaque' }, { tipo: 'destaque' }]}
    />
  )
}
