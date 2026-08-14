# Três acertos de interface, apontados pelo Gabriel

Anotados em 14/08/2026 olhando o produto no ar. **Os três estão feitos**, e o
que segue é o que foi encontrado ao fazer, que é a parte que não se deduz do
plano original.

## 1. O trilho tem que abrir aberto — feito

O comentário estava certo e o código errado: `lerRail` devolvia `true` só com
`'sim'` gravado, e o terceiro argumento do `useSyncExternalStore` era
`() => false`. Agora ausência de preferência cai em **aberto**, e só o `'nao'`
gravado fecha, nos dois pontos.

## 2. O login demora, e a tela não diz nada — feito

Duas frentes, as duas:

- **Encurtou um salto.** `entrar` resolve o destino ali mesmo, com o
  `usuario_id` que o `signInWithPassword` acabou de devolver
  (`papelAoEntrar`, em `server/conta.ts`) e redireciona direto para
  `destinoDoPapel`. Sem vínculo ativo ainda passa pela raiz, que é quem sabe o
  que fazer nesse caso.
- **O sinal sobrevive à navegação.** O `pendente` do `useActionState` volta a
  `false` antes de a próxima tela pintar; um estado próprio segura o "Entrando…"
  e só é desfeito quando a ação **responde**, o que só acontece no erro, porque
  o sucesso redireciona. Ele é desfeito **durante o render**, comparando a
  identidade da resposta, e não num efeito: `setState` dentro de efeito é erro
  de lint aqui, e com razão.

## 3. Os modais do sistema não seguem o protótipo — feito

### Onde o protótipo usa modal, e onde usa faixa

Conferido tela por tela, com as capturas de `tira-prototipo.mjs`, não lendo o
código dele. Ele separa por **o que a tela é**, e não por gosto:

| Seção | Protótipo | O que fizemos |
|---|---|---|
| Serviços, Equipe, Locais, Usuários | lista + **modal** para criar e editar | virou `<ModalFormulario>` |
| Grade fixa | lista + **modal** "Nova série" | virou `<ModalFormulario>` |
| Padrões, Vocabulário | **faixa embutida**, com "Salvar/Descartar" no pé | ficou como estava |
| Funcionamento | lista de dias + **modal** por dia | pendente, ver abaixo |

A regra que explica a divisão: **item de lista abre modal; tela que inteira é um
formulário fica embutida.** Padrões e Vocabulário não têm lista, a tela é o
formulário, e um modal ali só esconderia o que a pessoa veio ver.

### O que apareceu ao fazer, e não estava no plano

- **A página rolava atrás de todos os modais, inclusive os cinco antigos.** O
  `<dialog>` nativo prende o foco e deixa o resto inerte, mas não trava a
  rolagem: a roda do mouse fora do card rolava a página. Media-se com
  `window.scrollY` depois de um `wheel`, e dava 600. A trava é do documento, e
  agora mora na casca do modal, com contador para dois modais abertos não se
  destravarem um ao outro, e com compensação da barra de rolagem para a página
  não pular 15px ao abrir.
- **`<ModalFormulario>` existe separado do `<Modal>`** porque o botão que
  confirma precisa ser o `submit` de um `<form>` de verdade. Com o `<form>`
  dentro do corpo, `Enter` no campo não envia e a validação nativa não roda.
- **O semeador de desenvolvimento estava quebrado**, e não por causa disto:
  `listUsers()` sem argumento devolve só os 50 primeiros usuários, e o banco de
  desenvolvimento nunca é limpo. `dono@dev.local` saiu da primeira página, o
  seed tentou criar de novo, o `createUser` devolveu `user: null` com "already
  registered", e o erro que aparecia era `Cannot read properties of null`, sem
  citar e-mail nenhum. Agora vira as páginas.

### Medido, não achado

Com `getComputedStyle` no navegador, com o modal aberto, nos sete casos novos:

| O quê | 4.7 pede | Medido |
|---|---|---|
| largura de formulário | 520px | 520px |
| raio | 22px | 22px |
| sombra | `0 30px 60px -30px rgba(18,33,28,.6)` | igual |
| altura máxima | `100vh - 56px` | 944px em 1000 |
| padding do cabeçalho | `22px 24px 16px` | igual |
| título | 20px 600 Bricolage | igual |
| corpo rola por dentro | sim | sim |
| página rola atrás | **nunca** | não rola (era: rolava) |

## O que ficou de fora, de propósito

- **Funcionamento** continua com a faixa embutida por dia. O protótipo usa modal
  ali, e a troca é do mesmo tipo das outras, mas a seção também tem "nova data
  fechada", que no protótipo é outro modal com escolha de o que fazer com as
  sessões do dia. É um acerto com regra de negócio dentro, não só de forma, e
  entra junto com quem for mexer em exceção de calendário.
- **Confirmação ao desativar local e profissional.** O protótipo abre modal
  destrutivo (`removerLocal`, `excluirProfissional`), dizendo quantas séries e
  sessões dependem do item. Hoje o `×` desativa na hora. É defeito de confirmação,
  não de vestir, e não estava neste plano.

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
