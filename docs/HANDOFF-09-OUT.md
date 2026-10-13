# Handoff: 08 e 09/out/2026 (MGM em uso, shell novo, reposições)

Continua `docs/HANDOFF-08-OUT.md`. Regras de banco compartilhado:
`docs/BANCO-COMPARTILHADO.md` e o `CLAUDE.md` de `4yu-apps/`. O próximo
trabalho são **mais correções pedidas pela MGM** (Daniel, cliente pagante).

## Como trabalhar com o Gabriel (leia antes)

- Fala **pt-BR**, resposta curta, decide e implementa (não ofereça menu de
  opções). Ele não é dev.
- Fluxo padrão de cada pedido: implementar → `npx tsc --noEmit -p .` limpo →
  commit → push → conferir deploy **READY** na Vercel → responder. Não rode a
  suíte inteira; `next build` só quando a mudança for grande.
- UI: print local em 1440 e 390 antes de entregar. Sem Docker (Supabase local
  não sobe): página temporária em `src/app/amostra/<nome>/page.tsx` com dados
  de exemplo, `npx next dev -p 3105`, Playwright em `node_modules/playwright`.
  Apague a amostra antes do commit e rode `rm -rf .next/dev/types` antes do
  tsc (senão acusa a página apagada).
- **Produção só com autorização explícita para aquela alteração.** O
  classificador de permissão bloqueia escrita sem ela. Quando bloquear, escreva
  a mensagem de autorização pronta para ele colar.
- Sempre meça antes de apagar (consulta só de leitura) e, em escrita em lote,
  use transação com guarda (`raise exception` se o número não bater).

## Onde chegam os pedidos da MGM

Pelo WhatsApp da 4YU, dentro do **AutoFluxos** (mesmo Supabase, schema
`public`): conversa com o contato **Gabriel Felix**
(`666af154-c1e5-4b34-9cb2-bdb44f7c6ab5`). `direcao='saida'` é o **Edu**
(sócio, fala com o Daniel); `entrada` é o Gabriel. Áudios do Daniel chegam
encaminhados pelo Edu.

```bash
# consulta só de leitura em produção (Management API; ref literal)
set -a; . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env; set +a
python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$SQL" | \
  curl -s -X POST https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "User-Agent: verandi-diag" --data @-
```

- Mensagens: `public.messages` (`ts`, `direcao`, `texto`, `arquivo` jsonb com
  `midia` e `caminho`, `transcricao` quase sempre vazia).
- Mídia: bucket `autofluxos-recebidos`, caminho do campo `arquivo.caminho`;
  baixe com a chave de serviço do `autofluxos/.env`.
- **Áudio:** transcreva com Groq (`GROQ_API_KEY` do `4yu.env`):
  `curl https://api.groq.com/openai/v1/audio/transcriptions -F file=@a.ogg -F model=whisper-large-v3 -F language=pt -F response_format=text`.
- IDs: conta MGM no Verandi `c145c34b-cbaa-40af-a52f-e71e689853a0`; cliente
  MGM no AutoFluxos `5de5a891-790f-4c14-b60b-ce0a573fe1c7`.

## Feito em 08 e 09/out (tudo na `main`, no ar)

| Commit | O quê |
|---|---|
| `3d8be44`, `11468f3` | Cabeçalho fixo (trilha, `?` com gaveta de ajuda, sino, menu do perfil); rail com cantos arredondados, marca + recolher no topo e **troca de empresa abaixo da marca** (`components/ui/seletor-de-conta.tsx`, ação `server/suporte/troca.ts`; suporte busca entre todas e o acesso é registrado). |
| `87dc6e9`, `49ea069` | `?` por tela (`components/ui/titulo-da-tela.tsx`), ilustrações novas (contrato, local, serviços), "Minha semana" da profissional, trilha com nome do registro (`fim-da-trilha.tsx`). |
| `7f647e2` | Chamadas por fazer como número em Pendências no rail. |
| `7df73e1` | **Chamada abre 1h antes da aula** (`core/agenda/chamada.ts`, `CHAMADA_ABRE_ANTES_MS`). Falta justificada sempre pôde. |
| `214a1b9` | Remarcar status zera `credito_encerrado_em` (reabre crédito encerrado pela importação). |
| `ec704ed`, `abcec5d`, `a1f8880` | Financeiro: menu **Ordem** (padrão Situação: urgente no topo, nome dentro do bloco; ou Nome A–Z). Recibos por nome. Botão "Emitir recibo" à vista na linha. |
| `1ff61bd` | Matrícula: turma cheia pode ser escolhida ("entra como 4ª de 3", servidor só aceita os marcados); troca de contrato no mesmo horário não conta a própria vaga. O **bot nunca passa da capacidade** (`server/agenda/encaixe.ts`). |
| `0e9afe0` | Etiqueta **Gympass** na lista de Pessoas e na chamada (`components/pessoas/etiqueta-gympass.tsx`). |
| `8a37153` | **Aula de reposição mais cedo paga a falta mais antiga** (`server/agenda/reorganizar-reposicoes.ts`), chamada após encaixe e `apontarReposicao`. Ignora `importacao` e canceladas. Regra confirmada pelo Daniel. |

## Dados de produção alterados (com autorização)

- Erika de Alencar: créditos de 31/08 e 30/09 reabertos; reposição 08/10
  ligada a 31/08.
- Setembro/2026: 76 créditos que a importação tinha encerrado foram reabertos.
- 2025: **46** créditos ainda abertos e não repostos encerrados com motivo
  "Reposição de 2025 não reposta, excluída a pedido do cliente". O histórico de
  presença de 2025 **fica** (o Daniel não quer apagar aulas, só essas
  reposições). Não apague 2025.
- Maria do Socorro: 08/10 → paga 02/02; 13/10 → paga 04/02.
- Luz Marina: 08/10 → 22/09; 14/10 → 06/10; 15/10 → 13/10.
- Importação: créditos anteriores a 01/10/2026 foram encerrados em 07/10
  ("acertada no papel"); agosto e antes continuam assim. Se o Daniel achar um
  caso, remarcar a falta reabre.

## Bot da MGM (AutoFluxos, "Fluxo - Atendimento", v21 no ar)

Planos disponíveis não faz mais looping: depois do valor vem "Quer agendar sua
aula experimental?" (Quero agendar · Sou Wellhub · Chamar a recepção · Voltar
ao menu). Texto: "Também aceitamos *Wellhub* (antigo Gympass) nos planos
*Black*, *Black+* e *Platinum*". "Sou Wellhub" faz handoff com motivo próprio.

Publicar fluxo por SQL: monte o grafo, valide com `fluxoSchema` e `validar()`
de `autofluxos/src/core/flow/` (via `npx tsx`), grave `flows.rascunho` com
guarda em `atualizado_em` e chame `public.publicar_fluxo(flow_id, grafo)`.
**O editor tem autosave concorrente:** uma aba aberta antiga sobrescreve o
rascunho. Sempre compare rascunho × versão publicada antes de publicar.

## Falta / atenção

1. **`gh` ativo é `gabrielbarbosa-commits`**, sem acesso ao repo. Push falha
   com 403. Contorno usado: `git -c credential.helper= push "https://x-access-token:$(gh auth token -u gabrielfeelix)@github.com/gabrielfeelix/verandi.git" main`.
   Não troque a conta ativa sem perguntar (outra sessão pode usar).
2. "Meus alunos" da profissional: espera decisão (a ficha mostra financeiro).
3. "Sentiu falta de algo?" (pedidos no cabeçalho): precisa de tabela nova.
4. Chamadas de 07/10, Wellhub API e e2e `suporte.spec.ts`: ver
   `HANDOFF-08-OUT.md`.
5. Última migration: `0074`. Descubra a próxima por `ls supabase/migrations`.
