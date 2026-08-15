# A API que escreve, e a porta para quem vier depois

O [plano 10](10-marco-2-api.md) desenhou cinco fases e entregou duas. Este
retoma da três, e acrescenta o que aquele não tinha: **a documentação pública**,
porque uma API que só a 4YU sabe usar não é uma API, é um acordo verbal.

Escrito em 15/ago/2026, a pedido do Gabriel, com duas ordens dele: primeiro
fechar o que serve às nossas duas ferramentas, depois pensar em terceiros; e a
documentação no espírito da do RD Station, curta e direta, sem enfeite.

---

## Parte A. Até onde o robô vai

Antes de escrever rota, é preciso responder onde a automação para. A resposta não
sai de princípio, sai do dia de um estúdio: seis momentos de conversa, e o que
cada um exige da agenda.

| A pessoa diz, no WhatsApp | O bot precisa | Existe? |
|---|---|---|
| "tem horário quinta de manhã?" | listar o que está livre | ✔ `GET /disponibilidade` |
| "com qual professora?" | o catálogo da conta | ✔ `GET /catalogo` |
| "sou a Marina, quero marcar" | achar a pessoa, ou cadastrar | ✔ busca · **falta** cadastrar |
| "quais são meus horários?" | a agenda dela, com o id de cada participação | **falta** |
| "não vou poder ir amanhã" | desmarcar com aviso, virando crédito | **falta** |
| "quantas reposições eu tenho?" | a situação dela | **falta** |

As três últimas linhas são a descoberta deste plano, e o plano 10 não as tinha.
**Sem elas a Fase 3 não fecha o ciclo:** dá para marcar e não dá para desmarcar,
porque o bot nunca soube o id da participação. Uma API que só sabe criar produz
uma agenda que só cresce.

### As três linhas que o robô não cruza

**1. Configuração não é do robô.** Grade, série, serviço, profissional, local,
capacidade, funcionamento e feriado continuam sendo tela. O robô não abre turma,
não muda capacidade e não passa da lotação. Isso já é regra de produto em
`core/agenda/encaixe.ts` e aqui é contrato.

**2. O robô não apaga.** Ele desmarca, que é outra coisa: a participação vira
`falta_avisada`, libera a vaga para a próxima pessoa e gera o crédito de
reposição, conforme a conta configurou. Apagar a linha destruiria o crédito e o
histórico, e é por isso que `removerParticipacao` fica fora da API mesmo
existindo na tela. Anonimizar pessoa, com mais razão: é direito do titular,
exige o dono digitando o nome, e não existe desfazer.

**3. Observação nunca sai pela API.** É onde mora "lesão no ombro, não pode carga
axial". A tela já separa quem lê, com padrão fechado; mandar isso para um sistema
de conversa seria abrir pela porta dos fundos o que a `0043` e a `0044` fecharam
pela frente. **Nem entra, nem sai**, e a documentação diz isso em voz alta,
porque é justamente o tipo de campo que alguém pediria depois.

### O que a Verandi devolve de volta

Hoje a conversa é de mão única: o bot pergunta, a Verandi responde. Falta o
contrário, e é a Fase 4. A recepção cancela a aula de quinta pela tela, e o bot
precisa saber para avisar as seis pessoas. Sem isso, quem avisa é o cliente
chegando na porta fechada.

---

## Fase 3. Escrever

### As rotas

| Rota | O que faz |
|---|---|
| `POST /api/v1/pessoas` | cadastra. Nome é o único obrigatório, igual à tela |
| `GET /api/v1/pessoas/:id` | a ficha resumida: situação, reposições em aberto, última presença |
| `GET /api/v1/pessoas/:id/agenda` | os próximos horários dela, **com o id da participação** |
| `POST /api/v1/participacoes` | marca alguém num horário |
| `DELETE /api/v1/participacoes/:id` | desmarca com aviso, virando crédito |

`DELETE` é o verbo certo do ponto de vista de quem chama ("tire essa marcação"),
e do lado de cá ele **não apaga**: grava `falta_avisada`. A documentação explica
isso em uma linha, porque a surpresa seria pior que a assimetria.

### A armadilha, e como ela some

`encaixar` mistura a regra com `cookies()`, via `quemRegistra()`. A rota **não
pode** reimplementar "cabe ou não cabe": no dia em que a tela e a API discordarem,
ninguém descobre por semanas.

O miolo sai para `src/server/agenda/encaixe.ts`, uma função que recebe o cliente
de banco, a conta e o carimbo de quem registra. A ação de tela continua lendo
`cookies()` e passa o carimbo da recepção; a rota passa o carimbo do bot, com
`registrado_por_origem: 'bot'`, que existe no enum desde a `0033`.

**O robô nunca confirma acima da capacidade.** `confirmarAcima` é decisão de
quem está no balcão, olhando para a pessoa. A rota chama a mesma função com
`confirmarAcima: false`, sempre, e devolve 409 quando não cabe.

### Idempotência

O bot repete chamada: a rede cai, o WhatsApp reentrega, a esteira roda duas
vezes. Sem defesa, o primeiro dia de produção tem gente marcada em duplicidade.

Toda escrita aceita `Idempotency-Key`. A segunda chamada com a mesma chave
devolve **a mesma resposta**, com o mesmo status, sem executar nada. Migration
nova, `pedido_idempotente`: chave, conta, rota, hash do corpo, status e resposta
guardada.

O hash do corpo existe para pegar o erro mais chato do gênero: mesma chave com
corpo diferente. Isso não é reentrega, é bug de quem chama, e a resposta é 422
dizendo isso, não uma marcação silenciosa no horário errado.

### Erros

| Status | Quando |
|---|---|
| `400` | pedido malformado, com `campo` |
| `401` | chave ausente, inválida, revogada, conta suspensa |
| `404` | a pessoa, a sessão ou a participação não é desta conta |
| `409` | não cabe: lotada, já participa, sessão cancelada, sessão no passado |
| `422` | mesma `Idempotency-Key` com corpo diferente |

**404 e não 403** para recurso de outra conta: dizer "existe, mas não é sua"
conta o que não precisa ser contado.

---

## Fase 4. A Verandi avisa

Outbox na mesma transação do dado, entregador separado, HMAC com o segredo da
chave, reentrega com espera crescente. Chamar o webhook dentro da ação amarraria
o cancelamento à disponibilidade do outro sistema: o AutoFluxos fora do ar
passaria a impedir a recepção de cancelar uma aula.

Eventos: `participacao.criada`, `participacao.cancelada`, `sessao.cancelada`.

## Fase 5. Lista de espera

"Não tem vaga" vira "te aviso se abrir". Só funciona depois da 4, porque é o
evento de cancelamento que dispara a chamada.

## Fase 6. A documentação pública

Uma página, no mesmo mecanismo de `/termos`: conteúdo estruturado em
`src/core/api-doc/`, tela que renderiza, teste que confere que toda rota que
existe no código está documentada. Documentação em arquivo separado envelhece; a
que tem teste, não.

O modelo é a do RD Station: começa pelo que a pessoa precisa fazer primeiro
(pegar a chave), mostra uma chamada completa que funciona copiando e colando, e
só então lista os campos. Sem tour, sem "bem-vindo à nossa plataforma".

## Fase 7. Quando existir a segunda integração

Três coisas que hoje não valem a pena e passam a valer:

- **Escopo por chave.** Hoje uma chave alcança a agenda inteira da conta. Com
  dois sistemas ligados, `leitura` e `escrita` viram caixas na hora de criar.
- **Limite de chamadas.** Ninguém abusa de uma integração que a própria 4YU
  opera. Um terceiro, sim, e sem querer.
- **Versão.** `/v1` já está no caminho. O compromisso a escrever: campo novo
  pode aparecer sem aviso, campo existente não muda de significado dentro da
  mesma versão.

---

## A ordem

1. Fase 3, incluindo as duas leituras que ela exige para fechar o ciclo.
2. Fase 6, a documentação, junto com a 3 e não depois: rota sem documentação
   nasce sem quem a use.
3. Fase 4.
4. Fase 5.
