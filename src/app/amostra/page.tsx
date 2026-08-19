'use client'

import { useState } from 'react'
import { Botao, BotaoIcone } from '@/components/ui/botao'
import { Modal } from '@/components/ui/modal'
import { ProvedorDeAviso, useAviso } from '@/components/ui/desfazer'
import { Abas } from '@/components/ui/abas'
import { Menu } from '@/components/ui/menu'
import { Icone, type NomeIcone } from '@/components/ui/icones'
import {
  Avatar, Campo, Cartao, Chip, Esqueleto, Etiqueta, Nota, Ocupacao, Paginacao,
  Rotulo, Vazio, entrada,
} from '@/components/ui/pecas'
import { TINTA, type Tinta } from '@/components/ui/tintas'

/**
 * A amostra dos primitivos.
 *
 * Não é documentação: é o lugar onde se confere contraste, foco de teclado e
 * alvo de toque sem abrir seis telas de produto. Toda peça nova aparece aqui,
 * em todas as variações, antes de ser usada.
 */
const TINTAS: Tinta[] = ['positivo', 'atencao', 'alerta', 'info', 'licenca', 'neutro']

const ICONES: NomeIcone[] = [
  'check', 'x', 'aviso', 'licenca', 'hoje', 'semana', 'pessoas', 'pendencias',
  'vaga', 'grade', 'config', 'conta', 'lista', 'local', 'regua', 'texto',
  'relogio', 'chave', 'kebab', 'sair', 'antes', 'depois', 'mais', 'menos',
  'lapis', 'fechar',
]

export default function Amostra() {
  return (
    <ProvedorDeAviso>
      <Conteudo />
    </ProvedorDeAviso>
  )
}

function Conteudo() {
  const [chip, setChip] = useState('seg')
  const [aba, setAba] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [modal, setModal] = useState<null | 'normal' | 'perigo'>(null)
  const avisar = useAviso()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Rotulo>Design system</Rotulo>
        <h1 className="font-titulo text-[30px] font-semibold tracking-[-.02em]">
          Primitivos da Verandi
        </h1>
        <p className="text-tinta-media">
          As peças burras, em todas as variações. O contrato está em
          {' '}<code className="font-mono">docs/DESIGN.md</code>.
        </p>
      </header>

      <Cartao titulo="Botão">
        <div className="flex flex-wrap items-center gap-3">
          <Botao tom="primario">Salvar</Botao>
          <Botao tom="secundario">Cancelar</Botao>
          <Botao tom="perigo">Encerrar série</Botao>
          <Botao tom="fantasma">Ver ficha completa</Botao>
          <Botao tom="perigo-leve">Remover</Botao>
          <Botao tom="tracejado"><Icone nome="mais" tamanho={16} />Adicionar sala</Botao>
          <Botao tom="secundario" miudo>Miúdo</Botao>
          <Botao disabled>Desabilitado</Botao>
          <BotaoIcone icone="lapis" titulo="Editar" />
          <BotaoIcone icone="x" titulo="Remover" perigo />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-media bg-escuro p-3">
          <Botao tom="claro">Entrar</Botao>
          <Botao tom="contorno-claro">Sair da conta</Botao>
          <span className="text-[12.5px] text-tinta-escura-media">
            os dois tons que existem para o painel escuro
          </span>
        </div>
        <p className="mt-3 text-[12.5px] text-tinta-media">
          Altura mínima de 44px, menos no miúdo, a tela de Sessão é usada em pé,
          com a mão ocupada.
        </p>
      </Cartao>

      <Cartao titulo="Tipografia">
        <div className="flex flex-col gap-2">
          <p className="font-titulo text-[30px] font-semibold tracking-[-.02em]">
            Bricolage Grotesque 30
          </p>
          <p className="font-titulo text-[19px] font-semibold">Bricolage 19</p>
          <p className="text-[15px] font-medium">DM Sans 14 forte</p>
          <p className="text-[14px]">DM Sans 13 padrão</p>
          <p className="text-[13.5px] text-tinta-media">DM Sans 12.5 de apoio</p>
          <p className="font-mono text-[14px]">DM Mono 07:00 · 4/4 · id 1042</p>
          <Rotulo>Rótulo em versalete</Rotulo>
        </div>
      </Cartao>

      <Cartao titulo="Tintas com significado">
        <div className="flex flex-wrap gap-2">
          {TINTAS.map((t) => (
            <span key={t} className={`rounded-peca px-3 py-2 text-[13.5px] ${TINTA[t]}`}>
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-tinta-media">
          A cor nunca informa sozinha: sempre acompanha texto ou glifo.
        </p>
      </Cartao>

      <Cartao titulo="Etiqueta">
        <div className="flex flex-wrap gap-2">
          <Etiqueta tinta="positivo" glifo="✓">Presente</Etiqueta>
          <Etiqueta tinta="alerta" glifo="×">Falta</Etiqueta>
          <Etiqueta tinta="atencao" glifo="!">Falta avisada</Etiqueta>
          <Etiqueta tinta="licenca" glifo="~">Licença</Etiqueta>
          <Etiqueta tinta="info">Avulso</Etiqueta>
          <Etiqueta tinta="neutro">Reserva</Etiqueta>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Ocupacao usadas={3} capacidade={4} />
          <Ocupacao usadas={4} capacidade={4} />
          <Ocupacao usadas={5} capacidade={4} />
          <span className="text-[12.5px] text-tinta-media">
            passar da capacidade fica laranja e continua aceitando encaixe
          </span>
        </div>
      </Cartao>

      <Cartao titulo="Ícones">
        <div className="flex flex-wrap gap-3">
          {ICONES.map((n) => (
            <span
              key={n}
              title={n}
              className="flex size-11 items-center justify-center rounded-peca border border-linha-suave text-tinta-media"
            >
              <Icone nome={n} />
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-tinta-media">
          Um traço só, `currentColor`, sem biblioteca externa e sem emoji.
        </p>
      </Cartao>

      <Cartao
        titulo="Abas e menu"
        acao={
          <Menu
            titulo="Ações da lista"
            itens={[
              { rotulo: 'Editar', icone: 'lapis', aoEscolher: () => avisar({ texto: 'Editar' }) },
              { rotulo: 'Duplicar', icone: 'mais', aoEscolher: () => avisar({ texto: 'Duplicada' }) },
              { rotulo: 'Remover', icone: 'x', perigo: true, aoEscolher: () => avisar({ texto: 'Removida' }) },
            ]}
          />
        }
      >
        <Abas
          rotuloDoGrupo="Filtro da lista"
          ativo={aba}
          aoTrocar={setAba}
          itens={[
            { id: 'todas', rotulo: 'Todas', contagem: 24 },
            { id: 'hoje', rotulo: 'Hoje', contagem: 6 },
            { id: 'sem', rotulo: 'Sem vaga fixa', contagem: 2 },
          ]}
        />
        <p className="mt-3 text-[12.5px] text-tinta-media">
          O ativo não clareia no hover, clarear faz parecer que desligou.
        </p>
      </Cartao>

      <Cartao titulo="Chip">
        <div className="flex flex-wrap gap-2">
          {['seg', 'ter', 'qua', 'qui', 'sex'].map((d) => (
            <Chip key={d} ativo={chip === d} onClick={() => setChip(d)}>
              {d}
            </Chip>
          ))}
          <Chip ativo={false} ponto="#0E7C6B">Thalya</Chip>
          <Chip ativo ponto="#F0693C">Carol</Chip>
        </div>
      </Cartao>

      <Cartao titulo="Campo">
        <div className="flex flex-wrap gap-4">
          <Campo rotulo="Nome" htmlFor="a-nome" dica="Como aparece na grade">
            <input id="a-nome" className={entrada} placeholder="Studio Aurora" />
          </Campo>
          <Campo rotulo="Começa às" htmlFor="a-hora">
            <input id="a-hora" type="time" className={entrada} defaultValue="07:00" />
          </Campo>
          <Campo rotulo="Vale a partir de" htmlFor="a-data">
            <input id="a-data" type="date" className={entrada} />
          </Campo>
          <Campo rotulo="Capacidade" htmlFor="a-cap" dica="Vagas por sessão">
            <div className="flex items-center gap-2">
              <Botao tom="secundario" miudo aria-label="menos">−</Botao>
              <input id="a-cap" className={`${entrada} w-16 text-center`} defaultValue="4" />
              <Botao tom="secundario" miudo aria-label="mais">+</Botao>
            </div>
          </Campo>
        </div>
      </Cartao>

      <Cartao titulo="Nota">
        <div className="flex flex-col gap-2">
          <Nota tom="positivo">
            Uma série por dia marcado, todas iguais e editáveis depois.
          </Nota>
          <Nota tom="atencao">
            As pessoas da série original não são copiadas, a vaga nova nasce vazia.
          </Nota>
          <Nota tom="alerta">
            As sessões que já aconteceram continuam no histórico. As futuras deixam
            de ser criadas.
          </Nota>
        </div>
      </Cartao>

      <Cartao titulo="Avatar">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar nome="Ruth Salgado" tamanho={24} />
          <Avatar nome="Bianca Mendes" />
          <Avatar nome="Larissa Cruz" tamanho={40} />
          <Avatar nome="Thalya Ribeiro" tamanho={40} anel="#0E7C6B" />
          <Avatar nome="Carol Nunes" tamanho={40} anel="#F0693C" />
          <span className="text-[12.5px] text-tinta-media">
            cor por hash do nome: a mesma pessoa, a mesma cor, em toda tela
          </span>
        </div>
      </Cartao>

      <Cartao titulo="Esqueleto">
        <div className="flex flex-col gap-2">
          <Esqueleto largura="220px" />
          <Esqueleto largura="160px" />
          <Esqueleto largura="100%" altura={40} />
        </div>
      </Cartao>

      <Cartao titulo="Estado vazio">
        <Vazio
          icone="hoje"
          titulo="Nada marcado nesta quinta"
          texto="Dia sem aula é informação, não falha, por isso a tela não fala em erro nem manda tentar de novo."
          acao={<Botao tom="secundario">Ver a semana</Botao>}
        />
      </Cartao>

      <Cartao titulo="Paginação">
        <Paginacao pagina={pagina} total={94} porPagina={20} aoIr={setPagina} />
      </Cartao>

      <Cartao titulo="Modal e desfazer">
        <div className="flex flex-wrap gap-3">
          <Botao onClick={() => setModal('normal')}>Abrir modal</Botao>
          <Botao tom="perigo" onClick={() => setModal('perigo')}>Abrir destrutivo</Botao>
          <Botao
            tom="secundario"
            onClick={() => avisar({
              texto: 'Helena marcada como presente',
              desfazer: () => avisar({ texto: 'Desfeito' }),
            })}
          >
            Mostrar desfazer
          </Botao>
        </div>
      </Cartao>

      <Modal
        aberto={modal === 'normal'}
        titulo="Nova série"
        sub="Um horário que se repete toda semana."
        primario="Criar série"
        aoConfirmar={() => { setModal(null); avisar({ texto: 'Série criada' }) }}
        aoFechar={() => setModal(null)}
      >
        <Campo rotulo="Serviço" htmlFor="m-srv">
          <input id="m-srv" className={entrada} defaultValue="Pilates Solo" />
        </Campo>
        <Nota tom="positivo">
          A vigência começa hoje, sessões anteriores não são criadas nem
          reescritas.
        </Nota>
      </Modal>

      <Modal
        aberto={modal === 'perigo'}
        perigo
        glifo="!"
        titulo="Encerrar esta série?"
        sub="Segunda 07:00 · Pilates Solo"
        primario="Encerrar série"
        secundario="Voltar"
        aoConfirmar={() => { setModal(null); avisar({ texto: 'Série encerrada' }) }}
        aoFechar={() => setModal(null)}
      >
        <ul className="flex flex-col gap-2">
          {[
            ['Vera Lúcia Braga', 'desde mar/24'],
            ['Cássia Mota', 'desde mai/24'],
          ].map(([nome, desde]) => (
            <li key={nome} className="flex items-center gap-3">
              {/* o nome está escrito ao lado: o avatar é decoração */}
              <Avatar nome={nome} decorativo />
              <span className="text-[14px]">{nome}</span>
              <span className="ml-auto text-[12.5px] text-tinta-media">{desde}</span>
            </li>
          ))}
        </ul>
        <Nota tom="alerta">
          O histórico continua: encerrar não apaga o que já aconteceu.
        </Nota>
      </Modal>
    </main>
  )
}
