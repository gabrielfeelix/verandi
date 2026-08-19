'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { PainelConfig } from './casca'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import { salvarEmitente } from '@/server/config/acoes'
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
export function SecaoRecibo({ emitente }: { emitente: Emitente }) {
  const [v, setV] = useState({
    razaoSocial: emitente.razaoSocial ?? '',
    documento: emitente.documento ?? '',
    endereco: emitente.endereco ?? '',
    telefone: emitente.telefone ?? '',
    serieRecibo: emitente.serieRecibo,
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

  const completo = emitenteCompleto({
    razaoSocial: v.razaoSocial,
    documento: v.documento,
    endereco: v.endereco,
    telefone: v.telefone,
    nomeDaConta: emitente.nomeDaConta,
  })

  function salvar() {
    iniciar(async () => {
      setErro(null)
      try {
        await salvarEmitente(v)
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
          <Campo rotulo="Razão social" htmlFor="em-razao" obrigatorio>
            <input
              id="em-razao" className={entrada} maxLength={120}
              value={v.razaoSocial}
              onChange={(e) => setV({ ...v, razaoSocial: e.target.value })}
              placeholder={emitente.nomeDaConta}
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

        <Nota tom="neutro">
          Estes dados são copiados para dentro de cada recibo no ato da emissão,
          e não consultados depois. Mudar a razão social amanhã não reescreve o
          que já foi impresso, que é o que faz a segunda via de um recibo antigo
          sair igual ao papel que está na pasta.
          {' '}A série muda a numeração daqui para a frente, e a sequência
          antiga continua onde está.
        </Nota>

        {erro ? <Nota tom="alerta">{erro}</Nota> : null}
      </div>
    </PainelConfig>
  )
}
