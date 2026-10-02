# Revisão de uso, 02/out/2026

Varredura com Playwright no ambiente local, como dono, recepção e profissional,
em 1440 e 390, antes do MGM começar a usar. Nenhum erro de console, de página ou
HTTP >= 400 em rota nenhuma. O que segue é o que um usuário esbarra.

Marcado `[x]` é o que já foi corrigido e publicado. O resto é a fila, na ordem.

## Para quem continua (02/out, depois de `0c14cad`)

Feitos e no ar: 1 a 46, mais 55, 56 e 60. Próximo: **47**. Um commit por item ou
por tela, push na hora (push na `main` publica na Vercel).

- **Validar:** `npx tsc --noEmit -p .`, e só o spec e2e da tela mexida. Nunca a
  suíte inteira, nunca e2e junto com build.
- **Servidor:** a porta 3000 pode estar com o AutoFluxos. Suba a Verandi com
  `npx next dev -p 3100` e rode o Playwright com um config de rascunho
  (`testDir` = `e2e/`, `baseURL` 3100, sem `webServer`): o
  `playwright.config.ts` do repo faz build + start, pesado demais.
- **Print antes de entregar:** 1440 e 390, conta de teste criada como nos specs
  (`contaDeTeste` + `usuarioDe` de `e2e/apoio.ts`) no Supabase local.
- **Migration:** aplicar local com
  `docker exec -i supabase_db_verandi psql -v ON_ERROR_STOP=1 -U postgres -d postgres < arquivo.sql`.
  Produção: carregar `../.secrets/4yu.env` e rodar
  `node scripts/aplica-em-producao.mjs --dry`, depois sem `--dry`. O modo
  automático bloqueia a aplicação até o Gabriel autorizar no chat. Código que lê
  coluna nova só sobe **depois** da migration.
- **`npm run tipos`:** o CLI novo gera saída sem formatação (chave entre aspas);
  a checagem do script já aceita, mas regerar reescreve o arquivo inteiro. Na
  `0066` os tipos foram acrescentados à mão, no formato do arquivo.
- **Lint:** `chamada.tsx` tem um erro anterior (`setEncaixe` no efeito do
  `#encaixar`). Não é regressão.
- **Texto:** sem travessão; placeholder começa com "Exemplo:"; UI sem gênero
  presumido ("Adicionar seu nome", não "Como quer ser chamado?").
- **Falta:** 47 a 54, 57 a 59 e 61, nessa ordem. 48 e 49 mexem em permissão de
  rota (`src/proxy.ts` e o `exigirConta` de cada página), o resto é texto e
  visual. No 53, `emReaisOuTraco` já saiu do Financeiro (`e1306e0`); falta
  varrer `grep -rn "'—'" src`.
- **Achados desta rodada:** ainda há "Não é falha de carregamento" em
  `pessoas/[id]/page.tsx:534` e `hoje/page.tsx:316` (mesma família do 41).
  Recepção e profissional não leem `usuario_conta` de outros (RLS da `0031`),
  por isso o histórico da sessão diz "pela equipe" e não o nome; dar o nome
  exige migration.
- **Fonte de título:** o Q tem uma cauda longa que lê como sublinhado (era o
  60). Título que começa com Q, troque a frase.
- **Rascunho de print:** `.rascunho/` (no `.git/info/exclude`) tem o config
  `pw.config.ts` e specs de print (`ficha`, `recibo`, `fin`, `telas`). Spec de
  rascunho fora do repo não resolve `@playwright/test`. `fullPage` em 390
  desenha a barra de baixo no meio da página: é a captura, não a tela.
- **Seletores:** vocabulário padrão é "Vaga" ("Criar vaga"); a MGM usa
  "Matrícula". Com modal aberto, botão de mesmo nome existe na página e no
  `dialog[open]`; escopo no dialog.

## Quebrado

- [x] 1. Matrícula nova não entrava nas aulas já geradas. `incluirVagasNasSessoes`
      em `src/server/agenda/materializar.ts`, chamada por `criarVaga`, `criarContrato`
      e `retomarContrato`.
- [x] 2. Quem já tem matrícula num horário não consegue criar contrato nele ("Esta
      pessoa já ocupa o horário..."). `src/server/contratos/acoes.ts:187`,
      `src/components/contratos/matricula.tsx`. Aceitar as vagas que a pessoa já
      tem e ligá-las ao contrato; avisar quando passar da frequência do plano.
- [x] 3. Recibo impresso saía em 2 folhas: padding do `<main>` no print.
      `src/app/globals.css`.
- [x] 4. "Marcar" da busca de vaga (`#encaixar`) não abria o encaixe.
      `src/components/sessao/chamada.tsx`.
- [x] 5. Ficha mostrava "reposicao"/"recorrente" crus. `ROTULO_ORIGEM` em
      `src/app/(app)/pessoas/[id]/page.tsx`.
- [x] 6. `/hoje` em 390 rola de lado (482px): linha de busca, sino, dia e filtro
      sem quebra. `src/app/(app)/hoje/page.tsx:591`.
- [x] 7. `/hoje` agenda do dia em 390: grade espreme a linha, fotos por cima,
      professor some. `src/components/hoje/pecas.tsx:227`.
- [x] 8. Barra de baixo no celular só tem Hoje, Agenda, Pend., Alunos: não chega a
      Financeiro, Recibos, Vaga, Grade, Config, nem Sair. `src/app/(app)/layout.tsx:155`,
      `src/components/ui/rail.tsx:220`. Quinta aba "Mais".
- [x] 9. Chamada em 390: os 4 botões cobrem o nome. `src/components/sessao/lista-participacao.tsx:76`.
- [x] 10. "**imagem**" com asteriscos na config do recibo; nota reescrita.
- [x] 11. Input de arquivo em inglês ("Choose File"). Rótulo próprio.
- [x] 12. Contrato dizia "a cobrança entra quando o financeiro estiver no ar".

## Confuso

- [x] 13. Reposições na ficha sem botão de usar o crédito: "Agendar reposição" abrindo o
    encaixe com origem Reposição.
- [x] 14. Encaixe grava como Avulso no toque do nome, antes de escolher a origem
    (`src/components/sessao/modal-encaixe.tsx`).
- [x] 15. Chamada só com símbolos: agora com texto (Veio, Faltou, Avisou, Licença).
- [x] 16. "Marcar todos presentes" aparece em aula de daqui a 71h: liberar só do início.
- [x] 17. Aviso "Murilo Bastos atualizado." não diz o quê (`chamada.tsx:92`).
- [x] 18. "aula começa em 71h21": acima de 24h, dia e hora (`proxima-turma.tsx:25`).
- [x] 19. Hoje diz "1 chamada pendente", Pendências diz 58: mesma regra.
- [x] 20. Dono abre em "Minha agenda" vendo os horários de todos (`hoje/page.tsx:607`).
- [x] 21. "Bom dia, dono": nome vem do e-mail; pedir o nome no convite.
- [x] 22. Ficha sem contrato: "Plano sem data de término" e "Registrar renovação".
- [x] 23. "assim que a semana for materializada" (`pessoas/[id]/page.tsx:455`).
- [x] 24. "Criar matrícula" abre "Novo agendamento" com botão "Agendar": um nome só.
- [x] 25. "Identificador", "id 112", "Sem identificador" em vermelho: "Nº da ficha".
- [x] 26. "Marcar inativa"/"Inativa" no feminino; "o março dela continua sendo março".
- [x] 27. Sem aviso de sucesso em Cadastrar, Criar contrato, Inativar, Reativar.
- [x] 28. Emitir recibo gasta o número sem confirmação.
- [x] 29. Estornar não avisa que o recibo será cancelado.
- [x] 30. Recibo cancelado mantém "Enviar por e-mail".
- [x] 31. "Cancelado: pagamento estornado: Teste" com dois-pontos duplicado.
- [x] 32. Pendências: "exigem ação humana", "o objetivo é zerar", "esvaziado hoje".
- [x] 33. Financeiro: "o objetivo é zerar", "Ticket médio", "sem recorte de data".
- [x] 34. Financeiro Todas abre pelas futuras (nov); atrasadas enterradas.
- [x] 35. Fechamento com texto de engenheiro ("A carteira", "preço de vínculo custa...").
- [x] 36. Grade fixa com nota interna no subtítulo (`grade/page.tsx:48,149`).
- [x] 37. Aulas: "Aula aplicada", "Com gente", "Por dar" (`aulas/page.tsx:149`).
- [x] 38. Sessão: "aplica na hora e sincroniza depois", "Turma criada pela série".
- [x] 39. Encaixe do dono aparece como "marcado avulso pela recepção".
- [x] 40. Breadcrumb "Hoje / Segunda, 28 de setembro" em aula passada.
- [x] 41. Config: "deixa de ser genérico e vira o sistema do negócio".
- [x] 42. Config Padrões fala de "API" e "5/4 é sempre alguém decidindo".
- [x] 43. Config Recibo: "oponível a alguém".
- [x] 44. Config Planos: coluna "mesma" sem cabeçalho, códigos 001/002 sem sentido.
- [x] 45. Folha do recibo: "CNPJ/CPF" mostra os dois rótulos.
- [x] 46. Recibos: "na série A", "versões substituídas por outra".
47. Buscar vaga: "Faixa de dias" mistura período e turno; falta "Tarde".
48. Profissional abre /semana e a ficha completa pela URL; tour fala da grade.
49. Recepção em /aulas e /config volta para /hoje sem mensagem.
50. Placeholder "(44) 99999-9999" sem "Exemplo:" e com o DDD do Gabriel.
51. Avaliação e config do recibo com "Ex.:" em vez de "Exemplo:".
52. Encaixe: telefone cru "1199100685". ("2 livre(s)" já saiu em `2ed32fd`.)

## Visual

53. Travessão "—" em texto e como valor vazio nos KPIs (`emReaisOuTraco`).
54. Plurais com "(s)". Hoje, encaixe e próxima turma já saíram (`2ed32fd`,
    `65dd7fc`, `f6edf03`); falta varrer `/vaga` e o resto com `grep -rn "(s)" src`.
- [x] 55. Alunos em 390: selo GESTANTE corta o nome.
- [x] 56. Financeiro em 390: abas rolam de lado sem indicar que há mais.
57. Botão "⧉" de copiar telefone vira quadrado vazio no Linux: ícone + "Copiar".
58. Legenda da agenda da semana quase invisível; "+" de horário vazio claro demais.
59. Grade fixa: hora em dois andares; "Encerrar" vermelho repetido 74 vezes.
- [x] 60. Fechamento: "Quem está em atraso" com o "Q" sublinhado.

## Lento

61. Busca por nome no Financeiro demora a filtrar (Gabriel, 02/out, MGM com
    "thais"): deveria filtrar enquanto digita. Hoje cada tecla, com 250 ms de
    espera (`src/components/financeiro/busca.tsx`), faz `router.replace` e
    renderiza a página inteira no servidor: `idsQueCasam` (ilike em `pessoa`),
    a lista, o resumo da faixa e `juntarRecibos`, tudo em
    `src/server/financeiro/consultas.ts`. A aba Todas ficou com três consultas
    a mais desde `e1306e0` (contagem dos blocos). Medir antes de mexer
    (tempo do `GET /financeiro?q=` no log do `next dev`). Caminhos: filtrar no
    cliente a página já carregada enquanto o servidor responde, buscar só a
    lista (sem a faixa) por rota própria, ou índice trigram em `pessoa.nome`
    (migration: avisar antes).

Não testado: Trancar, Receber adiantado, Encerrar turma ou matrícula, convite,
envio de e-mail, Histórico e Avaliação com dados.
