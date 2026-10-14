# Handoff: 13/out/2026 (correções da MGM, Agenda nova, financeiro)

Continua `docs/HANDOFF-09-OUT.md`, que tem o "como trabalhar com o Gabriel" e
como ler os pedidos da MGM no AutoFluxos. Regras de banco:
`docs/BANCO-COMPARTILHADO.md`. Última migration: `0077`.

## Features novas (estado em 14/out)

Feitos em 14/out: **1** (`cd19482`, recibo avulso, não lança no caixa), **2**
(`220c709`, botão Renovar; as 20 cobranças antigas continuam esperando o
Daniel) e **4** (`9eb0e4b`). Faltam o 3 (depende do Daniel) e o 5.

### 1. "Novo recibo" (pedido do Daniel, 13/10 17:32)

Tela própria em Recibos, que não depende de cobrança:

- buscar o aluno (lista com avatar), já trazendo a matrícula;
- escolher o plano, que traz valor e parcelas ("12x de R$ 550,00");
- valor editável: se mudar, o recibo mostra valor do plano, desconto e total
  (`composicaoEmTexto` em `src/core/recibo/recibo.ts` já faz a frase);
- validade do plano (de/até), preenchida pela duração do plano e editável;
- forma de pagamento e data do recebimento.

Decidir antes: recibo sem pagamento (`recibo.pagamento_id` aceita nulo?) ou o
formulário cria contrato + cobrança + pagamento por baixo. O segundo mantém o
Financeiro honesto; o primeiro é o que o Daniel descreveu.

### 2. Botão "Renovar contrato"

Hoje "Registrar renovação" só muda `pessoa.vencimento_plano`. Renovar de verdade
é "Novo contrato" à mão. O botão deve criar o contrato seguinte já preenchido
(mesmo plano, mesmos horários, início no fim do anterior), com desconto e
"recebido de uma vez" (0077), e encerrar o anterior passando as vagas.

Junto: **20 cobranças indevidas** abertas no mês do fim de contratos (o bug da
13ª parcela, corrigido em `eca2c59` para frente, mas as que já existiam ficaram).
Para listar: script em `cobrancasPrevistas` contra os contratos com `fim`
(ver o commit). 7 já pagas (renovações lançadas na cobrança errada: Emília,
Márcia, Daniela, Lucilene, Luciana, Pedro Paulo...) viram contrato novo. 13
sem pagamento (Mônica, Amilcar, Argentina, Márcia, Marcelo, Sidney, Sarah,
Benedito, Maria Cristina, Lucilene, Daniela, Gustavo, Luz Marina): se renovou,
contrato novo; se não, cancelar a cobrança. Precisa do Daniel.

### 3. As 156 faltas justificadas de jan a ago/2026

A importação de 07/10 encerrou como "reposição acertada no papel" 156 faltas
justificadas de 49 alunos (a do 26/01 da Ana Maria é uma). O Daniel está
conferindo aluno por aluno em ordem alfabética; em 13/10 ele já tinha mexido em
Elena, Erika, Gabriela e Jaqueline. Combinado: perguntar até qual aluno ele foi
e reabrir só dos seguintes. Márcia de Toni e Walkiria já foram reabertas.

### 4. Reorganizar reposições com falta mais antiga sem ligação

`server/agenda/reorganizar-reposicoes.ts` só troca a ordem entre faltas já
ligadas. Quando a recepção marca como justificada uma falta mais antiga
**depois** da reposição ligada (Erika: 06/08 marcada em 13/10, reposição de 08/10
pagando 31/08), a regra "a mais cedo paga a mais antiga" não se aplica sozinha.
Acertado à mão para a Erika.

### 5. Conferir logado

Não testado com sessão: a troca de semana com pré-carregamento (`9b5f2bf`), a
visão Mês (`62bb1a0`) e o login por `getClaims` (`dd25a77`). Abrir a Agenda,
trocar de semana várias vezes, abrir o Mês, entrar e sair.

## Feito em 13/out (tudo na `main`, no ar)

| Commit | O quê |
|---|---|
| `5c10563` + 0075 | Falta na aula de reposição não paga a falta antiga (`NAO_REPOEM`). |
| `c22e5f7` + 0076 | `conta.credito_falta`: falta sem aviso gera crédito? Desligado na MGM (357 para 281 reposições). |
| `639a852`, `baa8833`, `9b5f2bf` | Agenda: menu do período (esta/próxima semana, 12 meses, data digitada), pré-carrega 4 semanas para cada lado. |
| `971480e` | Horário novo ganha o próximo número de turma; Personal numerados 075 a 086. |
| `62bb1a0` | Visão Mês; botões com papéis distintos (trilho cinza no `Abas`, filtro verde-claro, ação preta). |
| `9b87453` | Menu de presença abre para cima perto do fim da página. |
| `dd25a77` | Proxy e `contaAtiva` usam `getClaims` (ES256), sem ida ao Supabase. |
| `2cae947` + 0077 | Desconto e motivo no contrato; "recebido de uma vez" (uma cobrança só); recibo com período e desconto. |
| `eca2c59` | Contrato não mensal com fim não recomeça ciclo (fim da 13ª parcela). |

AutoFluxos: `71862037` + 0134 (responsável padrão; todas as 182 conversas da
MGM com o Daniel) e saudação do bot da MGM sem contagem de reposições
("Fluxo - Atendimento" v22).

## Dados de produção alterados em 13/out (com autorização)

- 8 faltas de 2025 reencerradas; Personal numerados 075 a 086.
- Márcia (25/05, 05/06) e Walkiria (20/08) reabertas; Erika: reposição 08/10
  ligada a 06/08; Roberta Gramani reativada e com a terça 16h (era da Renata,
  mãe dela, por erro da importação).
- Arnaldo Bernal: recibo A-3 (R$ 525) cancelado, pagamento estornado, contrato
  antigo encerrado; renovação 12/09/2026 a 12/09/2027, R$ 6.226 (R$ 374 de
  desconto), paga de uma vez. Falta o Daniel emitir o recibo pelo Financeiro.
