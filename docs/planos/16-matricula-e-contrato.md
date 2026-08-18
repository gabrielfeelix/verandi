# Plano 16, matrícula e contrato

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Teste antes do código, sempre.

**Objetivo:** matricular alguém num plano, com os horários que o plano pede,
até quando vale e quando vence, e poder trancar, prorrogar e encerrar isso
depois. É aqui que "gerir contrato" passa a ser verdade.

**Desenho:** o `contrato` é a camada comercial em cima do que já existe. Ele
**não** substitui a `vaga`: ele produz vagas, que é o que a chamada, a
reposição e a busca de vaga já leem. Um contrato "2x por semana" cria duas
vagas; encerrar o contrato fecha as vagas dele pela mesma data.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), item 1 e
item 4 do documento do cliente.

**Telas:** `.desenho/Matricula.dc.html`.

## O que vale para todas as tarefas

- **Migration é a `0055`**, conferida contra `supabase/migrations/` antes.
- **Dinheiro é inteiro em centavos**, e o valor do contrato é **congelado** no
  ato: mudar a tabela de preços amanhã não pode reescrever o que foi contratado
  ontem.
- **Erro que a pessoa resolve sozinha volta como valor**, não como exceção: o
  Next não deixa a mensagem de `Error` atravessar a Server Action. Padrão em
  `server/planos/acoes.ts`.
- **`npm run tipos` depois da migration.**
- **Régua do vocabulário**, e nada de travessão.
- **Matrícula é do dono e da recepção.** Quem atende não matricula ninguém.

## O modelo

```
contrato   id · conta_id · pessoa_id · plano_id · inicio · fim
           dia_vencimento · preco_aplicado_cent · vinculo_usado
           forma_pagamento · sessoes_contratadas · status · criado_em

pausa      id · conta_id · contrato_id · inicio · fim · motivo
           (a licença e a prorrogação do item 4 do documento)

vaga.contrato_id           anulável: as vagas que nasceram de um contrato
participacao.contrato_id   anulável: é daqui que sai o saldo do pacote
```

**Campos novos na ficha**, todos anuláveis: CPF, RG, endereço com número,
complemento, bairro, cidade, UF e CEP, sexo, estado civil, profissão, telefone
residencial e comercial.

## As decisões desta tarefa

**O contrato congela o preço.** `preco_aplicado_cent` é escrito no ato da
matrícula, junto com `vinculo_usado`, que diz **por que** aquele preço. Sem
congelar, corrigir a tabela de preços em março reescreveria o que foi vendido
em janeiro, e o recibo do módulo 18 passaria a discordar da via impressa.

**Trancar não apaga vaga, e prorroga o fim.** Quem tranca dois meses volta e
quer os dois meses de volta no fim do contrato. A `pausa` guarda o intervalo, e
o fim do contrato anda para frente pelos dias parados.

**`pessoa.vencimento_plano` continua existindo, e passa a ser escrita pelo
sistema.** Ela é lida em seis lugares, um deles o filtro "plano vencendo" da
lista de pessoas, que a lê dentro de `pessoa_resumo`. Enquanto a pessoa não tem
contrato, segue editável à mão.

**Vaga em lote confere antes de gravar qualquer uma.** Duas vagas de uma
matrícula precisam caber nas duas turmas; se a segunda não cabe, a primeira não
entra. E o banco ganha o índice que faltava: a mesma pessoa não ocupa a mesma
turma duas vezes ao mesmo tempo.

## As tarefas

1. **Banco.** `contrato`, `pausa`, as três colunas de ligação, os campos da
   ficha, o índice único de vaga. Teste de banco.
2. **`core/contratos`.** CPF com dígito, fim do contrato pelo plano, dias de
   pausa, saldo do pacote, próximo vencimento. Teste de unidade.
3. **`server/contratos`.** Criar com vagas em lote, trancar, retomar,
   encerrar. Erro como valor.
4. **Tela da matrícula**, na ficha da pessoa, e a lista de contratos dela.
5. **Ficha ampliada**, com os campos novos agrupados para não afogar o
   cadastro rápido.
6. **Jornada pela tela.**

## Quando este plano termina

- Dá para matricular alguém num plano, escolhendo os horários que o plano pede.
- O preço aplicado aparece na tela dizendo por que foi aquele.
- Dá para trancar, retomar e encerrar, e o fim anda pelos dias parados.
- As vagas nascem do contrato e fecham com ele.
- A ficha guarda CPF e endereço, e o CPF confere dígito.
- Suíte inteira verde.

**O que este plano não faz:** cobrar. Cobrança, pagamento e recibo são os
módulos 17 e 18.
