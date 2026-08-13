# Verandi — Design System

Sistema de gestão para estúdios (pilates, clínicas, salões). Desktop-first com
modo celular real abaixo de 760px. Este documento é a fonte de verdade: um agente
deve conseguir construir uma tela nova só com ele, sem abrir o app.

Princípios:

1. **Cor é informação, não decoração.** Fundo é neutro; cor só aparece em estado,
   pessoa, professor e no que exige ação.
2. **Tudo que parece clicável tem destino.** Nenhum botão decorativo.
3. **Nada bloqueia o trabalho.** Turma lotada mostra `5/4` em laranja e permite o
   encaixe. Avisar > impedir.
4. **Ação destrutiva é reversível.** Toast com "Desfazer" por 6 s.
5. **Modal rola por dentro.** A página nunca rola atrás de um modal.

---

## 1. Cor

### Neutros (estrutura)

| Token | Hex | Uso |
|---|---|---|
| `bg/app` | `#EEF1EF` | Fundo da aplicação |
| `bg/surface` | `#FFFFFF` | Cards, painéis, modais |
| `bg/sunken` | `#F6F8F7` | Campo preenchido, item de lista, seção interna |
| `bg/hover` | `#F1F5F3` | Hover de linha e botão neutro |
| `bg/tint` | `#FBFCFB` | Hover sutil em linha de tabela |
| `border/default` | `#DFE5E2` | Borda de card e input |
| `border/soft` | `#E7ECEA` | Borda de item dentro de card |
| `border/hairline` | `#EFF3F1` / `#F4F7F5` | Divisória entre linhas |
| `border/dashed` | `#C6D2CD` | Placeholder, "adicionar", zona vazia |

### Texto

| Token | Hex | Uso |
|---|---|---|
| `text/primary` | `#141A18` | Título, valor, nome |
| `text/secondary` | `#5D6B66` | Rótulo, apoio |
| `text/muted` | `#7B8681` | Metadado, subtítulo |
| `text/faint` | `#8B9691` | Eyebrow, contagem, hint |
| `text/disabled` | `#9AA5A0` / `#C6D2CD` | Inativo, seta desabilitada |

### Marca e escuro

| Token | Hex | Uso |
|---|---|---|
| `brand/ink` | `#12211C` | Rail, botão primário, hero, toast |
| `brand/ink-hover` | `#1D332B` | Hover do botão primário |
| `brand/ink-2` | `#173029` / `#1B3A31` | Fim do gradiente do hero |
| `brand/mint` | `#2AC3A3` | Acento no escuro: logo, "próxima turma", CTA no hero |
| `brand/green` | `#0E7C6B` | Acento no claro: link, foco, sucesso |
| `brand/green-hover` | `#0A5E51` | Hover de link |

Gradiente do hero: `linear-gradient(180deg,#12211C,#173029)`.
Gradiente do painel de login: `linear-gradient(165deg,#12211C 0%,#1B3A31 62%,#245045 100%)`.
Halo decorativo: `radial-gradient(circle,rgba(42,195,163,.22),transparent 70%)`.

### Semânticos (sempre em par bg + fg)

| Estado | bg | fg | borda | Quando |
|---|---|---|---|---|
| Sucesso / feito | `#E3F2ED` | `#0E7C6B` | `#CFEBE1` | Chamada feita, presente, em dia |
| Atenção / pendente | `#FDE9E0` | `#C5502A` | `#F7DACB` | Chamada pendente, lotado, vencendo |
| Aviso / intermediário | `#F6E7C9` | `#8A6A22` | `#F2E3D4` | Falta avisada, reposição, expira |
| Neutro / inativo | `#EDF1EF` | `#8B9691` | `#E7ECEA` | Cancelado, desativado, sem plano |
| Informação | `#E4E9F5` | `#42507A` | — | Reserva, papel de usuário |
| Especial | `#E9E6F3` | `#5B4C7C` | — | Tag clínica (gestante, lesão) |

Superfícies de alerta: sucesso `#F3FAF7`, atenção `#FFF6F1`, aviso `#FFFBF7`.
Laranja `#F0693C` é só para **badge de contagem** e legenda "acima da
capacidade" — nunca para texto (baixo contraste). Texto em laranja usa `#C5502A`.

### Cor por profissional

Cada profissional tem uma cor fixa, usada em faixa, bolinha e anel do avatar.

```
Thalya  #0E7C6B    Carol  #F0693C    Nath  #4A5C8C    Juliana  #5B4C7C
```

Paleta de avatar (6 pares, por índice determinístico do nome):

```
["#DCEDE7","#0E7C6B"]  ["#E4E9F5","#42507A"]  ["#FBE4D9","#B4562F"]
["#E9E6F3","#5B4C7C"]  ["#E5EFDC","#4E6B37"]  ["#F6E7C9","#8A6A22"]
```

### Ruído de fundo (assinatura)

Textura leve em toda a área de conteúdo e nos painéis escuros. `pointer-events:none`,
sempre atrás do conteúdo.

```css
opacity: .5;                      /* claro: .5 · escuro: .22 */
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
```

---

## 2. Tipografia

Três famílias, cada uma com um papel exclusivo.

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Família | Papel | Nunca use para |
|---|---|---|
| **Bricolage Grotesque** 600 | Título de tela, título de card, número grande | Corpo, rótulo |
| **DM Sans** 400/500/600 | Todo o resto: corpo, botão, rótulo, chip | Números de horário |
| **DM Mono** 400/500 | Hora, ocupação `3/4`, data, id, token, contagem | Frase |

### Escala

| Papel | Tamanho | Peso | Família | Extra |
|---|---|---|---|---|
| Título de tela | 30px | 600 | Bricolage | `line-height:1.05; letter-spacing:-.02em` |
| Título de tela (mobile) | 22–24px | 600 | Bricolage | |
| Número hero | 40px | 600 | Bricolage | `letter-spacing:-.03em` |
| Número de card | 30px | 600 | Bricolage | `letter-spacing:-.02em` |
| Título de card | 17px | 600 | Bricolage | |
| Título de modal | 20px | 600 | Bricolage | |
| Nome / item de lista | 14–15px | 500 | DM Sans | |
| Corpo | 13–13.5px | 400 | DM Sans | `line-height:1.5` |
| Botão | 13–14.5px | 500/600 | DM Sans | |
| Metadado | 12–12.5px | 400 | DM Sans | cor `#7B8681` |
| Hint / contagem | 11.5px | 400 | DM Sans | cor `#8B9691` |
| **Eyebrow** | 10–11px | 600 | DM Sans | `letter-spacing:.1em; text-transform:uppercase; color:#8B9691` |
| Hora em lista | 15px | 400 | DM Mono | |
| Ocupação / id | 11–12px | 400 | DM Mono | |

Texto longo sempre com `text-wrap:pretty`. Mínimo absoluto: 10px, só em eyebrow e
badge.

---

## 3. Espaço, raio, sombra

**Espaço** — múltiplos de ~4 com meios permitidos onde o ritmo pede:
`4 · 6 · 7 · 8 · 9 · 11 · 12 · 14 · 16 · 18 · 20 · 22 · 26 · 30`

Padding padrão: card `16px 18px`, card grande `20px 22px`, modal `22px 24px`,
linha de lista `12px 13px`, linha de tabela `13px 18px`, chip `7px 12px`.

Gap padrão: entre cards `12–16px`, dentro de card `8–12px`, entre grupos `18px`.

**Sempre flex/grid + `gap`.** Nunca margens entre irmãos nem espaço por whitespace.

**Raio**

| Token | Valor | Uso |
|---|---|---|
| `r/xs` | 5–7px | Badge, mini-chip |
| `r/sm` | 9–10px | Botão pequeño, chip, tag de status |
| `r/md` | 11–12px | Botão, input, item de lista |
| `r/lg` | 13–14px | Botão grande, linha clicável, campo de modal |
| `r/xl` | 15–16px | Card interno, card mobile |
| `r/2xl` | 18–20px | Card de seção, hero |
| `r/3xl` | 22–26px | Modal, cartão de login |
| `r/full` | 999px | Pílula de pessoa, avatar |

**Sombra** — quase nunca. Elevação vem de borda e fundo.

```
card:      nenhuma
hero:      0 14px 30px -20px rgba(18,33,28,.6)
dropdown:  0 18px 34px -20px rgba(20,26,24,.45)
modal:     0 30px 60px -30px rgba(18,33,28,.6)
login:     0 40px 70px -44px rgba(20,26,24,.45)
toast:     0 18px 40px -22px rgba(0,0,0,.6)
botão fixo mobile: 0 16px 30px -18px rgba(18,33,28,.7)
```

---

## 4. Componentes

### 4.1 Botões

| Variante | Estilo | Hover | Active |
|---|---|---|---|
| **Primário** | `bg:#12211C; color:#EAF3F0; border:0; padding:13px 16px; radius:12px; size:14px; weight:600` | `bg:#1D332B` | `translateY(1px)` |
| **Primário no escuro** | `bg:#2AC3A3; color:#08201A` | `bg:#38D6B4` | `translateY(1px)` |
| **Secundário** | `bg:#fff; border:1px solid #DFE5E2; color:#141A18; padding:11px 16px; size:13px; weight:500` | `bg:#F1F5F3` | — |
| **Secundário no escuro** | `bg:transparent; border:1px solid rgba(234,243,240,.22); color:#EAF3F0` | `bg:rgba(234,243,240,.1)` | — |
| **Fantasma** | `bg:transparent; border:0; color:#5D6B66; size:12–13px` | `color:#141A18` | — |
| **Destrutivo** | `bg:#C5502A; color:#fff; weight:600` | `bg:#A8411F` | — |
| **Destrutivo leve** | `bg:transparent; border:0; color:#C5502A; size:12px` | `color:#9C3D1F` | — |
| **Ícone** | `34×34; border:1px solid #E7ECEA; bg:#fff; radius:10px; color:#5D6B66` | `bg:#F1F5F3; color:#141A18` | — |
| **Ícone destrutivo** | idem | `bg:#FFF6F1; border-color:#F0D6C8; color:#C5502A` | — |
| **Tracejado** | `border:1px dashed #C6D2CD; bg:transparent; color:#0E7C6B` | `bg:#F6F8F7` | — |

Regras: `cursor:pointer` sempre. Botão de ação em texto curto recebe
`white-space:nowrap`. Alvo mínimo 34px no desktop, **44px no celular**.
Ícone sozinho exige `title`.

### 4.2 Segmented / tabs

Trilho: `padding:3–4px; bg:#fff; border:1px solid #DFE5E2; radius:12–14px; gap:3px`.

| Estado | Estilo |
|---|---|
| Ativo | `bg:#12211C; color:#EAF3F0; weight:500/600; radius:10–11px` |
| Inativo | `bg:transparent; color:#5D6B66; weight:400` |
| Hover inativo | `bg:#F1F5F3` |
| Hover ativo | **mantém `#12211C`** — jamais clarear o ativo no hover |

Tab pode ter contagem: ativo `bg:rgba(234,243,240,.16); color:#EAF3F0`,
inativo `bg:#F1F5F3; color:#5D6B66`, em DM Mono 11px.

### 4.3 Chip / tag de status

```
padding: 5px 10px · radius: 9px · size: 11.5px · weight: 500
```

Com ponto: `<span>` de 6px, `border-radius:50%`, cor = `fg` do estado.
Chip filtro selecionável usa o par claro do estado; chip de contagem em DM Mono.

Chip de ocupação (`3/4`): DM Mono 12px, `padding:3px 8px`, `radius:6–8px`.
Normal `bg:#F1F5F3; color:#5D6B66`. Acima da capacidade `bg:#FDE9E0; color:#C5502A`.

### 4.4 Avatar

Sempre foto quando existir; sem foto, **iniciais** (primeira letra do primeiro e
do último nome) com o par de cores derivado do nome. Nunca um círculo vazio.

| Tamanho | Uso | Fonte |
|---|---|---|
| 24px | Pílula de pessoa | 10px/600 |
| 26–27px | Empilhado em lista (`margin-right:-9px; border:2px solid #fff`) | 10px/600 |
| 30–34px | Item de lista | 11–12px/600 |
| 38–40px | Linha de chamada, cabeçalho | 12–12.5px/600 |
| 56–64px | Ficha, modal de foto | 16–18px/600 |

Avatar de profissional leva a cor dele como anel:
`box-shadow: inset 0 0 0 1.5px <cor>` (2px em tamanhos ≥38px).

Badge de status no avatar: 17px no canto inferior direito,
`border:2px solid #fff`, fundo = `fg` do estado, glifo branco 9px/700.

### 4.5 Card

```
bg:#fff · border:1px solid #DFE5E2 · radius:20px · padding:16px 18px
```

Cabeçalho: título Bricolage 17px/600 + ação à direita (link 12px ou botão de ícone).
Card de métrica: eyebrow 12px + glifo 22px à direita, valor Bricolage 30px,
apoio 12px. Card colorido usa `bg` e `borda` do estado.

Card de aviso: `border:1px dashed #C6D2CD; bg:#F6F8F7; size:12.5px; line-height:1.55`.

### 4.6 Linha de lista

```
display:grid · align-items:center · gap:14px · padding:12–13px · radius:14px
hover: bg:#F1F5F3   ·   active: transform:translateX(2px)
```

Grade de referência da agenda: `66px 14px 1fr auto auto`
(hora · faixa do professor · texto · pessoas + ocupação · status).

Faixa do professor: `width:3px; border-radius:2px`, cor do professor,
`opacity:.45` quando a sessão já passou, `.25` quando cancelada.

Sessão cancelada: `text-decoration:line-through` na hora e no título,
avatares em `opacity:.4`.

### 4.7 Modal

**Regra absoluta: o modal rola por dentro; a página nunca rola atrás dele.**

```
overlay: position:fixed; inset:0; background:rgba(18,33,28,.42);
         backdrop-filter:blur(3px); display:flex; align-items:center;
         justify-content:center; padding:28px; overflow:hidden; z-index:50
card:    display:flex; flex-direction:column; max-height:calc(100vh - 56px);
         border-radius:22px; background:#fff; overflow:hidden
cabeçalho: flex:0 0 auto; padding:22px 24px 16px
corpo:     flex:1 1 auto; overflow-y:auto; min-height:0; padding:0 24px 4px
rodapé:    flex:0 0 auto; border-top:1px solid #F1F5F3; background:#fff;
           padding:16px 24px 20px
```

Larguras: 452px (confirmação) · 520px (formulário) · 588px (com listas).
Fecha ao clicar fora; o card chama `stopPropagation` no clique.
Rodapé: secundário à esquerda (`flex:1`), primário à direita.
Modal destrutivo: glifo `!` em `#FBE4D9/#C5502A` e botão destrutivo.

Um modal de confirmação sempre diz **o que vai acontecer com os dados
existentes** — quantas sessões, quantas pessoas avisadas, o que fica no histórico.

### 4.8 Dropdown (kebab)

Ações que não são "foi ou não foi" moram num menu de três pontinhos.

```
gatilho: 32×34, borda 0, hover bg:#F1F5F3
menu:    position:absolute; right:0; top:38px; width:212–216px; padding:6px;
         radius:15px; bg:#fff; border:1px solid #E3E9E6;
         box-shadow:0 18px 34px -20px rgba(20,26,24,.45); z-index:25
item:    padding:9px 11px; radius:10px; size:13px; hover bg:#F6F8F7
```

Item destrutivo em `#C5502A`, sempre por último. Só um menu aberto por vez.

### 4.9 Campo de formulário

```
rótulo:      eyebrow 10.5px/600, uppercase, #8B9691, margin-bottom:6px
input:       padding:14px 15px; radius:13px; size:14px
  vazio:     bg:#fff; border:1px solid #DFE5E2
  preenchido: bg:#F6F8F7; border:1px solid #E7ECEA; color:#414A47
  foco:      bg:#fff; border:1px solid #0E7C6B
  erro:      border:1px solid #C5502A + mensagem 12.5px #8A4526
hint:        12px #8B9691, abaixo do campo
```

Input real usa `<input>` com `placeholder` — nunca texto simulado num `<div>`.
Escolha entre 2–5 opções curtas: chips selecionáveis, não `<select>`.

### 4.10 Toast

```
position:fixed; left:50%; bottom:26px; transform:translateX(-50%)
bg:#12211C; color:#EAF3F0; padding:13px 16px; radius:14px; gap:16px
ponto:#2AC3A3 (6–8px) + texto 13.5px + botão "Desfazer"
desfazer: border:1px solid rgba(234,243,240,.24); bg:transparent;
          color:#EAF3F0; size:12px/600; padding:7px 13px; radius:9px
```

Duração 6 s. **Toda ação destrutiva ou em lote gera toast com Desfazer.**
Texto diz o que aconteceu e o efeito: "4 presenças registradas · Pilates Solo 09:00".

### 4.11 Skeleton

```css
.sk { border-radius:9px;
      background:linear-gradient(90deg,#E4EAE7 25%,#F1F5F3 37%,#E4EAE7 63%);
      background-size:400% 100%; animation:sk 1.5s ease-in-out infinite; }
@keyframes sk { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
```

Cada tela tem o **seu** skeleton, com a forma do conteúdo real (cards, hero,
tabela, grade, ficha, painel). Nunca um spinner genérico. No escuro, `opacity:.25–.5`.
Primeiro carregamento ~900 ms; troca de tela ~620 ms.

### 4.12 Estado vazio

Ícone 40px em `bg:#F1F5F3`, título Bricolage 16px, explicação 12.5px e **uma**
ação. Dia sem aula é informação, não erro: "nada marcado", não "falha ao carregar".

### 4.13 Paginação

```
rodapé da lista: "1–5 de 9" à esquerda (12px #8B9691),
"página 1 de 2" + setas ‹ › à direita
setas: border:1px solid #DFE5E2; radius:11px; padding:8px 13px; DM Mono 13px
       desabilitada: color:#C6D2CD
```

Qualquer lista que passe de ~20 itens é paginada.

---

## 5. Layout

### Desktop (> 760px)

```
[ rail 74px ] [ conteúdo flex:1, padding:20px 24px 56px, gap:18px ]
```

Rail: `bg:#12211C`, `position:sticky; top:0; height:100vh`, expansível para 212px
(padrão retraído). Item: 46px de altura, `radius:14px`, ícone SVG 20px + rótulo
8–13px. Ativo `bg:rgba(42,195,163,.16); color:#2AC3A3`; inativo `color:#8FA8A0`;
hover `bg:rgba(255,255,255,.09)`; active `scale(.96)`. Badge de contagem em
`#F0693C`. **Não animar `width`** do rail — trava com re-render frequente.

Grade de conteúdo: `minmax(0,1fr) 300–320px` (principal + painel de apoio).
Métricas: `repeat(4,1fr)`. Painel lateral existe para carregar o que a aba atual
esconde — nunca para repetir o que já está à esquerda.

### Celular (≤ 760px, via `matchMedia`)

Rail sai; entra barra inferior fixa com 4 abas:
`position:fixed; bottom:0; bg:#fff; border-top:1px solid #DFE5E2; z-index:45`,
item de 50px, ícone 20px + rótulo 10px, ativo `#0E7C6B` sobre `#F3FAF7`.
Conteúdo com `padding:16px 14px 96px`. Grade de 7 dias vira **um dia por vez**
com seletor rolável. Todo alvo ≥ 44px; ações principais 48–54px.

---

## 6. Motion

```
padrão:    .15s ease            (cor, fundo, borda)
entrada:   .18–.2s ease
espacial:  .2–.34s cubic-bezier(.32,.72,0,1)
overshoot: .34s cubic-bezier(.22,1.2,.36,1)   (toast)
pop:       .26s cubic-bezier(.32,1.2,.42,1)   (modal)
```

```css
@keyframes eFade  { from{opacity:0;transform:translateY(10px) scale(.995)} to{opacity:1;transform:none} }
@keyframes eRise  { 0%{opacity:0;transform:translateY(12px)} 62%{opacity:1;transform:translateY(-3px)} 100%{opacity:1;transform:none} }
@keyframes ePop   { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:none} }
@keyframes eHalo  { 0%,100%{box-shadow:0 0 0 0 rgba(14,124,107,.22)} 50%{box-shadow:0 0 0 7px rgba(14,124,107,0)} }
```

Aplicações: troca de tela `eFade`; modal `ePop`; toast `eRise` com overshoot;
"próxima turma" com `eHalo` infinito; ação em lote em **cascata de 80 ms** por
item; item removido **colapsa a altura** (`max-height` + `opacity` + `padding`,
.3s) e o contador do grupo desce junto.

Nunca animar `width`/`flex-basis` de container de layout que re-renderiza.

---

## 7. Ícones

SVG de traço, `viewBox="0 0 20 20"`, `stroke:currentColor`, `stroke-width:1.6`,
`stroke-linecap:round`, `stroke-linejoin:round`, `fill:none`. Sem biblioteca
externa, sem emoji.

Vocabulário: `check` (presente) · `x` (falta / remover) · `aviso` triângulo
(falta avisada) · `licenca` círculo cortado · `kebab` três pontos · `hoje` ·
`semana` · `pessoas` · `pendencias` · `vaga` · `grade` · `config`.

Glifos monoespaçados são aceitos em contexto decorativo pequeno
(`‹ › ⋯ ✎ ⧉ ⌫ ↺ ⌕ ◷ ⚿`), nunca como ícone principal de ação.

---

## 8. Padrões de domínio

**Ocupação** — sempre `usadas/capacidade`. Acima da capacidade não é erro:
mostra em laranja e libera o encaixe.

**Status de participação** — quatro, sempre com ícone + cor:

| Status | Ícone | Cor | Fundo ativo |
|---|---|---|---|
| Presente | check | `#0E7C6B` | `#DCEDE7` |
| Falta | x | `#C5502A` | `#FBE4D9` |
| Falta avisada | triângulo | `#8A6A22` | `#F6E7C9` |
| Licença | círculo cortado | `#5B4C7C` | `#E9E6F3` |

**Origem da participação** — badge 10px uppercase:
Vaga fixa `#DCEDE7/#0E7C6B` · Avulso `#F1F5F3/#5D6B66` ·
Reposição `#F6E7C9/#8A6A22` · Encaixe `#FBE4D9/#B4562F` · Reserva `#E4E9F5/#42507A`.

**Duas turmas no mesmo horário** — a célula da grade se divide em duas
mini-turmas, cada uma com a cor do seu professor, e recebe a marca "2 salas".
O hover é da mini-turma (fundo branco + borda na cor do professor + `translateY(-1px)`),
não do bloco — o alvo do clique tem de ser óbvio.

**Vocabulário configurável** — Aluno/Cliente/Paciente é ajustável e muda o texto
de todas as telas. Nunca escreva o termo direto no código; leia do vocabulário.

---

## 9. Voz

Português do Brasil, direto, sem jargão e sem entusiasmo artificial.

- Botão diz o que faz: "Marcar todos presentes", não "Confirmar".
- Explique consequência, não mecanismo: "quem tem vaga fixa recebe o aviso e
  ganha crédito de reposição".
- Nada de emoji. Nada de "Ops!". Nada de "Sucesso!".
- Contagem antes do rótulo em pendência: `2 chamadas não feitas`.
- Aviso de segurança é honesto: "Não dizemos se o e-mail está cadastrado — isso
  evita descobrir quem trabalha no estúdio."

---

## 10. Checklist de tela nova

- [ ] Todo botão tem destino, modal ou toast — nenhum decorativo
- [ ] Ação destrutiva tem confirmação que diz o efeito nos dados
- [ ] Ação em lote gera toast com Desfazer
- [ ] Modal rola por dentro, com cabeçalho e rodapé fixos
- [ ] Skeleton próprio, com a forma do conteúdo
- [ ] Estado vazio com explicação e uma ação
- [ ] Lista longa paginada
- [ ] Hover **e** active em tudo clicável; hover no alvo real, não no container
- [ ] Avatar com iniciais quando não há foto
- [ ] Cor de estado sempre em par bg + fg da tabela
- [ ] Alvos ≥ 44px no celular; grade de 7 dias vira um dia por vez
- [ ] Números da tela vêm dos dados, não escritos à mão
- [ ] Termos vêm do vocabulário configurável
- [ ] Layout em flex/grid com `gap`
