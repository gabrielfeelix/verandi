# Handoff: revisão geral, terceira parte (07/out/2026)

Continua `docs/HANDOFF-07-OUT-REVISAO-2.md` e `docs/HANDOFF-REVISAO-GERAL.md`
(regras, ambiente, banco compartilhado). Aqui só o que mudou e o que falta.

## Feito (tudo na `main`)

Tarefa 2 (modais restantes) fechada, tarefa 5 (fluxo das telas) feita no que
o Gabriel apontou e numa varredura de celular.

| Commit | O quê |
|---|---|
| `9c649ed` | **Segurança**: aceite de convite trocava a senha de usuário já existente (Auth é compartilhado com AutoFluxos; o dono vê o link). Agora pede a senha atual. Convite recusado para quem já tem acesso; link de senha recusado para quem acessa outra conta. |
| `c1f26e2` | Data fechada: aula gerada depois nasce com reposição em aberto; "só marcar" não cancela mais na geração; avisa o bot; data passada recusada. |
| `2e68a83`, `e5b4f91` | Serviço/local com nome repetido recusado; checkboxes nativos viram `CampoAtivo`/`CampoInterruptor`. |
| `424c688` | Plano com contrato em vigor não muda modalidade, recorrência, parcelas, frequência nem horário livre (o contrato lê isso do plano, ao vivo). |
| `f501add` | Webhook: destino precisa ser público; entregador não segue redirecionamento. |
| `031479a` | Avaliação: foto ruim recusada antes de criar; falha no meio desfaz a visita. |
| `34ee62f` | **Cancelar aula não abria reposição** (participação ficava `esperada`). `server/agenda/soltar.ts` centraliza: cancelar solta todos, reabrir devolve, aula que sai da grade solta só avulsos. Encerrar horário fecha as vagas fixas. Criar horário nasce com duração e lugares do serviço. |
| `bf8e7ca`, `94bf296` | Pessoas e admin: alavancas, placeholders, fuso no menu. |
| `1c19b84` | Sino: avisos no navegador (busca a cada 45 s no layout, permissão pedida no sino), novidades do bot (confirmou, remarcou, entrou), importação fora, painel novo, contagem some ao abrir. |
| `8a37679` | Financeiro: "Ligar" vira "Enviar mensagem" no WhatsApp com o lembrete escrito. |
| `fb20df5` | Agenda e Hoje: consultas em paralelo, materialização numa ida só, setas pré-carregam o período vizinho. |
| `1a1ff01`, `5362d03` | Financeiro cabe no celular. |

## Falta

1. **Integração Verandi ↔ Wellhub (pedido do Gabriel)**: pesquisar se o
   Wellhub/Gympass tem API para parceiros puxarem os check-ins. Objetivo:
   aluno faz check-in no Wellhub, o estúdio aceita lá, e a presença já
   aparece confirmada na Verandi. `pessoa.gympass` já existe (marca o aluno).
   Comece pela documentação de parceiros do Wellhub (Partners API / Booking
   e Check-in API), o que exige credencial do estúdio e como ligar o aluno
   deles ao nosso (`identificador_externo` ou telefone).
2. Tarefa 4 (Nº da ficha automático) e 6 (nomes sem par do MGM): ver
   `HANDOFF-REVISAO-GERAL.md`. A outra sessão mexeu no Nº da ficha: confira
   antes.
3. e2e velhos que falham sem relação com esta rodada:
   `home-e-adiantado.spec.ts` ("Valor médio" não existe mais na tela;
   "recibos se recorta por data"). `recibo.spec.ts` "emitir nasce da linha"
   é instável (passa ao repetir).
4. Telefone repetido entre alunos **não** foi bloqueado de propósito: mãe e
   filha dividem número. Se o bot precisar de unicidade, a decisão é do
   Gabriel.
5. O bot recebe `sessao.cancelada` nas aulas que saem da grade e na data
   fechada, mas não `participacao.cancelada` para quem foi solto (o bot
   trata esse evento como cancelamento pedido pelo aluno). Combinar com o
   bot da MGM.

## Atenção

- Outra sessão trabalha em paralelo na `main`: `git status` e `git diff`
  antes de commitar, commite só o seu.
- Avisos do navegador só aparecem para dono/recepção, com a permissão
  concedida no sino. A primeira busca de cada navegador só anota o que já
  existe.
- Pré-carregamento de período só funciona em produção (o `next dev` não
  pré-carrega).
