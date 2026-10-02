# Revisão de uso, 02/out/2026

Varredura com Playwright no ambiente local, como dono, recepção e profissional,
em 1440 e 390, antes do MGM começar a usar. Nenhum erro de console, de página ou
HTTP >= 400 em rota nenhuma. O que segue é o que um usuário esbarra.

Marcado `[x]` é o que já foi corrigido e publicado. O resto é a fila, na ordem.

## Quebrado

- [x] 1. Matrícula nova não entrava nas aulas já geradas. `incluirVagasNasSessoes`
      em `src/server/agenda/materializar.ts`, chamada por `criarVaga`, `criarContrato`
      e `retomarContrato`.
- [ ] 2. Quem já tem matrícula num horário não consegue criar contrato nele ("Esta
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

13. Reposições na ficha sem botão de usar o crédito: "Agendar reposição" abrindo o
    encaixe com origem Reposição.
14. Encaixe grava como Avulso no toque do nome, antes de escolher a origem
    (`src/components/sessao/modal-encaixe.tsx`).
- [x] 15. Chamada só com símbolos: agora com texto (Veio, Faltou, Avisou, Licença).
16. "Marcar todos presentes" aparece em aula de daqui a 71h: liberar só do início.
17. Aviso "Murilo Bastos atualizado." não diz o quê (`chamada.tsx:92`).
18. "aula começa em 71h21": acima de 24h, dia e hora (`proxima-turma.tsx:25`).
19. Hoje diz "1 chamada pendente", Pendências diz 58: mesma regra.
20. Dono abre em "Minha agenda" vendo os horários de todos (`hoje/page.tsx:607`).
21. "Bom dia, dono": nome vem do e-mail; pedir o nome no convite.
22. Ficha sem contrato: "Plano sem data de término" e "Registrar renovação".
23. "assim que a semana for materializada" (`pessoas/[id]/page.tsx:455`).
24. "Criar matrícula" abre "Novo agendamento" com botão "Agendar": um nome só.
25. "Identificador", "id 112", "Sem identificador" em vermelho: "Nº da ficha".
26. "Marcar inativa"/"Inativa" no feminino; "o março dela continua sendo março".
27. Sem aviso de sucesso em Cadastrar, Criar contrato, Inativar, Reativar.
28. Emitir recibo gasta o número sem confirmação.
29. Estornar não avisa que o recibo será cancelado.
30. Recibo cancelado mantém "Enviar por e-mail".
31. "Cancelado: pagamento estornado: Teste" com dois-pontos duplicado.
32. Pendências: "exigem ação humana", "o objetivo é zerar", "esvaziado hoje".
33. Financeiro: "o objetivo é zerar", "Ticket médio", "sem recorte de data".
34. Financeiro Todas abre pelas futuras (nov); atrasadas enterradas.
35. Fechamento com texto de engenheiro ("A carteira", "preço de vínculo custa...").
36. Grade fixa com nota interna no subtítulo (`grade/page.tsx:48,149`).
37. Aulas: "Aula aplicada", "Com gente", "Por dar" (`aulas/page.tsx:149`).
38. Sessão: "aplica na hora e sincroniza depois", "Turma criada pela série".
39. Encaixe do dono aparece como "marcado avulso pela recepção".
40. Breadcrumb "Hoje / Segunda, 28 de setembro" em aula passada.
41. Config: "deixa de ser genérico e vira o sistema do negócio".
42. Config Padrões fala de "API" e "5/4 é sempre alguém decidindo".
43. Config Recibo: "oponível a alguém".
44. Config Planos: coluna "mesma" sem cabeçalho, códigos 001/002 sem sentido.
45. Folha do recibo: "CNPJ/CPF" mostra os dois rótulos.
46. Recibos: "na série A", "versões substituídas por outra".
47. Buscar vaga: "Faixa de dias" mistura período e turno; falta "Tarde".
48. Profissional abre /semana e a ficha completa pela URL; tour fala da grade.
49. Recepção em /aulas e /config volta para /hoje sem mensagem.
50. Placeholder "(44) 99999-9999" sem "Exemplo:" e com o DDD do Gabriel.
51. Avaliação e config do recibo com "Ex.:" em vez de "Exemplo:".
52. Encaixe: telefone cru "1199100685"; "2 livre(s)".

## Visual

53. Travessão "—" em texto e como valor vazio nos KPIs (`emReaisOuTraco`).
54. Plurais com "(s)" (vaga, hoje, proxima-turma).
55. Alunos em 390: selo GESTANTE corta o nome.
56. Financeiro em 390: abas rolam de lado sem indicar que há mais.
57. Botão "⧉" de copiar telefone vira quadrado vazio no Linux: ícone + "Copiar".
58. Legenda da agenda da semana quase invisível; "+" de horário vazio claro demais.
59. Grade fixa: hora em dois andares; "Encerrar" vermelho repetido 74 vezes.
60. Fechamento: "Quem está em atraso" com o "Q" sublinhado.

Não testado: Trancar, Receber adiantado, Encerrar turma ou matrícula, convite,
envio de e-mail, Histórico e Avaliação com dados.
