# Defeitos apontados olhando o produto

Lista corrida. Cada item entra com o que foi visto, onde, e por que é defeito e
não gosto. Sai daqui quando estiver corrigido, com o commit citado.

## 1. A barra fixa da Sessão repete o que já está no topo

**Apontado em 14/08/2026, com captura.** Na tela `/sessao/[id]`, com a chamada
pendente, aparecem **duas vezes** as mesmas duas ações:

| Onde | O que tem |
|---|---|
| cabeçalho da sessão | "Marcar todos presentes" e "Encaixar aluno" |
| barra fixa no rodapé | "Marcar todos presentes" e "Encaixar" |

A barra de baixo também repete o estado que já está no cabeçalho ("Chamada
pendente", "0 de 2 registrados"), que por sua vez já está no cartão "Resumo da
chamada", à direita. São **três** lugares dizendo a mesma coisa na mesma tela.

**Por que é defeito, e não excesso de zelo:** duas cópias do mesmo botão
destrutivo-ish na mesma tela criam a dúvida de se são a mesma ação. "Marcar
todos presentes" escreve presença em todo mundo de uma vez; se a pessoa clicar
em cima, não vir mudança na dobra em que está, e clicar embaixo, ela não sabe
se marcou uma ou duas vezes. E numa tela usada em pé, com o polegar, a barra
fixa cobre a última linha da lista.

**A que sai é a de baixo.** O Gabriel apontou a barra fixa do rodapé, não o
cabeçalho: o cabeçalho é onde a ação nasce, junto do horário, da ocupação e do
estado da chamada, e é o que o protótipo desenha.

**O que investigar antes de simplesmente apagar:** a barra fixa
provavelmente existe para a tela de celular, onde o cabeçalho sai de vista assim
que a lista rola, e aí ela é a única ação alcançável. Se for isso, o conserto é
ela existir **só** em tela estreita, ou só depois que o cabeçalho sair da
viewport, e não nas duas ao mesmo tempo em 1440px. Conferir contra o protótipo
antes de decidir: `Design system Verandi-att/Verandi.dc.html`, tela `sessao`, e a
captura de `scripts/tira-prototipo.mjs`.

Arquivos: `src/app/(app)/sessao/[id]/`, `src/components/sessao/`.

**Feito.** A barra ganhou `md:hidden`, em `src/components/sessao/chamada.tsx`.

O que a investigação achou: **o protótipo desenha as duas ao mesmo tempo**
(`Verandi.dc.html`, tela `sessao`, cabeçalho na linha 497 e barra na 604), então
a tela estava fiel e o defeito é do protótipo. Fica sendo a **quarta divergência
de propósito** do produto, e o motivo é o que o Gabriel apontou: em 1440 as duas
aparecem na mesma dobra.

Medido, não achado: em 1440×1000 a tela tem **um** "Marcar todos presentes"; em
420×900, **dois**, e o de baixo é o único alcançável depois que a lista rola.
