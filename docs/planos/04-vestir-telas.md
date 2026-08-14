# Vestir as telas com o design system novo

Estado em 13/08/2026. Branch `design-system-novo`, já mesclada em `main`.

O design system novo (`Design system Verandi-att/DESIGN-SYSTEM.md`) passou a ser
a fonte de verdade. Os tokens e primitivos já estão aplicados no produto inteiro;
o que **falta é a comparação tela a tela com o protótipo**, que é onde as
diferenças de layout aparecem.

## O método — use este, não outro

Ler o código do protótipo não substitui olhar a tela renderizada. Foi esse
atalho que produziu telas "com os tokens certos" e nenhuma semelhança com o
desenho.

```bash
npx supabase start && node scripts/semear-dev.mjs
npm run dev                                   # noutro terminal
node scripts/tira-prototipo.mjs .prototipo    # protótipo, 1440×1000
node scripts/tira-produto.mjs .produto        # produto, mesma viewport
```

Depois, **para cada tela**: abrir as duas capturas lado a lado → escrever a lista
de diferenças (estrutura, posição, hierarquia, tamanho de fonte, o que falta) →
corrigir → recapturar → comparar de novo. Só passar adiante quando bater.

A marcação de cada tela está em `Design system Verandi-att/Verandi.dc.html`,
com o estilo literal embutido em cada elemento. `grep -n "Vagas recorrentes"`
leva direto ao trecho.

**Escopo combinado com o Gabriel:** construir os blocos que faltam, não só
rearranjar o que existe. Onde não houver dado no banco, dizer e deixar o bloco
de fora — nunca inventar número.

## Feito

| Tela | O que mudou |
|---|---|
| **Ficha da pessoa** | ações saíram de dentro do bloco de conteúdo para o canto superior direito (Agendar · Editar dados · Marcar inativa); entraram as abas Agenda/Histórico/Reposições/Perfil; entrou a coluna direita (Atenção na aula, Contato, Plano, Em números); Histórico ganhou a faixa das 12 semanas |
| **Buscar vaga** | 9469px → 4901px; período em campos de data virou faixa de dias em chips; padrão caiu de 14 para 7 dias; entraram turno e local; o lotado saiu da lista separada e entrou na mesma lista atrás do interruptor "incluir lotados" |
| **Hoje** | já estava perto; só a pilha de avatares aparecia cortada |

## Falta comparar

Nesta ordem: **Sessão · Alunos · Semana · Grade fixa · Pendências · as 7 seções
de Configuração · Contas 4YU**.

O que já sei que difere, do que vi de passagem nas capturas:

- **Alunos** — o protótipo tem contagem em cada chip de filtro (`Todos 28`,
  `Sem telefone 5`), um chip "Todos", botão "Exportar" ao lado de "Cadastrar",
  telefone mascarado (`(11) 9••••-3312`) e `id 1042` embaixo do nome. O rodapé
  da lista diz "1–8 de 28 · pessoa inativa não some, fica fora do padrão".
- **Grade fixa** — o protótipo tem um aviso verde no topo ("editar vale daqui
  para frente") e uma coluna direita de 300px que não temos.

## Blocos do protótipo que **não** dá para construir hoje

Não são esquecimento; falta dado. Se forem construídos, precisam de migration
antes:

- **"Últimas buscas"** na Vaga — precisa guardar busca por usuário.
- **"Últimas ações"** na ficha — precisa de log por pessoa; o `src/server/log.ts`
  hoje só cobre configuração.
- **Telas de acesso `esqueci`, `enviado` e `nova senha`** — dependem de SMTP,
  marco 2. A arte e os textos já estão prontos em
  `src/components/ui/arte-acesso.ts`, esperando.

## Armadilhas que já custaram caro

1. **`rounded-[--radius-x]` não existe no Tailwind v4.** Vira
   `border-radius: --radius-x` e o navegador descarta calado — o app rodou sem
   canto arredondado nenhum e nada acusou. Token de `@theme` gera utilitário
   próprio: `rounded-cartao`, `shadow-modal`. Há quatro testes em
   `e2e/primitivos.spec.ts` que medem estilo computado e falham se voltar.
2. **`tsc` e os testes não veem CSS.** Antes de dizer que uma tela ficou pronta,
   medir com `getComputedStyle` no navegador.
3. **Data em teste com `toISOString()` é UTC**, e a conta vive em
   America/Sao_Paulo. Entre 21h e meia-noite as duas discordam. Use dois dias de
   folga, não um.
4. **O seed morre depois da suíte de navegador.** `npx supabase db reset --local`
   e `node scripts/semear-dev.mjs` de novo antes de capturar.
