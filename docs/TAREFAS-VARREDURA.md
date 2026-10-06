# Tarefas da varredura de UX/UI (pedidas pelo Gabriel em 06/out/2026)

Complementa `docs/HANDOFF-VARREDURA-UX.md`. Marque `[x]` com o commit.

## Diagnóstico geral (palavras dele, resumidas)

- O sistema está "pobre e feio": tudo grande, hardcoded, jogado, "parecendo
  aplicativo do governo". Card desnecessário, informação que não precisa,
  texto truncado, tamanho errado, botão sem origem, mensagem miúda que só faz
  sentido para quem escreveu.
- **Cores terrosas demais.** Nada de "orgânico, light, fitness": menos pastel,
  mais personalidade. Cores limpas e saturadas onde há ação ou estado.
- Falta ilustração, motion, ícone das pessoas (avatar), cards organizados.
- Referência: padrões do **AutoFluxos** (tabelas, botões, motion,
  ilustração). Olhar antes de redesenhar uma tela.

## Telas

- [ ] **Chamada** (`/sessao/[id]`): botões sólidos, Presente / Falta /
  Falta justificada / Licença, origem legível, "Trocar professor" como botão,
  cancelar no "⋮". Falta vermelho de verdade, justificada azul (tokens `reg-*`).
- [ ] **Ficha do aluno**
  - "Marcar aula" e "Editar dados" lado a lado, não empilhados e esticados.
  - Condições (lesão, idoso, gestante): editar dentro de "Editar dados". Hoje
    ninguém acha onde se coloca.
  - Horário (Seg 07:00) colando na borda do quadrado.
  - Card "Plano": "O contrato em vigor tem o valor e as parcelas" não diz nada.
    Mostrar plano, valor e próximo vencimento, ou sumir.
  - "Atenção na aula" está bom; tirar o selo "só quem atende".
  - Cortar dicas miúdas: "cada matrícula tem vigência, encerrar não apaga o
    passado", "Ocupa esse horário toda semana, por tempo indeterminado".
- [ ] **Financeiro, Cobranças**: virar **tabela** (pessoa com avatar, contrato,
  status, valor, crédito/recebido, ações à direita). Hoje a tabela só começa
  no meio da tela: filtro de vencimento + busca + cards + filtros + abas.
  Enxugar o topo; filtros secundários em "Mais filtros".
- [ ] **Financeiro, Fechamento**: ninguém entende. Reorganizar em cards
  claros, avatar das pessoas, ilustração no vazio.
- [ ] **Financeiro, Recibos**: mesmo padrão de tabela.
- [ ] **Aulas por professor**: questionar se mora no Financeiro. Proposta:
  sair do Financeiro para a Agenda ou Equipe (é relatório de aulas dadas;
  valor só para dono).
- [ ] **Hoje, Agenda, Pendências, Alunos, Configuração, Entrar, convite,
  onboarding**: mesma régua (nomenclatura formal, botão com cara de botão,
  sem pastel em botão, sem card repetido, sem dica óbvia).
- [ ] **Aula e Aluno** (as melhores hoje) também sobem de nível.

## Linguagem visual

- [ ] Paleta: revisar tokens em `src/app/globals.css` para menos terroso,
  pastel só em etiqueta não clicável.
- [ ] Tabelas e botões no padrão do AutoFluxos.
- [ ] Ilustração em estados vazios e onboarding.
- [ ] Motion leve em troca de estado (marcar presença, abrir menu, toast).
