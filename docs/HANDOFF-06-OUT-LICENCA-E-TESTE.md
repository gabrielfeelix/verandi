# Handoff 06/out/2026: licença acompanhada, filtros, busca de vaga, conta 4YU TESTE

Rodada que cruzou Verandi e AutoFluxos, puxada por pedidos do Edu para a MGM.
Tudo abaixo está commitado, publicado e conferido fora do console, salvo onde
diz o contrário.

## O que entrou (Verandi)

| Commit | O quê |
|---|---|
| `f86c26f` | Suporte registra chamada como o dono. A tela escondia os botões para `papel = suporte`; RLS e actions já aceitavam. |
| `ba80fb8` | Alunos: chips **Faltou sem avisar** (falta não avisada, 30 dias) e **De licença**. Buscar vaga: campo de busca por texto (dia, data, hora, aula, professor, local; cada palavra estreita). |
| `d294e54` | **Licença acompanhada.** Migration `0070_vr_licenca.sql` (aplicada em produção). Ver abaixo. |
| `76a5480` | `scripts/semeia-teste.mts`: conta **4YU TESTE** em produção. |

### Licença, como funciona agora

- Tabela `app_verandi.licenca`: uma aberta por pessoa (`licenca_aberta_uk`),
  `volta_prevista` opcional, `voltou_sem_reagendar_em`, `encerrada_por`
  (`presenca` / `operador` / `bot`). O status `licenca` da participação
  continua sendo o registro de cada aula; a tabela é o acompanhamento.
- Regras em `src/server/licencas/licencas.ts` (três portas usam: chamada,
  Pendências, API):
  - marcar Licença na chamada abre (ou só atualiza a data da aberta) e abre o
    modal "Quando volta?" (`src/components/licenca/modal-volta.tsx`);
  - **presença encerra**; falta não encerra;
  - desfazer o toque apaga a licença se nenhuma aula continua como licença.
- Pendências: grupo **Licenças**, ordenado: voltou sem reagendar → data passou
  → volta hoje → próximas → sem data. Ações **Voltou** e **Prorrogar/Definir
  volta**; não tem "Dispensar" de propósito.
- Hoje: grupo de licença que pede ligação sobe para o topo do cartão.
- API: `GET /pessoas/{id}` traz `licenca {inicio, voltaPrevista} | null`;
  `POST /licencas {pessoaId, reagendou}`: `true` encerra, `false` mantém aberta
  e marca `voltou_sem_reagendar_em`. Documentada em `src/core/api-doc/referencia.ts`.
- `banco.types.ts` foi regerado **de produção** (Supabase local estava parado),
  só `app_verandi`, sem o bloco `__InternalSupabase`.

## O que entrou (AutoFluxos)

| Commit | O quê |
|---|---|
| `d7154e4c` | Modelo genérico **Voltei de licença** (`src/exemplos/voltei-de-licenca.ts`), preset `verandi-voltei-de-licenca`, nicho de estúdio. |
| `579741b3` | `scripts/fluxos/mgm-voltei-de-licenca.mts`: criou e publicou na **MGM** o `Fluxo - Voltei de Licença` (v1, id `a40a9d9d-9dc9-45d6-a8d3-e2597a88d491`) e o **Atendimento v18**. |

Jornada na MGM, decidida assim:
1. Atendimento reconhece pelo telefone; ficha lê `licenca.inicio`; se
   preenchido, pergunta "Está voltando às aulas?" antes do menu.
2. Menu do aluno ganhou "🔙 Voltei de licença".
3. Quatro gatilhos `contem`: voltei da/de licença, voltando da licença, acabou
   minha licença.
4. **Número diferente do cadastro:** "Já sou aluno(a)" sem reconhecimento
   agora pede nome completo e faz handoff com o número no motivo, para a
   recepção atualizar o WhatsApp na Verandi. Não identificamos por nome de
   propósito: o fluxo marca e desmarca aula, e nome não prova identidade.

Fluxo de volta: "quer marcar?" sim → modalidade → período → dia → horário →
confirma → marca → `POST /licencas true` → confirmado. Não/silêncio →
`POST /licencas false` → handoff "voltou de licença e não quis marcar".

## Conta 4YU TESTE (Verandi produção)

- id `52336e11-7385-46ae-8fd3-62d7e8f7fa81`, slug `4yu-teste`. Dados
  inventados, telefones DDD 44, **sem** fluxo do AutoFluxos ligado.
- Logins `dono@`, `recepcao@`, `professor@teste.4yu.com.br`. A senha foi
  passada ao Gabriel no chat; não está em repositório. `--recriar` gera
  senha nova.
- Situações semeadas: chamada feita e pendente, 5 licenças (uma por estado),
  reposição aberta e remarcada, espera, encaixe, avulso, aula cancelada,
  feriado, alunos incompletos/inativos, financeiro completo.

## Não verificado

- **Nenhum print local** desta rodada (Supabase local parado; subir Docker
  junto com dev arrisca a WSL). Modal "Quando volta?", grupo Licenças em
  Pendências e campo de busca da vaga só foram vistos pelo `tsc`.
- **Fluxos da MGM não testados no WhatsApp.** Teste: licença num aluno de
  teste com número 44, mandar "oi" no número da MGM.
- Lint: `chamada.tsx:100` (setState em effect) e `hoje/page.tsx` (`Icone` sem
  uso) já existiam antes.

## Pontas soltas

- O chip "Duas faltas seguidas" filtra `faltas_recentes >= 2` em 30 dias, não
  faltas seguidas. Rótulo e regra discordam (anterior a esta rodada).
- Ficha do aluno não mostra a licença aberta; só Pendências e a API.
- Não conferido: se alguma rota da API muda status de participação para
  `licenca`/`presente`. Se mudar, ela não abre nem encerra a licença; só a
  chamada da tela e `POST /licencas` aplicam as regras.
