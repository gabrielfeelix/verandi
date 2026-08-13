# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano — desde que se saiba disso.

**Última atualização:** 12/ago/2026 · **Plano 01 (Fundação) concluído.**

## O que existe hoje

**Banco** — três migrations aplicadas. `conta`, `usuario_conta`, `vocabulario`,
`pessoa`, `pessoa_tag`, `profissional`, `servico`, `local`, `serie`, `vaga`,
`sessao`, `participacao`, `excecao_calendario`. RLS ligada com política em todas,
e teste provando que um cliente não enxerga o dado do outro.

**`core/`** — puro, sem import de banco, Next ou rede, verificado por `grep` no
fechamento do plano. Contém a aritmética de data, a expansão de série em
ocorrências, o cálculo de ocupação, a decisão de encaixe, o vocabulário e o
destino por papel.

**`server/`** — o cliente admin, a conta ativa e a materialização de sessão sob
demanda.

**Telas** — só `/entrar` e a raiz que redireciona por papel. `/hoje`, `/semana` e
`/contas` ainda dão 404: são o Plano 02.

## Testes

| Suíte | Comando | Quantos |
|---|---|---|
| Unidade + integração | `npm test` | 63 |
| Navegador | `npm run test:e2e` | 6 |

Os testes de unidade rodam em menos de um segundo, sem banco. Os de integração
usam o Supabase local; os de navegador sobem o `next dev` sozinhos.

## Versões

Next **16.3.0** · React **19.2.8** · Tailwind **4** · TypeScript **5** ·
Vitest **4.1.10** · Playwright · Supabase CLI **2.114.0** · Node **24.18.0** ·
Docker **29.6.1**.

## Como subir

```bash
npx supabase start        # local, no Docker
npm run dev
```

O Supabase local da Verandi usa a faixa **564xx** (API `56421`, banco `56422`,
studio `56423`). As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo
`radar-ofertas` e pelo `otimiza-gestor`.

Para regenerar o `.env.local` a partir do Supabase local, ver a Tarefa 9, passo 8
do [plano 01](planos/01-fundacao.md).

## Decisões tomadas durante a execução

Coisas que o plano não previa e que valem estar num lugar só:

- **`GRANT` é camada separada de RLS.** Tabela criada por migration não recebe
  privilégio sozinha; sem `grant`, até a chave de serviço leva
  `42501 permission denied`. Toda migration termina com o bloco de grants.
- **O índice de `(serie_id, inicio)` não é parcial.** `ON CONFLICT` só usa índice
  parcial se o predicado for repetido na consulta, e o PostgREST não manda
  predicado. Constraint simples dá a mesma semântica, porque nulo é distinto de
  nulo — sessão avulsa segue sem restrição.
- **`middleware.ts` virou `proxy.ts`.** Exigência do Next 16; feito pelo codemod
  oficial.
- **Consulta do Supabase precisa de `.returns<T[]>()`** enquanto não houver tipos
  do banco gerados, senão o `tsc` recusa com `GenericStringError`.
- **Dono e suporte enxergam o vínculo dos colegas na conta.** É proposital — são
  eles que gerenciam usuários. Por isso `contaAtiva()` filtra pelo próprio
  `usuario_id`, e há teste travando os dois lados.

## O que fazer em seguida

**Plano 02 — Operação.** Ainda não está escrito; escrever é o primeiro passo. A
ordem prevista em [PLANO.md](PLANO.md) é: Sessão (com chamada em lote) → Hoje →
Grade da semana → Pessoas e ficha → Novo agendamento e Buscar vaga.

Duas coisas que dependem de gente, não de código:

1. **Perguntar à operação o que significam `XX` e `F EXP`** na planilha (17 e 2
   ocorrências). O print da conversa sugere que o `X` é marca improvisada — *"não
   criei palavra fixa na minha, coloquei um x"* — mas isso não é resposta
   suficiente para importar. Sem isso o Plano 03 não fecha.
2. **Decidir onde o Supabase de produção vai morar.** A organização `4YU Systems`
   tem dois projetos ativos (`radar-ofertas`, `autofluxos`) e o `Otimiza Gestor`
   pausado, que é o teto do plano gratuito. As saídas são pausar um, abrir
   segunda organização, ou pagar Pro. Não bloqueia nada até o deploy.

Uma dívida técnica anotada, que não bloqueia: **gerar os tipos do banco**
(`supabase gen types typescript --local`) e tipar o cliente, para poder tirar os
`.returns<T[]>()` espalhados.
