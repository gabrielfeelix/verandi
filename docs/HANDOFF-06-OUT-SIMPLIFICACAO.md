# Handoff 06/out/2026: simplificação de UX

Execução do `docs/PLANO-SIMPLIFICACAO-06-OUT.md` (aprovado pelo Gabriel no
chat). Tudo commitado e publicado na `main`, com print local em 1440 e 390 de
cada tela, salvo onde diz o contrário.

## O que entrou

| Commit | O quê |
|---|---|
| `14d254c` | Chamada: um botão por aluno com o estado como rótulo. Antes da aula, **Agendado** (só Avisou ou Licença); depois, **Veio** tracejado provisório e **Concluir chamada · N vieram**. Modal de licença não abre sozinho. |
| `c0c6238` | Encaixe: origem deduzida (falta em aberto vira Reposição), só Avulso/Reposição, capacidade do dia só quando falta vaga. |
| `d84805f` | Menu com 6 destinos. Grade fixa é aba da Agenda; Recibos e Aulas por professor são seções do Financeiro. |
| `2e70387` | **Marcar aula** na ficha (horários com lugar, por dia, busca "quinta 18h"). Agenda ganha **Só com vaga**. `/vaga` redireciona. |
| `e2eb8c0` | Hoje: sem os 4 números, sem "Arrumar a tela", sem filtro de período, sem carga da equipe. |
| `1ab62eb` | Pendências em uma coluna, sem o Resumo. |
| `98a4b9b` | Alunos: 5 filtros (Faltou sem avisar, De licença, Plano a renovar, Sem telefone, Inativos à parte), etiquetas num seletor; De licença lê a tabela `licenca`. |
| `da6efcf` | Ficha: Marcar aula + Editar; Inativar/Excluir discretos; sem aba Perfil nem Em números; cartão da licença aberta. |
| `4619f44` | Financeiro: período Todas/Este mês/Mês passado/Este ano/Escolher datas nas listas; chips iguais nas 4 seções. |
| `3a97de7` | Licença: 3 ordens em Pendências; `reagendou:false` só mantém aberta. |
| `9de8a55` | API: `GET /pessoas/{id}` devolve `modalidadeUnica`. |
| AutoFluxos `34ea9976` | `scripts/fluxos/mgm-licenca-simplifica.mts` (ver abaixo). |

## Bot da MGM: publicado

Autorizado pelo Gabriel e publicado com `--gravar`: Licença v2 (23 blocos,
com `tem-modalidade`), Atendimento v19 ("Vamos marcar sua volta?"), 4
gatilhos por frase apagados. Conferido lendo a versão publicada no banco.
Falta testar no WhatsApp com número 44 de licença aberta.

## Decisões tomadas no caminho

- Fechamento e Aulas mantêm Hoje/Semana/Mês/Ano: o comentário do código diz
  que são as 4 janelas que o documento do cliente pede.
- "Reserva" saiu da escolha de origem: ocupava lugar igual Avulso e não é a
  fila de espera de verdade (`espera`).
- Esconder "Criar vaga" em conta com contrato ficou de fora: muda regra.
- "Faltou sem avisar" e "Sem telefone" mantiveram o nome: dizem a regra.
- API `participacoes` só grava falta/falta_avisada; não abre nem fecha
  licença. Ponta do handoff anterior, conferida.

## Não resolvido

- `tests/unit/api-doc.test.ts`: `GET /funcionamento` sem documentação
  (anterior a esta rodada).
- `e2e/matricula.spec.ts` "horário cheio é recusado" falha também sem as
  mudanças desta rodada.
- Tabela de arranjo da tela inicial e coluna `licenca.voltou_sem_reagendar_em`
  ficam no banco sem uso, até uma limpeza com migration.
- Supabase local do AutoFluxos foi parado para subir o da Verandi.
