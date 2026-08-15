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

/**
 * O caminho de volta, documentado com o mesmo cuidado das rotas.
 *
 * Webhook é a parte que mais se implementa errado, e o erro é silencioso: quem
 * recebe pula a conferência da assinatura "para testar", nunca volta, e o
 * endereço vira uma porta pública onde qualquer um bate dizendo que uma aula
 * caiu. Por isso a conferência vem com código pronto, e não com prosa.
 */
export const WEBHOOK: Passo[] = [
  {
    titulo: 'Ligue o aviso',
    texto:
      'Na Verandi, em Configuração, Integrações, informe o endereço https do seu sistema. O segredo de assinatura aparece uma vez, na hora. Trocar o endereço gera um segredo novo, e o anterior para de valer.',
  },
  {
    titulo: 'O que chega',
    texto:
      'Um POST com o corpo abaixo. Três eventos hoje: participacao.criada, participacao.cancelada e sessao.cancelada. Ignore evento que você não conhece, porque outros vão aparecer.',
    codigo: `POST no seu endereço
Verandi-Event: participacao.cancelada
Verandi-Timestamp: 1786820400
Verandi-Signature: 9f86d0818...

{
  "evento": "participacao.cancelada",
  "eventoId": "b7c2...",
  "criadoEm": "2026-08-17T12:03:00.000Z",
  "dados": {
    "sessaoId": "a41f...", "data": "2026-08-18", "hora": "07:00",
    "servico": "Pilates solo", "profissional": "Marina",
    "participacaoId": "5e90...", "status": "falta_avisada", "origem": "avulso",
    "pessoaId": "77c0...", "pessoa": "Marina Alves", "telefone": "11988887777"
  }
}`,
  },
  {
    titulo: 'Confira a assinatura antes de confiar',
    texto:
      'A assinatura é um HMAC SHA-256 do texto instante.corpo, com o seu segredo. O instante entra na conta, e não só no cabeçalho: sem isso, quem gravasse uma entrega poderia repeti-la amanhã com a assinatura ainda válida. Recuse o que tiver mais de 5 minutos.',
    codigo: `const bruto = await req.text()
const instante = req.headers.get('Verandi-Timestamp')
const esperado = crypto.createHmac('sha256', SEGREDO)
  .update(\`\${instante}.\${bruto}\`).digest('hex')

if (esperado !== req.headers.get('Verandi-Signature')) return new Response(null, { status: 401 })
if (Math.abs(Date.now() / 1000 - Number(instante)) > 300) return new Response(null, { status: 401 })`,
  },
  {
    titulo: 'Responda rápido, e trate repetição',
    texto:
      'Qualquer resposta 2xx encerra a entrega. Qualquer outra coisa, ou 10 segundos sem resposta, faz a Verandi tentar de novo em 30 segundos, 2 minutos, 5 minutos, 15 minutos, 1 hora e 2 horas. Depois disso ela desiste e registra o erro. Como a reentrega existe, o mesmo evento pode chegar duas vezes: use o eventoId para descartar o que você já processou.',
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
