/**
 * A promessa que cada tela de acesso faz, e a arte que a acompanha.
 *
 * Transcrição fiel de `arteAuth` no protótipo: quem edita o texto de uma tela de
 * acesso edita aqui, não no meio do formulário. As quatro artes vêm na mesma
 * moldura de 1448×1086 e são posicionadas por porcentagem dela — por isso a
 * geometria mora junto da arte, e não espalhada por três páginas.
 */
export type TelaAcesso =
  | 'entrar'
  | 'esqueci'
  | 'enviado'
  | 'nova-senha'
  | 'convite'
  | 'contas'

type Arte = {
  arquivo: string
  /** texto alternativo — a arte é decorativa, mas quem usa leitor de tela escolhe */
  descricao: string
  /** largura em % da moldura do painel, do protótipo */
  largura: string
  /** deslocamento vertical, do protótipo */
  topo: string
}

const QUADRO: Arte = {
  arquivo: '/acesso/quadro-horarios.webp',
  descricao: 'Duas pessoas diante de um quadro de horários',
  largura: '104%',
  topo: '-14px',
}

const CHAVE: Arte = {
  arquivo: '/acesso/chave-gaveta.webp',
  descricao: 'Pessoa tirando uma chave de uma gaveta de cartões',
  largura: '108%',
  topo: '-6px',
}

const CADEADO: Arte = {
  arquivo: '/acesso/cadeado-montado.webp',
  descricao: 'Pessoa terminando de montar um cadeado',
  largura: '96%',
  topo: '-16px',
}

const PORTA: Arte = {
  arquivo: '/acesso/porta-convite.webp',
  descricao: 'Pessoa sendo recebida por uma porta aberta',
  largura: '88%',
  topo: '-10px',
}

export const ACESSO: Record<
  TelaAcesso,
  { titulo: string; texto: string; arte: Arte }
> = {
  entrar: {
    titulo: 'A agenda inteira em uma tela só.',
    texto:
      'Chamada em dois toques, reposição sem planilha e a semana inteira visível de uma vez.',
    arte: QUADRO,
  },
  esqueci: {
    titulo: 'Acontece.\nEm um minuto você volta.',
    texto:
      'Mandamos um link temporário para o e-mail da sua conta. Ninguém mais consegue usá-lo.',
    arte: CHAVE,
  },
  enviado: {
    titulo: 'Olha na caixa de entrada.',
    texto:
      'O link chega em segundos e vale por 30 minutos. Se não vier, dá para pedir outro.',
    arte: CHAVE,
  },
  'nova-senha': {
    titulo: 'Última coisa antes de entrar.',
    texto:
      'Escolha uma senha que você lembre. Você pode trocá-la depois em Configuração.',
    arte: CADEADO,
  },
  convite: {
    titulo: 'Seu lugar no estúdio já está pronto.',
    texto:
      'Quem convidou já definiu o que você pode fazer. É só criar a senha e começar.',
    arte: PORTA,
  },
  contas: {
    titulo: 'Você trabalha em mais de um lugar.',
    texto:
      'Escolha onde vai operar agora. A conta ativa fica visível em todas as telas.',
    arte: QUADRO,
  },
}
