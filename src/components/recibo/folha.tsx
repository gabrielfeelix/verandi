import { emReais } from '@/core/planos/plano'
import {
  dataPorExtenso, documentoComRotulo, documentoFormatado, localDeEmissao, motivoDoRecibo, numeroFormatado, planoEPeriodo,
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
 * aqui: a palavra RECIBO em destaque, o valor em algarismos na sua casa, o
 * mesmo valor por extenso, o local e a data de emissão, e a linha de
 * assinatura com o nome de quem recebeu embaixo. Os campos seguem o talão que
 * o estúdio já usava, e a frase de quitação embaixo é o que faz dele um recibo.
 */
export function FolhaDoRecibo({
  serie, numero, versao, status, corpo, motivo, assinatura, logo,
}: {
  serie: string
  numero: number
  versao: number
  status: 'valido' | 'cancelado' | 'substituido'
  corpo: CorpoDoRecibo
  motivo: string | null
  /** a imagem da assinatura, quando o estúdio configurou uma */
  assinatura?: string | null
  /** o logo do estúdio, no canto do cabeçalho como no talão de papel */
  logo?: string | null
}) {
  return (
    <div data-folha className="flex flex-col gap-5">
      <Via
        serie={serie} numero={numero} versao={versao} status={status}
        corpo={corpo} motivo={motivo} assinatura={assinatura} logo={logo}
        via="1ª via"
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
        corpo={corpo} motivo={motivo} assinatura={assinatura} logo={logo}
        via="2ª via"
      />
    </div>
  )
}

function Via({
  serie, numero, versao, status, corpo, motivo, via, assinatura, logo,
}: {
  serie: string
  numero: number
  versao: number
  status: 'valido' | 'cancelado' | 'substituido'
  corpo: CorpoDoRecibo
  motivo: string | null
  via: string
  assinatura?: string | null
  logo?: string | null
}) {
  const local = localDeEmissao(corpo.emitenteEndereco)
  const emitiu = quemEmitiu(corpo.emitidoPor)
  const documentoEmitente = documentoComRotulo(corpo.emitenteDocumento)
  const assina = quemAssina(corpo)

  const pp = planoEPeriodo(corpo.referente)
  const comp = corpo.composicao && corpo.composicao.descontoCent > 0 ? corpo.composicao : null
  const observacoes = [
    comp
      ? `Valor do plano ${emReais(comp.valorDoPlanoCent)}, com desconto de ${emReais(comp.descontoCent)}${
          comp.descontoMotivo ? `: ${comp.descontoMotivo}` : ''}.`
      : null,
    corpo.observacoes?.trim() || null,
  ].filter(Boolean).join(' ')

  return (
    <article
      data-via
      className="relative overflow-hidden border border-linha bg-superficie px-6 py-5 print:py-4"
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

      {/* quem emitiu à esquerda e qual papel é este à direita: o nome do
          estúdio e a palavra RECIBO são o que se lê de longe */}
      <header className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-14 shrink-0 object-contain" />
        ) : null}
        <div className="min-w-[180px] flex-1">
          <h2 className="font-titulo text-[15.5px] leading-[1.25] font-semibold text-balance">
            {corpo.emitenteNome}
          </h2>
          <p className="flex flex-wrap gap-x-4 pt-0.5 text-[11.5px] leading-[1.5] text-tinta-media">
            {documentoEmitente ? <span>{documentoEmitente}</span> : null}
            {corpo.emitenteTelefone ? <span>{exibirTelefone(corpo.emitenteTelefone)}</span> : null}
          </p>
          {corpo.emitenteEndereco ? (
            <p className="text-[11.5px] leading-[1.5] text-tinta-media">{corpo.emitenteEndereco}</p>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-baseline justify-between gap-x-3 border-t border-linha pt-3 sm:block sm:w-auto sm:shrink-0 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4 sm:text-right">
          <h3 className="font-titulo text-[20px] leading-none font-semibold tracking-[.2em] uppercase">
            Recibo
          </h3>
          <p className="font-mono text-[13px] font-medium whitespace-nowrap tabular-nums sm:pt-1.5">
            nº {numeroFormatado(serie, numero)}
          </p>
          <p className="basis-full text-[11.5px] text-tinta-media">
            {via}{versao > 1 ? `, correção ${versao}` : ''}
          </p>
        </div>
      </header>

      {/*
        * Os campos do talão de papel, numa grade só.
        *
        * É o formato que o estúdio usava (MGM, 14/out/2026): quem pagou, qual
        * plano, qual período, quanto e como, cada um na sua casa, achados de
        * relance.
        */}
      <div className="relative mt-4 flex flex-col gap-px overflow-hidden border border-linha bg-linha print:mt-3.5">
        <Fila>
          <Casa rotulo="Aluno" cresce>
            <span className="font-semibold">{corpo.pagadorNome}</span>
          </Casa>
          {corpo.pagadorDocumento ? (
            <Casa rotulo="CPF">{documentoFormatado(corpo.pagadorDocumento)}</Casa>
          ) : null}
          {corpo.pagadorMatricula ? (
            <Casa rotulo="Matrícula">{corpo.pagadorMatricula}</Casa>
          ) : null}
        </Fila>
        {corpo.pagadorEndereco ? (
          <Fila>
            <Casa rotulo="Endereço" cresce>{corpo.pagadorEndereco}</Casa>
          </Fila>
        ) : null}

        <Fila>
          {pp ? (
            <>
              <Casa rotulo="Plano" cresce>{pp.plano}</Casa>
              <Casa rotulo="Período">{pp.periodo}</Casa>
            </>
          ) : (
            <Casa rotulo="Referente a" cresce>{corpo.referente}</Casa>
          )}
        </Fila>

        <Fila>
          <Casa rotulo="Valor">
            <span className="font-medium">{emReais(corpo.valorCent)}</span>
          </Casa>
          <Casa rotulo="Pagamento" cresce>{corpo.forma}</Casa>
          <Casa rotulo="Pago em">{dataCurtaBr(corpo.recebidoEm)}</Casa>
        </Fila>

        {observacoes ? (
          <Fila>
            <Casa rotulo="Observações" cresce>{observacoes}</Casa>
          </Fila>
        ) : null}
      </div>

      {/* a quitação em uma frase: é ela que faz do papel um recibo (valor,
          de quem, e o "damos quitação"), e os campos acima dizem o resto */}
      <p className="relative pt-3 text-[13px] leading-[1.55]">
        Recebemos de <strong className="font-semibold">{corpo.pagadorNome}</strong> a
        importância de {emReais(corpo.valorCent)} ({corpo.valorPorExtenso}),
        referente ao descrito acima, e damos quitação.
      </p>

      {/*
        * Local e data de emissão, por extenso, à esquerda da assinatura.
        *
        * É um dos elementos que se espera de um recibo, e sem ele o papel não
        * diz onde a quitação aconteceu. A cidade sai do endereço do emitente
        * quando dá para ter certeza, e some quando não dá: data sozinha é uma
        * lacuna, cidade errada é uma afirmação falsa.
        *
        * Na mesma linha da assinatura, como no talão. O respiro de cima a põe
        * na altura do traço.
        *
        * A assinatura leva o nome e o documento embaixo da linha: é quem
        * recebeu que assina, e a linha anônima não diz de quem é o traço. Com
        * imagem configurada ela aparece em cima da linha, que é onde a caneta
        * cairia; sem imagem, o espaço fica em branco para assinar à mão.
        */}
      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-2 pt-1">
        <div className="pt-[26px] print:pt-[18px]">
          <p className="text-[13px]">
            {local ? `${local}, ` : ''}
            {dataPorExtenso(corpo.emitidoEm.slice(0, 10))}.
          </p>
          {emitiu ? <p className="pt-1 text-[11.5px] text-tinta-media">Emitido por {emitiu}.</p> : null}
        </div>
        <div className="ml-auto min-w-[260px]">
          <div className="flex h-[46px] items-end justify-center print:h-[36px]">
            {assinatura ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assinatura}
                alt={`Assinatura de ${assina.nome}`}
                className="max-h-[46px] max-w-[240px] object-contain print:max-h-[36px]"
              />
            ) : null}
          </div>
          <div className="border-t border-tinta-media pt-1.5 text-center">
            <p className="text-[13px] font-medium">{assina.nome}</p>
            {assina.cargo ? (
              <p className="text-[11.5px] text-tinta-media">{assina.cargo}</p>
            ) : null}
            {documentoEmitente ? (
              <p className="text-[11.5px] text-tinta-media">{documentoEmitente}</p>
            ) : null}
          </div>
        </div>
      </div>

      {motivo || status !== 'valido' ? (
        <footer className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pt-3 print:flex-nowrap print:pt-2">
          <p className="max-w-[440px] text-[11.5px] leading-[1.5] text-tinta-media print:max-w-none print:flex-1">
            {motivo ? <>{motivoDoRecibo(status, motivo)}.</> : null}
          </p>
          {status !== 'valido' ? (
            <p className="shrink-0 bg-alerta-fundo px-2.5 py-[5px] text-[12px] font-medium text-alerta">
              {status === 'cancelado' ? 'Cancelado' : 'Substituído'}
            </p>
          ) : null}
        </footer>
      ) : null}
    </article>
  )
}

/**
 * As casas do talão. As divisas não são borda de ninguém: o quadro tem fundo da
 * cor da linha e 1px de vão entre filas e entre casas, e cada casa cobre o seu
 * pedaço com o fundo do papel. Assim a divisa sai certa em qualquer arranjo,
 * inclusive empilhado no celular.
 *
 * Em cada fila uma casa cresce (o nome, o plano, a forma) e as outras têm a
 * largura do que dizem: com colunas iguais, o CPF quebrava em duas linhas e o
 * valor saía cortado.
 */
function Fila({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-px sm:flex-row">{children}</div>
}

function Casa({
  rotulo, cresce = false, children,
}: {
  rotulo: string
  cresce?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex items-baseline gap-1.5 px-2.5 py-[7px] ${
        cresce ? 'min-w-0 sm:flex-1' : 'sm:shrink-0 sm:whitespace-nowrap'
      } bg-superficie`}
    >
      <span className="shrink-0 text-[11.5px] text-tinta-media">{rotulo}</span>
      <span className="min-w-0 text-[13.5px] leading-snug tabular-nums print:text-[13px]">{children}</span>
    </div>
  )
}

function dataCurtaBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso
}
