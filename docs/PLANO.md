# Verandi — planejamento de execução

A ordem em que o sistema é construído, e o critério de pronto de cada pedaço.
O detalhe executável de cada plano fica em [`planos/`](planos/).

Arquitetura em [ARQUITETURA.md](ARQUITETURA.md) · telas em [TELAS.md](TELAS.md).

## O critério que governa a ordem

Cada marco termina numa coisa que **funciona sozinha e pode ser mostrada ao
cliente**. Não são fases de um projeto — são degraus, e parar em qualquer um
deles deixa algo de pé.

O critério de pronto do marco 1 é uma frase, e ela não menciona tecnologia:

> **A Carol registra a chamada da semana inteira no sistema, e ninguém abre a
> planilha.**

Se isso acontecer, o produto existe. Tudo que não serve a essa frase espera.

---

## Marco 1 — largar a planilha

Três planos, nesta ordem. Cada um entrega software testável.

### Plano 01 — Fundação · [`planos/01-fundacao.md`](planos/01-fundacao.md)

Projeto, banco, isolamento entre clientes, a matemática de agenda e o login.

Não tem tela de produto, e é o plano mais importante dos três: é onde moram as
decisões que não dá para tomar duas vezes — `conta_id` em toda tabela, RLS com
política, `UNIQUE (serie_id, inicio)`, e o `core/` puro.

**Pronto quando:** dá para entrar no sistema, o teste prova que um cliente não
enxerga o dado do outro, e a expansão de uma série em datas está coberta por
teste unitário rodando sem banco.

### Plano 02 — Operação

As telas que a Carol usa: **Sessão** (com chamada em lote), **Hoje**, **Grade da
semana**, **Pessoas**, **Ficha**, **Novo agendamento**, **Buscar vaga**.

A tela de Sessão é a prova do produto e é onde o esforço vai. As outras existem
para chegar até ela.

**Pronto quando:** com a grade cadastrada na mão, dá para registrar a chamada de
um dia inteiro pelo celular, encaixar uma reposição, e ver a semana no desktop.

### Plano 03 — Implantação

O que faz um cliente real entrar: **Grade fixa**, **Configuração** (com
vocabulário), **Pendências** e **Importador**.

O importador vem por último de propósito. Ele é o mais chato e o mais fácil de
errar, e escrever ele antes de as telas existirem significa importar às cegas,
sem ter onde conferir o resultado. O `planilhas/extrai.py` já resolve metade da
leitura do formato do MGM.

**Pronto quando:** a planilha de agosto entra no sistema, o relatório mostra o
que não casou, e a grade resultante bate com a folha na parede.

---

## Marco 2 — o bot conversa com a agenda

Só depois que o marco 1 estiver em uso real.

- **API v1** — `/disponibilidade`, `/pessoa`, `/agendamento`, `/presenca`,
  `/catalogo`, com token por conta
- **Eventos de saída** — a tabela outbox, o webhook assinado para o AutoFluxos, e
  o e-mail pelo Resend
- **Notificações** — cancelamento de sessão e lembrete de horário
- **Confirmação por bot** — a pessoa avisa pelo WhatsApp que vai ou não vai, e a
  vaga abre sozinha
- **Lista de espera** — aviso automático quando abre vaga

Nada disso exige tabela nova: o modelo do marco 1 já comporta
([ARQUITETURA.md](ARQUITETURA.md), seções de eventos e API).

**Pronto quando:** alguém manda mensagem no WhatsApp do estúdio, remarca sozinho,
e a mudança aparece na tela da Carol sem ninguém digitar.

---

## Marco 3 — segundo cliente, sem tocar em código

O teste de verdade do produto. Encaixar um negócio de outro ramo — barbearia,
clínica, o CT de boxe — usando **só configuração**: vocabulário, serviços,
profissionais, grade.

Se em algum momento a resposta for "precisa mudar o código", isso é **sinal de
alerta, não tarefa**. Significa que faltou uma configuração genérica, e o certo é
criar a configuração genérica — nunca o remendo daquele cliente.

---

## Fora de escopo, e por quê

| O quê | Por que não agora |
|---|---|
| Financeiro, cobrança, contrato | É outro produto. `pessoa` guarda vencimento como data, para avisar. |
| Aplicativo de quem é atendido | O WhatsApp é o app dela. Derruba login público e tela de aluno. |
| Conteúdo, vídeo, comunidade | Não é agendamento. |
| Onboarding por ramo | O modelo comporta; construir agora é adivinhar. |
| Relatórios | Depois que houver dado real para relatar. |

## Onde o estado fica

`docs/ESTADO.md` — onde paramos e o que fazer em seguida. É o arquivo que se lê
primeiro ao voltar ao projeto, e o único que pode estar sempre desatualizado sem
causar dano, desde que se saiba disso.
