# Pôr a Verandi de pé

O produto opera. O negócio não pode vender. Este plano é sobre a segunda frase.

Escrito em 15/ago/2026, depois de uma passada geral pedida pelo Gabriel com a
pergunta certa: **o que falta para este projeto estar de pé e funcionando?** A
resposta não é funcionalidade. Os quatro itens abaixo não apareciam em plano
nenhum, e os quatro só doem depois que existe cliente pagando, que é exatamente
para onde o produto está indo.

A ordem é de risco. O primeiro item trava a venda; o segundo trava o sono.

---

## 1. O papel: termos, privacidade e contrato de operador

> **Feito em 15/ago/2026, como minuta.** Os três documentos existem, termos e
> privacidade estão no ar, e o link está nos quatro lugares. O que sobrou é
> decisão de gente, e está listado em [`../juridico/README.md`](../juridico/README.md).
>
> Duas coisas que este plano dizia e a execução corrigiu:
>
> - **O banco não está no exterior.** Supabase `sa-east-1`, São Paulo,
>   conferido na API. A tabela de subprocessadores abaixo deduzia pela sede da
>   empresa. Quem sai do país é a aplicação (Vercel `iad1`, Washington) e o
>   e-mail (Brevo, União Europeia).
> - **A tela já exporta parte do dado.** A lista de quem é atendido sai em
>   planilha com o filtro aplicado, o que muda o que a cláusula de portabilidade
>   pode afirmar. A conta inteira ainda é `pg_dump` na mão.

### Por que isto é o primeiro item

A Verandi guarda o nome, o telefone e o "hérnia de disco, não pode carga axial"
de gente que **nunca ouviu falar da 4YU**. Quem coletou foi o cliente. Isso não
é detalhe de compliance: é a estrutura do produto, e o código já foi construído
em cima dela.

- O cliente é **controlador**; a 4YU é **operadora** (LGPD, art. 5º, VI e VII).
- O art. 39 diz que a operadora trata os dados **segundo as instruções** do
  controlador. Instrução se dá por contrato. Sem contrato, não há instrução: há
  uma empresa guardando dado sensível de terceiro sem base documentada.
- O primeiro cliente que for clínica vai ter alguém perguntando por isso antes
  de assinar. E clínica é justamente o segmento onde o `observacao_visivel`
  vale mais.

O incômodo é que **o código já respeita tudo isso** e o papel não existe:

| O que o código já faz | Onde |
|---|---|
| Anonimiza sem destruir histórico de terceiros | `anonimizarPessoa`, migration `0043` |
| Separa quem lê a anotação, nas duas caixas, com padrão fechado | `0043` e `0044` |
| Registra quem atendeu ao pedido de exclusão, sem copiar o nome | `log_configuracao` |
| Isola conta de conta por RLS, provado por teste | todas as migrations |
| Guarda hash de token e de chave, nunca o segredo | `convite`, `chave_api` |

Falta dizer no papel o que ele já faz.

### O que precisa existir

1. **Termos de uso.** Quem pode usar, o que a 4YU garante e o que não garante,
   suspensão, encerramento, e o que acontece com o dado depois que a conta
   fecha. Este último ponto tem resposta técnica pronta: `desfazer-verandi.sql`
   e a decisão de anonimizar em vez de apagar.
2. **Política de privacidade** com os dois papéis separados **com todas as
   letras**: a 4YU é **operadora** do dado de quem é atendido, e **controladora**
   do dado de quem tem login (o dono, a recepção, o profissional). Misturar os
   dois é o erro mais comum, e é o que faz um jurídico desconfiar do resto.
3. **Adendo de tratamento de dados** no contrato: finalidade, prazo,
   subprocessadores, medidas de segurança, e o destino do dado no fim.
4. **Encarregado com endereço público** (`privacidade@4yu.com.br` serve). A
   ANPD espera achar isso, e o titular também.
5. **Link no rodapé do sistema e no pé do e-mail.** Documento que ninguém acha
   é documento que não existe.

### Subprocessadores, que é onde quase todo mundo esquece

Precisa estar declarado, com transferência internacional:

| Quem | O quê | Onde |
|---|---|---|
| Supabase | banco, autenticação, arquivo | fora do Brasil |
| Brevo | envio de e-mail transacional | fora do Brasil |
| Vercel | hospedagem da aplicação | fora do Brasil |

Não é impeditivo. É declaração, e a falta dela é que pega.

### Como fazer, sem gastar o que não precisa

Um agente redige a minuta dos três documentos a partir do que o sistema
realmente faz — e isso é uma vantagem real, porque a maioria das minutas de
mercado descreve um sistema genérico que não é o seu. Depois vai para revisão de
advogado. O caminho inverso, advogado escrevendo do zero sobre um produto que
ele não conhece, custa mais e descreve pior.

**Quem assina é o Gabriel.** Um agente não assume risco jurídico.

### O que **não** entra agora

Certificação, ISO, relatório de impacto (RIPD) e mapeamento formal de fluxo. São
proporcionais a uma operação que ainda não existe. O RIPD passa a valer quando
houver tratamento em escala de dado sensível, e um estúdio não é escala.

---

## 2. Backup

**Hoje não existe.** Está anotado no `ESTADO.md` com a ressalva "aceitável
enquanto não há cliente pagante". Vender encerra a ressalva.

O plano gratuito do Supabase não tem PITR nem backup automático, e o banco é
**dividido com o AutoFluxos**: um `delete` errado atinge os dois produtos, e
restaurar significa restaurar o projeto inteiro. Ver
[`BANCO-COMPARTILHADO.md`](../BANCO-COMPARTILHADO.md).

**Caminho barato, uma sessão:**

- `pg_dump` diário do schema `app_verandi` para fora do Supabase.
- Guardar onde o Supabase não alcança. Backup no mesmo lugar que o banco protege
  contra `delete`, não contra perder a conta.
- Reter alguns dias, e apagar o resto: dump é cópia integral de dado pessoal, e
  guardar para sempre é criar o próximo problema de LGPD.
- **Testar a restauração.** Um backup que ninguém restaurou não é backup, é
  esperança. Restaure num projeto descartável e confira que a conta de teste
  volta com grade e chamada.

**Caminho definitivo:** plano pago do Supabase, com PITR. É decisão de dinheiro,
e ela chega junto com o primeiro cliente pagando.

---

## 3. Saber quando quebra

Um 500 em produção hoje é **invisível**. Não há Sentry, não há alerta, e o
`console.error` das rotas de API vai para o log da Vercel, que ninguém abre de
manhã.

Com um cliente e o Gabriel olhando, dá para viver assim. Com cinco, **o cliente
vira o monitoramento** — e isso custa o cliente.

O barato, meia sessão: Sentry no plano gratuito ou o alerta nativo da Vercel,
mandando para um canal que alguém lê.

Dois casos que já existem e ninguém enxerga:

- **O webhook do Brevo** marca convite como `voltou` ou `bloqueado`, e isso só
  aparece se alguém abrir a tela de Usuários daquela conta. O dono convida
  `maria@gmial.com`, o e-mail volta, e ninguém fica sabendo.
- **A chave de API** com muitos 401 seguidos é integração quebrada do outro
  lado, e o sintoma é o bot parar de marcar sem avisar.

---

## 4. Uma página no site

`4yu.com.br` tem `/deixei-aqui`, `/rodape`, `/crm` e `/quanto-cobro`. **Não tem
`/verandi`.** O produto está no ar e não há para onde mandar um interessado.

Trabalho de site (`website/site/`, deploy por `website/scripts/deploy.py`), não
de produto. O que a página precisa ter: o que é, para quem é, três telas de
verdade, e um formulário de contato.

**O cadastro público não entra**, por decisão de 14/08: a conta nasce pela mão
da 4YU, com `cria-conta.mjs`. O formulário coleta nome, e-mail e telefone, e o
resto é conversa.

A página de privacidade que existe hoje fala só do Deixei Aqui, e vai precisar
cobrir a Verandi quando o item 1 sair.

---

## O que isso tudo custa, em sessões

| | |
|---|---|
| Minuta dos três documentos + telas de termos e privacidade | 1 a 2 |
| Backup com restauração testada | 1 |
| Monitoramento | ½ |
| Página no site | 1 |

Quatro a cinco sessões separam "o produto funciona" de "dá para vender sem
medo". É menos do que parece, e nenhuma delas depende de decisão difícil, exceto
a assinatura do item 1.

---

## E o Marco 2?

Continua, e não conflita: a Fase 3 é a única coisa de código realmente pendente,
e o plano está em [`10-marco-2-api.md`](10-marco-2-api.md).

A ordem entre este plano e aquele é do Gabriel. A recomendação aqui é fazer o
**item 2 (backup) antes de qualquer coisa nova**, porque ele é o único que
protege o que já existe, e o **item 1 antes da primeira proposta comercial**,
porque é ele que a trava.
