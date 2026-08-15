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

### 2. `privacidade@4yu.com.br` precisa existir, e é alias, não caixa nova

Os três documentos publicam esse endereço. Hoje ele **não existe**. Publicar
endereço que devolve erro é pior que não publicar: vira prova de que ninguém
atende.

**Não compre caixa.** O painel mostra as duas caixas com alias ativo, então
`privacidade@` entra como **alias de `contato@4yu.com.br`**, de graça, e a
mensagem cai onde você já lê.

**E não nomeie encarregado.** A Resolução CD/ANPD nº 18/2024, art. 6º, diz que
indicar encarregado é **facultativo para operador**, e a Resolução nº 2/2022,
art. 11, dispensa disso o agente de pequeno porte, exigindo em troca um **canal
de comunicação publicado**. Nomear é opt-in, e quem nomeia passa a ser obrigado
a publicar **nome completo** no site (Res. 18/2024, art. 9º). O canal sem nome é
a escolha certa aqui, e a política já está escrita assim.

### 3. Cópia de segurança, que o Anexo II não pode declarar

O anexo de medidas de segurança tem um bloco marcado como pendente, e ele fica
assim até o item 2 do [`plano 11`](../planos/11-por-em-pe.md) existir. **Não
assine com uma declaração de backup que o sistema não tem.** É o tipo de frase
que só é lida depois do incidente, e aí ela é a prova contra.

### 4. Os números que são seus, não meus

| O quê | Está escrito como | Onde |
|---|---|---|
| Preço, e a unidade | "por pessoa em atendimento", valor na proposta | termos §10 |
| Prazo para pedir cópia depois do fim | 30 dias | termos §11, adendo §10 |
| Prazo de entrega da cópia | 15 dias do pedido | termos §11, adendo §10 |
| Limite de responsabilidade | 12 meses de pagamento, com três exceções | termos §12 |
| Aviso de incidente ao cliente | **24 horas** do conhecimento | adendo §5, privacidade §10 |

Nenhum é obrigação legal fixa: são escolhas de contrato. Duas anotações que a
pesquisa trouxe:

- **O limite de 12 meses é válido em contrato entre empresas** (STJ, REsp
  1.989.291, 2024), mas o precedente pesou a **paridade entre as partes**, e o
  seu cliente é o oposto de paritário. Por isso a cláusula ganhou destaque
  visual e três exceções expressas (dolo ou culpa grave, quebra de sigilo,
  incidente de segurança). Sem elas, ela é o primeiro alvo de um jurídico.
- **As 24 horas do incidente vieram de aritmética, não de gosto.** O controlador
  tem três dias úteis para comunicar à ANPD, contados do conhecimento **dele**
  (Res. CD/ANPD nº 15/2024). Se você demora, quem perde o prazo é o cliente, e o
  operador que não seguiu instrução responde solidariamente. **Esse prazo só é
  cumprível com o item 3 do plano 11**, monitoramento: hoje um 500 em produção é
  invisível, e não dá para avisar em 24 horas sobre algo que ninguém viu.

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

## O que a pesquisa de 15/08 achou, e que não estava em plano nenhum

Quatro frentes pesquisadas com fonte oficial (ANPD, Planalto, Receita, CONCLA,
STJ). O que segue é levantamento normativo, não parecer: os dois pontos
genuinamente cinzentos, o enquadramento de alto risco e a extensão do dever do
operador em incidente, dependem de regulamentação que a ANPD ainda não publicou.

### A. Mudar a Vercel de `iad1` para `gru1` ✔ feito

**A Vercel tem região em São Paulo, `gru1`.** As funções rodavam em `iad1`,
Washington, e passaram a rodar em São Paulo por `vercel.json` na raiz do repo (e
não pelo painel, para a escolha ficar versionada junto com o motivo). Isso
**elimina** a transferência internacional para os Estados Unidos em vez de tentar
ampará-la. De quebra, encurta a distância até o banco, que já está em São Paulo.

Por que isso importa mais do que parece: a **Resolução CD/ANPD nº 19/2024** exige,
para transferência amparada em contrato, as **cláusulas-padrão do Anexo II dela,
adotadas sem alteração**, e o prazo de adequação **venceu em 23/08/2025**.
Vercel, Supabase e Brevo publicam cláusulas-padrão **europeias**, e nenhum dos
três publica as brasileiras nem vai assinar aditivo com um cliente pequeno. Ou
seja: o caminho contratual não está disponível para você. Sobra tirar o dado de
lá.

O que sobra depois da mudança é o acesso administrativo da Supabase Inc., que é
empresa americana: pela LGPD, **disponibilizar acesso** a agente no exterior já é
transferência, mesmo com o dado guardado aqui. Isso é resíduo a registrar, não a
resolver.

O Brevo está resolvido sozinho: a **Resolução CD/ANPD nº 32/2026**, de
26/01/2026, reconheceu a União Europeia como destino de grau adequado.

### B. Registrar o aceite ✔ feito

Migration `0046`, tabela `aceite_de_termos`: quem, quando, de qual endereço, com
qual navegador, e **qual versão do documento estava no ar naquele segundo**. Sem
a versão a prova é circular, porque o texto muda e não sobra como dizer a que a
pessoa aderiu.

Grava em dois lugares, e o segundo é o que resolve o problema real:

- **ao criar a senha do convite**, que é onde a frase de aceite aparece;
- **ao entrar**, porque quem já usava o produto antes de os documentos existirem
  nunca passou pela tela de convite. Sem isso, o único cliente de verdade ficaria
  para sempre sem registro. A tela de entrar ganhou a frase, com os dois links
  **ao lado do botão**, não no rodapé: aceite só vale se a pessoa teve como ler o
  que aceitou.

A tabela não é dado de conta, é prova da 4YU, e nenhum usuário logado a alcança:
RLS ligada sem política, mais `revoke` explícito. Há teste de banco provando os
dois cadeados, porque o `alter default privileges` da `0030` concede a
`authenticated` tudo que nasce no schema.

**Falha ao gravar não derruba o login**, de propósito, e o erro vai para o log.
É mais um caso que o item 3 do plano 11 existe para enxergar.

**A metade que sobra é sua:** quando a versão mudar, **manter a anterior
publicada**. Não adianta provar que alguém aceitou a 1.0 se a 1.0 não existe mais
em lugar nenhum. Os termos já prometem isso no §14.

### C. CNPJ: o MEI não serve, e o motivo não é o teto

**Desenvolvimento e licenciamento de software não estão na lista de ocupações do
MEI** (Anexo XI da Resolução CGSN nº 140/2018, conferido item a item). Não é
questão de faturamento: a atividade é de natureza intelectual, e é vedada. Há
projeto no Congresso para mudar isso, aprovado em uma comissão em 2026, o que
não é lei.

O caminho é **ME no Simples Nacional**, com CNAE `6203-1/00` (licenciamento de
programa não customizável) e `6311-9/00` (hospedagem e provedor de serviço de
aplicação). Qual dos dois é o principal é a pergunta a levar ao contador **antes**
de registrar, porque ela decide o anexo: licenciamento cai no Anexo III ou V
conforme o Fator R; sem folha de salários, começa no Anexo V. Custo de abertura e
contabilidade mensal existem e são baixos, mas existem.

O que muda enquanto não há CNPJ, e é o que pesa de verdade:

- **A LGPD se aplica igual.** O art. 3º alcança pessoa natural, e a exceção do
  art. 4º, I, exige uso particular **e** não econômico. Vender assinatura é
  atividade econômica.
- **Você se enquadra como agente de pequeno porte mesmo assim.** A Resolução
  CD/ANPD nº 2/2022, art. 2º, I, inclui expressamente "pessoas naturais" que
  assumem obrigações de operador. É o que dispensa o encarregado.
- **A responsabilidade é pessoal e ilimitada.** Sem PJ não existe separação
  patrimonial. Num produto que guarda dado de saúde de paciente de clínica, essa
  é a diferença que importa, e ela não aparece em nenhuma cláusula.
- **O cliente PJ vai pedir nota**, e pagar autônomo obriga o estúdio a virar
  responsável tributário, com retenção e obrigação acessória. Perde-se venda por
  um motivo que não é o produto.
- **Sem CNPJ não há recorrência em cartão**, só Pix na mão.

### D. O campo de observação é o risco central do produto

Aparece nas quatro pesquisas, por caminhos diferentes:

- É ele que pode empurrar o tratamento para **alto risco** (Res. 2/2022, art. 4º,
  critério específico "utilização de dados pessoais sensíveis"), e alto risco
  **derruba o regime de pequeno porte inteiro**, com o encarregado e os prazos em
  dobro junto. Falta o critério geral, e "larga escala" não se sustenta com um
  cliente, mas o critério de "afetar significativamente direitos" é argumentável.
- É ele que baixa o gatilho de comunicação de incidente: dado sensível já basta.
- É por ele que o produto escorrega de agenda para **prontuário**, e aí passam a
  incidir sobre o **cliente** as regras de registro profissional (CFM, e COFFITO
  para fisioterapeuta, que é quem conduz metade dos estúdios de pilates), com o
  seu sistema no meio.

Boa notícia: **certificação SBIS/CFM não se aplica.** O artigo da Resolução CFM
1.821/2007 que criava o selo foi revogado em 2018, e o escopo da certificação
cobre prontuário, telessaúde, prescrição e SADT, não agenda. O que se aplica é a
LGPD.

Os termos já dizem, com destaque, que a Verandi não é prontuário e que o
conteúdo do campo é responsabilidade do cliente. O que sobra é decisão de
produto, não de documento: até onde vale estruturar o campo, e se ele merece
cifragem própria.

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
