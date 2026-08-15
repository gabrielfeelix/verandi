# Marco 2 — o bot conversa com a agenda

O bot é do **AutoFluxos**, não da Verandi. Ele fala com a Verandi por API: a
pessoa escolhe o horário no WhatsApp, e a Verandi já fica marcada. Do lado de
cá, o que existe é uma porta com chave, e a regra continua sendo a mesma que a
recepção usa.

Decidido pelo Gabriel em 14/08. Cadastro público e organização com várias
unidades **saíram** da lista, com o porquê no `HANDOFF.md`.

---

## A regra que atravessa o marco inteiro

**O robô não decide nada.** Isso já está escrito no `ESTADO.md` e no
`core/agenda/encaixe.ts`, e aqui vira contrato de API:

- horário cheio **não aparece** para o bot, nem como opção nem como "quase";
- o bot não abre turma, não muda capacidade e não passa da lotação. Encaixe
  acima da capacidade é decisão de quem está no balcão, com nome e registro;
- o bot não apaga nada.

O motivo é operacional, não filosófico: quem responde por uma vaga prometida é
a pessoa da recepção, e ela não estava na conversa.

**A API não pode ter uma segunda cópia da regra.** Se `avaliarEncaixe` disser
"cabe" na tela e a rota da API decidir sozinha, um dia elas discordam e ninguém
descobre por semanas. Toda rota chama a mesma função de `core/`, e onde hoje a
ação de servidor mistura regra com `cookies()`, a regra sai para uma função que
recebe quem está registrando.

---

## Fase 1 — A chave, e a tela que a entrega ✔

Sem isto nada mais existe. É a menor fatia que já tem valor: o AutoFluxos
consegue se autenticar, mesmo que ainda não haja rota para chamar.

**Banco.** Tabela `chave_api`:

| coluna | por quê |
|---|---|
| `conta_id` | a chave é **da conta**, não do usuário. Quem criou sai da empresa e a integração continua de pé |
| `nome` | "AutoFluxos produção". Sem nome, revogar vira loteria |
| `hash` | SHA-256 do segredo. **Nunca o segredo.** Token legível no banco é decisão que só dói depois de vazar |
| `prefixo` | os oito primeiros caracteres, para a tela dizer qual é sem revelar o resto |
| `ultimo_uso_em` | responde "posso revogar esta?" sem adivinhação |
| `revogada_em` | revogar não apaga: a linha fica, e o log continua fazendo sentido |
| `criada_por_usuario_id` | quem abriu a porta |

**Mostrar uma vez.** O segredo aparece na criação e nunca mais. Depois só nome,
prefixo, último uso e revogar. Já está escrito assim em `TELAS.md`.

**Tela.** `/config?s=integracoes`, a oitava seção. Ela lista **integrações**, e
não chaves: a chave é detalhe de uma delas. O AutoFluxos aparece primeiro, como
recomendado, porque é o que a 4YU opera dos dois lados. Ligar é criar a chave.

**Autenticação.** `Authorization: Bearer vr_<segredo>`. O prefixo `vr_` existe
para o segredo ser reconhecível num log e revogável na hora em que vazar.

**O que não entra:** escopo por permissão (a chave é da conta e pronto, enquanto
houver uma integração só), rotação automática, e limite de chamadas. Os três
entram quando houver a segunda integração.

---

## Fase 2 — Ler a agenda ✔

Feita. A referência de quem chama está em [`API.md`](../API.md).

Três rotas, todas `GET`, todas em cima do que já existe:

- **`/api/v1/disponibilidade`** — `de`, `ate`, e filtro opcional por serviço,
  profissional e local. Chama `horariosLivres`, que já foi escrita para isto e
  já separa cheio de livre. A tela `/vaga` e o bot passam a dar a mesma
  resposta, e é essa igualdade que sustenta a confiança no sistema.
- **`/api/v1/catalogo`** — serviços, profissionais e locais ativos. É o que o
  bot precisa para montar a pergunta ("com qual professor?").
- **`/api/v1/pessoas?busca=`** — para o bot achar quem já existe antes de
  cadastrar de novo. Usa `nome_busca`, a mesma coluna da tela.

**Fuso.** Toda data que entra e sai é local da conta, no formato `AAAA-MM-DD`, e
hora é `HH:MM`. Instante em UTC fica dentro do banco. Trocar isso na fronteira é
como nasce o bug de "a aula das 21h aparece amanhã".

---

## Fase 3 — Marcar

- **`POST /api/v1/pessoas`** — cadastra. Nome é o único obrigatório, igual à
  tela.
- **`POST /api/v1/participacoes`** — marca alguém num horário. Reusa a regra de
  `encaixar`, com `registrado_por_origem: 'bot'`, que **já existe no enum desde
  a migration `0033`**. O modelo foi feito para este dia.
- **`DELETE /api/v1/participacoes/:id`** — desmarca, e vira crédito de reposição
  pelas mesmas regras da conta.

**Idempotência.** O bot vai repetir chamada: rede cai, o WhatsApp reentrega, a
esteira roda duas vezes. Toda escrita aceita `Idempotency-Key`, e a segunda
chamada com a mesma chave devolve a **mesma** resposta em vez de marcar duas
vezes. Sem isso, o primeiro dia de produção tem gente marcada em duplicidade.

---

## Fase 4 — A Verandi avisa o AutoFluxos

Até aqui o bot pergunta e a Verandi responde. Falta o contrário: a recepção
cancela pela tela, e o bot precisa saber para avisar quem ia.

**Outbox, não chamada direta.** A ação grava o evento na mesma transação do
dado, e um entregador manda depois. Chamar o webhook dentro da ação amarra o
cancelamento à disponibilidade do outro sistema: o AutoFluxos fora do ar
passaria a impedir a recepção de cancelar uma aula.

Eventos: `participacao.criada`, `participacao.cancelada`, `sessao.cancelada`.

**Assinatura HMAC** com o segredo da chave, e reentrega com espera crescente. O
que recebe precisa conseguir provar que veio de nós.

---

## Fase 5 — Lista de espera

Quando o horário está cheio, o bot não oferece. Hoje a conversa acaba aí. A
lista de espera transforma "não tem vaga" em "te aviso se abrir", e é o que
fecha o ciclo com a Fase 4: alguém cancela, o evento sai, o bot chama a próxima.

Fica por último de propósito: sem as quatro anteriores, ela não tem como
funcionar.

---

## As perguntas que o Gabriel levantou, e onde cada uma cai

| Pergunta | Onde se responde |
|---|---|
| "quais horários o professor tem livres agora?" | Fase 2, `disponibilidade` com `profissionalId` |
| "quais estão ocupados?" | Fase 2, a mesma rota devolve as duas listas |
| "o professor escolhe ou a gente sorteia?" | **fora da Verandi.** É esteira do AutoFluxos: a Verandi diz quem tem vaga, quem decide é o fluxo do bot |
| "pode abrir turma nova?" | **não.** Grade é configuração, e o robô não configura |
| "cadastrar os horários disponíveis de cada professor" | **já existe**, é a Grade. Não há nada a construir |

A quinta linha é a que mais economiza trabalho: o que parecia faltar já está no
produto desde o Plano 03.
