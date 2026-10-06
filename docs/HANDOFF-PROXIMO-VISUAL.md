# Handoff para o próximo agente: bugs visuais e revisão de UX/UI

Escrito em 06/out/2026, depois da rodada de simplificação
(`docs/HANDOFF-06-OUT-SIMPLIFICACAO.md`). Leia este arquivo inteiro antes de
mexer em qualquer tela.

## Missão

O Gabriel é designer, não é dev. Ele quer a Verandi **mais fácil, mais leve e
mais bonita**. A rodada anterior cortou excesso de estrutura (menu, botões,
filtros). Esta rodada é o acabamento: bugs visuais, tipografia, contraste,
espaçamento e mais uma passada criteriosa de UX/UI **tela por tela**.

Duas partes, nesta ordem:

1. **Corrigir o que ele já apontou** (lista abaixo). É decisão tomada: faça,
   mostre o print, commite.
2. **Auditar cada tela** como designer de UX/UI. Para cada tela: o que está
   em excesso, o que é redundante, o que confunde, onde o contraste ou a
   hierarquia falham. **Recomende antes de aplicar** o que mudar regra ou
   tirar funcionalidade. Ajuste puramente visual (espaço, peso, cor, tamanho)
   pode aplicar direto.

## 1. O que o Gabriel já pediu (fazer)

### 1.1 Sidebar "sambando" para cima e para baixo
O rail precisa ficar **fixo, com altura fixa**. Ele não pode se mexer ao
rolar a página nem ao trocar de tela.
- Código: `src/components/ui/rail.tsx`, por volta da linha 105 (`sticky top-0
  h-dvh self-start`). Há um comentário logo acima sobre a briga entre
  `relative` e `sticky` no miolo.
- Layout: `src/app/(app)/layout.tsx`.
- Hipóteses a testar: `h-dvh` muda com a barra do navegador; o `sticky` perde
  para algum ancestral com overflow; a troca de tela (`AreaQueTroca`, em
  `src/components/ui/troca.tsx`) muda a altura do conteúdo e leva o rail
  junto. Provavelmente a saída é `fixed` com largura reservada no layout.
- Reproduzir rolando uma tela longa (Agenda, Financeiro) e navegando entre
  telas, em 1440 e com a janela baixa. Gravar o antes e o depois.

### 1.2 Tirar a faixa "você está como suporte"
Ele não quer o aviso. Quando estiver como suporte dentro da conta de um
cliente, basta poder **sair**, sem faixa avisando.
- `src/components/ui/faixa-suporte.tsx`, usado em `src/app/(app)/layout.tsx`
  (`conta.papel === 'suporte' && !conta.interna`).
- Garanta que a ação de sair do suporte continue alcançável em outro lugar
  (menu da conta no rodapé do rail, por exemplo). A ação no servidor é
  `sairDoSuporte` em `src/server/suporte/acoes.ts`.

### 1.3 Contraste
Ele ainda não revisou e quer que você revise. Os tokens de cor ficam em
`src/app/globals.css` (`--color-*`, por volta da linha 90). Confira o texto
`text-tinta-media`, `text-tinta-fraca` e `text-tinta-apagada` sobre
`bg-superficie` e `bg-superficie-suave`, os chips e as etiquetas miúdas de
11.5px em caixa alta. Meça a razão de contraste (WCAG AA: 4.5 para texto
normal, 3 para texto grande) e liste o que falha antes de mudar os tokens:
mexer num token muda o produto inteiro.

### 1.4 Tipografia "cansativa"
Nas palavras dele, o sistema tem uma tipografia muito cansativa.
- Fontes em `src/app/layout.tsx`: Bricolage Grotesque (títulos), Inter
  (texto), DM Mono (números, horários).
- Suspeitas para avaliar: mono demais (horas, valores, telefones, contagens,
  tudo em DM Mono); muitos tamanhos quebrados (13, 13.5, 14, 14.5, 15...);
  rótulos em caixa alta com tracking largo espalhados; a Bricolage pesada em
  títulos de 30px. O `docs/DESIGN.md` registra decisões anteriores: leia
  antes de propor.
- Entregue uma **proposta** de escala (poucos tamanhos, pesos definidos, onde
  o mono entra e onde não) com print de antes e depois de 2 ou 3 telas.
  Aplique no produto depois que ele aprovar.

### 1.5 Iniciais coladas na borda do círculo
O avatar com iniciais (agenda, listas, chamada) tem as letras grudadas no
contorno.
- `Avatar` em `src/components/ui/pecas.tsx` (linha 380) e `AvatarProf` em
  `src/components/hoje/pecas.tsx` (linha 30). Também há avatares montados à
  mão: procure `iniciaisDe(` e `paresDe(`.
- Ajuste a proporção da fonte para o tamanho do círculo (24, 28, 32, 40, 56)
  e a sobreposição dos avatares empilhados na Agenda do dia, onde o anel de
  um corta as letras do outro.

## 2. Auditoria tela por tela (recomendar)

Faça a revisão na ordem de uso real:

1. Hoje
2. Tela da aula (chamada)
3. Agenda (Semana, Dia por recurso, Grade fixa)
4. Pendências
5. Alunos, depois a ficha (as abas Agenda, Histórico, Reposições, Avaliação
   e Contratos)
6. Financeiro (Cobranças, Fechamento, Recibos, Aulas por professor)
7. Configuração (são 10 seções; é forte candidata a enxugar)
8. Entrar, convite, onboarding

Para cada tela, entregue:
- prints em 1440 e 390;
- o que sobra, o que se repete e o que confunde;
- recomendações em ordem de impacto, separando "ajuste visual" (aplicar
  direto) de "muda regra ou tira função" (perguntar antes).

Pense em cenários, não só em telas paradas. A rodada anterior achou bugs
assim: uma aula de daqui a 2 semanas mostrava "Não veio" (virou "Agendado");
um aluno de licença aparecia como "ativa" na lista. Pergunte sempre "e se a
aula ainda não aconteceu?", "e se o aluno faz duas modalidades?", "e no
celular, com a barra de baixo?", "e a recepção, que não vê dinheiro?".

Contas para testar: crie uma por spec (ver Ambiente). A conta **4YU TESTE**
existe em produção, mas a senha está só com o Gabriel.

## Como trabalhar com o Gabriel (regras que ele já deu)

- **Resposta curta**, decisão tomada, sem lista de opções. Pendência em uma
  linha.
- **Sempre mostrar o print** antes de entregar UI: 1440 e 390, tela bonita,
  largura cheia.
- **Commitar e publicar na hora** (`git push` na `main` publica na Vercel).
  Junte os commits da mesma frente.
- **Não rodar a suíte inteira.** Valide com `npx tsc --noEmit -p .` e só o
  spec e2e da tela mexida.
- **Um processo pesado por vez**, para não derrubar a WSL: nunca e2e junto
  com build, e nunca dois Supabase locais ao mesmo tempo.
- **Nada de subagente para implementar**: a espera o irrita. Subagente só
  para levantar código.
- **Travessão (—) proibido** em todo arquivo que você abrir, inclusive os
  antigos: troque por vírgula, dois pontos ou ponto.
- Placeholder de campo começa com "Exemplo:". Texto de UI em tom de SaaS
  B2B, sem gênero presumido.
- **Ações otimistas**: a tela muda no toque, com aviso; nada de
  `revalidatePath` na rota aberta para esperar o servidor.
- Telefone com DDD 44 em dado de cliente é teste do Gabriel, nunca real.
- Banco de produção compartilhado com o AutoFluxos: leia
  `docs/BANCO-COMPARTILHADO.md` antes de tocar em banco. Esta rodada não
  deve precisar de migration.

## Ambiente (o que funcionou nesta sessão)

- Docker Desktop precisa estar ligado (é o Gabriel quem liga).
- Se o Supabase local do AutoFluxos estiver de pé, pare-o primeiro
  (`npx supabase stop` em `autofluxos/`), depois rode `npx supabase start`
  em `verandi/`.
- Migration local:
  `docker exec -i supabase_db_verandi psql -v ON_ERROR_STOP=1 -U postgres -d postgres < arquivo.sql`.
  O banco local já está até a `0070`.
- App: `npx next dev -p 3200`, rodando em segundo plano.
- Prints: `.rascunho/` (fora do git, via `.git/info/exclude`).
  - Genérico: `SAIDA=<pasta> TELAS='[["/rota","nome","texto esperado"]]' npx playwright test -c .rascunho/pw.config.ts .rascunho/p.spec.ts`.
    Passe o caminho do spec inteiro: o padrão `p.spec.ts` sozinho também
    casa com `sup.spec.ts`.
  - Specs prontos desta rodada: `ch2` (chamada), `enc` (encaixe), `marcar`
    (Marcar aula e Agenda), `hoje2`, `alunos`, `ficha2`, `lic` (licenças em
    Pendências).
  - Com `fullPage` em 390, a barra de baixo aparece no meio da imagem. É a
    captura, não a tela.
- e2e de uma tela: `npx playwright test -c .rascunho/pw-e2e.config.ts e2e/<arquivo>.spec.ts`.

## O que já se sabe que está quebrado (não é seu, mas não estranhe)

- `tests/unit/api-doc.test.ts`: `GET /funcionamento` sem documentação.
- `e2e/matricula.spec.ts`, "horário cheio é recusado": já falhava antes da
  rodada anterior.
- Lint: `chamada.tsx` tem `setEncaixe` dentro de efeito (é anterior).
