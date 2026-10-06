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

## Como começar (próximo agente)

1. Leia, nesta ordem: `docs/HANDOFF-VARREDURA-UX.md` (regras do Gabriel,
   ambiente, comandos de print e e2e), `docs/HANDOFF-VARREDURA-UX-2.md`
   (decisões já tomadas), este arquivo e `docs/TAREFAS-VARREDURA.md`.
2. `git switch varredura-ux && git pull`. **Trabalhe neste branch.** Não faça
   merge na `main` sem o Gabriel pedir: push na `main` publica.
3. Ambiente: Supabase local da Verandi (`docker ps | grep verandi`) e
   `npx next dev -p 3200` (log em `.rascunho/dev.log`). Se o app não responder
   em `http://localhost:3200/entrar`, suba os dois como diz o handoff 1.
4. Uma frente por commit, print antes e depois em `.rascunho/varredura/<frente>/`,
   `npx tsc --noEmit -p .` limpo, só o e2e da tela mexida, um por vez.
5. Antes de mexer em texto, rode `grep` em `e2e/` e `tests/`: vários testes
   prendem texto visível, e `tests/unit/onboarding.test.ts` guarda a regra de
   não colar artigo na palavra do vocabulário ("um modalidade").

## O que falta

Na ordem:

1. **Ilustração nos estados vazios.** `Vazio` (`src/components/ui/pecas.tsx`)
   mostra só um ícone num círculo. Há arte pronta para reaproveitar:
   `src/components/ui/arte-acesso.ts` (a tela Entrar) e as artes do
   onboarding (`QUADRO`, `PORTA`, `CHAVE`, `CADEADO` em
   `src/core/onboarding/boas-vindas.ts`). Veja como o AutoFluxos faz antes
   (`../autofluxos`, procure por estados vazios e ilustração).
2. **Motion leve**: troca de estado na chamada (`src/components/sessao/`),
   abertura de menu (`ui/menu.tsx` e `ui/suspenso.tsx` já usam `vd-pop`),
   aviso (`ui/desfazer.tsx`). Respeite `prefers-reduced-motion`.
3. **Aula (`/sessao/[id]`) e ficha do Aluno (`/pessoas/[id]`) sobem de
   nível**: o Gabriel disse que são "as melhores hoje" mas "dá para
   melhorar". Abra os prints `chamada`, `ficha*` e faça a mesma régua.
4. **Tabelas e botões no padrão do AutoFluxos**
   (`../autofluxos/src/components/design/tabela.tsx`). Cobranças já virou
   tabela (`src/components/financeiro/lista.tsx`); Alunos e Recibos ainda são
   listas em grade.
5. Itens menores vistos e não feitos: "Tirar de uso" e "Desativar" ainda são
   texto solto em cada linha de Planos e Equipe (candidatos ao "⋮"); no
   modo Dia da Agenda, "Por local / Por professor" quebra para a linha de
   baixo em 1440; rótulo "22 matrículas" no cabeçalho de cada dia da grade
   fixa soma capacidade, deveria dizer vagas.

## Fim do dia (só quando o Gabriel pedir)

```bash
git switch main && git pull && git merge --no-ff varredura-ux && git push
```
Depois espere o `READY` com o laço do handoff 1, troque o `H` pelo hash do
merge. Se der `ERROR`, o log está no endpoint de eventos do deploy.

## Pendências para o relatório final

As do handoff 2 continuam (licenças abertas na MGM, webhook do bot, e2e de
matrícula que já falhava, lint de `chamada.tsx:98`), mais:
- `e2e/onboarding.spec.ts`, "a visita guiada..." e "quem só opera...",
  **já falhavam antes** (conferido com `git stash`).
- `e2e/entrar.spec.ts` oscila numa rodada e passa na seguinte (6/6).
- Situação do aluno: a tela mostra "Em dia", "Faltas recentes"...; a API
  `GET /pessoas/{id}` continua devolvendo "ativa", "faltando" para não
  quebrar o bot.
