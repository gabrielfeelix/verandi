'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { PainelConfig } from './casca'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import {
  removerAssinatura, salvarAssinatura, salvarEmitente,
} from '@/server/config/acoes'
import type { Emitente } from '@/server/config/consultas'
import { emitenteCompleto } from '@/core/recibo/recibo'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * Quem emite o recibo.
 *
 * São cinco campos e uma tela inteira, e o motivo é o que a nota diz: recibo
 * sem quem emitiu não comprova nada, e é a única coisa que impede a recepção de
 * emitir. Escondê-lo dentro de Padrões faria essa parede aparecer no balcão,
 * com a pessoa esperando o papel.
 */
export function SecaoRecibo({
  emitente, assinatura,
}: {
  emitente: Emitente
  /** a imagem já configurada, numa URL assinada e curta */
  assinatura: string | null
}) {
  const [v, setV] = useState({
    razaoSocial: emitente.razaoSocial ?? '',
    documento: emitente.documento ?? '',
    endereco: emitente.endereco ?? '',
    telefone: emitente.telefone ?? '',
    serieRecibo: emitente.serieRecibo,
    assinaturaNome: emitente.assinaturaNome ?? '',
    assinaturaCargo: emitente.assinaturaCargo ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const sujo = v.razaoSocial !== (emitente.razaoSocial ?? '')
    || v.documento !== (emitente.documento ?? '')
    || v.endereco !== (emitente.endereco ?? '')
    || v.telefone !== (emitente.telefone ?? '')
    || v.serieRecibo !== emitente.serieRecibo
    || v.assinaturaNome !== (emitente.assinaturaNome ?? '')
    || v.assinaturaCargo !== (emitente.assinaturaCargo ?? '')

  const completo = emitenteCompleto({
    razaoSocial: v.razaoSocial,
    documento: v.documento,
    endereco: v.endereco,
    telefone: v.telefone,
    nomeDaConta: emitente.nomeDaConta,
  })

  /**
   * Salvar não pode dizer que deu certo enquanto a emissão continua barrada.
   *
   * O asterisco nos dois campos prometia uma conferência que não existia em
   * lugar nenhum: dava para salvar só o CNPJ, ouvir "Emitente salvo" e
   * descobrir a falta na tela de Recibos, ou pior, no balcão. A recusa nasce
   * na ação do servidor, que é o que qualquer sessão consegue chamar; aqui a
   * frase só chega ao lado do campo que falta.
   */
  function salvar() {
    iniciar(async () => {
      setErro(null)
      try {
        const r = await salvarEmitente(v)
        if (!r.ok) {
          setErro(r.erro)
          return
        }
        avisar({ texto: 'Emitente salvo' })
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  return (
    <PainelConfig
      titulo="Recibo"
      sub="quem emite, e a série da numeração"
      acao={
        <Botao onClick={salvar} disabled={!sujo || pendente}>
          {pendente ? 'Salvando' : 'Salvar'}
        </Botao>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        {!completo ? (
          <Nota tom="atencao">
            Enquanto a razão social e o documento estiverem vazios, a recepção
            não consegue emitir recibo. Recibo sem quem emitiu não comprova nada,
            e descobrir isso com a pessoa esperando no balcão é pior.
          </Nota>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {/*
            Sem placeholder, e isto é o conserto de um defeito de verdade.
            Aqui estava o nome da conta — "MGM Pilates" —, e um campo vazio
            mostrando exatamente o texto que a pessoa ia digitar **é um campo
            que parece preenchido**. Quem abriu esta tela digitou o CNPJ e o
            telefone, salvou, e saiu certo de que tinha terminado; a razão
            social continuou nula e a recepção continuou sem emitir recibo.
            Sugerir o valor certo no lugar errado custa mais do que não
            sugerir nada.
          */}
          <Campo rotulo="Razão social" htmlFor="em-razao" obrigatorio>
            <input
              id="em-razao" className={entrada} maxLength={120}
              value={v.razaoSocial}
              onChange={(e) => setV({ ...v, razaoSocial: e.target.value })}
            />
          </Campo>
          <Campo
            rotulo="CNPJ ou CPF"
            htmlFor="em-doc"
            dica="só dígitos; é o que torna o papel oponível a alguém"
            obrigatorio
          >
            <input
              id="em-doc" className={entrada} inputMode="numeric" maxLength={18}
              value={v.documento}
              onChange={(e) => setV({ ...v, documento: e.target.value })}
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <Campo rotulo="Endereço" htmlFor="em-end">
            <input
              id="em-end" className={entrada} maxLength={160}
              value={v.endereco}
              onChange={(e) => setV({ ...v, endereco: e.target.value })}
              placeholder="Rua, número, bairro, cidade"
            />
          </Campo>
          <Campo rotulo="Telefone" htmlFor="em-fone">
            <input
              id="em-fone" className={entrada} maxLength={20}
              value={v.telefone}
              onChange={(e) => setV({ ...v, telefone: e.target.value })}
            />
          </Campo>
          <Campo
            rotulo="Série"
            htmlFor="em-serie"
            dica="a letra antes do número"
          >
            <input
              id="em-serie" className={`${entrada} w-20`} maxLength={4}
              value={v.serieRecibo}
              onChange={(e) => setV({ ...v, serieRecibo: e.target.value.toUpperCase() })}
            />
          </Campo>
        </div>

        {/*
          * A assinatura.
          *
          * O papel saía com uma linha vazia, e alguém do estúdio assinava à
          * caneta cada via. Isso funciona para quem imprime e não funciona
          * para quem envia: ninguém assina um anexo à caneta antes de mandar.
          */}
        <div className="flex flex-col gap-3 rounded-media border border-linha-suave bg-superficie-mais-suave p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[13.5px] font-medium">Assinatura</h3>
              <p className="pt-[2px] text-[12px] leading-[1.5] text-tinta-media">
                Aparece em cima da linha, no papel e no recibo enviado. Sem ela,
                a linha sai em branco para assinar à mão.
              </p>
            </div>
            {assinatura ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assinatura} alt="Assinatura configurada"
                  className="max-h-12 max-w-[180px] rounded-peca border border-linha-suave bg-superficie object-contain p-1"
                />
                <button
                  type="button"
                  onClick={() => iniciar(async () => {
                    setErro(null)
                    const r = await removerAssinatura()
                    if (!r.ok) return setErro(r.erro)
                    avisar({ texto: 'Assinatura removida' })
                    router.refresh()
                  })}
                  disabled={pendente}
                  className="cursor-pointer text-[12.5px] text-tinta-media underline disabled:opacity-50"
                >
                  remover
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Quem assina"
              htmlFor="em-assina-nome"
              dica="vazio usa a razão social"
            >
              <input
                id="em-assina-nome" className={entrada} maxLength={120}
                value={v.assinaturaNome}
                onChange={(e) => setV({ ...v, assinaturaNome: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Cargo" htmlFor="em-assina-cargo" dica="opcional">
              <input
                id="em-assina-cargo" className={entrada} maxLength={80}
                value={v.assinaturaCargo}
                onChange={(e) => setV({ ...v, assinaturaCargo: e.target.value })}
                placeholder="Ex.: responsável técnica"
              />
            </Campo>
          </div>

          {/*
            * Formulário próprio, e não um campo do formulário de cima: arquivo
            * não atravessa Server Action dentro de objeto simples, e misturar
            * os dois faria "Salvar" às vezes mandar a imagem e às vezes não.
            */}
          <form
            action={async (dados) => {
              setErro(null)
              const r = await salvarAssinatura(dados)
              if (!r.ok) return setErro(r.erro)
              avisar({ texto: 'Assinatura salva' })
              router.refresh()
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="file" name="assinatura" required
              accept="image/png,image/jpeg,image/webp"
              aria-label="Arquivo da assinatura"
              className="max-w-full text-[12.5px] text-tinta-media file:mr-3 file:cursor-pointer file:rounded-peca file:border file:border-linha-suave file:bg-superficie file:px-3 file:py-2 file:text-[12.5px]"
            />
            <Botao tom="secundario" type="submit">
              {assinatura ? 'Trocar imagem' : 'Enviar imagem'}
            </Botao>
            <span className="text-[11.5px] text-tinta-fraca">
              PNG, JPEG ou WEBP, até 1 MB. Fundo branco fica melhor no papel.
            </span>
          </form>
        </div>

        <Nota tom="neutro">
          Estes dados são copiados para dentro de cada recibo no ato da emissão,
          e não consultados depois. Mudar a razão social amanhã não reescreve o
          que já foi impresso, que é o que faz a segunda via de um recibo antigo
          sair igual ao papel que está na pasta.
          {' '}A série muda a numeração daqui para a frente, e a sequência
          antiga continua onde está.
          {' '}A **imagem** da assinatura é a exceção: ela vem da conta na hora
          de mostrar, como um carimbo, e por isso a segunda via sai com o
          carimbo de hoje. O nome de quem assinou fica congelado com o resto.
        </Nota>

        {erro ? <Nota tom="alerta">{erro}</Nota> : null}
      </div>
    </PainelConfig>
  )
}
