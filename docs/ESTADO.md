# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano, desde que se saiba disso.

**Última atualização:** 14/ago/2026 · **A Verandi está no ar em
`https://verandi.4yu.com.br`, mandando e-mail de verdade, com o acesso inteiro
resolvido.**

---

## Em uma frase

Uma conta nasce vazia, se configura inteira pela tela e opera a semana, com a
cara do protótipo, no ar, e com convite e senha chegando por e-mail.

## O que aconteceu em 14/ago, em ordem

1. **O banco foi para `app_verandi`.** O plano gratuito do Supabase dá dois
   projetos por conta (não por organização), e os dois já estavam ocupados. A
   Verandi passou a dividir o projeto do AutoFluxos, separada por schema.
2. **Deploy.** Vercel ligada ao GitHub: push na `main` publica. Domínio
   `verandi.4yu.com.br`.
3. **E-mail.** Domínio `verandi.mail.4yu.com.br` autenticado no Brevo, convite
   saindo, webhook avisando quando não chega.
4. **Segurança.** Cadastro público fechado, senha mínima 8, RLS conferida
   tabela a tabela.
5. **"Esqueci a senha" virou nosso**, porque o do Supabase é incompatível com o
   rastreio de clique do Brevo.
6. **Os três acertos de interface foram feitos**: o trilho nasce aberto, o login
   corta um salto e mantém o "Entrando…" até a próxima tela pintar, e criar e
   editar item de lista virou modal em Serviços, Equipe, Locais, Usuários e
   Grade. Junto veio uma correção que valia para os cinco modais que já
   existiam: **a página rolava atrás do modal**, o que o DESIGN-SYSTEM 4.7
   proíbe. O que ficou pendente e por quê está em
   [`planos/07-acertos-de-interface.md`](planos/07-acertos-de-interface.md).
7. **O onboarding entrou, e mora dentro do sistema.** O produto abre inteiro e
   as boas-vindas vêm por cima, no mesmo modal do resto: a primeira versão era
   uma rota com a casca do login, e uma segunda tela igual à de entrar faz a
   pessoa achar que o login não funcionou. O último cartão pergunta como o
   negócio chama as coisas e escreve o vocabulário de uma vez; depois vêm os
   apontamentos, por papel, sobre as telas de verdade. Migration `0042`, já em
   produção. Detalhe em [`planos/05-onboarding.md`](planos/05-onboarding.md).
8. **Duas listas novas de trabalho**, do Gabriel olhando o produto e a
   concorrência: [`planos/08-vida-nas-telas.md`](planos/08-vida-nas-telas.md)
   (movimento da marca na espera, ilustração onde não há dado) e
   [`planos/09-defeitos-apontados.md`](planos/09-defeitos-apontados.md) (a barra
   fixa da Sessão repete o que já está no cabeçalho).

## O próximo passo, em ordem

1. **As dívidas técnicas**, na seção mais abaixo. A de LGPD é decisão de modelo
   e vale resolver antes do primeiro cliente; a de paginação em `/contas-4yu` já
   dói no banco de desenvolvimento.
2. **Vida nas telas**, anotado do Gabriel olhando a Brevo: movimento da marca
   enquanto a sessão é resolvida, e ilustração onde ainda não há dado. É
   acabamento com razão de existir, e a razão está em
   [`planos/08-vida-nas-telas.md`](planos/08-vida-nas-telas.md).
3. **Marco 2:** API v1 para o AutoFluxos, eventos de saída, confirmação por bot.
   Nada disso exige tabela nova.
4. **Cadastre-se**, por último, por decisão do Gabriel: a análise está pronta em
   [`planos/06-cadastro-e-organizacoes.md`](planos/06-cadastro-e-organizacoes.md),
   e a decisão de quem se cadastra sozinho ainda não foi tomada.

## Como mexer nisto sem quebrar produção

| O quê | Como |
|---|---|
| Segredo | `set -a && . ../.secrets/4yu.env && set +a`. **Nunca** dentro do repo: ele é público. `npm run segredos` confere. |
| Migration nova | `node scripts/aplica-em-producao.mjs`. **Nunca** `supabase db push`. |
| Deploy | `git push origin main` publica sozinho. |
| Mexeu em e-mail | `npx tsx scripts/previa-email.ts voce@email.com` e olhe no cliente; depois `scripts/espelha-no-brevo.ts`. |
| Antes de dizer que acabou | `npm test`, `npm run build`, `npm run test:e2e`, `npm run segredos`. |
| Conta nova na mão | `node scripts/cria-conta.mjs "Nome" dono@email.com [senha]`, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de produção no ambiente. |

**Conta de demonstração em produção:** `MGM Pilates`, dona
`contato@4yu.com.br`. Reflete o cliente real do AutoFluxos (responsável Daniel),
com vocabulário de pilates, três modalidades, duas salas e a semana configurada.
O e-mail do Daniel **não** foi usado de propósito: criar acesso e senha para
alguém que não pediu é errado, e qualquer e-mail chegaria de verdade nele.

## A Tarefa 10, e o que ela achou

A jornada inteira, sem `psql` e sem seed, num banco recém-resetado: suporte
entra → cria a conta em `/contas-4yu` → copia o convite → o dono define a senha
→ cadastra serviço, profissional e local em `/config` → monta uma grade de três
dias em `/grade` → convida uma recepção → cadastra uma pessoa → cria a vaga na
ficha → registra a chamada em `/sessao/[id]`, que termina em **"Chamada feita"**.
Treze passos, todos pela tela.

Dois defeitos apareceram, e nenhum teste os pegava. Os dois viviam no espaço
entre "cada peça funciona" e "a primeira instalação existe":

- **O primeiro suporte não nascia.** `usuario_conta.conta_id` é `not null`,
  `ehSuporte` exige a linha e criar conta exige ser suporte: banco novo travava
  antes do primeiro clique, e só o seed furava. Agora existe a **conta interna**
  (migration `0040`), e o primeiro usuário entra por
  `node scripts/bootstrap-suporte.mjs <e-mail>`.
- **Sair do suporte apagava o suporte.** O vínculo temporário e o vínculo que
  diz "é da 4YU" eram a mesma linha: entrar e sair da conta que hospedava o
  vínculo deixava o usuário sem acesso a nada. Agora `ehSuporte` só olha a conta
  interna, ela não é listada como cliente, e `sairDoSuporte` nunca apaga o
  vínculo de lá.

Um terceiro achado é atrito, não defeito, e ficou como está: o botão **"Entrar
na conta"** do convite não entra, leva a `/entrar?novo=1`, com o texto trocado
mas sem o e-mail preenchido.

## Verificado agora

| O quê | Resultado |
|---|---|
| `npm run build` | limpo |
| `npm test` | **269 passaram** |
| `npm run test:e2e` | **106 passaram** |
| `npm run segredos` | nenhuma credencial de produção no repositório |
| tabelas em `app_verandi` · em `public` | **22 · 0** (as 12 do AutoFluxos seguem intactas) |
| RLS em produção | 20 de 20; `anon` não alcança nada |
| `https://verandi.4yu.com.br` | 200, falando com o banco de produção |
| migration `0042` em produção · onboarding abrindo lá | aplicada · sim, sem 5xx |
| Tarefa 10, jornada inteira em banco virgem | 13 passos, terminou em "Chamada feita" |
| `core/` sem import de banco, Next ou rede | limpo |
| nenhuma tela com "Aluno"/"Turma"/"Paciente"/"Professor" fixo | limpo |
| nenhum "hoje" calculado em UTC no servidor | limpo |

---

## O que existe

**Banco:** treze migrations (`0030_vr_` a `0042_vr_`), RLS com política em todas as
tabelas, provada por teste. **Tudo mora no schema `app_verandi`, não em
`public`**, o porquê está inteiro em `migrations/0030_vr_schema_app_verandi.sql`.

```
conta (com os padrões da operação; `interna` marca a conta da própria 4YU)
usuario_conta · vocabulario · convite
pessoa · pessoa_tag · profissional · profissional_servico · servico · local
serie · vaga · sessao · participacao · excecao_calendario
funcionamento · pendencia_dispensada · acesso_suporte · log_configuracao
onboarding (progresso do tutorial, por pessoa e por conta)
view pessoa_resumo · função usuarios_da_conta (security definer)
balde privado foto-profissional
```

**`core/`**, puro, testável sem subir nada. Aritmética de data, expansão de
série, ocupação, encaixe, estado da chamada, vocabulário, destino por papel,
manutenção de série (linhas em lote, colisão, alcance da edição, sessões órfãs),
estado de convite, papéis concedíveis.

**Vestir as telas**, fechado. As doze telas foram comparadas com o protótipo e
corrigidas. O que ficou de fora são seis blocos do protótipo que dependem de dado
que ainda não existe (busca guardada, log por pessoa, SMTP, hora do aviso, plano
da conta, integrações), a lista, o método e as armadilhas estão em
[`planos/04-vestir-telas.md`](planos/04-vestir-telas.md), **leia antes de mexer
em tela**.

**Design system**, `docs/DESIGN.md` é o contrato; `/amostra` mostra as nove
peças em todas as variações. `Design system Verandi-att/DESIGN-SYSTEM.md` é a
especificação de interface: onde a tela divergir dele, é a tela que muda. O
método de comparação está em [`VESTIR.md`](VESTIR.md), e as duas capturas saem
de `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`.

**Três divergências do protótipo, de propósito**, cada uma escrita no commit que
a criou: alvo de toque de 44px onde o protótipo desenha 34px (a Sessão é usada
em pé); etiqueta de ocupação só fica laranja **acima** da capacidade, como o
protótipo renderiza, turma cheia é estado normal do dia; e a busca global do
cabeçalho fica reservada e desabilitada, porque a funcionalidade não existe e
inventá-la seria pior do que deixá-la faltando.

**Telas:**

| Rota | O quê | Vestida? |
|---|---|---|
| `/entrar` | login, com destino por papel, e link para `/esqueci` | sim |
| `/esqueci` · `/enviado` | pedir senha nova, sem sessão | sim |
| `/contas` | trocar de conta | sim |
| `/hoje` | agenda do dia, com a próxima turma em destaque | sim |
| `/semana` | grade da semana **e o modo Dia por recurso** | sim |
| `/sessao/[id]` | a tela do produto, chamada, encaixe, capacidade, menu por pessoa | sim |
| `/pessoas` · `/pessoas/[id]` | lista, busca e ficha | sim |
| `/vaga` | busca de horário livre | sim |
| `/grade` | criar, editar, duplicar e encerrar horário fixo | sim |
| `/config` | serviços, equipe, locais, padrões, vocabulário, funcionamento, usuários | sim |
| `/pendencias` | o inbox de quem opera | sim |
| `/contas-4yu` | contas dos clientes, com sinais de vida | sim |
| `/convite/[token]` | aceitar convite e definir senha | sim |
| `/amostra` | os primitivos do design system |, |

---

## O que falta

### Plano 03, fechado

- **Tarefa 10: feita.** A jornada inteira pela tela, num banco virgem. O que ela
  achou está na seção lá em cima.
- **Tarefa 11, vestir: feita.** O trilho lateral escuro substituiu a barra de
  links, e as doze telas foram refeitas contra a captura do protótipo. Entraram
  junto as três coisas que o modelo aguentava e a tela não expunha: o **menu por
  pessoa** na Sessão (observação, apontar reposição, trocar origem, remover), o
  modo **Dia por recurso** em `/semana` (colunas = sala ou profissional) e o
  **filtro por local**. O método está em [`VESTIR.md`](VESTIR.md); as capturas
  saem de `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`.

### Acesso, e por que o "esqueci a senha" é nosso

Existem seis telas de acesso, e todas usam a mesma casca e a arte de
`ui/arte-acesso.ts`: `/entrar`, `/esqueci`, `/enviado`, `/convite/[token]` (que
serve tanto para aceitar convite quanto para criar senha nova), `/contas` e o
painel de troca de conta.

**O `recover` do Supabase Auth não é usado, e não pode ser.** O rastreio de
clique do Brevo reescreve todo link e não dá para desligar (eles dizem que não
pretendem permitir). O token do Supabase é consumido no GET, então o rastreador
abre o link antes da pessoa e ela recebe `otp_expired`. Foi assim que descobrimos:
o link chegou como `sendibt2.com/tr/cl/...` e morreu antes do primeiro clique.

O nosso token só é consumido no POST que grava a senha, então robô que abre a
página não quebra nada. `/esqueci` cria uma linha `tipo: 'senha'` em `convite`,
válida por 30 minutos, e manda o e-mail pela API do Brevo.

Três decisões que estão no código e não se deduzem sozinhas: a resposta é a
mesma para e-mail que existe e para inventado (senão o formulário público vira
lista de quem trabalha no estúdio); só há **um pedido em aberto por e-mail**
(senão vira máquina de encher caixa alheia e queimar a cota do Brevo); e o
caminho antigo continua vivo em Configuração, Usuários, porque quem não recebe
e-mail ainda precisa ser atendido.

### Texto do produto não leva travessão

Nem e-mail, nem tela, nem rótulo. Travessão é marca de texto gerado por máquina,
e num produto que vende confiança para dono de estúdio isso derruba a
credibilidade antes de a pessoa ler o conteúdo. Onde a frase pedia travessão,
virou vírgula, ponto ou dois-pontos. Há teste guardando os e-mails.

### E-mail, o que está de pé, e o que falta

De pé: domínio `verandi.mail.4yu.com.br` autenticado no Brevo (DKIM assinando),
convite saindo pela API com template no código, e senha e troca de e-mail saindo
pelo Auth do Supabase via relay SMTP do Brevo, em português.

**Falta o webhook de eventos, e é o que mais importa.** Hoje o Brevo não avisa
nada de volta, então **bounce é invisível**: a dona convida `maria@gmial.com`
com o erro de digitação, a tela diz "Convite enviado", o e-mail volta e ninguém
fica sabendo, até virar chamado para a 4YU. Com `POST /v3/webhooks` apontando
para uma rota nossa, `hard_bounce`/`blocked`/`spam` viram estado na tela: "o
convite voltou, confira o endereço". É a mesma régua do resto do produto, a
tela diz o que aconteceu, não o que se tentou fazer. **Depende do deploy**,
porque webhook precisa de URL pública.

Não vale agora, e é decisão: **automação no Brevo** (não há cliente nem sincronia
do nosso banco para lá, esteira sem nada para processar envelhece e depois
ninguém confia nela), **atributo de contato** (há um contato) e **IP dedicado**
(sem volume constante, IP dedicado entrega pior, porque a reputação nunca
aquece).

### Marco 2, o bot conversa com a agenda

API v1, eventos de saída (outbox + webhook + Resend), notificações, confirmação
por bot, lista de espera. Nada disso exige tabela nova. O e-mail entra aqui, e
então convite e redefinição de senha ganham um segundo caminho, o token já
existe.

### Fora de escopo, e por quê

| O quê | Por quê |
|---|---|
| Importador de planilha | escrever contra o formato de um cliente é consultoria com passo extra; volta com o segundo negócio migrando |
| Financeiro, cobrança, contrato | outro produto |
| Aplicativo de quem é atendido | o WhatsApp é o app dela |
| Relatórios | depois que houver dado real para relatar |

---

## Decisões que mudaram no meio

**Encaixe acima da capacidade agora é permitido, com aviso, e configurável.**
Caiu o princípio "ou a capacidade sobe, ou não cabe". Ficou a metade que
importa: `temVagaParaOferecer`, busca de vaga e API do robô, continua
recusando horário cheio, e isso não é configurável. A recepção decide olhando
para quem está na frente dela; o robô não decide nada.

**O protótipo virou a especificação de interface.** Ver a revisão de 13/ago em
`docs/planos/03-configuracao.md`.

**Convite e redefinição de senha não dependem de e-mail.** O dono copia o link
da tela. Sem isso, toda senha esquecida na primeira semana seria um chamado para
a 4YU com a chave de serviço na mão.

## Decisão pendente, de gente

**Onde o Supabase de produção vai morar, resolvido por ora: dividido com o
AutoFluxos.** O plano gratuito dá **dois projetos por conta**, não por
organização (criar org nova não ajuda, verificado), e `radar-ofertas` e
`autofluxos` já ocupam os dois. Então a Verandi mora no schema `app_verandi`
dentro do projeto do AutoFluxos.

O que isso custa, escrito para ninguém se assustar depois: **não há backup** no
plano gratuito, e restaurar é do banco inteiro, acidente num produto leva o
outro junto. É aceitável enquanto não há cliente pagante e deixa de ser no dia
que houver.

A saída já está desenhada e é barata, porque schema separa de verdade: restaura
o dump num projeto novo, `drop schema app_autofluxos cascade` lá,
`drop schema app_verandi cascade` no velho. Sobra apagar de `auth.users` quem
não tem vínculo, os dois projetos herdam todos os usuários.

**Já está aplicado em produção** (projeto `autofluxos`, ref `xxxynoshwirupkdzwxbj`):
21 objetos em `app_verandi`, 4 funções, 39 políticas, e as 12 tabelas do
AutoFluxos em `public` intocadas. Migration nova vai por
`node scripts/aplica-em-producao.mjs`, **não** por `supabase db push`, que
compararia a pasta local com a `schema_migrations` compartilhada e passaria a
reclamar das versões do outro produto. O controle mora em
`app_verandi.migrations_aplicadas`. Desfazer tudo:
`supabase/desfazer-verandi.sql`.

Falta um passo que não tem API e **só pode ser dado depois** que o schema
existe: painel → Integrations → Data API → Settings → **Exposed schemas** →
`app_verandi`. Marcar antes derruba o cache do PostgREST, que é o mesmo dos dois
produtos, e tira a API do AutoFluxos do ar.

## Dívidas técnicas anotadas

- **Gerar os tipos do banco** (`supabase gen types typescript --local`) para
  tirar os `.returns<T[]>()` e os `as unknown as` espalhados.
- **`/contas-4yu` lista todas as contas sem paginação nem busca.** Com dezenas
  de clientes vai bem; com centenas, não, e o banco de desenvolvimento já
  mostra o defeito, porque as contas que os testes deixam para trás passaram de
  mil linhas na tela.
- **`PainelVaga` carrega todas as pessoas da conta** para a busca de encaixe.
- **`/hoje` e `/semana` materializam a cada visita.** Correto e idempotente, mas
  é uma escrita por leitura de página.
- **Contraste de `#8B9691` sobre branco é 2,9:1**, abaixo do mínimo. Restrito a
  texto de 14px ou maior; ao vestir as telas do Plano 02, parte disso vira
  `#5D6B66`.
- **Direito do titular do dado (LGPD).** Guardamos nome, telefone e observação de
  gente que nunca consentiu conosco, quem coleta é o cliente. `delete` em
  `pessoa` leva `participacao` por cascade e apagaria o histórico do negócio;
  provavelmente é anonimizar preservando a linha. Decidir antes do primeiro
  pedido.
- **Observação de participação não separa quem enxerga.** Vira pré-requisito no
  primeiro cliente de saúde: "lesão no ombro" é dado de saúde, e recepção ver
  tudo é problema de LGPD, não de gosto.

---

## Versões

Next **16.3.0** · React **19.2.8** · Tailwind **4** · TypeScript **5** · Vitest
**4.1.10** · Playwright · Supabase CLI **2.114.0** · Node **24.18.0**.

## Como subir

```bash
npx supabase start           # local, no Docker, faixa 564xx
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Instalação nova, sem seed: a migration `0040` cria a conta interna, e
`node scripts/bootstrap-suporte.mjs <e-mail>` faz o primeiro usuário da 4YU. É
por aí que a tela de contas passa a existir.

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local` (este último é o único jeito de ver `/contas-4yu`), senha
`senha-de-teste-123`. **`supabase db reset` apaga o seed**, rode o semeador de
novo depois.

As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo `radar-ofertas`
e pelo `otimiza-gestor`; a Verandi usa **56421** (API), **56422** (banco) e
**56423** (studio).

## Armadilhas que já custaram tempo

- **O `alter default privileges` da `0030` é cinto e é faca.** Ele concede a
  `authenticated` tudo que nascer em `app_verandi` depois, inclusive tabela
  criada fora de migration. Foi assim que a `migrations_aplicadas` nasceu sem
  RLS e com `delete` liberado para qualquer usuário logado de qualquer cliente:
  bastava apagar uma linha para o aplicador rodar a migration de novo. Tabela
  que não é dado de conta precisa de `enable row level security` **e**
  `revoke all ... from anon, authenticated` explícitos. `service_role` passa
  por cima de RLS e continua alcançando.
- **O Brevo põe "Cancelar assinatura" em e-mail transacional, e não dá para
  desligar sozinho.** O cabeçalho `List-Unsubscribe` é obrigatório em tudo que
  sai por SMTP ou API, a documentação deles diz que campanha e transacional não
  se distinguem no fluxo, então o cabeçalho vai em todos. O caminho oficial é
  **abrir chamado no suporte do Brevo** pedindo a troca por `List-Help`, que não
  vira botão clicável. Enquanto isso: a assinante que clicar ali para de receber
  convite e redefinição de senha, e não vai ligar uma coisa à outra.
  O alívio é que o bloqueio de transacional é **por remetente**, não pela conta
  inteira. Quando alguém disser "não recebi", olhe a lista antes do código:
  `GET https://api.brevo.com/v3/smtp/blockedContacts`. Existe `DELETE` para
  desbloquear, mas desbloquear quem pediu para sair é problema jurídico, não
  técnico, use para diagnosticar, não para reverter.
- **Lista do Brevo é marketing; transacional não passa por lista.** Convite e
  senha vão por API para um endereço só. Se alguém propuser "uma lista com os
  usuários para mandar senha", é confusão entre os dois mundos, e enche a base
  de contato de gente que nunca consentiu com a 4YU.
  As listas que existem (pasta `Verandi`): **4** Donos de conta · **5**
  Interessados · **6** Onboarding em aberto. Nenhuma inclui equipe da conta
  (recepção, profissional) nem quem é atendido, e isso é decisão, não
  esquecimento: o e-mail dessa gente foi coletado pelo cliente, não por nós, e
  usá-lo para falar do nosso produto é problema de consentimento antes de ser
  de bom gosto.
- **Os quatro modelos na tela do Brevo são cópia, e nascem desativados.**
  `scripts/espelha-no-brevo.ts` os manda para lá só para dar para olhar o visual
  sem abrir o projeto; nada em produção envia usando eles. Editar por lá não
  muda e-mail nenhum, e é justamente por isso que ficam desativados e com
  `[cópia, editar no código]` no nome. Rode o script de novo depois de mexer em
  `src/core/email/`, senão a cópia envelhece. O `{{ .ConfirmationURL }}` vira um
  endereço de exemplo na cópia: é sintaxe do Supabase, e o Brevo tenta
  interpretar `{{ }}` com a linguagem dele e recusa o modelo com erro de parser
  numa linha que não diz nada.
- **Os templates de e-mail moram no código, não dentro do Brevo.** A conta lá
  tem **zero** templates de propósito: o HTML sai de `src/core/email/` no campo
  `htmlContent` a cada envio, e o Brevo é só o carteiro. É o que deixa o texto
  versionado, revisável em diff e coberto por teste, e é o que permite a lista
  "o que você vai poder fazer" mudar conforme o papel sem virar três templates
  para manter em sincronia. Se um dia alguém que não programa precisar editar
  copy, aí sim vale migrar, e o custo é ganhar uma segunda fonte de verdade.
- **`api.supabase.com` devolve 403 `error code: 1010` para cliente HTTP que não
  se parece com navegador ou curl.** É Cloudflare, não Supabase: a mensagem não
  cita token nem permissão, e manda procurar no lugar errado, o `urllib` do
  Python apanhou disso, e o mesmo pedido no `curl` passou. Mande um
  `User-Agent` explícito.
- **Cliente do Supabase novo precisa de `db: { schema: ESQUEMA }`.** São nove
  pontos de criação em quatro lugares que ninguém junta na cabeça: `src/server`,
  `scripts/*.mjs`, `tests/setup` e **`e2e/`**. Esquecer um não quebra o build nem
  o `tsc`, quebra em execução com `Could not find the table 'public.conta' in
  the schema cache`. Foi o `e2e/apoio.ts` que ficou para trás na primeira
  passada. O nome vem de `src/server/esquema.ts`; nos `.mjs` é repetido à mão,
  porque `.mjs` não importa `.ts`.
- **`GRANT` é camada separada de RLS.** Se o erro for `42501`, olhe o `grant`
  antes da política. Toda migration termina com o bloco de grants.
- **Insert em lote pelo PostgREST normaliza as linhas e não aplica o default da
  coluna.** Omitir uma chave em uma linha quebra o lote inteiro com `23502`.
  Regra: todas as linhas carregam as mesmas chaves.
- **Arquivo `'use server'` só exporta função async.** Constante ou função pura
  exportada de lá quebra o build, e o erro aponta para a rota, não para o
  arquivo. Mordeu três vezes; o lugar delas é o `core/`.
- **`security definer` sem `search_path` fixo** é escalada de privilégio à
  espera de acontecer.
- **View precisa de `security_invoker = true`**, senão passa por cima da RLS.
- **Coluna gerada exige função `IMMUTABLE`.**
- **Consulta do Supabase precisa de `.returns<T[]>()`** enquanto não houver tipos
  gerados; `.single()` sem genérico devolve `never`; retorno de `rpc` ainda
  precisa de `as unknown as`.
- **`middleware.ts` virou `proxy.ts`** no Next 16.
- **React reseta o formulário depois que a action termina.** Reler o `FormData`
  num segundo passo lê um formulário vazio: guarde o pedido em estado.
- **Data em `toISOString().slice(0, 10)` é UTC.** Depois das 21h em Brasília já é
  o dia seguinte. No servidor use `hojeEm(conta.fuso)`; no navegador,
  `toLocaleDateString('en-CA')`.
- **No teste, não navegue logo depois de clicar numa ação.** Ela roda numa
  transição, e sair da página no meio testa o estado anterior. Espere o efeito
  (`expect.poll` no banco, ou o sumiço do elemento). Mordeu três vezes.
- **O banco de teste não é limpo entre execuções.** Nome fixo em dado de teste
  vira seletor ambíguo na segunda rodada; use algo único.
- **A suíte e2e roda contra build de produção.** O `next dev` recompila cada rota
  e cresce sem devolver, passou de 1,7 GB numa suíte e derrubou o navegador por
  falta de memória. Em produção a mesma suíte caiu de 8,8 para 4,3 minutos.
- **No Playwright, `getByRole('alert')` colide com o anunciador de rota do
  Next.** Use o texto. E `getByLabel` não casa com `placeholder`.
- **`aria-label` não pode repetir o rótulo do campo nos botões vizinhos.** Os
  `−`/`+` de Padrões e os quatro botões de status da Sessão levavam o nome do
  campo (ou da pessoa) dentro do rótulo; com isso `getByLabel('Prazo da
  reposição')` casava com três elementos, e nem o teste nem o leitor de tela
  conseguiam apontar o campo. O contexto vem da ordem na linha, não da repetição.
- **Vestir tela quebra teste de propósito, e isso é contrato.** Os testes de
  navegador buscam por papel e por texto: mudar "Todos vieram" para "Marcar
  todos presentes" quebra dez deles. Atualizar o teste é certo, desde que o
  commit diga qual texto mudou e por quê.
- **`<dialog>` nativo não trava a rolagem da página.** Ele prende o foco e deixa
  o resto inerte, o que engana: a roda do mouse fora do card continua rolando o
  que está atrás, e o DESIGN-SYSTEM 4.7 proíbe isso em letras maiúsculas. Quem
  trava é a casca do modal, com contador (dois modais abertos não se destravam)
  e compensação da barra de rolagem (senão a página pula 15px ao abrir). Isso
  não aparece em `tsc` nem em teste: mede-se com `window.scrollY` depois de um
  `wheel`.
- **`listUsers()` do Supabase devolve só os 50 primeiros.** O banco de
  desenvolvimento não é limpo entre execuções, então `dono@dev.local` saiu da
  primeira página e o semeador passou a morrer com `Cannot read properties of
  null` — que era o `createUser` devolvendo `user: null` porque o e-mail já
  existia. Quem procura usuário por e-mail precisa virar as páginas.
- **O papel `suporte` mora na conta interna, nunca na de cliente.** O vínculo em
  conta de cliente é temporário e é apagado ao sair; se ele também respondesse
  por "é da 4YU", sair de uma conta tiraria o acesso a tudo. Foi assim que era.
- **Plano escrito não quer dizer plano certo.** A Tarefa 10 estava escrita como
  "entrar como `suporte@dev.local`" num banco sem seed, passo impossível, e
  ninguém tinha percebido porque a jornada nunca fora feita inteira.
- **Ler o código do protótipo não substitui abrir a tela dele.** Foi o erro que
  originou o `VESTIR.md`: tokens certos, telas genéricas. Rode os dois
  capturadores e compare 1440×1000 lado a lado.
