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

Última revisão: 18/ago/2026, com o primeiro módulo do administrativo no ar.

---

## Onde o produto está, em números

A Verandi está **no ar** em `https://verandi.4yu.com.br`, com deploy automático
a cada push na `main`.

| | | |
|---|---|---|
| Contas de cliente em produção | **1** (MGM Pilates) | conferido 18/08 |
| Migrations aplicadas | **24**, da `0030` à `0053` | conferido 18/08 |
| Tabelas em `app_verandi` | **31**, todas com RLS, 46 políticas | conferido 18/08 |
| Tabelas em `public` (AutoFluxos) | **19**, intactas | conferido 18/08 |
| Banco | **15 MB** de 500 do plano gratuito, dividido com o AutoFluxos | conferido 18/08 |
| Testes | 370 de unidade e banco · **172** de navegador | rodados em 16/08, no commit `a02a743` |
| API v1 | nove operações e quatro eventos de webhook, com documentação pública em `/api-docs` | |

**A linha dos testes é piso, não retrato.** Oito commits mexeram em tela depois
que a suíte rodou pela última vez. Se você tem Docker de pé, rode e corrija o
número; é o item mais barato desta página.

**O produto opera.** Uma conta nasce vazia, se configura inteira pela tela,
monta a grade, registra chamada, controla reposição, manda convite e senha por
e-mail, ensina quem chega pela primeira vez, e agora tem porta para o bot.

**O produto não está pronto para vender.** O papel saiu em 15/08 e espera
assinatura, e o backup ainda não tem destino nem quem o dispare. Monitoramento e
página no site foram feitos em 15/08. Nada do que falta é código de
funcionalidade. Está na seção seguinte, em ordem.

---

## Comece por aqui

**O que está pela metade, e é a primeira coisa a fazer:** o módulo de
acompanhamento por foto (plano 14) está no ar, com a `0053` aplicada, mas
**três verificações não rodaram** porque a máquina onde ele foi escrito estava
sem Docker: `npm run tipos`, `tests/avaliacao.test.ts` e `e2e/avaliacao.spec.ts`.
Com o banco local de pé, isso é meia hora:

```bash
npx supabase start && npx supabase db reset && node scripts/semear-dev.mjs
npm run tipos
npx vitest run tests/avaliacao.test.ts
npx playwright test e2e/avaliacao.spec.ts
```

`npm run tipos` vai reescrever `banco.types.ts` inteiro e apagar as três
entradas escritas à mão, que é exatamente o que se quer: elas já foram
conferidas contra produção, mas gerado é melhor que conferido.

**O que falta não é código de funcionalidade.** As Fases 3, 4 e 5 do Marco 2
saíram em 15/08, e 16/08 foi um domingo inteiro corrigindo o que só aparece
usando o sistema como quem trabalha nele. O que sobrou está abaixo, em ordem de
risco, e os dois primeiros dependem de decisão do Gabriel, não de trabalho de
agente:

1. **O backup precisa de destino e de quem dispara** (item 2). O script existe e
   foi provado restaurando; o que falta é escolher **onde a cópia mora**, e essa
   escolha cria um lugar novo onde dado de saúde descansa, o que a torna decisão
   de privacidade antes de ser de infraestrutura.
2. **O papel espera assinatura** (item 1): CNPJ, prazos, a caixa
   `privacidade@4yu.com.br` que ainda não existe, e virar `EM_REVISAO`.

**Se você quer trabalho de agente e o Gabriel não estiver por perto**, há duas
coisas honestas para fazer, nesta ordem:

- **Rodar a suíte inteira e corrigir os números desta página.** Não roda desde
  16/08, e oito commits mexeram em tela depois disso.
- **A régua do vocabulário no aviso de sucesso** ("Horário criada" sai quando a
  palavra da conta é masculina), que é a única dívida que 16/08 deixou por
  escrito e sabe como resolver.

```bash
npx supabase start           # local, no Docker, faixa 564xx
npm run tipos                # se alguém mexeu em migration desde a última vez
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local`, senha `senha-de-teste-123`.

---

## O que 16/08 fez, em uma tela

Onze commits, e o detalhe de cada um está em [`ESTADO.md`](ESTADO.md). O resumo
é este: alguém abriu o produto e tentou fazer o trabalho de um dia, em vez de
conferir se a tela existia.

- **Cinco ações prometiam e não cumpriam** e viraram modal: cadastrar pessoa,
  editar ficha, agendar, criar matrícula, encerrar horário. "Encerrar"
  perguntava pelo `confirm()` do navegador, que o DESIGN-SYSTEM proíbe.
- **A suíte passou a perguntar se o modal abriu**, não só se a URL mudou. As
  quatro ações acima nunca tinham sido cobertas: davam verde por ausência.
- **Seletor, calendário e máscara de telefone passaram a ser da casa**, e o DDD
  virou regra de tela e de API (migration `0052`, coluna gerada).
- **Grade fixa em cartões, foto na ficha** (migration `0051`, balde privado
  `foto-pessoa`), e **o sino** para quem responde pelo negócio.
- **Erro de framework virou frase em português**, porque "Minified React error
  #441" apareceu para o dono de um estúdio no meio de cadastrar uma modalidade.
- **A linguagem foi varrida nos 339 trechos que chegam à tela**, em três commits
  seguidos: a primeira passada não alcançou o texto montado no servidor, que só
  aparece quando existe pendência de verdade na conta.

**As duas lições, que valem para o resto:** varredura por print não alcança
texto montado no servidor, e teste que confere URL não confere trabalho feito.

---

## O que falta para a Verandi ficar de pé

A ordem aqui é de **risco**, não de esforço. Os quatro primeiros itens não
apareciam em nenhum plano até 15/08, e os quatro são coisas que só doem depois
que existe cliente pagante, que é exatamente para onde o produto está indo. O
detalhe de cada um está em [`planos/11-por-em-pe.md`](planos/11-por-em-pe.md);
aqui vai o resumo.

### 1. Termos de uso, política de privacidade e o contrato de operador

**Minuta feita em 15/08.** Os três documentos existem, as duas telas estão no
ar e o link está no rodapé do sistema, no rodapé das telas de acesso e no pé de
todo e-mail. O que falta agora é **decisão do Gabriel**, e a lista inteira está
em [`juridico/README.md`](juridico/README.md): razão social e CNPJ, criar de
verdade o `privacidade@4yu.com.br`, os quatro prazos de contrato, e virar
`EM_REVISAO` para `false` depois do advogado.

O texto mora em `src/core/legal/`, não num `.md`, porque ele é tela. O adendo de
operador, que é assinado e não publicado, mora em
[`juridico/ADENDO-TRATAMENTO-DE-DADOS.md`](juridico/ADENDO-TRATAMENTO-DE-DADOS.md).

O problema nunca foi burocrático, é estrutural, e o produto já foi construído em
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

**O mínimo defensável para vender, e o que já foi feito dele:**

1. **Termos de uso.** ✔ `src/core/legal/termos.ts`, publicado em `/termos`.
2. **Política de privacidade** com os dois papéis separados com todas as letras.
   ✔ `src/core/legal/privacidade.ts`, publicada em `/privacidade`.
3. **Adendo de tratamento de dados.** ✔ minuta em `docs/juridico/`, com os três
   anexos (dados tratados, medidas de segurança, suboperadores).
4. **Endereço do encarregado**, publicado. ✔ nos documentos, `privacidade@4yu.com.br`.
   **A caixa ainda não existe**, e endereço que devolve erro é pior que
   endereço nenhum.
5. **Link no rodapé e no e-mail.** ✔ rodapé do sistema, rodapé das telas de
   acesso, pé de todo e-mail, e a frase de aceite em dois lugares: ao criar a
   senha do convite e ao entrar.
6. **Registro do aceite.** ✔ migration `0046`, `aceite_de_termos`: quem, quando,
   de onde, e **qual versão**. Não estava na lista original, e a pesquisa
   mostrou que é o item de maior retorno: sem a versão registrada, "a pessoa
   aceitou" não se prova.

**Isto é decisão do Gabriel, não do agente.** Um agente redigiu a minuta e
montou as telas; quem assume o risco jurídico assina.

**Onde o dado é tratado, conferido na API de cada fornecedor:** banco no
**Brasil** (Supabase, `sa-east-1`) e, desde 15/08, **aplicação também no Brasil**
(Vercel, `gru1`, movida de `iad1` de propósito); e-mail na **União Europeia**
(Brevo, coberto pela decisão de adequação da ANPD de jan/2026). Este arquivo
dizia "Supabase e Brevo, os dois com dado no exterior", deduzido da sede das
empresas, e estava errado. O que sobra de transferência é o acesso administrativo
dos fornecedores a partir dos Estados Unidos, e está declarado na política.

### 2. Backup: o script está pronto e provado, falta você escolher o destino

`npm run backup` faz o dump do schema `app_verandi`, comprime, guarda fora do
repositório e apaga o que passou de sete dias. `npm run backup:testa <arquivo>`
restaura num banco descartável e confere que a conta volta de pé.

**A primeira restauração de mentira achou um defeito que o dump escondia.**
`pg_dump --schema app_verandi` não carrega as extensões, que moram em
`extensions`. Como `pessoa.nome_busca` é coluna gerada que chama `unaccent`,
num banco novo **toda inserção de pessoa falhava**, uma por uma, enquanto série,
sessão e participação entravam normalmente. A restauração parecia ter dado
certo e voltava sem nenhuma pessoa, com o histórico apontando para gente que não
existia mais. O script agora escreve as extensões no topo do arquivo, e a
restauração volta com as 84 pessoas.

**O que falta é decisão sua, e são duas linhas:**

1. **Onde a cópia mora.** Hoje o padrão é `../backups-verandi`, na sua máquina,
   fora do repositório (que é público). Qualquer destino em nuvem, GitHub,
   Drive, S3, passa a ser **um lugar novo onde dado de saúde de paciente
   descansa**, e por isso precisa entrar na política de privacidade como
   subprocessador. Não escolhi por você por causa disso.
2. **Quem dispara.** O plano gratuito da Vercel não roda `pg_dump`, então o
   agendamento é fora dela: `cron` na sua máquina, ou uma ação agendada num
   repositório **privado** com a senha do banco como segredo.

Enquanto não houver agendamento, rode à mão antes de qualquer mudança grande.
É pouco, e é muito mais do que existia.

### 3. Saber quando quebra ✔ feito em 15/08

Erro em produção manda e-mail para `contato@4yu.com.br` (ou `ALERTA_EMAIL`, se
existir). Pega tudo: tela, ação de servidor e rota de API, pelo gancho
`onRequestError` mais o `try` da casca da API, que o gancho não enxerga.

**A parte difícil é não virar ruído**, e é onde está o trabalho: erros com a
mesma assinatura (mesmo lugar, mesma mensagem sem id, data e contagem) são um só,
e o aviso fica calado por uma hora depois do primeiro. A contagem continua
correndo em silêncio, e o e-mail seguinte diz quantas vezes aconteceu. Alerta que
enche a caixa é alerta que todo mundo aprende a filtrar, e aí é pior que alerta
nenhum. Migration `0050`, `tests/unit/alerta.test.ts` guardando a régua.

**Não é Sentry, e é decisão.** Sentry resolveria melhor e cobra um cadastro, uma
conta e um DSN que alguém precisa criar; enquanto isso o produto fica sem nada.
Trocar depois é substituir uma função, `avisarErro`, chamada em dois lugares.

### 4. Uma página no site ✔ feita em 15/08

`4yu.com.br/verandi`, com o que é, para quem é, três capturas do sistema rodando
(não maquete) e um formulário que monta um e-mail para `contato@4yu.com.br`. Ela
diz também o que a Verandi **não** faz, porque descobrir isso depois da proposta
custa a venda inteira.

Mora em `website/site/verandi/`, e o deploy é
`set -a && . ../.secrets/4yu.env && set +a && python3 scripts/deploy.py site`,
de dentro de `website/`. Trocar as capturas é regerar os `.webp` de lá.

O rodapé dela aponta para `/termos`, `/privacidade` e `/api-docs` do produto, e a
home ganhou o cartão com a etiqueta "No ar".

### 5. Marco 2, Fase 3: escrever pela API ✔ feito em 15/08

Sete rotas no ar, e a documentação pública em `/api-docs`. O plano da fase e o
desenho de até onde a automação vai estão em
[`planos/12-api-que-escreve.md`](planos/12-api-que-escreve.md).

- `POST /api/v1/pessoas`, `POST /api/v1/participacoes`,
  `DELETE /api/v1/participacoes/:id`, e a leitura que faltava,
  `GET /api/v1/pessoas/:id`, que devolve os próximos horários **com o id da
  participação**. Sem ela o bot marcava e não conseguia desmarcar.
- A armadilha do plano 10 foi desarmada: a regra saiu de `encaixar` para
  `encaixarNaSessao`, que recebe quem registra. Tela e rota chamam a mesma
  função, e o bot nunca confirma acima da capacidade.
- `DELETE` **não apaga**: grava `falta_avisada`, que libera a vaga e preserva o
  crédito de reposição. Apagar destruiria os dois.
- `Idempotency-Key` em toda escrita, com a tabela `pedido_idempotente`
  (migration `0047`). Mesma chave com corpo diferente dá 422, e não uma marcação
  silenciosa no horário errado.

### 6. Marco 2, Fases 4 e 5 ✔ feitas em 15/08

**Fase 4, a Verandi avisa.** Outbox na mesma ação que mexe no dado, entrega em
`after` (depois de a resposta sair), assinatura HMAC com o instante dentro da
conta, e reentrega de 30s a 2h em seis tentativas. Quatro eventos:
`participacao.criada`, `participacao.cancelada`, `sessao.cancelada` e
`vaga.aberta`.

**Fase 5, lista de espera.** `POST /api/v1/espera` e `DELETE /api/v1/espera/:id`.
Fila por horário, ordem de chegada, e quando a vaga abre **uma pessoa por vaga**
é chamada, nunca a fila inteira. Entrar na fila não reserva: quem é chamado
precisa marcar, porque reservar sozinho seria a integração decidindo.

**O limite conhecido:** a reentrega do webhook só dispara quando um evento novo
é enfileirado, porque o plano gratuito da Vercel não dá cron de minuto. Numa
agenda em uso isso acontece muitas vezes por dia; a correção é um cron externo, e
está anotada no plano 12.

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
| Build de produção | o compilador do React só roda nele, e derruba componente que reatribui variável durante o render. `next dev` bom e produção quebrada é isso até prova em contrário. |
| Sombra de valor composto | vai em `style`, não em `shadow-[...]`: vírgula ali quebra o gerador do Tailwind e o CSS **inteiro** deixa de ser produzido. |
| Campo numérico | `<input type="number">` aceita `e`, `+` e `.`. Recuse o que não é dígito, no navegador **e** no servidor. |
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
