# Verandi

SaaS de agendamento multi-inquilino, da [4YU](https://4yu.com.br). Serve qualquer
negócio que marque horário — estúdio, clínica, salão, personal, professor
particular — com **vaga recorrente** e **horário avulso** no mesmo modelo.

Não é o sistema de um cliente. O primeiro cliente é a evidência, não o alvo, e a
régua que decide tudo é:

> Isto é **agendamento**, ou é **este cliente**?

Se for do cliente, vira linha de configuração. Nunca coluna nova, nunca `if`.

## Subir

```bash
npm install
npx supabase start           # Postgres local, no Docker
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

O Supabase local usa a faixa 564xx (API `56421`, studio `56423`). O `.env.local`
sai do `npx supabase status -o env` — ver [ESTADO.md](docs/ESTADO.md).

Entrar com `dono@dev.local`, `prof@dev.local` ou `recepcao@dev.local`, senha
`senha-de-teste-123`. **`supabase db reset` apaga o seed** — rode o semeador de
novo depois.

## Testar

```bash
npm test         # unidade e integração
npm run test:e2e # navegador; faz o build e sobe o servidor sozinho
```

A suíte de navegador roda contra **build de produção**, não `next dev`: o
servidor de desenvolvimento recompila cada rota e cresce sem devolver — passou de
1,7 GB numa suíte inteira e derrubou o navegador por falta de memória.

Os testes de `src/core/` rodam sem banco nenhum, em menos de um segundo. É de
propósito: a matemática de agenda — expandir recorrência, aplicar feriado, contar
ocupação, decidir se o encaixe cabe — é onde os bugs difíceis moram.

## Documentação

| Arquivo | O quê |
|---|---|
| [docs/ESTADO.md](docs/ESTADO.md) | **comece por aqui** — onde paramos e o que fazer em seguida |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | vocabulário, entidades e as decisões que não dá para tomar duas vezes |
| [docs/TELAS.md](docs/TELAS.md) | o que cada tela faz — **o visual quem decide é o protótipo** |
| [docs/DESIGN.md](docs/DESIGN.md) | tokens, primitivos e as regras que o protótipo aplica sem dizer |
| [docs/VESTIR.md](docs/VESTIR.md) | **como deixar a tela idêntica ao protótipo** — leia antes de mexer em interface |
| [`Design system Verandi-att/DESIGN-SYSTEM.md`](Design%20system%20Verandi-att/DESIGN-SYSTEM.md) | **a especificação de interface**: onde a tela divergir dele, é a tela que muda |
| [`Design system Verandi/`](Design%20system%20Verandi/) | o protótipo antigo, só para o caso que o novo não previu |
| [docs/PLANO.md](docs/PLANO.md) | os marcos e a ordem de construção |
| [handoff](handoff) | o briefing original |

## Estrutura

```
src/
├── core/      ★ zero import de Next, Supabase ou rede — testável sem subir nada
├── server/    repositórios, ações de servidor, materialização
├── app/       rotas (ver TELAS.md) · `/amostra` mostra os primitivos
└── components/ui  as peças do design system (ver DESIGN.md)
```

`core/` não importa nada de `app/`, `server/` ou do banco. A dependência anda
numa direção só, e há uma verificação disso no fechamento de cada plano.
