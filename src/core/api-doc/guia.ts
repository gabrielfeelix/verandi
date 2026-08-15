import { BASE } from './referencia'

/**
 * O texto que vem antes da lista de rotas.
 *
 * Curto por decisão. Documentação de API pequena falha por excesso, não por
 * falta: quem chega quer fazer uma chamada funcionar em dois minutos, e cada
 * parágrafo entre a pessoa e o primeiro `curl` é um motivo a mais para ela
 * fechar a aba. Conceito só aparece aqui quando a integração quebra sem ele.
 */

export type Passo = { titulo: string; texto: string; codigo?: string }

export const ABERTURA =
  'A Verandi expõe a agenda de um estúdio ou clínica para outros sistemas: consultar horários com vaga, cadastrar quem é atendido, marcar e desmarcar. Esta página é tudo que existe, e dá para fazer a primeira chamada em dois minutos.'

export const COMECAR: Passo[] = [
  {
    titulo: '1. Pegue a chave',
    texto:
      'Na Verandi, entre em Configuração, Integrações, e clique em Ligar. A chave aparece uma vez e não volta a aparecer: guarde na hora. Se perder, revogue e crie outra.',
  },
  {
    titulo: '2. Faça a primeira chamada',
    texto:
      'Se voltar o catálogo do negócio, está tudo certo, e você já tem os identificadores para usar no resto.',
    codigo: `curl ${BASE}/catalogo \\
  -H "Authorization: Bearer vr_sua_chave_aqui"`,
  },
  {
    titulo: '3. Trate o 401',
    texto:
      'Chave ausente, errada, revogada ou de conta desligada dão a mesma resposta 401. É de propósito: distinguir uma da outra contaria a quem está tentando qual das portas já existiu.',
  },
]

export const REGRAS: Passo[] = [
  {
    titulo: 'Datas são sempre locais do negócio',
    texto:
      'Data é AAAA-MM-DD e hora é HH:MM, no fuso da conta. A API recusa instante em UTC, e essa recusa é um favor: a turma das 21h em Brasília é 00h do dia seguinte em UTC, e aceitar os dois formatos é como nasce a aula marcada no dia errado.',
  },
  {
    titulo: 'Repita à vontade, com Idempotency-Key',
    texto:
      'Toda escrita aceita o cabeçalho Idempotency-Key, com um valor que você escolhe. Se a mesma chamada chegar duas vezes com a mesma chave, a segunda recebe a mesma resposta e nada acontece duas vezes. Use um identificador da sua conversa ou do seu evento. Mesma chave com conteúdo diferente é recusada com 422, porque isso não é reentrega, é engano.',
    codigo: `-H "Idempotency-Key: conversa-8f21a"`,
  },
  {
    titulo: 'O que a integração não faz',
    texto:
      'Não cria nem altera grade, serviço, profissional, local ou capacidade: isso é configuração, e configuração é da tela. Não apaga nada. Não lê nem escreve observação, que é onde o negócio anota informação de saúde. E não marca ninguém em horário cheio, mesmo quando a conta permite encaixe acima da lotação para quem está no balcão.',
  },
  {
    titulo: 'Erros',
    texto:
      'Todo erro tem a mesma forma, e quando o problema é um campo específico ele vem nomeado. 400 é pedido malformado; 401 é chave; 404 é recurso que não é desta conta; 409 é regra de negócio, como horário cheio ou pessoa já marcada; 422 é a mesma Idempotency-Key com outro conteúdo; 500 é nosso.',
    codigo: `{ "erro": "o intervalo não pode passar de 90 dias", "campo": "ate" }`,
  },
  {
    titulo: 'Versão',
    texto:
      'O caminho começa com /v1. Dentro de uma versão, campo novo pode aparecer sem aviso, e campo existente não muda de significado nem some. Escreva seu cliente ignorando o que não conhece.',
  },
]
