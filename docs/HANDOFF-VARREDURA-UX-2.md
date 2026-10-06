# Handoff: varredura de UX/UI, continuação (06/out/2026, noite)

Continua `docs/HANDOFF-VARREDURA-UX.md`. **Leia aquele arquivo primeiro**: lá
estão as regras do Gabriel, o ambiente local e os comandos (prints, e2e,
espera do deploy). Este arquivo diz só o que mudou e o que falta. A lista de
tarefas viva é `docs/TAREFAS-VARREDURA.md`, com as reclamações dele resumidas.

## Feito e no ar (todos com deploy `READY`, salvo o último)

| Commit | O quê |
|---|---|
| `fd97245` | Parte 1: licença vale para o período inteiro. Regra em `src/core/agenda/licenca.ts` (`ajusteDaLicenca`), aplicada em `acertarAulas` (`src/server/licencas/licencas.ts`) e em `materializar.ts`. Testes em `tests/licenca-janela.test.ts` e `tests/licenca-periodo.test.ts`. |
| `1f86ff8` | Chamada: botões sólidos (tokens `reg-*` em `globals.css`), Presente / Falta / Falta justificada / Licença em todo o produto, origem em frase, "Trocar professor" como botão, "Cancelar aula" no menu "Outras ações". |
| `f754856` | Ficha: Editar dados e Marcar aula lado a lado, Inativar no "⋮", **condições (gestante, lesão...) editáveis em Editar dados** (antes não havia tela), cartão Plano com plano, valor e vencimento, Encerrar matrícula no "⋮". |
| `35db336` | Cobranças em tabela (`src/components/financeiro/lista.tsx`), filtros numa barra, período como menu suspenso (`BarraDePeriodo menu`), números em faixa compacta (`FaixaDeNumeros compacta`). |
| `06ecd43` | Fechamento: cartão grande "Entrou no período" com barras por forma e estornos no pé, resumo em 4 números, atraso com avatar e botão Ligar, cartão Previsão. |

## Feito e NÃO commitado (o Gabriel interrompeu antes do commit)

O que está na árvore de trabalho:
- `src/app/(app)/aulas/page.tsx`: avatar do professor, colunas Aulas dadas,
  Presenças, Sem alunos, Sem chamada, Canceladas, Agendadas; o rodapé virou
  um aviso com link para Pendências; "Baixar planilha".
- `src/components/recibo/lista.tsx`: o texto do vazio diz onde emitir.
- `e2e/aulas.spec.ts` atualizado (6/6 passando).
- `docs/TAREFAS-VARREDURA.md` ainda sem marcar esses itens.

Próximo passo: rodar `npx tsc --noEmit -p .`, commitar ("feat(financeiro):
aulas por professor com avatar e colunas claras"), fazer push, esperar
`READY`, marcar Recibos e Aulas em `TAREFAS-VARREDURA.md`.

## O que falta (na ordem)

1. **Hoje, Agenda (Semana, Dia, Grade fixa), Pendências, Alunos (lista),
   Configuração (6 seções), Entrar, convite, onboarding.** Mesma régua: termos
   formais, botão com cara de botão (uma ação principal, as secundárias com
   contorno, as raras no "⋮"), sem pastel em botão, sem cartão repetido, sem
   dica óbvia. Print antes e depois em `.rascunho/varredura/<tela>/`.
2. **Linguagem visual** (pedido forte dele): menos terroso e menos pastel, mais
   personalidade. Inspiração no AutoFluxos (`../autofluxos`): tabela da casa
   em `src/components/design/tabela.tsx`, botões, motion e ilustração. Os
   tokens `reg-*` mostram a direção que ele aprovou (vermelho e azul limpos).
   Avalie revisar a paleta em `globals.css` como frente própria, com print do
   produto inteiro.
3. Ilustração nos estados vazios e motion leve (marcar presença, menu, aviso).
4. A lista de Alunos e a tela de Aula também "dá para melhorar", nas palavras
   dele.

## Decisões tomadas nesta rodada (não refaça a discussão)

- Aulas por professor **fica no Financeiro**: é a base do pagamento da equipe
  e só o dono vê. Se ele insistir, a alternativa é a Agenda.
- O selo de estado no avatar da chamada saiu: o botão sólido ao lado já diz.
- Etiqueta de origem ("Fixo") saiu da chamada: a frase da linha diz o mesmo.
- "Valor médio" saiu da faixa de Cobranças (continua em Recebidas).
- Estornos continuam visíveis no Fechamento porque o documento do cliente
  pede.
- Os menus "⋮" da página se chamam "Outras ações" (o da linha da chamada
  continua "Mais ações", porque o e2e usa `.first()` nele).

## Pendências para o relatório final ao Gabriel

- **Licenças já abertas na MGM** só passam a liberar as aulas seguintes na
  próxima prorrogação ou volta. Nada foi rodado em produção.
- **Webhook do bot**: a liberação por licença **não** dispara
  `participacao.cancelada` (o bot trata o evento como desistência). Avisa só a
  fila de espera interna (`vaga.aberta`). Isso precisa ser combinado com o bot
  da MGM.
- `e2e/matricula.spec.ts`, teste "horário cheio é recusado", **já falhava
  antes desta rodada** (conferido com `git stash`). Não foi mexido.
- `e2e/financeiro.spec.ts`, teste "matricular faz a primeira cobrança nascer
  sozinha", falha de vez em quando na suíte e passa sozinho.
- O lint acusa `setState` dentro de efeito em `src/components/sessao/chamada.tsx:98`,
  e isso também é anterior a esta rodada.
- Nenhuma função foi apagada, só movida para o "⋮".

## Estado do ambiente

O Supabase local da Verandi e o `next dev -p 3200` estavam de pé. Os prints de
antes e depois estão em `.rascunho/varredura/` (fora do git).
