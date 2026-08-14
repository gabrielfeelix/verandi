import { NOME_PAPEL } from '@/core/acesso/papeis'
import { COR, botao, casca, destaque, escapa, item } from './leiaute'

/**
 * O e-mail que a pessoa convidada recebe.
 *
 * Puro de propósito: dá para conferir o texto, o escape e a estrutura sem subir
 * servidor nem mandar e-mail nenhum.
 *
 * A régua do conteúdo é uma só — **quem recebe não conhece a Verandi.** É a
 * recepcionista que a dona acabou de contratar. Ela precisa entender, em três
 * segundos, de quem é o convite, o que é isto, e o que fazer. Um e-mail que
 * abre falando do produto é um e-mail que ela apaga.
 *
 * Por isso o nome do estúdio vem antes do nosso, o que ela vai poder fazer é
 * dito com verbo do dia dela ("marcar quem veio") e não com nome de tela, e o
 * tom é de quem fala com gente: frases curtas, sem "prezado", sem "realizar o
 * procedimento de cadastro".
 */

/**
 * Um nome apresentável a partir do e-mail de quem convidou.
 *
 * Só temos o endereço — o produto não pede nome de usuário em lugar nenhum. E
 * "joana@estudiolotus.com.br te convidou" é frio do jeito que um e-mail de
 * boas-vindas não pode ser.
 *
 * O palpite erra às vezes (`contato@` vira "Contato"), e por isso o endereço
 * completo continua visível logo abaixo: quem quiser conferir de quem veio,
 * confere. Chutar o nome e esconder a fonte é que seria ruim.
 */
export function apelidoDe(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ') || email
}

export type DadosDoConvite = {
  nomeDaConta: string
  papel: string
  link: string
  quemConvidou: string | null
  diasAteExpirar: number
}

/**
 * O que muda de verdade entre um papel e outro.
 *
 * Não é enfeite: é a diferença entre "criei uma conta em mais um sistema" e
 * "entendi para que serve isto no meu dia". Genérico demais não informa
 * ninguém.
 */
const OQUE_VOCE_FAZ: Record<string, [string, string][]> = {
  dono: [
    ['Ver a semana inteira num lugar', 'Quem vem, quem faltou, qual sala está livre.'],
    ['Montar os horários fixos', 'Cria a grade uma vez; as aulas aparecem sozinhas.'],
    ['Convidar seu time', 'Cada pessoa entra com o acesso que faz sentido para ela.'],
  ],
  recepcao: [
    ['Marcar quem veio', 'A chamada do dia em um toque, direto do balcão.'],
    ['Encaixar quem chegou de última hora', 'Você vê na hora se cabe, e em qual horário.'],
    ['Achar um horário livre', 'Sem abrir planilha e sem perguntar para ninguém.'],
  ],
  profissional: [
    ['Ver as suas turmas do dia', 'Quem está marcado, e quem avisou que não vem.'],
    ['Registrar presença e falta', 'Fica guardado. Ninguém precisa lembrar depois.'],
    ['Saber quem está repondo', 'A reposição aparece ligada à falta que a gerou.'],
  ],
}

const PADRAO: [string, string][] = [
  ['Ver a agenda do dia', 'Quem vem, a que horas, com quem.'],
  ['Registrar o que aconteceu', 'Presença, falta e reposição no mesmo lugar.'],
]

export function montaConvite(d: DadosDoConvite): {
  assunto: string
  html: string
  texto: string
} {
  const papel = NOME_PAPEL[d.papel] ?? d.papel
  const faz = OQUE_VOCE_FAZ[d.papel] ?? PADRAO

  const assunto = `Seu acesso ao ${d.nomeDaConta} está pronto`
  const quem = d.quemConvidou ? apelidoDe(d.quemConvidou) : null
  const convite = quem
    ? `${quem} te convidou para acessar a agenda do ${d.nomeDaConta}.`
    : `Você foi convidado para acessar a agenda do ${d.nomeDaConta}.`

  // ------------------------------------------------------------------ texto
  const texto = [
    `Oi!`,
    '',
    convite,
    ...(d.quemConvidou ? ['', `Convite enviado por ${d.quemConvidou}.`] : []),
    '',
    `Seu acesso é de ${papel}. Com ele você vai poder:`,
    '',
    ...faz.map(([t, s]) => `- ${t}: ${s}`),
    '',
    'Para começar, crie sua senha neste endereço:',
    d.link,
    '',
    `O convite vale por ${d.diasAteExpirar} dias.`,
    '',
    'Se você não esperava este e-mail, pode ignorar. Nada acontece enquanto',
    'você não criar a senha.',
    '',
    'Um abraço,',
    'Equipe Verandi',
  ].join('\n')

  // ------------------------------------------------------------------- html
  const corpo = `
    <p style="margin:0 0 18px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${COR.texto}">
      Oi! ${escapa(convite)}
    </p>
    <p style="margin:0 0 6px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COR.apoio}">
      Seu acesso é de <strong style="color:${COR.texto};font-weight:600">${escapa(papel)}</strong>. Falta só criar sua senha, e leva menos de um minuto.
    </p>
    ${
      d.quemConvidou
        ? `<p style="margin:0 0 24px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:${COR.fraco}">
      Convite enviado por ${escapa(d.quemConvidou)}
    </p>`
        : '<div style="height:18px"></div>'
    }

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 28px">
      ${botao('Criar minha senha', d.link)}
    </td></tr></table>

    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:${COR.fraco}">
      Se o botão não abrir, copie este endereço:<br>
      <span style="word-break:break-all;color:${COR.verde}">${escapa(d.link)}</span>
    </p>

    <p style="margin:0 0 16px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${COR.fraco}">
      O que você vai poder fazer
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${faz.map(([t, s]) => item(t, s)).join('')}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:10px 0 0">
      ${destaque(
        'Bom saber',
        `O convite vale por ${d.diasAteExpirar} dias. Se você não esperava este e-mail, pode ignorar. Nada acontece enquanto você não criar a senha.`,
      )}
    </td></tr></table>`

  const html = casca({
    preheader: `${convite} Falta só criar sua senha.`,
    eyebrow: 'Seu convite',
    titulo: `Boas-vindas ao ${d.nomeDaConta}`,
    corpo,
    conta: d.nomeDaConta,
  })

  return { assunto, html, texto }
}
