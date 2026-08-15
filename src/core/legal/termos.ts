import { CONTATO, EMPRESA, VERSAO, VIGENTE_DESDE, type Documento } from './comum'

/**
 * Termos de uso da Verandi.
 *
 * Minuta escrita a partir do que o sistema faz, não de modelo de mercado. Cada
 * promessa daqui tem correspondente no código, e é por isso que ela pode ser
 * feita: o acesso do suporte é registrado porque existe `acesso_suporte`, o
 * segredo da chave não é recuperável porque a coluna guarda só o `sha256`, a
 * integração não decide nada porque `core/agenda/encaixe.ts` recusa horário
 * cheio antes de a rota existir.
 *
 * Onde o texto prometer o que o código não faz, é o texto que está errado.
 */

const identificacao = [
  EMPRESA.razaoSocial,
  EMPRESA.cnpj ? `CNPJ ${EMPRESA.cnpj}` : '',
  EMPRESA.endereco,
]
  .filter(Boolean)
  .join(', ')

export const TERMOS: Documento = {
  slug: 'termos',
  titulo: 'Termos de uso',
  resumo:
    'O que a Verandi entrega, o que ela não faz, e o que acontece com o que está guardado nela quando a relação acaba.',
  versao: VERSAO,
  vigenteDesde: VIGENTE_DESDE,
  secoes: [
    {
      id: 'o-que-e',
      titulo: '1. O que é a Verandi',
      blocos: [
        {
          tipo: 'p',
          texto:
            'A Verandi é um sistema de agenda para estúdios e clínicas. Ela guarda os horários fixos, quem está marcado, quem veio, quem faltou e quem tem reposição a fazer. É uma ferramenta de operação do dia, e nada além disso.',
        },
        {
          tipo: 'p',
          texto: identificacao
            ? `A Verandi é oferecida pela ${EMPRESA.nome} (${identificacao}), pelo endereço ${EMPRESA.site}.`
            : `A Verandi é oferecida pela ${EMPRESA.nome}, pelo endereço ${EMPRESA.site}.`,
        },
        {
          tipo: 'p',
          texto:
            'Usar a Verandi significa aceitar estes termos. Quem não concorda com eles não deve usar o sistema, e pode pedir o encerramento da conta a qualquer momento.',
        },
      ],
    },
    {
      id: 'quem-e-quem',
      titulo: '2. As três figuras deste texto',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Este documento fala o tempo todo de três figuras diferentes, e confundi-las é o que faz um contrato de software não servir para nada:',
        },
        {
          tipo: 'lista',
          itens: [
            'O cliente é o negócio que contrata a Verandi. A conta é dele, e o que está dentro dela também.',
            'O usuário é quem entra com login: o dono, a recepção, o profissional que atende. Cada um com o acesso que o dono concedeu.',
            'Quem é atendido é a pessoa cujo horário está na agenda. Ela não tem login, não é usuária da Verandi, e o cadastro dela foi feito pelo cliente, não pela 4YU.',
          ],
        },
        {
          tipo: 'nota',
          texto:
            'Essa separação não é formalidade. Ela é o que decide, no resto deste texto e na política de privacidade, quem responde pelo quê.',
        },
      ],
    },
    {
      id: 'a-conta',
      titulo: '3. Como a conta nasce, e quem responde por ela',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Não existe cadastro público na Verandi. A conta é criada pela 4YU a pedido do negócio, e o primeiro acesso vai para o e-mail de quem responde por ele.',
        },
        {
          tipo: 'p',
          texto:
            'A partir daí, quem manda na conta é o dono. É ele quem convida o resto do time, quem escolhe o acesso de cada pessoa e quem tira o acesso de quem saiu da empresa. A 4YU não decide isso por ninguém.',
        },
        {
          tipo: 'p',
          texto:
            'Cada login é de uma pessoa só. Senha compartilhada tira do cliente a única coisa que o registro do sistema garante, que é saber quem fez o quê.',
        },
      ],
    },
    {
      id: 'licenca',
      titulo: '4. O que a 4YU concede',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Enquanto o contrato estiver de pé e em dia, o cliente tem direito de usar a Verandi para operar a agenda do próprio negócio. Esse direito não é exclusivo, não é transferível e não permite sublicenciar.',
        },
        {
          tipo: 'p',
          texto:
            'O sistema continua sendo da 4YU. Nada aqui transfere código, marca, desenho de tela ou qualquer outro direito de propriedade intelectual.',
        },
      ],
    },
    {
      id: 'o-que-nao-pode',
      titulo: '5. O que não pode',
      blocos: [
        {
          tipo: 'lista',
          itens: [
            'Revender, alugar ou ceder o acesso a terceiro que não faça parte do negócio contratante.',
            'Copiar, decompilar ou tentar derivar o código do sistema.',
            'Tentar alcançar dado de outra conta, por qualquer caminho.',
            'Usar a chave de integração de um jeito que atrapalhe o funcionamento do serviço para os demais.',
            'Guardar na Verandi dado que a operação da agenda não pede: prontuário completo, laudo, exame, documento de identidade, cartão de crédito.',
            'Usar o que está na conta para mandar mensagem que quem é atendido não pediu para receber.',
          ],
        },
        {
          tipo: 'nota',
          texto:
            'O campo de observação existe para o que ajuda a atender bem naquele dia. Ele não é prontuário, e a Verandi não é sistema de registro clínico nem substitui o que a profissão do cliente exige guardar.',
        },
      ],
    },
    {
      id: 'os-dados-sao-seus',
      titulo: '6. O que está na conta é do cliente',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O conteúdo da conta pertence ao cliente. A 4YU trata esse conteúdo para prestar o serviço contratado, seguindo as instruções dele, e para mais nada. Em detalhe, isso quer dizer que a 4YU:',
        },
        {
          tipo: 'lista',
          itens: [
            'não vende, não cede e não usa esse conteúdo para publicidade;',
            'não usa esse conteúdo para treinar modelo de inteligência artificial;',
            'não fala com quem é atendido pelo cliente. A 4YU não manda e-mail nem mensagem para quem está na agenda, e não incluiu essas pessoas em lista nenhuma.',
          ],
        },
        {
          tipo: 'p',
          texto:
            'A 4YU pode usar números agregados, que não identificam pessoa nem negócio, para entender o uso e melhorar o produto.',
        },
      ],
    },
    {
      id: 'suporte',
      titulo: '7. Quando a equipe da 4YU entra na sua conta',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Para atender a um chamado ou manter o serviço de pé, a equipe de suporte da 4YU pode entrar na conta do cliente. Isso acontece com o mínimo necessário, e nunca em silêncio:',
        },
        {
          tipo: 'lista',
          itens: [
            'a entrada fica registrada, com quem entrou, quando começou e quando terminou;',
            'enquanto o suporte está dentro, o sistema mostra uma faixa dizendo isso em toda tela;',
            'o vínculo é temporário e é desfeito quando o suporte sai.',
          ],
        },
      ],
    },
    {
      id: 'integracao',
      titulo: '8. Chave de integração',
      blocos: [
        {
          tipo: 'p',
          texto:
            'A conta pode emitir uma chave para que um sistema de fora leia e escreva na agenda, como o atendimento automático por mensagem. A chave é da conta, não de quem a criou: quando essa pessoa sai da empresa, a integração continua funcionando.',
        },
        {
          tipo: 'p',
          texto:
            'O segredo da chave aparece uma vez, no momento em que ela é criada. A 4YU guarda apenas um resumo criptográfico dele e não consegue mostrá-lo de novo. Quem perde o segredo revoga a chave e emite outra.',
        },
        {
          tipo: 'p',
          texto:
            'O cliente responde pelo que a integração dele faz com a chave dele.',
        },
        {
          tipo: 'p',
          texto:
            'Por decisão de produto, quem chega pela integração não decide nada sozinho: horário cheio não é oferecido, e a integração não abre turma, não muda capacidade e não passa da lotação definida pelo cliente.',
        },
      ],
    },
    {
      id: 'disponibilidade',
      titulo: '9. Disponibilidade, e o que a 4YU não promete',
      blocos: [
        {
          tipo: 'p',
          texto:
            'A Verandi é oferecida em regime de melhor esforço. Não há garantia de tempo de resposta nem de disponibilidade em percentual, a não ser que a proposta assinada diga outra coisa.',
        },
        {
          tipo: 'p',
          texto:
            'Pode haver parada para manutenção e atualização. Quando a interrupção for previsível e longa, ela é avisada por e-mail antes.',
        },
        {
          tipo: 'p',
          texto:
            'A Verandi depende de fornecedores para hospedagem, banco de dados e envio de e-mail. Uma queda deles é uma queda aqui, e está listada na política de privacidade quem são eles.',
        },
        {
          tipo: 'p',
          texto:
            'E-mail que sai da Verandi pode ser barrado pelo provedor de destino, e isso está fora do alcance de qualquer fornecedor. Por isso convite e senha nova também podem ser gerados como link, na própria tela, sem depender de e-mail nenhum.',
        },
      ],
    },
    {
      id: 'preco',
      titulo: '10. Preço e pagamento',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O valor, a forma de pagamento e as condições de reajuste são os da proposta comercial aceita pelo cliente. A unidade de cobrança é a quantidade de pessoas em atendimento na conta, que o próprio sistema conta.',
        },
        {
          tipo: 'p',
          texto:
            'Em caso de atraso, a 4YU avisa antes de suspender o acesso, e a suspensão não apaga nada.',
        },
      ],
    },
    {
      id: 'encerramento',
      titulo: '11. Encerramento, e o que acontece com o que está guardado',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O cliente pode encerrar quando quiser, avisando por escrito. A 4YU pode encerrar em caso de descumprimento destes termos ou de falta de pagamento, também por escrito e com prazo para correção.',
        },
        {
          tipo: 'p',
          texto:
            'Depois do encerramento, o cliente tem 30 dias para pedir uma cópia do que estava na conta. A cópia é entregue em arquivo de formato aberto, em até 15 dias contados do pedido.',
        },
        {
          tipo: 'p',
          texto:
            'Passado esse prazo, os dados da conta são eliminados ou anonimizados, salvo o que a 4YU precise guardar por obrigação legal, e nesse caso apenas pelo tempo dessa obrigação.',
        },
      ],
    },
    {
      id: 'responsabilidade',
      titulo: '12. Responsabilidade de cada lado',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O cliente responde pelo que insere na Verandi, por ter base legal para tratar os dados de quem é atendido, e por quem ele deixa entrar na conta.',
        },
        {
          tipo: 'p',
          texto:
            'A 4YU responde pelo funcionamento do serviço e pela segurança do que está sob a guarda dela, nos termos da política de privacidade e do adendo de tratamento de dados.',
        },
        {
          tipo: 'nota',
          texto:
            'Limite de responsabilidade, em destaque porque limita um direito seu: a responsabilidade da 4YU fica limitada ao valor pago pelo cliente nos 12 meses anteriores ao evento. Esse limite não vale, e a responsabilidade é integral, em três casos: dolo ou culpa grave, quebra de sigilo, e dano causado por incidente de segurança de responsabilidade da 4YU.',
        },
      ],
    },
    {
      id: 'privacidade',
      titulo: '13. Privacidade',
      blocos: [
        {
          tipo: 'p',
          texto:
            'O tratamento de dados pessoais está descrito na política de privacidade, que faz parte destes termos. Para o cliente que trata dado de quem é atendido, vale também o adendo de tratamento de dados, que a 4YU assina junto com o contrato.',
        },
      ],
    },
    {
      id: 'mudancas',
      titulo: '14. Mudanças nestes termos',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Estes termos podem mudar. Toda versão traz número e data de vigência no topo, e as versões anteriores continuam disponíveis.',
        },
        {
          tipo: 'p',
          texto:
            'Mudança pequena, de redação ou de esclarecimento, entra com a publicação da versão nova. Mudança relevante, que altere preço, alcance do serviço, tratamento de dados, limite de responsabilidade ou foro, é avisada por e-mail ao dono da conta com 30 dias de antecedência e pede aceite novo no primeiro acesso depois de entrar em vigor.',
        },
        {
          tipo: 'p',
          texto:
            'Quem não concordar com a versão nova pode encerrar a conta antes de ela entrar em vigor, sem ônus e sem multa, com o direito de pedir a cópia descrito acima.',
        },
      ],
    },
    {
      id: 'lei',
      titulo: '15. Lei aplicável',
      blocos: [
        {
          tipo: 'p',
          texto:
            'Estes termos são regidos pela lei brasileira. As questões que não forem resolvidas entre as partes serão levadas ao foro do domicílio da 4YU, salvo disposição diferente no contrato assinado.',
        },
      ],
    },
    {
      id: 'contato',
      titulo: '16. Como falar com a gente',
      blocos: [
        {
          tipo: 'p',
          texto: `Para assunto de contrato e de uso do sistema: ${CONTATO.suporte}. Para assunto de dados pessoais e privacidade: ${CONTATO.privacidade}.`,
        },
      ],
    },
  ],
}
