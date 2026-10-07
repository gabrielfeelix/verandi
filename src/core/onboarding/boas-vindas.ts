import type { Papel } from '@/core/acesso/destino'
import type { Rotulos } from '@/core/vocabulario/padrao'

/**
 * As boas-vindas: o que é a Verandi, antes de a pessoa ver a primeira tela.
 *
 * Mesma régua do e-mail de convite: quem chega **não conhece o produto**, e um
 * sistema que abre direto numa agenda vazia não se explica. São quatro cartões
 * curtos, não um manual.
 *
 * ## A arte
 *
 * `arquivo` aponta hoje para as artes das telas de acesso, **de propósito e em
 * caráter provisório**: dá para ver a sequência montada e no lugar. Quando as
 * ilustrações próprias existirem, é só trocar o caminho aqui, nenhuma tela
 * lê nome de arquivo, todas leem esta tabela. As novas entram em
 * `public/onboarding/`, em webp, passando por `scripts/otimiza-arte.mjs`, e a
 * `descricao` muda junto: ela é o que o leitor de tela ouve.
 */
export type Cartao = {
  titulo: string
  texto: string
  arte: { arquivo: string; descricao: string; largura: string; topo: string }
}

/** provisória: a arte de `/entrar`, até a definitiva existir */
const QUADRO = {
  arquivo: '/acesso/quadro-horarios.webp',
  descricao: 'Duas pessoas diante de um quadro de horários',
  largura: '104%',
  topo: '-14px',
}

/** provisória: a arte de `/convite` */
const PORTA = {
  arquivo: '/acesso/porta-convite.webp',
  descricao: 'Pessoa sendo recebida por uma porta aberta',
  largura: '88%',
  topo: '-10px',
}

/** provisória: a arte de `/esqueci` */
const CHAVE = {
  arquivo: '/acesso/chave-gaveta.webp',
  descricao: 'Pessoa tirando uma chave de uma gaveta de cartões',
  largura: '108%',
  topo: '-6px',
}

/** provisória: a arte de `/nova-senha` */
const CADEADO = {
  arquivo: '/acesso/cadeado-montado.webp',
  descricao: 'Pessoa terminando de montar um cadeado',
  largura: '96%',
  topo: '-16px',
}

/**
 * O que a sequência promete muda com o papel: prometer a quem opera que ela vai
 * "configurar o negócio" é prometer uma tela que ela não alcança.
 */
export function boasVindas(papel: Papel, r: Rotulos): Cartao[] {
  const pessoas = r.pessoa.plural.toLowerCase()
  const sessao = r.sessao.singular.toLowerCase()
  const serie = r.serie.singular.toLowerCase()

  const comum: Cartao[] = [
    // quem dá aula não tem a semana nem a grade: prometer as duas é prometer
    // tela que não abre
    papel === 'profissional'
      ? {
          titulo: 'Seu dia em uma tela.',
          texto: `A agenda do dia, com horário, sala e ${pessoas}.`,
          arte: QUADRO,
        }
      : {
          titulo: 'A semana inteira em uma tela.',
          texto: `Agenda, ${pessoas}, presença e cobrança no mesmo lugar, geradas a partir da grade fixa.`,
          arte: QUADRO,
        },
    {
      titulo: 'Registro de presença.',
      texto: `Presença, falta, falta justificada e licença em poucos toques na tela de ${sessao}. O registro gera reposições, vagas livres e pendências.`,
      arte: PORTA,
    },
    {
      titulo: 'Falta justificada gera crédito.',
      texto: `A falta avisada libera o lugar e gera um crédito de reposição com prazo, controlado pelo sistema.`,
      arte: CHAVE,
    },
  ]

  if (papel === 'dono') {
    return [
      ...comum,
      {
        titulo: 'Vocabulário do seu negócio.',
        texto: `Defina as palavras usadas nas telas, como ${pessoas} e ${serie}. É possível ajustar depois em Configuração.`,
        arte: CADEADO,
      },
    ]
  }

  return [
    ...comum,
    {
      titulo: 'Histórico preservado.',
      texto: `Cada registro guarda autor e data. Correções ficam no histórico.`,
      arte: CADEADO,
    },
  ]
}
