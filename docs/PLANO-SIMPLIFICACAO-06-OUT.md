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

- [ ] Sidebar fica: **Hoje, Agenda, Pendências, Alunos, Financeiro, Configuração**.
- [ ] **Recibos** vira aba do Financeiro.
- [ ] **Aulas** (`/aulas`, relatório de aulas dadas por professor, base do
      pagamento da equipe) vira aba do Financeiro: "Aulas por professor".
- [ ] **Grade fixa** vira aba da Agenda: "Semana | Dia por recurso | Grade fixa".
- [ ] **Buscar vaga** sai da sidebar (ver 3). Rotas antigas redirecionam para o
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

- [ ] Ficha do aluno ganha **Marcar aula** como ação principal: lista só os
      horários com vaga da modalidade dele, um toque marca. Uma falta em
      aberto vira reposição automaticamente.
- [ ] Agenda ganha o filtro **Só com vaga**, que cobre o "tem horário quinta?"
      do balcão.
- [ ] `/vaga` deixa de existir como tela. Se sobrar, só busca por texto, sem os
      cinco grupos de chips duplicando o que o texto já faz.

## 4. Hoje

- [ ] Sai o bloco dos 4 números (`hoje/page.tsx:226`): nenhum é link, e
      "chamadas pendentes" já aparece 5 vezes na mesma tela.
- [ ] Sai "Arrumar a tela inicial" (modal de subir e descer bloco). Uma tela
      bem ordenada não precisa ser montada por cada usuário.
- [ ] Sai o filtro Manhã/Tarde/Noite da agenda do dia: um dia cabe numa tela.
- [ ] "Equipe hoje" sai; a carga por professor mora em Agenda > Dia por recurso.
- [ ] Fica: próxima aula, agenda do dia, prévia de Pendências, Caixa do mês.

## 5. Pendências

- [ ] Sai o card lateral "Resumo": repete a contagem que já está no título de
      cada grupo.
- [ ] Licenças com 3 ordens em vez de 5: atrasada (data passou ou voltou sem
      reagendar), próximas, sem data.

## 6. Alunos (lista)

10 chips fixos mais tags (`pessoas/page.tsx:17`).

- [ ] Ficam: **Todos, Faltando, De licença, Plano vencendo** (junta vencendo e
      vencido), **Cadastro incompleto**. "Inativos" vira chave ao lado. Tags
      num seletor, não em chips.
- [ ] Corrigir "Duas faltas seguidas": a regra conta 2 faltas quaisquer em 30
      dias. Entra como "Faltando" com a regra certa, ou o rótulo diz a verdade.

## 7. Ficha do aluno

6 abas, 4 cartões laterais, 4 botões no cabeçalho.

- [ ] Cabeçalho: uma ação principal (**Marcar aula**) e o resto no menu "⋯"
      (Editar, Inativar, Excluir dados).
- [ ] Aba **Perfil** sai: repete os 6 dados do cabeçalho. "Marcações" vai para
      Editar.
- [ ] "Em números" no lateral sai: a aba Histórico já diz "veio N%".
- [ ] "Criar vaga" aparece uma vez (hoje: cabeçalho e aba Agenda). Na conta com
      contrato, o horário fixo nasce do contrato; "Criar vaga" avulsa fica só
      para conta sem financeiro.
- [ ] Mostrar a **licença aberta** (início, volta prevista, botão Voltou).

## 8. Financeiro

- [ ] Abas: Cobranças (com o filtro de situação dentro), Fechamento, Recibos,
      Aulas por professor.
- [ ] Período: 4 atalhos (Este mês, Mês passado, Este ano, Escolher datas) em
      vez de 7 mais formulário. Um componente só, usado no Financeiro, Recibos,
      Fechamento e Aulas (hoje há dois jeitos diferentes).

## 9. Licença (Verandi + bot da MGM)

- [ ] Bot: uma porta só. Sai o item "Voltei de licença" do menu do aluno e os 4
      gatilhos por frase; fica a pergunta automática quando a ficha tem licença.
- [ ] Bot: "Está voltando?" e "Quer marcar?" viram uma pergunta: "Vi que você
      está de licença. Vamos marcar sua volta?" [Marcar] [Outro assunto].
- [ ] Bot: pula a escolha de modalidade quando a ficha já diz qual é.
- [ ] Bot: "Agora não" avisa só pelo inbox do AutoFluxos. Sai o
      `voltou_sem_reagendar_em` e o `POST /licencas {reagendou:false}`; a API
      fica só com "encerrar". Coluna fica no banco, sem uso, até uma limpeza.
- [ ] Verandi: o modal "Quando volta?" deixa de abrir sozinho ao marcar
      Licença. A data se define em Pendências ou na ficha.
- [ ] Republicar Atendimento e Voltei de Licença na MGM (cliente pagante:
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
