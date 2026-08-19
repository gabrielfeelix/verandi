# Plano 13, o administrativo: da matrícula ao recibo

O que o Studio MGM Pilates pediu por escrito, lido com a régua da Verandi: isto
é **agendamento**, ou é **este cliente**? O documento original está em
`SISTEMA ADMINISTRATIVO PARA STUDIO MGM PILATES.docx`, na raiz do repositório, e
o desenho aprovado das telas está no canvas de 18/08 (`.desenho/`, fora do git).

Este arquivo é o **guarda-chuva**: o que o documento pede, o que já existe, o
que nasce, e em que ordem. Cada módulo ganha o seu plano detalhado quando chegar
a vez dele, e não antes: plano escrito com seis semanas de antecedência descreve
um sistema que já mudou, e foi o que a Tarefa 10 do plano 03 ensinou.

> **Revisto em 18/08, depois de ler o documento inteiro e conferir o código.**
> A primeira versão deste arquivo foi escrita a partir do resumo do documento, e
> oito pontos dela não sobreviveram ao encontro com o banco de verdade. Estão
> todos abaixo, na seção "O que quase deu errado". Quem for executar confere
> contra o repositório de novo, porque este texto envelhece e o código não.

## Os nove pedidos, e onde cada um está

| # | O documento pede | Estado | Onde |
|---|---|---|---|
| 1 | Cadastro de matrícula, com foto | **feito** | módulo 16, com CPF, endereço e os campos do papel |
| 2 | Planos e valores, com código | **feito** | módulo 15, no ar em 18/08 |
| 3 | Turmas e horários | **feito** | grade fixa, com o número da turma desde a `0054` |
| 4 | Controle financeiro, com sete relatórios | **feito** | módulos 17 e 18, no ar em 18/08 |
| 5 | Presenças e reposição | **feito** | desde o plano 02 |
| 6 | Cadastro de professores, com foto | **feito** | desde a `0038` |
| 7 | Aulas por professor | **nasce** | módulo 19 |
| 8 | Emissão de recibo | **feito** | módulo 18, no ar em 18/08 |
| 9 | Avaliação postural com fotos | **feito** | plano 14, no ar em 18/08 |

**Oito dos nove estão de pé desde 18/08.** Falta o item 7, aulas por professor,
que é o módulo 19. A espinha comercial inteira nasceu num dia: quanto custa,
quem contratou, quem pagou e o papel que comprova.

Uma leitura que só o documento deu, e vale escrever: o item 9 termina com "as
imagens deverão ser grandes (permitir ampliar)". O comparador do módulo 14 abre
as fotos lado a lado com linha de prumo; **ninguém conferiu se dá para ampliar
uma delas**. Quem for mexer no 19 olha isso antes, porque é uma frase pedida por
escrito e não custa nada.

**Nada disso vira coluna do MGM.** Os quinze planos de pilates, os vinte e sete
de terapia, as setenta turmas e as seis posições da avaliação são linhas que a
conta escreve, não `if` no código.

## O que se aproveita, e é muito

A tentação de um módulo financeiro é construir um sistema paralelo. Não é
preciso, e seria pior:

- **Turma já existe.** As 70 turmas do documento são `serie`, que já tem dia,
  hora, capacidade, profissional e local. Só falta o **número** que o documento
  usa para chamá-las.
- **Estar matriculado numa turma já existe.** É `vaga`: a pessoa ocupa a série a
  partir de uma data, e até outra. É o que a chamada, a reposição e a busca de
  vaga já leem.
- **Presença, falta e reposição já existem**, e é delas que sai o consumo de um
  pacote de dez sessões.
- **Ficha, foto e histórico já existem.**

Por isso a regra que segura o resto: **contrato não substitui a vaga, contrato
produz vaga**. Uma matrícula "2x por semana" cria duas vagas, e quem lê ocupação
continua lendo a mesma coisa que sempre leu. O contrário, fazer o contrato virar
a fonte da ocupação, obrigaria a reescrever chamada, reposição e busca de vaga
para não entregar nada novo.

## O que nasce no banco

Cinco tabelas, uma coluna nova em duas que já existem, e os campos da ficha.

```
plano        conta_id · codigo · nome · servico_id · recorrencia · parcelas
             frequencia_semanal · sessoes_no_pacote · validade_meses
             preco_vinculado_cent · preco_avulso_cent · ativo

contrato     conta_id · pessoa_id · plano_id · inicio · fim · dia_vencimento
             preco_aplicado_cent · vinculo_usado · forma_pagamento · status
             sessoes_contratadas

pausa        conta_id · contrato_id · inicio · fim · motivo
             (a licença e a prorrogação do documento, item 4)

cobranca     conta_id · contrato_id · pessoa_id · competencia · vencimento
             valor_cent · status · pago_em · forma_pagamento

recibo       conta_id · numero · serie · cobranca_id · versao · status
             emitido_em · emitido_por · cancelado_em · motivo_cancelamento
             corpo (o que foi impresso, congelado)
```

**Coluna nova em tabela que já existe:**

- `serie.codigo`, o número da turma ("001 – Segunda 7h00").
- `participacao.contrato_id`, anulável, que é como se sabe quantas sessões do
  pacote de dez já foram usadas. Sem ela, `sessoes_no_pacote` é um número que
  ninguém consegue descontar.
- `servico.categoria`, anulável, para a lista agrupar "Fisioterapia e terapias"
  sem inventar uma tabela para três palavras.

**Na ficha**, todos anuláveis: CPF, RG, endereço com número, complemento,
bairro, cidade, UF e CEP, sexo, estado civil, profissão, telefone residencial e
comercial. Ninguém é obrigado a preencher nada, e o formulário não pode ficar
com vinte campos abertos na cara de quem cadastra: o que é do dia a dia fica à
vista, o resto abre num grupo. **O CPF confere dígito**, porque CPF errado só
aparece na hora de emitir o recibo, que é tarde.

## As telas

Todas desenhadas no canvas de 18/08.

| Tela | Onde mora | Quem vê |
|---|---|---|
| Planos e valores | Configuração | dono |
| Nova matrícula | ficha da pessoa | dono e recepção |
| Financeiro | rail | dono e recepção |
| Recibos | rail | dono e recepção |
| Aulas por professor | relatório | dono |

**Quem atende não vê dinheiro.** A profissional enxerga a agenda dela, a chamada
e a avaliação, e nada de financeiro. Isso não é opinião: é a mesma linha que já
separa a recepção da avaliação postural, e ela mora em `src/server`, não no
banco.

No celular o rail mostra quatro abas, e continuará mostrando as mesmas quatro.
Financeiro e Recibos são trabalho de quem está sentado na recepção.

## Os módulos, em ordem

1. **14, acompanhamento por foto.** ✔ feito em 18/08.
2. **15, planos e valores.** O catálogo, o número da turma e a categoria do
   serviço. Substitui a tabela de preços que hoje vive num documento, e é o
   menor de todos.
3. **16, matrícula e contrato.** A ficha ampliada, o contrato, as vagas que
   nascem dele, e o que o documento chama de licença e prorrogação. É aqui que
   "gerir contrato" começa a ser verdade.
4. **17, financeiro.** ✔ feito em 18/08. Cobrança materializada do contrato,
   pagamento com estorno, e seis dos sete relatórios do item 4.
5. **18, recibo.** ✔ feito em 18/08. Numeração alocada no banco, arquivo com
   busca, cancelamento com motivo e correção por versão, como o item 8 pede com
   essas palavras. O sétimo relatório entrou junto.
6. **19, aulas por professor.** O item 7: quantas aulas cada um aplicou por dia,
   semana e mês, com o feriado explicado, porque número que acusa a pessoa
   errada é pior que número nenhum.
7. **Nota fiscal.** Fora desta lista até haver decisão comercial sobre qual
   emissor. Até lá a tela desenhada fica como desenho.

A ordem é de dependência, não de vontade: o contrato precisa do plano, a
cobrança precisa do contrato, o recibo precisa da cobrança e do CPF.

## As decisões que não dá para tomar duas vezes

**Um plano com duas tabelas de preço, não dois planos.** O documento cobra
R$ 195 de quem já é aluno e R$ 230 de quem só faz a terapia. Escrito como dois
planos, o recibo passa a dizer o nome errado, o relatório soma serviço com
serviço, e manter a tabela dobra. As colunas são `preco_vinculado_cent` e
`preco_avulso_cent`; quem decide qual usar é o servidor, no ato da matrícula, e
a tela mostra qual usou e por quê.

**Dinheiro é inteiro, em centavos.** Não existe coluna monetária no banco hoje,
então o precedente é este. Nunca decimal de ponto flutuante: dez parcelas de um
plano com desconto produzem dízima, e a diferença aparece no recibo, que é o
lugar onde ela não pode aparecer.

**Toda venda gera contrato, inclusive a aula avulsa.** O documento tem "013 –
Aula avulsa" e o desenho diz "sem contrato". Se a avulsa não gerar contrato, a
cobrança precisa existir sem contrato e o recibo precisa saber lidar com os dois
casos, e isso se paga em toda tela daqui para frente. A avulsa gera um contrato
de um dia, que ninguém precisa ver.

**Código de plano é único por conta, e o banco recusa o repetido.** O documento
tem `104` em dois planos, `119` e `120` em quatro linhas, e quatro planos
rotulados "alunos MGM" que pelo preço são de não-aluno. Não é descuido de quem
escreveu: é o que acontece com toda tabela de preço mantida à mão, e é metade do
motivo de o sistema existir. O sistema recusa com o motivo escrito, e diz de
quem é o código.

**Recibo não é nota fiscal, e os dois existem.** O recibo é do estúdio, sai na
hora, numeração nossa. A nota é da prefeitura, e cada cidade tem um padrão: a
Verandi vai **pedir** a nota a um emissor, nunca falar com a prefeitura direto.

**Recibo não se edita: corrige-se.** A correção cria versão nova e guarda a
anterior, porque a via impressa continua existindo no mundo. Cancelar exige
motivo, e o número fica cancelado e vazio: buraco na sequência é a primeira
coisa que uma fiscalização pergunta.

**Foto de avaliação é dado de saúde.** Balde privado, endereço assinado com
prazo, e a recepção não enxerga. A anonimização do titular apaga as imagens
junto, e isso já está no ar desde 18/08.

**Financeiro não pode ser uma listagem e pronto.** Quem usa é a recepção, entre
um aluno e outro, com o telefone tocando. Isso significa: página com vinte
linhas e paginação na URL, filtro que responde enquanto se digita, o que vence
hoje em primeiro, e registrar pagamento em dois cliques a partir da linha.

## O que quase deu errado, e por isso está escrito aqui

Oito pontos que a primeira versão deste plano não previa, achados conferindo o
desenho e o documento contra o código. Cada um custaria uma migration
corretiva se fosse descoberto no meio da execução.

1. **O pacote de dez sessões não tinha onde guardar o saldo.** Cinco planos do
   MGM são pacote, e "quantas sobraram" não tinha resposta possível. Resolvido
   por `participacao.contrato_id`: o saldo é o contratado menos o consumido, e
   ninguém precisa manter um contador que pode divergir.
2. **A aula avulsa quebrava o modelo**, porque cobrança sem contrato obrigaria
   toda tela a lidar com dois casos. Resolvido pelo contrato de um dia.
3. **Trancar e prorrogar não existiam no plano**, e existem no documento
   (`Licença/Prorrog` e `Novo Venc`, item 4). Aluno que trava dois meses é
   rotina. Virou a tabela `pausa`.
4. **A ficha do documento é muito maior que a nossa**, e recibo sem CPF do
   pagador não serve. Os campos entram no módulo 16, todos anuláveis.
5. **A turma não tinha número.** O documento chama as turmas de "001" a "070" e
   o desenho da matrícula diz "turmas 001 e 002". Virou `serie.codigo`.
6. **A lista de planos agrupa por algo que o banco não tem.** O desenho separa
   "Pilates" de "Fisioterapia e terapias", e `servico` é tabela plana. Virou
   `servico.categoria`, anulável.
7. **Criar vaga não confere nada.** `criarVaga` insere direto: não olha
   capacidade, não olha se a pessoa já ocupa aquela série, e não há `unique` no
   banco. Uma matrícula que cria duas vagas de uma vez precisa conferir as duas
   antes de gravar qualquer uma, e o índice único entra junto.
8. **`pessoa.vencimento_plano` é lida em seis lugares**, incluindo o filtro
   "plano vencendo" da lista, que lê a coluna dentro de `pessoa_resumo`. Ela
   **fica**, e passa a ser escrita pelo sistema a partir do contrato. Enquanto a
   pessoa não tiver contrato, continua editável à mão, e a tela diz de onde veio
   a data. Apagar a coluna quebraria a ficha, a lista e a API no mesmo dia.

## O recibo sobrevive ao pedido de exclusão, e isso está decidido

**O recibo guarda o nome de quem pagou, e o pedido de exclusão do titular manda
apagar o nome.** As duas coisas são obrigações, e elas se contradizem: documento
que comprova pagamento tem prazo de guarda, e a via impressa já existe no mundo.

**A decisão, tomada em 18/08:** o recibo sobrevive à anonimização, guardado por
**cinco anos contados da emissão**, com base legal de cumprimento de obrigação
legal e exercício regular de direito. Cinco anos porque é o prazo que a lei
brasileira usa para cobrança e para reclamação de consumo, e um recibo que
desaparece antes disso deixa o negócio sem defesa exatamente quando ele precisa.

O que o titular pede é apagar o cadastro dele, e isso continua acontecendo: nome,
telefone, endereço, foto e avaliação saem. O que fica é o documento contábil que
comprova um pagamento que existiu, e ele fica **congelado**, sem virar fonte de
consulta: ninguém procura pessoa pelo recibo.

**Isso vira duas tarefas do módulo 18, e nenhuma delas é opcional:**

1. `anonimizarPessoa` passa a **não** apagar recibo, e o teste que hoje prova que
   tudo do titular sai passa a provar também que o recibo permaneceu, com o
   motivo escrito ao lado.
2. A política de privacidade ganha o prazo, em três lugares: a lista do que o
   sistema guarda (seção 4), o prazo de guarda (seção 7, que hoje diz apenas
   "salvo o que a lei obrigar a guardar" e passa a dizer qual é), e a lista de
   direitos (seção 8), onde a eliminação passa a ter esta exceção nomeada. O
   texto mora em `src/core/legal/privacidade.ts`, e mexer nele **sobe a versão**
   do documento, o que faz o aceite ser pedido de novo.

A política só muda quando o recibo existir. Texto legal que descreve
funcionalidade que ainda não está no ar é promessa, não informação.

## O que não bate em nada, e como não bater

- **Migrations seguem de `0054` em diante**, uma por módulo, e o número se
  descobre olhando `supabase/migrations/`, nunca copiando daqui.
- **Produção é `node scripts/aplica-em-producao.mjs`**, com a conferência de
  cinco passos do `HANDOFF.md`. Nunca `supabase db push`.
- **Coluna nova não entra em view sozinha**, e `create or replace view` só
  aceita acréscimo no fim. Mordeu na `0043` e na `0044`, e vai morder de novo
  em `pessoa_resumo`.
- **`npm run tipos` depois de toda migration**, senão o `tsc` segue passando com
  a forma antiga do banco.
- **RLS por conta em toda tabela nova**, no padrão de `contas_do_usuario()`. O
  filtro por papel mora em `src/server`, porque "recepção" é linha em
  `usuario_conta` e não papel do banco.
- **A régua do vocabulário vale**: nem artigo nem adjetivo colado na palavra do
  cliente, com o lint de `tests/unit/regua-do-vocabulario.test.ts` guardando.
  "Plano", "contrato" e "recibo" são palavras nossas, e não entram no
  vocabulário configurável: são o mesmo negócio em qualquer estúdio.
- **"Matrícula" tem dois sentidos, e os dois ficam.** O documento chama de
  matrícula tanto o número do aluno quanto o ato de contratar um plano. Na tela,
  "Matrícula nº" é o identificador da pessoa e "Nova matrícula" é o contrato
  nascendo, exatamente como o cliente fala. No banco, contrato é `contrato`.
- **Texto do produto não leva travessão.**
- **Regra que a tela e a API precisarem das duas sai para `core/`**, e as duas
  chamam. Vale para preço aplicado, para vencimento, para saldo de pacote e para
  numeração de recibo.
- **Toda tela nova entra no onboarding e no rail** com o papel certo.
- **Os dados do MGM entram pela tela.** São 42 planos e as matrículas em curso,
  hoje num documento. Não existe importador, e escrever um para usar uma vez
  custa mais do que digitar. Quem for executar avisa o cliente disso.
