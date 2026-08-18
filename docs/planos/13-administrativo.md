# Plano 13, o administrativo: planos, dinheiro, recibo e acompanhamento

O que o Studio MGM Pilates pediu por escrito, lido com a régua da Verandi: isto
é **agendamento**, ou é **este cliente**? O documento original está em
`SISTEMA ADMINISTRATIVO PARA STUDIO MGM PILATES.docx`, na raiz do repositório, e
o desenho aprovado das telas está no canvas de 18/08.

Este arquivo é o **guarda-chuva**: as decisões, o modelo e a ordem. Cada módulo
ganha o seu plano detalhado quando chegar a vez dele, e não antes: plano escrito
com seis semanas de antecedência descreve um sistema que já mudou, e foi o que a
Tarefa 10 do plano 03 ensinou.

## O que é do produto e o que é do cliente

| O documento pede | Vira | Por quê |
|---|---|---|
| Cadastro de matrícula com foto | campos na ficha que já existe | todo negócio que marca horário cadastra quem atende |
| Planos e valores, com código | **tabela `plano`** | todo negócio vende plano; a tabela de preços do MGM é dado |
| Turmas e horários | nada a construir | a Verandi já faz, e as 70 turmas são configuração |
| Controle financeiro | **módulo novo** | quem marca horário cobra por ele |
| Presenças e reposição | nada a construir | já existe desde o plano 02 |
| Cadastro de professores com foto | nada a construir | existe desde a `0038` |
| Aulas por professor | **relatório novo** | é a conta que fecha o pagamento de quem atende |
| Emissão de recibo | **módulo novo** | quem recebe dinheiro presta contas |
| Avaliação postural com fotos | **acompanhamento por foto** | pilates compara postura, fisioterapia compara lesão, estética compara antes e depois |

**Nada disso vira coluna do MGM.** As seis posições da avaliação, os quinze
planos de pilates, os vinte e sete de terapia e as setenta turmas são linhas que
a conta escreve, não `if` no código.

## As decisões que não dá para tomar duas vezes

**Um plano com duas tabelas de preço, não dois planos.** O documento cobra
R$ 195 de quem já é aluno e R$ 230 de quem só faz a terapia. Escrito como dois
planos, o recibo passa a dizer o nome errado, o relatório soma serviço com
serviço, e manter a tabela dobra. A coluna é `preco_vinculado` e
`preco_avulso`; quem decide qual usar é o servidor, no ato da matrícula, e a
tela mostra qual usou.

**Código de plano é único por conta, e o banco recusa o repetido.** O documento
tem `104` em dois planos e `119` e `120` em quatro linhas. Não é descuido de
quem escreveu: é o que acontece com toda tabela de preço mantida à mão. O
sistema recusa com o motivo escrito, e diz de quem é o código.

**Recibo não é nota fiscal, e os dois existem.** O recibo é do estúdio, sai na
hora, numeração nossa. A nota é da prefeitura, e cada cidade tem um padrão: a
Verandi vai **pedir** a nota a um emissor, nunca falar com a prefeitura direto.
Isso é o módulo mais caro e o único que depende de terceiro, então é o último.

**Recibo não se edita: corrige-se.** A correção cria versão nova e guarda a
anterior, porque a via impressa continua existindo no mundo. Cancelar exige
motivo, e o número fica cancelado e vazio: buraco na sequência é a primeira
coisa que uma fiscalização pergunta.

**Foto de avaliação é dado de saúde.** Balde privado, endereço assinado com
prazo, e a recepção não enxerga. Quem sobe é quem atende: profissional e dono.
A anonimização do titular (`0043`) passa a apagar as imagens também, senão o
direito do titular vira promessa pela metade.

**Financeiro não pode ser uma listagem e pronto.** Quem usa é a recepção, entre
um aluno e outro, com o telefone tocando. Isso significa: página com vinte
linhas e paginação na URL, filtro que responde enquanto se digita, o que vence
hoje em primeiro, e registrar pagamento em dois cliques a partir da linha. A
tela abre no que precisa de decisão, não no extrato do mês.

## O modelo, em uma tela

```
plano            conta_id · codigo · nome · modalidade(servico_id) · recorrencia
                 frequencia_semanal · sessoes_no_pacote · parcelas
                 preco_vinculado · preco_avulso · validade_meses · ativo

contrato         conta_id · pessoa_id · plano_id · inicio · fim · dia_vencimento
                 preco_aplicado · vinculo_usado · status

cobranca         conta_id · contrato_id · pessoa_id · competencia · vencimento
                 valor · status(a_vencer|paga|vencida|cancelada|estornada)
                 pago_em · forma_pagamento

recibo           conta_id · numero · serie · cobranca_id · versao · status
                 emitido_em · emitido_por · cancelado_em · motivo_cancelamento
                 corpo (o que foi impresso, congelado)

avaliacao        conta_id · pessoa_id · data · profissional_id · observacao
avaliacao_foto   conta_id · avaliacao_id · posicao_id · path · observacao
posicao_avaliacao conta_id · nome · ordem · ativo
```

`pessoa.vencimento_plano`, que hoje é uma data solta preenchida à mão, passa a
ser derivada do contrato. A coluna fica, e quem escreve nela passa a ser o
sistema: apagá-la agora quebraria a ficha e a lista de pendências no mesmo dia.

## A ordem, e o porquê dela

1. **Plano 14, acompanhamento por foto.** Primeiro por ser o único que não
   depende de nenhum dos outros, por ensinar o caminho de imagem múltipla antes
   de o financeiro precisar dele, e por ser o que o cliente mais quer ver.
2. **Plano 15, planos e valores.** O financeiro não existe sem o catálogo, e o
   catálogo sozinho já substitui a tabela de preços que hoje vive num documento.
3. **Plano 16, financeiro e recibo.** Contrato, cobrança, pagamento, recibo e
   os relatórios que o documento lista. É o maior, e é onde a facilidade de uso
   vale mais que a completude.
4. **Plano 17, produtividade de quem atende.** Aulas aplicadas por dia, semana e
   mês, com o feriado explicado, porque número que acusa a pessoa errada é pior
   que número nenhum.
5. **Nota fiscal.** Depois de tudo, e só quando houver decisão comercial sobre
   qual emissor. Até lá a tela desenhada fica como desenho.

## O que não bate em nada, e como não bater

- **Migrations seguem de `0053` em diante**, uma por módulo, e o número se
  descobre olhando `supabase/migrations/`, nunca copiando daqui.
- **Produção é `node scripts/aplica-em-producao.mjs`**, com a conferência de
  cinco passos do `HANDOFF.md`. Nunca `supabase db push`.
- **Balde novo do Storage é global ao projeto**, que é dividido com o
  AutoFluxos: nome com prefixo `foto-`, como os dois que já existem, e política
  que separa por pasta de conta.
- **Coluna nova não entra em view sozinha**, e `create or replace view` só
  aceita acréscimo no fim. Mordeu na `0043` e na `0044`.
- **`npm run tipos` depois de toda migration**, senão o `tsc` segue passando com
  a forma antiga do banco.
- **A régua do vocabulário vale**: nem artigo nem adjetivo colado na palavra do
  cliente, com o lint de `tests/unit/regua-do-vocabulario.test.ts` guardando.
- **Texto do produto não leva travessão.**
- **Regra que a tela e a API precisarem das duas sai para `core/`**, e as duas
  chamam. Vale para preço aplicado, para vencimento e para numeração de recibo.
- **Toda tela nova entra no onboarding e no rail** com o papel certo: financeiro
  e recibo não são da profissional, avaliação não é da recepção.
