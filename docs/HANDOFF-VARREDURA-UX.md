# Handoff: licença no período inteiro + varredura de UX/UI tela por tela

Escrito em 06/out/2026, no fim da rodada visual
(`docs/HANDOFF-PROXIMO-VISUAL.md`, já executado). Leia este arquivo inteiro
antes de começar. Duas partes, **nesta ordem**: a licença (regra decidida,
só implementar) e depois a varredura.

## Quem é o Gabriel e como ele quer o trabalho

Designer, não é dev. Quer o sistema **mais fácil, mais limpo, mais
profissional**, e cobra que a última rodada "melhorou, mas falta MUITO mais".
Ele não quer opções: quer decisão tomada, aplicada, com print. Regras dele que
já custaram retrabalho:

- **Resposta curta**, pendência em uma linha.
- **Print antes de entregar UI**, 1440 e 390, tela inteira e bonita.
- **Commitar e publicar na hora** (`git push` na `main` publica na Vercel).
  Junte commits da mesma frente.
- **Push não é publicação.** Depois do push, confirme o deploy `READY` (comando
  abaixo). Em 06/out o build quebrou por erro de tipo em `scripts/` e oito
  deploys falharam sem ninguém ver: o Gabriel abriu produção e viu a versão
  velha.
- **`npx tsc --noEmit -p .` tem de sair limpo, sem filtro.** O build da Vercel
  checa tipos do projeto inteiro, scripts inclusive.
- **Não rode a suíte inteira.** Só o spec e2e da tela mexida, um por vez.
- **Um processo pesado por vez** (a WSL cai): nunca e2e junto com build, nunca
  `next build` com o `next dev` rodando (os dois usam `.next`).
- **Travessão (—) proibido** em todo arquivo que você abrir, inclusive os
  antigos: troque por vírgula, dois pontos ou parênteses.
- Placeholder de campo começa com **"Exemplo:"**.
- **Texto de UI em tom de SaaS B2B**, formal, sem gênero presumido. Nada de
  informalidade ("Veio", "Avisou", "marcado avulso pela equipe").
- **Ações otimistas**: a tela muda no toque, com aviso; nada de
  `revalidatePath` na rota aberta para esperar o servidor.
- Telefone com DDD 44 em dado de cliente é teste do Gabriel, nunca real.
- Banco de produção compartilhado com o AutoFluxos: leia
  `docs/BANCO-COMPARTILHADO.md` antes de tocar em banco. Esta rodada **não
  precisa de migration**; se achar que precisa, pare e pergunte.
- `AGENTS.md`: esta versão do Next tem mudanças; leia o guia em
  `node_modules/next/dist/docs/` antes de escrever código específico do Next.

## Ambiente (já de pé no fim da sessão anterior)

- Supabase local da Verandi rodando no Docker (`supabase_db_verandi`). Se não
  estiver: Docker Desktop ligado (é o Gabriel quem liga), `npx supabase stop`
  em `autofluxos/` se ele estiver de pé, `npx supabase start` em `verandi/`.
- App: `npx next dev -p 3200` em segundo plano (log em `.rascunho/dev.log`).
- **Conta cheia no banco local**: slug `4yu-teste`, logins
  `dono@teste.4yu.com.br`, `recepcao@teste.4yu.com.br`,
  `professor@teste.4yu.com.br`, senha `senha-de-teste-123`. Recriar:
  `npx tsx .rascunho/semeia-local.mts --recriar` (cópia local do
  `scripts/semeia-teste.mts`, aponta só para o `.env.local`). Depois de recriar,
  marque o onboarding como pulado, senão o modal de boas-vindas cobre os prints:
  ```bash
  docker exec supabase_db_verandi psql -U postgres -d postgres -c "insert into app_verandi.onboarding (conta_id, usuario_id, roteiro, pulado_em) select uc.conta_id, uc.usuario_id, r, now() from app_verandi.usuario_conta uc join app_verandi.conta c on c.id=uc.conta_id and c.slug='4yu-teste' cross join (values ('boas-vindas'),('primeiros-passos')) v(r) on conflict (usuario_id, conta_id, roteiro) do update set pulado_em=now();"
  ```
- **Prints de todas as telas**: `.rascunho/aud.spec.ts` (fora do git). 1440 de
  página inteira e 390 da primeira dobra. Filtre com `SO`:
  ```bash
  SAIDA=.rascunho/<pasta> SO=hoje,chamada npx playwright test -c .rascunho/pw.config.ts .rascunho/aud.spec.ts
  ```
  Nomes: `hoje chamada chamada-feita semana dia grade pend pessoas ficha
  ficha-hist ficha-repo ficha-aval ficha-contr ficha-licenca fin fin-fech
  recibos aulas config-servicos config-equipe config-funcionamento
  config-recibo config-vocabulario config-integracoes hoje-recepcao hoje-prof
  entrar`. No print de página inteira o rail aparece cortado: é a captura, não
  a tela.
- e2e de uma tela: `npx playwright test -c .rascunho/pw-e2e.config.ts e2e/<arquivo>.spec.ts`.
- Esperar o deploy da Vercel ficar pronto:
  ```bash
  set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
  H=$(git rev-parse --short=7 HEAD)
  for i in $(seq 1 45); do s=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v6/deployments?projectId=prj_j4cH3RXXCF1AmB1sGKAvMWy0Oo9k&teamId=team_hmVHyYO1YFO9fuAtpG9Ym2hm&limit=1" | python3 -c "import json,sys;d=json.load(sys.stdin)['deployments'][0];print(d['state'],(d.get('meta',{}).get('githubCommitSha') or '')[:7])"); case "$s" in READY*$H*|ERROR*$H*) echo "$s"; break;; esac; sleep 20; done
  ```
  Se der `ERROR`, o log do build está em
  `https://api.vercel.com/v3/deployments/<uid>/events?teamId=...`.

## O que já foi feito (não refaça)

Commits de `0e882c6` a `5057a7c` na `main`, todos no ar:
- Rail `fixed` com espaçador; faixa de suporte removida (o "Sair" do rail
  encerra o suporte).
- Escala de 5 tamanhos (12, 13.5, 14.5, 18, 28), sem DM Mono em número, sem
  caixa alta em rótulo, `tinta-fraca` = `#626d68`. Registro em
  `docs/DESIGN.md`, seção Tipografia.
- Iniciais de avatar por `fonteDasIniciais()` em `src/components/ui/tintas.ts`.
- Celular: filtros em faixa rolável (Agenda, Alunos, Configuração).
- Ações de perigo em texto discreto (vermelho só no hover).
- Configuração em 6 seções (chaves antigas de `?s=` continuam valendo).
- Grade fixa: linha abre edição, resto no menu "⋮".
- "Aluno desde" e "Novos no período" por `inicioDaPessoa()`.
- Pendência "Horário fixo sem contrato" e aviso ao criar matrícula sem
  contrato.
- **Licença libera o lugar da aula** (`LIBERAM_A_VAGA` em
  `src/core/agenda/ocupacao.ts`), mas só na participação marcada `licenca`.

## Parte 1: licença vale para o período inteiro (decidido, implementar)

Hoje a licença é marcada aula por aula, na chamada. As próximas aulas de quem
está de licença continuam `esperada` e ocupando o lugar. Decisão do dono:

1. **Abrir ou prorrogar licença** (`abrirLicenca`, `prorrogarLicenca` em
   `src/server/licencas/licencas.ts`): toda participação da pessoa em
   `esperada` ou `confirmada`, em sessão que ainda não começou, até a véspera
   da `volta_prevista`, vira `licenca`. Sem data de volta: todas as já
   geradas a partir de agora.
2. **Sessão gerada durante licença aberta** (`src/server/agenda/materializar.ts`)
   nasce com a participação dessa pessoa em `licenca`.
3. **Voltou, volta antecipada ou data encurtada** (`encerrarLicenca`,
   `marcarVolta` em `src/server/licencas/acoes.ts`, `prorrogarLicenca` com data
   menor): participação `licenca` em sessão que ainda não começou volta para
   `esperada`, **mesmo com a aula cheia**. Horário fixo tem prioridade; a aula
   fica acima da capacidade e a tela já mostra isso.
4. **Aviso**: cada aula que ganhou lugar chama `avisarQuemEspera` (fila de
   espera interna), como a falta avisada já faz em
   `src/server/agenda/acoes.ts:110`. Marcar licença numa aula só, pela
   chamada, também avisa. **Não** dispare o webhook `participacao.cancelada`
   para o bot: ele trata isso como cancelamento. Deixe anotado para combinar
   com o bot da MGM.
5. Passado não muda. Crédito de reposição continua sem licença
   (`statusComCredito`).
6. Teste unitário da janela (função pura em `src/core/`), `tsc` limpo, e2e de
   chamada (`e2e/sessao.spec.ts`) e encaixe. Commit, push, `READY`.

Atenção: licenças já abertas em produção (MGM) só passam a liberar as aulas
seguintes na próxima prorrogação ou volta. Avise o Gabriel disso no relatório,
não rode nada em produção.

## Parte 2: varredura de UX/UI, tela por tela (aplicar)

O pedido, nas palavras dele: "um sistema mais fácil", "pra CADA PÁGINA tirar
o que é excessivo ou deixar em botões de ação, ou em lugares como extra",
"botão com cara de botão", "jamais informalidade", "essas são só 1% das coisas
que temos problemas". Você tem autonomia para aplicar. Mover função para menu
"⋮" ou para "Mais ações" é permitido; **apagar uma função de vez** não:
liste no relatório.

### O que ele apontou e precisa sair primeiro (Chamada, `/sessao/[id]`)

- **Botão em tom pastel**: ele não gosta. O seletor de status da chamada
  (`src/components/sessao/lista-participacao.tsx`, `chamada.tsx`) usa fundo
  pastel. Passe para **cor sólida** com texto branco: Presente (verde da
  marca), Falta (vermelho), Falta justificada (âmbar escuro), Licença (roxo).
  Confira contraste AA de cada par.
- **Nomes informais**: "Veio", "Faltou", "Avisou" viram o vocabulário do meio
  (estúdio, clínica): **Presente, Falta, Falta justificada, Licença**.
  "Agendado" para aula futura continua. Troque também os rótulos derivados
  (Resumo da chamada, histórico, ficha, API docs se exibirem o rótulo; o
  valor no banco **não muda**).
- **"marcado avulso pela equipe · hoje, 11:44"**: ninguém entende. Reescreva
  as linhas de origem (`fixo`, `avulso`, `encaixe`, `reposição`, bot) como
  "Aula avulsa, agendada por {nome} em {data}" ou equivalente claro.
- **"trocar professor só neste horário"** é um link verde sem cara de botão.
  Vire botão secundário "Trocar professor" num grupo de ações do cabeçalho.
- **"Cancelar aula" está jogado no canto** do cabeçalho. Leve para um menu
  "Mais ações" (⋮) do cabeçalho junto de "Trocar professor", ou para o pé da
  tela; a ação principal do cabeçalho é concluir a chamada.

### Depois, todas as outras telas, na ordem de uso

Hoje, Chamada, Agenda (Semana, Dia por recurso, Grade fixa), Pendências,
Alunos, ficha (Agenda, Histórico, Reposições, Avaliação, Contratos),
Financeiro (Cobranças, Fechamento, Recibos, Aulas por professor),
Configuração (6 seções), Entrar, convite, onboarding. Em cada uma:

- **Nomenclatura**: todo texto visível. Termos do meio, formais, sem gíria,
  sem frase-explicação desnecessária. Hoje há muita dica em texto miúdo
  explicando o óbvio ("cada matrícula tem vigência, encerrar não apaga o
  passado", "Ocupa esse horário toda semana..."): corte o que não muda uma
  decisão.
- **Botões**: todo clicável com cara de clicável. Uma ação principal (sólida)
  por área; secundárias contornadas; raras no "⋮". Nada de link sublinhado
  fazendo papel de ação.
- **Cor**: sem pastel em botão. Pastel só em etiqueta de estado
  (não clicável). Tokens em `src/app/globals.css`; mexer em token muda o
  produto inteiro, então prefira criar o token sólido que falta.
- **Excesso**: cartão que repete informação de outro, contagem duplicada,
  hint redundante, filtros demais à vista. Esconda em "⋮", em "Mais filtros"
  ou numa área recolhível.
- **Cenários**, não só tela parada: aula que ainda não aconteceu, aluno em duas
  modalidades, aluno de licença, celular com a barra de baixo, recepção (vê
  financeiro) e professor (não vê dinheiro).

Uma frente por commit (por tela ou grupo de telas), com print antes e depois
em `.rascunho/varredura/<tela>/`, push e `READY`. Seletores e2e que quebrarem
porque o texto mudou: atualize o teste, não reverta o texto.

## Relatório final para o Gabriel

Curto: o que mudou por tela (uma linha cada), links dos prints, o que ficou
de fora e por quê (função que só poderia ser apagada, coisa que exige
migration, o webhook do bot), e o aviso sobre licenças já abertas na MGM.
