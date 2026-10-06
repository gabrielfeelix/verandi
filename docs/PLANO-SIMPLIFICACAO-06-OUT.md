# Plano de simplificação, 06/out/2026

Revisão de UX pedida pelo Gabriel ("o sistema está complexo demais, com ação
que não precisava"). Tudo abaixo foi aprovado por ele no chat de 06/out e vai
ser feito. Base: inventário das telas lido do código em `c103f80`, sem print.

Marcar `[x]` com o commit quando entrar.

## Princípios que guiaram os cortes

- Uma pergunta por tela, uma porta por ação. Se a mesma coisa se faz em três
  lugares, sobra um.
- O caso comum não pede toque. Quem veio à aula é o padrão; só a exceção se
  marca.
- Começar pela pessoa, não pelo filtro. A recepção pensa "a Maria quer repor",
  nunca "quinta, noite, aparelho".
- Número que não leva a lugar nenhum não fica na tela.

## 1. Navegação: de 10 para 6 itens

Hoje o dono vê: Hoje, Agenda, Pendências, Alunos, Buscar vaga, Grade fixa,
Financeiro, Recibos, Aulas, Configuração (`src/app/(app)/layout.tsx:113`).

- [x] Sidebar fica: **Hoje, Agenda, Pendências, Alunos, Financeiro, Configuração**.
- [x] **Recibos** vira aba do Financeiro.
- [x] **Aulas** (`/aulas`, relatório de aulas dadas por professor, base do
      pagamento da equipe) vira aba do Financeiro: "Aulas por professor".
- [x] **Grade fixa** vira aba da Agenda: "Semana | Dia por recurso | Grade fixa".
- [x] **Buscar vaga** sai da sidebar (ver 3). Rotas antigas redirecionam para o
      lugar novo, para não quebrar favorito nem link do onboarding
      (`src/core/onboarding/roteiro.ts` aponta `/vaga` e `/grade`).

## 2. Chamada (tela da aula): de 4 botões para 1

Hoje cada aluno tem Veio, Faltou, Avisou, Licença
(`src/components/sessao/lista-participacao.tsx:21`).

- [x] Todo aluno começa como **Veio** (o sistema já grava assim ao concluir,
      `chamada.tsx:111`; passa a mostrar isso).
- [x] Um botão por aluno, com o estado como rótulo. Antes da aula: **Agendado**,
      com *Avisou que não vem* e *Licença* (ninguém "falta" numa aula de daqui
      duas semanas). Depois que começa: **Veio** tracejado (provisório), com
      *Faltou sem avisar*, *Avisou*, *Licença*. Ajuste do Gabriel em 06/out.
- [x] Quem já avisou ou está de licença antes da aula chega marcado, e a
      professora não toca.
- [x] "Marcar todos presentes" vira **Concluir chamada**, um só lugar por
      tamanho de tela (hoje está no cabeçalho, na barra do celular e no card de
      Hoje).
- [x] "Encaixar" fica só no rodapé da lista. Card de Hoje vira "Fazer chamada"
      (link para a aula), sem concluir às cegas.
- [x] Encaixe: a origem é deduzida (tem falta em aberto: Reposição; aula lotada:
      Reserva; senão: Avulso). Os chips de origem ficam só para corrigir.
      Avaliar se "Encaixe" e "Avulso" precisam ser duas origens.

## 3. Marcar aula começa pelo aluno

- [x] Ficha do aluno ganha **Marcar aula** como ação principal: lista só os
      horários com vaga da modalidade dele, um toque marca. Uma falta em
      aberto vira reposição automaticamente.
- [x] Agenda ganha o filtro **Só com vaga**, que cobre o "tem horário quinta?"
      do balcão.
- [x] `/vaga` deixa de existir como tela. Se sobrar, só busca por texto, sem os
      cinco grupos de chips duplicando o que o texto já faz.

## 4. Hoje

- [x] Sai o bloco dos 4 números (`hoje/page.tsx:226`): nenhum é link, e
      "chamadas pendentes" já aparece 5 vezes na mesma tela.
- [x] Sai "Arrumar a tela inicial" (modal de subir e descer bloco). Uma tela
      bem ordenada não precisa ser montada por cada usuário.
- [x] Sai o filtro Manhã/Tarde/Noite da agenda do dia: um dia cabe numa tela.
      Os períodos continuam como faixas da lista. A tabela de preferência do
      arranjo (`tests/home.test.ts`) fica no banco sem uso, até uma limpeza.
- [x] "Equipe hoje" sai; a carga por professor mora em Agenda > Dia por recurso.
- [x] Fica: próxima aula, agenda do dia, prévia de Pendências, Caixa do mês.

## 5. Pendências

- [x] Sai o card lateral "Resumo": repete a contagem que já está no título de
      cada grupo.
- [x] Licenças com 3 ordens em vez de 5: atrasada (data passou ou voltou sem
      reagendar), próximas, sem data.

## 6. Alunos (lista)

10 chips fixos mais tags (`pessoas/page.tsx:17`).

- [x] Ficam: **Todos, Faltou sem avisar, De licença, Plano a renovar** (junta
      vencendo e vencido), **Sem telefone**. "Inativos" fica à parte, etiquetas
      num seletor. "Faltou sem avisar" e "Sem telefone" mantiveram o nome
      porque dizem a regra; "Faltando" e "Cadastro incompleto" não diziam.
- [x] "Duas faltas seguidas" saiu (contava faltas quaisquer). "De licença" lê
      a tabela `licenca`, e a coluna Situação diz "de licença".

## 7. Ficha do aluno

6 abas, 4 cartões laterais, 4 botões no cabeçalho.

- [x] Cabeçalho: **Marcar aula** (principal), **Editar dados** (secundária),
      Inativar e Excluir dados em texto discreto embaixo. Menu "⋯" não: os
      dois abrem modal próprio, e esconder num menu custava um toque a mais.
- [x] Aba **Perfil** sai: repetia os 6 dados e as marcações do cabeçalho.
- [x] "Em números" no lateral sai: a aba Histórico já diz "veio N%".
- [x] "Criar vaga" aparece uma vez, na aba Agenda (o cabeçalho virou Marcar
      aula). Esconder "Criar vaga" em conta com contrato ficou de fora: muda
      regra de cadastro, decidir com o Gabriel.
- [x] Mostrar a **licença aberta** (início, volta prevista, botão Voltou).

## 8. Financeiro

- [x] Abas: Cobranças (com o filtro de situação dentro), Fechamento, Recibos,
      Aulas por professor.
- [x] Período nas listas (Cobranças, Recibos): Todas as datas, Este mês, Mês
      passado, Este ano, Escolher datas. Fechamento e Aulas por professor
      mantêm Hoje/Semana/Mês/Ano: são as quatro janelas que o documento do
      cliente pede para relatório. Os chips agora têm o mesmo visual nas quatro
      seções, e Recibos usa chips como Cobranças.

## 9. Licença (Verandi + bot da MGM)

- [x] Bot: uma porta só. Sai o item "Voltei de licença" do menu do aluno e os 4
      gatilhos por frase; fica a pergunta automática quando a ficha tem licença.
- [x] Bot: "Está voltando?" e "Quer marcar?" viram uma pergunta: "Vi que você
      está de licença. Vamos marcar sua volta?" [Marcar] [Outro assunto].
- [x] Bot: pula a escolha de modalidade quando a ficha já diz qual é.
- [x] Verandi: `reagendou:false` só mantém a licença aberta (`3a97de7`).
- [x] Bot: "Agora não" sai; quem não quer marcar escolhe "Outro assunto".
      Era: "Agora não" avisa só pelo inbox do AutoFluxos. Sai o
      `voltou_sem_reagendar_em` e o `POST /licencas {reagendou:false}`; a API
      fica só com "encerrar". Coluna fica no banco, sem uso, até uma limpeza.
- [x] Verandi: o modal "Quando volta?" deixa de abrir sozinho ao marcar
      Licença. A data se define em Pendências ou na ficha.
- [x] Republicar Atendimento (v19) e Licença (v2) na MGM; gatilhos apagados. Falta teste no WhatsApp (cliente pagante:
      conferir no WhatsApp com número 44 depois).

## Ordem de execução

1. Chamada (2): a tela mais usada, todo dia, por todas as professoras.
2. Navegação (1) com redirecionamentos.
3. Marcar aula pela ficha e "Só com vaga" (3), depois tira `/vaga`.
4. Hoje (4) e Pendências (5).
5. Ficha (7) e Alunos (6).
6. Financeiro (8).
7. Licença (9), Verandi e bot juntos.

Cada etapa: `tsc`, print 1440 e 390, commit e push.
