# Passagem de bastão, 14/ago/2026 (quarta sessão do dia)

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

Verificado no fim desta sessão: `npm run build` limpo, **321** testes de
unidade, **133** de navegador (suíte inteira, sem falha), `npm run segredos` sem
credencial no repositório, e as **dezesseis** migrations `0030` a `0045`
aplicadas em produção, sem nada pendente.

---

## O que a primeira sessão fez, em quatro commits

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

### Três coisas da primeira sessão que valem para o resto do produto

1. **`<dialog>` não trava rolagem.** Quem travar precisa de contador (dois
   modais abertos não podem se destravar) e de compensar a barra de rolagem,
   senão a página pula 15px ao abrir. Está feito na casca do `<Modal>`.
2. **Artigo nunca cola na palavra do vocabulário.** "Cadastre um serviço" vira
   "cadastre um modalidade" numa conta de pilates; "os horários fixos" vira "os
   turmas fixas". O gênero é da palavra e a palavra é do cliente. A terceira
   sessão varreu o produto inteiro com essa régua e a transformou em lint;
   `tests/unit/regua-do-vocabulario.test.ts` falha se ela voltar a escapar.
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

## O que a terceira sessão fez

Quatro coisas, e a primeira foi desfazer uma informação errada deste arquivo.

**1. A `0043` já estava em produção.** Este arquivo dizia que ela esperava o
AutoFluxos parar. Não esperava:

```bash
set -a && . ../.secrets/4yu.env && set +a
node scripts/aplica-em-producao.mjs --dry     # "nada a fazer — as 14 já estão aplicadas"
```

O `--dry` é a resposta certa para "será que aplicaram?": lê
`app_verandi.migrations_aplicadas` e não escreve nada. Vale mais do que confiar
na última linha escrita aqui.

**2. A régua do vocabulário varreu o produto**, e virou lint. Vinte e poucas
frases mudaram. O que mais importa não é a contagem: **três telas não falavam a
língua da conta**, e ninguém tinha percebido porque elas escreviam a palavra
*neutra*, que é justamente a que o teste antigo não pegava.

- A Configuração de **Serviços e Locais** escrevia "serviço" e "local" à mão, do
  título ao aviso de sucesso. Num estúdio de pilates, o dono clicava em
  "Modalidades" no menu e caía numa tela chamada "Serviços".
- O **menu lateral** da Configuração, pelo mesmo motivo.
- Os três campos do **editor de série**: "Serviço", "Profissional", "Local".

`tests/unit/regua-do-vocabulario.test.ts` é um lint que varre `src/` e falha se
um artigo ou adjetivo voltar a colar na palavra do cliente. Ele pegou um erro
meu na mesma sessão, três minutos depois de ser escrito.

**3. A observação da ficha separa quem enxerga**, migration `0044`, com o mesmo
desenho da `0043`. E uma coisa que só ficou clara aqui: **onde o texto some, a
tela precisa dizer que ele existe.** Ficha sem observação e ficha com observação
restrita não podem parecer iguais, senão a recepção escreve por cima achando que
o campo está vazio.

**4. Seis dívidas técnicas fechadas.** A que mais rende é a primeira.

- **Tipos do banco gerados** (`npm run tipos`) e ligados aos dois clientes.
  Achou quatro erros reais na hora de ligar. `db.from('pesoa')` deixou de
  compilar.
- **`/contas-4yu` pagina e busca**, e a consulta de sinais deixou de varrer o
  banco inteiro.
- **O encaixe busca no servidor**, em vez de baixar a conta inteira em toda
  abertura de chamada.
- **`/hoje` e `/semana` pararam de escrever a cada leitura.**
- **Contraste corrigido e medido.** Nove tokens mudaram; `tinta-fraca` e
  `tinta-apagada` colapsaram num tom só, de propósito.

### Três coisas da terceira sessão que valem para o resto do produto

1. **Gerar os tipos do banco não é cosmético.** Ligar `Database` aos clientes
   fez o `tsc` achar quatro erros que estavam no ar: `status` como `string` na
   materialização, `detalhe` como `Record<string, unknown>` no log,
   `db.from(variável)` no onboarding e três objetos de update sem tipo nenhum.
   **Migration nova pede `npm run tipos`** — senão o `tsc` segue passando com a
   forma antiga, e o silêncio volta.
2. **Função não atravessa a fronteira de Server para Client Component.** Passei
   `hrefDaPagina` como prop e o Next recusou **em tempo de execução**, não de
   compilação: o `tsc` passou, o `build` passou, e seis testes de navegador
   caíram com "Functions cannot be passed directly to Client Components".
3. **A régua do vocabulário vale para a palavra neutra também.** O teste antigo
   procurava "Aluno" e "Turma" fixos, e por isso não via "Serviço" nem "Local"
   escritos à mão: eles *são* o padrão. A pergunta certa não é "escreveram a
   palavra de um cliente?", é "escreveram uma palavra que é do cliente?".

---

## O que a quarta sessão fez

**As decisões de produto, tomadas.** Cadastro público e organização com várias
unidades **saíram da lista**:

- **Cadastre-se: não construir.** A venda é ativa, um cliente, Pix na mão.
  Cadastro público resolve um gargalo de aquisição que ainda não existe, e cria
  três que não existem: conta morta enchendo o banco, custo antes de receita num
  plano gratuito sem backup, e a perda da conversa que, nos dez primeiros
  clientes, **é** a pesquisa de produto. O que resolve hoje é uma página no site
  com nome e e-mail, e a conta criada com o `cria-conta.mjs` que já existe.
- **Organização com várias unidades: não construir.** E não por preguiça: o
  modelo atual já é o certo. `conta` é a unidade de isolamento, e organização
  entra depois como tabela nova mais uma coluna anulável em `conta`, sem mover
  nada e sem tocar na RLS. O caro seria o inverso, com `conta` sendo a
  organização: aí **toda** tabela do sistema precisaria de `unidade_id`.
- **O caso que parecia exigir organização já funciona.** O profissional que
  atende em dois estúdios: `usuario_conta` tem PK `(usuario_id, conta_id)`,
  `profissional.usuario_id` não tem restrição de unicidade, `/contas` é o
  seletor e some sozinho para quem tem uma conta só. Tem teste desde sempre,
  em `acesso.test.ts:82`. Nada a construir.
- **Cobrança: não construir.** Pix na mão está certo com um cliente. O que vale
  decidir agora é a **unidade** do preço, e por pessoa ativa o produto já sabe
  contar. ([Tecnofit](https://www.tecnofit.com.br/precos/) cobra assim: a partir
  de ~R$189/mês, ~R$3,98 por aluno.)

**O Marco 2 andou até a Fase 2.** Plano em
[`planos/10-marco-2-api.md`](planos/10-marco-2-api.md), referência de quem chama
em [`API.md`](API.md).

- **Fase 1**, em produção: migration `0045` com `chave_api`, autenticação por
  `Authorization: Bearer vr_…`, e a seção **Integrações** na Configuração.
- **Fase 2**, no código: `GET /api/v1/disponibilidade`, `/catalogo` e
  `/pessoas?busca=`. Sem migration, então vai no ar com o próximo push.

### Três coisas da quarta sessão que valem para o resto do produto

1. **O arquivo gerado é reescrito inteiro.** Os atalhos de tipo (`Atualizacao`,
   `Linha`) estavam no fim de `banco.types.ts` e sumiram no primeiro
   `npm run tipos`. Agora moram em `banco.ts`, ao lado, e o cabeçalho do gerado
   avisa. Vale para qualquer coisa que se queira acrescentar ali.
2. **Chave de API é a credencial mais forte que um cliente emite.** Ela alcança
   a agenda inteira da conta sem passar por papel, e por isso: só dono e suporte
   veem, o segredo aparece uma vez, o banco guarda o hash, e revogar não apaga a
   linha. Mesma régua do botão de anonimizar pessoa.
3. **Uma pergunta mal feita custa uma volta inteira.** Perguntei "quem é o
   comprador?" querendo saber se a venda é ativa ou se o dono assina sozinho, e
   o Gabriel não entendeu, com razão. Pergunta de produto se faz descrevendo a
   cena, não com o termo do manual.

---

## O que fazer agora, em ordem

### 1. Gerar as ilustrações do onboarding

Os prompts estão prontos em [`ARTE-ONBOARDING.md`](ARTE-ONBOARDING.md), com
prefixo e sufixo de estilo que casam com as artes que já existem. **Quem gera é
o Gabriel**, não o agente. A arte de hoje é emprestada das telas de acesso, de
propósito: trocar é uma linha por arte no registro de
`src/core/onboarding/boas-vindas.ts`, sem tocar em tela nenhuma.

### 2. Vida nas telas

[`planos/08-vida-nas-telas.md`](planos/08-vida-nas-telas.md): movimento da marca
onde há espera de verdade, e ilustração nos estados vazios. As três decisões que
travam isso estão escritas lá (quem desenha, quantas artes, peso). **Não comece
sem falar com o Gabriel**, porque a primeira delas é dele.

### 3. As telas contra o protótipo, quando incomodar

O Gabriel decidiu em 14/08 **não** fazer essa passada agora. Nove tokens de cor
e umas vinte frases mudaram, a suíte de navegador passou inteira, e ele avisa se
alguma tela ficar estranha. Não gaste sessão nisso por conta própria.

O que muda de propósito e não deve "voltar" ao protótipo: `#8B9691` e as tintas
`positivo`, `alerta` e `atenção` escureceram porque reprovavam em contraste, e
há teste medindo cada par.

### 4. Marco 2, Fase 3: escrever pela API

As Fases 1 e 2 estão prontas. Falta a que marca:

- `POST /api/v1/pessoas` — cadastra, nome como único obrigatório, igual à tela.
- `POST /api/v1/participacoes` — marca alguém num horário, reusando a regra de
  `encaixar` com `registrado_por_origem: 'bot'`, que já existe no enum.
- `DELETE /api/v1/participacoes/:id` — desmarca, virando crédito pelas mesmas
  regras da conta.

**`Idempotency-Key` não é enfeite.** O bot vai repetir chamada: rede cai, o
WhatsApp reentrega, a esteira roda duas vezes. Sem isso, o primeiro dia de
produção tem gente marcada em duplicidade.

**E não duplique a regra.** `encaixar` hoje mistura a regra com `cookies()`, via
`quemRegistra()`. A rota **não** pode reimplementar "cabe ou não cabe": extraia
o miolo para uma função que recebe quem está registrando, e chame dos dois
lados. Se `avaliarEncaixe` disser "cabe" na tela e a rota decidir sozinha, um
dia elas discordam e ninguém descobre por semanas.

### 5. Cadastre-se e organização: fora da lista

Decisão do Gabriel em 14/08, com o porquê inteiro na seção da quarta sessão
acima. Não reabra sem ele pedir. A análise antiga continua em
[`planos/06-cadastro-e-organizacoes.md`](planos/06-cadastro-e-organizacoes.md),
mas o `HANDOFF` vale mais que ela: a decisão é posterior.

---

## Migration em produção: você aplica, e não pergunta

Decisão do Gabriel em 14/08. Perguntar a cada migration é atrito sem ganho,
porque a resposta é sempre a mesma enquanto o alcance for o nosso schema. O
risco real não é aplicar: é aplicar sem conferir o que a mudança derruba no
caminho.

A conferência é fixa, e são cinco passos:

```bash
set -a && . ../.secrets/4yu.env && set +a
node scripts/aplica-em-producao.mjs --dry      # 1. o que está pendente
```

2. **O arquivo só toca `app_verandi`**: tem `set search_path` no topo e nenhum
   `public.` escrito. `public` é do AutoFluxos.
3. **O que ela cria ainda não existe lá.** Migration que já rodou por outro
   caminho falha no meio e deixa a metade anterior aplicada.
4. **Nada de fora depende do que ela derruba.** `drop view` e `drop function`
   levam junto quem depende, em silêncio:

```sql
select dependent_ns.nspname, dependent_view.relname
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class dependent_view on dependent_view.oid = r.ev_class
  join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace
  join pg_class source on source.oid = d.refobjid
  join pg_namespace source_ns on source_ns.oid = source.relnamespace
 where source_ns.nspname = 'app_verandi'
   and source.relname = 'a_view_que_vai_cair'
   and dependent_view.relname <> 'a_view_que_vai_cair';
```

5. Aplica, e **prova fora do console**. O console diz "ok" para coisa que não
   funciona; a mesma lição do GTM que está no `CLAUDE.md` da pasta de cima. O
   que se confere: a coluna na tabela **e na view** (coluna nova não entra em
   view sozinha, foi a armadilha da `0043` e da `0044`), o `security_invoker` da
   view de pé, a contagem de tabelas em `public` intacta, e o site respondendo.

**Pergunte antes** em três casos, e só neles: a migration escapa do nosso
schema; existe dependente de fora; ou ela é destrutiva sem volta (`drop` de
coluna ou tabela que já tem dado de cliente).

---

## Decisões do Gabriel que você não deve reabrir

- **O "Cancelar assinatura" do Brevo em e-mail transacional fica como está.**
  Existe um caminho oficial (abrir chamado pedindo `List-Help`) e ele decidiu em
  14/08 não abrir. O custo está escrito no `ESTADO.md`.
- **Cadastro público não vai ser construído** enquanto a venda for ativa. Deixou
  de ser "o último item" e virou "fora da lista", em 14/08.
- **Organização com várias unidades não vai ser construída** agora, e o modelo
  atual já é o certo para receber uma depois.
- **O onboarding é dentro do sistema.** Já foi tentado como tela antes de entrar
  e estava errado: uma segunda tela com a cara do login faz a pessoa achar que o
  login não funcionou.

---

## As regras que não se descobrem lendo o código

| Regra | Detalhe |
|---|---|
| Segredo | `set -a && . ../.secrets/4yu.env && set +a`. **Nunca** dentro do repo, que é público. `npm run segredos` confere. |
| Migration nova | `node scripts/aplica-em-producao.mjs`. **Nunca** `supabase db push`: o banco é dividido com o AutoFluxos. Você aplica, não pergunta: a conferência está logo abaixo. |
| Texto do produto | **Nada de travessão**. Vírgula, ponto ou dois-pontos. Há teste guardando os e-mails. |
| Tela | Ler o código do protótipo não substitui abrir a tela dele. Rode os dois capturadores e compare em 1440×1000. [`VESTIR.md`](VESTIR.md). |
| Antes de dizer que acabou | `npm test`, `npm run build`, `npm run test:e2e`, `npm run segredos`. |
| Rota nova da API | não monte consulta própria: chame a função de `server/`, que já recebe `contaId` e filtra por ele. Sem sessão não há RLS, e um `select` sem `conta_id` lê a conta de todo mundo. |
| Mexeu em migration | `npx supabase db reset` e depois **`npm run tipos`**. Sem isso o `tsc` segue passando com a forma antiga do banco. |
| Prop de Server para Client Component | só valor. Função é recusada em tempo de execução, e nem o `tsc` nem o `build` avisam. |
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
