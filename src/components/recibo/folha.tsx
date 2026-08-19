import { emReais } from '@/core/planos/plano'
import {
  dataPorExtenso, documentoFormatado, localDeEmissao, numeroFormatado,
  quemAssina, quemEmitiu, type CorpoDoRecibo,
} from '@/core/recibo/recibo'
import { exibirTelefone } from '@/core/telefone'

/**
 * A folha do recibo, em duas vias.
 *
 * Tudo que ela mostra vem do `corpo` congelado, e nada é consultado: a segunda
 * via de um recibo de 2023 sai igual ao papel que está na pasta, mesmo depois de
 * a pessoa mudar de endereço e de o plano mudar de preço.
 *
 * Duas vias na mesma folha, com a linha de corte no meio, porque é assim que o
 * talão funciona: uma fica com quem pagou e a outra com o estúdio.
 *
 * **O desenho é o do talão de papel, e não é enfeite.** Um recibo brasileiro é
 * reconhecido por cinco coisas, e todas as cinco estavam faltando ou escondidas
 * aqui: a palavra RECIBO em destaque, o valor em algarismos numa caixa que se
 * acha de longe, o mesmo valor por extenso, o local e a data de emissão, e a
 * linha de assinatura com o nome de quem recebeu embaixo. O corpo em parágrafo
 * continua, porque é ele que diz de quem, quanto e referente a quê numa frase
 * só; o que mudou é que ele deixou de ser a única coisa na folha.
 */
export function FolhaDoRecibo({
  serie, numero, versao, status, corpo, motivo, assinatura,
}: {
  serie: string
  numero: number
  versao: number
  status: 'valido' | 'cancelado' | 'substituido'
  corpo: CorpoDoRecibo
  motivo: string | null
  /** a imagem da assinatura, quando o estúdio configurou uma */
  assinatura?: string | null
}) {
  return (
    <div data-folha className="flex flex-col gap-5">
      <Via
        serie={serie} numero={numero} versao={versao} status={status}
        corpo={corpo} motivo={motivo} assinatura={assinatura}
        via="1ª via · de quem pagou"
      />
      <div
        aria-hidden
        className="relative border-t border-dashed border-linha-tracejada"
      >
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-fundo px-2 text-[11.5px] tracking-[.14em] text-tinta-fraca uppercase">
          corte aqui
        </span>
      </div>
      <Via
        serie={serie} numero={numero} versao={versao} status={status}
        corpo={corpo} motivo={motivo} assinatura={assinatura}
        via="2ª via · do estúdio"
      />
    </div>
  )
}

function Via({
  serie, numero, versao, status, corpo, motivo, via, assinatura,
}: {
  serie: string
  numero: number
  versao: number
  status: 'valido' | 'cancelado' | 'substituido'
  corpo: CorpoDoRecibo
  motivo: string | null
  via: string
  assinatura?: string | null
}) {
  const local = localDeEmissao(corpo.emitenteEndereco)
  const emitiu = quemEmitiu(corpo.emitidoPor)
  const documentoEmitente = documentoFormatado(corpo.emitenteDocumento)
  const assina = quemAssina(corpo)

  return (
    <article
      data-via
      className="relative overflow-hidden rounded-cartao border border-linha bg-superficie px-7 py-6"
    >
      {/*
        * O carimbo de cancelado atravessa a folha. Um recibo cancelado
        * impresso e confundido com um válido é o defeito mais caro que esta
        * tela permite, e etiqueta discreta no canto não impede isso.
        *
        * A rotação mora numa camada interna, e não no elemento que ocupa a
        * folha: girar o próprio elemento posicionado empurrava o texto para
        * fora do cartão à direita, e o carimbo saía cortado justamente na
        * ponta em que se lê a palavra.
        */}
      {status !== 'valido' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span
            className="text-[clamp(38px,9vw,72px)] font-bold tracking-[.14em] whitespace-nowrap text-alerta opacity-[.16]"
            style={{ transform: 'rotate(-14deg)' }}
          >
            {status === 'cancelado' ? 'CANCELADO' : 'SUBSTITUÍDO'}
          </span>
        </span>
      ) : null}

      {/* o emitente e o valor dividem o topo: quem emitiu à esquerda, quanto
          entrou à direita, que são as duas perguntas que se faz olhando de
          longe uma pilha de recibos na mesa */}
      <header className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-[220px] flex-1">
          <h2 className="font-titulo text-[18px] leading-[1.2] font-semibold">
            {corpo.emitenteNome}
          </h2>
          <p className="pt-[3px] text-[12.5px] leading-[1.6] text-tinta-media">
            {documentoEmitente ? <>CNPJ/CPF {documentoEmitente}<br /></> : null}
            {corpo.emitenteEndereco}
            {corpo.emitenteEndereco && corpo.emitenteTelefone ? <br /> : null}
            {corpo.emitenteTelefone ? exibirTelefone(corpo.emitenteTelefone) : null}
          </p>
        </div>

        <div className="shrink-0 rounded-media border border-linha-suave bg-superficie-mais-suave px-4 py-2.5 text-right">
          <p className="text-[11.5px] tracking-[.14em] text-tinta-media uppercase">
            valor recebido
          </p>
          <p className="font-mono text-[24px] leading-[1.15] font-semibold tabular-nums">
            {emReais(corpo.valorCent)}
          </p>
        </div>
      </header>

      {/* a palavra RECIBO e o número, na faixa que separa o cabeçalho do
          corpo: é o que um recibo tem de mais reconhecível, e estava reduzido
          a uma linha de onze pixels no canto */}
      <div className="relative mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-y border-linha-fina py-2.5">
        <h3 className="font-titulo text-[20px] leading-none font-semibold tracking-[.22em] uppercase">
          Recibo
        </h3>
        <p className="text-[12.5px] text-tinta-media">
          <span className="font-mono text-[14.5px] font-medium text-tinta">
            nº {numeroFormatado(serie, numero)}
          </span>
          {versao > 1 ? ` · correção ${versao}` : ''} · {via}
        </p>
      </div>

      <p className="relative pt-4 text-[15px] leading-[1.75]">
        Recebemos de <strong>{corpo.pagadorNome}</strong>
        {corpo.pagadorDocumento
          ? <>, CPF {documentoFormatado(corpo.pagadorDocumento)}</> : null}
        {corpo.pagadorMatricula ? <>, matrícula nº {corpo.pagadorMatricula}</> : null}
        {corpo.pagadorEndereco ? <>, {corpo.pagadorEndereco}</> : null}
        {' '}a importância de <strong>{emReais(corpo.valorCent)}</strong>{' '}
        (<strong>{corpo.valorPorExtenso}</strong>), referente a{' '}
        {corpo.referente}, pagos em {corpo.forma} no dia{' '}
        {dataPorExtenso(corpo.recebidoEm)}.
      </p>

      {/*
        * Local e data de emissão, na linha própria e por extenso.
        *
        * É um dos elementos que se espera de um recibo, e sem ele o papel não
        * diz onde a quitação aconteceu. A cidade sai do endereço do emitente
        * quando dá para ter certeza, e some quando não dá: data sozinha é uma
        * lacuna, cidade errada é uma afirmação falsa.
        */}
      <p className="relative pt-5 text-[14.5px]">
        {local ? `${local}, ` : ''}
        {dataPorExtenso(corpo.emitidoEm.slice(0, 10))}.
      </p>

      {/*
        * A assinatura leva o nome e o documento embaixo da linha: é quem
        * recebeu que assina, e a linha anônima não diz de quem é o traço.
        *
        * Com imagem configurada ela aparece **em cima** da linha, que é onde a
        * caneta cairia. Sem imagem, o espaço em branco fica igual, para o papel
        * impresso continuar tendo onde assinar à mão: quem manda por e-mail
        * precisa da imagem, e quem imprime não.
        */}
      <div className="relative flex justify-end pt-9">
        <div className="min-w-[260px]">
          <div className="flex h-[52px] items-end justify-center">
            {assinatura ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assinatura}
                alt={`Assinatura de ${assina.nome}`}
                className="max-h-[52px] max-w-[240px] object-contain"
              />
            ) : null}
          </div>
          <div className="border-t border-tinta-media pt-1.5 text-center">
            <p className="text-[13.5px] font-medium">{assina.nome}</p>
            {assina.cargo ? (
              <p className="text-[12px] text-tinta-media">{assina.cargo}</p>
            ) : null}
            {documentoEmitente ? (
              <p className="text-[12px] text-tinta-media">{documentoEmitente}</p>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pt-6">
        <p className="max-w-[440px] text-[12px] leading-[1.6] text-tinta-media">
          {emitiu ? <>Emitido por {emitiu}. </> : null}
          Este documento é um recibo, e não uma nota fiscal.
          {motivo ? <> Observação: {motivo}.</> : null}
        </p>
        {status !== 'valido' ? (
          <p className="rounded-peca bg-alerta-fundo px-2.5 py-[5px] text-[12px] font-medium text-alerta">
            {status === 'cancelado' ? 'Cancelado' : 'Substituído'}
          </p>
        ) : null}
      </footer>
    </article>
  )
}
