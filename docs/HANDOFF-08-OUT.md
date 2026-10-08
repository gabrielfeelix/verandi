# Handoff: 07 e 08/out/2026 (MGM em uso, Pendências nova)

Continua `docs/HANDOFF-07-OUT-REVISAO-3.md`. Regras, ambiente e banco
compartilhado: `docs/HANDOFF-REVISAO-GERAL.md` e `docs/BANCO-COMPARTILHADO.md`.
O Daniel (MGM Pilates, cliente pagante) começou a usar o sistema em 08/out.

## Como trabalhar com o Gabriel (leia antes)

- Ele não é dev: decide e implementa; resposta curta; commit + push + conferir
  deploy READY na Vercel quando ele disser "publica".
- UI: print local em 1440 e 390 antes de entregar (ele pede "sem publicar, quero
  ver o print"). Sem Docker, use uma página temporária em
  `src/app/amostra/<nome>/page.tsx` com dados de exemplo (`/amostra` não exige
  login; o `main` precisa de `w-full min-w-0`). Apague antes do commit.
- Pedidos chegam pelo WhatsApp da 4YU no AutoFluxos, conversa com o contato
  **Gabriel Felix** (cliente `4YU`, contato `666af154-c1e5-4b34-9cb2-bdb44f7c6ab5`,
  tabela `public.messages`; `direcao='saida'` é o Edu, o sócio, que fala com o
  Daniel). Antes de cobrar pendência, confira no banco se ela ainda existe.
- Produção só com autorização explícita para **aquela** alteração. O
  classificador de permissão bloqueia escrita sem ela.

## Feito em 07 e 08/out (tudo na `main`, no ar)

| Commit | O quê |
|---|---|
| `8a4c892` | `docs/WELLHUB.md`: pesquisa da API e plano (espera credencial). |
| `4bd5415` | Migration **0073** (aplicada): Nº da ficha único por conta ("072" = "72"). |
| `fb60f3e`, `73bddef` | API `GET /pessoas`: telefone acha nos 3 campos da ficha e devolve todos (mãe e filha); `email=` novo. |
| `461d6bc` | `sessao.cancelada` leva `dados.alunos` (quem ficou com reposição). |
| `bddf8f8` | Dia da aula avulsa com `CampoData` (cortava). |
| `0b8af37`, `cafeb02`, `774cac0` | **Pendências**: alfabética; uma linha por aluno com o resumo de cada assunto; "Ver tudo/Ver faltas" abre sub-linhas alinhadas às colunas; "Agendar reposição" abre o `MarcarAula` da ficha ali mesmo (repõe a mais antiga; "Agendar" numa falta repõe aquela). |
| `ec732ae` | Aula não pode ser reposição dela mesma (menu, ação e importação). |
| `936cff7` | Suporte que escolhe empresa em `/contas` entra nela como suporte. Teste novo em `e2e/suporte.spec.ts` **não rodou** (Docker desligado). |

Outra sessão fez em paralelo: `296542d` (licença prorroga o plano até o teto:
trimestral 7, semestral 15, anual 30 dias) e `9e93638` (dias da semana com zoom).

## Dados de produção alterados (com autorização)

- 4YU TESTE agora é **cópia da MGM** (nomes com " TESTE", telefone falso 4490...,
  sem CPF, e-mail, endereço, observação, fotos e avaliações) para o Edu gravar
  vídeos. Script em `scratchpad`, não versionado.
- MGM: `prazo_reposicao_dias` 60 → **730** (Pendências escondia 242 das 315
  reposições). Outubro reimportado da `OUTUBRO 26 (2).xlsx` (dia 06 incluído).
  Chamadas de 01 a 06/10 sem registro marcadas presente. Maria do Socorro: 02/02
  reaberta (5 em aberto). Luz Marina: aula de 08/10 7h virou reposição de 06/10.
  Thais Yano: 03/09 virou falta (4 em aberto). 3 cadastros "teste" apagados.

## Falta

1. **Chamadas de 07/10** (Personal 8h e 9h): esperam a planilha do dia ou o "pode
   marcar presente" do Gabriel.
2. **Bot da MGM (AutoFluxos)**: quando o Daniel escreve no meio do fluxo, a
   conversa vai para humano e a confirmação do aluno some sem aviso (caso Luz
   Marina, 05/10 18:00). Precisa: executar ou avisar no inbox. O bot também
   precisa ler `dados.alunos` do `sessao.cancelada` e perguntar o nome quando a
   busca por telefone devolver mais de um.
3. **Wellhub**: aguarda o Gabriel mandar o e-mail (texto no fim de
   `docs/WELLHUB.md`) e o ID do estúdio. Lista central do que depende dele:
   `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.
4. Prints da NextFit (sistema antigo do Daniel) não estão na conversa; as 231
   imagens dela estão em `4yu-apps/referencias/whatsapp-gabriel-felix/`.
5. Rodar `e2e/suporte.spec.ts -g "troca de conta"` quando o Docker voltar.

## Atenção

- Docker Desktop estava desligado em 08/out: sem Supabase local, sem e2e.
- `pessoa_resumo` é view com `security_invoker`; alteração de schema só por
  migration nova (`ls supabase/migrations | tail -1`) e
  `node scripts/aplica-em-producao.mjs`.
- 19 acessos de suporte ficaram abertos no admin porque ninguém clicou "Sair do
  suporte"; não é bug.
