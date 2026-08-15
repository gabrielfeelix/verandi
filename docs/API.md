# API v1

O que a Verandi expõe para outro sistema. Hoje há um cliente: o bot do
AutoFluxos, que atende no WhatsApp e marca aqui.

O plano das fases está em [`planos/10-marco-2-api.md`](planos/10-marco-2-api.md).
Este arquivo é a referência de quem vai **chamar**.

**Base:** `https://verandi.4yu.com.br/api/v1`

---

## A regra antes das rotas

**O robô não decide nada.**

- Horário cheio **não aparece** em `livres`, nem como "quase".
- O robô não abre turma, não muda capacidade e não passa da lotação.
- Encaixe acima da capacidade continua sendo decisão de quem está no balcão,
  com nome e registro.

Isso não é limitação da API: é regra do produto, escrita em
`core/agenda/encaixe.ts`, e a tela obedece à mesma. Quem responde por uma vaga
prometida é a pessoa da recepção, e ela não estava na conversa.

## Autenticação

```
Authorization: Bearer vr_...
```

A chave se cria em **Configuração → Integrações**, e aparece **uma vez**. O
banco guarda só o hash dela; se perder, revogue e crie outra.

A chave é **da conta**, não de quem a criou: quem ligou a integração pode sair
da empresa que o bot continua marcando.

Todas as respostas de erro têm a mesma forma:

```json
{ "erro": "o intervalo não pode passar de 90 dias", "campo": "ate" }
```

| Status | Quando |
|---|---|
| `400` | pedido malformado. `campo` diz qual corrigir |
| `401` | chave ausente, inválida, revogada, ou conta suspensa |
| `500` | falha nossa. O detalhe fica no nosso log, não na resposta |

**O 401 é sempre igual nos quatro casos.** Distinguir "revogada" de "não existe"
contaria a quem está tentando qual das portas já existiu.

## Datas

Tudo é **local da conta**: `AAAA-MM-DD` para data, `HH:MM` para hora. Instante em
UTC é recusado com 400.

Não é implicância de formato. A turma das 21h em Brasília é 00h do dia seguinte
em UTC: aceitar instante na fronteira é aceitar marcar aula no dia errado.

---

## `GET /disponibilidade`

Os horários que dá para oferecer.

| Parâmetro | |
|---|---|
| `de`, `ate` | obrigatórios, `AAAA-MM-DD`. No máximo **90 dias** entre os dois |
| `servico`, `profissional`, `local` | opcionais, uuid |

```
GET /api/v1/disponibilidade?de=2026-08-17&ate=2026-08-23&profissional=<uuid>
```

```json
{
  "de": "2026-08-17",
  "ate": "2026-08-23",
  "livres": [
    {
      "sessaoId": "…", "data": "2026-08-17", "hora": "07:00", "duracaoMin": 60,
      "servico": "Pilates solo",
      "profissionalId": "…", "profissional": "Marina",
      "localId": "…", "local": "Sala 1",
      "capacidade": 4, "ocupadas": 2, "livres": 2
    }
  ],
  "cheios": []
}
```

**Ofereça só `livres`.** `cheios` existe para o bot saber a diferença entre "não
tem horário nesse dia" e "tem, e está lotado" — são duas conversas diferentes, e
a segunda vira lista de espera na Fase 5. Sessão cancelada não aparece em nenhuma
das duas listas.

O limite de 90 dias não é de gosto: ler a agenda **materializa** as sessões da
janela, e um pedido de dois anos por ano digitado errado criaria milhares de
linhas de uma vez.

## `GET /catalogo`

O que existe na conta, para montar a pergunta.

```json
{
  "servicos": [{ "id": "…", "nome": "Pilates solo", "duracaoMin": 50, "capacidadePadrao": 4 }],
  "profissionais": [{ "id": "…", "nome": "Marina" }],
  "locais": [{ "id": "…", "nome": "Sala 1" }],
  "funcionamento": [{ "diaSemana": 1, "abre": "06:00", "fecha": "21:00" }],
  "vocabulario": { "pessoa": { "singular": "Aluno", "plural": "Alunos" }, "…": {} }
}
```

Só o que está **ativo**: o bot não deve oferecer o serviço que o estúdio parou
de dar em março.

**Use o `vocabulario` nas frases.** Sem ele, o robô de um estúdio de pilates
escreve "escolha o serviço" enquanto a tela do mesmo cliente escreve "escolha a
modalidade", e o cliente percebe antes da segunda mensagem.

`funcionamento` só traz os dias em que a casa abre. Dia que não está na lista é
dia fechado, e isso separa "não tem horário nesse sábado" de "não abrimos aos
sábados".

## `GET /pessoas`

Achar quem já existe, antes de cadastrar de novo.

| Parâmetro | |
|---|---|
| `busca` | obrigatório, **mínimo duas letras**. Sem acento funciona: `ceci` acha `Cecília` |

```json
{ "total": 1, "pessoas": [{ "pessoaId": "…", "nome": "Cecília Prado", "telefone": "11988887777", "ativa": true }] }
```

Existe para evitar o defeito mais previsível da integração: a mesma pessoa
virando três cadastros porque escreveu o nome de três jeitos no WhatsApp.

Sai o mínimo para reconhecer. Observação, nascimento e marcação **não saem**: o
bot marca aula, e ficha é da tela, onde quem lê tem papel para isso.

---

## O que ainda não existe

Fases 3 a 5 do plano, nesta ordem:

- **`POST /pessoas`** e **`POST /participacoes`** — cadastrar e marcar, com
  `Idempotency-Key`, porque o bot vai repetir chamada e ninguém quer gente
  marcada em duplicidade no primeiro dia.
- **Webhook de saída** — a recepção cancela pela tela e o bot precisa saber para
  avisar quem ia.
- **Lista de espera** — "te aviso se abrir", que só funciona depois do webhook.
