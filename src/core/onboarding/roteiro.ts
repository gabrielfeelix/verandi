import type { Papel } from '@/core/acesso/destino'
import type { Rotulos } from '@/core/vocabulario/padrao'

/**
 * Um apontamento: um balão sobre um pedaço de tela de verdade.
 *
 * `alvo` casa com o `data-guia` de um elemento real. Se ele não estiver na tela
 * (a conta ainda não tem nada, a pessoa mexeu na janela), o balão aparece no
 * meio, e o passo continua fazendo sentido: o texto diz o que a tela faz, não
 * "clique neste botão azul".
 */
export type Passo = {
  /** para onde o guia leva antes de mostrar o balão */
  href: string
  /** o `data-guia` do elemento apontado */
  alvo: string
  titulo: string
  texto: string
}

/**
 * O roteiro segue a jornada real, não o menu.
 *
 * Quem opera não configura: recepção e profissional não veem os dois primeiros
 * passos, do mesmo jeito que a lista "o que você vai poder fazer" do e-mail de
 * convite muda por papel. Ensinar alguém a mexer numa tela que o papel dela não
 * alcança é ensinar a bater numa porta trancada.
 *
 * O texto **nunca** escreve "aluno" ou "turma": as palavras vêm do vocabulário
 * da conta. Um tutorial que fala "aluno" para um barbeiro é pior do que não ter
 * tutorial.
 */
export function roteiroDe(papel: Papel, r: Rotulos): Passo[] {
  const pessoa = r.pessoa.singular.toLowerCase()
  const pessoas = r.pessoa.plural.toLowerCase()
  const servico = r.servico.singular.toLowerCase()
  const serie = r.serie.singular.toLowerCase()
  const sessao = r.sessao.singular.toLowerCase()
  const vaga = r.vaga.singular.toLowerCase()

  const chamada: Passo = {
    href: '/hoje',
    alvo: 'hoje-proxima',
    titulo: 'É aqui que o dia acontece',
    // "abrir" e não "clicar": quem lê está aprendendo o produto, não a interface
    texto: `Esta é a ${sessao} mais próxima. Abrindo ela você marca quem veio, quem faltou e quem avisou, e é dessa marcação que sai tudo o mais.`,
  }

  const dono: Passo[] = [
    {
      href: '/config',
      alvo: 'config-servicos',
      titulo: `Comece pelo que você oferece`,
      texto: `Cadastre pelo menos um ${servico}, quem atende e onde acontece. Sem isso não há o que colocar na agenda.`,
    },
    {
      href: '/grade',
      alvo: 'grade-criar',
      titulo: `Monte a semana uma vez só`,
      texto: `Um ${serie} se repete toda semana e faz as ${r.sessao.plural.toLowerCase()} nascerem sozinhas. Dá para criar vários dias de uma vez.`,
    },
    {
      href: '/pessoas',
      alvo: 'pessoas-novo',
      titulo: `Cadastre quem você atende`,
      texto: `Depois de cadastrar, a ficha da pessoa é onde se cria a ${vaga} dela num horário, e é ela que reserva o lugar toda semana.`,
    },
    chamada,
  ]

  const recepcao: Passo[] = [
    chamada,
    {
      href: '/pessoas',
      alvo: 'pessoas-novo',
      titulo: `Quem chegou agora entra por aqui`,
      texto: `Cadastre a ${pessoa} e crie a ${vaga} pela ficha dela. A busca acha por nome, telefone ou pedaço dos dois.`,
    },
    {
      href: '/vaga',
      alvo: 'vaga-busca',
      titulo: 'Quando alguém pergunta "tem horário?"',
      texto: `Aqui você responde sem abrir a semana inteira: diz o que a pessoa quer e a tela mostra onde cabe.`,
    },
    {
      href: '/pendencias',
      alvo: 'pendencias-lista',
      titulo: 'O que ficou esperando decisão',
      texto: `Falta a repor, ${pessoas} sem horário, aviso que chegou fora de hora. Nada some sozinho, e nada fica cobrando você fora daqui.`,
    },
  ]

  const profissional: Passo[] = [chamada]

  switch (papel) {
    case 'dono':          return dono
    case 'recepcao':      return recepcao
    case 'profissional':  return profissional
    // o suporte da 4YU não é cliente: não há o que ensinar a operar
    case 'suporte':       return []
  }
}
