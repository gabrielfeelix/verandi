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
  const pessoa = r.pessoa.singular.toLowerCase()
  const servico = r.servico.singular.toLowerCase()
  const series = r.serie.plural.toLowerCase()
  const sessoes = r.sessao.plural.toLowerCase()
  const vaga = r.vaga.singular.toLowerCase()

  /** A abertura, igual para todo mundo: onde se trabalha, e o menu. */
  const abertura: Passo[] = [
    {
      href: '/hoje',
      alvo: 'tela',
      titulo: 'Esta é a sua tela de trabalho',
      texto: `Aqui fica o dia: quem vem, a que horas e com quem. Vou levar você por cada parte do sistema, e dá para parar quando quiser.`,
    },
    {
      href: '/hoje',
      alvo: 'hoje-proxima',
      titulo: 'O que vem agora fica em destaque',
      texto: `Abrindo, você marca quem veio, quem faltou e quem avisou. É dessa marcação que sai todo o resto: reposição, vaga livre e pendência.`,
    },
  ]

  /** Cada destino do menu: primeiro o item, depois o que há dentro. */
  const hoje: Passo[] = [
    {
      href: '/hoje',
      alvo: 'rail-hoje',
      titulo: 'Este é o menu, e ele muda por pessoa',
      texto: `Cada item leva a uma tela. "Hoje" é onde você está: o dia inteiro, em ordem de horário.`,
    },
  ]

  const semana: Passo[] = [
    {
      href: '/hoje',
      alvo: 'rail-semana',
      titulo: 'A semana inteira, de uma vez',
      texto: `Quando a pergunta é "como está a quinta", é aqui. Dá para ver por dia, e por sala ou por quem atende.`,
    },
    {
      href: '/semana',
      alvo: 'tela',
      titulo: 'A grade da semana',
      texto: `Tudo aqui nasce sozinho do que você monta na grade fixa, ${sessoes} inclusive. Nada é digitado dia a dia.`,
    },
  ]

  const pendencias: Passo[] = [
    {
      href: '/semana',
      alvo: 'rail-pendencias',
      titulo: 'O que ficou esperando decisão',
      texto: `Falta a repor, gente sem horário, aviso fora de hora. O número em laranja é quanta coisa está esperando você.`,
    },
    {
      href: '/pendencias',
      alvo: 'pendencias-lista',
      titulo: 'Nada some sozinho daqui',
      texto: `Cada linha tem a saída ao lado: agendar a reposição, encaixar, ou dispensar dizendo por quê. Nada fica cobrando você fora desta tela.`,
    },
  ]

  const gente: Passo[] = [
    {
      href: '/pendencias',
      alvo: 'rail-pessoas',
      titulo: 'Quem você atende',
      texto: `A lista inteira, com busca por nome ou telefone, e os filtros de quem está sumindo e de quem você não consegue avisar. ${r.pessoa.plural}, no seu vocabulário.`,
    },
    {
      href: '/pessoas',
      alvo: 'pessoas-novo',
      titulo: 'Cadastrar leva dez segundos',
      texto: `Só o nome já basta. Na ficha de cada ${pessoa} se cria ${vaga} num horário, e é isso que reserva o lugar toda semana.`,
    },
  ]

  const vagaLivre: Passo[] = [
    {
      href: '/pessoas',
      alvo: 'rail-vaga',
      titulo: 'Quando perguntam "tem horário?"',
      texto: `Esta tela responde sem você abrir a semana inteira e ir procurando com o dedo.`,
    },
    {
      href: '/vaga',
      alvo: 'vaga-busca',
      titulo: 'Diga o que a pessoa quer',
      texto: `Diga o serviço, o dia e a faixa de horário. A tela mostra só onde ainda cabe alguém, e horário cheio nunca aparece aqui.`,
    },
  ]

  const grade: Passo[] = [
    {
      href: '/vaga',
      alvo: 'rail-grade',
      titulo: 'A grade fixa é o esqueleto',
      texto: `Aqui mora o que se repete toda semana, ${series}. Você mexe muito nela no começo e quase nunca depois.`,
    },
    {
      href: '/grade',
      alvo: 'grade-criar',
      titulo: 'Monte a semana de uma vez',
      texto: `Escolha os dias, a hora e quem atende, e ${sessoes} passam a nascer sozinhas. Dá para criar segunda, quarta e sexta numa tacada.`,
    },
  ]

  const config: Passo[] = [
    {
      href: '/grade',
      alvo: 'rail-config',
      titulo: 'A configuração é o que torna isto seu',
      texto: `É aqui que o sistema deixa de ser genérico: o que você oferece, quem atende, onde acontece, e as palavras que aparecem nas telas.`,
    },
    {
      href: '/config',
      alvo: 'config-servicos',
      titulo: 'Comece pelo que você oferece',
      texto: `Cadastre pelo menos isto: ${servico}, quem atende e onde acontece. Sem os três não há o que colocar na agenda.`,
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
