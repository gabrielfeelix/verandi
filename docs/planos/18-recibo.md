# Plano 18, o recibo: numeração, papel e correção

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Teste antes do código, sempre.

**Objetivo:** entregar a quem pagou um papel que comprova o pagamento, com
número que não se repete e não pula, e poder corrigir ou cancelar esse papel
depois sem apagar o que já saiu impresso.

**Desenho:** o recibo é a foto de um pagamento no instante em que ele foi
reconhecido. Ele **não** é uma consulta ao banco: é um texto congelado, escrito
no ato, que continua dizendo a mesma coisa depois de a pessoa mudar de endereço,
de o plano mudar de preço e de o cadastro dela ser apagado a pedido dela.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), item 8 do
documento do cliente, e o pagamento do [plano 17](17-financeiro.md).

**Telas:** `/recibos` no rail, a emissão a partir da linha do pagamento no
financeiro e na ficha, e a folha impressa.

## O que vale para todas as tarefas

- **Migration é a `0057`**, conferida contra `supabase/migrations/` antes.
- **Dinheiro é inteiro em centavos.**
- **Erro como valor**, e não exceção.
- **`npm run tipos` depois da migration.**
- **Régua do vocabulário**, e nada de travessão.
- **Recibo é do dono e da recepção.** Quem atende não emite nem lê.

## O modelo

```
recibo    id · conta_id · serie (text) · numero (int)
          pagamento_id · pessoa_id · contrato_id
          versao (int) · substitui_id (nulo, aponta para a versão anterior)
          status (valido | cancelado | substituido)
          valor_cent · emitido_em · emitido_por_usuario_id
          cancelado_em · motivo (do cancelamento ou da correção)
          corpo jsonb   -- o que foi impresso, congelado
          unique (conta_id, serie, numero, versao)

conta     ganha os dados de quem emite: razao_social, documento (CNPJ ou CPF),
          endereco_emitente, telefone_emitente, serie_recibo
```

**`corpo` é `jsonb`, e não uma consulta.** Ele guarda o nome de quem pagou, o
documento, o que foi pago, a competência, o valor por extenso, quem emitiu e os
dados do estúdio, todos como estavam no dia. Uma segunda via emitida daqui a um
ano precisa sair idêntica à primeira, e nenhuma outra tabela deste sistema
promete não mudar.

**O número é alocado no banco, não no aplicativo.** Duas pessoas clicando
"Emitir" ao mesmo tempo em dois balcões precisam receber números diferentes, e
`select max(numero) + 1` no aplicativo entrega o mesmo número às duas. A
alocação é uma função `plpgsql` que trava a linha do contador da conta e devolve
o próximo, no mesmo padrão de `contas_do_usuario()`: `security definer`, com
`search_path` fixo.

**Correção cria versão nova e guarda a anterior.** A via impressa continua
existindo no mundo, e um sistema que sobrescreve o texto passa a discordar do
papel que está na pasta do cliente. A versão anterior fica com status
`substituido`, e a nova diz que substitui a anterior e por quê.

**Cancelar exige motivo, e o número fica cancelado e vazio.** Buraco na
sequência é a primeira coisa que uma fiscalização pergunta, e "esse número nós
apagamos" não é resposta. O número cancelado continua listado, com o motivo.

## As decisões desta tarefa

**Recibo aponta para pagamento, não para cobrança.** Quem pagou metade em
dezembro e metade em janeiro recebeu dois recibos, de valores diferentes, em
datas diferentes. Amarrar o recibo à cobrança obrigaria um recibo a falar de
dinheiro que ainda não entrou.

**Pagamento estornado invalida o recibo dele, e não o apaga.** O estorno do
módulo 17 marca o recibo como cancelado, com o motivo do estorno copiado. O
papel que saiu continua existindo, e é justamente por isso que ele precisa
constar como cancelado aqui dentro.

**Emitir é opcional, e não automático.** Nem todo pagamento vira papel: a maior
parte de um estúdio pequeno não vira. Emitir a cada pagamento gastaria número de
sequência com recibo que ninguém pediu, e sequência com buraco por desuso é o
mesmo problema do cancelamento, sem nem a desculpa de ter havido um erro.

**Recibo não é nota fiscal, e a tela diz isso.** O recibo é do estúdio, sai na
hora, numeração nossa. A nota é da prefeitura, cada cidade tem um padrão, e a
Verandi vai pedir a nota a um emissor quando houver decisão comercial sobre
qual. Uma linha na tela evita a conversa "então já posso parar de emitir nota?",
que custa muito mais caro que a linha.

**Quem emite fica gravado, e por isso a emissão exige usuário.** "Quem imprimiu
este recibo" é a primeira pergunta quando um valor não bate, e ela não tem
resposta possível depois se ninguém a gravar no ato.

**A folha é `@media print`, e não PDF gerado.** O produto já imprime a grade
assim, o navegador já sabe salvar em PDF, e uma biblioteca de PDF no servidor
custa peso de build e uma fonte embarcada para resolver o que o `Ctrl+P` resolve.
Se um dia for preciso anexar o arquivo a um e-mail, aí vira decisão nova.

## O recibo sobrevive ao pedido de exclusão

Isto já foi decidido em 18/08, está escrito no plano 13, e vira duas tarefas
aqui. Não é opcional, e não é detalhe jurídico solto: é a única exceção que o
produto abre à anonimização, e ela precisa estar no código e no texto legal ao
mesmo tempo.

O titular pede para apagar o cadastro, e isso continua acontecendo inteiro: nome,
telefone, endereço, foto e avaliação saem. O que fica é o documento contábil que
comprova um pagamento que existiu, **guardado por cinco anos contados da
emissão**, com base legal de cumprimento de obrigação legal e exercício regular
de direito. Ele fica congelado, e não vira fonte de consulta: ninguém procura
pessoa pelo recibo, e a busca não olha dentro do `corpo`.

## As tarefas

1. **Banco.** `recibo`, o contador por conta e série, a função que aloca o
   número, os campos do emitente em `conta`, e RLS. Teste de banco: dois
   pedidos concorrentes recebem números diferentes e sem buraco, e o número
   cancelado continua ocupado.
2. **`core/recibo`.** O corpo congelado a partir do pagamento, o valor por
   extenso em português, a numeração formatada, e as regras de o que pode ser
   corrigido e cancelado. Teste de unidade.
3. **`server/recibo`.** Emitir, corrigir (versão nova), cancelar com motivo, e o
   gancho do estorno do módulo 17. Erro como valor. Teste de banco.
4. **Emitente na Configuração.** Razão social, documento, endereço, telefone e a
   série. Sem isso o recibo sai sem cabeçalho, e recibo sem quem emitiu não
   comprova nada. A tela recusa emitir enquanto o emitente estiver vazio, e diz
   onde preencher.
5. **Tela `/recibos`** e a emissão a partir do pagamento, no financeiro e na
   ficha. Lista com busca por número e por pessoa, e o cancelado visível.
6. **A folha.** `@media print`, uma via por página, com segunda via opcional na
   mesma folha, porque é assim que o talão de papel funciona.
7. **LGPD, as duas partes.** `anonimizarPessoa` passa a não apagar recibo, e o
   teste que hoje prova que tudo do titular sai passa a provar também que o
   recibo permaneceu, com o motivo escrito ao lado. E a política de privacidade
   ganha o prazo em três lugares, seções 4, 7 e 8, o que **sobe a versão** do
   documento e faz o aceite ser pedido de novo. O texto mora em
   `src/core/legal/privacidade.ts`.
8. **Jornada pela tela.** Receber, emitir, imprimir, corrigir, cancelar, e o
   número que não se repete nem pula.

## Quando este plano termina

- Um pagamento vira papel com número, e a segunda via sai idêntica.
- Corrigir cria versão nova e a anterior continua legível.
- Cancelar exige motivo, e o número continua ocupado.
- O estorno de um pagamento cancela o recibo dele sozinho.
- A anonimização do titular preserva o recibo, e o teste prova.
- A política de privacidade diz o prazo de guarda, e a versão subiu.
- Suíte inteira verde.

**O que este plano não faz:** nota fiscal, envio do recibo por e-mail ou
WhatsApp, e assinatura digital. Os três dependem de decisão comercial que não
foi tomada, e nenhum deles muda o modelo escrito aqui.
