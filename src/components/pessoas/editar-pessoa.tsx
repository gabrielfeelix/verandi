'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { editarPessoa, removerFotoDaPessoa, salvarFotoDaPessoa } from '@/server/pessoas/acoes'
import { Botao } from '@/components/ui/botao'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { CampoData } from '@/components/ui/campo-data'
import { CampoTelefone } from '@/components/ui/campo-telefone'
import { CampoFoto } from '@/components/ui/campo-foto'
import { useAviso } from '@/components/ui/desfazer'
import { erroLegivel } from '@/core/erro-legivel'

type Pessoa = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  identificadorExterno: string | null
  nascimento: string | null
  vencimentoPlano: string | null
  observacao: string | null
  observacaoVisivel: 'profissionais' | 'todos'
  /** existe anotação de quem atende, e quem está lendo não pode vê-la */
  observacaoRestrita: boolean
  ativo: boolean
  fotoUrl: string | null
}

/*
 * Duas colunas de largura igual, e o campo ocupa a coluna inteira.
 *
 * Antes era `flex-wrap` com largura mínima: cada campo ficava do tamanho que
 * sobrava, espremido, e nenhum deles alinhava com a caixa de observação logo
 * abaixo — o formulário parecia montado a esmo. Nome e vencimento atravessam as
 * duas colunas porque nome é o campo mais longo e vencimento é o último: meia
 * linha solta no fim deixa um buraco.
 */
const CAMPOS = [
  ['nome', 'Nome', 'text', true],
  ['telefone', 'Telefone', 'tel', false],
  ['email', 'E-mail', 'email', false],
  ['identificador', 'Identificador', 'text', false],
  ['nascimento', 'Nascimento', 'data', false],
  ['vencimento', 'Vencimento do plano', 'data', true],
] as const

/** O exemplo em cinza: campo vazio sem exemplo é campo que fica vazio. */
const EXEMPLO: Record<string, string> = {
  nome: 'Nome completo',
  email: 'nome@email.com',
  identificador: 'Número da ficha antiga',
}

/**
 * Editar a ficha **em modal**, não embutido no cartão.
 *
 * Embutido, o formulário nascia dentro do cabeçalho da ficha e empurrava tudo:
 * o cartão esticava para uns novecentos pixels, o lado esquerdo virava um vazio
 * branco do tamanho da tela e o botão "Marcar inativa" ficava órfão numa
 * coluna sozinha. O modal resolve porque o formulário não precisa caber no
 * lugar de onde nasceu — e a ficha continua inteira atrás, que é o contexto de
 * quem está conferindo o que digitar.
 */
export function EditarPessoa({
  pessoa, className = '',
}: {
  pessoa: Pessoa
  /** para o par de botões da ficha dividir a largura por igual */
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [visivel, setVisivel] = useState(pessoa.observacaoVisivel)
  const router = useRouter()
  const avisar = useAviso()

  function fechar() {
    setAberto(false)
    setErro(null)
  }

  const valor: Record<string, string> = {
    nome: pessoa.nome,
    telefone: pessoa.telefone ?? '',
    email: pessoa.email ?? '',
    identificador: pessoa.identificadorExterno ?? '',
    nascimento: pessoa.nascimento ?? '',
    vencimento: pessoa.vencimentoPlano ?? '',
  }

  return (
    <>
      <Botao tom="secundario" onClick={() => setAberto(true)} className={className}>
        Editar dados
      </Botao>

      {aberto ? (
        <ModalFormulario
          aberto
          glifo="✎"
          titulo="Editar dados"
          sub={pessoa.nome}
          primario="Salvar"
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => iniciar(async () => {
            setErro(null)
            try {
              await editarPessoa(pessoa.id, {
                nome: String(f.get('nome') ?? ''),
                telefone: String(f.get('telefone') ?? ''),
                email: String(f.get('email') ?? ''),
                identificadorExterno: String(f.get('identificador') ?? ''),
                nascimento: String(f.get('nascimento') ?? ''),
                // data que avisa, não valor que cobra — financeiro é outro produto
                vencimentoPlano: String(f.get('vencimento') ?? ''),
                /*
                 * Restrita, a observação nem vai no pacote: mandar `''` daqui
                 * apagaria a anotação de quem atende, e o servidor recusaria a
                 * gravação inteira junto com o resto do formulário.
                 */
                ...(pessoa.observacaoRestrita
                  ? {}
                  : {
                      observacao: String(f.get('observacao') ?? ''),
                      observacaoVisivel: visivel,
                    }),
                ativo: f.get('ativo') === 'on',
              })
              // a foto vai por fora do pacote de campos: é arquivo, e sobe
              // para o Storage, não para a linha da tabela
              const foto = f.get('foto')
              if (foto instanceof File && foto.size > 0) {
                await salvarFotoDaPessoa(pessoa.id, foto)
              }
              avisar({ texto: 'Ficha salva' })
              fechar()
              router.refresh()
            } catch (e) {
              setErro(erroLegivel(e))
            }
          })}
        >
          <Campo rotulo="Foto" dica="Ajuda a recepção a reconhecer, e serve de antes e depois">
            <CampoFoto
              atual={pessoa.fotoUrl}
              alt={pessoa.nome}
              aoRemover={pessoa.fotoUrl
                ? () => iniciar(async () => {
                    await removerFotoDaPessoa(pessoa.id)
                    router.refresh()
                  })
                : undefined}
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map(([n, r, t, largo]) => (
              <div key={n} className={largo ? 'sm:col-span-2' : ''}>
                <Campo rotulo={r} htmlFor={`ep-${n}`} obrigatorio={n === 'nome'}>
                  {t === 'data' ? (
                    <CampoData id={`ep-${n}`} nome={n} valorInicial={valor[n]} />
                  ) : t === 'tel' ? (
                    <CampoTelefone id={`ep-${n}`} nome={n} valorInicial={valor[n]} />
                  ) : (
                    <input
                      id={`ep-${n}`} name={n} type={t} defaultValue={valor[n]}
                      required={n === 'nome'}
                      placeholder={EXEMPLO[n]}
                      className={`${entrada} w-full`}
                    />
                  )}
                </Campo>
              </div>
            ))}
          </div>

          {pessoa.observacaoRestrita ? (
            <Nota>
              A observação desta ficha foi escrita para quem atende. O resto dos
              dados continua editável daqui.
            </Nota>
          ) : (
            <Campo rotulo="Observação" htmlFor="ep-observacao">
              <textarea
                id="ep-observacao" name="observacao" rows={3}
                defaultValue={pessoa.observacao ?? ''}
                className={entrada}
              />
              {/* quem escreve escolhe quem lê, na hora de escrever: é o único
                  momento em que a pessoa sabe se está anotando "prefere a maca do
                  fundo" ou "hérnia de disco". O padrão fecha, e é decisão. */}
              <fieldset className="flex flex-col gap-1.5 pt-2">
                <legend className="pb-1.5 text-[11px] font-semibold tracking-[.08em] text-tinta-media uppercase">
                  Visível para
                </legend>
                {([
                  ['profissionais', 'Só quem atende'],
                  ['todos', 'Todo mundo da conta'],
                ] as const).map(([v, texto]) => (
                  <label key={v} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio" name="observacaoVisivel" value={v}
                      checked={visivel === v}
                      onChange={() => setVisivel(v)}
                    />
                    {texto}
                  </label>
                ))}
                <p className="text-[11.5px] text-tinta-media">
                  {visivel === 'profissionais'
                    ? 'A recepção não lê. É onde vai o que é de saúde.'
                    : 'Aparece para quem abrir esta ficha, inclusive a recepção.'}
                </p>
              </fieldset>
            </Campo>
          )}

          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="ativo" defaultChecked={pessoa.ativo} />
            Ativa
          </label>

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}
