/**
 * A referência da API, em dado estruturado.
 *
 * Mora aqui, e não num `.md`, pela mesma razão dos termos de uso: é tela. E por
 * uma segunda razão que só vale para documentação de API, que é o motivo de
 * quase toda documentação do mercado estar errada em algum ponto. Documentação
 * em arquivo separado envelhece em silêncio: alguém acrescenta um campo, ninguém
 * lembra do arquivo, e seis meses depois um integrador passa a tarde procurando
 * um campo que não existe mais. Aqui há teste conferindo que toda rota do código
 * está descrita, e que nenhuma rota descrita deixou de existir.
 *
 * O modelo de escrita é o da documentação do RD Station, e a régua é uma só:
 * **quem chega precisa fazer a primeira chamada funcionar antes de entender
 * qualquer conceito.** Por isso a página começa pela chave e por um `curl`
 * inteiro que responde, e só depois lista campo por campo. Sem tour, sem
 * "bem-vindo à nossa plataforma", sem explicar o que é REST.
 */

export type Campo = {
  nome: string
  tipo: string
  /** vazio quer dizer opcional; a tabela mostra isso na coluna */
  obrigatorio?: boolean
  descricao: string
}

export type Rota = {
  /** vira âncora, e é o que um integrador cola no chat do time */
  id: string
  metodo: 'GET' | 'POST' | 'DELETE'
  caminho: string
  titulo: string
  resumo: string
  /** o parágrafo que evita a pergunta que sempre chega por e-mail */
  atencao?: string
  parametros?: Campo[]
  corpo?: Campo[]
  exemplo: string
  resposta: string
}

export const BASE = 'https://verandi.4yu.com.br/api/v1'

export const ROTAS: Rota[] = [
  {
    id: 'catalogo',
    metodo: 'GET',
    caminho: '/catalogo',
    titulo: 'Catálogo',
    resumo:
      'Serviços, profissionais e locais ativos da conta, mais as palavras que este negócio usa para cada coisa. É por aqui que se começa: os identificadores daqui entram como filtro nas outras rotas.',
    atencao:
      'O vocabulário vem junto porque cada conta chama as coisas do jeito dela. Um estúdio diz "aula" e uma clínica diz "sessão"; quem escreve a mensagem para a pessoa deve usar a palavra da conta, não a nossa.',
    exemplo: `curl ${BASE}/catalogo \\
  -H "Authorization: Bearer vr_sua_chave_aqui"`,
    resposta: `{
  "servicos": [
    { "servicoId": "9f1c...", "nome": "Pilates solo", "duracaoMin": 60, "capacidadePadrao": 4 }
  ],
  "profissionais": [
    { "profissionalId": "2b7e...", "nome": "Marina" }
  ],
  "locais": [
    { "localId": "6d33...", "nome": "Sala 1" }
  ],
  "vocabulario": {
    "servico": { "singular": "Modalidade", "plural": "Modalidades" }
  }
}`,
  },
  {
    id: 'disponibilidade',
    metodo: 'GET',
    caminho: '/disponibilidade',
    titulo: 'Horários com vaga',
    resumo:
      'Os horários de um intervalo, separados em livres e cheios. É a rota que responde "tem aula quinta de manhã?".',
    atencao:
      'Ofereça apenas o que vier em livres. Horário cheio nunca entra nessa lista, nem quando falta pouco: a decisão de encaixar alguém acima da lotação é de quem está no balcão, olhando para a pessoa. cheios existe para o seu sistema saber a diferença entre "não há horário nesse dia" e "há, e está lotado", que são duas conversas diferentes.',
    parametros: [
      { nome: 'de', tipo: 'data', obrigatorio: true, descricao: 'primeiro dia, AAAA-MM-DD' },
      { nome: 'ate', tipo: 'data', obrigatorio: true, descricao: 'último dia, no máximo 90 dias depois de de' },
      { nome: 'servico', tipo: 'id', descricao: 'filtra por serviço' },
      { nome: 'profissional', tipo: 'id', descricao: 'filtra por quem atende' },
      { nome: 'local', tipo: 'id', descricao: 'filtra por sala' },
    ],
    exemplo: `curl "${BASE}/disponibilidade?de=2026-08-17&ate=2026-08-23" \\
  -H "Authorization: Bearer vr_sua_chave_aqui"`,
    resposta: `{
  "de": "2026-08-17",
  "ate": "2026-08-23",
  "livres": [
    {
      "sessaoId": "a41f...",
      "data": "2026-08-18", "hora": "07:00", "duracaoMin": 60,
      "servico": "Pilates solo",
      "profissionalId": "2b7e...", "profissional": "Marina",
      "localId": "6d33...", "local": "Sala 1",
      "capacidade": 4, "ocupadas": 2, "livres": 2
    }
  ],
  "cheios": []
}`,
  },
  {
    id: 'buscar-pessoa',
    metodo: 'GET',
    caminho: '/pessoas',
    titulo: 'Procurar uma pessoa',
    resumo:
      'Procura por nome, sem acento e sem diferenciar maiúscula. Chame sempre antes de cadastrar, senão a mesma pessoa vira três cadastros porque escreveu o nome de três jeitos.',
    parametros: [
      { nome: 'busca', tipo: 'texto', obrigatorio: true, descricao: 'no mínimo duas letras' },
    ],
    exemplo: `curl "${BASE}/pessoas?busca=marina" \\
  -H "Authorization: Bearer vr_sua_chave_aqui"`,
    resposta: `{
  "total": 1,
  "pessoas": [
    { "pessoaId": "77c0...", "nome": "Marina Alves", "telefone": "11988887777", "ativa": true }
  ]
}`,
  },
  {
    id: 'cadastrar-pessoa',
    metodo: 'POST',
    caminho: '/pessoas',
    titulo: 'Cadastrar uma pessoa',
    resumo: 'Cadastra quem a busca não achou. Nome é o único campo obrigatório.',
    atencao:
      'A rota não recusa nomes parecidos. "Ana" e "Ana Paula" podem ser a mesma pessoa ou duas, e quem sabe é a conversa, não o banco. Procure antes.',
    corpo: [
      { nome: 'nome', tipo: 'texto', obrigatorio: true, descricao: 'até 120 caracteres' },
      { nome: 'telefone', tipo: 'texto', descricao: 'como o negócio quiser guardar, até 40 caracteres' },
      { nome: 'identificadorExterno', tipo: 'texto', descricao: 'o código dessa pessoa no seu sistema, até 60 caracteres' },
    ],
    exemplo: `curl -X POST ${BASE}/pessoas \\
  -H "Authorization: Bearer vr_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: conversa-8f21a" \\
  -d '{ "nome": "Marina Alves", "telefone": "11988887777" }'`,
    resposta: `201 Created

{
  "pessoaId": "77c0...",
  "nome": "Marina Alves",
  "telefone": "11988887777",
  "ativa": true
}`,
  },
  {
    id: 'ficha',
    metodo: 'GET',
    caminho: '/pessoas/{pessoaId}',
    titulo: 'A agenda de uma pessoa',
    resumo:
      'Os horários fixos dela, o que vem pela frente e quantas reposições estão em aberto. É a rota que responde "quais são meus horários?" e "quantas aulas eu tenho para repor?".',
    atencao:
      'É daqui que sai o participacaoId, e sem ele não há como desmarcar. Guarde o identificador quando marcar, ou consulte esta rota antes de cancelar. Observação e data de nascimento nunca aparecem aqui: são dados de ficha, e ficha é da tela.',
    exemplo: `curl ${BASE}/pessoas/77c0... \\
  -H "Authorization: Bearer vr_sua_chave_aqui"`,
    resposta: `{
  "pessoaId": "77c0...",
  "nome": "Marina Alves",
  "telefone": "11988887777",
  "ativa": true,
  "situacao": "ativa",
  "ultimaPresenca": "2026-08-11",
  "horariosFixos": [
    { "vagaId": "13aa...", "diaSemana": 2, "hora": "07:00", "servico": "Pilates solo",
      "profissional": "Marina", "desde": "2026-03-02", "ate": null }
  ],
  "proximas": [
    { "participacaoId": "5e90...", "sessaoId": "a41f...", "data": "2026-08-18",
      "hora": "07:00", "servico": "Pilates solo", "origem": "recorrente", "status": "esperada" }
  ],
  "reposicoesAbertas": [
    { "participacaoId": "1c44...", "data": "2026-08-04", "hora": "07:00",
      "servico": "Pilates solo", "motivo": "falta_avisada" }
  ]
}`,
  },
  {
    id: 'marcar',
    metodo: 'POST',
    caminho: '/participacoes',
    titulo: 'Marcar em um horário',
    resumo:
      'Coloca uma pessoa em um horário. O sessaoId vem da rota de disponibilidade.',
    atencao:
      'A vaga é conferida no momento de gravar, e não no momento em que você leu a disponibilidade. Entre uma coisa e outra alguém pode ter ocupado, e nesse caso a resposta é 409. Trate o 409 como resposta normal do fluxo, não como falha.',
    corpo: [
      { nome: 'pessoaId', tipo: 'id', obrigatorio: true, descricao: 'quem vai' },
      { nome: 'sessaoId', tipo: 'id', obrigatorio: true, descricao: 'qual horário' },
      { nome: 'origem', tipo: 'texto', descricao: 'avulso (padrão), reposicao, encaixe ou reserva' },
      { nome: 'reposicaoDeId', tipo: 'id', descricao: 'obrigatório quando origem é reposicao: qual falta está sendo reposta' },
    ],
    exemplo: `curl -X POST ${BASE}/participacoes \\
  -H "Authorization: Bearer vr_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: conversa-8f21b" \\
  -d '{ "pessoaId": "77c0...", "sessaoId": "a41f..." }'`,
    resposta: `201 Created

{
  "participacaoId": "5e90...",
  "pessoaId": "77c0...",
  "sessaoId": "a41f...",
  "origem": "avulso",
  "status": "esperada"
}`,
  },
  {
    id: 'desmarcar',
    metodo: 'DELETE',
    caminho: '/participacoes/{participacaoId}',
    titulo: 'Desmarcar',
    resumo:
      'Registra que a pessoa avisou que não vem. A vaga volta a ser oferecida na mesma hora, e a pessoa ganha o crédito de reposição se a conta trabalhar assim.',
    atencao:
      'Apesar do verbo, nada é apagado: a marcação fica no histórico com o estado de falta avisada. É isso que preserva o crédito de reposição e a contagem do negócio. Só funciona para horário futuro; aula que já aconteceu tem a chamada feita por quem estava na sala.',
    exemplo: `curl -X DELETE ${BASE}/participacoes/5e90... \\
  -H "Authorization: Bearer vr_sua_chave_aqui"`,
    resposta: `{
  "participacaoId": "5e90...",
  "status": "falta_avisada",
  "jaEstavaAssim": false
}`,
  },
]
