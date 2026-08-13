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
npx supabase start   # Postgres local, no Docker
npm install
npm run dev
```

O Supabase local usa a faixa 564xx (API `56421`, studio `56423`). O `.env.local`
sai do `npx supabase status -o env` — ver [ESTADO.md](docs/ESTADO.md).

## Testar

```bash
npm test         # unidade e integração
npm run test:e2e # navegador, sobe o dev sozinho
```

Os testes de `src/core/` rodam sem banco nenhum, em menos de um segundo. É de
propósito: a matemática de agenda — expandir recorrência, aplicar feriado, contar
ocupação, decidir se o encaixe cabe — é onde os bugs difíceis moram.

## Documentação

| Arquivo | O quê |
|---|---|
| [docs/ESTADO.md](docs/ESTADO.md) | **comece por aqui** — onde paramos e o que fazer em seguida |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | vocabulário, entidades e as decisões que não dá para tomar duas vezes |
| [docs/TELAS.md](docs/TELAS.md) | o que cada tela faz, sem decidir visual |
| [docs/PLANO.md](docs/PLANO.md) | os marcos e a ordem de construção |
| [handoff](handoff) | o briefing original |

## Estrutura

```
src/
├── core/      ★ zero import de Next, Supabase ou rede — testável sem subir nada
├── server/    repositórios, ações de servidor, materialização
├── app/       rotas (ver TELAS.md)
└── components/
```

`core/` não importa nada de `app/`, `server/` ou do banco. A dependência anda
numa direção só, e há uma verificação disso no fechamento de cada plano.
