# Plano 19, aulas por professor

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Teste antes do código, sempre.

**Objetivo:** responder quantas aulas cada profissional aplicou por dia, por
semana e por mês, sem acusar ninguém de ter trabalhado menos por causa de um
feriado.

**O que o cliente escreveu**, item 7 do documento, inteiro:

> Controle de aulas por professores (agenda). Planilha de controle de quantidade
> de aulas aplicadas pelo professor por dia/semana/mês.

É o último dos nove pedidos que ainda não existe. É também o menor deles: **este
plano não cria tabela nenhuma.** A resposta já está em `sessao`, que guarda quem
deu a aula, em `participacao`, que guarda quem apareceu, e em
`excecao_calendario`, que guarda por que um dia não teve aula.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), item 7.

**Telas:** `/aulas`, no rail de quem responde pelo negócio.

## O que vale para todas as tarefas

- **Sem migration.** Se aparecer vontade de criar uma coluna `aulas_dadas`,
  releia esta linha: contador de estado derivado é o defeito que Pendências e o
  financeiro já recusaram duas vezes.
- **Erro como valor**, e não exceção, onde houver ação. Aqui quase não há: é uma
  tela de leitura.
- **Régua do vocabulário**, e nada de travessão. "Profissional" é palavra do
  cliente e sai do vocabulário da conta; "aula" é palavra nossa.
- **Relatório é do dono.** A recepção não vê, e quem atende muito menos: contar
  aula de outra pessoa é a porta de uma conversa que não é dela.

## A pergunta que decide tudo: o que é "aula aplicada"?

O documento não define, e o sistema não pode inventar um número que ninguém
consegue conferir. Quatro respostas são defensáveis, e cada uma dá um total
diferente no fim do mês:

1. **a sessão existiu na agenda** e não foi cancelada;
2. **a sessão aconteceu**, ou seja, já passou da hora;
3. **a chamada foi registrada**, o que prova que alguém esteve na sala;
4. **pelo menos uma pessoa esteve presente**, o que prova que houve aula.

**A escolha é a 2, com as outras três à vista ao lado.** O número grande conta a
sessão que já passou e não foi cancelada, porque é ela que o profissional
cumpriu: ele foi ao estúdio, esperou, e a turma vazia não é culpa dele. E as
colunas ao lado mostram quantas dessas tiveram presença, quantas ficaram sem
ninguém e quantas ninguém registrou, para o dono nunca precisar acreditar no
número: ele confere.

**O feriado é explicado, e não escondido.** Um profissional com duas segundas de
feriado no mês tem menos aulas que o do mesmo horário na terça, e um relatório
que só mostra o total faz essa diferença parecer falta. As canceladas aparecem
separadas, e as que caíram por feriado ou fechamento vêm com o motivo que a
`excecao_calendario` guardou.

**A troca de profissional já está resolvida no banco, e o relatório respeita.**
`sessao.profissional_id` é cópia, e não referência viva à série: quem cobriu a
aula de sexta aparece com a aula de sexta, e quem estava de folga não aparece.
Nada a construir, e vale escrever porque é a primeira coisa que alguém tentaria
"corrigir" olhando pela série.

## As decisões desta tarefa

**Aula futura não é aula aplicada.** Quando o período escolhido alcança o
futuro, que é o caso do mês corrente, o que ainda não aconteceu aparece numa
coluna própria, "ainda por dar". Somar o futuro no total transformaria o
relatório do dia 3 numa promessa, e o do dia 30 num fato, com o mesmo rótulo.

**O período é escolhido, e as três janelas do documento estão prontas.** Dia,
semana e mês, mais o ano e datas pela URL, no mesmo padrão do Fechamento do
financeiro.

**A avaliação não conta como aula.** O módulo 14 registra quem avaliou, e
avaliação postural não é aula aplicada: contá-la aqui inflaria o número de quem
avalia muito. Se um dia o cliente pedir, é coluna nova, e não mudança de regra.

**Sem gráfico, e sem média.** O documento pede quantidade. Média de aulas por
semana é o tipo de número que parece útil e vira discussão sobre o divisor.

## As tarefas

1. **`core/relatorio/aulas.ts`.** As regras de contagem, sem banco e sem tela:
   o que conta como aplicada, o que é sem ninguém, o que é pendente de chamada,
   o que é cancelado por feriado. Teste de unidade, e é aqui que a decisão
   acima fica travada.
2. **`server/relatorio/consultas.ts`.** As sessões do período com o profissional
   e o resultado da chamada, numa consulta só, e a soma por pessoa. Teste de
   banco, incluindo a troca de profissional e o feriado.
3. **Tela `/aulas`**, com o período, a tabela por profissional e a explicação do
   feriado embaixo. Item novo no rail, só para o dono.
4. **Planilha.** A palavra do documento é "planilha", e o cliente vai querer
   mandar isso para quem paga. Mesmo formato do financeiro.
5. **O item 9, que ficou pela metade.** O documento termina pedindo que as fotos
   da avaliação sejam grandes e permitam ampliar. O visor existe desde o módulo
   14 e faz isso, mas **só a matriz abre ele**: no comparador, que é a leitura
   principal, clicar na foto não faz nada. Uma linha para fechar um pedido
   escrito.
6. **Jornada pela tela.**

## Quando este plano termina

- O dono abre `/aulas`, escolhe dia, semana ou mês, e vê quantas aulas cada
  profissional aplicou.
- O total não conta aula futura, e as canceladas por feriado aparecem
  explicadas.
- Quem cobriu a aula de outro aparece com ela.
- Sai em planilha.
- A foto da avaliação amplia a partir do comparador.
- Suíte inteira verde.

**O que este plano não faz:** calcular pagamento de profissional. Quanto vale a
aula de cada um é contrato de trabalho, muda por pessoa e por modalidade, e
chutar isso dentro de um relatório é a diferença entre informar e errar o
salário de alguém.
