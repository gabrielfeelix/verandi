# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano — desde que se saiba disso.

**Última atualização:** 13/ago/2026 · **Planos 01 e 02 concluídos. Plano 03 nas
Tarefas 0 a 9 — falta o fechamento e vestir as telas do Plano 02.**

---

## Em uma frase

Uma conta nasce vazia, se configura inteira pela tela e opera a semana. O que
falta é **cara**: as oito telas do Plano 02 ainda estão com a casca crua, e o
protótipo virou a especificação.

## Verificado agora

| O quê | Resultado |
|---|---|
| `npm run build` | limpo |
| `npm test` | **209 passaram** |
| `npm run test:e2e` | **87 passaram** |
| `core/` sem import de banco, Next ou rede | limpo |
| nenhuma tela com "Aluno"/"Turma"/"Paciente"/"Professor" fixo | limpo |
| nenhum "hoje" calculado em UTC no servidor | limpo |

---

## O que existe

**Banco** — nove migrations, RLS com política em todas as tabelas, provada por
teste.

```
conta (com os padrões da operação) · usuario_conta · vocabulario · convite
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

**Design system** — `docs/DESIGN.md` é o contrato; `/amostra` mostra as nove
peças em todas as variações. O protótipo em `Design system Verandi/` é a
especificação de interface: onde a tela divergir dele, é a tela que muda.

**Telas:**

| Rota | O quê | Vestida? |
|---|---|---|
| `/entrar` | login, com destino por papel | não |
| `/contas` | trocar de conta | não |
| `/hoje` · `/semana` | agenda do dia e da semana | não |
| `/sessao/[id]` | a tela do produto — chamada, encaixe, capacidade | não |
| `/pessoas` · `/pessoas/[id]` | lista, busca e ficha | não |
| `/vaga` | busca de horário livre | não |
| `/grade` | criar, editar, duplicar e encerrar horário fixo | parcial |
| `/config` | serviços, equipe, locais, padrões, vocabulário, funcionamento, usuários | sim |
| `/pendencias` | o inbox de quem opera | sim |
| `/contas-4yu` | contas dos clientes, com sinais de vida | sim |
| `/convite/[token]` | aceitar convite e definir senha | sim |
| `/amostra` | os primitivos do design system | — |

---

## O que falta

### Plano 03 — o que sobrou

- **Tarefa 10, fechamento:** a prova manual de ponta a ponta (criar conta →
  aceitar convite → cadastrar → montar grade → convidar recepção → registrar
  chamada), sem `psql` e sem seed.
- **Tarefa 11, vestir — leia [`VESTIR.md`](VESTIR.md) antes de começar.** As
  telas usam os tokens e **não parecem o protótipo**: o shell ainda é o
  `<header>` de links do Plano 02, e nenhuma tela vai parecer o produto enquanto
  ele não virar o trilho lateral. `node scripts/tira-prototipo.mjs` gera as
  capturas para comparar. Depois do shell vêm as oito telas do Plano 02, o modo
  **Dia por recurso** na grade (colunas = sala ou profissional, para quem tem
  sete salas), o filtro por local, e o menu por pessoa na Sessão (observação,
  apontar reposição, trocar origem) — o modelo já aguenta os três, a tela é que
  não expõe.

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

**Onde o Supabase de produção vai morar.** A organização `4YU Systems` está no
teto do plano gratuito. Não bloqueia nada até o deploy.

## Dívidas técnicas anotadas

- **Gerar os tipos do banco** (`supabase gen types typescript --local`) para
  tirar os `.returns<T[]>()` e os `as unknown as` espalhados.
- **`/contas-4yu` lista todas as contas sem paginação nem busca.** Com dezenas
  de clientes vai bem; com centenas, não.
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

Entrar com `dono@dev.local`, `prof@dev.local` ou `recepcao@dev.local`, senha
`senha-de-teste-123`. **`supabase db reset` apaga o seed** — rode o semeador de
novo depois.

As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo `radar-ofertas`
e pelo `otimiza-gestor`; a Verandi usa **56421** (API), **56422** (banco) e
**56423** (studio).

## Armadilhas que já custaram tempo

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
