# Onboarding: ensinar o sistema sem manual

Escrito em 14/08/2026, depois de a Verandi entrar no ar. É o próximo trabalho
de produto, e ainda **não começou**. Leia o [ESTADO.md](../ESTADO.md) antes.

## O problema, em uma frase

A dona do estúdio entra pela primeira vez numa conta vazia e não sabe por onde
começar, nem o que o sistema faz. Hoje ela vê uma agenda sem nada e some.

Isso é diferente de "faltam telas". As doze telas existem e estão vestidas. O
que falta é **a primeira meia hora**.

## As duas peças, e elas são separadas

### 1. As boas-vindas: o que é isto

Uma sequência curta, na primeira entrada, dizendo o que a Verandi faz e o que
ela vai poder fazer. É a mesma régua do e-mail de convite: quem chega **não
conhece o produto**, e um sistema que abre direto numa grade vazia não se
explica.

O Gabriel gera as ilustrações e coloca, como fez nas telas de acesso. O lugar
delas é `public/acesso/` (webp, otimizado por `scripts/otimiza-arte.mjs`), e o
registro é `src/components/ui/arte-acesso.ts`, que já guarda título, texto,
arquivo, largura e deslocamento de cada arte. **Siga esse arquivo**: ele existe
justamente para a arte e o texto não ficarem espalhados por dentro das telas.

### 2. Os apontamentos: onde fica cada coisa

Balões pequenos apontando um componente de cada vez, com o fundo apagado, e dois
botões: **pular** e **continuar**. Vão em cima das telas reais, não numa
simulação, porque o objetivo é a pessoa reconhecer o lugar depois.

Ordem sugerida, que segue a jornada real e não o menu:

1. `/config`: cadastre um serviço, um profissional e um local. Sem isso nada
   mais existe.
2. `/grade`: monte o primeiro horário fixo. É o que faz as sessões nascerem.
3. `/pessoas`: cadastre alguém e crie a vaga na ficha.
4. `/sessao/[id]`: registre a chamada. É a tela do produto.

Quem tem papel de recepção ou profissional não precisa dos passos 1 e 2: eles
não configuram nada. **O roteiro muda por papel**, do mesmo jeito que a lista
"o que você vai poder fazer" do e-mail de convite muda (`core/email/convite.ts`,
`OQUE_VOCE_FAZ`).

## Onde olhar antes de desenhar qualquer coisa

| O quê | Onde |
|---|---|
| Tokens, escala, espaçamento, as nove peças | `Design system Verandi-att/DESIGN-SYSTEM.md` |
| O contrato resumido | `docs/DESIGN.md` |
| As peças renderizadas, em todas as variações | rota `/amostra` |
| Como comparar tela com protótipo | `docs/VESTIR.md` |
| A marcação literal de cada tela | `Design system Verandi-att/Verandi.dc.html` |
| Arte e texto das telas de acesso | `src/components/ui/arte-acesso.ts` |

**A regra que já custou caro uma vez:** ler o código do protótipo não substitui
abrir a tela dele. Rode `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`
e compare em 1440×1000. Foi o atalho que produziu telas com os tokens certos e
nenhuma semelhança com o desenho.

## O que precisa existir no modelo, e ainda não existe

O onboarding tem estado, e estado precisa de coluna. Nada disto existe hoje:

- **Se a pessoa já viu.** Por usuário, não por conta: a recepcionista nova de um
  estúdio antigo precisa ver, e o dono não pode ver de novo.
- **Onde ela parou.** Sequência interrompida que recomeça do zero é pior que
  sequência nenhuma.
- **Se ela pulou.** Pular é resposta legítima e definitiva; reoferecer é
  desrespeito com quem já disse não.

Sugestão: uma tabela `onboarding` em `app_verandi`, com `usuario_id`,
`roteiro`, `passo`, `concluido_em`, `pulado_em`. **Não** pendure isso em
`usuario_conta`: aquilo é vínculo e papel, e misturar progresso de tutorial ali
faz a tabela de acesso crescer por motivo errado.

Migration nova vai por `node scripts/aplica-em-producao.mjs`, nunca por
`supabase db push`. O porquê está no cabeçalho do script.

## Armadilhas que valem para este trabalho

- **Nada de travessão** em texto que a pessoa lê. Vírgula, ponto ou
  dois-pontos. Há teste guardando os e-mails.
- **O vocabulário é da conta.** Nenhum texto de onboarding pode dizer "aluno" ou
  "turma": use `rotulos` como as telas já fazem. Um tutorial que fala "aluno"
  para um barbeiro é pior que não ter tutorial.
- **Alvo de toque de 44px.** A Sessão é usada em pé, e o balão vai por cima
  dela.
- **`rounded-[--radius-x]` não existe no Tailwind v4** e o navegador descarta
  calado. Token de `@theme` gera utilitário próprio: `rounded-cartao`.
- **Constante importada de módulo `'use client'` para componente de servidor
  chega vazia.** Se o roteiro for compartilhado entre os dois, ele mora em
  módulo sem diretiva.
