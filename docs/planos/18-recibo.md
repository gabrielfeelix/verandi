# Plano 18, o recibo: numeração, papel e correção

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Teste antes do código, sempre.

**Objetivo:** entregar a quem pagou um papel que comprova o pagamento, com
número que não se repete e não pula, e poder corrigir ou cancelar esse papel
depois sem apagar o que já saiu impresso.

**O que o cliente escreveu**, item 8 do documento, inteiro:

> Emissão de recibo. O recibo deverá ter uma sequência numérica automática.
> Deverá ser arquivado. Poderá ser cancelado. Poderá ser corrigido.

São quatro frases e quatro requisitos, e este plano não inventa um quinto. O que
ele acrescenta vem de outros dois lugares do mesmo documento: a planilha do item
4 tem a coluna **"nº recibo"** ao lado de "Forma pg" e "pg em", o que amarra o
recibo ao pagamento e não ao contrato; e a ficha do item 1 tem **"Matrícula
nº"**, **CPF** e endereço, que são exatamente o que um recibo precisa imprimir.

**Desenho:** o recibo é a foto de um pagamento no instante em que ele foi
reconhecido. Ele **não** é uma consulta ao banco: é um texto congelado, escrito
no ato, que continua dizendo a mesma coisa depois de a pessoa mudar de endereço,
de o plano mudar de preço e de o cadastro dela ser apagado a pedido dela.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), item 8 do
documento, e o pagamento do [plano 17](17-financeiro.md).

**Telas:** `/recibos` no rail, a emissão a partir da linha do pagamento no
financeiro e na ficha, e a folha impressa.

## O que vale para todas as tarefas

- **Migration é a `0057`**, conferida contra `supabase/migrations/` antes.
- **Dinheiro é inteiro em centavos.**
- **Erro como valor**, e não exceção.
- **`npm run tipos` depois da migration.**
- **Régua do vocabulário**, e nada de travessão. "Recibo" é palavra nossa.
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

contador_recibo   conta_id · serie · proximo    (a sequência, travada por linha)

conta     ganha os dados de quem emite: razao_social, documento (CNPJ ou CPF),
          endereco_emitente, telefone_emitente, serie_recibo
```

**`corpo` é `jsonb`, e não uma consulta.** Ele guarda o nome de quem pagou, a
matrícula, o documento, o que foi pago, a competência, o valor por extenso, quem
emitiu e os dados do estúdio, todos como estavam no dia. Uma segunda via emitida
daqui a um ano precisa sair idêntica à primeira, e nenhuma outra tabela deste
sistema promete não mudar.

**O número é alocado no banco, não no aplicativo.** Duas pessoas clicando
"Emitir" ao mesmo tempo em dois balcões precisam receber números diferentes, e
`select max(numero) + 1` no aplicativo entrega o mesmo número às duas. A
alocação é uma função `plpgsql` que trava a linha do contador da conta e devolve
o próximo, no mesmo padrão de `contas_do_usuario()`: `security definer`, com
`search_path` fixo.

**Correção cria versão nova e guarda a anterior.** É o "poderá ser corrigido" do
documento, e a via impressa continua existindo no mundo: um sistema que
sobrescreve o texto passa a discordar do papel que está na pasta do cliente. A
versão anterior fica com status `substituido`, e a nova diz que substitui a
anterior e por quê.

**Cancelar exige motivo, e o número fica cancelado e vazio.** É o "poderá ser
cancelado". Buraco na sequência é a primeira coisa que uma fiscalização
pergunta, e "esse número nós apagamos" não é resposta. O número cancelado
continua listado, com o motivo, e é ele que alimenta o relatório de recibos
cancelados que o item 4 pede.

## As decisões desta tarefa

**Recibo aponta para pagamento, e a planilha do cliente concorda.** A coluna "nº
recibo" do item 4 fica ao lado de "Forma pg" e "pg em", que são atributos do
pagamento, não do contrato. E quem pagou metade em dezembro e metade em janeiro
recebeu dois recibos, de valores e datas diferentes: amarrar o recibo à cobrança
obrigaria um recibo a falar de dinheiro que ainda não entrou.

**Pagamento estornado invalida o recibo dele, e não o apaga.** O estorno do
módulo 17 marca o recibo como cancelado, com o motivo do estorno copiado. O
papel que saiu continua existindo, e é justamente por isso que ele precisa
constar como cancelado aqui dentro. É também o que faz "estornos" e "recibos
cancelados", os relatórios 4 e 3 do item 4, contarem a mesma história.

**Emitir é opcional, e não automático.** Nem todo pagamento vira papel: a maior
parte de um estúdio pequeno não vira. Emitir a cada pagamento gastaria número de
sequência com recibo que ninguém pediu, e sequência com buraco por desuso é o
mesmo problema do cancelamento, sem nem a desculpa de ter havido um erro.

**A matrícula é o `identificador_externo` que já existe.** O documento chama de
"Matrícula nº" e a coluna está na `pessoa` desde a `0032`. Não nasce coluna
nova, e o recibo imprime o que estiver lá. Quem não numera aluno deixa em
branco, e o recibo sai sem a linha.

**Recibo não é nota fiscal, e a tela diz isso.** O recibo é do estúdio, sai na
hora, numeração nossa. A nota é da prefeitura, cada cidade tem um padrão, e a
Verandi vai pedir a nota a um emissor quando houver decisão comercial sobre
qual. Uma linha na tela evita a conversa "então já posso parar de emitir nota?",
que custa muito mais caro que a linha.

**Quem emitiria a nota é o cliente, com o CNPJ dele, para o aluno dele.** O
estúdio é o prestador, o aluno é o tomador, e a 4YU não aparece no documento. Por
isso a nota nunca vai ser uma chave da 4YU num emissor: é certificado digital,
inscrição municipal, regime tributário, código de serviço e alíquota de ISS, tudo
por conta, e o layout muda com a prefeitura de cada cidade.

**Quem emite fica gravado, e por isso a emissão exige usuário.** "Quem imprimiu
este recibo" é a primeira pergunta quando um valor não bate, e ela não tem
resposta possível depois se ninguém a gravar no ato.

**A folha é `@media print`, e não PDF gerado.** O produto já imprime a grade
assim, o navegador já sabe salvar em PDF, e uma biblioteca de PDF no servidor
custa peso de build e uma fonte embarcada para resolver o que o `Ctrl+P`
resolve. Se um dia for preciso anexar o arquivo a um e-mail, aí vira decisão
nova.

**"Deverá ser arquivado" é a lista, não um arquivo.** O cliente arquiva recibo
em pasta de papel porque não tinha onde guardar; o que ele pede é conseguir
achar depois. Isso é a tela `/recibos` com busca por número e por pessoa, mais o
`corpo` congelado. Gerar e guardar um PDF por recibo seria construir a pasta de
papel de novo, dentro do computador.

## O recibo sobrevive ao pedido de exclusão

Isto já foi decidido em 18/08, está escrito no plano 13, e vira duas tarefas
aqui. Não é opcional, e não é detalhe jurídico solto: é a única exceção que o
produto abre à anonimização, e ela precisa estar no código e no texto legal ao
mesmo tempo.

O titular pede para apagar o cadastro, e isso continua acontecendo inteiro: nome,
telefone, endereço, CPF, foto e avaliação saem. O que fica é o documento contábil
que comprova um pagamento que existiu, **guardado por cinco anos contados da
emissão**, com base legal de cumprimento de obrigação legal e exercício regular
de direito. Ele fica congelado, e não vira fonte de consulta: ninguém procura
pessoa pelo recibo, e a busca não olha dentro do `corpo`.

**Atenção de quem executa:** `anonimizarPessoa` foi corrigida em 18/08 para
apagar também CPF, RG e endereço, que a ficha ampliada tinha trazido. O recibo
entra como a **exceção nomeada** dessa função, e o teste que hoje prova que tudo
sai passa a provar que o recibo ficou. Sem essa linha explícita, a próxima
correção da anonimização vai apagá-lo achando que está fazendo o certo.

## As tarefas

1. **Banco.** `recibo`, `contador_recibo`, a função que aloca o número, os
   campos do emitente em `conta`, e RLS nas duas tabelas novas. Teste de banco:
   dois pedidos concorrentes recebem números diferentes e sem buraco, o número
   cancelado continua ocupado, e a versão nova não reusa o número.
2. **`core/recibo`.** O corpo congelado a partir do pagamento, o valor por
   extenso em português, a numeração formatada (`serie` mais número com zeros à
   esquerda), e as regras de o que pode ser corrigido e cancelado. Teste de
   unidade, e o valor por extenso é o que mais vale teste: "mil e quinhentos
   reais" e "mil quinhentos e um reais" têm regra diferente.
3. **`server/recibo`.** Emitir, corrigir (versão nova), cancelar com motivo, e o
   gancho do estorno do módulo 17. Erro como valor. Teste de banco.
4. **Emitente na Configuração.** Razão social, documento, endereço, telefone e a
   série. Sem isso o recibo sai sem cabeçalho, e recibo sem quem emitiu não
   comprova nada. A tela recusa emitir enquanto o emitente estiver vazio, e diz
   onde preencher. **Os dados são do Gabriel**, e a tarefa constrói a tela que
   os pede, não os inventa.
5. **Tela `/recibos`** e a emissão a partir do pagamento, no financeiro e na
   ficha. Lista com busca por número e por pessoa, o cancelado visível, e o
   filtro de emitidos e cancelados no período.
6. **A folha.** `@media print`, uma via por página, com segunda via opcional na
   mesma folha, porque é assim que o talão de papel funciona.
7. **O sétimo relatório do item 4.** "Recibos emitidos / de recibos cancelados"
   entra na aba Fechamento do financeiro, ao lado dos estornos, e fecha a lista
   dos sete.
8. **LGPD, as duas partes.** `anonimizarPessoa` passa a não apagar recibo, e o
   teste que hoje prova que tudo do titular sai passa a provar também que o
   recibo permaneceu, com o motivo escrito ao lado. E a política de privacidade
   ganha o prazo em três lugares, seções 4, 7 e 8, o que **sobe a versão** do
   documento e faz o aceite ser pedido de novo. O texto mora em
   `src/core/legal/privacidade.ts`.
9. **Jornada pela tela.** Receber, emitir, imprimir, corrigir, cancelar, e o
   número que não se repete nem pula.

## Quando este plano termina

- Um pagamento vira papel com número, e a segunda via sai idêntica.
- Corrigir cria versão nova e a anterior continua legível.
- Cancelar exige motivo, e o número continua ocupado.
- O estorno de um pagamento cancela o recibo dele sozinho.
- O Fechamento mostra recibos emitidos e cancelados no período.
- A anonimização do titular preserva o recibo, e o teste prova.
- A política de privacidade diz o prazo de guarda, e a versão subiu.
- Suíte inteira verde.

**O que este plano não faz:** nota fiscal, envio do recibo por e-mail ou
WhatsApp, e assinatura digital. Os três dependem de decisão comercial que não
foi tomada, e nenhum deles muda o modelo escrito aqui.
