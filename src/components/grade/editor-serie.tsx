'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Chip, Nota, Rotulo, entrada } from '@/components/ui/pecas'
import { Escolha } from '@/components/ui/escolha'
import { CampoData } from '@/components/ui/campo-data'
import { criarSeries } from '@/server/grade/acoes'
import type { Colisao, NovaSerie } from '@/core/agenda/serie'
import type { Rotulos } from '@/core/vocabulario/padrao'
import type { CatalogoGrade } from '@/server/grade/consultas'
import { erroLegivel } from '@/core/erro-legivel'
import { CampoNumero } from '@/components/ui/campo-numero'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Criar horário fixo, em modal, como o protótipo desenha.
 *
 * Montar 70 horários na mão é o pior momento do cliente com o produto — por
 * isso escolher vários dias de uma vez é o caminho principal deste formulário,
 * não uma opção escondida.
 */
export function EditorSerie({
  catalogo, rotulos,
}: {
  catalogo: CatalogoGrade
  /*
   * O vocabulário inteiro, e não uma palavra por prop: os três campos do
   * formulário rotulavam "Serviço", "Profissional" e "Local" à mão, que é o
   * nome neutro do sistema. Num estúdio de pilates a grade é montada
   * escolhendo modalidade, professor e sala.
   */
  rotulos: Rotulos
}) {
  const [aberto, setAberto] = useState(false)
  const [dias, setDias] = useState<number[]>([])
  const [colisoes, setColisoes] = useState<Colisao[]>([])
  /**
   * O que foi pedido, guardado.
   *
   * React reseta os campos do formulário depois que a action termina, então
   * reler o `FormData` no "criar mesmo assim" leria um formulário vazio — e o
   * segundo clique não criaria nada, sem dizer por quê.
   */
  const [pedido, setPedido] = useState<NovaSerie | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  // data local do navegador: `toISOString` é UTC e já daria amanhã às 21h
  const hoje = new Date().toLocaleDateString('en-CA')

  function fechar() {
    setAberto(false)
    setDias([])
    setColisoes([])
    setPedido(null)
    setErro(null)
  }

  function salvar(entrada: NovaSerie, confirmarColisao: boolean) {
    iniciar(async () => {
      setErro(null)
      try {
        const r = await criarSeries(entrada, { confirmarColisao })
        if (r.ok) {
          fechar()
          router.refresh()
        } else if (r.colisoes) {
          setColisoes(r.colisoes)
          setPedido(entrada)
        } else {
          // recusa que não é colisão, como número de turma repetido: ela é
          // frase, e a frase é o que a pessoa precisa para escolher outro
          setErro(r.erro)
        }
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  function doFormulario(f: FormData): NovaSerie {
    return {
      servicoId: String(f.get('servicoId') ?? ''),
      profissionalId: String(f.get('profissionalId') ?? '') || null,
      localId: String(f.get('localId') ?? '') || null,
      diasSemana: dias,
      horaInicio: String(f.get('horaInicio') ?? ''),
      duracaoMin: Number(f.get('duracaoMin') ?? 60),
      capacidade: Number(f.get('capacidade') ?? 1),
      vigenciaInicio: String(f.get('vigenciaInicio') ?? hoje),
      codigo: String(f.get('codigo') ?? '') || null,
    }
  }

  const semServico = catalogo.servicos.length === 0

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        Criar {rotulos.serie.singular.toLowerCase()}
      </Botao>

      {aberto ? (
        <ModalFormulario
          aberto
          titulo={`Criar ${rotulos.serie.singular.toLowerCase()}`}
          sub="Um horário que se repete toda semana."
          primario={
            dias.length > 1 ? `Criar ${dias.length} horários` : 'Criar horário'
          }
          pendente={pendente || semServico}
          aoFechar={fechar}
          aoEnviar={(f) => salvar(doFormulario(f), false)}
        >
          {semServico ? (
            <Nota tom="atencao">
              Antes de montar a grade, o catálogo precisa de pelo menos um
              nome. Cadastre em Configuração, {rotulos.servico.plural}.
            </Nota>
          ) : (
            <>
              {/* os dias vêm primeiro, e são chips: criar seg, qua e sex de uma
                  vez é o caminho principal, não um extra escondido */}
              <fieldset className="flex flex-col gap-1.5">
                <legend className="pb-1.5">
                  <Rotulo>Dias da semana</Rotulo>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d, i) => (
                    <Chip
                      key={d}
                      ativo={dias.includes(i)}
                      onClick={() => setDias(
                        dias.includes(i)
                          ? dias.filter((x) => x !== i)
                          : [...dias, i],
                      )}
                    >
                      {d}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-start gap-3">
                <Campo rotulo="Começa às" htmlFor="horaInicio" obrigatorio>
                  <input id="horaInicio" name="horaInicio" type="time" required
                    className={`${entrada} w-32`} />
                </Campo>
                <Campo rotulo="Duração (min)" htmlFor="duracaoMin">
                  <CampoNumero id="duracaoMin" nome="duracaoMin" min={1} max={600} sufixo="min" valorInicial={60} required />
                </Campo>
                <Campo rotulo="Capacidade" htmlFor="capacidade">
                  <CampoNumero id="capacidade" nome="capacidade" min={1} max={999} valorInicial={1} required />
                </Campo>
                {/* o número identifica uma turma, e criar três dias de uma vez
                    cria três: aí ele não teria a quem pertencer */}
                {dias.length === 1 ? (
                  <Campo
                    rotulo="Número da turma" htmlFor="codigo"
                    dica="opcional, é como a recepção chama esta turma"
                  >
                    <input id="codigo" name="codigo" maxLength={12}
                      placeholder="001" className={`${entrada} w-28 font-mono`} />
                  </Campo>
                ) : null}
              </div>

              <Campo rotulo={rotulos.servico.singular} htmlFor="servicoId">
                <Escolha
                  id="servicoId" nome="servicoId"
                  valorInicial={catalogo.servicos[0]?.id ?? ''}
                  opcoes={catalogo.servicos.map((x) => ({
                    valor: x.id,
                    rotulo: x.nome,
                    detalhe: `${x.duracaoMin} min · cabem ${x.capacidadePadrao}`,
                  }))}
                />
              </Campo>

              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo={rotulos.profissional.singular} htmlFor="profissionalId">
                  <Escolha
                    id="profissionalId" nome="profissionalId"
                    placeholder={`Sem ${rotulos.profissional.singular.toLowerCase()}`}
                    opcoes={[
                      { valor: '', rotulo: `Sem ${rotulos.profissional.singular.toLowerCase()}` },
                      ...catalogo.profissionais.map((x) => ({ valor: x.id, rotulo: x.nome })),
                    ]}
                  />
                </Campo>
                <Campo rotulo={rotulos.local.singular} htmlFor="localId">
                  <Escolha
                    id="localId" nome="localId"
                    placeholder={`Sem ${rotulos.local.singular.toLowerCase()}`}
                    opcoes={[
                      { valor: '', rotulo: `Sem ${rotulos.local.singular.toLowerCase()}` },
                      ...catalogo.locais.map((x) => ({ valor: x.id, rotulo: x.nome })),
                    ]}
                  />
                </Campo>
                <Campo rotulo="Vale a partir de" htmlFor="vigenciaInicio">
                  <CampoData
                    id="vigenciaInicio" nome="vigenciaInicio"
                    valorInicial={hoje} limpavel={false}
                  />
                </Campo>
              </div>

              {catalogo.funcionamento.length > 0 ? (
                <p className="text-[12px] text-tinta-fraca">
                  Funcionamento:{' '}
                  {catalogo.funcionamento
                    .map((f) => `${DIAS[f.diaSemana]} ${f.abre}–${f.fecha}`)
                    .join(' · ')}
                </p>
              ) : null}

              {/* Colisão não bloqueia: dois profissionais na mesma sala pode ser
                  real. Quem opera é que sabe, então a tela conta o que achou e
                  deixa seguir. */}
              {colisoes.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-media border border-atencao-linha bg-atencao-superficie p-3 text-[12.5px] leading-relaxed">
                  <p className="font-medium">Já existe algo marcado neste horário:</p>
                  <ul className="list-inside list-disc">
                    {colisoes.map((c, i) => (
                      <li key={`${c.serieId}-${i}`}>
                        {DIAS[c.diaSemana]} às {c.horaInicio}, {c.ocupadoPor} já
                        {c.tipo === 'profissional'
                          ? ' atende nesse horário'
                          : ' está ocupado nesse horário'}
                      </li>
                    ))}
                  </ul>
                  {pedido ? (
                    <div>
                      <Botao
                        type="button" tom="secundario" miudo disabled={pendente}
                        onClick={() => salvar(pedido, true)}
                      >
                        Criar mesmo assim
                      </Botao>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {erro ? <Nota tom="alerta">{erro}</Nota> : null}
            </>
          )}
        </ModalFormulario>
      ) : null}
    </>
  )
}
