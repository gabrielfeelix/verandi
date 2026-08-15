# Verandi, design system

A fonte de verdade é **`Design system Verandi-att/DESIGN-SYSTEM.md`**. Ele
descreve o sistema inteiro, cor, tipografia, espaço, os treze componentes,
layout, motion, ícones e voz, em detalhe suficiente para construir uma tela
nova sem abrir o protótipo. Onde a tela do produto divergir dele, é a tela que
muda.

`Design system Verandi/` (o protótipo antigo) fica como **consulta**, para o caso
que o novo não previu: um estado de erro específico, uma tela que ninguém
desenhou de novo. Não é para onde se olha primeiro.

Este arquivo é a ponte entre os dois e o código: como os valores de lá viraram
token daqui, e o que **de propósito** não veio do protótipo.

## O que não vem do protótipo

Duas coisas dele são de demonstração e **não entram no produto**:

- **`user-select: none` e `caret-color: transparent` no `body`.** Servem para uma
  demo não parecer editável. No produto quebram copiar telefone, copiar nome e
  leitor de tela.
- **Fontes por `<link>` do Google.** No produto entram por `next/font`, que
  hospeda junto e não deixa a primeira pintura esperando um terceiro.

## Cor

Nomes por função, nunca por matiz, `--cor-tinta`, não `--cor-verde-escuro`. Cor
com nome de cor é cor que ninguém troca depois.

### Base

| Papel | Valor |
|---|---|
| Fundo da aplicação | `#EEF1EF` |
| Superfície (cartão, campo) | `#FFFFFF` |
| Superfície suave (linha alternada, painel) | `#F6F8F7` |
| Superfície mais suave | `#F1F5F3` |
| Tinta forte (título, número) | `#141A18` |
| Tinta média (texto de apoio) | `#5D6B66` |
| Tinta fraca (rótulo, meta) | `#656E6A` (o `#8B9691` do protótipo reprova em contraste) |
| Tinta sobre escuro | `#EAF3F0` |
| Linha | `#DFE5E2` |
| Linha suave | `#E7ECEA` |

### Marca

| Papel | Valor |
|---|---|
| Marca | `#0E7C6B` |
| Marca ao passar o mouse | `#0A5E51` |
| Escuro (botão primário, trilho, tooltip) | `#12211C` |
| Menta (destaque sobre escuro, foco, halo) | `#2AC3A3` |

### Tintas com significado

Cada par é fundo + texto. **A cor nunca é o único portador do significado** ,
sempre acompanha texto ou glifo.

Os três primeiros textos são um pouco mais escuros que os do protótipo, e o
motivo é contraste: no par original a etiqueta dava 4,42:1, 4,13:1 e 3,93:1
sobre o próprio fundo dela, abaixo do mínimo de 4,5:1. É onde se lê "presente",
"falta" e "reposição". Há teste medindo cada par em `tests/unit/contraste.test.ts`.

| Significado | Fundo | Texto |
|---|---|---|
| Positivo · presente · recorrente | `#DCEDE7` | `#0E7968` |
| Atenção · falta avisada · reposição | `#F6E7C9` | `#806320` |
| Alerta · falta · lotado · pendente | `#FBE4D9` | `#B24826` |
| Informação · avulso | `#E4E9F5` | `#42507A` |
| Licença | `#E9E6F3` | `#5B4C7C` |
| Neutro · reserva · cancelada | `#EDF1EF` | `#656E6A` |

### Onde cada uma aparece no domínio

```
origem da participação   recorrente=positivo · avulso=informação
                         reposição=atenção · encaixe=alerta · reserva=neutro
estado da chamada        feita=positivo · pendente=alerta · cancelada=neutro
status na chamada        presente ✓ positivo · falta × alerta
                         avisada ! atenção · licença ~ licença
ocupação                 dentro da capacidade=neutro · cheia ou acima=alerta
```

**Profissional tem cor própria**, escolhida na configuração, e ela é o que
identifica a pessoa na grade: `#0E7C6B` verde, `#F0693C` laranja, `#4A5C8C` azul,
`#5B4C7C` violeta.

**Avatar** usa um dos seis pares por hash do nome, com as iniciais. Determinístico:
a mesma pessoa tem sempre a mesma cor, em qualquer tela.

## Tipografia

| Uso | Fonte |
|---|---|
| Título e número grande | **Bricolage Grotesque** 500/600/700 |
| Texto, rótulo, botão | **DM Sans** 400/500/600 |
| Hora, contagem, identificador | **DM Mono** 400/500 |

Escala real do protótipo, que é miúda de propósito, é uma tela de trabalho, e a
densidade é o ponto:

```
30px   título de tela            Bricolage 600, letter-spacing -.02em
19px   título de bloco           Bricolage 600
17px   título de cartão          Bricolage 500
14px   texto forte
13px   texto padrão              DM Sans 400
12.5px texto de apoio
11.5px meta, etiqueta
10.5px rótulo maiúsculo          letter-spacing .1em, DM Sans 500
```

## Forma

| Token | Valor |
|---|---|
| Raio pequeno (etiqueta, botão miúdo) | `9px` |
| Raio padrão (botão, campo, cartão pequeno) | `11px` |
| Raio de cartão | `20px` |
| Pílula | `999px` |
| Sombra de elevação | `0 18px 34px -20px rgba(20,26,24,.45)` |
| Sombra de modal | `0 30px 60px -30px rgba(18,33,28,.6)` |
| Anel de foco | `inset 0 0 0 1.5px` na cor de marca |

Espaçamento em passos de 1px entre 4 e 20 no protótipo; no produto arredondamos
para **4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24**. Diferença de 1px em `gap` não
carrega significado, e uma escala fechada evita a próxima tela inventar 13px.

## Movimento

Entrada de tela `eTela`, de linha `eRow`, de modal `ePop`, 12px de deslocamento,
opacidade de 0 a 1. Escalonamento de 34ms por linha em lista. Transições de
interface em 80ms.

`@media (prefers-reduced-motion: reduce)` zera tudo. Isso não é opcional.

## Primitivos

Nove peças burras, sem regra de negócio dentro. Componente que decide algo do
domínio não é primitivo.

| Peça | Variações |
|---|---|
| `Botao` | primário (escuro), secundário (branco com linha), perigo, texto |
| `Cartao` | com e sem cabeçalho |
| `Chip` | seletor (ativo escuro / inativo branco), único ou múltiplo, com ponto de cor |
| `Etiqueta` | as seis tintas com significado, só leitura |
| `Campo` | texto, hora, data, número com `−`/`+`, alternador |
| `Modal` | ícone com tinta, título, subtítulo, campos, nota, primário e secundário |
| `Desfazer` | barra escura, 6 segundos, com ação |
| `Avatar` | iniciais ou foto, tamanhos 24/32/40, anel opcional |
| `Nota` | verde, âmbar, vermelho, neutro |
| `Esqueleto` | bloco, linha, célula de grade |

## As três regras que o protótipo aplica sem dizer

**1. Toda ação destrutiva mostra o que vai acontecer, em lista nominal.**
Encerrar série lista as quatro pessoas com nome e desde quando; desativar
profissional lista o que acontece com sessões passadas, séries futuras e login.
Número sozinho ("4 pessoas") não dá para conferir; lista dá.

**2. Toda nota explica a consequência, não a mecânica.** "As sessões que já
aconteceram continuam no histórico. As futuras deixam de ser criadas", não
"vigência recebe data de fim". O usuário não tem o modelo de dados na cabeça, e
não deveria precisar.

**3. Vazio explica que não é erro.** "O estúdio não abre neste dia, está na
configuração de funcionamento, **não é falha de carregamento**". Todo estado
vazio diz o que fazer em seguida, e quando for consequência de configuração, diz
qual.

## Acessibilidade

O protótipo é bonito e falha em três coisas que o produto não pode falhar:

- **Contraste, resolvido.** `#8B9691` sobre `#FFFFFF` dá 3,06:1, abaixo do
  mínimo de 4,5:1. A regra antiga era "tinta fraca só em 14px ou maior", e ela
  não salvava nada: a isenção de texto grande da WCAG começa em 24px, não em
  14. **Tinta fraca virou `#656E6A`** e passa a 4,78:1 sobre `#F1F5F3`, que é a
  superfície mais clara que ainda recebe texto pequeno. `tinta-apagada` foi
  junto, e as duas passaram a valer o mesmo tom: qualquer par que passasse
  teria diferença de 2% de luminosidade. A etiqueta neutra e o texto fraco do
  e-mail seguiram a mesma correção.
- **Alvo de toque.** Botões de 24px de altura na tela de Sessão, que é usada em
  pé, com a mão ocupada. Mínimo de 44px nos controles de presença.
- **Foco visível.** O protótipo não desenha foco de teclado. Anel de menta em
  tudo que recebe foco.
