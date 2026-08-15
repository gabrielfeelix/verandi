import { createHash } from 'node:crypto'
import { clienteAdmin } from './supabase'
import { envia } from './email/brevo'
import { montaAlerta } from '@/core/email/alerta'
import { SILENCIO_MINUTOS, assinaturaDoErro } from '@/core/alerta/assinatura'

/**
 * O aviso de que a Verandi quebrou.
 *
 * Não é Sentry, e isso é decisão. Sentry resolveria melhor e cobra uma conta, um
 * cadastro e um DSN que alguém precisa criar; enquanto isso, o produto fica sem
 * nada. O que existe aqui usa o que já está de pé, que é o Brevo, e responde à
 * única pergunta que importa hoje: **alguém fica sabendo antes do cliente?**
 *
 * Trocar por Sentry depois é substituir esta função, não reescrever o produto:
 * quem chama são dois lugares.
 *
 * **Nunca lança.** Um monitoramento que derruba a requisição que ele deveria
 * observar transforma um erro em dois.
 */

/** Para onde o alerta vai. Sem isto configurado, ele só vai para o log. */
const PARA = process.env.ALERTA_EMAIL ?? 'contato@4yu.com.br'

function ambiente(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'desconhecido'
}

export async function avisarErro(onde: string, erro: unknown): Promise<void> {
  try {
    const mensagem = erro instanceof Error
      ? `${erro.name}: ${erro.message}`
      : String(erro)

    /*
     * Em desenvolvimento o alerta não sai. Quem está com o terminal aberto já
     * viu o erro, e mandar e-mail a cada `throw` de teste é o jeito mais rápido
     * de ensinar todo mundo a filtrar o remetente.
     */
    if (ambiente() !== 'production') return

    const assinatura = createHash('sha256')
      .update(assinaturaDoErro(onde, mensagem))
      .digest('hex')

    const db = clienteAdmin()
    const agora = new Date()

    const { data: ja } = await db.from('alerta_enviado')
      .select('ocorrencias, primeiro_em, avisado_em')
      .eq('assinatura', assinatura)
      .maybeSingle()

    if (!ja) {
      await db.from('alerta_enviado').insert({
        assinatura, resumo: `${onde}: ${mensagem}`.slice(0, 500),
      })
      await mandar(onde, mensagem, 1, agora.toISOString())
      return
    }

    const ocorrencias = ja.ocorrencias + 1
    const calado = Date.now() - Date.parse(ja.avisado_em) < SILENCIO_MINUTOS * 60_000

    await db.from('alerta_enviado').update({
      ocorrencias,
      ultimo_em: agora.toISOString(),
      ...(calado ? {} : { avisado_em: agora.toISOString() }),
    }).eq('assinatura', assinatura)

    /*
     * Dentro da janela, só conta. O próximo e-mail é que dirá quantas vezes
     * aconteceu enquanto ninguém estava olhando, que é a informação que muda a
     * decisão de levantar da mesa.
     */
    if (calado) return

    await mandar(onde, mensagem, ocorrencias, ja.primeiro_em)
  } catch (e) {
    console.error('[alerta] não consegui avisar sobre o erro', e)
  }
}

async function mandar(
  onde: string, mensagem: string, ocorrencias: number, primeiroEm: string,
): Promise<void> {
  const e = montaAlerta({ onde, mensagem, ocorrencias, primeiroEm, ambiente: ambiente() })
  await envia({
    para: PARA,
    de: 'Verandi',
    assunto: e.assunto,
    html: e.html,
    texto: e.texto,
  })
}
