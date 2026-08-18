# Plano 17, o financeiro: da cobrança ao caixa do dia

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Teste antes do código, sempre.

**Objetivo:** saber quem deve, quanto, desde quando, e registrar o que entrou
sem parar o atendimento. É aqui que "controle financeiro" passa a ser verdade,
e é o módulo que o cliente pediu com sete relatórios.

**Desenho:** a cobrança **nasce do contrato**, e não da mão de quem atende. O
contrato já diz quanto custa, de quanto em quanto tempo e em que dia vence; o
que faltava era transformar isso em linhas com data, e guardar o que entrou
contra cada uma. Digitar cobrança à mão todo mês é a planilha de novo, com um
banco de dados embaixo.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), item 4 do
documento do cliente, e o contrato do [plano 16](16-matricula-e-contrato.md).

**Telas:** `/financeiro`, nova no rail, e as cobranças da pessoa dentro da aba
Contratos da ficha, que já existe.

## Os sete relatórios são os do documento, e não os que eu supus

Este plano foi escrito sem o `.docx` do cliente à mão, com os sete relatórios
reconstruídos a partir do que os planos 13, 15 e 16 anotaram. **O documento
apareceu depois, e a reconstrução acertou dois.** O que ele pede, com as
palavras dele, no item 4:

> O controle financeiro deverá oferecer relatórios: valores faturados por
> dia/semana/mês/ano · faturamento por plano e por modalidade (serviços) ·
> recibos emitidos / de recibos cancelados · estornos (cancelamentos) ·
> clientes/alunos ativos · clientes/alunos inativos · novos clientes no mês

Isto está registrado aqui, e não apagado, porque é a lição mais barata do
módulo: **cinco dos sete relatórios do primeiro cliente pagante nasceriam
errados**, e nenhum teste pegaria, porque todos eles somavam certo. O que
faltava não era código, era o documento.

Os dois que eu tinha acertado são faturamento por modalidade e por plano, e o
que entrou no período. Os que faltavam e entraram: **estornos**, **clientes
ativos**, **clientes inativos** e **novos clientes no período**. **Recibos
emitidos e cancelados** é o terceiro da lista dele e depende do módulo 18, e
chega com ele.

Três números que eu tinha inventado ficaram, e num lugar menor: quanto ainda vai
vencer, quanto o mês seguinte deve gerar, e quanto o preço de vínculo custa. Eles
não estão entre os sete, mas a planilha do item 4 tem as colunas "Venc Plano" e
"Novo Venc", e elas existem para responder a primeira. Estão numa linha de texto
dentro do cartão da carteira, e não como número grande.

## O que vale para todas as tarefas

- **Migration é a `0056`**, conferida contra `supabase/migrations/` antes.
- **Dinheiro é inteiro em centavos**, sempre, e nunca ponto flutuante.
- **Erro que a pessoa resolve sozinha volta como valor**, não como exceção.
  Padrão em `server/planos/acoes.ts` e `server/contratos/acoes.ts`.
- **`npm run tipos` depois da migration.**
- **Régua do vocabulário**, e nada de travessão. "Cobrança", "pagamento" e
  "recibo" são palavras nossas: não entram no vocabulário configurável, porque
  são o mesmo negócio em qualquer estúdio.
- **Dinheiro é do dono e da recepção.** Quem atende não vê nada disto, e a
  conferência mora em `src/server`, não no banco.

## O modelo

```
cobranca    id · conta_id · contrato_id · pessoa_id
            competencia (date, dia 1 do mês que ela cobre)
            vencimento (date) · valor_cent
            status (aberta | cancelada)
            origem (sistema | manual)
            motivo_cancelamento · criado_em
            unique (contrato_id, competencia)

pagamento   id · conta_id · cobranca_id · valor_cent · forma
            recebido_em (date) · observacao
            registrado_por_usuario_id · criado_em
            estornado_em · motivo_estorno

cobranca_resumo   view: a cobrança mais `valor_pago_cent` e `situacao`
```

**`status` tem dois valores, e "paga" não é um deles.** Pago é o que a soma dos
pagamentos diz, e uma coluna que repete essa soma é uma coluna que um dia
diverge dela. É a mesma decisão que Pendências tomou: o que se grava é o ato, e
o estado é lido. "Atrasada" também não é coluna: é `vencimento < hoje` com
saldo em aberto, e depende do fuso da conta, que muda de conta para conta.

**`pagamento` é tabela, e não duas colunas na cobrança.** Quem recebe metade
hoje e metade no dia 20 recebeu duas vezes, em duas datas, possivelmente em
duas formas, e o fechamento do dia precisa das duas. Com `valor_pago_cent` na
cobrança, a segunda entrada apaga a data da primeira, e o caixa de hoje passa a
mentir sobre ontem.

**Estorno em vez de apagar.** Pagamento registrado errado é fato que aconteceu:
alguém digitou. Apagar a linha faz o fechamento de ontem, que já foi conferido
e talvez impresso, mudar de valor sozinho. O estorno mantém a linha, zera o
efeito dela e diz por quê. E, no módulo 18, é o que permite o recibo continuar
apontando para algo que existe.

## As decisões desta tarefa

**A cobrança é materializada, não agendada.** O plano gratuito da Vercel não dá
cron, e é a mesma restrição que a agenda já resolveu: `materializarJanela` cria
as sessões da semana quando alguém abre a tela. As cobranças nascem do mesmo
jeito, ao abrir `/financeiro` e ao criar um contrato, e são idempotentes por
`unique (contrato_id, competencia)`. Duas abas abertas ao mesmo tempo não
cobram duas vezes, e não existe job para alguém esquecer de rodar.

**O sistema não inventa dívida de antes de conhecer o contrato.** O MGM vai
digitar as matrículas em curso com a data real de início, para o histórico e as
vagas ficarem certos. Sem uma régua, cadastrar um contrato que começou em
janeiro faria nascer quinze cobranças vencidas numa tela cuja primeira aba é "em
atraso", e o sistema abriria acusando o cliente inteiro de caloteiro na frente
da recepção. A régua é: a cobrança existe a partir do mês em que o contrato
entrou no sistema, ou do começo dele, o que vier depois. O que ficou para trás é
conversa do estúdio com o aluno, fora daqui.

**O horizonte é o mês aberto mais um.** Materializar até o fim de um contrato
anual põe doze linhas na tela de quem quer saber o que vence esta semana, e
transforma "a receber" num número que ninguém consegue ler. Um mês à frente é o
que a recepção usa para dizer "o seu vence dia 5".

**Mês trancado não gera cobrança.** É a metade que faltava do trancar do módulo
16: quem tranca em licença não paga o período parado, e o fim do contrato já
anda para frente pelos dias parados. Sem isto, trancar geraria dívida enquanto
a pessoa nem podia entrar na sala, e a primeira ligação de cobrança destruiria a
confiança no sistema inteiro. A competência é pulada quando o mês está inteiro
dentro de uma pausa; mês partido pela metade gera cobrança cheia, porque
proporcional é decisão comercial do estúdio e não do software.

**Encerrar contrato cancela o que ainda não venceu.** As cobranças de
competência posterior ao fim são canceladas com motivo automático ("contrato
encerrado em dd/mm"). As vencidas e não pagas **ficam**: quem saiu devendo
continua devendo, e apagar a dívida no ato do encerramento é o jeito mais rápido
de o sistema perder dinheiro do cliente sem ninguém perceber.

**O valor da cobrança pode ser corrigido, com motivo, enquanto ela não tem
pagamento.** É negociação, e ela existe: o preço congelado do contrato é o que
foi vendido, e a cobrança de dezembro pode ter desconto de férias. O que não
existe é editar valor de cobrança já paga: para isso há estorno, e no módulo 18
correção de recibo.

**A tela abre no que precisa de decisão.** Atrasadas primeiro, com quantos dias
e com o telefone à mão; depois o que vence nos próximos sete dias; e o extrato
do mês é uma aba, não a primeira coisa. Quem usa é a recepção entre um aluno e
outro, com o telefone tocando, e a pergunta dela nunca é "quanto faturamos em
outubro".

**Registrar pagamento é dois cliques.** "Receber" na linha abre o modal já
preenchido com o valor cheio, a data de hoje e a forma que o contrato diz, e o
segundo clique confirma. Tudo que o modal pede a mais precisa justificar por que
está atrasando a fila da recepção.

**Cobrança manual não entra neste módulo.** Toda venda gera contrato, inclusive
a avulsa, que é um contrato de um dia, e essa decisão do plano 13 é o que
mantém recibo e relatório com um caso só. `origem` já nasce na tabela porque a
exceção vai aparecer, e quando aparecer terá onde morar sem migration corretiva.

## Os sete relatórios, e onde cada um mora

Todos na aba **Fechamento**, com o período no topo. As quatro janelas são as que
o documento pede: **dia, semana, mês e ano**, mais datas escolhidas pela URL. Um
botão de planilha ao lado, como Pendências e Pessoas já têm.

| # | O documento pede | Onde está |
|---|---|---|
| 1 | valores faturados por dia/semana/mês/ano | número grande, com a divisão por forma de pagamento embaixo |
| 2 | faturamento por plano e por modalidade | duas listas com barra, sobre o que **entrou** |
| 3 | recibos emitidos e cancelados | **módulo 18**, chega com ele |
| 4 | estornos (cancelamentos) | número grande, e a lista com pessoa, data e motivo |
| 5 | clientes/alunos ativos | número grande |
| 6 | clientes/alunos inativos | na linha do ativo, porque um só faz sentido ao lado do outro |
| 7 | novos clientes no mês | número grande, contado no período escolhido |

**O faturamento é sobre o que entrou, e não sobre o que foi cobrado.**
Faturamento de mês que ninguém pagou é a conta que quebra estúdio.

**Cliente é ficha, e não contrato.** Quem tem dois contratos é um cliente só, e
"ativo" é a mesma marca que a lista de pessoas usa, para os dois números nunca
discordarem. Quem pediu exclusão sai das três contagens: a ficha continua
existindo por causa do histórico, e não descreve mais ninguém.

**O estorno é filtrado pela data do estorno, e não pela do recebimento.** O
dinheiro entrou em março e voltou em abril; quem fecha abril precisa ver a
devolução em abril, e o março que já foi conferido não pode mudar de valor.

Nenhum deles é gráfico. Todos são número grande com uma linha de explicação
embaixo, e a lista quando a lista é o ponto. Gráfico entra quando alguém pedir
para comparar dois períodos, e ninguém pediu.

Fora dos sete, e num lugar menor, ficaram três números que a planilha do item 4
pressupõe: quanto ainda vai vencer, quanto o mês seguinte deve gerar, e quanto o
preço de vínculo custa. Eles moram numa linha de texto dentro do cartão da
carteira, e não como número grande, porque não foram pedidos.


## As tarefas

1. **Banco.** `cobranca`, `pagamento`, a view `cobranca_resumo` com
   `security_invoker`, RLS por conta nas duas tabelas, e o índice único que
   torna a materialização idempotente. Teste de banco: a segunda materialização
   não duplica, RLS isola conta, e a view soma pagamento estornado como zero.
2. **`core/financeiro`.** Sem banco e sem tela: quais competências um contrato
   deve, dado início, fim, recorrência, parcelas e as pausas; o vencimento de
   cada uma a partir de `dia_vencimento`; a situação de uma cobrança dado o
   pago e a data de hoje; os dias de atraso; e as somas do fechamento. Teste de
   unidade, e é aqui que mora a regra do mês trancado.
3. **`server/financeiro`.** Materializar (idempotente, horizonte de um mês),
   listar com filtro e paginação, registrar pagamento, estornar, cancelar
   cobrança e corrigir valor. Erro como valor. O encerrar do módulo 16 passa a
   cancelar as futuras, e o teste dessa amarração mora aqui. Teste de banco.
4. **Tela `/financeiro`**, com as três abas, o item novo no rail para dono e
   recepção, e o número de atrasadas como badge. A barra do celular continua com
   quatro abas: financeiro é trabalho de quem está sentado.
5. **As cobranças na ficha da pessoa**, dentro da aba Contratos que já existe,
   com o receber ali mesmo. É onde a pergunta nasce quando a pessoa está na
   frente do balcão.
6. **Fechamento**, os sete do documento, com período e planilha. O terceiro
   deles, recibos emitidos e cancelados, entra no módulo 18.
7. **Jornada pela tela.** Matricular, ver a cobrança nascer, receber, ver o
   caixa do dia mudar, atrasar uma e vê-la no topo, e quem atende não alcançar
   nada disso.

## Quando este plano termina

- Matricular alguém faz a primeira cobrança aparecer, com data e valor certos.
- A tela abre no que está atrasado, e receber são dois cliques.
- Trancar não gera cobrança do período parado, e encerrar cancela o que ainda
  não venceu sem apagar o que já venceu.
- O caixa do dia fecha por forma de pagamento.
- Os seis relatórios que não dependem do recibo respondem o que o documento
  pede, e saem em planilha. O sétimo entra com o módulo 18.
- Suíte inteira verde.

**O que este plano não faz:** emitir recibo (módulo 18), emitir nota fiscal
(fora de escopo até haver decisão de emissor), cobrar de verdade por Pix ou
cartão (não há adquirente, e a decisão de não construir cobrança automática é do
plano 13), e mandar lembrete de vencimento (depende do módulo 18 e de decisão
sobre falar com o aluno em nome do estúdio).
