# Integração Wellhub (Gympass): pesquisa e plano

Pesquisa de 07/out/2026. Pedido do Gabriel: aluno faz check-in no Wellhub, o
estúdio aceita, e a presença aparece confirmada na Verandi sozinha.

## Resposta curta

**Existe API e dá para fazer**, mas não depende só de código: a Wellhub
precisa aceitar a 4YU como sistema de gestão integrado (CMS) e entregar as
credenciais. Sem isso não há nem ambiente de teste completo.

## O que a Wellhub oferece a sistemas de gestão

Duas APIs para parceiros "Fitness Partners", com um token só:

| API | Para quê | Serve à Verandi? |
|---|---|---|
| **Access Control API** | validar o check-in que o aluno fez no app Wellhub | **Sim, é o pedido** |
| **Booking API** | publicar aulas e vagas no app Wellhub; aluno reserva por lá | Depois. Exige espelhar a grade inteira |

### Access Control API (o que resolve o pedido)

- **Webhook `checkin`**: a Wellhub chama a nossa URL quando o aluno faz
  check-in no estúdio. Corpo: `event_type: "checkin"`, `event_data` com
  `user` (`unique_token` = Gympass ID de 13 dígitos, `first_name`,
  `last_name`), `gym` (`id`, `title`, `product`), `location`, `timestamp`.
- **Assinatura**: cabeçalho `X-Gympass-Signature`, HMAC-SHA1 do corpo com o
  segredo que a Wellhub entrega. Conferir sempre.
- **Validar**: `POST https://api.partners.gympass.com/access/v1/validate`,
  cabeçalhos `Authorization: Bearer <token>` e `X-Gym-Id: <id do estúdio>`,
  corpo `{ "gympass_id": "..." }`. É a validação que gera o repasse ao
  estúdio, então substitui o "aceitar" manual no portal da Wellhub.
- **Erros que a tela precisa mostrar**: `checkin.validation.notfound`,
  `checkin.validation.canceled`, `checkin.validation.expired`,
  `checkin.already.validated` (um check-in validado por aluno por dia).
- Chamar de novo após timeout não duplica a validação.
- **Sandbox**: `https://sandbox.partners.gympass.com/access/v1/validate`,
  chave `testkey`, gym `1234`, e um `gympass_id` fixo por resposta
  (`1234321567890` = 200, `111111111111111` = 404, `1234321567894` =
  cancelado, `1234321567887` = expirado, `1231234321566` = já validado).
  Só simula o `validate`, não o webhook.

### Credenciais e quem pede

- **Token**: por integrador (a 4YU), cobre todos os estúdios que nos
  autorizarem. Pedido em `integrations@gympass.com` (time Techsales).
- **Gym ID**: por estúdio, é o ID de parceiro dele na Wellhub (6 dígitos,
  aparece no Portal do Parceiro).
- **Ligar um estúdio**: os sistemas já integrados (Software Pilates, LEP,
  Next Fit, W12) pedem ao estúdio esse ID; a Wellhub aprova em até 5 dias
  úteis. Pela documentação, a Wellhub avisa o sistema pelo webhook
  "System Integration Requested" (Integration Setup API).
- Custo: a Wellhub não cobra pela integração.

### Onde está a documentação

O portal antigo (`developers.gympass.com` e `developers.wellhub.com`) hoje
redireciona as páginas de parceiro para a home, e o hub novo
(`developer-hub.wellhub.com`) só cobre clientes corporativos (RH, folha). O
que está acima saiu de cópias do Web Archive (2021) e de trechos indexados
das páginas atuais. **A documentação completa vem junto com as
credenciais**: confirmar o formato do payload com ela antes de codar.

## Como ficaria na Verandi

1. **Coluna nova `pessoa.gympass_id`** (13 dígitos, única por conta).
   `identificador_externo` é o Nº da ficha e não serve. `pessoa.gympass`
   continua como marca.
2. **Configuração da conta**: campo "ID do estúdio na Wellhub" e
   interruptor "Validar check-ins automaticamente".
3. **Rota `POST /api/wellhub/checkin`**: confere a assinatura, acha a conta
   pelo `gym.id`, acha o aluno pelo `gympass_id`. Primeira vez: tenta pelo
   nome e, sem certeza, cai numa fila "Check-ins Wellhub para ligar" em que a
   recepção escolhe o aluno (lista com avatar) e o ID fica gravado.
4. **Presença**: acha a aula do aluno no dia mais próxima do horário do
   check-in e marca `presente` (mesma regra de `mudarStatus` em
   `src/server/agenda/acoes.ts`). Sem aula marcada: encaixe avulso na aula
   em andamento ou próxima, ou aviso no sino para a recepção decidir.
5. **Validação**: chama o `validate` (automático se o interruptor estiver
   ligado; senão botão "Aceitar" na fila). Erro vira aviso legível.
6. Aviso no sino a cada check-in recebido.

Tudo isso mora em `app_verandi` e não toca Auth nem `public`.

## Bloqueio e próximo passo

**Do Gabriel**: mandar o e-mail abaixo de `contato@4yu.com.br` e, em
paralelo, pedir ao Daniel (MGM Pilates) o ID do estúdio no Portal do
Parceiro Wellhub. Até a resposta, nada para codar com segurança.

> Para: integrations@gympass.com
> Assunto: Integração de sistema de gestão (Access Control API)
>
> Olá, somos a 4YU, responsável pela Verandi, sistema de gestão para
> estúdios de pilates e studios de aulas em grupo no Brasil. Queremos
> integrar a Verandi à Wellhub via Access Control API (webhook de check-in
> e validação), para que os estúdios parceiros que usam nosso sistema
> validem os check-ins automaticamente. Nosso primeiro estúdio é a MGM
> Pilates, já parceira Wellhub. Podem nos enviar o processo de cadastro
> como sistema integrado, a documentação atual e as credenciais
> (token e segredo do webhook) de sandbox e produção?
>
> Obrigado, Gabriel Barbosa, 4YU

Quando chegar: guardar token e segredo em `.secrets/4yu.env` (só o nome da
variável em doc) e seguir os passos acima.
