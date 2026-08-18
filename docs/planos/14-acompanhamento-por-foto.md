# Plano 14, acompanhamento por foto

> **Para quem executa:** cada tarefa termina em algo testável sozinho, e em um
> commit. Os passos estão em caixa (`- [ ]`) para marcar conforme andam.

**Objetivo:** quem atende registra uma avaliação com data, observação e uma foto
por posição, e enxerga a mesma posição em duas datas lado a lado.

**Desenho:** uma `avaliacao` é a visita, com data e quem avaliou; cada
`avaliacao_foto` é uma posição dentro dela. As posições são linhas da conta, não
lista fixa no código, porque "Flexão de coluna" é do pilates e "Perfil direito"
é da ortodontia. As imagens moram em balde privado e chegam à tela como endereço
assinado com prazo.

**Pilha:** Next 16, React 19, Supabase (schema `app_verandi`), Vitest,
Playwright.

**Especificação:** [`13-administrativo.md`](13-administrativo.md), e o documento
do cliente na raiz do repositório.

> **Feito em 18/08, e o que ficou de fora.** As sete tarefas foram executadas e
> a `0053` está aplicada em produção. **Três verificações não rodaram**, e não
> por decisão: o Docker da máquina estava sem integração com o WSL, o Supabase
> local não subia, e sem banco não há `npm run tipos`, nem teste de banco, nem
> teste de navegador. Os dois arquivos de teste estão escritos e esperando.
> Quem pegar isto com Docker de pé roda os três primeiro, antes de qualquer
> coisa nova.
>
> Três coisas mudaram em relação ao que este plano dizia, e as três estão nos
> commits: o comentário ao lado de elemento dentro de ramo de ternário quebra o
> JSX e precisa de fragmento; o `<Chip>` escreve o próprio `className` depois do
> spread, então `className` vindo de fora some calado; e `anonimizarPessoa`
> tinha um defeito antigo, deixava a foto da ficha no balde desde a `0051`.

## Restrições que valem para todas as tarefas

- Migration começa com `set search_path = app_verandi, extensions;` e usa o
  próximo número livre de `supabase/migrations/`, que hoje é **`0053`**.
- Nunca `supabase db push` nem `supabase db reset` contra produção. Local pode.
- Depois da migration: `npx supabase db reset` e **`npm run tipos`**.
- Todo cliente Supabase declara `db: { schema: ESQUEMA }`.
- Texto do produto **não leva travessão**. Vírgula, ponto ou dois-pontos.
- Nem artigo nem adjetivo colado na palavra do cliente. O lint é
  `tests/unit/regua-do-vocabulario.test.ts`.
- Cor de texto passa por `tests/unit/contraste.test.ts`.
- Alvo de toque de 44px no que se usa em pé.
- `core/` não importa Next, Supabase nem rede.
- Antes de dizer que acabou: `npm test`, `npm run build`, `npm run test:e2e`,
  `npm run segredos`.

## Quem enxerga o quê, e por quê

| Papel | Vê a aba | Sobe foto | Apaga avaliação |
|---|---|---|---|
| dono | sim | sim | sim |
| profissional | sim | sim | sim, a que ele criou |
| recepcao | **não** | não | não |
| suporte | sim | sim | não |

A recepção fica de fora porque foto de corpo é dado de saúde, e quem marca aula
não precisa dela para trabalhar. Não é RLS: papel do produto é linha em
`usuario_conta`, e quem filtra é `src/server`, como já acontece com a observação
da participação (ver `0043`).

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| Criar `supabase/migrations/0053_vr_avaliacao.sql` | três tabelas, o balde e as políticas |
| Criar `src/core/avaliacao/posicoes.ts` | as seis posições padrão e a ordenação |
| Criar `src/core/avaliacao/comparar.ts` | escolher o par de datas a comparar |
| Criar `src/server/avaliacao/consultas.ts` | ler avaliações, posições e endereços assinados |
| Criar `src/server/avaliacao/acoes.ts` | criar, subir foto, apagar, gerir posição |
| Criar `src/components/avaliacao/matriz.tsx` | posição por data, com ampliar |
| Criar `src/components/avaliacao/comparador.tsx` | duas datas lado a lado |
| Criar `src/components/avaliacao/nova-avaliacao.tsx` | o modal de registro |
| Modificar `src/app/(app)/pessoas/[id]/page.tsx` | a aba nova |
| Criar `tests/unit/avaliacao.test.ts` | posições e comparação, sem banco |
| Criar `tests/avaliacao.test.ts` | RLS, papéis e o fluxo inteiro |
| Criar `e2e/avaliacao.spec.ts` | registrar e comparar pela tela |

---

## Tarefa 1: o modelo e o balde

**Arquivos:**
- Criar: `supabase/migrations/0053_vr_avaliacao.sql`
- Teste: `tests/avaliacao.test.ts`

**Interfaces:**
- Produz: tabelas `posicao_avaliacao`, `avaliacao`, `avaliacao_foto`; balde
  `foto-avaliacao`.

- [x] **Passo 1: escrever a migration**

```sql
set search_path = app_verandi, extensions;

/*
 * O acompanhamento por foto.
 *
 * O pedido nasceu do pilates, onde a correção postural só se prova comparando a
 * mesma posição em duas datas. Vale igual para fisioterapia, para estética e
 * para qualquer negócio onde o resultado é visual: o que muda entre eles é a
 * lista de posições, e por isso ela é linha da conta, não lista no código.
 *
 * Foto de corpo é dado de saúde. O balde é privado, o caminho começa pela
 * conta, e a recepção não lê. Quem filtra papel é `src/server`, porque papel do
 * produto é linha em `usuario_conta` e não papel do banco (ver 0043).
 */
create table if not exists posicao_avaliacao (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (conta_id, nome)
);

create table if not exists avaliacao (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  pessoa_id uuid not null references pessoa(id) on delete cascade,
  data date not null,
  profissional_id uuid references profissional(id) on delete set null,
  observacao text,
  criado_por_usuario_id uuid,
  criado_em timestamptz not null default now()
);

create index if not exists avaliacao_pessoa_ix on avaliacao (pessoa_id, data desc);

/*
 * Uma foto por posição por avaliação: repetir a posição na mesma visita não é
 * dado a mais, é a segunda tentativa da mesma foto, e quem compara acaba
 * olhando a errada. Trocar é sobrescrever.
 */
create table if not exists avaliacao_foto (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  avaliacao_id uuid not null references avaliacao(id) on delete cascade,
  posicao_id uuid not null references posicao_avaliacao(id) on delete restrict,
  path text not null,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (avaliacao_id, posicao_id)
);

alter table posicao_avaliacao enable row level security;
alter table avaliacao enable row level security;
alter table avaliacao_foto enable row level security;

create policy posicao_avaliacao_conta on posicao_avaliacao for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy avaliacao_conta on avaliacao for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy avaliacao_foto_conta on avaliacao_foto for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-avaliacao', 'foto-avaliacao', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists foto_avaliacao_le on storage.objects;
drop policy if exists foto_avaliacao_escreve on storage.objects;
drop policy if exists foto_avaliacao_atualiza on storage.objects;
drop policy if exists foto_avaliacao_apaga on storage.objects;

create policy foto_avaliacao_le on storage.objects for select
  using (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

create policy foto_avaliacao_escreve on storage.objects for insert
  with check (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

create policy foto_avaliacao_atualiza on storage.objects for update
  using (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

create policy foto_avaliacao_apaga on storage.objects for delete
  using (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
```

- [x] **Passo 2: aplicar no banco local e gerar os tipos**

```bash
npx supabase db reset && node scripts/semear-dev.mjs && npm run tipos
```

Esperado: `banco.types.ts` passa a ter `avaliacao`, `avaliacao_foto` e
`posicao_avaliacao`.

- [x] **Passo 3: teste de que a conta vizinha não enxerga**

```ts
// tests/avaliacao.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

describe('avaliação, isolamento por conta', () => {
  const db = admin()
  let contaA: string, contaB: string, pessoaA: string, avaliacaoA: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: a } = await db.from('conta')
      .insert({ nome: 'Estúdio A', slug: `av-a-${m}` }).select().single()
    const { data: b } = await db.from('conta')
      .insert({ nome: 'Estúdio B', slug: `av-b-${m}` }).select().single()
    contaA = a!.id; contaB = b!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaA, nome: 'Marina Ferraz', ativo: true }).select().single()
    pessoaA = p!.id

    const { data: av } = await db.from('avaliacao')
      .insert({ conta_id: contaA, pessoa_id: pessoaA, data: '2026-08-18' })
      .select().single()
    avaliacaoA = av!.id
  })

  it('a conta B não lê a avaliação da conta A', async () => {
    // `comoUsuario` recebe e-mail e senha; a conta B precisa de um dono seu,
    // criado no `beforeAll` como o resto dos testes de RLS já fazem
    const comoB = await comoUsuario(donoDeB)
    const { data } = await comoB.from('avaliacao').select('id').eq('id', avaliacaoA)
    expect(data).toEqual([])
  })

  it('a mesma posição não entra duas vezes na mesma avaliação', async () => {
    const { data: pos } = await db.from('posicao_avaliacao')
      .insert({ conta_id: contaA, nome: 'Frente', ordem: 1 }).select().single()
    const linha = {
      conta_id: contaA, avaliacao_id: avaliacaoA,
      posicao_id: pos!.id, path: `${contaA}/${pessoaA}/${avaliacaoA}/frente.jpg`,
    }
    const primeira = await db.from('avaliacao_foto').insert(linha)
    expect(primeira.error).toBeNull()
    const segunda = await db.from('avaliacao_foto').insert(linha)
    expect(segunda.error?.code).toBe('23505')
  })
})
```

- [x] **Passo 4: rodar e ver passar**

```bash
npx vitest run tests/avaliacao.test.ts
```

- [x] **Passo 5: commit**

```bash
git add supabase/migrations/0053_vr_avaliacao.sql tests/avaliacao.test.ts src/server/banco.types.ts
git commit -m "feat: o acompanhamento por foto ganha modelo e balde próprio"
```

---

## Tarefa 2: as posições, em `core/`

**Arquivos:**
- Criar: `src/core/avaliacao/posicoes.ts`
- Teste: `tests/unit/avaliacao.test.ts`

**Interfaces:**
- Produz: `POSICOES_PADRAO: string[]`, `ordenarPosicoes(linhas)`,
  `proximaOrdem(linhas)`.

- [x] **Passo 1: escrever o teste que falha**

```ts
// tests/unit/avaliacao.test.ts
import { describe, it, expect } from 'vitest'
import { POSICOES_PADRAO, ordenarPosicoes, proximaOrdem } from '@/core/avaliacao/posicoes'

describe('posições da avaliação', () => {
  it('as seis padrão começam pela frente e terminam nos pés', () => {
    expect(POSICOES_PADRAO[0]).toBe('Frente')
    expect(POSICOES_PADRAO.at(-1)).toBe('Pés')
    expect(POSICOES_PADRAO).toHaveLength(6)
  })

  it('ordena pela ordem, e pelo nome quando a ordem empata', () => {
    const linhas = [
      { nome: 'Costas', ordem: 2 },
      { nome: 'Frente', ordem: 1 },
      { nome: 'Abdômen', ordem: 2 },
    ]
    expect(ordenarPosicoes(linhas).map((p) => p.nome))
      .toEqual(['Frente', 'Abdômen', 'Costas'])
  })

  it('a posição nova entra no fim, e a lista vazia começa em 1', () => {
    expect(proximaOrdem([{ nome: 'Frente', ordem: 3 }])).toBe(4)
    expect(proximaOrdem([])).toBe(1)
  })
})
```

- [x] **Passo 2: rodar e ver falhar**

```bash
npx vitest run tests/unit/avaliacao.test.ts
```

Esperado: falha por não existir `@/core/avaliacao/posicoes`.

- [x] **Passo 3: escrever o mínimo**

```ts
// src/core/avaliacao/posicoes.ts
/**
 * As posições da avaliação por foto.
 *
 * As seis abaixo vieram do pilates, que foi quem pediu, e ficam como **ponto de
 * partida**, não como lista fechada: a ortodontia fotografa perfil e arcada, a
 * estética fotografa a região tratada. Por isso a posição é linha da conta, e
 * estas seis só existem para a primeira avaliação não começar numa tela vazia.
 */
export const POSICOES_PADRAO = [
  'Frente',
  'Lateral direita',
  'Lateral esquerda',
  'Costas',
  'Flexão de coluna',
  'Pés',
] as const

export type Posicao = { nome: string; ordem: number }

/**
 * Empate de ordem se resolve pelo nome, e não pela ordem de chegada do banco:
 * duas posições criadas no mesmo segundo trocariam de lugar entre uma visita e
 * outra, e a matriz de comparação mudaria de forma sozinha.
 */
export function ordenarPosicoes<T extends Posicao>(linhas: readonly T[]): T[] {
  return [...linhas].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

export function proximaOrdem(linhas: readonly Posicao[]): number {
  return linhas.reduce((maior, p) => Math.max(maior, p.ordem), 0) + 1
}
```

- [x] **Passo 4: rodar e ver passar**

```bash
npx vitest run tests/unit/avaliacao.test.ts
```

- [x] **Passo 5: commit**

```bash
git add src/core/avaliacao/posicoes.ts tests/unit/avaliacao.test.ts
git commit -m "feat: as posições da avaliação são da conta, com seis de partida"
```

---

## Tarefa 3: qual par de datas comparar

**Arquivos:**
- Criar: `src/core/avaliacao/comparar.ts`
- Modificar: `tests/unit/avaliacao.test.ts`

**Interfaces:**
- Consome: nada.
- Produz: `parPadrao(datas: string[]): { antes: string; depois: string } | null`.

- [x] **Passo 1: escrever o teste que falha**

```ts
// acrescentar em tests/unit/avaliacao.test.ts
import { parPadrao } from '@/core/avaliacao/comparar'

describe('par de comparação', () => {
  it('compara a primeira com a última, que é onde a diferença aparece', () => {
    expect(parPadrao(['2022-12-12', '2020-11-30', '2021-10-13']))
      .toEqual({ antes: '2020-11-30', depois: '2022-12-12' })
  })

  it('com uma avaliação só, não há o que comparar', () => {
    expect(parPadrao(['2020-11-30'])).toBeNull()
    expect(parPadrao([])).toBeNull()
  })
})
```

- [x] **Passo 2: rodar e ver falhar**

```bash
npx vitest run tests/unit/avaliacao.test.ts
```

- [x] **Passo 3: escrever o mínimo**

```ts
// src/core/avaliacao/comparar.ts
/**
 * O par que a tela abre.
 *
 * A primeira contra a última, e não as duas últimas: quem abre a comparação
 * quer ver o quanto andou desde o começo, e duas avaliações seguidas de três
 * meses mostram quase nada. Trocar qualquer uma das pontas é um clique.
 */
export function parPadrao(datas: readonly string[]): { antes: string; depois: string } | null {
  if (datas.length < 2) return null
  const ordenadas = [...datas].sort()
  return { antes: ordenadas[0], depois: ordenadas[ordenadas.length - 1] }
}
```

- [x] **Passo 4: rodar e ver passar**

- [x] **Passo 5: commit**

```bash
git add src/core/avaliacao/comparar.ts tests/unit/avaliacao.test.ts
git commit -m "feat: a comparação abre na primeira contra a última"
```

---

## Tarefa 4: ler e escrever avaliação, no servidor

**Arquivos:**
- Criar: `src/server/avaliacao/consultas.ts`, `src/server/avaliacao/acoes.ts`
- Modificar: `tests/avaliacao.test.ts`

**Interfaces:**
- Consome: `ordenarPosicoes`, `proximaOrdem`, `POSICOES_PADRAO` da Tarefa 2;
  `exigirConta`, `clienteServidor` de `src/server/conta`.
- Produz:
  - `posicoesDaConta(): Promise<Array<{ id: string; nome: string; ordem: number }>>`
  - `avaliacoesDaPessoa(pessoaId): Promise<Avaliacao[]>` com `fotos[]` já
    assinadas
  - `criarAvaliacao({ pessoaId, data, profissionalId, observacao })`
  - `salvarFotoDaAvaliacao(avaliacaoId, posicaoId, foto: File, observacao?)`
  - `criarPosicao(nome)`, `apagarAvaliacao(id)`

- [x] **Passo 1: escrever o teste que falha**

```ts
// acrescentar em tests/avaliacao.test.ts
import { podeVerAvaliacao } from '@/server/avaliacao/consultas'

describe('quem enxerga a avaliação', () => {
  it('a recepção não enxerga, os outros três sim', () => {
    expect(podeVerAvaliacao('recepcao')).toBe(false)
    expect(podeVerAvaliacao('dono')).toBe(true)
    expect(podeVerAvaliacao('profissional')).toBe(true)
    expect(podeVerAvaliacao('suporte')).toBe(true)
  })
})
```

- [x] **Passo 2: rodar e ver falhar**

- [x] **Passo 3: escrever as consultas**

```ts
// src/server/avaliacao/consultas.ts
import { clienteServidor, exigirConta } from '../conta'
import { ordenarPosicoes, POSICOES_PADRAO } from '@/core/avaliacao/posicoes'
import type { Papel } from '@/core/acesso/destino'

export const BALDE_AVALIACAO = 'foto-avaliacao'

/**
 * Foto de corpo é dado de saúde, e a recepção não precisa dela para marcar
 * aula. A barreira mora aqui e na ação, não só na tela: esconder o botão sem
 * barrar o servidor é proteger a vista e deixar o dado aberto.
 */
export function podeVerAvaliacao(papel: Papel): boolean {
  return papel !== 'recepcao'
}

/**
 * As posições da conta, criando as seis padrão na primeira vez.
 *
 * A criação é aqui e não numa migration porque conta que nunca vai usar o
 * módulo não precisa carregar seis linhas, e porque conta nova nasceria sem
 * elas de qualquer jeito.
 */
export async function posicoesDaConta() {
  const conta = await exigirConta()
  const db = await clienteServidor()

  const { data } = await db.from('posicao_avaliacao')
    .select('id, nome, ordem').eq('conta_id', conta.contaId).eq('ativo', true)
    .returns<Array<{ id: string; nome: string; ordem: number }>>()

  if (data && data.length > 0) return ordenarPosicoes(data)

  const { data: criadas, error } = await db.from('posicao_avaliacao')
    .insert(POSICOES_PADRAO.map((nome, i) => ({
      conta_id: conta.contaId, nome, ordem: i + 1, ativo: true,
    })))
    .select('id, nome, ordem')
    .returns<Array<{ id: string; nome: string; ordem: number }>>()
  if (error) throw error
  return ordenarPosicoes(criadas ?? [])
}
```

- [x] **Passo 4: escrever as ações**

```ts
// src/server/avaliacao/acoes.ts
'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { BALDE_AVALIACAO, podeVerAvaliacao } from './consultas'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const LIMITE = 5 * 1024 * 1024

export async function criarAvaliacao(entrada: {
  pessoaId: string
  data: string
  profissionalId?: string | null
  observacao?: string | null
}): Promise<{ id: string }> {
  const conta = await exigirConta()
  if (!podeVerAvaliacao(conta.papel)) throw new Error('sem acesso à avaliação')
  const db = await clienteServidor()

  const { data, error } = await db.from('avaliacao').insert({
    conta_id: conta.contaId,
    pessoa_id: entrada.pessoaId,
    data: entrada.data,
    profissional_id: entrada.profissionalId ?? null,
    observacao: entrada.observacao ?? null,
    // `ContaAtiva` não carrega o id do usuário, só o papel: quem sabe quem
    // está logado é o cliente do Supabase
    criado_por_usuario_id: (await db.auth.getUser()).data.user?.id ?? null,
  }).select('id').single()
  if (error) throw error

  revalidatePath(`/pessoas/${entrada.pessoaId}`)
  return { id: (data as { id: string }).id }
}

/**
 * Uma foto por posição: subir de novo troca a que estava lá, e o arquivo velho
 * sai do balde. Guardar as duas encheria o balde de tentativa, e a comparação
 * passaria a depender de qual delas a tela escolheu.
 */
export async function salvarFotoDaAvaliacao(
  avaliacaoId: string, posicaoId: string, foto: File, observacao?: string,
): Promise<void> {
  const conta = await exigirConta()
  if (!podeVerAvaliacao(conta.papel)) throw new Error('sem acesso à avaliação')
  if (!TIPOS.includes(foto.type)) throw new Error('a foto precisa ser JPEG, PNG ou WEBP')
  if (foto.size > LIMITE) throw new Error('a foto precisa ter até 5 MB')

  const db = await clienteServidor()
  const { data: av } = await db.from('avaliacao')
    .select('pessoa_id').eq('id', avaliacaoId).eq('conta_id', conta.contaId).single()
  if (!av) throw new Error('avaliação não encontrada')

  const ext = foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg'
  const pessoaId = (av as { pessoa_id: string }).pessoa_id
  const caminho = `${conta.contaId}/${pessoaId}/${avaliacaoId}/${posicaoId}.${ext}`

  const envio = await db.storage.from(BALDE_AVALIACAO)
    .upload(caminho, foto, { upsert: true, contentType: foto.type })
  if (envio.error) throw envio.error

  const r = await db.from('avaliacao_foto').upsert({
    conta_id: conta.contaId, avaliacao_id: avaliacaoId, posicao_id: posicaoId,
    path: caminho, observacao: observacao ?? null,
  }, { onConflict: 'avaliacao_id,posicao_id' })
  if (r.error) throw r.error

  revalidatePath(`/pessoas/${pessoaId}`)
}
```

- [x] **Passo 5: rodar tudo e ver passar**

```bash
npx vitest run tests/avaliacao.test.ts tests/unit/avaliacao.test.ts
```

- [x] **Passo 6: commit**

```bash
git add src/server/avaliacao tests/avaliacao.test.ts
git commit -m "feat: criar avaliação e trocar a foto da posição, com a recepção de fora"
```

---

## Tarefa 5: a aba na ficha, com matriz e comparador

**Arquivos:**
- Criar: `src/components/avaliacao/matriz.tsx`,
  `src/components/avaliacao/comparador.tsx`,
  `src/components/avaliacao/nova-avaliacao.tsx`
- Modificar: `src/app/(app)/pessoas/[id]/page.tsx`
- Teste: `e2e/avaliacao.spec.ts`

**Interfaces:**
- Consome: `avaliacoesDaPessoa`, `posicoesDaConta` da Tarefa 4; `parPadrao` da
  Tarefa 3; `Modal`, `CampoFoto`, `Botao`, `Cartao` do design system.

- [x] **Passo 1: escrever o teste de navegador que falha**

```ts
// e2e/avaliacao.spec.ts
import { test, expect } from '@playwright/test'
import { entrarComo } from './apoio'

test('a profissional registra uma avaliação e ela aparece na matriz', async ({ page }) => {
  await entrarComo(page, 'prof')
  await page.goto('/pessoas')
  await page.getByRole('link', { name: /Marina/ }).first().click()
  await page.getByRole('link', { name: 'Avaliações' }).click()

  await page.getByRole('button', { name: 'Nova avaliação' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Data da avaliação').fill('2026-08-18')
  await page.getByRole('button', { name: 'Registrar' }).click()

  await expect(page.getByText('18/08/26')).toBeVisible()
})

test('a recepção não enxerga a aba', async ({ page }) => {
  await entrarComo(page, 'recepcao')
  await page.goto('/pessoas')
  await page.getByRole('link', { name: /Marina/ }).first().click()
  await expect(page.getByRole('link', { name: 'Avaliações' })).toHaveCount(0)
})
```

- [x] **Passo 2: rodar e ver falhar**

```bash
npx playwright test e2e/avaliacao.spec.ts
```

- [x] **Passo 3: a matriz**

Grade de posição por data, com a miniatura de cada cruzamento e o botão de
adicionar onde não houver foto. A célula abre a foto grande num modal, porque o
documento do cliente pede em letras maiúsculas que dê para ampliar. Segue o
desenho aprovado: cartão de raio 20, cabeçalho com borda `#EFF3F1`, miniatura de
76 por 96 com raio 11, e a coluna da última data com a borda da marca.

- [x] **Passo 4: o comparador**

Duas colunas iguais, cada uma com o seletor de data da casa (o `<Escolha>` que
já existe), a foto em 480px de altura, e a observação daquela foto embaixo. A
linha de prumo é um traço tracejado na cor menta, por cima da foto, e liga e
desliga num chip. Quem escolhe o par inicial é `parPadrao`.

- [x] **Passo 5: o modal de registro**

Data, quem avaliou, observação da visita, e uma zona de foto por posição, com o
`<CampoFoto>` que já existe. A nota do rodapé diz a consequência: "As fotos
ficam visíveis para quem atende e para o responsável. A recepção não vê."

- [x] **Passo 6: ligar na ficha**

Acrescentar a aba `avaliacao` na lista de `<Abas>` de
`src/app/(app)/pessoas/[id]/page.tsx`, **só quando `podeVerAvaliacao(papel)`**,
e o bloco correspondente no corpo.

- [x] **Passo 7: rodar tudo**

```bash
npm test && npm run build && npx playwright test e2e/avaliacao.spec.ts
```

- [x] **Passo 8: commit**

```bash
git add src/components/avaliacao src/app/\(app\)/pessoas e2e/avaliacao.spec.ts
git commit -m "feat: a ficha ganha a aba de avaliação, com matriz e comparador"
```

---

## Tarefa 6: o direito do titular alcança as fotos

**Arquivos:**
- Modificar: `src/server/pessoas/acoes.ts` (`anonimizarPessoa`)
- Modificar: `tests/avaliacao.test.ts`

- [x] **Passo 1: escrever o teste que falha**

```ts
// acrescentar em tests/avaliacao.test.ts
it('anonimizar apaga as fotos e as avaliações da pessoa', async () => {
  // a ação de servidor exige sessão; aqui o teste chama a função pura que ela
  // usa por dentro, do mesmo jeito que `tests/pessoas.test.ts` já faz
  await limparAvaliacoesDaPessoa(db, contaA, pessoaA)
  const { data } = await db.from('avaliacao').select('id').eq('pessoa_id', pessoaA)
  expect(data).toEqual([])
})
```

- [x] **Passo 2: rodar e ver falhar**

- [x] **Passo 3: acrescentar em `anonimizarPessoa`**

Apagar os objetos do balde `foto-avaliacao` sob `${contaId}/${pessoaId}/`, e
depois as linhas de `avaliacao`. A ordem importa: apagar a linha primeiro deixa
o arquivo órfão no balde, sem ninguém que saiba que ele existe.

- [x] **Passo 4: rodar e ver passar**

- [x] **Passo 5: atualizar a documentação**

`docs/ESTADO.md`: a tabela de "O que existe" ganha as três tabelas e o balde; a
seção do direito do titular passa a dizer que a foto sai junto.

- [x] **Passo 6: commit**

```bash
git add src/server/pessoas/acoes.ts tests/avaliacao.test.ts docs/ESTADO.md
git commit -m "feat: o pedido de exclusão passa a levar as fotos da avaliação"
```

---

## Tarefa 7: produção

- [x] **Passo 1: conferir o que está pendente**

```bash
set -a && . ../.secrets/4yu.env && set +a
node scripts/aplica-em-producao.mjs --dry
```

- [x] **Passo 2: os cinco passos da conferência do `HANDOFF.md`**

Em especial: a `0053` só toca `app_verandi`, e o balde `foto-avaliacao` é nome
novo no projeto **que é dividido com o AutoFluxos**. Conferir antes:

```sql
select id from storage.buckets order by id;
```

- [x] **Passo 3: aplicar e provar fora do console**

```bash
node scripts/aplica-em-producao.mjs
```

Depois: as três tabelas existem, as três com RLS, o balde é privado, e
`https://verandi.4yu.com.br` responde.

- [x] **Passo 4: commit da documentação**

```bash
git add docs/ESTADO.md docs/HANDOFF.md
git commit -m "docs: o acompanhamento por foto está no ar"
```
