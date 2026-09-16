# API v1

> **A referência de quem vai chamar não mora mais aqui.** Ela é uma página do
> produto, pública, em `https://verandi.4yu.com.br/api-docs`, e o conteúdo dela
> está em `src/core/api-doc/`. Documentação em arquivo separado envelhece em
> silêncio: alguém acrescenta uma rota, ninguém lembra do `.md`, e quem descobre
> é o integrador. `tests/unit/api-doc.test.ts` confere que toda rota do código
> está descrita e que nenhuma rota descrita deixou de existir.

Este arquivo guarda o que **não** vai para a página pública: as decisões de
dentro, e o porquê delas.

O plano das fases está em [`planos/10-marco-2-api.md`](planos/10-marco-2-api.md)
e, da Fase 3 em diante, em
[`planos/12-api-que-escreve.md`](planos/12-api-que-escreve.md).

---

## O que existe

| Rota | Fase |
|---|---|
| `GET /disponibilidade` · `/catalogo` · `/pessoas?busca=` | 2 |
| `POST /pessoas` · `GET /pessoas/:id` | 3 |
| `POST /participacoes` · `DELETE /participacoes/:id` | 3 |

## As decisões que não se deduzem lendo a rota

**O robô não decide nada.** Horário cheio não aparece em `livres`, o bot não
abre turma, não muda capacidade e não passa da lotação. Isso não é limitação da
API: é regra de produto, escrita em `core/agenda/encaixe.ts`, e a tela obedece à
mesma. Quem responde por uma vaga prometida é a pessoa da recepção, e ela não
estava na conversa.

**A regra mora em um lugar só.** `encaixarNaSessao` recebe quem está
registrando; a ação de tela passa o carimbo da recepção, a rota passa o do bot.
A rota **não** reimplementa "cabe ou não cabe", e não é por elegância: se as
duas decidissem separado, um dia discordariam e as duas continuariam
respondendo com confiança.

**`DELETE` não apaga.** Grava `falta_avisada`, que libera a vaga e preserva o
crédito de reposição. Apagar a linha destruiria os dois, e o histórico junto.
Apagar de verdade continua existindo na tela, porque marcação feita por engano
quem reconhece é gente.

**Avisar tarde libera a vaga e não dá crédito**, e a resposta diz qual dos dois
aconteceu. A conta define quantas horas de antecedência valem, em Configurações
→ Padrões → "Aviso mínimo para ganhar reposição". Zero, que é o padrão, quer
dizer que todo aviso vale. O instante do aviso é o da chamada, não o da
digitação da recepção, e é isso que faz o bot poder cancelar às 23h sem tirar
reposição de quem avisou de manhã.

```json
{
  "participacaoId": "…",
  "status": "falta_avisada",
  "jaEstavaAssim": false,
  "temCredito": true,
  "horasDeAntecedencia": 26.4,
  "horasExigidas": 2
}
```

| Campo | Para quê |
|---|---|
| `temCredito` | `true` = entra na lista de reposição. É o único campo que o fluxo precisa para decidir a mensagem |
| `status` | `falta_avisada` com crédito, `falta` sem. Os dois liberam a vaga |
| `horasDeAntecedencia` | Quanto a pessoa avisou antes, para a mensagem poder ser específica |
| `horasExigidas` | O que a conta pede hoje. Serve para explicar sem chutar o número |
| `jaEstavaAssim` | A aula já estava cancelada. Chamar duas vezes não muda nada nem duplica evento |

Num fluxo do AutoFluxos: o bloco de API guarda `temCredito`, e uma condição
`temCredito igual true` separa as duas despedidas. Sem isso o bot confirma o
cancelamento e deixa a pessoa achando que tem reposição quando não tem, que é a
ligação que a recepção recebe no dia seguinte.

**Sem sessão não há RLS**, então quem isola conta de conta é o `conta_id` na
consulta da rota. É por isso que as rotas chamam as funções de `server/`, que já
recebem `contaId`, em vez de montarem consulta própria. Um `select` daqui sem
`conta_id` lê a conta de todo mundo.

**404, e não 403**, para recurso de outra conta: dizer "existe, mas não é sua"
conta o que não precisa ser contado. Mesma lógica do 401 único.

**Observação nunca sai.** É onde mora "lesão no ombro, não pode carga axial". A
tela separa quem lê, com padrão fechado; devolver isso pela API abriria pela
porta dos fundos o que as migrations `0043` e `0044` fecharam pela frente. Há
teste de navegador conferindo que a palavra não aparece na resposta.

**Idempotência grava a marca antes de executar**, e não depois. Gravar depois
deixa uma janela entre executar e registrar, e é exatamente nela que a reentrega
cai quando a rede está ruim, que é quando a reentrega acontece. A marca nasce
com `status = 0`, e quem encontra o zero recebe 409 em vez de esperar.

## Onde mexer

| O quê | Onde |
|---|---|
| Autenticação e formato de erro | `src/server/api/rota.ts` |
| Idempotência | `src/server/api/idempotencia.ts` |
| Validação de entrada | `src/core/api/pedido.ts`, com teste por regra |
| Texto da documentação | `src/core/api-doc/` |
| Regra de encaixe compartilhada | `src/server/agenda/encaixe.ts` |

Rota nova exige três coisas, e o teste cobra a terceira: a rota, o caso em
`e2e/api-v1.spec.ts`, e a entrada em `src/core/api-doc/referencia.ts`.
