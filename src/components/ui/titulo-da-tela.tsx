'use client'

import { useState, type ReactNode } from 'react'
import { Icone } from './icones'
import { Modal } from './modal'

type Passo = { titulo: string; texto: string }
type Ajuda = { titulo: string; resumo: string; passos: Passo[] }

/**
 * O passo a passo de cada tela, a um clique do título.
 *
 * Existe para a linha embaixo do título continuar curta: ela diz o estado
 * ("3 cobranças em atraso"), e o como-se-usa mora aqui, em vez de empurrar o
 * conteúdo para baixo. Mesmo `?` do cabeçalho, para ser lido como a mesma
 * coisa: ajuda. A diferença é o alcance, este explica só esta tela.
 */
const AJUDA = {
  hoje: {
    titulo: 'Hoje',
    resumo: 'O dia de trabalho, aula por aula.',
    passos: [
      { titulo: 'Veja quem vem', texto: 'Cada aula do dia aparece com a turma. "Minha agenda" mostra só as suas aulas; "Todos", as do estúdio. As setas trocam de dia.' },
      { titulo: 'Faça a chamada', texto: 'Abra a aula para marcar presença, falta ou falta avisada de cada pessoa.' },
      { titulo: 'Ache alguém rápido', texto: 'A busca do topo encontra a pessoa pelo nome e abre a ficha dela.' },
    ],
  },
  agenda: {
    titulo: 'Agenda',
    resumo: 'A semana ou o dia inteiro do estúdio.',
    passos: [
      { titulo: 'Escolha como ver', texto: '"Semana" mostra os sete dias; "Dia" mostra um só, com mais detalhe. As setas avançam e voltam no tempo.' },
      { titulo: 'Abra uma aula', texto: 'Clique na aula para ver a turma, fazer a chamada ou encaixar mais alguém.' },
      { titulo: 'Monte a grade fixa', texto: 'Em "Grade fixa" ficam as turmas que se repetem toda semana. A agenda nasce dela.' },
    ],
  },
  grade: {
    titulo: 'Grade fixa',
    resumo: 'As turmas que se repetem toda semana.',
    passos: [
      { titulo: 'Cadastre a turma', texto: 'Cada turma da grade tem dia, horário, modalidade, profissional e local.' },
      { titulo: 'A agenda nasce dela', texto: 'As aulas de cada semana saem da grade, sem precisar marcar uma por uma.' },
      { titulo: 'Exceção se resolve na Agenda', texto: 'Feriado, aula cancelada ou aula avulsa se resolvem na Agenda, sem mexer na grade.' },
    ],
  },
  pendencias: {
    titulo: 'Pendências',
    resumo: 'O que está em aberto, uma linha por pessoa.',
    passos: [
      { titulo: 'Leia o resumo', texto: 'Cada linha junta o que a pessoa tem em aberto, como faltas sem reposição. "Ver tudo" abre o detalhe de cada assunto.' },
      { titulo: 'Agende a reposição', texto: '"Agendar reposição" marca a aula ali mesmo e repõe a falta mais antiga. "Agendar" numa falta específica repõe aquela.' },
      { titulo: 'Leve para a planilha', texto: '"Exportar" baixa a lista inteira.' },
    ],
  },
  pessoas: {
    titulo: 'Cadastro',
    resumo: 'Todo mundo do estúdio, ativo ou parado.',
    passos: [
      { titulo: 'Busque', texto: 'Por nome, telefone ou número da ficha. Os filtros separam faltas recentes, quem está em licença, plano a renovar e cadastro sem telefone.' },
      { titulo: 'Abra a ficha', texto: 'A ficha reúne contrato, plano, aulas, faltas e reposições da pessoa.' },
      { titulo: 'Cadastre ou exporte', texto: 'O novo cadastro fica no topo da tela, e "Exportar" baixa a lista com os filtros aplicados.' },
    ],
  },
  financeiro: {
    titulo: 'Financeiro',
    resumo: 'Cobranças, recebimentos e o fechamento do período.',
    passos: [
      { titulo: 'Separe pelas abas', texto: 'Em atraso, A vencer, Recebidas e Canceladas. "Fechamento" resume quanto entrou e quanto ficou em aberto.' },
      { titulo: 'Fique de olho no atraso', texto: 'O número laranja no menu é a quantidade de cobranças em atraso, à vista de qualquer tela.' },
      { titulo: 'Recibos e aulas por professor', texto: 'Moram aqui dentro do Financeiro. "Exportar" baixa as cobranças.' },
    ],
  },
  config: {
    titulo: 'Configuração',
    resumo: 'Como o estúdio funciona dentro do sistema.',
    passos: [
      { titulo: 'Serviços e planos', texto: 'O que o estúdio vende e por quanto.' },
      { titulo: 'Equipe', texto: 'Quem dá aula e quem acessa o sistema, com o papel de cada um.' },
      { titulo: 'Funcionamento', texto: 'Horários, locais e os padrões das aulas.' },
      { titulo: 'Recibo, vocabulário e integrações', texto: 'O modelo do recibo, os nomes que as telas usam (aluno ou paciente, aula ou sessão) e a ligação com outros sistemas.' },
    ],
  },
} satisfies Record<string, Ajuda>

export type TelaComAjuda = keyof typeof AJUDA

/** O título da tela com o `?` dela ao lado. */
export function TituloDaTela({ tela, children }: { tela: TelaComAjuda; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const ajuda: Ajuda = AJUDA[tela]

  return (
    <div className="flex items-center gap-2.5">
      <h1 className="font-titulo text-[28px] leading-[1.05] font-semibold tracking-[-.02em]">{children}</h1>
      <button
        type="button"
        data-imprimir="fora"
        onClick={() => setAberto(true)}
        title={`Como funciona: ${ajuda.titulo}`}
        aria-label={`Como funciona: ${ajuda.titulo}`}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-tinta-fraca transition-colors duration-150 hover:bg-superficie hover:text-marca"
      >
        <Icone nome="ajuda" tamanho={18} />
      </button>

      <Modal
        aberto={aberto}
        icone="ajuda"
        titulo={ajuda.titulo}
        sub={ajuda.resumo}
        secundario="Entendi"
        aoFechar={() => setAberto(false)}
      >
        <ol className="flex flex-col gap-4">
          {ajuda.passos.map((p, i) => (
            <li key={p.titulo} className="flex gap-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-positivo-fundo text-[12px] font-bold text-marca tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold">{p.titulo}</p>
                <p className="pt-0.5 text-[13.5px] leading-relaxed text-tinta-media">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Modal>
    </div>
  )
}
