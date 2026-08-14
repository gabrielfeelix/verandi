# Três acertos de interface, apontados pelo Gabriel

Anotados em 14/08/2026 olhando o produto no ar. Nenhum foi feito. São pequenos
e concretos, e o terceiro é maior do que parece.

## 1. O trilho tem que abrir aberto

Hoje ele nasce fechado. E o código se contradiz: o comentário em
`src/components/ui/rail.tsx` diz "O servidor sempre responde aberto", mas a
terceira função do `useSyncExternalStore` é `() => false`, que é fechado. Um dos
dois está errado desde que foi escrito.

O certo é o comentário: **aberto por padrão**, e o `localStorage` corrige na
hidratação para quem já escolheu fechar. Quem entra pela primeira vez precisa
ver os nomes das seções, não sete ícones sem legenda.

Ao arrumar, confira também o que `lerRail` devolve quando não há nada gravado:
a preferência é do dispositivo, e ausência de preferência tem que cair em
aberto, não em fechado.

## 2. O login demora, e a tela não diz nada

`entrar` faz `signInWithPassword` e redireciona para `/`. A raiz então lê a
conta ativa e redireciona de novo, para o destino do papel. **São três idas ao
servidor para uma ação só**, e o botão volta ao normal antes de a navegação
terminar: a pessoa fica olhando uma tela parada achando que não funcionou.

Duas frentes, e vale fazer as duas:

- **Encurtar.** A ação já sabe quem entrou; ela pode resolver o destino ali e
  redirecionar direto, cortando um salto inteiro. O `destinoDoPapel` já existe
  em `core/acesso/destino.ts`.
- **Mostrar.** O `pendente` do `useActionState` volta a `false` quando a ação
  termina, e a navegação continua depois disso. O estado de carregando precisa
  sobreviver até a próxima tela pintar, nem que seja o botão continuar
  desabilitado e escrito "Entrando".

Mentir para a pessoa é pior que demorar: uma tela parada sem sinal nenhum faz
ela clicar de novo, e clicar de novo em login é como se cria o problema de
sessão duplicada.

## 3. Os modais do sistema não seguem o protótipo

Este é o maior dos três, e não é só a Grade.

O `DESIGN-SYSTEM.md` tem a seção **4.7 Modal**, com regra absoluta escrita:
**o modal rola por dentro, a página nunca rola atrás dele**. Tem também raio
(`r/3xl`, 22 a 26px), sombra (`0 30px 60px -30px rgba(18,33,28,.6)`), padding
(`22px 24px`), título em 20px Bricolage 600, animação `pop` de .26s, e a regra
do modal destrutivo (glifo `!` em `#FBE4D9/#C5502A`, botão destrutivo, e o
texto dizendo **o que acontece com os dados**).

O primitivo existe em `src/components/ui/modal.tsx` e é usado em cinco lugares
(pendências, encaixe, cancelar, contas 4YU, ficha). **Mas há formulário
embutido onde o protótipo desenha modal:**

| Onde | O que está lá hoje |
|---|---|
| `grade/editor-serie.tsx` | `<form>` solto na página, sem modal nenhum |
| `config/catalogo.tsx` | `FaixaFormulario` (faixa embutida) |
| `config/equipe.tsx` | `FaixaFormulario` |
| `config/usuarios.tsx` | `FaixaFormulario` |

**O trabalho não é "trocar por modal em toda parte."** É abrir o protótipo,
tela por tela, e ver onde ele usa modal e onde usa faixa embutida, porque ele
usa os dois de propósito. `Design system Verandi-att/Verandi.dc.html` tem a
marcação literal: `grep -n` pelo título da seção leva direto ao trecho.

Onde for modal, tem que sair do primitivo, não de um `<div>` novo. Onde já é
modal, conferir contra a 4.7: rolagem por dentro, raio, sombra, padding,
tamanho do título, e a frase do destrutivo.

Vale medir com `getComputedStyle` no navegador antes de dizer que ficou pronto.
`tsc` e teste não veem CSS, e foi assim que o app rodou sem canto arredondado
nenhum sem ninguém notar (a armadilha do `rounded-[--radius-x]`, no plano 04).

## Como conferir, para não repetir o erro que originou o VESTIR.md

Ler o código do protótipo não substitui abrir a tela dele.

```bash
npx supabase start && node scripts/semear-dev.mjs
npm run dev
node scripts/tira-prototipo.mjs .prototipo
node scripts/tira-produto.mjs .produto
```

Compare em 1440×1000, lado a lado. O método completo está em
[`../VESTIR.md`](../VESTIR.md).
