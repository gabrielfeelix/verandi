# Plano 01 — Fundação

> **Para quem executa:** use `superpowers:subagent-driven-development` (recomendado)
> ou `superpowers:executing-plans` para tocar tarefa por tarefa. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** deixar de pé o projeto, o banco com isolamento entre clientes
provado por teste, a matemática de agenda coberta por teste unitário, e o login
levando cada papel para o lugar certo.

**Arquitetura:** Next.js App Router com um `core/` puro que não importa banco nem
framework — toda a lógica de recorrência, ocupação e encaixe vive lá e roda em
milissegundos sem subir nada. O banco é Postgres pelo Supabase, com `conta_id` em
toda tabela de domínio e RLS com política desde a primeira migration. A sessão de
agenda é materializada sob demanda, com a concorrência resolvida por constraint.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Vitest · Supabase CLI
2.114.0 rodando local no Docker 29.6.1 · Node 24.18.0.

**Spec:** [`../ARQUITETURA.md`](../ARQUITETURA.md) e [`../TELAS.md`](../TELAS.md)

## Restrições globais

- **`src/core/` não importa nada** de `app/`, `server/`, `@supabase/*` ou `next`.
  Só TypeScript puro. Qualquer import fora dessa regra é falha de revisão.
- **Datas no `core/` são strings ISO `YYYY-MM-DD` e horas são `HH:MM`.** O `core/`
  nunca instancia fuso horário. Conversão para `timestamptz` é trabalho do
  `server/`, usando `conta.fuso`.
- **Toda tabela de domínio tem `conta_id`** e RLS ligada **com política**.
- **Nomes de domínio em português e neutros:** `conta`, `pessoa`, `profissional`,
  `servico`, `local`, `serie`, `vaga`, `sessao`, `participacao`. Nunca `aluno`,
  `turma`, `professor`, `paciente`, `matricula`.
- **TypeScript em `strict: true`.**
- **Nunca commitar `.env*` nem `*.xlsx`.** As planilhas têm nome, telefone e
  nascimento de gente real.
- Um commit por tarefa, no mínimo.

---

## Estrutura de arquivos

```
verandi/
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 0001_conta.sql          conta · usuario_conta · vocabulario · RLS
│       ├── 0002_cadastros.sql      pessoa · pessoa_tag · profissional · servico · local
│       └── 0003_agenda.sql         serie · vaga · sessao · participacao · excecao_calendario
├── src/
│   ├── core/
│   │   ├── agenda/
│   │   │   ├── tipos.ts            os tipos do domínio de agenda
│   │   │   ├── datas.ts            aritmética de data em string ISO
│   │   │   ├── expandir.ts         série + intervalo + exceções → ocorrências
│   │   │   ├── ocupacao.ts         quantas vagas restam
│   │   │   └── encaixe.ts          cabe mais um? excede?
│   │   └── vocabulario/
│   │       ├── padrao.ts           os rótulos neutros
│   │       └── rotulo.ts           resolve o rótulo da conta
│   ├── server/
│   │   ├── supabase.ts             clientes (navegador, servidor, admin)
│   │   ├── conta.ts                conta ativa e papel do usuário
│   │   └── agenda/
│   │       └── materializar.ts     cria as sessões da janela, idempotente
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx                redireciona pelo papel
│       └── entrar/page.tsx
└── tests/
    ├── setup/supabase.ts           lê o ambiente do Supabase local
    ├── rls.test.ts                 prova o isolamento entre contas
    └── materializar.test.ts        prova a idempotência
```

---

### Tarefa 1: Projeto de pé

**Arquivos:**
- Criar: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`,
  `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`
- Criar: `supabase/config.toml` (gerado pela CLI)
- Criar: `src/core/agenda/datas.ts`, `tests/unit/datas.test.ts`

**Interfaces:**
- Consome: nada
- Produz: `diaDaSemanaDe(dataIso: string): number` e
  `somarDias(dataIso: string, n: number): string` em `src/core/agenda/datas.ts`

- [ ] **Passo 1: Criar o projeto Next.js**

```bash
cd /home/gabfelix/dev/4yu-apps/verandi
npx create-next-app@latest . --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Responder **não** a sobrescrever arquivos existentes se perguntar sobre
`.gitignore`. Depois, conferir que `docs/`, `handoff` e `planilhas/` continuam lá.

- [ ] **Passo 2: Anotar a versão instalada**

```bash
node -e "const p=require('./package.json');console.log('next',p.dependencies.next,'| react',p.dependencies.react)"
```

Copiar a saída para `docs/ESTADO.md` na seção "versões". O plano não fixa a
versão do Next porque `create-next-app@latest` decide; o que precisa existir é o
registro do que foi instalado.

- [ ] **Passo 3: Instalar Vitest e o cliente do Supabase**

```bash
npm i -D vitest @vitest/coverage-v8
npm i @supabase/supabase-js @supabase/ssr
```

- [ ] **Passo 4: Configurar o Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
```

Acrescentar em `package.json`, dentro de `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Passo 5: Garantir `strict` no TypeScript**

Conferir que `tsconfig.json` tem `"strict": true` em `compilerOptions`. O
`create-next-app` já põe; se não estiver, acrescentar.

- [ ] **Passo 6: Escrever o teste da aritmética de data (vai falhar)**

Criar `tests/unit/datas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diaDaSemanaDe, somarDias } from '@/core/agenda/datas'

describe('diaDaSemanaDe', () => {
  it('domingo é 0 e sábado é 6', () => {
    expect(diaDaSemanaDe('2026-08-09')).toBe(0)
    expect(diaDaSemanaDe('2026-08-15')).toBe(6)
  })

  it('não muda de dia por causa de fuso', () => {
    // 1 de março de 2026 é um domingo em qualquer fuso do Brasil
    expect(diaDaSemanaDe('2026-03-01')).toBe(0)
  })
})

describe('somarDias', () => {
  it('anda para frente', () => {
    expect(somarDias('2026-08-12', 1)).toBe('2026-08-13')
  })

  it('atravessa a virada do mês', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('atravessa a virada do ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('anda para trás', () => {
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})
```

- [ ] **Passo 7: Rodar e ver falhar**

Rodar: `npm test -- tests/unit/datas.test.ts`
Esperado: FALHA com "Failed to resolve import ... core/agenda/datas".

- [ ] **Passo 8: Implementar**

Criar `src/core/agenda/datas.ts`:

```ts
/**
 * Aritmética de data em string ISO `YYYY-MM-DD`.
 *
 * Tudo aqui passa por UTC de propósito: o `core/` não conhece fuso. Quem
 * converte data local em instante absoluto é o `server/`, usando `conta.fuso`.
 * Instanciar `new Date('2026-08-12')` sem o `T00:00:00Z` faz o Node interpretar
 * no fuso da máquina, e no Brasil isso volta um dia.
 */
export function diaDaSemanaDe(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

export function somarDias(dataIso: string, n: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Passo 9: Rodar e ver passar**

Rodar: `npm test -- tests/unit/datas.test.ts`
Esperado: PASSA, 6 testes.

- [ ] **Passo 10: Subir o Supabase local**

```bash
npx supabase init
npx supabase start
```

A primeira vez baixa as imagens e demora. Ao final, a CLI imprime as URLs e as
chaves. Guardar a saída:

```bash
npx supabase status -o env > .env.local.supabase
echo ".env.local.supabase" >> .gitignore
```

- [ ] **Passo 11: Commitar**

```bash
git add -A
git commit -m "chore: projeto next, vitest e supabase local de pé"
```

---

### Tarefa 2: Conta, papéis e vocabulário, com RLS provada

**Arquivos:**
- Criar: `supabase/migrations/0001_conta.sql`
- Criar: `tests/setup/supabase.ts`
- Criar: `tests/rls.test.ts`

**Interfaces:**
- Consome: nada
- Produz: as tabelas `conta`, `usuario_conta`, `vocabulario`; o tipo enum `papel`;
  e as funções SQL `public.contas_do_usuario()` e
  `public.tem_papel(conta uuid, papeis papel[])`, das quais toda política das
  migrations seguintes depende.

- [ ] **Passo 1: Escrever a migration**

Criar `supabase/migrations/0001_conta.sql`:

```sql
create extension if not exists pgcrypto;

create type papel as enum ('dono', 'recepcao', 'profissional', 'suporte');

create table conta (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  slug      text not null unique,
  fuso      text not null default 'America/Sao_Paulo',
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table usuario_conta (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  conta_id   uuid not null references conta (id) on delete cascade,
  papel      papel not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, conta_id)
);

create table vocabulario (
  conta_id uuid not null references conta (id) on delete cascade,
  chave    text not null check (chave in
             ('pessoa','profissional','servico','local','serie','sessao','vaga')),
  singular text not null,
  plural   text not null,
  primary key (conta_id, chave)
);

-- security definer para não cair em recursão: a política de `pessoa` consulta
-- `usuario_conta`, que também tem RLS. A função roda com os direitos do dono e
-- corta o laço. `search_path` fixo é obrigatório em security definer.
create or replace function public.contas_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select conta_id from public.usuario_conta
   where usuario_id = auth.uid() and ativo
$$;

create or replace function public.tem_papel(p_conta uuid, p_papeis papel[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.usuario_conta
     where usuario_id = auth.uid()
       and conta_id = p_conta
       and ativo
       and papel = any (p_papeis)
  )
$$;

alter table conta          enable row level security;
alter table usuario_conta  enable row level security;
alter table vocabulario    enable row level security;

create policy conta_le on conta
  for select using (id in (select public.contas_do_usuario()));

create policy conta_escreve on conta
  for update using (public.tem_papel(id, array['dono','suporte']::papel[]))
           with check (public.tem_papel(id, array['dono','suporte']::papel[]));

create policy usuario_conta_le on usuario_conta
  for select using (usuario_id = auth.uid() or
                    public.tem_papel(conta_id, array['dono','suporte']::papel[]));

create policy usuario_conta_escreve on usuario_conta
  for all using (public.tem_papel(conta_id, array['dono','suporte']::papel[]))
      with check (public.tem_papel(conta_id, array['dono','suporte']::papel[]));

create policy vocabulario_le on vocabulario
  for select using (conta_id in (select public.contas_do_usuario()));

create policy vocabulario_escreve on vocabulario
  for all using (public.tem_papel(conta_id, array['dono','suporte']::papel[]))
      with check (public.tem_papel(conta_id, array['dono','suporte']::papel[]));
```

- [ ] **Passo 2: Aplicar e conferir que sobe**

```bash
npx supabase db reset
```

Esperado: aplica `0001_conta.sql` sem erro.

- [ ] **Passo 3: Escrever o ajudante de teste**

Criar `tests/setup/supabase.ts`:

```ts
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Lê as chaves do Supabase local em vez de fixá-las: a CLI pode mudá-las. */
function ambiente(): Record<string, string> {
  const saida = execSync('npx supabase status -o env', { encoding: 'utf8' })
  const env: Record<string, string> = {}
  for (const linha of saida.split('\n')) {
    const m = linha.match(/^([A-Z_]+)="?([^"]*)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = ambiente()
export const URL = env.API_URL ?? 'http://127.0.0.1:54321'
export const CHAVE_ANON = env.ANON_KEY
export const CHAVE_ADMIN = env.SERVICE_ROLE_KEY

export function admin(): SupabaseClient {
  return createClient(URL, CHAVE_ADMIN, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cria um usuário confirmado e devolve um cliente autenticado como ele. */
export async function comoUsuario(email: string, senha = 'senha-de-teste-123') {
  const a = admin()
  const { data, error } = await a.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw error

  const cliente = createClient(URL, CHAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({
    email,
    password: senha,
  })
  if (erroLogin) throw erroLogin

  return { cliente, usuarioId: data.user!.id }
}
```

- [ ] **Passo 4: Escrever o teste de isolamento (vai falhar)**

Criar `tests/rls.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

describe('isolamento entre contas', () => {
  let contaA: string
  let contaB: string
  let clienteA: Awaited<ReturnType<typeof comoUsuario>>['cliente']

  beforeAll(async () => {
    const a = admin()
    const marca = Date.now()

    const { data: cA } = await a.from('conta')
      .insert({ nome: 'Estúdio A', slug: `a-${marca}` }).select().single()
    const { data: cB } = await a.from('conta')
      .insert({ nome: 'Salão B', slug: `b-${marca}` }).select().single()
    contaA = cA!.id
    contaB = cB!.id

    const usuarioA = await comoUsuario(`dono-a-${marca}@teste.local`)
    clienteA = usuarioA.cliente
    await a.from('usuario_conta').insert({
      usuario_id: usuarioA.usuarioId, conta_id: contaA, papel: 'dono',
    })

    await a.from('vocabulario').insert([
      { conta_id: contaA, chave: 'pessoa', singular: 'Aluno',   plural: 'Alunos' },
      { conta_id: contaB, chave: 'pessoa', singular: 'Cliente', plural: 'Clientes' },
    ])
  })

  it('o usuário enxerga a conta dele', async () => {
    const { data } = await clienteA.from('conta').select('id')
    expect(data?.map((c) => c.id)).toEqual([contaA])
  })

  it('o usuário NÃO enxerga a conta do outro', async () => {
    const { data } = await clienteA.from('conta').select('id').eq('id', contaB)
    expect(data).toEqual([])
  })

  it('o vocabulário do outro não vaza', async () => {
    const { data } = await clienteA.from('vocabulario').select('singular')
    expect(data?.map((v) => v.singular)).toEqual(['Aluno'])
  })

  it('escrever na conta do outro é recusado', async () => {
    const { data } = await clienteA.from('vocabulario')
      .insert({ conta_id: contaB, chave: 'servico', singular: 'X', plural: 'Xs' })
      .select()
    expect(data).toBeNull()
  })

  it('quem não está em conta nenhuma não enxerga nada', async () => {
    const { cliente } = await comoUsuario(`avulso-${Date.now()}@teste.local`)
    const { data } = await cliente.from('conta').select('id')
    expect(data).toEqual([])
  })
})
```

- [ ] **Passo 5: Rodar e ver o resultado**

Rodar: `npm test -- tests/rls.test.ts`
Esperado: PASSA, 5 testes. A migration já foi escrita no passo 1, então este
teste prova a política, não a ausência dela.

Se algum falhar, o defeito está na política, não no teste — a política é o que
está sendo verificado.

- [ ] **Passo 6: Provar que a política existe mesmo**

Este passo é obrigatório e é o que impede o falso positivo mais perigoso do
plano: um teste que passa porque *nada* está sendo lido.

```bash
npx supabase db reset
psql "$(npx supabase status -o env | grep DB_URL | cut -d'"' -f2)" \
  -c "select tablename, rowsecurity from pg_tables where schemaname='public';"
```

Esperado: `rowsecurity = t` para `conta`, `usuario_conta` e `vocabulario`.

- [ ] **Passo 7: Commitar**

```bash
git add supabase/migrations/0001_conta.sql tests/
git commit -m "feat: conta, papéis e vocabulário com RLS provada por teste"
```

---

### Tarefa 3: Cadastros

**Arquivos:**
- Criar: `supabase/migrations/0002_cadastros.sql`
- Modificar: `tests/rls.test.ts` (acrescentar um bloco)

**Interfaces:**
- Consome: `public.contas_do_usuario()`, `public.tem_papel()` da Tarefa 2
- Produz: as tabelas `pessoa`, `pessoa_tag`, `profissional`, `servico`, `local`

- [ ] **Passo 1: Escrever a migration**

Criar `supabase/migrations/0002_cadastros.sql`:

```sql
create table pessoa (
  id                    uuid primary key default gen_random_uuid(),
  conta_id              uuid not null references conta (id) on delete cascade,
  nome                  text not null,
  telefone              text,
  email                 text,
  identificador_externo text,
  nascimento            date,
  vencimento_plano      date,
  observacao            text,
  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now()
);
create index pessoa_conta_ix on pessoa (conta_id) where ativo;
create index pessoa_nome_ix  on pessoa (conta_id, lower(nome));

create table pessoa_tag (
  pessoa_id uuid not null references pessoa (id) on delete cascade,
  conta_id  uuid not null references conta (id) on delete cascade,
  tag       text not null,
  primary key (pessoa_id, tag)
);

create table profissional (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references conta (id) on delete cascade,
  nome       text not null,
  -- anulável de propósito: um nome na grade não precisa de acesso ao sistema
  usuario_id uuid references auth.users (id) on delete set null,
  cor        text,
  ativo      boolean not null default true
);
create index profissional_conta_ix on profissional (conta_id) where ativo;

create table servico (
  id                uuid primary key default gen_random_uuid(),
  conta_id          uuid not null references conta (id) on delete cascade,
  nome              text not null,
  duracao_min       integer not null default 60 check (duracao_min > 0),
  capacidade_padrao integer not null default 1 check (capacidade_padrao > 0),
  ativo             boolean not null default true
);

create table local (
  id       uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta (id) on delete cascade,
  nome     text not null,
  ativo    boolean not null default true
);

-- RLS: leitura para quem é da conta, escrita para dono, recepção e suporte.
-- `profissional` não escreve cadastro; ele registra presença (migration 0003).
do $$
declare t text;
begin
  foreach t in array array['pessoa','pessoa_tag','profissional','servico','local']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_le on %I for select using (conta_id in (select public.contas_do_usuario()))',
      t, t);
    execute format(
      'create policy %I_escreve on %I for all
         using (public.tem_papel(conta_id, array[''dono'',''recepcao'',''suporte'']::papel[]))
         with check (public.tem_papel(conta_id, array[''dono'',''recepcao'',''suporte'']::papel[]))',
      t, t);
  end loop;
end $$;
```

- [ ] **Passo 2: Escrever o teste (vai falhar antes de aplicar)**

Acrescentar ao fim de `tests/rls.test.ts`, dentro do mesmo `describe`:

```ts
  it('pessoa não vaza entre contas', async () => {
    const a = admin()
    await a.from('pessoa').insert([
      { conta_id: contaA, nome: 'Emília da conta A' },
      { conta_id: contaB, nome: 'Sabrina da conta B' },
    ])
    const { data } = await clienteA.from('pessoa').select('nome')
    expect(data?.map((p) => p.nome)).toEqual(['Emília da conta A'])
  })

  it('pessoa sem telefone é aceita — 30% do dado real não tem', async () => {
    const { data, error } = await clienteA.from('pessoa')
      .insert({ conta_id: contaA, nome: 'Só o nome' }).select().single()
    expect(error).toBeNull()
    expect(data?.telefone).toBeNull()
  })
```

- [ ] **Passo 3: Aplicar a migration**

```bash
npx supabase db reset
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test -- tests/rls.test.ts`
Esperado: PASSA, 7 testes.

- [ ] **Passo 5: Commitar**

```bash
git add supabase/migrations/0002_cadastros.sql tests/rls.test.ts
git commit -m "feat: cadastros de pessoa, profissional, serviço e local"
```

---

### Tarefa 4: Agenda no banco

**Arquivos:**
- Criar: `supabase/migrations/0003_agenda.sql`

**Interfaces:**
- Consome: as tabelas das Tarefas 2 e 3
- Produz: `serie`, `vaga`, `sessao`, `participacao`, `excecao_calendario`; os
  enums `status_sessao`, `origem_participacao`, `status_participacao`,
  `origem_registro`; e os dois índices únicos de que a Tarefa 8 depende.

- [ ] **Passo 1: Escrever a migration**

Criar `supabase/migrations/0003_agenda.sql`:

```sql
create type status_sessao         as enum ('prevista', 'realizada', 'cancelada');
create type origem_participacao   as enum ('recorrente','avulso','reposicao','encaixe','reserva');
create type status_participacao   as enum ('esperada','confirmada','presente',
                                           'falta','falta_avisada','licenca','cancelada');
create type origem_registro       as enum ('profissional','recepcao','bot','sistema','importacao');

create table serie (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references conta (id) on delete cascade,
  servico_id      uuid not null references servico (id),
  profissional_id uuid references profissional (id),
  local_id        uuid references local (id),
  dia_semana      smallint not null check (dia_semana between 0 and 6),
  hora_inicio     time not null,
  duracao_min     integer not null check (duracao_min > 0),
  capacidade      integer not null check (capacidade > 0),
  vigencia_inicio date not null,
  vigencia_fim    date,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
create index serie_conta_dia_ix on serie (conta_id, dia_semana) where ativo;

-- a reserva permanente de uma pessoa numa série (a "matrícula")
create table vaga (
  id        uuid primary key default gen_random_uuid(),
  conta_id  uuid not null references conta (id) on delete cascade,
  serie_id  uuid not null references serie (id) on delete cascade,
  pessoa_id uuid not null references pessoa (id) on delete cascade,
  inicio    date not null,
  fim       date,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index vaga_serie_ix on vaga (serie_id);

create table sessao (
  id                   uuid primary key default gen_random_uuid(),
  conta_id             uuid not null references conta (id) on delete cascade,
  serie_id             uuid references serie (id) on delete set null,
  -- cópia, não referência viva: editar a série não reescreve o passado
  servico_id           uuid not null references servico (id),
  profissional_id      uuid references profissional (id),
  local_id             uuid references local (id),
  inicio               timestamptz not null,
  duracao_min          integer not null check (duracao_min > 0),
  capacidade           integer not null check (capacidade > 0),
  status               status_sessao not null default 'prevista',
  motivo_cancelamento  text,
  criado_em            timestamptz not null default now()
);

-- o que torna a materialização sob demanda segura contra corrida.
-- parcial porque `serie_id` é nulo em sessão avulsa, e duas avulsas no mesmo
-- horário são legítimas (dois profissionais, duas salas).
create unique index sessao_serie_inicio_uk
  on sessao (serie_id, inicio) where serie_id is not null;
create index sessao_conta_inicio_ix on sessao (conta_id, inicio);

create table participacao (
  id                       uuid primary key default gen_random_uuid(),
  conta_id                 uuid not null references conta (id) on delete cascade,
  sessao_id                uuid not null references sessao (id) on delete cascade,
  pessoa_id                uuid not null references pessoa (id) on delete cascade,
  origem                   origem_participacao not null,
  status                   status_participacao not null default 'esperada',
  reposicao_de_id          uuid references participacao (id) on delete set null,
  observacao               text,
  registrado_por_usuario_id uuid references auth.users (id) on delete set null,
  registrado_por_origem    origem_registro not null default 'sistema',
  registrado_em            timestamptz not null default now()
);

-- a única regra que o sistema impõe: capacidade avisa, duplicata não passa
create unique index participacao_sessao_pessoa_uk
  on participacao (sessao_id, pessoa_id);
create index participacao_sessao_ix on participacao (sessao_id);
create index participacao_pessoa_ix on participacao (pessoa_id);
-- as reposições em aberto da tela de Pendências saem daqui
create index participacao_falta_aberta_ix on participacao (conta_id, pessoa_id)
  where status in ('falta', 'falta_avisada');

create table excecao_calendario (
  id        uuid primary key default gen_random_uuid(),
  conta_id  uuid not null references conta (id) on delete cascade,
  data      date not null,
  tipo      text not null check (tipo in ('feriado', 'fechado')),
  descricao text,
  unique (conta_id, data)
);

do $$
declare t text;
begin
  foreach t in array array['serie','vaga','sessao','participacao','excecao_calendario']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_le on %I for select using (conta_id in (select public.contas_do_usuario()))',
      t, t);
  end loop;
end $$;

-- escrita de estrutura: dono, recepção, suporte
create policy serie_escreve on serie for all
  using (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]));

create policy vaga_escreve on vaga for all
  using (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]));

create policy excecao_escreve on excecao_calendario for all
  using (public.tem_papel(conta_id, array['dono','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','suporte']::papel[]));

-- escrita de operação: o profissional entra aqui, porque é ele quem faz chamada
create policy sessao_escreve on sessao for all
  using (public.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]));

create policy participacao_escreve on participacao for all
  using (public.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]));
```

- [ ] **Passo 2: Aplicar**

```bash
npx supabase db reset
```

Esperado: as três migrations aplicam sem erro.

- [ ] **Passo 3: Provar as duas constraints que sustentam o modelo**

Criar `tests/constraints.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'

describe('as constraints que o modelo depende', () => {
  const a = admin()
  let contaId: string, serieId: string, servicoId: string, pessoaId: string
  let sessaoId: string

  beforeAll(async () => {
    const marca = Date.now()
    const { data: c } = await a.from('conta')
      .insert({ nome: 'C', slug: `c-${marca}` }).select().single()
    contaId = c!.id

    const { data: s } = await a.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()
    servicoId = s!.id

    const { data: se } = await a.from('serie').insert({
      conta_id: contaId, servico_id: servicoId, dia_semana: 1,
      hora_inicio: '07:00', duracao_min: 60, capacidade: 4,
      vigencia_inicio: '2026-03-01',
    }).select().single()
    serieId = se!.id

    const { data: p } = await a.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Emília' }).select().single()
    pessoaId = p!.id

    const { data: ss } = await a.from('sessao').insert({
      conta_id: contaId, serie_id: serieId, servico_id: servicoId,
      inicio: '2026-08-10T10:00:00Z', duracao_min: 60, capacidade: 4,
    }).select().single()
    sessaoId = ss!.id
  })

  it('a mesma série no mesmo instante não duplica', async () => {
    const { error } = await a.from('sessao').insert({
      conta_id: contaId, serie_id: serieId, servico_id: servicoId,
      inicio: '2026-08-10T10:00:00Z', duracao_min: 60, capacidade: 4,
    })
    expect(error?.code).toBe('23505')
  })

  it('duas sessões avulsas no mesmo instante são permitidas', async () => {
    const um = await a.from('sessao').insert({
      conta_id: contaId, serie_id: null, servico_id: servicoId,
      inicio: '2026-08-11T10:00:00Z', duracao_min: 60, capacidade: 1,
    })
    const dois = await a.from('sessao').insert({
      conta_id: contaId, serie_id: null, servico_id: servicoId,
      inicio: '2026-08-11T10:00:00Z', duracao_min: 60, capacidade: 1,
    })
    expect(um.error).toBeNull()
    expect(dois.error).toBeNull()
  })

  it('a mesma pessoa duas vezes na mesma sessão é recusada', async () => {
    const um = await a.from('participacao').insert({
      conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoaId,
      origem: 'recorrente',
    })
    expect(um.error).toBeNull()

    const dois = await a.from('participacao').insert({
      conta_id: contaId, sessao_id: sessaoId, pessoa_id: pessoaId,
      origem: 'encaixe',
    })
    expect(dois.error?.code).toBe('23505')
  })

  it('passar da capacidade é permitido — capacidade avisa, não bloqueia', async () => {
    for (let i = 0; i < 5; i++) {
      const { data: p } = await a.from('pessoa')
        .insert({ conta_id: contaId, nome: `Encaixe ${i}` }).select().single()
      const { error } = await a.from('participacao').insert({
        conta_id: contaId, sessao_id: sessaoId, pessoa_id: p!.id,
        origem: 'encaixe',
      })
      expect(error).toBeNull()
    }
    const { count } = await a.from('participacao')
      .select('*', { count: 'exact', head: true }).eq('sessao_id', sessaoId)
    expect(count).toBe(6) // capacidade é 4, e as 6 entraram
  })
})
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test -- tests/constraints.test.ts`
Esperado: PASSA, 4 testes.

O quarto teste é o mais importante do plano inteiro: ele fixa como decisão de
produto que **capacidade não bloqueia**. Se alguém um dia "consertar" isso com
uma constraint, este teste quebra e explica por quê.

- [ ] **Passo 5: Commitar**

```bash
git add supabase/migrations/0003_agenda.sql tests/constraints.test.ts
git commit -m "feat: modelo de agenda com as constraints que o sustentam"
```

---

### Tarefa 5: Expandir série em ocorrências

**Arquivos:**
- Criar: `src/core/agenda/tipos.ts`, `src/core/agenda/expandir.ts`
- Criar: `tests/unit/expandir.test.ts`

**Interfaces:**
- Consome: `diaDaSemanaDe`, `somarDias` de `@/core/agenda/datas`
- Produz:
  - `type Serie = { id, diaSemana, horaInicio, duracaoMin, capacidade, vigenciaInicio, vigenciaFim, ativo }`
  - `type Excecao = { data: string; tipo: 'feriado' | 'fechado' }`
  - `type Ocorrencia = { serieId: string; data: string; horaInicio: string; duracaoMin: number; capacidade: number; bloqueada: boolean; motivo?: 'feriado' | 'fechado' }`
  - `expandirSerie(serie: Serie, de: string, ate: string, excecoes: Excecao[]): Ocorrencia[]`

- [ ] **Passo 1: Escrever os tipos**

Criar `src/core/agenda/tipos.ts`:

```ts
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Serie = {
  id: string
  diaSemana: DiaSemana
  /** hora local, `HH:MM` */
  horaInicio: string
  duracaoMin: number
  capacidade: number
  /** `YYYY-MM-DD` */
  vigenciaInicio: string
  vigenciaFim: string | null
  ativo: boolean
}

export type Excecao = {
  data: string
  tipo: 'feriado' | 'fechado'
}

export type Ocorrencia = {
  serieId: string
  data: string
  horaInicio: string
  duracaoMin: number
  capacidade: number
  /** feriado não some da grade: aparece riscado, com o motivo */
  bloqueada: boolean
  motivo?: 'feriado' | 'fechado'
}
```

- [ ] **Passo 2: Escrever o teste (vai falhar)**

Criar `tests/unit/expandir.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { expandirSerie } from '@/core/agenda/expandir'
import type { Serie } from '@/core/agenda/tipos'

const segunda7h: Serie = {
  id: 's1',
  diaSemana: 1,
  horaInicio: '07:00',
  duracaoMin: 60,
  capacidade: 4,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  ativo: true,
}

describe('expandirSerie', () => {
  it('gera só os dias da semana da série', () => {
    const r = expandirSerie(segunda7h, '2026-08-01', '2026-08-31', [])
    expect(r.map((o) => o.data)).toEqual([
      '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
  })

  it('carrega horário, duração e capacidade da série', () => {
    const [primeira] = expandirSerie(segunda7h, '2026-08-01', '2026-08-05', [])
    expect(primeira).toMatchObject({
      serieId: 's1', horaInicio: '07:00', duracaoMin: 60, capacidade: 4,
      bloqueada: false,
    })
  })

  it('não gera antes do início da vigência', () => {
    const s = { ...segunda7h, vigenciaInicio: '2026-08-11' }
    const r = expandirSerie(s, '2026-08-01', '2026-08-31', [])
    expect(r.map((o) => o.data)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31'])
  })

  it('não gera depois do fim da vigência', () => {
    const s = { ...segunda7h, vigenciaFim: '2026-08-18' }
    const r = expandirSerie(s, '2026-08-01', '2026-08-31', [])
    expect(r.map((o) => o.data)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17'])
  })

  it('série inativa não gera nada', () => {
    const r = expandirSerie({ ...segunda7h, ativo: false }, '2026-08-01', '2026-08-31', [])
    expect(r).toEqual([])
  })

  it('intervalo invertido gera vazio em vez de laço infinito', () => {
    const r = expandirSerie(segunda7h, '2026-08-31', '2026-08-01', [])
    expect(r).toEqual([])
  })

  it('feriado gera ocorrência BLOQUEADA, não some da grade', () => {
    const r = expandirSerie(segunda7h, '2026-08-01', '2026-08-31', [
      { data: '2026-08-10', tipo: 'feriado' },
    ])
    expect(r).toHaveLength(5)
    expect(r[1]).toMatchObject({ data: '2026-08-10', bloqueada: true, motivo: 'feriado' })
    expect(r[0].bloqueada).toBe(false)
  })

  it('exceção em dia que não é da série é ignorada', () => {
    const r = expandirSerie(segunda7h, '2026-08-01', '2026-08-31', [
      { data: '2026-08-11', tipo: 'fechado' },
    ])
    expect(r.every((o) => !o.bloqueada)).toBe(true)
  })

  it('intervalo de um dia só, batendo no dia da série, gera uma', () => {
    const r = expandirSerie(segunda7h, '2026-08-10', '2026-08-10', [])
    expect(r.map((o) => o.data)).toEqual(['2026-08-10'])
  })
})
```

- [ ] **Passo 3: Rodar e ver falhar**

Rodar: `npm test -- tests/unit/expandir.test.ts`
Esperado: FALHA com "Failed to resolve import ... core/agenda/expandir".

- [ ] **Passo 4: Implementar**

Criar `src/core/agenda/expandir.ts`:

```ts
import { diaDaSemanaDe, somarDias } from './datas'
import type { Excecao, Ocorrencia, Serie } from './tipos'

/**
 * Uma série mais um intervalo viram a lista de ocorrências previstas.
 *
 * Não toca em banco e não sabe o que é fuso: recebe e devolve data em string
 * `YYYY-MM-DD`, que compara lexicograficamente na ordem certa.
 *
 * Dia bloqueado por feriado ou fechamento **continua na lista**, marcado. Some
 * da grade é pior que aparecer riscado — some gera a pergunta "cadê a aula".
 */
export function expandirSerie(
  serie: Serie,
  de: string,
  ate: string,
  excecoes: Excecao[],
): Ocorrencia[] {
  if (!serie.ativo) return []
  if (ate < de) return []

  const bloqueio = new Map(excecoes.map((e) => [e.data, e.tipo]))

  const inicio = de > serie.vigenciaInicio ? de : serie.vigenciaInicio
  const fim =
    serie.vigenciaFim !== null && serie.vigenciaFim < ate ? serie.vigenciaFim : ate

  const saida: Ocorrencia[] = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    if (diaDaSemanaDe(d) !== serie.diaSemana) continue
    const motivo = bloqueio.get(d)
    saida.push({
      serieId: serie.id,
      data: d,
      horaInicio: serie.horaInicio,
      duracaoMin: serie.duracaoMin,
      capacidade: serie.capacidade,
      bloqueada: motivo !== undefined,
      ...(motivo !== undefined ? { motivo } : {}),
    })
  }
  return saida
}
```

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `npm test -- tests/unit/expandir.test.ts`
Esperado: PASSA, 9 testes.

- [ ] **Passo 6: Commitar**

```bash
git add src/core/agenda/tipos.ts src/core/agenda/expandir.ts tests/unit/expandir.test.ts
git commit -m "feat(core): expandir série em ocorrências, com exceções"
```

---

### Tarefa 6: Ocupação e encaixe

**Arquivos:**
- Criar: `src/core/agenda/ocupacao.ts`, `src/core/agenda/encaixe.ts`
- Criar: `tests/unit/ocupacao.test.ts`

**Interfaces:**
- Consome: nada
- Produz:
  - `type StatusParticipacao = 'esperada'|'confirmada'|'presente'|'falta'|'falta_avisada'|'licenca'|'cancelada'`
  - `type Ocupacao = { capacidade: number; ocupadas: number; livres: number; lotada: boolean; excedida: boolean }`
  - `calcularOcupacao(capacidade: number, status: StatusParticipacao[]): Ocupacao`
  - `type Veredito = { cabe: boolean; excede: boolean; motivo?: 'ja_participa' | 'excede_capacidade' }`
  - `avaliarEncaixe(ocupacao: Ocupacao, jaParticipa: boolean): Veredito`

- [ ] **Passo 1: Escrever o teste (vai falhar)**

Criar `tests/unit/ocupacao.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularOcupacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe } from '@/core/agenda/encaixe'

describe('calcularOcupacao', () => {
  it('conta quem ocupa a vaga', () => {
    const o = calcularOcupacao(4, ['esperada', 'presente', 'confirmada'])
    expect(o).toEqual({
      capacidade: 4, ocupadas: 3, livres: 1, lotada: false, excedida: false,
    })
  })

  it('quem avisou que não vem LIBERA a vaga', () => {
    // é o que faz a confirmação por bot valer: avisou, a vaga abre para reposição
    const o = calcularOcupacao(4, ['presente', 'falta_avisada', 'falta_avisada'])
    expect(o.ocupadas).toBe(1)
    expect(o.livres).toBe(3)
  })

  it('cancelada libera a vaga', () => {
    expect(calcularOcupacao(2, ['cancelada', 'presente']).ocupadas).toBe(1)
  })

  it('licença NÃO libera — a pessoa mantém o horário dela', () => {
    expect(calcularOcupacao(4, ['licenca', 'presente']).ocupadas).toBe(2)
  })

  it('falta sem aviso não libera', () => {
    expect(calcularOcupacao(4, ['falta', 'presente']).ocupadas).toBe(2)
  })

  it('lotada quando bate a capacidade', () => {
    const o = calcularOcupacao(2, ['presente', 'presente'])
    expect(o).toMatchObject({ ocupadas: 2, livres: 0, lotada: true, excedida: false })
  })

  it('excedida quando passa, e livres nunca fica negativo', () => {
    const o = calcularOcupacao(2, ['presente', 'presente', 'encaixe' as never, 'presente'])
    expect(o.ocupadas).toBe(4)
    expect(o.livres).toBe(0)
    expect(o.excedida).toBe(true)
  })

  it('sessão vazia', () => {
    expect(calcularOcupacao(4, [])).toMatchObject({ ocupadas: 0, livres: 4, lotada: false })
  })
})

describe('avaliarEncaixe', () => {
  it('cabe quando há vaga', () => {
    const o = calcularOcupacao(4, ['presente'])
    expect(avaliarEncaixe(o, false)).toEqual({ cabe: true, excede: false })
  })

  it('CABE mesmo lotada, avisando que excede', () => {
    // decisão de produto: no dado real, 47 pessoas estão fora da grade.
    // um sistema que recusa perde para o Excel, que aceita.
    const o = calcularOcupacao(2, ['presente', 'presente'])
    expect(avaliarEncaixe(o, false)).toEqual({
      cabe: true, excede: true, motivo: 'excede_capacidade',
    })
  })

  it('a MESMA pessoa duas vezes é a única recusa', () => {
    const o = calcularOcupacao(4, ['presente'])
    expect(avaliarEncaixe(o, true)).toEqual({
      cabe: false, excede: false, motivo: 'ja_participa',
    })
  })
})
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test -- tests/unit/ocupacao.test.ts`
Esperado: FALHA com "Failed to resolve import ... core/agenda/ocupacao".

- [ ] **Passo 3: Implementar a ocupação**

Criar `src/core/agenda/ocupacao.ts`:

```ts
export type StatusParticipacao =
  | 'esperada' | 'confirmada' | 'presente'
  | 'falta' | 'falta_avisada' | 'licenca' | 'cancelada'

/**
 * Os dois status que devolvem a vaga para a sessão.
 *
 * `falta_avisada` libera de propósito: é o que faz "avisei que não vou" abrir
 * espaço para a reposição de outra pessoa. `licenca` NÃO libera — quem está
 * afastado mantém o horário, que é como a operação real trata.
 */
const LIBERAM_A_VAGA: ReadonlySet<string> = new Set(['falta_avisada', 'cancelada'])

export type Ocupacao = {
  capacidade: number
  ocupadas: number
  livres: number
  lotada: boolean
  excedida: boolean
}

export function calcularOcupacao(
  capacidade: number,
  status: StatusParticipacao[],
): Ocupacao {
  const ocupadas = status.filter((s) => !LIBERAM_A_VAGA.has(s)).length
  return {
    capacidade,
    ocupadas,
    livres: Math.max(0, capacidade - ocupadas),
    lotada: ocupadas >= capacidade,
    excedida: ocupadas > capacidade,
  }
}
```

- [ ] **Passo 4: Implementar o encaixe**

Criar `src/core/agenda/encaixe.ts`:

```ts
import type { Ocupacao } from './ocupacao'

export type Veredito = {
  cabe: boolean
  excede: boolean
  motivo?: 'ja_participa' | 'excede_capacidade'
}

/**
 * Capacidade avisa, nunca bloqueia.
 *
 * A única coisa que o sistema recusa é a mesma pessoa duas vezes na mesma
 * sessão, porque isso é sempre erro de dedo. Turma lotada aceita mais um: no
 * dado real do MGM, 47 pessoas estão escritas fora da grade, e isso é a
 * operação funcionando, não bagunça.
 */
export function avaliarEncaixe(ocupacao: Ocupacao, jaParticipa: boolean): Veredito {
  if (jaParticipa) return { cabe: false, excede: false, motivo: 'ja_participa' }
  if (ocupacao.livres > 0) return { cabe: true, excede: false }
  return { cabe: true, excede: true, motivo: 'excede_capacidade' }
}
```

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `npm test -- tests/unit/ocupacao.test.ts`
Esperado: PASSA, 11 testes.

- [ ] **Passo 6: Commitar**

```bash
git add src/core/agenda/ocupacao.ts src/core/agenda/encaixe.ts tests/unit/ocupacao.test.ts
git commit -m "feat(core): ocupação e encaixe — capacidade avisa, não bloqueia"
```

---

### Tarefa 7: Vocabulário

**Arquivos:**
- Criar: `src/core/vocabulario/padrao.ts`, `src/core/vocabulario/rotulo.ts`
- Criar: `tests/unit/vocabulario.test.ts`

**Interfaces:**
- Consome: nada
- Produz:
  - `type ChaveVocabulario = 'pessoa'|'profissional'|'servico'|'local'|'serie'|'sessao'|'vaga'`
  - `type Vocabulario = Partial<Record<ChaveVocabulario, { singular: string; plural: string }>>`
  - `PADRAO: Record<ChaveVocabulario, { singular: string; plural: string }>`
  - `rotulo(voc: Vocabulario, chave: ChaveVocabulario, forma?: 'singular' | 'plural'): string`

- [ ] **Passo 1: Escrever o teste (vai falhar)**

Criar `tests/unit/vocabulario.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rotulo } from '@/core/vocabulario/rotulo'
import { PADRAO } from '@/core/vocabulario/padrao'

describe('rotulo', () => {
  it('usa o rótulo da conta quando existe', () => {
    const voc = { pessoa: { singular: 'Aluno', plural: 'Alunos' } }
    expect(rotulo(voc, 'pessoa')).toBe('Aluno')
    expect(rotulo(voc, 'pessoa', 'plural')).toBe('Alunos')
  })

  it('cai no padrão neutro quando a conta não configurou', () => {
    expect(rotulo({}, 'pessoa')).toBe(PADRAO.pessoa.singular)
    expect(rotulo({}, 'sessao', 'plural')).toBe(PADRAO.sessao.plural)
  })

  it('o padrão é neutro — nunca "Aluno", nunca "Paciente"', () => {
    const todos = Object.values(PADRAO).flatMap((r) => [r.singular, r.plural])
    for (const proibido of ['Aluno', 'Alunos', 'Paciente', 'Turma', 'Professor', 'Matrícula']) {
      expect(todos).not.toContain(proibido)
    }
  })

  it('o mesmo sistema serve o salão sem tocar em código', () => {
    const salao = {
      pessoa: { singular: 'Cliente', plural: 'Clientes' },
      profissional: { singular: 'Profissional', plural: 'Profissionais' },
    }
    expect(rotulo(salao, 'pessoa', 'plural')).toBe('Clientes')
    expect(rotulo(salao, 'sessao')).toBe(PADRAO.sessao.singular)
  })
})
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test -- tests/unit/vocabulario.test.ts`
Esperado: FALHA com "Failed to resolve import ... core/vocabulario/rotulo".

- [ ] **Passo 3: Implementar**

Criar `src/core/vocabulario/padrao.ts`:

```ts
export type ChaveVocabulario =
  | 'pessoa' | 'profissional' | 'servico' | 'local' | 'serie' | 'sessao' | 'vaga'

export type Rotulo = { singular: string; plural: string }
export type Vocabulario = Partial<Record<ChaveVocabulario, Rotulo>>

/**
 * O padrão é deliberadamente neutro. "Aluno", "Turma" e "Paciente" são
 * vocabulário de um cliente, e vocabulário de cliente é configuração.
 */
export const PADRAO: Record<ChaveVocabulario, Rotulo> = {
  pessoa:       { singular: 'Pessoa',       plural: 'Pessoas' },
  profissional: { singular: 'Profissional', plural: 'Profissionais' },
  servico:      { singular: 'Serviço',      plural: 'Serviços' },
  local:        { singular: 'Local',        plural: 'Locais' },
  serie:        { singular: 'Horário fixo', plural: 'Horários fixos' },
  sessao:       { singular: 'Sessão',       plural: 'Sessões' },
  vaga:         { singular: 'Vaga',         plural: 'Vagas' },
}
```

Criar `src/core/vocabulario/rotulo.ts`:

```ts
import { PADRAO, type ChaveVocabulario, type Vocabulario } from './padrao'

export function rotulo(
  voc: Vocabulario,
  chave: ChaveVocabulario,
  forma: 'singular' | 'plural' = 'singular',
): string {
  return voc[chave]?.[forma] ?? PADRAO[chave][forma]
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test -- tests/unit/vocabulario.test.ts`
Esperado: PASSA, 4 testes.

- [ ] **Passo 5: Commitar**

```bash
git add src/core/vocabulario tests/unit/vocabulario.test.ts
git commit -m "feat(core): vocabulário por conta, com padrão neutro"
```

---

### Tarefa 8: Materializar a sessão sob demanda

**Arquivos:**
- Criar: `src/server/supabase.ts`
- Criar: `src/server/agenda/materializar.ts`
- Criar: `tests/materializar.test.ts`

**Interfaces:**
- Consome: `expandirSerie` (Tarefa 5); as tabelas `serie`, `vaga`, `sessao`,
  `participacao`, `excecao_calendario` (Tarefa 4)
- Produz:
  `materializarJanela(db: SupabaseClient, contaId: string, de: string, ate: string): Promise<{ criadas: number; participacoesCriadas: number }>`

- [ ] **Passo 1: Escrever o cliente do Supabase**

Criar `src/server/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Db = SupabaseClient

export function clienteAdmin(): Db {
  const url = process.env.SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Passo 2: Escrever o teste (vai falhar)**

Criar `tests/materializar.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { materializarJanela } from '@/server/agenda/materializar'

describe('materializarJanela', () => {
  const db = admin()
  let contaId: string, serieId: string, pessoaId: string

  beforeAll(async () => {
    const marca = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `m-${marca}`, fuso: 'America/Sao_Paulo' })
      .select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()

    // segunda-feira, 07:00, capacidade 4, valendo desde março
    const { data: se } = await db.from('serie').insert({
      conta_id: contaId, servico_id: s!.id, dia_semana: 1, hora_inicio: '07:00',
      duracao_min: 60, capacidade: 4, vigencia_inicio: '2026-03-01',
    }).select().single()
    serieId = se!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Emília' }).select().single()
    pessoaId = p!.id

    await db.from('vaga').insert({
      conta_id: contaId, serie_id: serieId, pessoa_id: pessoaId, inicio: '2026-03-01',
    })

    await db.from('excecao_calendario').insert({
      conta_id: contaId, data: '2026-08-10', tipo: 'feriado', descricao: 'Teste',
    })
  })

  it('cria uma sessão por ocorrência da janela', async () => {
    const r = await materializarJanela(db, contaId, '2026-08-01', '2026-08-31')
    expect(r.criadas).toBe(5) // 3, 10, 17, 24, 31 de agosto são segundas
  })

  it('é idempotente — rodar de novo não duplica', async () => {
    const r = await materializarJanela(db, contaId, '2026-08-01', '2026-08-31')
    expect(r.criadas).toBe(0)

    const { count } = await db.from('sessao')
      .select('*', { count: 'exact', head: true })
      .eq('serie_id', serieId)
    expect(count).toBe(5)
  })

  it('a sessão do feriado nasce cancelada, com motivo', async () => {
    const { data } = await db.from('sessao').select('status, motivo_cancelamento')
      .eq('serie_id', serieId)
      .gte('inicio', '2026-08-10T00:00:00Z').lt('inicio', '2026-08-11T00:00:00Z')
      .single()
    expect(data?.status).toBe('cancelada')
    expect(data?.motivo_cancelamento).toContain('feriado')
  })

  it('semeia a participação de quem tem vaga recorrente', async () => {
    const { data } = await db.from('participacao')
      .select('origem, status, sessao:sessao_id(serie_id)')
      .eq('pessoa_id', pessoaId)
    expect(data).toHaveLength(5)
    expect(data![0]).toMatchObject({ origem: 'recorrente', status: 'esperada' })
  })

  it('a hora local vira o instante certo no fuso da conta', async () => {
    const { data } = await db.from('sessao').select('inicio')
      .eq('serie_id', serieId).order('inicio').limit(1).single()
    // 07:00 em America/Sao_Paulo (UTC-3) é 10:00Z
    expect(new Date(data!.inicio).toISOString()).toBe('2026-08-03T10:00:00.000Z')
  })

  it('não semeia participação de vaga que já foi encerrada', async () => {
    const { data: p2 } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Saiu em julho' }).select().single()
    await db.from('vaga').insert({
      conta_id: contaId, serie_id: serieId, pessoa_id: p2!.id,
      inicio: '2026-03-01', fim: '2026-07-31',
    })
    await materializarJanela(db, contaId, '2026-09-01', '2026-09-30')

    const { count } = await db.from('participacao')
      .select('*', { count: 'exact', head: true }).eq('pessoa_id', p2!.id)
    expect(count).toBe(0)
  })
})
```

- [ ] **Passo 3: Rodar e ver falhar**

Rodar: `npm test -- tests/materializar.test.ts`
Esperado: FALHA com "Failed to resolve import ... server/agenda/materializar".

- [ ] **Passo 4: Implementar**

Criar `src/server/agenda/materializar.ts`:

```ts
import { expandirSerie } from '@/core/agenda/expandir'
import type { Excecao, Serie } from '@/core/agenda/tipos'
import type { Db } from '../supabase'

/** `2026-08-03` + `07:00` + `America/Sao_Paulo` → instante absoluto. */
function instante(data: string, hora: string, fuso: string): string {
  // Descobre o deslocamento do fuso naquela data formatando um palpite em UTC
  // e medindo a diferença. Funciona com horário de verão e sem ele.
  const palpite = new Date(`${data}T${hora}:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(
    fmt.formatToParts(palpite).filter((x) => x.type !== 'literal')
       .map((x) => [x.type, x.value]),
  ) as Record<string, string>
  const comoLocal = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second),
  )
  const deslocamento = comoLocal - palpite.getTime()
  return new Date(palpite.getTime() - deslocamento).toISOString()
}

/**
 * Cria as sessões da janela que ainda não existem, e semeia as participações
 * de quem tem vaga recorrente.
 *
 * Idempotente por construção: o `UNIQUE (serie_id, inicio)` parcial e o
 * `UNIQUE (sessao_id, pessoa_id)` transformam corrida em conflito ignorado.
 * Duas abas abrindo a mesma semana ao mesmo tempo não duplicam nada.
 */
export async function materializarJanela(
  db: Db,
  contaId: string,
  de: string,
  ate: string,
): Promise<{ criadas: number; participacoesCriadas: number }> {
  const { data: conta, error: erroConta } = await db
    .from('conta').select('fuso').eq('id', contaId).single()
  if (erroConta) throw erroConta
  const fuso = conta!.fuso as string

  const { data: series, error: erroSeries } = await db
    .from('serie')
    .select('id, servico_id, profissional_id, local_id, dia_semana, hora_inicio, duracao_min, capacidade, vigencia_inicio, vigencia_fim, ativo')
    .eq('conta_id', contaId).eq('ativo', true)
  if (erroSeries) throw erroSeries
  if (!series?.length) return { criadas: 0, participacoesCriadas: 0 }

  const { data: excecoesBrutas } = await db
    .from('excecao_calendario').select('data, tipo')
    .eq('conta_id', contaId).gte('data', de).lte('data', ate)
  const excecoes = (excecoesBrutas ?? []) as Excecao[]

  const { data: vagas } = await db
    .from('vaga').select('serie_id, pessoa_id, inicio, fim').eq('conta_id', contaId)

  let criadas = 0
  let participacoesCriadas = 0

  for (const s of series) {
    const serie: Serie = {
      id: s.id,
      diaSemana: s.dia_semana,
      horaInicio: String(s.hora_inicio).slice(0, 5),
      duracaoMin: s.duracao_min,
      capacidade: s.capacidade,
      vigenciaInicio: s.vigencia_inicio,
      vigenciaFim: s.vigencia_fim,
      ativo: s.ativo,
    }
    const ocorrencias = expandirSerie(serie, de, ate, excecoes)
    if (!ocorrencias.length) continue

    const linhas = ocorrencias.map((o) => ({
      conta_id: contaId,
      serie_id: o.serieId,
      servico_id: s.servico_id,
      profissional_id: s.profissional_id,
      local_id: s.local_id,
      inicio: instante(o.data, o.horaInicio, fuso),
      duracao_min: o.duracaoMin,
      capacidade: o.capacidade,
      status: o.bloqueada ? 'cancelada' : 'prevista',
      motivo_cancelamento: o.bloqueada ? `Dia marcado como ${o.motivo}` : null,
    }))

    // `ignoreDuplicates` é o `on conflict do nothing`: quem já existe fica como está
    const { data: inseridas, error } = await db
      .from('sessao')
      .upsert(linhas, { onConflict: 'serie_id,inicio', ignoreDuplicates: true })
      .select('id, inicio')
    if (error) throw error
    criadas += inseridas?.length ?? 0

    const dasSerie = (vagas ?? []).filter((v) => v.serie_id === s.id)
    if (!dasSerie.length || !inseridas?.length) continue

    const participacoes = inseridas.flatMap((sessao) => {
      const dia = String(sessao.inicio).slice(0, 10)
      return dasSerie
        .filter((v) => v.inicio <= dia && (v.fim === null || v.fim >= dia))
        .map((v) => ({
          conta_id: contaId,
          sessao_id: sessao.id,
          pessoa_id: v.pessoa_id,
          origem: 'recorrente' as const,
          status: 'esperada' as const,
          registrado_por_origem: 'sistema' as const,
        }))
    })
    if (!participacoes.length) continue

    const { data: pInseridas, error: erroP } = await db
      .from('participacao')
      .upsert(participacoes, { onConflict: 'sessao_id,pessoa_id', ignoreDuplicates: true })
      .select('id')
    if (erroP) throw erroP
    participacoesCriadas += pInseridas?.length ?? 0
  }

  return { criadas, participacoesCriadas }
}
```

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `npm test -- tests/materializar.test.ts`
Esperado: PASSA, 6 testes.

Se o teste do fuso falhar por uma hora, o defeito está em `instante()`, não no
teste — São Paulo é UTC-3 o ano inteiro desde 2019.

- [ ] **Passo 6: Provar a idempotência sob concorrência**

Acrescentar ao fim de `tests/materializar.test.ts`, dentro do mesmo `describe`:

```ts
  it('duas chamadas simultâneas não duplicam', async () => {
    const antes = await db.from('sessao')
      .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)

    await Promise.all([
      materializarJanela(db, contaId, '2026-10-01', '2026-10-31'),
      materializarJanela(db, contaId, '2026-10-01', '2026-10-31'),
      materializarJanela(db, contaId, '2026-10-01', '2026-10-31'),
    ])

    const depois = await db.from('sessao')
      .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)
    expect((depois.count ?? 0) - (antes.count ?? 0)).toBe(4) // outubro tem 4 segundas
  })
```

Rodar: `npm test -- tests/materializar.test.ts`
Esperado: PASSA, 7 testes.

- [ ] **Passo 7: Commitar**

```bash
git add src/server tests/materializar.test.ts
git commit -m "feat: materialização de sessão sob demanda, idempotente"
```

---

### Tarefa 9: Login e destino por papel

**Arquivos:**
- Criar: `src/server/conta.ts`
- Criar: `src/app/entrar/page.tsx`, `src/app/entrar/acoes.ts`
- Modificar: `src/app/page.tsx`
- Criar: `src/middleware.ts`
- Criar: `tests/unit/destino.test.ts`

**Interfaces:**
- Consome: `usuario_conta` (Tarefa 2)
- Produz:
  - `type Papel = 'dono' | 'recepcao' | 'profissional' | 'suporte'`
  - `destinoDoPapel(papel: Papel): string` em `src/core/vocabulario/../..` →
    colocar em `src/core/acesso/destino.ts`
  - `contaAtiva(): Promise<{ contaId: string; papel: Papel } | null>` em
    `src/server/conta.ts`

- [ ] **Passo 1: Escrever o teste do destino (vai falhar)**

Criar `tests/unit/destino.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { destinoDoPapel } from '@/core/acesso/destino'

describe('destinoDoPapel', () => {
  it('profissional cai em Hoje — a agenda dele é o trabalho dele', () => {
    expect(destinoDoPapel('profissional')).toBe('/hoje')
  })

  it('dono e recepção caem na Grade da semana', () => {
    expect(destinoDoPapel('dono')).toBe('/semana')
    expect(destinoDoPapel('recepcao')).toBe('/semana')
  })

  it('suporte cai na lista de contas', () => {
    expect(destinoDoPapel('suporte')).toBe('/contas')
  })
})
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test -- tests/unit/destino.test.ts`
Esperado: FALHA com "Failed to resolve import ... core/acesso/destino".

- [ ] **Passo 3: Implementar**

Criar `src/core/acesso/destino.ts`:

```ts
export type Papel = 'dono' | 'recepcao' | 'profissional' | 'suporte'

/**
 * Ninguém escolhe onde começar: o papel decide.
 * Ver TELAS.md, "Regras que valem em todas as telas".
 */
export function destinoDoPapel(papel: Papel): string {
  switch (papel) {
    case 'profissional': return '/hoje'
    case 'dono':
    case 'recepcao':     return '/semana'
    case 'suporte':      return '/contas'
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test -- tests/unit/destino.test.ts`
Esperado: PASSA, 3 testes.

- [ ] **Passo 5: Escrever a conta ativa no servidor**

Criar `src/server/conta.ts`:

```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Papel } from '@/core/acesso/destino'

export async function clienteServidor() {
  const jar = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) => jar.set(name, value, options))
          } catch {
            // chamado de um Server Component: o middleware já renova o cookie
          }
        },
      },
    },
  )
}

export type ContaAtiva = { contaId: string; papel: Papel; nome: string }

/**
 * A conta em que o usuário está trabalhando. Quem tem uma só nunca escolhe;
 * quem tem várias escolhe em /contas, e a escolha fica no cookie.
 */
export async function contaAtiva(): Promise<ContaAtiva | null> {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('usuario_conta')
    .select('conta_id, papel, conta:conta_id(nome)')
    .eq('usuario_id', user.id)
    .eq('ativo', true)

  if (!data?.length) return null

  const jar = await cookies()
  const escolhida = jar.get('conta')?.value
  const linha = data.find((l) => l.conta_id === escolhida) ?? data[0]

  return {
    contaId: linha.conta_id,
    papel: linha.papel as Papel,
    nome: (linha.conta as unknown as { nome: string }).nome,
  }
}
```

- [ ] **Passo 6: Escrever a tela de entrar**

Criar `src/app/entrar/acoes.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { clienteServidor } from '@/server/conta'

export async function entrar(_estado: unknown, form: FormData) {
  const email = String(form.get('email') ?? '')
  const senha = String(form.get('senha') ?? '')

  const db = await clienteServidor()
  const { error } = await db.auth.signInWithPassword({ email, password: senha })

  // nunca revelar se o e-mail existe
  if (error) return { erro: 'E-mail ou senha não conferem.' }

  redirect('/')
}
```

Criar `src/app/entrar/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { entrar } from './acoes'

export default function Entrar() {
  const [estado, acao, pendente] = useActionState(entrar, null)

  return (
    <main>
      <h1>Verandi</h1>
      <form action={acao}>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" />

        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" required autoComplete="current-password" />

        {estado?.erro ? <p role="alert">{estado.erro}</p> : null}

        <button type="submit" disabled={pendente}>
          {pendente ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
```

Substituir `src/app/page.tsx` por:

```tsx
import { redirect } from 'next/navigation'
import { contaAtiva } from '@/server/conta'
import { destinoDoPapel } from '@/core/acesso/destino'

export default async function Raiz() {
  const conta = await contaAtiva()
  if (!conta) redirect('/entrar')
  redirect(destinoDoPapel(conta.papel))
}
```

- [ ] **Passo 7: Escrever o middleware que renova a sessão**

Criar `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req })

  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await db.auth.getUser()

  const publica = req.nextUrl.pathname.startsWith('/entrar') ||
                  req.nextUrl.pathname.startsWith('/convite')
  if (!user && !publica) {
    return NextResponse.redirect(new URL('/entrar', req.url))
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)'],
}
```

- [ ] **Passo 8: Configurar o ambiente local**

Criar `.env.example` (só nomes, nunca valores):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Gerar o `.env.local` a partir do Supabase local:

```bash
npx supabase status -o env | \
  sed -e 's/^API_URL=/NEXT_PUBLIC_SUPABASE_URL=/' \
      -e 's/^ANON_KEY=/NEXT_PUBLIC_SUPABASE_ANON_KEY=/' \
  > .env.local
npx supabase status -o env | \
  sed -e 's/^API_URL=/SUPABASE_URL=/' \
      -e 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/' \
  >> .env.local
```

Conferir que `.env*` está no `.gitignore` **antes** de qualquer `git add`.

- [ ] **Passo 9: Provar à mão que o login leva ao lugar certo**

```bash
npm run dev
```

Criar um usuário e ligar ele a uma conta como `profissional`:

```bash
node -e "
const {createClient}=require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
(async()=>{
  const a=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const {data:c}=await a.from('conta').insert({nome:'Estúdio de teste',slug:'teste'}).select().single();
  const {data:u}=await a.auth.admin.createUser({email:'carol@teste.local',password:'senha-de-teste-123',email_confirm:true});
  await a.from('usuario_conta').insert({usuario_id:u.user.id,conta_id:c.id,papel:'profissional'});
  console.log('pronto: carol@teste.local / senha-de-teste-123');
})();
"
```

Abrir `http://localhost:3000`, ser mandado para `/entrar`, entrar, e confirmar
que o destino é `/hoje` (que ainda dá 404 — a tela é do Plano 02; o que se prova
aqui é o roteamento).

- [ ] **Passo 10: Commitar**

```bash
git add -A
git commit -m "feat: login, sessão e destino por papel"
```

---

### Tarefa 10: Fechar o plano

**Arquivos:**
- Criar: `docs/ESTADO.md`
- Modificar: `README.md`

- [ ] **Passo 1: Rodar a suíte inteira**

Rodar: `npm test`
Esperado: todos os testes passam. Anotar o número.

- [ ] **Passo 2: Provar que o `core/` continua puro**

```bash
grep -rnE "from '(@supabase|next|@/server|@/app)" src/core/ && \
  echo "FALHOU: core importou o que não pode" || echo "core limpo"
```

Esperado: `core limpo`. Se falhar, o import tem que sair — é restrição global do
plano, não preferência de estilo.

- [ ] **Passo 3: Escrever o ESTADO**

Criar `docs/ESTADO.md` com: as versões instaladas (Tarefa 1, passo 2), o que
existe hoje, quantos testes passam, e a primeira tarefa do Plano 02.

- [ ] **Passo 4: Escrever o README**

Substituir o `README.md` do `create-next-app` por um que diga o que a Verandi é,
como subir (`npx supabase start` + `npm run dev`), como rodar teste, e que
aponte para `docs/`.

- [ ] **Passo 5: Commitar**

```bash
git add docs/ESTADO.md README.md
git commit -m "docs: estado do projeto ao fim do plano 01"
```

---

## Auto-revisão

**Cobertura da spec.** Do `ARQUITETURA.md`, este plano implementa: vocabulário
neutro (T2, T7), série → sessão → participação (T4), materialização sob demanda
com `UNIQUE` (T4, T8), o passado que não se reescreve (T4 — `sessao` copia
serviço, profissional, local e capacidade), capacidade que avisa sem bloquear
(T4, T6), multi-inquilino com RLS e política (T2, T3, T4), papéis (T2, T9), fuso
(T8), feriado que nasce cancelado em vez de sumir (T5, T8).

Fica **fora deste plano e é intencional**: eventos de saída, `token_api`,
`importacao` e `importacao_linha` — são marco 2 e plano 03, e criar tabela
"por garantia" antes de saber o formato real só acumula divergência (é a lição
registrada no `ARQUITETURA.md` do AutoFluxos).

Do `TELAS.md`, este plano entrega a tela 1 (Entrar) e o roteamento por papel. As
telas 4, 5, 6, 7, 8, 9 e 10 são o Plano 02; as telas 2, 3, 11, 12, 13, 14 e 15 são
o Plano 03.

**Consistência de tipos.** `Papel` está em `@/core/acesso/destino` e é o mesmo
nome do enum SQL `papel`. `StatusParticipacao` no `core` lista exatamente os sete
valores do enum `status_participacao` da T4. `Serie` no `core` usa `camelCase` e
a tabela usa `snake_case`; a tradução acontece só em `materializar.ts`, que é o
único lugar que atravessa a fronteira.

**Sem espaços em branco.** Todo passo de código tem o código. As duas coisas que
o plano deliberadamente não fixa são a versão do Next (decidida pelo
`create-next-app` e registrada no passo 1.2) e o significado de `XX` e `F EXP` na
planilha, que depende de perguntar à operação e só importa no Plano 03.
