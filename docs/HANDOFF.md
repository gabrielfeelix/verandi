# Passagem de bastão, 14/ago/2026 (segunda sessão do dia)

> **Banco compartilhado — leitura obrigatória:** antes de qualquer mudança em
> Supabase, migration, Auth, RLS, Storage, extensão ou Data API, leia
> [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md). Verandi usa
> `app_verandi`; AutoFluxos usa `public`; os recursos globais afetam os dois.

Para o próximo agente. Este arquivo é o **atalho**: o que aconteceu nesta
sessão, o que está pendente e por qual ponta pegar. Ele não substitui o
[`ESTADO.md`](ESTADO.md), que continua sendo a leitura obrigatória e o único que
descreve o sistema inteiro.

**Leia nesta ordem:** `ESTADO.md` inteiro → este arquivo → o plano do que você
for fazer.

---

## Onde o produto está

A Verandi está **no ar** em `https://verandi.4yu.com.br`, com banco de produção
no schema `app_verandi` (dividido com o AutoFluxos), e-mail saindo pelo Brevo e
deploy automático a cada push na `main`.

Conta de demonstração em produção: MGM Pilates, dona `contato@4yu.com.br`.
A senha não fica em documentação nem no repositório; o acesso deve vir do cofre
da equipe.

Verificado no fim desta sessão: `npm run build` limpo, **272** testes de unidade,
**106** de navegador, `npm run segredos` sem credencial no repositório, migration
`0042` aplicada em produção e o onboarding abrindo lá sem erro 5xx.

---

## O que esta sessão fez, em quatro commits

**`a017df4` Os três acertos de interface do plano 07.** O trilho nasce aberto (o
código contrariava o próprio comentário). O login corta uma volta ao servidor e
mantém o "Entrando…" até a próxima tela pintar. Criar e editar item de lista
virou modal em Serviços, Equipe, Locais, Usuários e Grade, que é onde o
protótipo desenha modal; Padrões e Vocabulário ficaram embutidos, também como
no protótipo, porque ali a tela inteira é o formulário.

Junto veio uma correção que valia para os cinco modais que já existiam: **a
página rolava atrás do modal**, o que o DESIGN-SYSTEM 4.7 proíbe em letras
maiúsculas. O `<dialog>` nativo prende o foco mas não trava a rolagem. Nenhum
teste pegava isso, e nenhum pega: mede-se com `window.scrollY` depois de um
`wheel`.

**`b506bd6` O onboarding, do plano 05.** Migration `0042` com a tabela
`onboarding`, boas-vindas em modal por cima do sistema, e a pergunta do tipo de
negócio escrevendo o vocabulário inteiro de uma vez.

**`c5cf17a` A visita guiada.** A tela inteira escurece e só o alvo fica aceso,
com o balão branco por fora do escuro. Quinze passos para o dono, onze para a
recepção, navegando sozinha pelo menu e por cada destino.

**`6954c13`** e os docs: `ESTADO.md` atualizado e os planos novos.

### Três coisas desta sessão que valem para o resto do produto

1. **`<dialog>` não trava rolagem.** Quem travar precisa de contador (dois
   modais abertos não podem se destravar) e de compensar a barra de rolagem,
   senão a página pula 15px ao abrir. Está feito na casca do `<Modal>`.
2. **Artigo nunca cola na palavra do vocabulário.** "Cadastre um serviço" vira
   "cadastre um modalidade" numa conta de pilates; "os horários fixos" vira "os
   turmas fixas". O gênero é da palavra e a palavra é do cliente. Há teste
   guardando o onboarding; **o resto do produto ainda não foi varrido com essa
   régua**, e provavelmente tem casos.
3. **`listUsers()` do Supabase devolve só os 50 primeiros.** Quebrou o semeador
   de desenvolvimento com um erro que não citava e-mail nenhum. Quem procurar
   usuário por e-mail precisa virar as páginas.

---

## O que a segunda sessão fez

Cinco coisas, e uma delas não estava na lista porque ninguém sabia que existia.

1. **A barra fixa da Sessão saiu em tela larga** (`md:hidden`). O protótipo
   desenha as duas ao mesmo tempo, então a tela estava fiel e o defeito era do
   protótipo: virou a quarta divergência de propósito. Medido: 1440 tem um
   botão, 420 tem dois.
2. **Funcionamento virou modal por dia**, e "Nova data fechada" também.
3. **O defeito que estava escondido no Funcionamento.** Marcar feriado com
   "cancelar e avisar" cancelava as sessões e **não dava crédito a ninguém**,
   apesar de a migration `0037` dizer que dava. Agora a participação vira
   `cancelada` e abre reposição em `/pendencias`. "O que dá crédito" virou
   `statusComCredito()`, porque estava escrito à mão em quatro lugares.
4. **Confirmação destrutiva ao desativar local e profissional**, com a contagem
   de séries ativas e sessões futuras.
5. **As duas decisões de modelo**, migration `0043`: anonimizar preservando a
   linha, e observação com "visível para", padrão fechado.

Verificado no fim: `npm run build` limpo, **272** de unidade, **114** de
navegador, `npm run segredos` limpo.

**Duas falhas de e2e nesta máquina são de concorrência, não de código**
(`consultas.test.ts`, `suporte.spec.ts`, e mais duas em corrida cheia). Rodadas
isoladas passam. A máquina fica com menos de 4 GB livres durante a suíte.

## O que fazer agora, em ordem

### 1. Aplicar a `0043` em produção, quando o AutoFluxos estiver parado

**Não foi aplicada de propósito.** Em 14/08 o Gabriel estava mexendo no
AutoFluxos, que divide o mesmo projeto Supabase. Ela já está no banco local e
coberta por teste.

```bash
set -a && . ../.secrets/4yu.env && set +a
node scripts/aplica-em-producao.mjs
```

Nunca `supabase db push`. A `0043` mexe em três coisas: duas colunas novas, o
`check` do `log_configuracao`, e **recria a view `pessoa_resumo`** (coluna nova
não entra em view sozinha, e a contagem de reposição estava desatualizada).

### 2. Gerar as ilustrações do onboarding

Os prompts estão prontos em [`ARTE-ONBOARDING.md`](ARTE-ONBOARDING.md), com
prefixo e sufixo de estilo que casam com as artes que já existem. **Quem gera é
o Gabriel**, não o agente. A arte de hoje é emprestada das telas de acesso, de
propósito: trocar é uma linha por arte no registro de
`src/core/onboarding/boas-vindas.ts`, sem tocar em tela nenhuma.

### 3. Vida nas telas

[`planos/08-vida-nas-telas.md`](planos/08-vida-nas-telas.md): movimento da marca
onde há espera de verdade, e ilustração nos estados vazios. As três decisões que
travam isso estão escritas lá (quem desenha, quantas artes, peso). **Não comece
sem falar com o Gabriel**, porque a primeira delas é dele.

### 4. Varrer o produto com a régua do vocabulário

O onboarding tem teste; o resto não, e a segunda sessão provou que falta: um
modal novo saiu com **"Turmas ativos"**, e o teste de vocabulário só pegou
porque a palavra apareceu num comentário meu. A régua vale para **adjetivo**
também, não só artigo. Um caso conhecido, ainda no ar: "`Vagas` ativas" em
"Em números", na ficha da pessoa.

O jeito que funcionou: o qualificador sai de perto da palavra do cliente e vai
para outra coluna, ou a frase muda e deixa de nomear a coisa.

### 5. A observação da ficha ainda não separa quem enxerga

A de **participação** já separa. A de **pessoa** (`pessoa.observacao`, a faixa
"Atenção na aula") continua visível para todo mundo, e é exatamente onde alguém
escreve o mesmo tipo de frase. A decisão já está tomada e o padrão já existe:
falta repetir para essa coluna.

### 6. As dívidas de higiene, quando der

Tipos do banco por gerar; `/contas-4yu` sem paginação (já dói em
desenvolvimento, passou de mil linhas na tela); `PainelVaga` carregando todas as
pessoas da conta; `/hoje` e `/semana` materializando a cada visita; contraste de
`#8B9691` abaixo do mínimo. Todas com o porquê no `ESTADO.md`.

### 7. Cadastre-se, por último, e só com decisão tomada

O Gabriel adiou de propósito em 14/08: a decisão de quem se cadastra sozinho e
de como se entra em negócio que já existe **ainda não está tomada**, e construir
a porta antes de saber para onde ela dá é o jeito mais caro de decidir. A
análise inteira está em
[`planos/06-cadastro-e-organizacoes.md`](planos/06-cadastro-e-organizacoes.md).

Uma coisa já ficou decidida e vale quando for construído: a conta só nasce
**depois** que a pessoa clica no link do e-mail.

### 8. Marco 2

API v1 para o AutoFluxos, eventos de saída, notificações, confirmação por bot,
lista de espera. Nada disso exige tabela nova.

---

## Decisões do Gabriel que você não deve reabrir

- **O "Cancelar assinatura" do Brevo em e-mail transacional fica como está.**
  Existe um caminho oficial (abrir chamado pedindo `List-Help`) e ele decidiu em
  14/08 não abrir. O custo está escrito no `ESTADO.md`.
- **Cadastro público é o último item**, não o primeiro, mesmo parecendo urgente.
- **O onboarding é dentro do sistema.** Já foi tentado como tela antes de entrar
  e estava errado: uma segunda tela com a cara do login faz a pessoa achar que o
  login não funcionou.

---

## As regras que não se descobrem lendo o código

| Regra | Detalhe |
|---|---|
| Segredo | `set -a && . ../.secrets/4yu.env && set +a`. **Nunca** dentro do repo, que é público. `npm run segredos` confere. |
| Migration nova | `node scripts/aplica-em-producao.mjs`. **Nunca** `supabase db push`: o banco é dividido com o AutoFluxos. |
| Texto do produto | **Nada de travessão**. Vírgula, ponto ou dois-pontos. Há teste guardando os e-mails. |
| Tela | Ler o código do protótipo não substitui abrir a tela dele. Rode os dois capturadores e compare em 1440×1000. [`VESTIR.md`](VESTIR.md). |
| Antes de dizer que acabou | `npm test`, `npm run build`, `npm run test:e2e`, `npm run segredos`. |
| Conta de teste em produção | MGM Pilates · dona `contato@4yu.com.br`; senha no cofre da equipe |

E uma que custou tempo nesta sessão: **toda conta de teste nova cai no
onboarding**. Por isso `e2e/apoio.ts` marca os dois roteiros como pulados por
padrão; quem for testar o onboarding passa `{ pularOnboarding: false }`.

---

## Como subir o ambiente

```bash
npx supabase start           # local, no Docker, faixa 564xx
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local`, senha `senha-de-teste-123`.

Para ver o onboarding de novo depois de tê-lo pulado:

```bash
docker exec supabase_db_verandi psql -U postgres -d postgres \
  -c "delete from app_verandi.onboarding;"
```
