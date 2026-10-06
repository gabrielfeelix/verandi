# Handoff: varredura de UX/UI, parte 3 (06/out/2026, fim da tarde)

Continua `docs/HANDOFF-VARREDURA-UX.md` (regras e comandos) e
`docs/HANDOFF-VARREDURA-UX-2.md`. Lista viva: `docs/TAREFAS-VARREDURA.md`.

## Mudança de regra pedida pelo Gabriel nesta tarde

**Não publicar até o fim do dia.** Commit e push vão para o branch
`varredura-ux` (a Vercel gera só prévia). No fim do dia, quando ele pedir:
merge na `main`, push, conferir `READY`.

## Onde está cada coisa

- Na `main` e no ar: `902449c` Hoje, `0f7e788` Agenda, `2f289cd` Pendências,
  `f73d88a` Alunos (este entrou antes do pedido de não publicar).
- No branch `varredura-ux`, ainda fora do ar: `50a9343` Configuração,
  `ec105a3` acesso e onboarding, `cfc2d1e` paleta.
- A Vercel não criou deploy para `902449c` nem `0f7e788`; o push seguinte
  levou os dois. Vale conferir o webhook se repetir.

## O que falta

1. Ilustração nos estados vazios (componente `Vazio` em `ui/pecas.tsx` usa
   só um ícone) e motion leve (presença, menu, aviso).
2. Tela de Aula e ficha do Aluno "subirem de nível".
3. Tabelas e botões no padrão do AutoFluxos (`../autofluxos/src/components/design/tabela.tsx`).

## Pendências para o relatório final

As do handoff 2 continuam (licenças abertas na MGM, webhook do bot, e2e de
matrícula que já falhava, lint de `chamada.tsx:98`), mais:
- `e2e/onboarding.spec.ts`, "a visita guiada..." e "quem só opera...",
  **já falhavam antes** (conferido com `git stash`).
- `e2e/entrar.spec.ts` oscila numa rodada e passa na seguinte (6/6).
- Situação do aluno: a tela mostra "Em dia", "Faltas recentes"...; a API
  `GET /pessoas/{id}` continua devolvendo "ativa", "faltando" para não
  quebrar o bot.
