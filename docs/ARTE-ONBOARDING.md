# Prompts das ilustrações do onboarding

Para gerar no ChatGPT (ou qualquer gerador de imagem) e substituir a arte
provisória. Hoje os cartões usam as quatro ilustrações das telas de acesso, que
são bonitas mas foram desenhadas para outro momento.

## Antes de gerar, três coisas

**O estilo tem de bater com o que já existe.** As artes de `public/acesso/` são
render 3D, personagens estilizados de proporção realista, roupa em tom cru e
areia, objetos em verde menta e verde escuro, luz suave vinda de cima, sem
contorno preto, fundo transparente. Se a arte nova chegar em outro estilo, o
produto passa a ter dois, e fica pior do que estava.

**Fundo transparente, sempre.** A arte é colada sobre o painel verde escuro do
cartão. Fundo branco vira um retângulo branco no meio do verde.

**Onde entra depois de pronta:**

1. salve em `public/onboarding/` (não em `public/acesso/`, que é de outro
   momento do produto);
2. rode `node scripts/otimiza-arte.mjs`, que gera o webp no tamanho final;
3. troque `arquivo` e `descricao` no registro de
   [`src/core/onboarding/boas-vindas.ts`](../src/core/onboarding/boas-vindas.ts).
   Nenhuma tela lê nome de arquivo, então isso é a mudança inteira.

A `descricao` não é enfeite: é o que o leitor de tela fala. Ela muda junto com a
arte, sempre.

---

## O prefixo de estilo

Cole isto **antes** de cada prompt abaixo:

> 3D rendered illustration, soft clay-like materials, stylized human characters
> with realistic proportions and simplified facial features, warm cream and sand
> colored clothing, props in mint green (#2AC3A3) and deep forest green
> (#12211C), soft diffused lighting from above, gentle contact shadows, no black
> outlines, no text anywhere in the image, transparent background, centered
> composition with generous empty space around the subject, wide 4:3 framing,
> subjects standing on an invisible ground plane.

E **depois** de cada prompt:

> Do not include any letters, numbers, words or UI text. Transparent background.

---

## 1. A semana inteira em uma tela

> Two people standing side by side in front of a large wall planner covered with
> small colored cards arranged in a weekly grid. One of them is reaching up to
> move a card; the other watches with arms relaxed. The grid cards are mint
> green, sand and soft amber. The mood is calm and organized, like two colleagues
> finishing the schedule of the week together.

Descrição para o `alt`: `Duas pessoas organizando cartões num quadro de horários
da semana`

## 2. A chamada é o coração

> One person standing beside a floating oversized checklist panel, tapping a
> large check mark with one finger. Three simplified avatar circles sit on the
> list, one already marked with a check, one with a small dash, one still empty.
> The person looks focused and unhurried, as if this takes two seconds.

Descrição: `Pessoa marcando presença numa lista com três nomes`

## 3. Falta avisada vira crédito

> A person handing a glowing mint green token or coin to another person, who
> receives it with both hands. Between them floats a small calendar page with one
> day gently lifted and moved to a later position, suggesting a rescheduled
> appointment. Warm, generous mood, not transactional.

Descrição: `Uma pessoa entregando um crédito de reposição para outra, com um
calendário ao lado`

## 4a. O sistema fala como você fala — cartão do dono

> A person standing next to three floating word tags of different shapes, gently
> swapping one tag for another with one hand. The tags are blank rounded
> rectangles in mint green, sand and white, with no letters on them. The gesture
> is deliberate and light, like choosing a label for a shelf.

Descrição: `Pessoa trocando etiquetas de palavras por outras`

## 4b. Nada do que você registra se perde — cartão de quem opera

> A person closing the drawer of a warm wooden filing cabinet with a satisfied,
> calm expression. A soft mint green shield glow rests over the cabinet. One
> folder is slightly visible inside, neatly filed. The mood is reassurance, not
> security-alarm.

Descrição: `Pessoa guardando uma pasta num arquivo, com um escudo de proteção ao
lado`

---

## Se sobrar fôlego, as dos estados vazios

Não são do onboarding, são do [plano 08](planos/08-vida-nas-telas.md), mas a
sessão de geração é a mesma e o estilo tem de ser o mesmo. Três cobrem quase
todas as telas do produto:

**Nada aqui ainda**

> A person standing beside an empty shelf or empty wall planner, hands on hips,
> looking at it with a small hopeful smile, as if about to fill it. Not sad, not
> confused: the emptiness is the beginning of something.

**Tudo em dia**

> A person leaning back comfortably with both arms behind the head, next to a
> completed checklist floating at shoulder height with every item checked in mint
> green. Relaxed, end-of-shift mood.

**Não achamos**

> A person holding a large magnifying glass at chest height, looking slightly to
> the side with a curious, unbothered expression. Two or three small shapes float
> around, none of them matching. Light and unalarming.
