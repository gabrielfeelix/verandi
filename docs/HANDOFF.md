# Passagem de bastão

> **Banco compartilhado, leitura obrigatória:** antes de qualquer mudança em
> Supabase, migration, Auth, RLS, Storage, extensão ou Data API, leia
> [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md). Verandi usa `app_verandi`;
> AutoFluxos usa `public`; os recursos globais afetam os dois.

Este arquivo é o **atalho**: onde o produto está, o que falta, e por qual ponta
pegar. Ele não substitui o [`ESTADO.md`](ESTADO.md), que descreve o sistema
inteiro e é a leitura obrigatória.

**Leia nesta ordem:** `ESTADO.md` inteiro → este arquivo → o plano do que você
for fazer.

Última revisão: 15/ago/2026.

---

## Onde o produto está, em números

A Verandi está **no ar** em `https://verandi.4yu.com.br`, com deploy automático
a cada push na `main`.

| | |
|---|---|
| Contas de cliente em produção | **1** (MGM Pilates) |
| Migrations aplicadas | 16, da `0030` à `0045` |
| Banco | 13 MB de 500 do plano gratuito, dividido com o AutoFluxos |
| Testes | 321 de unidade e banco · 133 de navegador |
| API v1 | três rotas de leitura no ar, respondendo 401 sem chave |

**O produto opera.** Uma conta nasce vazia, se configura inteira pela tela,
monta a grade, registra chamada, controla reposição, manda convite e senha por
e-mail, ensina quem chega pela primeira vez, e agora tem porta para o bot.

**O produto não está pronto para vender.** Quatro coisas faltam, e nenhuma delas
é código de funcionalidade. Estão na seção seguinte, em ordem.

---

## Comece por aqui

Se você é a próxima sessão e quer uma coisa só: **leia o bloco "O que falta para
a Verandi ficar de pé" abaixo e comece pelo item 1.**

O item 1 não é o mais divertido, é o que trava a venda. A Fase 3 do Marco 2 (a
parte de código que sobrou) é o item 5, e está detalhada e destravada — se o
Gabriel disser que quer código antes de papel, pule para ela sem culpa.

```bash
npx supabase start           # local, no Docker, faixa 564xx
npm run tipos                # se alguém mexeu em migration desde a última vez
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local`, senha `senha-de-teste-123`.

---

## O que falta para a Verandi ficar de pé

A ordem aqui é de **risco**, não de esforço. Os quatro primeiros itens não
apareciam em nenhum plano até 15/08, e os quatro são coisas que só doem depois
que existe cliente pagante, que é exatamente para onde o produto está indo. O
detalhe de cada um está em [`planos/11-por-em-pe.md`](planos/11-por-em-pe.md);
aqui vai o resumo.

### 1. Termos de uso, política de privacidade e o contrato de operador

**É o que trava a primeira venda para clínica, e não existe nada disso hoje.**
Nenhuma linha em `src/`, e a página de privacidade do site
(`website/site/privacidade/`) fala só do Deixei Aqui.

O problema não é burocrático, é estrutural, e o produto já foi construído em
cima dele:

- Quem coletou o nome, o telefone e o "hérnia de disco" foi **o cliente**, não a
  4YU. Ele é o **controlador**; a 4YU é **operadora** (LGPD, art. 5º).
- O art. 39 diz que a operadora trata os dados **segundo as instruções** do
  controlador. Instrução se dá por contrato. Sem contrato, a 4YU está tratando
  dado sensível de terceiro sem base documentada.
- O aluno do estúdio **nunca consentiu com a 4YU**. Ele consentiu com o estúdio.
  Isso precisa estar escrito em algum lugar que ele possa ler.

O produto já respeita isso no código, e é isso que torna a falta do papel
esquisita: `anonimizarPessoa` existe, `observacao_visivel` existe nas duas
caixas, o log registra quem atendeu ao pedido de exclusão sem copiar o nome. O
que falta é dizer no papel o que o código já faz.

**O mínimo defensável para vender:**

1. **Termos de uso** da Verandi (quem pode usar, o que a 4YU garante, suspensão,
   encerramento e o que acontece com o dado depois).
2. **Política de privacidade** que separe os dois papéis com todas as letras: a
   4YU é operadora do dado dos alunos e controladora do dado de quem tem login.
3. **Adendo de tratamento de dados** no contrato com o cliente: finalidade,
   prazo, subprocessadores (Supabase e Brevo, os dois com dado no exterior),
   segurança, e o que acontece quando o contrato acaba.
4. **Um endereço de contato do encarregado** (`privacidade@4yu.com.br` serve),
   publicado. A ANPD espera achar isso.
5. **Link no rodapé do sistema e no e-mail**, senão o item existe e ninguém vê.

**Isto é decisão do Gabriel, não do agente.** Um agente pode redigir a minuta e
montar as telas; quem assume o risco jurídico assina. O caminho barato é uma
minuta feita aqui e revisada por advogado, não o contrário.

**Subprocessador com dado fora do Brasil:** Supabase e Brevo. A transferência
internacional precisa estar declarada na política. Não é impeditivo, é
declaração.

### 2. Backup

**Não existe.** Está escrito no `ESTADO.md` desde 14/08, com a ressalva "é
aceitável enquanto não há cliente pagante". **Vender encerra a ressalva.**

O plano gratuito do Supabase não tem PITR nem backup automático, e o banco é
dividido com o AutoFluxos: um acidente destrutivo atinge os dois produtos, e
restaurar significa restaurar o projeto inteiro.

Duas saídas, e a primeira é barata:

- **`pg_dump` agendado** para fora do Supabase (o `SUPABASE_ACCESS_TOKEN` já
  alcança o banco; um cron diário guardando em storage fora do projeto resolve
  90% do medo). Um agente faz isso em uma sessão.
- **Plano pago do Supabase**, que traz PITR e resolve de vez. É decisão de
  dinheiro, e ela chega junto com o primeiro cliente pagando.

**Um backup que ninguém testou não é backup.** Seja qual for o caminho, o mesmo
trabalho precisa incluir uma restauração de mentira num projeto descartável.

### 3. Saber quando quebra

Hoje um 500 em produção é **invisível**. Não há Sentry, não há alerta, e o
`console.error` da API vai para o log da Vercel, que ninguém abre de manhã.

Com um cliente e o Gabriel olhando, dá para viver assim. Com cinco, o cliente
vira o monitoramento, e isso custa o cliente.

O barato: Sentry no plano gratuito (ou o alerta nativo da Vercel) e um aviso em
canal que alguém lê. Meia sessão.

E há um caso específico que já existe e ninguém vê: o **webhook do Brevo** marca
convite como `voltou` ou `bloqueado`, e isso hoje só aparece se alguém abrir a
tela de Usuários daquela conta.

### 4. Uma página no site

`4yu.com.br` tem `/deixei-aqui`, `/rodape`, `/crm`, `/quanto-cobro`. **Não tem
`/verandi`.** Não há para onde mandar um interessado, e o produto está no ar.

Isso é trabalho de site (`website/site/`, deploy por `website/scripts/deploy.py`),
não de produto. Uma página com o que é, para quem é, três telas e um formulário
de contato. O cadastro público **não** entra: a decisão de 14/08 é que a conta
nasce pela mão da 4YU, com o `cria-conta.mjs`.

### 5. Marco 2, Fase 3: escrever pela API

A parte de código que sobrou, e a única da lista que não depende de decisão de
ninguém. Plano em [`planos/10-marco-2-api.md`](planos/10-marco-2-api.md),
contrato do que já existe em [`API.md`](API.md).

- `POST /api/v1/pessoas` — cadastra, nome como único obrigatório, igual à tela.
- `POST /api/v1/participacoes` — marca alguém num horário, reusando a regra de
  `encaixar` com `registrado_por_origem: 'bot'`, que já existe no enum desde a
  `0033`.
- `DELETE /api/v1/participacoes/:id` — desmarca, virando crédito pelas mesmas
  regras da conta.

**A armadilha, e ela é real:** `encaixar` mistura a regra com `cookies()`, via
`quemRegistra()`. A rota **não pode** reimplementar "cabe ou não cabe". Extraia
o miolo para uma função que recebe quem está registrando, e chame dos dois
lados. Se `avaliarEncaixe` disser "cabe" na tela e a rota decidir sozinha, um
dia elas discordam e ninguém descobre por semanas.

**`Idempotency-Key` não é enfeite.** O bot repete chamada: rede cai, o WhatsApp
reentrega, a esteira roda duas vezes. Sem isso, o primeiro dia de produção tem
gente marcada em duplicidade. Precisa de tabela nova (`pedido_idempotente`, com
chave, conta, hash do corpo e a resposta guardada) — é a única migration que a
Fase 3 exige.

### 6. Marco 2, Fases 4 e 5

Fase 4, **a Verandi avisa o AutoFluxos**: a recepção cancela pela tela e o bot
precisa saber para avisar quem ia. Outbox na mesma transação do dado, entregador
separado, HMAC e reentrega. Chamar o webhook dentro da ação amarraria o
cancelamento à disponibilidade do outro sistema.

Fase 5, **lista de espera**: transforma "não tem vaga" em "te aviso se abrir".
Só funciona depois da 4, porque é o evento de cancelamento que dispara a
chamada.

### 7. O que depende do Gabriel, e você não começa sozinho

- **Ilustrações do onboarding.** Prompts prontos em
  [`ARTE-ONBOARDING.md`](ARTE-ONBOARDING.md). Ele gera; trocar é uma linha por
  arte em `src/core/onboarding/boas-vindas.ts`, sem tocar em tela.
- **Vida nas telas** ([`planos/08`](planos/08-vida-nas-telas.md)): movimento na
  espera e ilustração nos estados vazios. Trava em três decisões dele, e ele
  disse que vai querer mandar referências.
- **As telas contra o protótipo.** Ele pediu para **não** fazer essa passada.
  Nove tokens de cor e umas vinte frases mudaram em 14/08, a suíte passou
  inteira, e ele avisa se algo ficar estranho.

### 8. Higiene que pode esperar

- O botão **"Entrar na conta"** do convite não entra: leva a `/entrar?novo=1`
  sem preencher o e-mail. Atrito conhecido, não defeito.
- A **busca global** do cabeçalho é uma caixa desabilitada dizendo que entra no
  próximo marco.
- `pessoa_resumo` recalcula quatro subconsultas por linha. Vai bem com mil
  pessoas por conta; não medimos com dez mil.

---

## As decisões travadas. Não reabra sem o Gabriel pedir

- **Cadastro público não será construído** enquanto a venda for ativa. A conta
  nasce pela mão da 4YU. Análise antiga em
  [`planos/06`](planos/06-cadastro-e-organizacoes.md); o que vale é esta linha,
  porque a decisão é posterior a ela.
- **Organização com várias unidades não será construída agora.** E o modelo
  atual já é o certo para receber uma depois: `conta` é a unidade de isolamento,
  e organização entraria como tabela nova mais uma coluna anulável, sem mover
  nada. O caro seria o inverso.
- **O profissional que atende em dois estúdios já funciona.** `usuario_conta`
  tem chave `(usuario_id, conta_id)`, `profissional.usuario_id` não é único, e
  `/contas` é o seletor. Teste em `acesso.test.ts:82`. Não construa nada.
- **Cobrança não será construída.** Pix na mão está certo com um cliente. O que
  já se decidiu é a **unidade** do preço, por pessoa ativa, que o produto já
  conta.
- **O robô não decide nada.** Horário cheio não aparece para ele, não abre
  turma, não muda capacidade, não passa da lotação. É contrato de API e regra de
  produto.
- **O onboarding é dentro do sistema**, não uma tela antes de entrar. Já foi
  tentado do outro jeito e a pessoa achava que o login não tinha funcionado.
- **O "Cancelar assinatura" do Brevo em e-mail transacional fica como está.**
  Existe caminho oficial e ele decidiu não abrir chamado.

---

## Migration em produção: você aplica, e não pergunta

Decisão do Gabriel em 14/08. Perguntar a cada migration é atrito sem ganho,
porque a resposta é sempre a mesma enquanto o alcance for o nosso schema. O
risco real não é aplicar: é aplicar sem conferir o que a mudança derruba.

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
   levam o dependente junto, em silêncio:

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
   funciona. Confira: a coluna na tabela **e nas views que a expõem** (coluna
   nova não entra em view sozinha, foi a armadilha da `0043` e da `0044`), o
   `security_invoker` da view de pé, a contagem de tabelas em `public` intacta,
   e o site respondendo.

**Pergunte antes** em três casos, e só neles: a migration escapa do nosso
schema; existe dependente de fora; ou ela é destrutiva sem volta (`drop` de
coluna ou tabela com dado de cliente).

---

## As regras que não se descobrem lendo o código

| Regra | Detalhe |
|---|---|
| Segredo | `set -a && . ../.secrets/4yu.env && set +a`. **Nunca** dentro do repo, que é público. `npm run segredos` confere. |
| Migration nova | `node scripts/aplica-em-producao.mjs`, com a conferência acima. **Nunca** `supabase db push`. |
| Mexeu em migration | `npx supabase db reset` e depois **`npm run tipos`**. Sem isso o `tsc` segue passando com a forma antiga do banco. |
| Tipo derivado do banco | mora em `src/server/banco.ts`. **Nunca** em `banco.types.ts`, que é reescrito inteiro a cada geração. |
| Rota nova da API | chame a função de `server/`, que já recebe `contaId` e filtra por ele. Sem sessão não há RLS, e um `select` sem `conta_id` lê a conta de todo mundo. |
| Prop de Server para Client Component | só valor. Função é recusada em **tempo de execução**, e nem o `tsc` nem o `build` avisam. |
| `select` do supabase-js | string literal. Montado com `+` vira `string` e devolve `GenericStringError`, que fala de tudo menos do problema. |
| Texto do produto | **Nada de travessão**. Vírgula, ponto ou dois-pontos. Há teste guardando os e-mails. |
| Palavra do cliente | nem artigo nem adjetivo colado nela: o gênero é da palavra e a palavra é do cliente. Lint em `tests/unit/regua-do-vocabulario.test.ts`. |
| Cor de texto | tem contraste mínimo, medido em `tests/unit/contraste.test.ts`. Não clareie para ficar igual ao protótipo. |
| Tela | ler o código do protótipo não substitui abrir a tela dele. [`VESTIR.md`](VESTIR.md). |
| Conta de teste nova | cai no onboarding. `e2e/apoio.ts` pula os dois roteiros por padrão; passe `{ pularOnboarding: false }` para testá-lo. |
| Antes de dizer que acabou | `npm test`, `npm run build`, `npm run test:e2e`, `npm run segredos`. |
| Conta de demonstração | MGM Pilates · dona `contato@4yu.com.br` · senha no cofre da equipe. |

---

## O que quatro sessões ensinaram, sem a cronologia

A cronologia está no `git log`, que conta melhor. O que não está em lugar nenhum
é isto:

1. **O silêncio é o defeito.** Os piores achados não quebraram nada: a chamada
   que cancelava sem dar crédito, o contraste que reprovava havia meses, a
   Configuração que falava a língua errada, o aplicador que trataria erro de
   token como banco virgem. Nenhum apareceu em teste, porque nenhum quebrava.
   Quando desconfiar de algo assim, **transforme a regra em número e teste** — o
   lint do vocabulário pegou um erro meu três minutos depois de escrito.
2. **Verifique fora do console.** O painel diz "publicado", "aplicado", "ok"
   para coisa que não funciona. Foi assim que se descobriu que o site carregava
   o contêiner errado do GTM por meses.
3. **Regra duplicada é regra que vai divergir.** Sempre que a tela e outra coisa
   precisarem da mesma decisão, a decisão sai para `core/` e as duas chamam. Vale
   para o encaixe, para o crédito de reposição e para a API.
4. **Coluna nova não entra em view sozinha.** Duas migrations seguidas caíram
   nisso.
5. **A régua da palavra do cliente inclui a palavra neutra.** O teste antigo
   procurava "Aluno" e "Turma" fixos, e por isso não via "Serviço" e "Local"
   escritos à mão: eles *são* o padrão. A pergunta certa é "escreveram uma
   palavra que é do cliente?", não "escreveram a palavra de um cliente?".
6. **Pergunta de produto se faz descrevendo a cena.** "Quem é o comprador?" não
   comunicou nada; "o dono acha vocês no Google ou vocês batem na porta dele?"
   teria resolvido na primeira tentativa.

---

## Como subir o ambiente

```bash
npx supabase start           # local, no Docker, faixa 564xx
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Para ver o onboarding de novo depois de tê-lo pulado:

```bash
docker exec supabase_db_verandi psql -U postgres -d postgres \
  -c "delete from app_verandi.onboarding;"
```

Se o Supabase local subir com config antiga (as rotas respondem
`Invalid schema: app_verandi`), é porque os contêineres são de antes de uma
mudança no `supabase/config.toml`: `npx supabase stop --no-backup` e suba de
novo.
