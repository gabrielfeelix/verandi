# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano — desde que se saiba disso.

**Última atualização:** 13/ago/2026 · **Planos 01 e 02 concluídos.**

## O que existe hoje

**Banco** — quatro migrations. `conta`, `usuario_conta`, `vocabulario`,
`pessoa`, `pessoa_tag`, `profissional`, `servico`, `local`, `serie`, `vaga`,
`sessao`, `participacao`, `excecao_calendario`, mais a view `pessoa_resumo`.
RLS ligada com política em todas, provada por teste.

**`core/`** — puro, sem import de banco, Next ou rede, verificado por `grep` no
fechamento de cada plano. Aritmética de data, expansão de série, ocupação,
encaixe, estado da chamada, vocabulário e destino por papel.

**`server/`** — cliente admin, conta ativa, vocabulário, materialização sob
demanda, consultas de agenda, ações de presença, consultas e ações de pessoa,
disponibilidade.

**Telas prontas:**

| Rota | O quê |
|---|---|
| `/entrar` | login, com destino por papel |
| `/contas` | trocar de conta (só aparece para quem tem mais de uma) |
| `/hoje` | agenda do dia, com chamada pendente em destaque |
| `/semana` | grade semanal; em celular vira um dia por vez |
| `/sessao/[id]` | **a tela do produto** — chamada em lote, encaixe, capacidade do dia, cancelamento |
| `/pessoas` | lista com busca sem acento e cinco filtros |
| `/pessoas/[id]` | ficha: dados, vagas, histórico, reposições em aberto |
| `/vaga` | busca de horário livre, com os cheios em lista separada |

**Ainda não existem** (Plano 03): `/grade` (editor de séries), `/config`,
`/convite`, `/pendencias`, e a tela de contas da 4YU. Até elas existirem, a
grade fixa é cadastrada por `scripts/semear-dev.mjs` ou direto no banco.

**Importador está fora do marco 1.** Escrever contra o formato de um cliente é a
consultoria com passo extra que o princípio do projeto proíbe. Volta quando
houver um segundo negócio migrando, que é a única forma de ver o que os formatos
têm em comum. Ver [PLANO.md](PLANO.md).

## Testes

| Suíte | Comando | Quantos |
|---|---|---|
| Unidade + integração | `npm test` | 99 |
| Navegador | `npm run test:e2e` | 25 |

Os de unidade rodam em menos de um segundo, sem banco.

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

As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo `radar-ofertas`
e pelo `otimiza-gestor`; a Verandi usa **56421** (API), **56422** (banco) e
**56423** (studio).

## Armadilhas que já custaram tempo

Coisas que a execução ensinou e que não estavam nos planos:

- **`GRANT` é camada separada de RLS.** Tabela criada por migration não recebe
  privilégio sozinha; sem `grant`, até a chave de serviço leva
  `42501 permission denied`. Se o erro for `42501`, olhe o `grant` antes de
  olhar a política. Toda migration termina com o bloco de grants.
- **Insert em lote pelo PostgREST normaliza as linhas para o mesmo conjunto de
  colunas, e preenche o que falta com `NULL` — o default da coluna não é
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
- **Consulta do Supabase precisa de `.returns<T[]>()`** enquanto não houver
  tipos do banco gerados, senão o `tsc` recusa com `GenericStringError`.
- **`middleware.ts` virou `proxy.ts`** no Next 16 (codemod oficial).
- **Dono e suporte enxergam o vínculo dos colegas na conta.** É proposital — são
  eles que gerenciam usuários. Por isso `contaAtiva()` filtra pelo próprio
  `usuario_id`.
- **No Playwright, `getByRole('alert')` colide com o anunciador de rota do
  Next.** Usar o texto. E depois de ação otimista, conferir o banco com
  `expect.poll` — sem isso o teste corre na frente da escrita.
- **`getByLabel` não casa com `placeholder`.**

## O que fazer em seguida

**Plano 03 — Configuração.** Ordem prevista: **Grade fixa** (editor de séries) →
**Configuração** (serviços, profissionais, locais, vocabulário, feriados) →
**Usuários e convite** → **Pendências** → **Contas da 4YU**.

Uma coisa depende de gente, não de código:

1. **Decidir onde o Supabase de produção vai morar.** A organização
   `4YU Systems` tem dois projetos ativos (`radar-ofertas`, `autofluxos`) e o
   `Otimiza Gestor` pausado, que é o teto do plano gratuito. As saídas são
   pausar um, abrir segunda organização, ou pagar Pro. Não bloqueia até o deploy.

Dívidas técnicas anotadas, que não bloqueiam:

- **Gerar os tipos do banco** (`supabase gen types typescript --local`) e tipar
  o cliente, para poder tirar os `.returns<T[]>()` espalhados.
- **O `PainelVaga` carrega todas as pessoas da conta** para a busca de encaixe.
  Funciona com 24 e com algumas centenas; com milhares, vira busca no servidor.
