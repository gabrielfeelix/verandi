# Vida nas telas: movimento na entrada e ilustração onde ainda não há dado

Anotado em 14/08/2026, do Gabriel, olhando a Brevo. **Nada disto foi
construído.** É captura de ideia com o porquê junto, para não virar "põe uma
animação" daqui a três meses.

## O que ele viu

### 1. O movimento da marca enquanto a sessão é resolvida

Quando o login ainda está em cache, a Brevo não mostra tela branca: mostra a
logo dela se montando, um traço de cada vez, e só então o painel aparece. O
tempo é o mesmo; a espera é que deixa de parecer travamento.

Isso encosta no acerto que acabou de ser feito no login (plano 07, item 2): lá o
problema era o botão voltar ao normal com a tela parada. É o mesmo assunto,
**dizer o que está acontecendo**, com outra ferramenta.

Onde caberia na Verandi:

- entre o `/entrar` e a primeira tela, que hoje é uma navegação muda;
- no `loading.tsx` das rotas pesadas, que hoje mostram esqueleto cinza;
- na primeira pintura do `/comecar`.

O "V" da marca já existe como peça (o quadrado menta do trilho e do painel de
acesso). Animar o que já existe é diferente de inventar uma abertura.

**A régua, para não virar enfeite:** movimento só onde há espera de verdade.
Segurar a tela 800ms para mostrar animação é mentir na direção contrária, e é
pior que a tela branca, porque agora é lento **de propósito**.

### 2. Ilustração e texto onde ainda não há dado

Nas telas em que nada foi criado, a Brevo põe ilustração e uma frase que ensina
o que aquela tela faz. No painel inicial há calendário, cartões de "comece por
aqui", número de contato, uso do plano. Nenhuma tela é um retângulo vazio.

O efeito, nas palavras dele: **dá a ideia de que o SaaS está vivo**, de que
houve cuidado em cada tela.

Na Verandi isto já começou e está pela metade. O primitivo `<Vazio>` (ícone,
título, texto e **uma** ação) existe e é usado em `/semana`, `/vaga`,
`/pendencias` e na busca de pessoas. O que falta é o degrau seguinte:

- os vazios usam **glifo**, não ilustração. As quatro artes de `public/acesso/`
  provaram que ilustração muda o tom da tela, e elas só aparecem antes do login;
- não há tela inicial de "comece por aqui" depois do onboarding. Quem pula os
  apontamentos volta para a grade vazia com um `<Vazio>` e mais nada;
- os cartões de `/hoje` são corretos e secos: número, rótulo, tinta.

## O que decidir antes de fazer

1. **Quem desenha.** As artes de acesso foram geradas pelo Gabriel e otimizadas
   por `scripts/otimiza-arte.mjs`. Ilustração de vazio pede a mesma mão, senão a
   tela ganha dois estilos e fica pior do que com glifo.
2. **Quantas.** Uma por estado vazio é caro e envelhece. Duas ou três genéricas
   ("nada aqui ainda", "tudo em dia", "não achamos") cobrem quase tudo, e é o que
   a própria Brevo faz: a mesma pessoa deitada na colina aparece em três telas
   diferentes das capturas.
3. **Peso.** A arte de acesso pesa ~40 KB e é pré-carregada só em tela larga. Em
   tela de operação, que é usada em pé e em rede de estúdio, ilustração em toda
   tela vazia precisa do mesmo cuidado, ou o carregamento da agenda paga por
   enfeite.

## Por que isto não é enfeite

Um sistema de agenda vazio é indistinguível de um sistema quebrado. A pessoa que
acabou de entrar não sabe se "nenhum horário nesta semana" quer dizer "você
ainda não montou" ou "não carregou". Ilustração e frase resolvem essa dúvida
antes de a pessoa formular a pergunta, e é por isso que o `<Vazio>` já existe: o
que se discute aqui é subir o acabamento dele, não criar a ideia.

O mesmo vale para o movimento: a tela parada durante três idas ao servidor é a
mesma classe de defeito que o botão que volta a "Entrar" antes de a navegação
terminar. Já custou um item de plano; vai custar de novo em outro lugar.

## Onde olhar quando for fazer

| O quê | Onde |
|---|---|
| O primitivo de estado vazio | `src/components/ui/pecas.tsx`, `<Vazio>` |
| As artes que já existem, e a geometria delas | `src/components/ui/arte-acesso.ts` |
| O registro das artes do onboarding, feito para troca | `src/core/onboarding/boas-vindas.ts` |
| Otimização de imagem | `scripts/otimiza-arte.mjs` |
| Esqueletos de carregamento | `src/components/ui/pecas.tsx`, `<Esqueleto>`, e os `loading.tsx` |
| As capturas da Brevo que originaram isto | conversa de 14/08/2026 |
