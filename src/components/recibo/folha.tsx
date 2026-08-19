import { emReais } from '@/core/planos/plano'
import {
  documentoFormatado, numeroFormatado, type CorpoDoRecibo,
} from '@/core/recibo/recibo'
import { dataCurta } from '@/core/agenda/datas'

/**
 * A folha do recibo, em duas vias.
 *
 * Tudo que ela mostra vem do `corpo` congelado, e nada é consultado: a segunda
 * via de um recibo de 2023 sai igual ao papel que está na pasta, mesmo depois de
 * a pessoa mudar de endereço e de o plano mudar de preço.
 *
 * Duas vias na mesma folha, com a linha de corte no meio, porque é assim que o
 * talão funciona: uma fica com quem pagou e a outra com o estúdio.
 */
export function FolhaDoRecibo({
  serie, numero, versao, status, corpo, motivo,
}: {
  serie: string
  numero: number
  versao: number
  status: 'valido' | 'cancelado' | 'substituido'
  corpo: CorpoDoRecibo
  motivo: string | null
}) {
  return (
    <div data-folha className="flex flex-col gap-6">
      <Via
        serie={serie} numero={numero} versao={versao} status={status}
        corpo={corpo} motivo={motivo} via="via de quem pagou"
      />
      <div
        aria-hidden
        className="border-t border-dashed border-linha-tracejada text-center text-[10px] text-tinta-fraca"
      >
        corte aqui
      </div>
      <Via
        serie={serie} numero={numero} versao={versao} status={status}
        corpo={corpo} motivo={motivo} via="via do estúdio"
      />
    </div>
  )
}

function Via({
  serie, numero, versao, status, corpo, motivo, via,
}: {
  serie: string
  numero: number
  versao: number
  status: 'valido' | 'cancelado' | 'substituido'
  corpo: CorpoDoRecibo
  motivo: string | null
  via: string
}) {
  return (
    <article
      data-via
      className="relative rounded-cartao border border-linha bg-superficie p-6"
    >
      {/*
        * O carimbo de cancelado atravessa a folha. Um recibo cancelado
        * impresso e confundido com um válido é o defeito mais caro que esta
        * tela permite, e etiqueta discreta no canto não impede isso.
        */}
      {status !== 'valido' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[54px] font-bold tracking-[.1em] text-alerta opacity-20"
          style={{ transform: 'rotate(-14deg)' }}
        >
          {status === 'cancelado' ? 'CANCELADO' : 'SUBSTITUÍDO'}
        </span>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-linha-fina pb-4">
        <div>
          <h2 className="font-titulo text-[19px] font-semibold">
            {corpo.emitenteNome}
          </h2>
          <p className="text-[12px] text-tinta-media">
            {corpo.emitenteDocumento
              ? `CNPJ/CPF ${documentoFormatado(corpo.emitenteDocumento)}` : null}
            {corpo.emitenteEndereco ? ` · ${corpo.emitenteEndereco}` : null}
            {corpo.emitenteTelefone ? ` · ${corpo.emitenteTelefone}` : null}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[15px] font-medium">
            {numeroFormatado(serie, numero)}
          </p>
          <p className="text-[11.5px] text-tinta-media">
            recibo{versao > 1 ? ` · correção ${versao}` : ''} · {via}
          </p>
        </div>
      </header>

      <p className="pt-5 text-[15px] leading-[1.7]">
        Recebemos de <strong>{corpo.pagadorNome}</strong>
        {corpo.pagadorDocumento
          ? <>, CPF {documentoFormatado(corpo.pagadorDocumento)}</> : null}
        {corpo.pagadorMatricula ? <>, matrícula nº {corpo.pagadorMatricula}</> : null}
        {corpo.pagadorEndereco ? <>, {corpo.pagadorEndereco}</> : null}
        {' '}a importância de <strong>{emReais(corpo.valorCent)}</strong>{' '}
        ({corpo.valorPorExtenso}), referente a {corpo.referente}, pagos em{' '}
        {corpo.forma} no dia {dataCurta(corpo.recebidoEm)}.
      </p>

      <footer className="flex flex-wrap items-end justify-between gap-4 pt-8">
        <p className="text-[11.5px] text-tinta-media">
          Emitido por {corpo.emitidoPor} em{' '}
          {dataCurta(corpo.emitidoEm.slice(0, 10))}.
          {motivo ? <> Observação: {motivo}.</> : null}
          <br />
          Este documento é um recibo, e não uma nota fiscal.
        </p>
        <div className="min-w-[220px] border-t border-tinta-media pt-1 text-center text-[11.5px] text-tinta-media">
          assinatura
        </div>
      </footer>
    </article>
  )
}
