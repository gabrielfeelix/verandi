# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano — desde que se saiba disso.

**Última atualização:** 13/ago/2026 · **Planos 01 e 02 concluídos. Plano 03 não
começou.**

---

## Em uma frase

O sistema opera de ponta a ponta — dá para entrar, ver a semana, abrir um horário
e registrar a chamada. **O que falta é a conta se configurar sozinha:** hoje a
grade fixa, os serviços e os profissionais só entram por script ou direto no
banco.

## Verificado agora

| O quê | Resultado |
|---|---|
| `npm run build` | limpo |
| `npm test` | **99 passaram** |
| `npm run test:e2e` | **25 passaram** |
| `core/` sem import de banco, Next ou rede | limpo |
| nenhuma tela com "Aluno"/"Turma"/"Paciente"/"Professor" fixo | limpo |
| `git status` | nada pendente, tudo empurrado |

---

## O que existe

**Banco** — quatro migrations, RLS com política em todas as tabelas, provada por
teste.

```
conta · usuario_conta · vocabulario
pessoa · pessoa_tag · profissional · servico · local
serie · vaga · sessao · participacao · excecao_calendario
view pessoa_resumo (security_invoker)
```

**`core/`** — puro, testável sem subir nada. Aritmética de data, expansão de
série em ocorrências, ocupação, encaixe, estado da chamada, vocabulário, destino
por papel.

**`server/`** — cliente admin, conta ativa, vocabulário, materialização sob
demanda, consultas de agenda, ações de presença, consultas e ações de pessoa,
disponibilidade.

**Telas:**

| Rota | O quê |
|---|---|
| `/entrar` | login, com destino decidido pelo papel |
| `/contas` | trocar de conta (só aparece para quem tem mais de uma) |
| `/hoje` | agenda do dia, com chamada pendente em destaque |
| `/semana` | grade semanal; em celular vira um dia por vez |
| `/sessao/[id]` | **a tela do produto** — chamada em lote, encaixe, capacidade do dia, cancelamento |
| `/pessoas` | lista com busca sem acento e cinco filtros |
| `/pessoas/[id]` | ficha: dados, vagas, histórico, reposições em aberto |
| `/vaga` | busca de horário livre, com os cheios em lista separada |

---

## O que falta

### Plano 03 — Configuração (o próximo)

É o que falta para uma conta nascer e operar **sem ninguém da 4YU tocar no
banco**. Nenhuma dessas telas existe ainda:

| Tela | Serve para |
|---|---|
| `/grade` | criar e manter as séries: horário, serviço, profissional, local, capacidade, vigência. Precisa de duplicar e de criar em vários dias de uma vez — montar 70 horários na mão é o pior momento do cliente com o produto |
| `/config` | serviços, profissionais, locais, **vocabulário**, funcionamento e feriados |
| `/config` (usuários) | convidar, mudar papel, remover |
| `/convite/[token]` | aceitar convite e definir senha |
| `/pendencias` | o inbox de quem opera: chamada não feita, reposição em aberto, reserva esperando, plano vencendo, cadastro incompleto |
| `/contas` (4YU) | criar conta de cliente, entrar como suporte com faixa visível, sinais de vida |

**Critério de pronto:** criar uma conta vazia pela tela, montar a grade, convidar
quem vai usar, e operar a semana. Sem `psql`, sem script de seed.

### Marco 2 — o bot conversa com a agenda

Só depois do marco 1 em uso real. Nada disso exige tabela nova.

- **API v1** — `/disponibilidade`, `/pessoa`, `/agendamento`, `/presenca`,
  `/catalogo`, com token por conta. A lógica de disponibilidade **já existe** em
  `server/agenda/disponibilidade.ts` e é a mesma que a tela usa, de propósito.
- **Eventos de saída** — tabela outbox, webhook assinado para o AutoFluxos,
  e-mail pelo Resend
- **Notificações** — cancelamento e lembrete
- **Confirmação por bot** — a pessoa avisa que não vai e a vaga abre sozinha
  (`falta_avisada` já libera a vaga no `core/`)
- **Lista de espera** — aviso automático quando abre vaga

### Marco 3 — segundo cliente sem tocar em código

Encaixar um negócio de outro ramo usando só configuração. Se em algum momento a
resposta for "precisa mudar o código", isso é **sinal de alerta, não tarefa**.

### Fora de escopo, e por quê

| O quê | Por quê |
|---|---|
| **Importador de planilha** | Escrever contra o formato de um cliente é a consultoria com passo extra que o princípio proíbe. Volta quando houver um segundo negócio migrando — é a única forma de ver o que os formatos têm em comum |
| Financeiro, cobrança, contrato | Outro produto. `pessoa` guarda vencimento como data, para avisar |
| Aplicativo de quem é atendido | O WhatsApp é o app dela |
| Conteúdo, vídeo, comunidade | Não é agendamento |
| Relatórios | Depois que houver dado real para relatar |

---

## Decisão pendente, de gente

**Onde o Supabase de produção vai morar.** A organização `4YU Systems` tem dois
projetos ativos (`radar-ofertas`, `autofluxos`) e o `Otimiza Gestor` pausado —
que é o teto do plano gratuito. Saídas: pausar um, abrir segunda organização, ou
pagar Pro. **Não bloqueia nada até o deploy.**

## Dívidas técnicas anotadas

Nenhuma bloqueia:

- **Gerar os tipos do banco** (`supabase gen types typescript --local`) e tipar o
  cliente, para tirar os `.returns<T[]>()` espalhados.
- **O `PainelVaga` carrega todas as pessoas da conta** para a busca de encaixe.
  Funciona com dezenas e com centenas; com milhares, vira busca no servidor.
- **`/hoje` e `/semana` materializam a cada visita.** Correto e idempotente, mas
  é uma escrita por leitura de página. Se pesar, cachear a janela já
  materializada.

---

## Versões

Next **16.3.0** · React **19.2.8** · Tailwind **4** · TypeScript **5**
(target ES2022) · Vitest **4.1.10** · Playwright · Supabase CLI **2.114.0** ·
Node **24.18.0** · Docker **29.6.1**.

## Como subir

```bash
npx supabase start           # local, no Docker — faixa 564xx
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Entrar com `dono@dev.local`, `prof@dev.local` ou `recepcao@dev.local`, senha
`senha-de-teste-123`.

As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo `radar-ofertas` e
pelo `otimiza-gestor`; a Verandi usa **56421** (API), **56422** (banco) e
**56423** (studio).

## Armadilhas que já custaram tempo

Coisas que a execução ensinou e que não estavam nos planos:

- **`GRANT` é camada separada de RLS.** Tabela criada por migration não recebe
  privilégio sozinha; sem `grant`, até a chave de serviço leva
  `42501 permission denied`. Se o erro for `42501`, olhe o `grant` antes de olhar
  a política. Toda migration termina com o bloco de grants.
- **Insert em lote pelo PostgREST normaliza as linhas para o mesmo conjunto de
  colunas e preenche o que falta com `NULL` — o default da coluna não é
  aplicado.** Omitir `status` ou `ativo` em uma linha só quebra o lote inteiro
  com `23502`. **Mordeu duas vezes.** Regra: em insert em lote, todas as linhas
  carregam as mesmas chaves.
- **`ON CONFLICT` não usa índice único parcial** sem repetir o predicado, e o
  PostgREST não manda predicado. Por isso `sessao (serie_id, inicio)` é
  constraint simples — nulo é distinto de nulo, então sessão avulsa segue livre.
- **View precisa de `security_invoker = true`**, senão roda com os direitos de
  quem criou e passa por cima da RLS. `pessoa_resumo` depende disso.
- **Coluna gerada exige função `IMMUTABLE`.** `unaccent()` de um argumento é
  `STABLE`; a forma de dois argumentos, com dicionário fixo, dá para marcar
  immutable — é como `pessoa.nome_busca` funciona.
- **Consulta do Supabase precisa de `.returns<T[]>()`** enquanto não houver tipos
  do banco gerados, senão o `tsc` recusa com `GenericStringError`.
- **`middleware.ts` virou `proxy.ts`** no Next 16 (codemod oficial).
- **Dono e suporte enxergam o vínculo dos colegas na conta.** É proposital — são
  eles que gerenciam usuários. Por isso `contaAtiva()` filtra pelo próprio
  `usuario_id`.
- **No Playwright, `getByRole('alert')` colide com o anunciador de rota do
  Next.** Usar o texto. Depois de ação otimista, conferir o banco com
  `expect.poll` — sem isso o teste corre na frente da escrita. E o timeout de
  espera é 15s porque o `next dev` compila a rota na primeira visita.
- **`getByLabel` não casa com `placeholder`.**
