import type { Papel } from '@/core/acesso/destino'
import type { Rotulos } from '@/core/vocabulario/padrao'

/**
 * Um apontamento: um balão sobre um pedaço de tela de verdade.
 *
 * `alvo` casa com o `data-guia` de um elemento real. Quando ele não existe
 * naquela conta (a agenda ainda está vazia, a lista não tem ninguém), o guia
 * aponta a área de trabalho inteira, que é o `data-guia="tela"` do layout: o
 * passo continua fazendo sentido, porque o texto diz o que a tela faz, e não
 * "clique neste botão".
 */
export type Passo = {
  /** para onde o guia vai antes de mostrar o balão */
  href: string
  /** o `data-guia` do elemento apontado */
  alvo: string
  titulo: string
  texto: string
}

/**
 * O roteiro é uma visita guiada, na ordem em que alguém aprenderia o sistema:
 * primeiro a tela onde se trabalha, depois **o menu**, e então cada destino,
 * um por vez, com o que há dentro dele.
 *
 * O menu vem cedo de propósito. Sem ele a pessoa aprende quatro telas soltas e
 * não descobre que existem as outras cinco; com ele, o resto da visita tem onde
 * se pendurar.
 *
 * Quem opera não configura: recepção e profissional não veem os passos de
 * configuração, do mesmo jeito que a lista "o que você vai poder fazer" do
 * e-mail de convite muda por papel. Ensinar alguém a mexer numa tela que o papel
 * dela não alcança é ensinar a bater numa porta trancada.
 *
 * O texto **nunca** escreve "aluno" ou "turma": as palavras vêm do vocabulário
 * da conta. Um tutorial que fala "aluno" para um barbeiro é pior do que não ter
 * tutorial.
 *
 * E **nunca põe artigo colado na palavra do vocabulário**. "Um serviço" vira
 * "um modalidade", "os horários fixos" vira "os turmas fixas", "a ficha da
 * pessoa" vira "a ficha da aluno". O gênero é da palavra, e a palavra é do
 * cliente: quem escreve não pode saber qual vai ser. Onde o artigo seria
 * inevitável, a frase muda, e há teste guardando isto.
 */
export function roteiroDe(papel: Papel, r: Rotulos): Passo[] {
  const pessoas = r.pessoa.plural.toLowerCase()
  const servico = r.servico.singular.toLowerCase()
  const series = r.serie.plural.toLowerCase()
  const sessao = r.sessao.singular.toLowerCase()
  const vaga = r.vaga.singular.toLowerCase()

  /** A abertura, igual para todo mundo: onde se trabalha, e o menu. */
  const abertura: Passo[] = [
    {
      href: '/hoje',
      alvo: 'tela',
      titulo: 'Esta é a sua tela de trabalho',
      texto: papel === 'profissional'
        ? `Aqui fica a sua agenda do dia, com horário, sala e ${pessoas}. São dois passos, e o roteiro pode ser encerrado a qualquer momento.`
        : `Aqui fica a agenda do dia, com horário, sala e ${pessoas}. Este roteiro apresenta cada parte do sistema e pode ser encerrado a qualquer momento.`,
    },
    {
      href: '/hoje',
      alvo: 'hoje-proxima',
      titulo: 'Próximo horário em destaque',
      texto: `Na tela de ${sessao}, registre presença, falta, falta justificada ou licença. Esse registro gera reposições, vagas livres e pendências.`,
    },
  ]

  /** Cada destino do menu: primeiro o item, depois o que há dentro. */
  const hoje: Passo[] = [
    {
      href: '/hoje',
      alvo: 'rail-hoje',
      titulo: 'Menu principal',
      texto: `Os itens variam conforme o perfil de acesso. "Hoje" mostra o dia inteiro, em ordem de horário.`,
    },
  ]

  const semana: Passo[] = [
    {
      href: '/hoje',
      alvo: 'rail-semana',
      titulo: 'Agenda da semana',
      texto: `Visão da semana inteira. Também é possível ver um dia por local ou por profissional.`,
    },
    {
      href: '/semana',
      alvo: 'tela',
      titulo: 'A grade da semana',
      texto: `A agenda é gerada a partir da grade fixa, sem cadastro dia a dia.`,
    },
  ]

  const pendencias: Passo[] = [
    {
      href: '/semana',
      alvo: 'rail-pendencias',
      titulo: 'Itens que pedem decisão',
      texto: `Chamadas não registradas, reposições em aberto, licenças e cadastros incompletos. O número do menu indica quantos itens aguardam.`,
    },
    {
      href: '/pendencias',
      alvo: 'pendencias-lista',
      titulo: 'Cada item tem uma ação',
      texto: `Agende a reposição, faça o encaixe ou dispense o item informando o motivo.`,
    },
  ]

  const gente: Passo[] = [
    {
      href: '/pendencias',
      alvo: 'rail-pessoas',
      titulo: `Cadastro de ${r.pessoa.plural.toLowerCase()}`,
      texto: `Busca por nome, telefone ou nº da ficha, com filtros de faltas recentes, licença, plano a renovar e cadastro sem telefone.`,
    },
    {
      href: '/pessoas',
      alvo: 'pessoas-novo',
      titulo: 'Cadastro rápido',
      texto: `Apenas o nome é obrigatório. Na ficha, ${vaga} em um horário reserva o lugar toda semana.`,
    },
  ]

  const vagaLivre: Passo[] = [
    {
      href: '/semana',
      alvo: 'agenda-vaga',
      titulo: 'Consultar horários com vaga',
      texto: `O filtro "Só com vaga" mostra apenas horários disponíveis. Para agendar, abra a ficha e use Marcar ${sessao}.`,
    },
  ]

  // a grade fixa é uma aba da Agenda: o passo abre direto nela
  const grade: Passo[] = [
    {
      href: '/grade',
      alvo: 'grade-criar',
      titulo: 'Grade fixa',
      texto: `O que se repete toda semana: ${series}. Defina dia, hora e profissional, e a agenda é gerada automaticamente.`,
    },
  ]

  const config: Passo[] = [
    {
      href: '/grade',
      alvo: 'rail-config',
      titulo: 'Configuração da conta',
      texto: `Serviços, equipe, locais, funcionamento e os nomes usados nas telas.`,
    },
    {
      href: '/config',
      alvo: 'config-servicos',
      titulo: 'Primeiro passo',
      texto: `Cadastre ${servico}, profissional e local antes de montar a agenda.`,
    },
  ]

  switch (papel) {
    case 'dono':
      return [
        ...abertura, ...hoje, ...semana, ...pendencias, ...gente,
        ...vagaLivre, ...grade, ...config,
      ]
    case 'recepcao':
      return [...abertura, ...hoje, ...semana, ...pendencias, ...gente, ...vagaLivre]
    case 'profissional':
      // ela não navega o sistema: opera a aula que está na frente dela
      return abertura
    // o suporte da 4YU não é cliente: não há o que ensinar a operar
    case 'suporte':
      return []
  }
}
