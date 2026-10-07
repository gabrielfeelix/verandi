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

## Falta (atualizado 07/out, fim do dia)

Fechados: Nº da ficha único no banco (`4bd5415`, migration 0073 aplicada),
busca por telefone devolve a família (`fb60f3e`), `sessao.cancelada` leva
`alunos` soltos (`461d6bc`), e2e de financeiro e recibos (`8de5a64`).
**Nomes sem par do MGM: resolvidos** pela resposta do Daniel (17 nomes
mantidos ativos, o resto excluído, Alexandres unidos no 426, 6 ex-alunos e
6 testes inativados). Não pergunte de novo.

1. **Wellhub**: plano e e-mail em `docs/WELLHUB.md`. Espera o Gabriel mandar
   o e-mail e o ID do estúdio da MGM; sem credencial não há o que codar.
2. **Bot da MGM**: passar a ler `dados.alunos` do `sessao.cancelada` e,
   na busca por telefone, perguntar o nome quando `total` > 1.
3. `recibo.spec.ts` "emitir nasce da linha" é instável (passa ao repetir).

## Atenção

- Outra sessão trabalha em paralelo na `main`: `git status` e `git diff`
  antes de commitar, commite só o seu.
- Avisos do navegador só aparecem para dono/recepção, com a permissão
  concedida no sino. A primeira busca de cada navegador só anota o que já
  existe.
- Pré-carregamento de período só funciona em produção (o `next dev` não
  pré-carrega).
