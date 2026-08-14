# Cadastre-se: quem cria conta, e quem entra na conta de alguém

Escrito em 14/08/2026 a partir de perguntas do Gabriel. **Nada disto foi
construído.** É análise e decisão proposta, para o handoff confirmar ou mudar.

## O buraco, em uma frase

Existe login e existe "esqueci a senha", mas **não existe "cadastre-se"**. Hoje
só a 4YU cria conta, por script. Quem descobre o produto e quer usar não tem
porta.

## O que o modelo já aguenta, e ninguém precisa refazer

Isto foi conferido no banco, não suposto:

- **A mesma pessoa em vários negócios.** A chave de `usuario_conta` é
  `(usuario_id, conta_id)`, com um `papel` por linha. Ela pode ser dona de um
  estúdio e professora em outro, hoje, sem migration.
- **Negócios de tipos diferentes.** O `vocabulario` é por conta, então a mesma
  pessoa vê "Aluno" num lugar e "Cliente" no outro. A troca acontece em
  `/contas` e o rótulo muda junto.
- **Mais de um negócio da mesma pessoa.** Mesma estrutura, nenhuma novidade.
- **O dono nunca vira suporte.** `PAPEIS_CONVIDAVEIS` exclui `suporte` de
  propósito: é o papel da 4YU, e conceder por cadastro seria escalada de
  privilégio em um clique.

**O que falta é a entrada, não o modelo.**

## A decisão que organiza tudo o resto

> **Quem se cadastra sozinho vira dono de um negócio novo. Entrar num negócio
> que já existe é sempre por convite.**

O caso do professor que se cadastra sozinho e "pede para entrar" no estúdio
parece simpático e é armadilha: cria fila de aprovação, cria notificação para
alguém que não pediu, cria o problema de o estúdio errado receber o pedido, e
cria uma conta órfã enquanto ninguém responde. Quem decide quem entra no negócio
é quem é dono dele, e isso já funciona pelo convite.

O custo dessa decisão é um caso real: o professor que se cadastra achando que
vai entrar no estúdio onde trabalha, e acaba com um negócio vazio no nome dele.
**A primeira pergunta do cadastro resolve isso**, e por isso ela vem antes de
qualquer outra:

> Você está montando a agenda do **seu** negócio, ou **alguém te convidou**?

Quem responde "me convidaram" não cadastra nada: recebe a instrução de pedir o
link para quem convidou, com a explicação de que o acesso nasce lá dentro.
Melhor uma tela que diz "não é por aqui" do que uma conta fantasma.

## Como o cadastro funciona por dentro

**O cadastro público não pode usar o `signup` do Supabase.** Ele está desligado
de propósito (`disable_signup: true`), e ligar de novo abriria a criação de
usuário no projeto compartilhado com o AutoFluxos para qualquer um.

O caminho é uma ação de servidor com a chave de serviço, e ela tem uma sutileza
que decide a qualidade da base:

> **A conta só nasce depois que a pessoa prova o e-mail.**

Cadastro que cria negócio na hora enche o banco de conta de teste, de erro de
digitação e de robô, e cada uma dessas consome cota de usuário do plano
gratuito. O fluxo certo:

1. A pessoa preenche e-mail e o nome do negócio.
2. Grava-se um **pedido de cadastro** pendente, com token, como o convite já
   faz. `convite` não serve porque exige `conta_id`, e aqui ainda não há conta:
   é tabela nova, ou `conta_id` anulável com o check ajustado.
3. Sai um e-mail com o link (mesma casca de `core/email/`, mesmo remetente).
4. No clique, e só então: cria o usuário, cria a conta, grava o vínculo `dono`,
   e apaga o pedido.
5. A pessoa cai direto no onboarding.

A resposta da tela é a mesma exista o e-mail ou não, pelo mesmo motivo do
"esqueci a senha": não entregar quem já é cliente para quem só tem um
formulário.

## As perguntas do cadastro, e a régua para elas

Onboarding e cadastro se encostam aqui, e a fronteira útil é esta: **o cadastro
pergunta o que a conta não existe sem; o onboarding ensina o resto.**

A régua para aceitar uma pergunta é uma só:

> **A resposta escreve uma linha no banco?** Se não escreve, é pesquisa de
> mercado, não cadastro. Corta.

| Pergunta | O que ela escreve | Onde |
|---|---|---|
| Seu negócio, ou te convidaram? | nada, decide o caminho | cadastro |
| Nome do negócio | `conta.nome`, `conta.slug` | cadastro |
| Que tipo de negócio? | `vocabulario` inteiro, por predefinição | cadastro |
| Trabalha sozinho ou com equipe? | se sozinho, cria o `profissional` com o nome dela e pula o passo de convidar | onboarding |
| O que você oferece? | `servico` com capacidade e duração | onboarding |
| Onde acontece? | `local` | onboarding |
| Que horas abre e fecha? | `funcionamento` | onboarding |

"Que tipo de negócio" vale a pena no cadastro e não no onboarding porque ela
muda **todos os rótulos das telas seguintes**. Perguntar depois faz a pessoa ver
"Pessoa" e "Sessão" na primeira tela e concluir que o sistema não é para ela.

Predefinições sugeridas, cada uma preenchendo `vocabulario` de uma vez: pilates
e estúdio de treino; salão e barbearia; clínica e consultório; **outro**, que
mantém o neutro e deixa ajustar em Configuração. A opção "outro" não é
enfeite: sem ela, alguém escolhe a predefinição errada só para conseguir passar
da tela.

## O que fica difícil, e é honesto dizer agora

**A professora que dá aula em dois estúdios vê duas agendas, não uma.**
`profissional` é por conta, então ela é duas linhas em dois negócios, e nada
liga as duas. Ver a agenda unificada exigiria disponibilidade entre contas, que
atravessa a RLS inteira: hoje uma consulta nunca cruza `conta_id`, e isso é a
espinha do isolamento.

**Não resolva isso agora.** É caro, mexe na parte mais sensível do sistema, e
resolve um problema que ainda não apareceu com cliente pagante. Quando aparecer,
o caminho provável não é unir as contas, é uma tela de leitura que consulta as
contas da pessoa uma a uma e junta na borda, sem afrouxar política nenhuma.

**Plano e cobrança não existem no modelo.** `conta` não tem coluna de plano,
como o [plano 04](04-vestir-telas.md) já anotava. Quando entrar, a decisão
importante é onde o limite mora: em `conta` (simples, e errado se um dia a
cobrança for por organização com vários negócios) ou numa tabela acima dela.
Vale decidir antes de escrever a primeira coluna.

**A palavra "admin" não existe no sistema, e é bom que não exista.** No modelo
há `dono` (do negócio), `recepcao`, `profissional` e `suporte` (da 4YU). Quem se
cadastra vira `dono`. Chamar qualquer um dos dois de "admin" na conversa é o
começo de alguém conceder o poder errado.

## Ordem sugerida

1. Tela e ação de cadastro, com pedido pendente e confirmação por e-mail.
2. A pergunta do tipo de negócio, com as predefinições de vocabulário.
3. Emendar no onboarding ([plano 05](05-onboarding.md)), que continua a
   configuração e ensina as telas.
4. Só depois: plano, cobrança, e a agenda entre contas, se alguém pedir.

O `scripts/cria-conta.mjs` continua existindo depois disso, como ferramenta de
suporte para quando alguém precisa de uma conta na mão.
