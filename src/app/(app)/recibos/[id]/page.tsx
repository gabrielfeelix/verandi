import { notFound, redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { reciboPorId, ultimosEnvios } from '@/server/recibo/consultas'
import { emitenteDaConta, urlDaAssinatura } from '@/server/config/consultas'
import { EnviarRecibo } from '@/components/recibo/enviar'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { descricaoDoRecibo } from '@/core/recibo/recibo'
import { dataCurta } from '@/core/agenda/datas'
import { FolhaDoRecibo } from '@/components/recibo/folha'
import { BotaoImprimir } from '@/components/ui/imprimir'
import { Voltar } from '@/components/ui/voltar'

/**
 * A folha, para ver e imprimir.
 *
 * A segunda via é esta mesma tela: nada é recalculado, então imprimir hoje ou
 * daqui a três anos dá o mesmo papel. O que sai da folha está em `@media
 * print`, no `globals.css`, e o resto da tela some.
 */
export default async function Recibo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conta = await exigirConta()
  if (conta.papel === 'profissional') redirect('/hoje')

  const db = await clienteServidor()
  const recibo = await reciboPorId(db, conta.contaId, id)
  if (!recibo) notFound()

  const emitente = await emitenteDaConta(db, conta.contaId)
  const [assinatura, envios, email] = await Promise.all([
    urlDaAssinatura(db, emitente.assinaturaPath),
    ultimosEnvios(db, conta.contaId, [recibo.id]),
    emailDaPessoa(db, conta.contaId, recibo.pessoaId),
  ])
  const enviado = envios.get(recibo.id) ?? null

  return (
    <ProvedorDeAviso>
    <div className="flex flex-col gap-4">
      <header
        data-imprimir="fora"
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <Voltar rotulo="Recibos" />
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Recibo
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            duas vias na mesma folha: uma fica com quem pagou, a outra com o
            estúdio
          </p>
        </div>
        {/*
          * Imprimir não é a única saída, e para a maioria dos alunos não é nem
          * a provável: o estúdio recebe no pix e o aluno pede o comprovante sem
          * chegar perto de uma impressora. Salvar em PDF é a própria impressão,
          * pela caixa de diálogo do navegador, e por isso a dica está escrita
          * ao lado em vez de virar um terceiro botão que faria a mesma coisa.
          */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap gap-2">
            <EnviarRecibo
              reciboId={recibo.id}
              numero={descricaoDoRecibo(recibo)}
              paraSugerido={email}
              jaEnviado={enviado
                ? { para: enviado.para, em: dataCurta(enviado.em.slice(0, 10)) }
                : null}
            />
            <BotaoImprimir rotulo="Imprimir" />
          </div>
          <p className="text-[11.5px] text-tinta-fraca">
            para salvar em PDF, use Imprimir e escolha &quot;Salvar como PDF&quot;
          </p>
        </div>
      </header>

      <FolhaDoRecibo
        serie={recibo.serie}
        numero={recibo.numero}
        versao={recibo.versao}
        status={recibo.status}
        corpo={recibo.corpo}
        motivo={recibo.motivo}
        assinatura={assinatura}
      />

      {enviado ? (
        <p data-imprimir="fora" className="text-[12px] text-tinta-media">
          Enviado por e-mail para {enviado.para} em{' '}
          {dataCurta(enviado.em.slice(0, 10))}.
        </p>
      ) : null}
    </div>
    </ProvedorDeAviso>
  )
}

/** O e-mail da ficha, que é o destino que o modal já sugere. */
async function emailDaPessoa(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string, pessoaId: string | null,
): Promise<string | null> {
  if (!pessoaId) return null
  const { data } = await db.from('pessoa')
    .select('email').eq('id', pessoaId).eq('conta_id', contaId).maybeSingle()
  return data?.email ?? null
}
