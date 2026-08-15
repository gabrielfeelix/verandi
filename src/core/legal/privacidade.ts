import {
  CONTATO,
  EMPRESA,
  SUBPROCESSADORES,
  VERSAO,
  VIGENTE_DESDE,
  type Documento,
} from './comum'

/**
 * Política de privacidade da Verandi.
 *
 * O documento inteiro gira em torno de uma frase: **a 4YU é operadora do dado
 * de quem é atendido e controladora do dado de quem tem login.** Misturar os
 * dois é o erro que faz um jurídico de clínica desconfiar do resto, e é o que
 * quase toda política de SaaS brasileiro faz.
 *
 * A segunda régua é não descrever segurança que não existe. Tudo que a seção
 * "como protegemos" afirma é conferível no repositório: a RLS tem teste por
 * tabela, o token e a chave guardam `sha256`, a observação tem coluna de
 * visibilidade com padrão fechado, o acesso do suporte tem tabela e faixa na
 * tela. O que ainda não existe, como cópia de segurança automática, não é
 * prometido aqui, e a lista do que falta está em `docs/juridico/README.md`.
 */

export const PRIVACIDADE: Documento = {
  slug: 'privacidade',
  titulo: 'Política de privacidade',
  resumo:
    'Quem responde pelo dado que passa pela Verandi, o que fazemos com ele, onde ele fica e como pedir o que é seu.',
  versao: VERSAO,
  vigenteDesde: VIGENTE_DESDE,
  secoes: [
    {
      id: 'os-dois-papeis',
      titulo: '1. Os dois papéis da 4YU, e por que eles não se misturam',
      blocos: [
        {
          tipo: 'p',
          texto:
            'A Verandi guarda dois tipos de dado pessoal que a lei trata de maneira diferente, e a 4YU tem um papel diferente em cada um.',
        },
        {
          tipo: 'lista',
          itens: [
            'Dado de quem é atendido pelo negócio: nome, telefone, presença, anotação. Quem coletou foi o estúdio ou a clínica, e é ele quem decide o que fazer com isso. Ele é o controlador; a 4YU é operadora, e só trata esses dados seguindo as instruções dele.',
            'Dado de quem tem login na Verandi: o dono, a recepção, o profissional. Aqui é a 4YU quem decide as finalidades, porque é ela quem oferece o sistema. Nesse caso a 4YU é controladora.',
          ],
        },
        {
          tipo: 'nota',
          texto:
            'Se você é atendido em um estúdio que usa a Verandi, você nunca contratou nada com a 4YU, e não precisava. Quem responde pelo seu cadastro é o negócio que atende você. Esta política explica o que fazemos com ele, e a seção 8 diz como exercer os seus direitos.',
        },
        {
          tipo: 'p',
          texto:
            'As instruções do controlador ficam por escrito no adendo de tratamento de dados, assinado junto com o contrato. Sem ele não há instrução documentada, e a 4YU não opera sem isso.',
        },
      ],
    },
    {
      id: 'operadora',
      titulo: '2. Quando a 4YU é operadora: o dado de quem é atendido',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O que o sistema guarda depende do que o negócio preenche. Os campos que existem são estes:',
        },
        {
          tipo: 'lista',
          itens: [
            'identificação: nome, telefone, e-mail, data de nascimento e um identificador do próprio negócio, quando ele usa um;',
            'operação da agenda: em quais horários a pessoa está marcada, presença, falta, falta avisada, licença, reposição e encaixe, com data e hora;',
            'marcações que o negócio cria para organizar o atendimento;',
            'observações escritas pelo negócio, tanto na ficha quanto na chamada do dia;',
            'a data de vencimento do plano, quando o negócio a usa como lembrete. A Verandi não processa pagamento e não guarda dado de cartão.',
          ],
        },
        {
          tipo: 'p',
          texto:
            'A 4YU trata esses dados com uma finalidade só: fazer o sistema funcionar para o negócio que contratou. Não há uso para publicidade, não há venda, não há cessão, e não há treino de modelo de inteligência artificial com o conteúdo das contas.',
        },
      ],
    },
    {
      id: 'dado-sensivel',
      titulo: '3. Anotação, saúde e quem enxerga',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Em estúdio e clínica, a caixa de observação recebe frase de saúde. "Lesão no ombro esquerdo" e "não pode carga axial" são dado sensível, e a lei trata dado de saúde com regra mais dura que o resto.',
        },
        {
          tipo: 'p',
          texto:
            'O sistema foi construído levando isso em conta, em duas decisões que ficam visíveis para quem usa:',
        },
        {
          tipo: 'lista',
          itens: [
            'toda observação, na ficha e na chamada, tem um campo dizendo quem pode ler: só quem atende, ou todo mundo da conta;',
            'o padrão fecha. Quem escreve às pressas entre uma turma e outra não vai lembrar de restringir depois, e o erro de deixar aberto é o que não tem volta. Quando o texto é restrito, a recepção vê que existe anotação, mas não lê o conteúdo, e não consegue escrever por cima dele.',
          ],
        },
        {
          tipo: 'p',
          texto:
            'A decisão de escrever esse tipo de informação é do negócio, não da 4YU. A Verandi não pede dado de saúde em nenhum campo obrigatório e não é sistema de prontuário.',
        },
      ],
    },
    {
      id: 'controladora',
      titulo: '4. Quando a 4YU é controladora: o dado de quem tem login',
      blocos: [
        {
          tipo: 'p',
          texto:
            'De quem usa o sistema com login, a 4YU guarda:',
        },
        {
          tipo: 'lista',
          itens: [
            'e-mail, senha (guardada como resumo criptográfico, nunca em texto legível) e o acesso que a pessoa tem em cada conta;',
            'o nome, quando a pessoa também é cadastrada como profissional que atende, e a foto, quando o negócio a inclui;',
            'convites enviados, com endereço, data, validade e se o e-mail chegou, voltou ou foi bloqueado pelo destino;',
            'registro do que foi configurado na conta, com quem fez e quando;',
            'registro de quando a equipe de suporte da 4YU entrou na conta;',
            'registro do aceite destes documentos, com data, versão aceita, endereço de rede e navegador usado. Ele existe para que a 4YU consiga demonstrar a que texto cada pessoa aderiu, e é guardado enquanto a relação durar.',
          ],
        },
        {
          tipo: 'p',
          texto:
            'As finalidades são dar acesso ao sistema, manter a segurança da conta, avisar o que precisa ser avisado, prestar suporte e cumprir o contrato. As bases legais são a execução do contrato, o cumprimento de obrigação legal e o legítimo interesse na segurança do serviço.',
        },
        {
          tipo: 'p',
          texto:
            'De quem procura a 4YU para conhecer o produto, guardamos nome, e-mail e telefone, pelo tempo da conversa comercial, para responder e acompanhar o interesse.',
        },
      ],
    },
    {
      id: 'cookies',
      titulo: '5. Cookies e medição',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O sistema da Verandi usa apenas os cookies necessários para funcionar: os que mantêm você conectado e o que lembra em qual conta você está trabalhando. Não há cookie de publicidade.',
        },
        {
          tipo: 'p',
          texto:
            'Dentro do sistema não há ferramenta de medição de audiência, nem rastreador de terceiro. O site institucional da 4YU tem regra própria, descrita na página de privacidade dele.',
        },
      ],
    },
    {
      id: 'subprocessadores',
      titulo: '6. Com quem os dados são compartilhados',
      blocos: [
        {
          tipo: 'p',
          texto:
            'A Verandi não vende e não cede dado a ninguém. Para funcionar, ela se apoia em três fornecedores, cada um com uma função:',
        },
        {
          tipo: 'tabela',
          cabecalho: ['Fornecedor', 'O que faz', 'Onde o dado fica'],
          linhas: SUBPROCESSADORES.map((s) => [s.nome, s.faz, s.onde]),
        },
        {
          tipo: 'p',
          texto:
            'O banco de dados e a aplicação que o lê ficam no Brasil, em São Paulo, e isso é escolha, não acaso: a aplicação rodava nos Estados Unidos e foi trazida para cá justamente para o dado não precisar sair do país. O que sai é o envio de e-mail, e ele fica declarado abaixo.',
        },
        {
          tipo: 'lista',
          itens: [
            'Forma e duração: o dado trafega de forma criptografada, de maneira contínua, enquanto durar o contrato com o negócio que contratou a Verandi.',
            'Finalidade: executar o próprio serviço contratado, e nada além disso. Nenhum fornecedor recebe os dados para uso próprio.',
            'União Europeia, para o envio de e-mail: a Autoridade Nacional de Proteção de Dados reconheceu o bloco como destino de grau de proteção adequado, pela Resolução 32/2026. A Brevo, por sua vez, tem fornecedores próprios nos Estados Unidos, e essa etapa segue as regras europeias. O que vai por e-mail é convite, senha e aviso, não a agenda.',
            'Estados Unidos, para a administração do serviço: a Supabase e a Vercel são empresas americanas, e a equipe delas pode alcançar a infraestrutura a partir de lá para mantê-la. A lei considera isso transferência internacional, porque disponibilizar acesso já basta, mesmo com o dado guardado aqui.',
          ],
        },
        {
          tipo: 'p',
          texto:
            'Cada fornecedor responde pela segurança do que trata, e a 4YU responde perante o cliente pela escolha deles. A íntegra das cláusulas que amparam a transferência é entregue a quem pedir, em até 15 dias, pelo endereço da seção 12.',
        },
        {
          tipo: 'p',
          texto:
            'Além disso, dados podem ser entregues a autoridade pública quando houver ordem legal para isso, e a 4YU avisa o cliente sempre que a lei permitir avisar.',
        },
        {
          tipo: 'p',
          texto:
            'A entrada de um fornecedor novo é comunicada ao cliente antes de passar a valer, e quem discordar de forma fundamentada pode encerrar o contrato sem ônus.',
        },
      ],
    },
    {
      id: 'prazo',
      titulo: '7. Por quanto tempo os dados ficam',
      blocos: [
        {
          tipo: 'lista',
          itens: [
            'Dado de quem é atendido: enquanto a conta do negócio existir, ou até o negócio apagar o cadastro. Quem decide o prazo é ele, porque é ele o controlador.',
            'Registro de operação da agenda: fica enquanto a conta existir, porque é o histórico do negócio.',
            'Convite: perde a validade sozinho no prazo dele, e o registro do envio fica para responder "este acesso foi concedido quando?".',
            'Chave de integração revogada: a linha fica, sem o segredo, para o histórico não apontar para uma chave que não existe mais.',
            'Depois do fim do contrato: 30 dias para o cliente pedir a cópia, e então eliminação ou anonimização, salvo o que a lei obrigar a guardar.',
          ],
        },
      ],
    },
    {
      id: 'direitos',
      titulo: '8. Os seus direitos, e a quem pedir',
      blocos: [
        {
          tipo: 'p',
          texto:
            'A lei brasileira garante ao titular confirmar se existe tratamento, acessar os dados, corrigir o que está errado, pedir anonimização ou eliminação, saber com quem foram compartilhados, pedir a portabilidade e revogar consentimento.',
        },
        {
          tipo: 'p',
          texto:
            'A quem pedir depende de qual dado é:',
        },
        {
          tipo: 'lista',
          itens: [
            'Se você é atendido em um estúdio ou clínica, peça ao negócio que atende você. Ele é quem decide, e o sistema dá a ele o botão para cumprir. A 4YU ajuda quando ele precisar, mas não atende no lugar dele.',
            `Se você tem login na Verandi, escreva para ${CONTATO.privacidade}.`,
          ],
        },
        {
          tipo: 'p',
          texto:
            'Em qualquer dos casos, a resposta sai em até 15 dias.',
        },
        {
          tipo: 'p',
          texto:
            'O titular também pode peticionar diretamente à Autoridade Nacional de Proteção de Dados, a ANPD, se entender que o pedido não foi atendido.',
        },
      ],
    },
    {
      id: 'anonimizacao',
      titulo: '9. Por que apagar significa anonimizar',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Quando alguém pede para ser apagado, a Verandi zera tudo que identifica a pessoa: nome, telefone, e-mail, data de nascimento, marcações e as observações escritas sobre ela, na ficha e nas chamadas. Depois disso não há como voltar atrás, e é justamente esse o ponto.',
        },
        {
          tipo: 'p',
          texto:
            'O que fica é a linha vazia no histórico de quem esteve em cada turma. O motivo é simples: apagar a linha inteira levaria junto o registro de presença de todas as outras pessoas daquela turma, e a contagem de ocupação do negócio passaria a mentir. O titular tem direito aos dados dele, não ao registro de operação de terceiros.',
        },
        {
          tipo: 'p',
          texto:
            'O atendimento ao pedido fica registrado, com quem atendeu e quando, e sem copiar o nome para o registro. Um registro que guardasse o nome seria a cópia do dado que acabou de ser apagado.',
        },
      ],
    },
    {
      id: 'seguranca',
      titulo: '10. Como protegemos',
      blocos: [
        {
          tipo: 'lista',
          itens: [
            'Isolamento entre contas feito pelo próprio banco de dados, tabela por tabela, e não só pela tela. Há teste automático conferindo isso a cada mudança.',
            'Token de convite e chave de integração guardados apenas como resumo criptográfico. Nem a 4YU consegue ler o segredo depois de criado.',
            'Senha guardada pelo serviço de autenticação, nunca em texto legível, com tamanho mínimo exigido.',
            'Observação com controle de quem lê, e padrão fechado.',
            'Foto de quem atende guardada em área privada, que exige autorização a cada leitura.',
            'Acesso da equipe de suporte registrado, avisado na tela e desfeito ao sair.',
            'Tráfego criptografado de ponta a ponta.',
            'Acesso de administração da 4YU restrito a quem precisa dele para operar o serviço.',
          ],
        },
        {
          tipo: 'p',
          texto:
            'Nenhum sistema é imune. Se acontecer um incidente de segurança com risco relevante, a 4YU avisa o cliente em até 24 horas contadas do momento em que tomar conhecimento, com o que se sabe até ali. Quem comunica à Autoridade Nacional de Proteção de Dados e aos titulares é o cliente, porque a lei dá esse dever a quem é controlador, e a 4YU entrega a ele tudo que for preciso para cumprir o prazo dele.',
        },
      ],
    },
    {
      id: 'criancas',
      titulo: '11. Crianças e adolescentes',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Estúdios e clínicas atendem criança e adolescente, e a agenda deles entra na Verandi como a de qualquer pessoa. Quem coleta esse dado e responde pelo consentimento do pai, da mãe ou do responsável é o negócio que atende, não a 4YU.',
        },
        {
          tipo: 'p',
          texto:
            'Ninguém com menos de 18 anos tem login na Verandi.',
        },
      ],
    },
    {
      id: 'encarregado',
      titulo: '12. Encarregado e contato',
      blocos: [
        {
          tipo: 'p',
          texto: `Assunto de dados pessoais, pedido de titular, dúvida de jurídico e comunicação de incidente: ${CONTATO.privacidade}.`,
        },
        {
          tipo: 'p',
          texto: `Outros assuntos do sistema: ${CONTATO.suporte}.`,
        },
        {
          tipo: 'p',
          texto: `Este é o canal de comunicação com o titular. A ${EMPRESA.nome} é operadora de pequeno porte e, nessa condição, a lei dispensa a indicação de um encarregado nomeado, exigindo em lugar dele um canal publicado. É este. Quem escreve para ele fala com quem responde pela ${EMPRESA.nome}.`,
        },
      ],
    },
    {
      id: 'mudancas',
      titulo: '13. Mudanças nesta política',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Esta política pode mudar. Toda versão traz número e data de vigência no topo, e mudança relevante é avisada por e-mail ao dono da conta antes de passar a valer.',
        },
      ],
    },
  ],
}
