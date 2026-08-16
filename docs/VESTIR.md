# Vestir a Verandi, como deixar a tela **idêntica** ao protótipo

Documento para quem vai executar. Leia inteiro antes de escrever a primeira
linha. Ele existe porque eu (o agente anterior) errei exatamente aqui, e a
descrição do erro é a parte mais útil daqui.

---

## 1. O que está errado hoje, sem suavizar

A lógica está pronta e testada: 209 testes de unidade e integração, 87 de
navegador, nove migrations com RLS provada, quatro telas novas funcionando de
ponta a ponta.

**A interface está genérica.** Ela usa os tokens do design system, fontes
certas, cores certas, peças certas, e mesmo assim **não parece o produto**. É
formulário de borda cinza com fonte bonita.

O que aconteceu: eu li o **código-fonte** do protótipo, extraí paleta,
tipografia e raios, escrevi primitivos a partir disso, e **nunca abri as telas**.
Chamei o resultado de "vestido". Não estava. A distância entre "usa os tokens" e
"parece o protótipo" é a distância entre ter tinta e ter um quadro.

Compare você mesmo, agora, antes de continuar:

```bash
node scripts/tira-prototipo.mjs   # gera as capturas do protótipo
npm run dev                       # e abra /config no navegador
```

Se você não sentir a diferença batendo no olho, pare e olhe de novo. Sentir essa
diferença é o requisito do trabalho.

---

## 2. A régua: **idêntico**, não "inspirado"

`Design system Verandi-att/DESIGN-SYSTEM.md` **é a especificação**. Não é
referência, não é inspiração, não é "a direção geral". Leia-o inteiro antes de
mexer em tela: ele traz os valores literais de cada componente, e é curto.

O protótipo em `Design system Verandi-att/Verandi.dc.html` mostra as mesmas
regras montadas, e serve para conferir composição, o que fica ao lado do quê,
com que espaço. `Design system Verandi/` é a versão anterior dele, e só se
consulta quando o novo não previu o caso.

- Onde a tela divergir dele, **é a tela que muda**.
- Se algo do protótipo não couber na nossa realidade de dados, **adapte o
  conteúdo, nunca a forma**: mesma estrutura visual, mesmas medidas, mesmos
  pesos, com o nosso dado dentro.
- "Ficou parecido" não é pronto. Pronto é a captura lado a lado sem diferença
  que dê para apontar.

Pode e deve **pegar do próprio protótipo**: ele traz `style="..."` embutido em
cada elemento, com os valores literais. Copiar dali é o caminho certo, mais
rápido e mais fiel do que reconstruir de memória.

---

## 3. Como ler o protótipo

### 3.1 Renderizar e capturar

`scripts/tira-prototipo.mjs` abre o arquivo local no Chromium e salva PNG de
cada tela. Rode-o toda vez que for começar uma tela, e de novo quando achar que
terminou.

### 3.2 Onde estão os valores

O arquivo é `Design system Verandi-att/Verandi.dc.html`, com três partes:

| Parte | O quê |
|---|---|
| `<style>` no topo | o pouco que é global: ruído, tooltip, esqueleto, animações |
| O corpo em `<x-dc>` | a marcação, com **estilo embutido em cada elemento** |
| O `<script>` grande no fim | `renderVals()` e os ajudantes que montam os dados de cada tela |

Para achar um trecho: procure pelo texto que aparece na tela. `grep -n "Novo
serviço" "Design system Verandi-att/Verandi.dc.html"` leva direto ao botão, com o
estilo dele ao lado.

O dicionário de dados de cada tela está em `renderVals()`. Os ajudantes úteis:
`series()`, `padroes()`, `usuariosPagina()`, `baseP()`, `formDef()`, este
último tem os 41 modais, cada um com título, subtítulo, campos e a nota.

### 3.3 O que os marcadores estranhos querem dizer

`sc-if`, `sc-for`, `{{ ... }}` são do formato do protótipo. Traduza:

```
<sc-for list="{{ nav }}" as="n">   →  {nav.map((n) => ...)}
<sc-if value="{{ n.aberto }}">     →  {n.aberto ? ... : null}
style-hover="background:#..."      →  hover:bg-[#...]
```

---

## 4. O que **não** copiar

Quatro coisas do protótipo são de demonstração ou defeito, e já estão
documentadas em [`DESIGN.md`](DESIGN.md). Elas não voltam:

| O quê | Por quê |
|---|---|
| `user-select: none` e `caret-color: transparent` no `body` | quebram copiar telefone, copiar nome e leitor de tela |
| Fontes por `<link>` do Google | em produção é um terceiro travando a primeira pintura; use `next/font`, que já está montado |
| Botões de 24px de altura | a tela de Sessão é usada em pé, com a mão ocupada; mínimo de 44px nos controles de presença |
| Texto em `#8B9691` | 3,06:1 de contraste, abaixo do mínimo de 4,5:1; no produto ele é `#656E6A` |

E acrescente o que o protótipo não tem: **foco de teclado visível** e
`prefers-reduced-motion`. Os dois já estão no `globals.css`.

---

## 5. O que **não pode quebrar**

Isto aqui é o que separa "vestir" de "reescrever":

**Nenhuma regra de negócio muda.** Você está trocando marcação e estilo. Se
precisar mudar uma consulta ou uma ação de servidor para acomodar o visual,
pare, provavelmente é o visual que foi mal entendido.

**Os 87 testes de navegador continuam passando.** Eles buscam por papel e por
rótulo (`getByRole('button', { name: 'Salvar' })`, `getByLabel('Capacidade')`).
Ou seja: **o nome acessível de cada controle é contrato**. Se o protótipo mostra
um ícone onde nós tínhamos texto, o ícone precisa de `aria-label` com o mesmo
nome, ou você atualiza o teste **de propósito**, dizendo no commit por quê.

Rodar `npm run test:e2e` depois de cada tela não é burocracia: é o que prova que
você trocou a casca sem mexer no fluxo.

**Os primitivos existem para isso.** `src/components/ui/` já tem Botão, Cartão,
Chip, Etiqueta, Campo, Nota, Avatar, Esqueleto, Modal e Desfazer, e `/amostra`
mostra todos. Se uma peça não bate com o protótipo, **conserte a peça**, não
crie uma variação local. Peça consertada arruma todas as telas de uma vez.

---

## 6. A ordem, e por quê

### Passo 1, o shell. Faça este primeiro.

Enquanto o shell não mudar, **nenhuma tela vai parecer o protótipo**, por melhor
que esteja o conteúdo. Hoje é `<header>` com links crus, herdado do Plano 02.

O protótipo tem um **trilho lateral**, e estes são os valores literais dele:

```
aside     background #12211C · padding 18px 12px · gap 20px
          position sticky, top 0, height 100vh
          classe de ruído por cima (o `.vd-ruido` do <style>)
logo      36×36, raio 12px, fundo #2AC3A3, tinta #0B1A15
          "V" em Bricolage 700, 19px
nome      "Verandi" Bricolage 600 16px #EAF3F0
          embaixo, o nome da conta em DM Mono 9.5px,
          letter-spacing .12em, maiúsculas, #7E958D
item      min-height e padding conforme aberto/fechado, raio 14px
          ícone 20×20 + rótulo
          fechado: rótulo em 8px maiúsculo, letter-spacing .06em
          ativo:   fundo rgba(42,195,163,.16), tinta #2AC3A3
          inativo: fundo transparent, tinta #8FA8A0
          hover:   background rgba(255,255,255,.09), translateX(1px)
          transição .22s cubic-bezier(.32,.72,0,1)
selo      quando há pendência: 19×18, raio 9px, fundo #F0693C,
          texto branco 10px 600, encostado à direita
avatar    no rodapé do trilho
```

Os itens, na ordem, com o rótulo curto que aparece fechado:

```
Hoje→Hoje · Agenda→Agenda · Pendências→Pend. (com selo)
<vocábulo plural>→Alunos · Buscar vaga→Vaga · Grade fixa→Fixa
Contas (4YU)→4YU · Acesso→Acesso · Configuração→Config
```

Atenção a três coisas nossas, que o protótipo não sabe:

1. **O trilho respeita papel.** `profissional` só vê Hoje; `recepcao` não vê
   Configuração; `4YU` só aparece para `suporte`. A regra está em
   `src/app/(app)/layout.tsx` hoje, preserve-a.
2. **O rótulo de "Alunos" é o vocabulário da conta**, não texto fixo. Existe um
   teste que falha se "Aluno" aparecer escrito no `src/`.
3. **A faixa de suporte** (vermelha, "você está dentro de X como suporte") tem de
   continuar visível em toda tela. No protótipo ela empurra o shell para baixo
   com `margin-top` no trilho, repare no `shellPad`.

O protótipo também tem **busca global** no cabeçalho ("Buscar aluno ou horário").
Ela não existe no nosso sistema: **deixe o espaço reservado e não invente
funcionalidade**. Anote no `ESTADO.md` como pendente.

### Passo 2, `/config`, que vira a referência das outras

Compare com `config.png`, `servicos.png`, `equipe.png`, `padroes.png`,
`usuarios.png`, `funcionamento.png`.

**Cabeçalho:** "Configuração da conta" em Bricolage ~30px, e embaixo "É aqui que
o sistema deixa de ser genérico e vira o sistema do estúdio".

**Navegação de seções:** cartão branco **vertical à esquerda**, largura ~216px,
um item por seção com glifo à esquerda; ativo é pílula escura ocupando a linha
inteira. Hoje o nosso é chip horizontal no topo, está errado.

**Cartão de conteúdo:** título e subtítulo à esquerda, botão primário escuro à
direita, e **linhas separadas por divisória**, não cartões soltos.

**Linha de serviço** (o exemplo que mostra o padrão de todas as listas):

```
Pilates Solo                          [cap. 4]  [Ativo]  [Editar]
50 min · principal
```

Nome em 14px médio; a segunda linha em 12.5px `#5D6B66`; `cap. 4` em DM Mono
dentro de etiqueta neutra; `Ativo` em etiqueta verde; `Editar` é **botão
contornado**, não link sublinhado. Hoje nós temos tudo numa linha só, com
"Editar" como link, está errado.

**Desativados ficam recolhidos** no fim: "2 serviços desativados ▾". Hoje nós
misturamos com etiqueta "inativo", está errado.

**Equipe:** avatar com iniciais e **anel na cor do profissional**, nome, e-mail
embaixo, e a terceira linha com os serviços que ele atende. À direita, `Tem
login` / `Sem usuário`, `Editar` e um `×`. Repare que o protótipo escreve "sem
e-mail cadastrado" quando falta, vazio explicado, nunca vazio mudo.

**Vocabulário:** cada entidade é **um campo só**, com singular e plural lado a
lado dentro da mesma caixa, e o rótulo em versalete acima
(`PESSOA ATENDIDA`, `PROFISSIONAL`, `SÉRIE`, `SESSÃO`, `SERVIÇO`). Embaixo, a
prévia num cartão de fundo claro com o título
`ONDE ISSO APARECE, ANTES DE SALVAR` e quatro linhas de exemplo. Botões
`Salvar vocabulário` e `Descartar`.

Diferença nossa, de propósito: temos **sete** entidades (as cinco do protótipo
mais `local` e `vaga`). Mantenha a forma, acrescente as duas.

O protótipo tem uma seção **Integrações** que nós não temos, token de API e
webhook são marco 2. Não crie tela sem consumidor; deixe fora e siga.

### Passo 3, as outras que já existem

`/grade`, `/pendencias`, `/contas-4yu`, `/convite/[token]`. Mesmo método:
captura ao lado, item por item.

### Passo 4, as cinco do Plano 02

`/hoje`, `/semana`, `/sessao/[id]`, `/pessoas`, `/pessoas/[id]`, `/vaga`. São as
mais antigas e as mais usadas. `/sessao` é **a tela do produto**, é onde o
esforço vale mais.

Três coisas que o protótipo tem nelas e que o nosso modelo **já aguenta**, mas a
tela não expõe:

- menu por pessoa na Sessão: ver ficha, escrever observação, apontar reposição,
  trocar origem, remover
- em Hoje: agrupamento por Manhã/Tarde/Noite e o destaque da próxima turma
- na Semana: célula dividida quando há duas turmas no mesmo horário, e o
  **modo Dia por recurso** (colunas = sala ou profissional) para quem tem sete
  salas

---

## 7. Critério de pronto, por tela

Não marque uma tela como feita sem estes cinco:

1. Captura do protótipo e captura nossa, **mesma viewport (1440×1000)**, lado a
   lado, sem diferença que dê para apontar com o dedo
2. `npm run test:e2e` inteiro passando
3. `npm run build` limpo
4. Foco de teclado visível em tudo que é clicável; alvo de 44px onde se registra
   presença
5. Nenhuma palavra de vocabulário de cliente escrita no `src/` (há teste)

---

## 8. Duas armadilhas que vão te pegar

**Arquivo `'use server'` só exporta função async.** Constante ou tipo exportado
de lá derruba o build, e o erro aponta para a rota, não para o arquivo. Já mordeu
três vezes. Constante vai para `core/`.

**A suíte de navegador roda contra build de produção**, não `next dev`, o
servidor de desenvolvimento cresce sem devolver e já derrubou o navegador por
falta de memória. E, ao rodar `npm run dev` para olhar a tela, **derrube depois**:
ele chega a 1,7 GB.

O resto está em `ESTADO.md`, seção "Armadilhas que já custaram tempo". Vale os
cinco minutos.

---

## 9. O recado

O sistema por baixo é sólido: multi-inquilino com RLS provada por teste, agenda
que não reescreve o passado, encaixe que registra quem decidiu, convite com token
que nunca encosta em claro no banco. **Nada disso aparece** enquanto a tela
parecer rascunho.

O protótipo já resolveu o desenho, densidade, hierarquia, o tom das mensagens,
os estados vazios que explicam que não são erro. Ele não precisa ser
reinterpretado. Precisa ser **executado com fidelidade**.

Quando tiver dúvida entre o que você acha bonito e o que o protótipo faz: é o
protótipo.
