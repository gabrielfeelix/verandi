# Plano 15, planos e valores

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Os passos estão em caixa (`- [ ]`) para marcar conforme andam. Teste
> antes do código, sempre.

**Objetivo:** a tabela de preços do negócio sai do documento e entra no sistema,
com código único, dois preços por plano e a forma de cobrança escrita de um
jeito que a recepção entende.

**Desenho:** um `plano` é o que se vende: nome, código, modalidade, como cobra
(mensal, trimestral, anual, avulsa ou pacote) e **dois preços**, o de quem já é
cliente de outra modalidade e o de quem não é. Quem escolhe qual preço vale é o
servidor, no ato da matrícula, e isso é o módulo 16. Aqui se constrói só o
catálogo, e junto duas colunas que ele precisa: o número da turma e a categoria
do serviço.

**Pilha:** Next 16, React 19, Supabase (schema `app_verandi`), Vitest,
Playwright.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), e o documento
do cliente na raiz do repositório.

**Telas:** `.desenho/Planos.dc.html` (fora do git).

## O que vale para todas as tarefas

- **Migration é a `0054`**, e o número se confere olhando `supabase/migrations/`
  antes de criar o arquivo. Ela começa com
  `set search_path = app_verandi, extensions;`.
- **Produção não entra neste plano.** Nada de `aplica-em-producao.mjs` até tudo
  passar no local. Nunca `supabase db push`.
- **`npm run tipos` depois da migration**, senão o `tsc` segue passando com a
  forma antiga do banco.
- **Dinheiro é inteiro, em centavos.** Coluna `..._cent`, `integer`, e a
  conversão para "R$ 735,00" mora em `core/`. Nenhum `float` em lugar nenhum.
- **A régua do vocabulário vale.** "Plano" é palavra nossa e não entra no
  vocabulário configurável, mas **modalidade é `servico`**, que é palavra do
  cliente: nada de "o serviço" nem "serviços ativos" colado nela.
- **Texto do produto não leva travessão.**
- **A recepção não cadastra preço.** Planos e valores é seção de Configuração,
  e Configuração já é só do dono.

## O modelo desta tarefa, em uma tela

```
plano   id · conta_id · codigo · nome · servico_id
        recorrencia (mensal|trimestral|semestral|anual|avulsa|pacote)
        parcelas · frequencia_semanal · sessoes_no_pacote · validade_meses
        preco_vinculado_cent · preco_avulso_cent · ativo · criado_em
        unique (conta_id, codigo)

serie.codigo        text, anulável, unique (conta_id, codigo)
servico.categoria   text, anulável
```

**Por que `recorrencia` e não só um número de meses:** "trimestral em 3
parcelas" e "pacote de 10 sessões com validade de 6 meses" são coisas
diferentes, e a segunda não tem competência mensal nenhuma. Um número de meses
sozinho obrigaria o módulo 17 a adivinhar qual dos dois é.

**Por que os dois preços são colunas e não duas linhas:** está em
[`13-administrativo.md`](13-administrativo.md), e é a decisão que não dá para
tomar duas vezes. Quando os dois valores são iguais, a tela mostra "mesma" em
vez de repetir o número.

---

### Tarefa 1: a tabela no banco

**Arquivos:**
- Criar: `supabase/migrations/0054_vr_planos.sql`
- Criar: `tests/planos.test.ts`
- Alterar: `src/server/banco.types.ts` (gerado, não escrito à mão)

**Produz:** as tabelas e colunas que todas as outras tarefas usam.

- [ ] **Passo 1: conferir o número da migration**

```bash
ls supabase/migrations/ | tail -3
```

Esperado: a última é `0053_vr_avaliacao.sql`. Se não for, o número desta muda.

- [ ] **Passo 2: escrever a migration**

Criar `supabase/migrations/0054_vr_planos.sql`:

```sql
-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O catálogo do que o negócio vende.
 *
 * O pedido nasceu de uma tabela de preços mantida à mão num documento, com
 * quarenta e dois planos, código repetido em três lugares e quatro linhas
 * rotuladas "aluno" que pelo preço são de não-aluno. Metade do valor deste
 * módulo é o banco recusar o código repetido; a outra metade é o preço parar
 * de ser digitado de novo a cada matrícula.
 *
 * Dois preços por plano, e não dois planos: o mesmo serviço custa um valor
 * para quem já é cliente de outra modalidade e outro para quem não é. Escrito
 * como dois planos, o recibo diz o nome errado e o relatório soma serviço com
 * serviço. Ver docs/planos/13-administrativo.md.
 *
 * Dinheiro é inteiro em centavos. Ponto flutuante em parcela produz dízima, e
 * a diferença aparece no recibo, que é o único lugar onde ela não pode
 * aparecer.
 */
create table if not exists plano (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  codigo text not null,
  nome text not null,
  servico_id uuid not null references servico(id) on delete restrict,
  recorrencia text not null
    check (recorrencia in ('mensal','trimestral','semestral','anual','avulsa','pacote')),
  parcelas int not null default 1 check (parcelas >= 1),
  frequencia_semanal int check (frequencia_semanal is null or frequencia_semanal >= 1),
  sessoes_no_pacote int check (sessoes_no_pacote is null or sessoes_no_pacote >= 1),
  validade_meses int check (validade_meses is null or validade_meses >= 1),
  preco_vinculado_cent int not null check (preco_vinculado_cent >= 0),
  preco_avulso_cent int not null check (preco_avulso_cent >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (conta_id, codigo),
  -- pacote sem quantidade é pacote de quantas sessões? a pergunta não tem
  -- resposta depois, então ela é feita agora
  check (recorrencia <> 'pacote' or sessoes_no_pacote is not null)
);

create index plano_conta_ix on plano (conta_id) where ativo;

comment on table plano is
  'o catálogo do que a conta vende, com código único e dois preços; ver 0054';
comment on column plano.preco_vinculado_cent is
  'preço de quem já é cliente de outra modalidade, em centavos';
comment on column plano.preco_avulso_cent is
  'preço de quem não é, em centavos; igual ao outro quando o plano tem preço único';

/*
 * O número da turma.
 *
 * O documento do cliente chama as setenta turmas de "001 - Segunda 7h00", e a
 * recepção fala por esse número no telefone. Anulável porque conta nenhuma é
 * obrigada a numerar turma, e único por conta porque número repetido não
 * identifica nada.
 */
alter table serie add column if not exists codigo text;
create unique index if not exists serie_codigo_ix
  on serie (conta_id, codigo) where codigo is not null;

/*
 * A categoria da modalidade.
 *
 * A lista de planos separa "Pilates" de "Fisioterapia e terapias", e são sete
 * serviços de um lado só. Texto anulável, e não tabela: é um agrupamento de
 * exibição, e tabela para três palavras cobra manutenção sem devolver nada.
 */
alter table servico add column if not exists categoria text;

alter table plano enable row level security;

create policy plano_conta on plano for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));
```

- [ ] **Passo 3: aplicar no banco local e gerar tipos**

```bash
npx supabase start
npx supabase db reset
npm run tipos
```

Esperado: `banco.types.ts` passa a ter `plano`, e `serie` ganha `codigo`.

- [ ] **Passo 4: escrever o teste de banco**

Criar `tests/planos.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'

/**
 * O que só o banco responde: o código repetido, o isolamento entre contas e o
 * pacote sem quantidade. O preço aplicado não está aqui de propósito: é regra
 * de produto e mora em `tests/unit/planos.test.ts`.
 */
describe('plano no banco', () => {
  const db = admin()
  let contaA: string, contaB: string, servicoA: string, servicoB: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: a } = await db.from('conta')
      .insert({ nome: 'Estúdio A', slug: `pl-a-${m}` }).select().single()
    const { data: b } = await db.from('conta')
      .insert({ nome: 'Estúdio B', slug: `pl-b-${m}` }).select().single()
    contaA = a!.id
    contaB = b!.id

    const { data: sa } = await db.from('servico')
      .insert({ conta_id: contaA, nome: 'Pilates aparelho' }).select().single()
    const { data: sb } = await db.from('servico')
      .insert({ conta_id: contaB, nome: 'Pilates aparelho' }).select().single()
    servicoA = sa!.id
    servicoB = sb!.id
  })

  it('o mesmo código não entra duas vezes na mesma conta', async () => {
    const base = {
      conta_id: contaA, servico_id: servicoA, recorrencia: 'mensal',
      preco_vinculado_cent: 45000, preco_avulso_cent: 45000,
    }
    const primeiro = await db.from('plano')
      .insert({ ...base, codigo: '001', nome: 'Mensal 1x por semana' })
    expect(primeiro.error).toBeNull()

    const repetido = await db.from('plano')
      .insert({ ...base, codigo: '001', nome: 'Outro plano qualquer' })
    expect(repetido.error?.code).toBe('23505')
  })

  it('o mesmo código vale em contas diferentes', async () => {
    const { error } = await db.from('plano').insert({
      conta_id: contaB, servico_id: servicoB, codigo: '001',
      nome: 'Mensal 1x por semana', recorrencia: 'mensal',
      preco_vinculado_cent: 45000, preco_avulso_cent: 45000,
    })
    expect(error).toBeNull()
  })

  it('pacote sem quantidade de sessões é recusado', async () => {
    const { error } = await db.from('plano').insert({
      conta_id: contaA, servico_id: servicoA, codigo: '900',
      nome: 'Pacote sem número', recorrencia: 'pacote',
      preco_vinculado_cent: 100000, preco_avulso_cent: 100000,
    })
    expect(error).not.toBeNull()
  })

  it('a turma não aceita dois números iguais na mesma conta', async () => {
    const serie = {
      conta_id: contaA, servico_id: servicoA, dia_semana: 1,
      hora_inicio: '07:00', duracao_min: 60, capacidade: 6,
      vigencia_inicio: '2026-01-01',
    }
    const um = await db.from('serie').insert({ ...serie, codigo: '001' })
    expect(um.error).toBeNull()
    const dois = await db.from('serie').insert({ ...serie, codigo: '001' })
    expect(dois.error?.code).toBe('23505')
  })

  it('turma sem número continua entrando, quantas forem', async () => {
    const serie = {
      conta_id: contaA, servico_id: servicoA, dia_semana: 2,
      hora_inicio: '08:00', duracao_min: 60, capacidade: 6,
      vigencia_inicio: '2026-01-01',
    }
    expect((await db.from('serie').insert(serie)).error).toBeNull()
    expect((await db.from('serie').insert(serie)).error).toBeNull()
  })
})
```

- [ ] **Passo 5: rodar e ver passar**

```bash
npx vitest run tests/planos.test.ts
```

Esperado: 5 passam.

- [ ] **Passo 6: commit**

```bash
git add supabase/migrations/0054_vr_planos.sql tests/planos.test.ts src/server/banco.types.ts
git commit -m "feat: o catálogo de planos nasce no banco, com código único por conta"
```

---

### Tarefa 2: as regras, em `core`

**Arquivos:**
- Criar: `src/core/planos/plano.ts`
- Criar: `tests/unit/planos.test.ts`

**Consome:** nada. É a camada sem banco e sem tela.

**Produz:**
- `emReais(cent: number): string`
- `emCentavos(texto: string): number | null`
- `precoAplicado(plano: PlanoBase, temVinculo: boolean): { cent: number; vinculo: boolean }`
- `comoCobra(plano: PlanoBase): string`
- `type Recorrencia`, `type PlanoBase`

- [ ] **Passo 1: escrever o teste**

Criar `tests/unit/planos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emReais, emCentavos, precoAplicado, comoCobra } from '@/core/planos/plano'

describe('dinheiro', () => {
  it('escreve centavos como a recepção lê', () => {
    expect(emReais(73500)).toBe('R$ 735,00')
    expect(emReais(19800000)).toBe('R$ 198.000,00')
    expect(emReais(0)).toBe('R$ 0,00')
    expect(emReais(5)).toBe('R$ 0,05')
  })

  it('lê o que a pessoa digita, com vírgula ou ponto', () => {
    expect(emCentavos('735,00')).toBe(73500)
    expect(emCentavos('735')).toBe(73500)
    expect(emCentavos('1.980,00')).toBe(198000)
    expect(emCentavos('R$ 195,50')).toBe(19550)
  })

  it('recusa o que não é número, em vez de virar zero', () => {
    // zero silencioso é o defeito clássico daqui: o plano entra valendo nada
    expect(emCentavos('')).toBeNull()
    expect(emCentavos('abc')).toBeNull()
    expect(emCentavos('-10')).toBeNull()
  })
})

describe('preço aplicado', () => {
  const fisio = {
    recorrencia: 'avulsa' as const, parcelas: 1,
    precoVinculadoCent: 19500, precoAvulsoCent: 23000,
    frequenciaSemanal: null, sessoesNoPacote: null, validadeMeses: null,
  }

  it('quem já é cliente de outra modalidade paga o preço de vínculo', () => {
    expect(precoAplicado(fisio, true)).toEqual({ cent: 19500, vinculo: true })
  })

  it('quem não é paga o cheio', () => {
    expect(precoAplicado(fisio, false)).toEqual({ cent: 23000, vinculo: false })
  })

  it('plano de preço único não marca vínculo, mesmo para quem tem', () => {
    // dizer "aplicamos o preço de aluno" num plano de preço único faz a
    // recepção procurar um desconto que não existe
    const mensal = { ...fisio, precoVinculadoCent: 73500, precoAvulsoCent: 73500 }
    expect(precoAplicado(mensal, true)).toEqual({ cent: 73500, vinculo: false })
  })
})

describe('como cobra', () => {
  const base = {
    parcelas: 1, precoVinculadoCent: 0, precoAvulsoCent: 0,
    frequenciaSemanal: null, sessoesNoPacote: null, validadeMeses: null,
  }

  it('diz a frequência quando o plano tem uma', () => {
    expect(comoCobra({ ...base, recorrencia: 'mensal', frequenciaSemanal: 2 }))
      .toBe('Todo mês · 2 horários')
    expect(comoCobra({ ...base, recorrencia: 'mensal', frequenciaSemanal: 1 }))
      .toBe('Todo mês · 1 horário')
  })

  it('conta as parcelas quando são mais de uma', () => {
    expect(comoCobra({
      ...base, recorrencia: 'trimestral', parcelas: 3, frequenciaSemanal: 2,
    })).toBe('3 parcelas · 2 horários')
  })

  it('o pacote fala em sessões e validade, que é o que ele é', () => {
    expect(comoCobra({
      ...base, recorrencia: 'pacote', sessoesNoPacote: 10, validadeMeses: 6,
    })).toBe('10 sessões · validade 6 meses')
  })

  it('a avulsa não promete repetição nenhuma', () => {
    expect(comoCobra({ ...base, recorrencia: 'avulsa' })).toBe('Uma vez')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run tests/unit/planos.test.ts
```

Esperado: falha com "Cannot find module '@/core/planos/plano'".

- [ ] **Passo 3: escrever o módulo**

Criar `src/core/planos/plano.ts`:

```ts
/**
 * O que se vende, e por quanto.
 *
 * Sem banco e sem tela de propósito: a mesma regra é lida pela Configuração,
 * pela matrícula e um dia pela API, e regra copiada em três lugares diverge no
 * dia em que só dois deles forem corrigidos.
 */

export type Recorrencia =
  | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'avulsa' | 'pacote'

export type PlanoBase = {
  recorrencia: Recorrencia
  parcelas: number
  frequenciaSemanal: number | null
  sessoesNoPacote: number | null
  validadeMeses: number | null
  precoVinculadoCent: number
  precoAvulsoCent: number
}

/** Centavos viram o que a recepção lê em voz alta. */
export function emReais(cent: number): string {
  return (cent / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).replace(/ /g, ' ')
}

/**
 * O que a pessoa digitou vira centavos, ou `null`.
 *
 * `null` e não zero: valor que não deu para ler precisa parar o formulário, e
 * um plano que entra valendo R$ 0,00 só é descoberto na primeira cobrança.
 */
export function emCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null
  // "1.980,00": o ponto é milhar e a vírgula é decimal, que é como se escreve
  // dinheiro em português
  const normal = limpo.replace(/\./g, '').replace(',', '.')
  const n = Number(normal)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/**
 * Qual dos dois preços vale, e se houve desconto de vínculo.
 *
 * Plano de preço único devolve `vinculo: false` mesmo para quem tem vínculo:
 * anunciar um desconto que não existe faz a recepção procurar o valor cheio
 * que nunca foi cobrado.
 */
export function precoAplicado(
  plano: Pick<PlanoBase, 'precoVinculadoCent' | 'precoAvulsoCent'>,
  temVinculo: boolean,
): { cent: number; vinculo: boolean } {
  const temDoisPrecos = plano.precoVinculadoCent !== plano.precoAvulsoCent
  const usaVinculo = temVinculo && temDoisPrecos
  return {
    cent: usaVinculo ? plano.precoVinculadoCent : plano.precoAvulsoCent,
    vinculo: usaVinculo,
  }
}

/** A frase que a lista mostra na coluna "Cobrança". */
export function comoCobra(plano: PlanoBase): string {
  const horarios = plano.frequenciaSemanal
    ? `${plano.frequenciaSemanal} ${plano.frequenciaSemanal === 1 ? 'horário' : 'horários'}`
    : null

  if (plano.recorrencia === 'pacote') {
    const partes = [`${plano.sessoesNoPacote} sessões`]
    if (plano.validadeMeses) partes.push(`validade ${plano.validadeMeses} meses`)
    return partes.join(' · ')
  }

  if (plano.recorrencia === 'avulsa') return 'Uma vez'

  const quando = plano.parcelas > 1
    ? `${plano.parcelas} parcelas`
    : 'Todo mês'

  return [quando, horarios].filter(Boolean).join(' · ')
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run tests/unit/planos.test.ts
```

Esperado: 10 passam.

- [ ] **Passo 5: commit**

```bash
git add src/core/planos/plano.ts tests/unit/planos.test.ts
git commit -m "feat: as regras de preço e de cobrança do plano, sem banco e sem tela"
```

---

### Tarefa 3: ler e escrever plano no servidor

**Arquivos:**
- Criar: `src/server/planos/consultas.ts`
- Criar: `src/server/planos/acoes.ts`

**Consome:** `PlanoBase`, `Recorrencia` de `@/core/planos/plano`.

**Produz:**
- `listarPlanos(db, contaId): Promise<PlanoLinha[]>`
- `criarPlano(entrada: EntradaDePlano): Promise<{ id: string }>`
- `editarPlano(id: string, entrada: EntradaDePlano): Promise<void>`
- `alternarPlano(id: string, ativo: boolean): Promise<void>`
- `type PlanoLinha = PlanoBase & { id, codigo, nome, servicoId, servicoNome, categoria, ativo }`

- [ ] **Passo 1: escrever as consultas**

Criar `src/server/planos/consultas.ts`:

```ts
import type { Db } from '../banco'
import type { PlanoBase, Recorrencia } from '@/core/planos/plano'

export type PlanoLinha = PlanoBase & {
  id: string
  codigo: string
  nome: string
  servicoId: string
  servicoNome: string
  categoria: string | null
  ativo: boolean
}

/**
 * Todos os planos da conta, inclusive os desativados.
 *
 * A tela precisa dos dois: "só os inativos" é um filtro dela, e buscar de novo
 * ao trocar o filtro faria a página piscar por uma decisão que já está na mão.
 */
export async function listarPlanos(db: Db, contaId: string): Promise<PlanoLinha[]> {
  const { data, error } = await db
    .from('plano')
    .select(`
      id, codigo, nome, servico_id, recorrencia, parcelas, frequencia_semanal,
      sessoes_no_pacote, validade_meses, preco_vinculado_cent,
      preco_avulso_cent, ativo, servico(nome, categoria)
    `)
    .eq('conta_id', contaId)
    .order('codigo')

  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    servicoId: p.servico_id,
    servicoNome: p.servico?.nome ?? '',
    categoria: p.servico?.categoria ?? null,
    recorrencia: p.recorrencia as Recorrencia,
    parcelas: p.parcelas,
    frequenciaSemanal: p.frequencia_semanal,
    sessoesNoPacote: p.sessoes_no_pacote,
    validadeMeses: p.validade_meses,
    precoVinculadoCent: p.preco_vinculado_cent,
    precoAvulsoCent: p.preco_avulso_cent,
    ativo: p.ativo,
  }))
}
```

- [ ] **Passo 2: escrever as ações**

Criar `src/server/planos/acoes.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import type { Recorrencia } from '@/core/planos/plano'

export type EntradaDePlano = {
  codigo: string
  nome: string
  servicoId: string
  recorrencia: Recorrencia
  parcelas: number
  frequenciaSemanal: number | null
  sessoesNoPacote: number | null
  validadeMeses: number | null
  precoVinculadoCent: number
  precoAvulsoCent: number
}

async function exigirDono() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    throw new Error('só quem responde pelo negócio mexe em preço')
  }
  return conta
}

function paraLinha(e: EntradaDePlano) {
  return {
    codigo: e.codigo.trim(),
    nome: e.nome.trim(),
    servico_id: e.servicoId,
    recorrencia: e.recorrencia,
    parcelas: e.parcelas,
    frequencia_semanal: e.frequenciaSemanal,
    sessoes_no_pacote: e.sessoesNoPacote,
    validade_meses: e.validadeMeses,
    preco_vinculado_cent: e.precoVinculadoCent,
    preco_avulso_cent: e.precoAvulsoCent,
  }
}

/**
 * `23505` é o único erro desta tela que a pessoa resolve sozinha, e a mensagem
 * do Postgres não diz o que fazer. O documento do cliente tem o código 104 em
 * dois planos e o 119 em quatro linhas: recusar sem dizer de quem é o código
 * transforma a correção numa caça ao tesouro por quarenta e duas linhas.
 */
async function comCodigoLegivel<T>(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string, codigo: string, executar: () => Promise<T>,
): Promise<T> {
  try {
    return await executar()
  } catch (e) {
    const erro = e as { code?: string }
    if (erro.code !== '23505') throw e
    const { data } = await db.from('plano')
      .select('nome').eq('conta_id', contaId).eq('codigo', codigo.trim())
      .maybeSingle<{ nome: string }>()
    throw new Error(
      data
        ? `O código ${codigo.trim()} já é de "${data.nome}". Escolha outro.`
        : `O código ${codigo.trim()} já está em uso nesta conta.`,
    )
  }
}

export async function criarPlano(entrada: EntradaDePlano): Promise<{ id: string }> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  const id = await comCodigoLegivel(db, conta.contaId, entrada.codigo, async () => {
    const { data, error } = await db.from('plano')
      .insert({ conta_id: conta.contaId, ...paraLinha(entrada) })
      .select('id').single<{ id: string }>()
    if (error) throw error
    return data.id
  })

  await registrar(db, {
    contaId: conta.contaId, entidade: 'plano', entidadeId: id, acao: 'criou',
  })
  revalidatePath('/config')
  return { id }
}

export async function editarPlano(id: string, entrada: EntradaDePlano): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()

  await comCodigoLegivel(db, conta.contaId, entrada.codigo, async () => {
    const { error } = await db.from('plano')
      .update(paraLinha(entrada)).eq('id', id).eq('conta_id', conta.contaId)
    if (error) throw error
  })

  await registrar(db, {
    contaId: conta.contaId, entidade: 'plano', entidadeId: id, acao: 'editou',
  })
  revalidatePath('/config')
}

/**
 * Desativar, e não apagar: um plano que já foi vendido continua nomeando
 * contratos e recibos antigos, e apagá-lo faria o histórico apontar para nada.
 */
export async function alternarPlano(id: string, ativo: boolean): Promise<void> {
  const conta = await exigirDono()
  const db = await clienteServidor()
  const { error } = await db.from('plano')
    .update({ ativo }).eq('id', id).eq('conta_id', conta.contaId)
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'plano', entidadeId: id,
    acao: ativo ? 'reativou' : 'desativou',
  })
  revalidatePath('/config')
}
```

- [ ] **Passo 3: conferir que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erro. Se `registrar` reclamar do valor de `entidade`, é porque o
tipo é fechado: acrescentar `'plano'` a ele em `src/server/log.ts`.

- [ ] **Passo 4: commit**

```bash
git add src/server/planos/
git commit -m "feat: ler e escrever plano, com o código repetido dizendo de quem ele é"
```

---

### Tarefa 4: a tela de Planos e valores

**Arquivos:**
- Criar: `src/components/config/planos.tsx`
- Alterar: `src/app/(app)/config/page.tsx` (a lista `SECOES` e a montagem da seção)

**Consome:** `listarPlanos`, `criarPlano`, `editarPlano`, `alternarPlano`,
`emReais`, `emCentavos`, `comoCobra`.

- [ ] **Passo 1: acrescentar a seção ao menu**

Em `src/app/(app)/config/page.tsx`, dentro de `SECOES`, depois de `servicos`:

```ts
  { chave: 'planos', icone: 'lista' },
```

E na montagem, junto das outras seções:

```tsx
        {secao === 'planos' ? (
          <SecaoPlanos
            planos={await listarPlanos(db, conta.contaId)}
            servicos={await listarServicos(db, conta.contaId)}
            rotuloServico={rotulos.servico}
          />
        ) : null}
```

O rótulo da seção é "Planos e valores", fixo: plano é palavra nossa.

- [ ] **Passo 2: escrever a tela**

Criar `src/components/config/planos.tsx`, seguindo `catalogo.tsx` como
referência de estrutura (o `PainelConfig`, o `ModalFormulario`, o `Campo`). A
tela tem:

- o cabeçalho com contagem: "15 planos · 14 ativos";
- o filtro por modalidade, mais a caixa "Só os inativos";
- a lista **agrupada por `categoria`**, e os planos sem categoria num grupo
  final chamado pelo plural da palavra do cliente para serviço;
- as colunas Cód, Plano, Cobrança, Preço aluno, Preço cheio, Situação;
- **"mesma"** na coluna do preço cheio quando os dois valores são iguais;
- o modal de criar e editar, com os campos condicionais: `frequencia_semanal`
  só aparece para plano com recorrência que se repete, e `sessoes_no_pacote`
  mais `validade_meses` só para pacote.

A nota que o desenho traz, e que explica a coluna dupla, entra como `Nota` no
topo da seção:

```tsx
<Nota tom="neutro">
  Um plano, dois preços. Quem já tem plano ativo de outra modalidade paga a
  tabela de cliente; quem chega só para esta paga a cheia. O sistema escolhe
  no ato da matrícula e mostra qual usou.
</Nota>
```

- [ ] **Passo 3: conferir na tela**

```bash
npm run dev
```

Entrar com `dono@dev.local`, senha `senha-de-teste-123`, e abrir
`/config?s=planos`. Cadastrar um plano mensal e um pacote, e conferir que a
coluna Cobrança diz "Todo mês · 2 horários" e "10 sessões · validade 6 meses".

- [ ] **Passo 4: commit**

```bash
git add src/components/config/planos.tsx "src/app/(app)/config/page.tsx"
git commit -m "feat: a tabela de preços do negócio ganha tela, agrupada por modalidade"
```

---

### Tarefa 5: o número da turma e a categoria da modalidade

**Arquivos:**
- Alterar: `src/components/grade/editor-serie.tsx` (campo novo no formulário)
- Alterar: `src/components/grade/linha-da-grade.tsx` (campo no editar, número na linha)
- Alterar: `src/server/config/acoes.ts` (a ação que grava série aceita `codigo`)
- Alterar: `src/components/config/catalogo.tsx` (campo `categoria` no serviço)

- [ ] **Passo 1: o campo do número no criar e no editar**

Nos dois formulários de série, um `Campo` com rótulo "Número da turma", dica
"opcional, é como a recepção chama a turma no telefone", aceitando texto curto.
Ele **não** é obrigatório, e a tela diz isso.

- [ ] **Passo 2: o número aparece na linha da grade**

Antes do horário, em `font-mono`, quando existe. Sem número, nada muda de
lugar: a coluna não pode abrir um buraco em conta que não numera turma.

- [ ] **Passo 3: a categoria no cadastro de modalidade**

Em `catalogo.tsx`, no modal do serviço, um `Campo` com rótulo "Categoria",
dica "junta modalidades parecidas na tabela de preços; deixe em branco se não
precisar".

- [ ] **Passo 4: conferir na tela e commitar**

```bash
npm run dev
```

Criar uma turma com número, tentar criar outra com o mesmo número, e ver o erro
legível. Depois:

```bash
git add src/components/grade/ src/components/config/catalogo.tsx src/server/config/acoes.ts
git commit -m "feat: a turma ganha número e a modalidade ganha categoria"
```

---

### Tarefa 6: a jornada pela tela

**Arquivos:**
- Criar: `e2e/planos.spec.ts`

- [ ] **Passo 1: escrever o teste**

Criar `e2e/planos.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { admin, contaDeTeste, usuarioDe, entrar, escolher } from './apoio'

/**
 * O que este arquivo cobre e nenhum outro cobre: que a tabela de preços entra
 * pela tela, que o código repetido é recusado com o nome do dono do código, e
 * que a recepção não alcança a tela de preço.
 */
test('cadastrar plano, e o código repetido dizer de quem é', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio dos planos')
  const { email } = await usuarioDe(contaId, 'dono', marca)
  await admin.from('servico').insert({ conta_id: contaId, nome: 'Pilates aparelho' })

  await entrar(page, email)
  await page.goto('/config?s=planos')

  await page.getByRole('button', { name: 'Novo plano' }).click()
  await page.getByLabel('Código').fill('002')
  await page.getByLabel('Nome do plano').fill('Mensal, 2x por semana')
  await escolher(page, 'Modalidade', 'Pilates aparelho')
  await escolher(page, 'Como cobra', 'Todo mês')
  await page.getByLabel('Horários por semana').fill('2')
  await page.getByLabel('Preço de cliente').fill('735,00')
  await page.getByLabel('Preço cheio').fill('735,00')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  await expect(page.getByText('Mensal, 2x por semana')).toBeVisible()
  await expect(page.getByText('Todo mês · 2 horários')).toBeVisible()
  // preço igual nos dois não se repete na tela: repetir número igual faz
  // procurar a diferença que não existe
  await expect(page.getByText('mesma').first()).toBeVisible()

  await page.getByRole('button', { name: 'Novo plano' }).click()
  await page.getByLabel('Código').fill('002')
  await page.getByLabel('Nome do plano').fill('Qualquer outro')
  await escolher(page, 'Modalidade', 'Pilates aparelho')
  await page.getByLabel('Preço de cliente').fill('100,00')
  await page.getByLabel('Preço cheio').fill('100,00')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  await expect(page.getByText(/O código 002 já é de "Mensal, 2x por semana"/))
    .toBeVisible()
})

test('a recepção não alcança a tabela de preços', async ({ page }) => {
  const { contaId, marca } = await contaDeTeste('Estúdio sem recepção no preço')
  const { email } = await usuarioDe(contaId, 'recepcao', marca)

  await entrar(page, email)
  await page.goto('/config?s=planos')

  // Configuração inteira já é do dono: a recepção não vê nem a porta
  await expect(page).not.toHaveURL(/\/config/)
})
```

- [ ] **Passo 2: rodar e ver falhar, depois passar**

```bash
npx playwright test e2e/planos.spec.ts
```

Se o rótulo de algum campo não bater, **o rótulo do teste é que se ajusta ao da
tela**, e não o contrário: foi assim que dezesseis testes quebraram em 16/08.

- [ ] **Passo 3: rodar tudo**

```bash
npx vitest run && npx playwright test && npm run build && npm run segredos
```

- [ ] **Passo 4: commit**

```bash
git add e2e/planos.spec.ts
git commit -m "test: a jornada da tabela de preços, do cadastro ao código repetido"
```

---

## Quando este plano termina

- `/config?s=planos` cadastra, edita e desativa plano, agrupado por categoria.
- Código repetido é recusado dizendo de quem é o código.
- Turma tem número, e número repetido é recusado.
- Nada de dinheiro em ponto flutuante.
- Suíte inteira verde, build passando, e nenhum segredo no repositório.

**O que este plano deliberadamente não faz:** matricular ninguém, cobrar nada e
emitir papel nenhum. Contrato é o módulo 16, e é lá que `precoAplicado` deixa de
ser função testada e passa a decidir dinheiro de verdade.

**Produção fica para depois de os dois módulos estarem de pé**, e passa por
`node scripts/aplica-em-producao.mjs`, com a conferência de cinco passos do
`HANDOFF.md`.
