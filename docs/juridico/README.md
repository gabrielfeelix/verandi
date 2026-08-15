# O papel da Verandi

Três documentos, escritos em 15/ago/2026 a partir do que o sistema realmente
faz. **São minutas.** Quem assume o risco jurídico assina, e antes disso elas
passam por advogado.

| Documento | Onde mora | Publicado? |
|---|---|---|
| Termos de uso | `src/core/legal/termos.ts` | sim, em `/termos` |
| Política de privacidade | `src/core/legal/privacidade.ts` | sim, em `/privacidade` |
| Adendo de tratamento de dados | [`ADENDO-TRATAMENTO-DE-DADOS.md`](ADENDO-TRATAMENTO-DE-DADOS.md) | não, é assinado |

## Por que os dois primeiros moram no código

Porque eles são tela. Renderizar um `.md` exigiria uma dependência nova para
resolver um problema que não existe, e manter o texto em dois lugares é como
toda divergência começa. O conteúdo é dado estruturado, a tela o desenha, e
`tests/unit/legal.test.ts` confere o que não pode faltar: os dois papéis
separados, os três fornecedores com a região certa, o endereço do encarregado,
e nenhum travessão.

Editar texto legal é editar `termos.ts` ou `privacidade.ts`. Não há outro lugar.

## Onde os links aparecem

Rodapé de toda tela do sistema, rodapé das telas de acesso (entrar, esqueci,
convite), pé de todo e-mail, e uma frase de aceite na tela de criar senha do
convite. O par de links sai de `LINKS_LEGAIS`, em `src/core/legal/index.ts`:
documento novo entra ali e aparece nos quatro lugares de uma vez.

---

## O que falta, e é decisão sua

### 1. Identificação da empresa

`EMPRESA` em `src/core/legal/comum.ts` está com **razão social, CNPJ e endereço
vazios**, e campo vazio some da tela em vez de virar "[preencher]" na cara do
cliente. Um documento sem identificação de quem responde por ele é o primeiro
buraco que um jurídico aponta. Preencher é uma linha em cada campo.

### 2. `privacidade@4yu.com.br` precisa existir

Os três documentos publicam esse endereço como o do encarregado. Hoje ele **não
existe**. Publicar endereço que devolve erro é pior que não publicar: vira prova
de que ninguém atende. Crie o alias e aponte para uma caixa que alguém lê.

### 3. Cópia de segurança, que o Anexo II não pode declarar

O anexo de medidas de segurança tem um bloco marcado como pendente, e ele fica
assim até o item 2 do [`plano 11`](../planos/11-por-em-pe.md) existir. **Não
assine com uma declaração de backup que o sistema não tem.** É o tipo de frase
que só é lida depois do incidente, e aí ela é a prova contra.

### 4. Três números que são seus, não meus

| O quê | Está escrito como | Onde |
|---|---|---|
| Prazo para pedir cópia depois do fim | 30 dias | termos §11, adendo §10 |
| Prazo de entrega da cópia | 15 dias do pedido | termos §11, adendo §10 |
| Limite de responsabilidade | 12 meses de pagamento | termos §12 |
| Aviso de incidente ao cliente | 48 horas | adendo §5 |

Nenhum deles é obrigação legal fixa: são escolhas de contrato. O advogado vai
querer opinar, e você também.

### 5. A cópia completa dos dados é manual hoje

A tela já exporta em planilha a lista de quem é atendido, com o filtro que
estiver aplicado. Ela **não** cobre a conta inteira: fica de fora o histórico de
participação, a observação da ficha e da chamada, a grade e a configuração.

Os três documentos prometem cópia da conta em formato aberto, e hoje isso é um
`pg_dump` filtrado por conta, na mão. Com um cliente, está certo assim, e a
promessa é de 15 dias justamente por isso. Com cinco, vira botão.

### 6. Virar a chave depois da revisão

`EM_REVISAO`, em `src/core/legal/comum.ts`, está em `true`, e as duas telas
mostram uma tarja discreta dizendo que o texto está em revisão jurídica. Depois
do advogado: `false`, versão nova, e data nova em `VIGENTE_DESDE`.

### 7. O site ainda fala só do Deixei Aqui

`website/site/privacidade/` cobre o site institucional e o Deixei Aqui. Quando a
página `/verandi` existir (item 4 do plano 11), ela precisa apontar para
`https://verandi.4yu.com.br/privacidade`, e não repetir o texto: duas políticas
que descrevem o mesmo produto divergem em seis meses.

---

## Uma correção de fato que a minuta trouxe

O `HANDOFF.md` e o plano 11 diziam "Supabase e Brevo, os dois com dado no
exterior". **O banco está em São Paulo** (`sa-east-1`), conferido na API do
Supabase, não deduzido da sede da empresa. Quem sai do país é a aplicação, que
roda em Washington (`iad1`, conferido na API da Vercel), e o e-mail, que sai pela
União Europeia.

A diferença não é cosmética: transferência internacional se declara pelo lugar
onde o dado é tratado. Declarar o banco como estrangeiro seria declarar errado, e
declarar a aplicação como nacional seria omitir. Os dois documentos dizem as
três regiões, com o nome da região do fornecedor, para que a próxima pessoa
possa conferir em vez de acreditar.
