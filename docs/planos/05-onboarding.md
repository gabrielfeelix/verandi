# Onboarding: ensinar o sistema sem manual

Escrito em 14/08/2026, depois de a Verandi entrar no ar. **Construído no mesmo
dia**; o que segue é o plano original, com o que a construção decidiu no fim.

---

## O que ficou de pé, e as decisões que a construção tomou

**O onboarding acontece dentro do sistema, não antes dele.** A primeira versão
era uma rota `/comecar` com a casca das telas de acesso, e estava errada: quem
acabou de digitar a senha via uma segunda tela com a mesma cara do login e
concluía que o login não tinha funcionado. Agora o produto abre inteiro, com o
nome do negócio no trilho e a agenda no lugar, e as boas-vindas vêm por cima, no
mesmo `<Modal>` de todo o resto, com fundo escurecido e rolagem travada.

**A pergunta do tipo de negócio veio para cá**, porque o cadastro público foi
adiado (ver [plano 06](06-cadastro-e-organizacoes.md)). Ela é o **último**
cartão, não o primeiro: perguntar "que tipo de negócio é o seu" para quem ainda
não sabe o que o sistema faz é pedir decisão sem contexto. As quatro
predefinições e as palavras que cada uma escreve estão em
`src/core/vocabulario/predefinicoes.ts`, e cada cartão mostra três palavras de
amostra antes de ser escolhido.

**O `cria-conta.mjs` parou de escrever vocabulário.** Ele gravava "Aluno",
"Turma" e "Modalidade" em toda conta que criava, o que é decidir que todo
cliente da 4YU dá aula de pilates. Agora a conta chega neutra e quem escolhe é a
dona.

**A arte das boas-vindas é provisória e trocável.** Hoje são as quatro
ilustrações de `public/acesso/`, apontadas de um registro só, em
`src/core/onboarding/boas-vindas.ts`: trocar o caminho lá troca a arte, e
nenhuma tela lê nome de arquivo. As definitivas entram em `public/onboarding/`,
com a `descricao` mudando junto, que é o que o leitor de tela ouve.

**Os apontamentos não sequestram a navegação.** Quando o passo é de outra tela,
o guia encolhe num cartão de canto que diz onde é e oferece ir. Ele também só
aparece enquanto a conta não tem grade nem gente: apontar "monte o primeiro
horário" para quem já montou é o tutorial falando de um problema resolvido.

**A tabela é `(usuario_id, conta_id, roteiro)`**, e não `(usuario_id, roteiro)`
como o plano sugeria: o roteiro depende do papel, e o papel é por conta. A mesma
pessoa é dona de um estúdio e professora em outro, e ver o roteiro de dono não a
ensina a operar o segundo. `conta_id` também é o que deixa a RLS ser a mesma de
todas as outras tabelas.

**Progresso de tutorial é da pessoa, e de mais ninguém.** Nem o dono lê o da
recepção: saber quem pulou não ajuda a operar nada, e viraria placar de quem
aprendeu o sistema.

Um efeito colateral que vale saber: **toda conta de teste nova cai no
onboarding**. Por isso `e2e/apoio.ts` marca os dois roteiros como pulados por
padrão, e quem testa o onboarding passa `{ pularOnboarding: false }`.

---

## O plano original, como foi escrito

Leia o [ESTADO.md](../ESTADO.md) antes.

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
