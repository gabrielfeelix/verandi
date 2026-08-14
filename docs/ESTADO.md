# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano — desde que se saiba disso.

**Última atualização:** 13/ago/2026 · **Plano 03 fechado: a Tarefa 10 foi feita
de ponta a ponta em banco virgem, e os dois defeitos que ela achou estão
corrigidos.**

---

## Em uma frase

Uma conta nasce vazia, se configura inteira pela tela e opera a semana — com a
cara do protótipo, e agora com a jornada inteira provada à mão num banco sem
uma linha.

## O próximo passo, em ordem

1. **As dívidas técnicas**, na seção mais abaixo. A de LGPD é decisão de modelo
   e vale resolver antes do primeiro cliente; a de paginação em `/contas-4yu` já
   dói no banco de desenvolvimento.
2. **Marco 2** — API v1 para o AutoFluxos, eventos de saída, e-mail, confirmação
   por bot. Nada disso exige tabela nova.

## A Tarefa 10, e o que ela achou

A jornada inteira, sem `psql` e sem seed, num banco recém-resetado: suporte
entra → cria a conta em `/contas-4yu` → copia o convite → o dono define a senha
→ cadastra serviço, profissional e local em `/config` → monta uma grade de três
dias em `/grade` → convida uma recepção → cadastra uma pessoa → cria a vaga na
ficha → registra a chamada em `/sessao/[id]`, que termina em **"Chamada feita"**.
Treze passos, todos pela tela.

Dois defeitos apareceram, e nenhum teste os pegava — os dois viviam no espaço
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
na conta"** do convite não entra — leva a `/entrar?novo=1`, com o texto trocado
mas sem o e-mail preenchido.

## Verificado agora

| O quê | Resultado |
|---|---|
| `npm run build` | limpo |
| `npm test` | **218 passaram** |
| `npm run test:e2e` | **94 passaram** |
| tabelas em `app_verandi` · em `public` | **20 · 0** |
| Tarefa 10, jornada inteira em banco virgem | 13 passos, terminou em "Chamada feita" |
| `core/` sem import de banco, Next ou rede | limpo |
| nenhuma tela com "Aluno"/"Turma"/"Paciente"/"Professor" fixo | limpo |
| nenhum "hoje" calculado em UTC no servidor | limpo |

---

## O que existe

**Banco** — onze migrations (`0030_vr_`–`0040_vr_`), RLS com política em todas as
tabelas, provada por teste. **Tudo mora no schema `app_verandi`, não em
`public`** — o porquê está inteiro em `migrations/0030_vr_schema_app_verandi.sql`.

```
conta (com os padrões da operação; `interna` marca a conta da própria 4YU)
usuario_conta · vocabulario · convite
pessoa · pessoa_tag · profissional · profissional_servico · servico · local
serie · vaga · sessao · participacao · excecao_calendario
funcionamento · pendencia_dispensada · acesso_suporte · log_configuracao
view pessoa_resumo · função usuarios_da_conta (security definer)
balde privado foto-profissional
```

**`core/`** — puro, testável sem subir nada. Aritmética de data, expansão de
série, ocupação, encaixe, estado da chamada, vocabulário, destino por papel,
manutenção de série (linhas em lote, colisão, alcance da edição, sessões órfãs),
estado de convite, papéis concedíveis.

**Vestir as telas** — fechado. As doze telas foram comparadas com o protótipo e
corrigidas. O que ficou de fora são seis blocos do protótipo que dependem de dado
que ainda não existe (busca guardada, log por pessoa, SMTP, hora do aviso, plano
da conta, integrações) — a lista, o método e as armadilhas estão em
[`planos/04-vestir-telas.md`](planos/04-vestir-telas.md) — **leia antes de mexer
em tela**.

**Design system** — `docs/DESIGN.md` é o contrato; `/amostra` mostra as nove
peças em todas as variações. `Design system Verandi-att/DESIGN-SYSTEM.md` é a
especificação de interface: onde a tela divergir dele, é a tela que muda. O
método de comparação está em [`VESTIR.md`](VESTIR.md), e as duas capturas saem
de `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`.

**Três divergências do protótipo, de propósito**, cada uma escrita no commit que
a criou: alvo de toque de 44px onde o protótipo desenha 34px (a Sessão é usada
em pé); etiqueta de ocupação só fica laranja **acima** da capacidade, como o
protótipo renderiza — turma cheia é estado normal do dia; e a busca global do
cabeçalho fica reservada e desabilitada, porque a funcionalidade não existe e
inventá-la seria pior do que deixá-la faltando.

**Telas:**

| Rota | O quê | Vestida? |
|---|---|---|
| `/entrar` | login, com destino por papel | sim |
| `/contas` | trocar de conta | sim |
| `/hoje` | agenda do dia, com a próxima turma em destaque | sim |
| `/semana` | grade da semana **e o modo Dia por recurso** | sim |
| `/sessao/[id]` | a tela do produto — chamada, encaixe, capacidade, menu por pessoa | sim |
| `/pessoas` · `/pessoas/[id]` | lista, busca e ficha | sim |
| `/vaga` | busca de horário livre | sim |
| `/grade` | criar, editar, duplicar e encerrar horário fixo | sim |
| `/config` | serviços, equipe, locais, padrões, vocabulário, funcionamento, usuários | sim |
| `/pendencias` | o inbox de quem opera | sim |
| `/contas-4yu` | contas dos clientes, com sinais de vida | sim |
| `/convite/[token]` | aceitar convite e definir senha | sim |
| `/amostra` | os primitivos do design system | — |

---

## O que falta

### Plano 03 — fechado

- **Tarefa 10: feita.** A jornada inteira pela tela, num banco virgem. O que ela
  achou está na seção lá em cima.
- **Tarefa 11, vestir: feita.** O trilho lateral escuro substituiu a barra de
  links, e as doze telas foram refeitas contra a captura do protótipo. Entraram
  junto as três coisas que o modelo aguentava e a tela não expunha: o **menu por
  pessoa** na Sessão (observação, apontar reposição, trocar origem, remover), o
  modo **Dia por recurso** em `/semana` (colunas = sala ou profissional) e o
  **filtro por local**. O método está em [`VESTIR.md`](VESTIR.md); as capturas
  saem de `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`.

### Marco 2 — o bot conversa com a agenda

API v1, eventos de saída (outbox + webhook + Resend), notificações, confirmação
por bot, lista de espera. Nada disso exige tabela nova. O e-mail entra aqui, e
então convite e redefinição de senha ganham um segundo caminho — o token já
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
importa: `temVagaParaOferecer` — busca de vaga e API do robô — continua
recusando horário cheio, e isso não é configurável. A recepção decide olhando
para quem está na frente dela; o robô não decide nada.

**O protótipo virou a especificação de interface.** Ver a revisão de 13/ago em
`docs/planos/03-configuracao.md`.

**Convite e redefinição de senha não dependem de e-mail.** O dono copia o link
da tela. Sem isso, toda senha esquecida na primeira semana seria um chamado para
a 4YU com a chave de serviço na mão.

## Decisão pendente, de gente

**Onde o Supabase de produção vai morar — resolvido por ora: dividido com o
AutoFluxos.** O plano gratuito dá **dois projetos por conta**, não por
organização (criar org nova não ajuda — verificado), e `radar-ofertas` e
`autofluxos` já ocupam os dois. Então a Verandi mora no schema `app_verandi`
dentro do projeto do AutoFluxos.

O que isso custa, escrito para ninguém se assustar depois: **não há backup** no
plano gratuito, e restaurar é do banco inteiro — acidente num produto leva o
outro junto. É aceitável enquanto não há cliente pagante e deixa de ser no dia
que houver.

A saída já está desenhada e é barata, porque schema separa de verdade: restaura
o dump num projeto novo, `drop schema app_autofluxos cascade` lá,
`drop schema app_verandi cascade` no velho. Sobra apagar de `auth.users` quem
não tem vínculo — os dois projetos herdam todos os usuários.

## Dívidas técnicas anotadas

- **Gerar os tipos do banco** (`supabase gen types typescript --local`) para
  tirar os `.returns<T[]>()` e os `as unknown as` espalhados.
- **`/contas-4yu` lista todas as contas sem paginação nem busca.** Com dezenas
  de clientes vai bem; com centenas, não — e o banco de desenvolvimento já
  mostra o defeito, porque as contas que os testes deixam para trás passaram de
  mil linhas na tela.
- **`PainelVaga` carrega todas as pessoas da conta** para a busca de encaixe.
- **`/hoje` e `/semana` materializam a cada visita.** Correto e idempotente, mas
  é uma escrita por leitura de página.
- **Contraste de `#8B9691` sobre branco é 2,9:1**, abaixo do mínimo. Restrito a
  texto de 14px ou maior; ao vestir as telas do Plano 02, parte disso vira
  `#5D6B66`.
- **Direito do titular do dado (LGPD).** Guardamos nome, telefone e observação de
  gente que nunca consentiu conosco — quem coleta é o cliente. `delete` em
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
npx supabase start           # local, no Docker — faixa 564xx
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Instalação nova, sem seed: a migration `0040` cria a conta interna, e
`node scripts/bootstrap-suporte.mjs <e-mail>` faz o primeiro usuário da 4YU. É
por aí que a tela de contas passa a existir.

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local` (este último é o único jeito de ver `/contas-4yu`), senha
`senha-de-teste-123`. **`supabase db reset` apaga o seed** — rode o semeador de
novo depois.

As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo `radar-ofertas`
e pelo `otimiza-gestor`; a Verandi usa **56421** (API), **56422** (banco) e
**56423** (studio).

## Armadilhas que já custaram tempo

- **Cliente do Supabase novo precisa de `db: { schema: ESQUEMA }`.** São nove
  pontos de criação em quatro lugares que ninguém junta na cabeça: `src/server`,
  `scripts/*.mjs`, `tests/setup` e **`e2e/`**. Esquecer um não quebra o build nem
  o `tsc` — quebra em execução com `Could not find the table 'public.conta' in
  the schema cache`. Foi o `e2e/apoio.ts` que ficou para trás na primeira
  passada. O nome vem de `src/server/esquema.ts`; nos `.mjs` é repetido à mão,
  porque `.mjs` não importa `.ts`.
- **`GRANT` é camada separada de RLS.** Se o erro for `42501`, olhe o `grant`
  antes da política. Toda migration termina com o bloco de grants.
- **Insert em lote pelo PostgREST normaliza as linhas e não aplica o default da
  coluna.** Omitir uma chave em uma linha quebra o lote inteiro com `23502`.
  Regra: todas as linhas carregam as mesmas chaves.
- **Arquivo `'use server'` só exporta função async.** Constante ou função pura
  exportada de lá quebra o build — e o erro aponta para a rota, não para o
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
  e cresce sem devolver — passou de 1,7 GB numa suíte e derrubou o navegador por
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
  todos presentes" quebra dez deles. Atualizar o teste é certo — desde que o
  commit diga qual texto mudou e por quê.
- **O papel `suporte` mora na conta interna, nunca na de cliente.** O vínculo em
  conta de cliente é temporário e é apagado ao sair; se ele também respondesse
  por "é da 4YU", sair de uma conta tiraria o acesso a tudo. Foi assim que era.
- **Plano escrito não quer dizer plano certo.** A Tarefa 10 estava escrita como
  "entrar como `suporte@dev.local`" num banco sem seed — passo impossível, e
  ninguém tinha percebido porque a jornada nunca fora feita inteira.
- **Ler o código do protótipo não substitui abrir a tela dele.** Foi o erro que
  originou o `VESTIR.md`: tokens certos, telas genéricas. Rode os dois
  capturadores e compare 1440×1000 lado a lado.
