'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { BotaoLinha, LinhaConfig, PainelConfig } from './casca'
import { useAviso } from '@/components/ui/desfazer'
import { criarChaveApi, revogarChaveApi } from '@/server/api/acoes'
import { ENDERECO_PUBLICO } from '@/core/legal'
import { salvarWebhook, desligarWebhook } from '@/server/webhook/acoes'
import type { AvisoDaConta } from '@/server/webhook/consultas'
import type { ChaveLinha } from '@/server/api/chave'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * A seção que lista **integrações**, e não chaves.
 *
 * A diferença importa para quem lê a tela. Ninguém abre a Configuração
 * pensando "quero emitir um token"; abre pensando "quero ligar o robô do
 * WhatsApp na minha agenda". A chave é detalhe de como isso é feito, e por isso
 * mora dentro do cartão da integração em vez de virar uma lista própria.
 *
 * O AutoFluxos vem primeiro e marcado como recomendado porque é o que a 4YU
 * opera dos dois lados: quem liga essa ponta tem quem chamar quando não
 * funcionar. É recomendação honesta, não venda cruzada disfarçada.
 */

function quando(iso: string | null): string {
  if (!iso) return 'nunca usada'
  const d = new Date(iso)
  const dias = Math.floor((Date.now() - d.getTime()) / 864e5)
  if (dias === 0) return 'usada hoje'
  if (dias === 1) return 'usada ontem'
  if (dias < 30) return `usada há ${dias} dias`
  return `usada em ${d.toLocaleDateString('pt-BR')}`
}

export function SecaoIntegracoes({
  chaves, aviso,
}: {
  chaves: ChaveLinha[]
  aviso: AvisoDaConta
}) {
  const [criando, setCriando] = useState(false)
  /** o segredo recém-criado. Existe só nesta tela e nunca volta */
  const [segredo, setSegredo] = useState<string | null>(null)
  const [aRevogar, setARevogar] = useState<ChaveLinha | null>(null)
  const [avisando, setAvisando] = useState(false)
  /** o segredo de assinatura recém-criado. Existe só nesta tela e nunca volta */
  const [segredoAviso, setSegredoAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function comErro(fn: () => Promise<void>, texto?: string) {
    iniciar(async () => {
      setErro(null)
      try {
        await fn()
        if (texto) avisar({ texto })
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  const vivas = chaves.filter((c) => c.revogadaEm === null)
  const revogadas = chaves.filter((c) => c.revogadaEm !== null)
  const ligado = vivas.length > 0

  return (
    <PainelConfig
      titulo="Integrações"
      sub="Outros sistemas que falam com esta agenda"
    >
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-grande border border-linha-suave bg-superficie-suave p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-medium">AutoFluxos</span>
              <Etiqueta tinta="positivo">Recomendado</Etiqueta>
              {ligado ? <Etiqueta tinta="info">Ativo</Etiqueta> : null}
            </span>
            <span className="text-[13.5px] leading-relaxed text-tinta-media">
              O atendimento automático responde no WhatsApp e marca direto aqui. Ele oferece só
              horário com vaga, e nunca abre turma nem passa da lotação: isso
              continua sendo decisão de quem está no balcão.
            </span>
          </div>
          <Botao miudo onClick={() => setCriando(true)}>
            {ligado ? 'Nova chave' : 'Ligar'}
          </Botao>
        </div>

        {/*
          * O segredo aparece **uma vez**, e a tela diz isso antes de a pessoa
          * fechar. Guardar token legível no banco é a decisão que só dói depois
          * de vazar, então aqui não há "ver de novo" para oferecer.
          */}
        {segredo ? (
          <div className="flex flex-col gap-2 rounded-padrao border border-linha p-3">
            <span className="text-[13.5px] font-medium">
              Copie agora, esta chave não aparece de novo
            </span>
            <input
              readOnly value={segredo} aria-label="Chave de API"
              className={`${entrada} font-mono text-[13px]`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Botao
                tom="secundario" miudo
                onClick={() => {
                  navigator.clipboard?.writeText(segredo)
                  avisar({ texto: 'Chave copiada' })
                }}
              >
                Copiar chave
              </Botao>
              <Botao tom="fantasma" miudo onClick={() => setSegredo(null)}>Fechar</Botao>
            </div>
            <Nota tom="atencao">
              Guardamos só uma impressão digital dela, nunca a chave. Se perder,
              revogue esta e crie outra.
            </Nota>
          </div>
        ) : null}

        {erro ? <Nota tom="alerta">{erro}</Nota> : null}

        {/*
          * O caminho de volta.
          *
          * Até agora o outro sistema perguntava e a Verandi respondia. Isto é o
          * contrário: a recepção cancela a aula de quinta aqui, e o outro lado
          * precisa saber para avisar as seis pessoas que iam. Sem isso, quem
          * avisa é o cliente chegando na porta fechada.
          */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-grande border border-linha-suave px-4 py-3.5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-medium">Notificações</span>
              {aviso?.ativo ? <Etiqueta tinta="info">Ativo</Etiqueta> : null}
            </span>
            <span className="text-[13.5px] leading-relaxed text-tinta-media">
              A Verandi manda um aviso para o seu sistema quando alguém é marcado,
              quando alguém desmarca e quando um horário é cancelado.
            </span>
            {aviso?.ativo ? (
              <span className="truncate font-mono text-[12.5px] text-tinta-fraca">
                {aviso.url}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Botao miudo tom={aviso?.ativo ? 'secundario' : 'primario'} onClick={() => setAvisando(true)}>
              {aviso?.ativo ? 'Trocar endereço' : 'Configurar'}
            </Botao>
            {aviso?.ativo ? (
              <BotaoLinha
                disabled={pendente}
                onClick={() => comErro(() => desligarWebhook(), 'Aviso desligado')}
              >
                Desligar
              </BotaoLinha>
            ) : null}
          </div>
        </div>

        {segredoAviso ? (
          <div className="flex flex-col gap-2 rounded-padrao border border-linha p-3">
            <span className="text-[13.5px] font-medium">
              Copie agora, este segredo não aparece de novo
            </span>
            <input
              readOnly value={segredoAviso} aria-label="Segredo de assinatura"
              className={`${entrada} font-mono text-[13px]`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Botao
              tom="secundario" miudo
              onClick={() => {
                navigator.clipboard?.writeText(segredoAviso)
                avisar({ texto: 'Segredo copiado' })
              }}
            >
              Copiar segredo
            </Botao>
            <Nota tom="atencao">
              É com ele que o seu sistema confere que o aviso veio mesmo da
              Verandi. Sem conferir, o endereço vira uma porta que qualquer um
              pode bater dizendo que uma aula foi cancelada.
            </Nota>
          </div>
        ) : null}

        {/*
          * A tela entregava a chave e não dizia para onde apontar.
          *
          * Para a dona do estúdio isso não faltava: ela liga o AutoFluxos e
          * pronto. Para quem vai escrever a integração, faltava tudo, e a
          * referência morava num arquivo do repositório que ninguém de fora
          * alcança. Chave sem endereço é um cadeado sem porta.
          */}
        <div className="flex flex-col gap-1.5 rounded-grande border border-linha-suave px-4 py-3.5">
          <span className="text-[13.5px] font-medium">Para quem vai programar</span>
          <span className="text-[13.5px] leading-relaxed text-tinta-media">
            A agenda tem uma API para consultar horários com vaga, cadastrar,
            marcar e desmarcar.
          </span>
          <span className="pt-0.5 font-mono text-[13px] text-tinta-fraca">
            {`${ENDERECO_PUBLICO}/api/v1`}
          </span>
          <a
            href="/api-docs"
            target="_blank"
            rel="noreferrer"
            className="pt-1 text-[13.5px] font-medium text-marca hover:text-marca-forte"
          >
            Ver a documentação
          </a>
        </div>
      </div>

      {vivas.map((c) => (
        <LinhaConfig
          key={c.id}
          nome={c.nome}
          detalhe={
            <>
              <span className="font-mono">{c.prefixo}…</span>
              {' · '}{quando(c.ultimoUsoEm)}
            </>
          }
        >
          <BotaoLinha
            disabled={pendente}
            onClick={() => setARevogar(c)}
            className="hover:border-alerta-linha-forte hover:bg-alerta-superficie hover:text-alerta"
          >
            Revogar
          </BotaoLinha>
        </LinhaConfig>
      ))}

      {revogadas.map((c) => (
        <LinhaConfig
          key={c.id}
          apagado
          nome={c.nome}
          detalhe={
            <>
              <span className="font-mono">{c.prefixo}…</span>
              {' · revogada em '}
              {new Date(c.revogadaEm!).toLocaleDateString('pt-BR')}
            </>
          }
        />
      ))}

      {criando ? (
        <ModalFormulario
          aberto
          glifo="+"
          titulo="Nova chave de API"
          sub="Dê um nome que diga onde ela está sendo usada."
          primario="Criar"
          pendente={pendente}
          aoFechar={() => setCriando(false)}
          aoEnviar={(f) => comErro(async () => {
            const r = await criarChaveApi(String(f.get('nome') ?? ''))
            setSegredo(r.segredo)
            setCriando(false)
          }, 'Chave criada')}
        >
          <Campo
            rotulo="Nome" htmlFor="ch-nome"
            dica="Aparece na lista, e é como você identifica qual revogar"
          >
            <input
              id="ch-nome" name="nome" required autoFocus maxLength={60}
              defaultValue="AutoFluxos" className={entrada}
            />
          </Campo>
          <Nota tom="atencao">
            Uma chave alcança a agenda inteira desta conta. Só crie uma para cada
            sistema que precisar, e revogue a que parar de ser usada.
          </Nota>
        </ModalFormulario>
      ) : null}

      {avisando ? (
        <ModalFormulario
          aberto
          glifo="→"
          titulo="Para onde avisar"
          sub="O endereço do seu sistema que vai receber os avisos."
          primario="Salvar"
          pendente={pendente}
          aoFechar={() => setAvisando(false)}
          aoEnviar={(f) => comErro(async () => {
            const r = await salvarWebhook(String(f.get('url') ?? ''))
            setSegredoAviso(r.segredo)
            setAvisando(false)
          }, 'Aviso configurado')}
        >
          <Campo
            rotulo="Endereço" htmlFor="wh-url"
            dica="Precisa começar com https://"
          >
            <input
              id="wh-url" name="url" required autoFocus type="url"
              placeholder="https://seusistema.com.br/avisos-da-verandi"
              defaultValue={aviso?.url ?? ''}
              className={entrada}
            />
          </Campo>
          <Nota tom="atencao">
            Salvar gera um segredo de assinatura novo, e o anterior para de
            valer na hora. Se você só está trocando o endereço, o seu sistema
            precisa do segredo novo para continuar aceitando os avisos.
          </Nota>
        </ModalFormulario>
      ) : null}

      {aRevogar ? (
        <ModalFormulario
          aberto
          perigo
          glifo="×"
          titulo={`Revogar ${aRevogar.nome}?`}
          sub="Quem estiver usando esta chave para de conseguir marcar, na hora."
          primario="Revogar"
          pendente={pendente}
          aoFechar={() => setARevogar(null)}
          aoEnviar={() => comErro(async () => {
            await revogarChaveApi(aRevogar.id)
            setARevogar(null)
          }, 'Chave revogada')}
        >
          <Nota tom="alerta">
            O que já foi marcado por ela continua marcado, e continua dizendo que
            veio do atendimento automático. Revogar bloqueia daqui para frente, e não apaga o
            passado.
          </Nota>
        </ModalFormulario>
      ) : null}
    </PainelConfig>
  )
}
