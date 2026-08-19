# Passagem de bastão

> **Banco compartilhado, leitura obrigatória:** antes de qualquer mudança em
> Supabase, migration, Auth, RLS, Storage, extensão ou Data API, leia
> [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md). Verandi usa `app_verandi`;
> AutoFluxos usa `public`; os recursos globais afetam os dois.

Este arquivo é o **atalho**: onde o produto está, o que falta, e por qual ponta
pegar. Ele não substitui o [`ESTADO.md`](ESTADO.md), que descreve o sistema
inteiro e é a leitura obrigatória.

**Leia nesta ordem:** `ESTADO.md` inteiro → este arquivo → o plano do que você
for fazer.

Última revisão: 19/ago/2026, na sessão em que alguém percorreu o fluxo inteiro
como usuário, na mão: cadastrar aluno, completar a ficha, contratar plano,
receber em duas parcelas, emitir recibo, cancelar recibo, conferir o fechamento.
O ciclo fechou. O que apareceu foi um recibo que faltava metade do que um recibo
tem, o trilho do sistema imprimindo por baixo dele, e o e-mail de quem emite indo
impresso na via do aluno.

---

## Onde o produto está, em números conferidos em produção

A Verandi está **no ar** em `https://verandi.4yu.com.br`, com deploy automático
a cada push na `main`.

| | | |
|---|---|---|
| Contas de cliente | **1** (MGM Pilates) | conferido 18/08 |
| Migrations aplicadas | **29** em produção, da `0030` à `0058`. A `0059` está escrita e aplicada só no local | ver o quadro acima |
| Tabelas em `app_verandi` | **39** de base, todas com RLS | conferido 19/08, contando `pg_tables` |
| Tabelas em `public` (AutoFluxos) | **33**, intactas | eram 22 na última contagem; o crescimento é do AutoFluxos, não nosso |
| Banco | **16 MB** de 500 do plano gratuito, dividido com o AutoFluxos | conferido 18/08 |
| Testes | **620** de unidade e banco · **229** de navegador | as duas suítes verdes em 19/08 |
| Planos em produção | **29**, em 11 serviços | a tabela do cliente inteira, conferida linha a linha |
| Movimento em produção | **18 contratos · 46 cobranças · 40 recibos** | **é ensaio, e sai com um comando**; ver o quadro abaixo |
| API v1 | nove operações e quatro eventos de webhook, com documentação em `/api-docs` | |
| Telas | 14 no sistema, mais acesso, legais e `/api-docs` | |
| Blocos arrumáveis na `/hoje` | **7**, por usuário | migration `0058`, aplicada em produção em 19/08 |

> ## PEGUE POR AQUI
>
> **Produção está cheia de dado de ensaio, e ele precisa sair antes de o cliente
> usar.** Hoje, na conta MGM Pilates: **29 planos e 11 serviços que são reais**,
> e **18 contratos, 46 cobranças, 41 pagamentos e 40 recibos que não são**. Foram
> criados de propósito, para as telas pararem de abrir vazias e dar para ver o
> módulo funcionando; as pessoas e os planos são de verdade, o movimento
> financeiro não.
>
> Apagar é um comando, e ele está no scratchpad da sessão de 19/08
> (`enche-producao.ts --desfazer`). Se o arquivo tiver sumido, é este SQL, e ele
> não encosta em plano, pessoa, série nem sessão:
>
> ```sql
> set search_path = app_verandi;
> begin;
> delete from recibo   where conta_id = (select id from conta where slug = 'mgm-pilates');
> delete from contador_recibo where conta_id = (select id from conta where slug = 'mgm-pilates');
> delete from pagamento where conta_id = (select id from conta where slug = 'mgm-pilates');
> delete from cobranca  where conta_id = (select id from conta where slug = 'mgm-pilates');
> delete from contrato  where conta_id = (select id from conta where slug = 'mgm-pilates');
> commit;
> ```
>
> **Faça isso antes da primeira venda de verdade.** Recibo emitido gasta número,
> e a numeração não pode ter buraco: se o ensaio ficar, a primeira venda real do
> estúdio sai como A-000041 e os quarenta anteriores viram papel que não existe.
>
> ### O que continua faltando, e depende do cliente
>
> 1. **A razão social de verdade.** Hoje está `MGM Pilates`, preenchida
>    provisoriamente para os recibos poderem sair. O CNPJ já está na conta, digitado
>    pelo Gabriel; o texto que vai impresso no papel é o do cartão de CNPJ, e
>    ninguém o tem aqui. O endereço continua vazio.
> 2. **As matrículas em curso.** A planilha de turma tem nome, matrícula,
>    telefone e vencimento; **ela não diz qual plano cada pessoa comprou**, e sem
>    isso não há como digitar as 84 sem inventar. Atenção ao que o sistema faz de
>    propósito: **a cobrança começa no mês do cadastro**, e não no início
>    retroativo do contrato. Quem digitar precisa avisar o cliente.
>
> ### O que a tabela do cliente tinha de errado, e o que foi feito
>
> As 43 linhas do documento viraram **29 planos**, porque "aluno MGM" e "não
> aluno MGM" são os **dois preços da mesma linha**, e não dois planos (é o que a
> `0054` foi desenhada para fazer: dois planos fariam o recibo dizer o nome
> errado e o relatório somar serviço com serviço). O que sobrou de anomalia foi
> **entrado como está escrito** e listado aqui, porque documento do cliente não
> se corrige de memória:
>
> | Onde | O que o documento diz | Por que chama atenção |
> |---|---|---|
> | RPG, pacote 10, preço cheio | R$ 2.100 | todos os outros pacotes custam nove sessões; nove de R$ 230 dá R$ 2.070 |
> | Liberação Miofacial, pacote 10, preço de cliente | R$ 810 | nove de R$ 150 dá R$ 1.350; R$ 810 é exatamente o pacote da Ventosaterapia, ao lado |
> | Código do pacote de RPG | 104, repetido com a sessão | entrou como **106**, que era o único livre do bloco |
> | "Liberação Miofacial", "Toque de Tensigridade" | grafia do documento | ficaram como o cliente escreveu; corrigir a palavra do cliente é decisão dele |
> | Validade dos pacotes | o documento não diz | entrou com **6 meses**, que é o padrão da própria tela |
>
> Nenhuma dessas cinco é bug do sistema, e nenhuma se resolve sem o cliente.
> São **cinco perguntas para a primeira conversa**, e valem dinheiro real: as
> duas primeiras são preço cobrado errado toda vez que alguém vender aquele
> pacote.

---

## O que existe, tela por tela

| Tela | Quem vê | O que faz |
|---|---|---|
| `/hoje` | todos | o dia, com chamada e busca rápida |
| `/semana` | dono, recepção | a agenda da semana |
| `/pendencias` | dono, recepção | o que exige decisão humana hoje, com exportação |
| `/pessoas` e `/pessoas/[id]` | dono, recepção | cadastro, ficha, agenda, histórico, reposições, contratos, cobranças, avaliação |
| `/vaga` | dono, recepção | onde ainda cabe alguém |
| `/grade` | dono, recepção | a grade fixa que gera as sessões |
| `/sessao/[id]` | todos | a chamada, encaixe, cancelamento |
| `/financeiro` | dono, recepção | cobranças em atraso, a vencer, recebidas, canceladas e o fechamento |
| `/recibos` e `/recibos/[id]` | dono, recepção | o arquivo de recibos e a folha em duas vias |
| `/aulas` | dono | quantas aulas cada profissional aplicou |
| `/config` | dono | serviços, planos, recibo, equipe, locais, padrões, vocabulário, funcionamento, usuários, integrações |
| `/contas-4yu` | suporte | as contas de cliente, do lado da 4YU |
| `/api-docs`, `/termos`, `/privacidade` | público | |

**Quem atende vê o dia dele, a chamada e a avaliação. Não vê dinheiro.** A
separação mora em `src/server`, e não no banco: RLS isola conta, não papel.

---

> ## O QUE ESPERA PRODUÇÃO
>
> **A migration `0059` está escrita, aplicada no banco local e testada, e não
> foi aplicada em produção.** Ela acrescenta três colunas em `conta`
> (`assinatura_path`, `assinatura_nome`, `assinatura_cargo`), cria o balde
> privado `assinatura-recibo` e a tabela `envio_de_recibo`, e acrescenta
> `envio_de_recibo` ao `check` do log. Não derruba nada e não encosta em
> `public`. Sem ela, a tela de recibo quebra ao ler a assinatura.
>
> Banco primeiro, código depois, que é a ordem que não deixa a tela procurar
> coluna que não existe:
>
> ```bash
> set -a && . ../.secrets/4yu.env && set +a
> node scripts/aplica-em-producao.mjs --dry     # deve listar só a 0059
> node scripts/aplica-em-producao.mjs
> ```
>
> A `0058` já está lá desde 19/08, conferida fora do console.

## O envio do recibo, e a legibilidade, em 19/ago

**O destino do envio deixou de ser uma pergunta.** O modal abria com um campo
vazio perguntando "para onde?", e o recibo é de quem pagou: o e-mail está na
ficha, e pedir que a recepção digite de novo, toda vez, um dado que o sistema
já tem é pedir que ela digite errado uma hora. Agora o destino aparece como
fato, e o que se acrescenta são **cópias** — o marido que cuida das contas, a
empresa que reembolsa, a contadora. Até cinco, em `cc` e não em `bcc`: quem
paga tem o direito de saber para quem mais o comprovante dele foi.

Ficha sem e-mail é a única vez em que se digita um endereço, e ele **entra na
ficha**: guardar só para aquele envio deixaria a próxima pessoa na mesma
parede. Cada destinatário vira uma linha em `envio_de_recibo`, porque "eu nunca
recebi" é uma frase sobre um endereço.

**A escala de texto subiu, e o motivo não é norma.** O contraste passava em AA
em todos os tokens, e as telas continuavam cansativas: 93 lugares em 11,5px,
42 em 10,5px, 16 em 10px e 6 em 9,5px, numa fonte geométrica (DM Sans) que
afina no pequeno, lida em pé, num balcão, por quem está entre um aluno e outro.

O que mudou:

| O quê | De | Para |
|---|---|---|
| Corpo da página | 13px | **15px**, com `line-height: 1.55` explícito |
| Piso da escala | 9,5px | **11px**, com teste guardando |
| Texto de apoio (`tinta-media`) | `#5D6B66`, 4,78:1 | `#4D5A55`, **6,56:1** |
| Rótulo fraco (`tinta-fraca`) | `#656E6A`, 4,78:1 | `#525B57`, **6,38:1** |

Norma cumprida não é o mesmo que texto legível: 4,78:1 em 11,5px passa na AA e
cansa. O teste em `tests/unit/contraste.test.ts` agora mede as duas coisas, o
contraste e o **tamanho**, porque sem número "só este rótulo pode ser menor"
acontece uma vez por semana até a escala voltar ao que era.

## O que a sessão das telas usáveis fez, em 19/ago

A pergunta que faltava era de dono de negócio, e não de quem testa: **dá para
operar isto?** As telas abriam e passavam nos testes, e mesmo assim o
Financeiro dizia "10 cobranças em atraso" sem dizer **quanto**, o arquivo de
recibos não se recortava por data, e a ficha do aluno listava cobranças sem
responder se a pessoa está em dia.

| O quê | Onde |
|---|---|
| Aba "Todas" no Financeiro | `financeiro/page.tsx`; o recorte virou um só, compartilhado pela lista e pela soma |
| Filtro de período nas listas | `core/financeiro/periodo.ts`, `components/ui/barra-periodo.tsx` |
| Faixa de números por aba | `core/financeiro/metricas.ts`, `components/ui/faixa-numeros.tsx` |
| Recibos com recorte por data e totais | `recibos/page.tsx`, `resumoDosRecibos` |
| Resumo financeiro e recibos na ficha | `resumoDaPessoa`, `recibosDaPessoa` |
| Caixa do mês na `/hoje`, com comparação | `caixaDoMes` |
| Assinatura do emitente | migration `0059`, `config/recibo.tsx`, `folha.tsx` |
| Enviar o recibo por e-mail | `core/recibo/mensagem.ts`, `enviarReciboPorEmail`, `envio_de_recibo` |

**Os números somam o recorte inteiro, e não a página.** Um total que muda ao
virar a página é pior que total nenhum: quem confere caixa com ele perde a
tarde procurando a diferença. Tem teto (20 mil linhas) e o teto se anuncia na
tela em vez de a soma sair parcial em silêncio.

**A janela do Financeiro é por vencimento e a dos Recibos é por emissão**, e as
duas dizem isso com todas as letras na barra. Duas telas com a mesma barra
significando datas diferentes é o jeito mais rápido de os dois números
discordarem sem ninguém saber por quê. Nenhuma das listas nasce filtrada: uma
tela de cobranças que abre em "este mês" esconde quem deve desde junho, que é
exatamente a pessoa para quem se liga hoje.

**Um defeito de fuso apareceu, e desta vez o teste pegou primeiro.** A janela
dos recibos era montada com `'2026-01-19T00:00:00'` sem fuso, e o Postgres lia
em UTC: o recibo emitido às 21h30 no Brasil já é 00h30 do dia seguinte, e sumia
do próprio dia. É a terceira vez que essa armadilha aparece por uma porta nova.
Agora a janela sai de `instante(data, hora, fuso)`, e há teste com um recibo às
21h30.

**A assinatura: o texto congela, a imagem não.** O nome de quem assinou naquele
dia é parte do que o papel afirma, e trocar a responsável técnica em 2027 não
pode reescrever quem assinou em 2026. A imagem é a marca do estúdio, e carimbar
a segunda via com o carimbo de hoje é o que uma segunda via sempre fez.

**O e-mail leva o recibo no corpo, e não como anexo nem como link.** Quem recebe
abre no telefone e precisa ver o comprovante ali; link exigiria login, e o aluno
não tem login neste produto. A assinatura **não** vai como imagem na mensagem:
cliente de e-mail bloqueia imagem por padrão, e um recibo cuja assinatura só
aparece depois de "exibir imagens" parece adulterado.

### O que ficou pendente disto, e por quê

- **PDF de verdade não existe.** Salvar em PDF hoje é imprimir e escolher
  "Salvar como PDF" na caixa do navegador, e a tela diz isso ao lado do botão.
  Um PDF gerado pelo servidor precisa de biblioteca nova (`pdf-lib` é a
  candidata: JS puro, roda em serverless) e de refazer o layout da folha em
  coordenadas, porque nada do CSS atravessa. **É a próxima coisa a fazer no
  recibo**, e ela destrava o anexo no e-mail junto.
- **O e-mail não leva anexo** enquanto não houver PDF. `envia()` já é o único
  lugar a mexer quando houver: o Brevo aceita `attachment`.
- **A assinatura não é desenhada na tela.** Hoje se envia uma imagem. Assinar
  com o dedo num campo de desenho é o que um tablet no balcão pediria, e é
  trabalho próprio.
- **Não há filtro por forma de pagamento** no Financeiro. A busca é por nome e
  o recorte é por data; "quanto entrou no pix em agosto" só o Fechamento
  responde.

## O que a sessão do fluxo na mão fez, em 19/ago## O que a sessão do fluxo na mão fez, em 19/ago

Ninguém tinha percorrido o produto como quem usa. A suíte de navegador pergunta
se a tela abriu e o ensaio geral pergunta se o dinheiro atravessa; nenhum dos
dois pergunta se o papel que sai da impressora serve.

| O quê | Onde |
|---|---|
| A folha do recibo virou talão | `src/components/recibo/folha.tsx`, `src/core/recibo/recibo.ts` |
| O e-mail de quem emite saiu do papel | `src/server/recibo/acoes.ts`, `quemEmitiu()` no core |
| O trilho parou de imprimir por baixo da folha | `src/app/(app)/layout.tsx`, `src/app/globals.css` |
| O carimbo de cancelado parou de transbordar | `src/components/recibo/folha.tsx` |
| A lista de recibos alinhou as colunas | `src/components/recibo/lista.tsx` |
| Receber adiantado | `anteciparCobrancas` em `src/server/financeiro/acoes.ts` |
| O gerenciador de blocos da `/hoje` | `src/core/home/blocos.ts`, `src/server/home/`, `src/components/hoje/arrumar.tsx`, migration `0058` |
| O bloco de caixa na tela inicial | `resumoDoCaixa` em `src/server/financeiro/consultas.ts` |

**Três defeitos silenciosos, todos da mesma família**, e nenhum deles quebrava
teste nenhum:

1. **O e-mail do dono ia impresso na via do aluno.** `emitidoPor` caía em
   `user.email` quando quem emitia não era profissional cadastrado, e na MGM o
   dono não é. Um papel por pagamento, com o endereço pessoal dele.
2. **O trilho imprimia por baixo do recibo.** `Rail`, `BarraInferior` e
   `RodapeLegal` nunca tiveram `data-imprimir="fora"`, e `[data-folha]` era
   `position: absolute`. O nome das telas atravessava o texto do recibo.
3. **Faltavam quatro dos cinco elementos de um recibo.** Título em destaque,
   valor em algarismos destacado, local e data de emissão, assinatura
   identificada. A folha renderizava, então nada reclamava.

Os três viraram lint em `tests/unit/impressao.test.ts`: `@media print` não roda
em `jsdom`, e o que dá para garantir é que a decisão não suma num refactor.

**O que o fluxo na mão provou que funciona**, e vale escrever porque a próxima
pessoa não precisa refazer: cadastro em três campos, ficha ampliada com CPF e
endereço, contrato com validação de horários que dá a frase certa, cobrança
nascendo com o vencimento do contrato, pagamento parcial virando "Pago em
parte", segundo pagamento fechando, recibo por pagamento, cancelamento com
motivo, e o fechamento somando. As seis formas de pagamento existem desde o
módulo 17 e vêm sugeridas do contrato.

**Três incômodos menores que saíram junto:** o cartão PLANO da ficha dizia
"valor e cobrança são de outro sistema" numa tela que hoje tem os dois uma aba
ao lado; o cabeçalho da ficha mostrava o telefone cru a três centímetros do
mesmo telefone formatado; e os modais de cancelar tinham dois botões "Cancelar",
um para desistir e outro para executar.

## O que a sessão de 19/ago fez

| O quê | Onde |
|---|---|
| Produção cheia, para as telas pararem de abrir vazias | 18 contratos, 46 cobranças, 41 pagamentos e 40 recibos na conta MGM Pilates, com as pessoas e os planos reais. **Sai com o comando do quadro acima.** |
| Três defeitos no formulário do emitente | `src/components/config/recibo.tsx` e `src/server/config/acoes.ts` |
| A lentidão de toda navegação | `src/server/conta.ts` e `src/app/(app)/layout.tsx` |

**Os três defeitos do emitente vieram de uma queixa só**, e a queixa era "preenchi
e a tela de Recibos continuou dizendo que está vazio". A tela estava certa:

1. **O placeholder do campo era o nome da conta.** O campo vazio mostrava "MGM
   Pilates", que é exatamente o texto que a pessoa ia digitar. Ele digitou CNPJ e
   telefone, salvou, e saiu certo de que tinha terminado. **Sugerir o valor certo
   no lugar errado custa mais do que não sugerir nada.**
2. **Salvar aceitava meio emitente e respondia "Emitente salvo".** O asterisco
   dos dois campos prometia uma conferência que não existia em lugar nenhum.
3. **A recusa nem chegava à tela.** Erro lançado dentro de Server Action não
   atravessa a rede com o nosso texto. As duas conferências que já existiam ali,
   documento e série, **nunca mostraram a própria mensagem desde que foram
   escritas**: quem errava o CNPJ lia "alguma coisa quebrou".

**A lentidão foi medida, não adivinhada.** Cada `clienteServidor()` criava um
cliente Supabase novo, e o **primeiro `getUser()` de cada cliente é uma ida ao
servidor de autenticação** — 90 ms com o banco na própria máquina, mais em
produção. Eram quatro ou cinco por navegação: o proxy, o layout, `contaAtiva`,
`contasDoUsuario` e a página. Com `cache()` do React virou uma, e as quatro
consultas do trilho passaram a ir juntas em vez de em fila.

**O que ficou de fora e continua incomodando:** clicar numa aba (`?aba=...`) não
mostra nada acontecendo. `loading.tsx` só dispara na entrada do segmento, não
quando muda só o parâmetro, então a tela fica parada durante a ida ao servidor e
parece travada. Está na lista de higiene abaixo.

---

## O que a sessão da tabela de preços fez

| O quê | Onde |
|---|---|
| A tabela do cliente digitada em produção | 29 planos e 7 serviços novos na conta MGM Pilates, com o log que a tela escreveria |
| O ensaio geral, que faltava | `e2e/ensaio-administrativo.spec.ts`: catálogo inteiro pela tela, matrícula em três formatos, cobrança, recebimento, recibo, fechamento e cancelamento, tudo na mesma conta |
| O semeador cobrindo o administrativo | `scripts/semear-dev.mjs` passou a criar planos, contratos, cobranças e pagamentos: `/financeiro` e a aba de contratos nasciam vazias em toda sessão de desenvolvimento |
| O convite entregando o e-mail na entrada | `/entrar` virou rota de servidor com `?email=`, e o botão do convite deixou de levar a um formulário vazio |
| `escolher()` achando campo obrigatório | `e2e/apoio.ts` procurava pelo rótulo, e `<Campo obrigatorio>` põe um asterisco dentro dele: `'Serviço'` não casava com `Serviço*`, e a espera morria muda no tempo limite |

**O que o ensaio provou, e nenhum teste anterior provava:** que o ciclo fecha.
Vinte e nove planos em nove serviços, setenta turmas, matrícula mensal,
trimestral e por pacote, cobrança nascendo sozinha, recebimento, recibo,
fechamento batendo com a soma do dia, e o número do recibo cancelado
continuando ocupado. Os outros arquivos perguntam se a tela abriu; este
pergunta se o dinheiro atravessa o produto de ponta a ponta.

**Um defeito de teste apareceu, e é da família dos silenciosos:** o
`escolher()` da suíte nunca funcionou em campo obrigatório. Ninguém tinha
notado porque os dois lugares que o usavam não eram obrigatórios. Não quebrava
nada; só nunca tinha sido exercido.

---

## O que 18/ago fez, em uma tela

Seis módulos, do 14 ao 19, que juntos cobrem **os nove pedidos do documento do
cliente** (`SISTEMA ADMINISTRATIVO PARA STUDIO MGM PILATES.docx`, na raiz, fora
do git porque este repositório é público).

| Módulo | O que entrou | Migration |
|---|---|---|
| 14 | acompanhamento por foto: avaliação, posições, comparador e matriz | `0053` |
| 15 | planos e valores, com código único, dois preços e o número da turma | `0054` |
| 16 | contrato, licença, prorrogação, e a ficha com CPF e endereço | `0055` |
| 17 | cobrança materializada, pagamento com estorno, fechamento com os relatórios | `0056` |
| 18 | recibo com numeração que não pula, corpo congelado, correção e cancelamento | `0057` |
| 19 | aulas por professor | nenhuma |

**Quatro defeitos silenciosos apareceram no caminho**, e nenhum deles quebrava
nada:

1. **A anonimização apagava o nome e deixava o CPF** e o endereço, que a ficha
   ampliada tinha acabado de trazer. Segunda vez que esse defeito aparece: no
   módulo 14 era a foto de rosto.
2. **O log recusava `plano` e `contrato`** por causa de um `check` que parou na
   `0048`, e `registrar()` não olha o erro de propósito. Nenhuma criação de
   plano ou contrato tinha sido registrada.
3. **Cinco dos sete relatórios do item 4 estavam errados**, porque foram
   reconstruídos de memória enquanto o `.docx` não estava no repositório. Todas
   as somas estavam certas; o que faltava era o documento.
4. **Janela de período montada em UTC** cortava as três últimas horas do dia
   brasileiro: recibo emitido às 21h30 sumia do fechamento de hoje. Só apareceu
   porque a suíte rodou depois das 21h.

---

## O que falta, em ordem de risco

### 1. O administrativo ainda não recebeu matrícula nenhuma

Está no quadro do topo, e continua sendo o maior risco aberto. Não é código: o
catálogo já está lá, o ciclo já fechou em ensaio, e o que falta é o emitente do
recibo e saber quem está em qual plano. As duas respostas são do cliente.

### 2. O papel jurídico espera assinatura

**Minuta feita em 15/08**, termos e privacidade no ar em `/termos` e
`/privacidade`, link no rodapé do sistema, nas telas de acesso e no pé de todo
e-mail. O que falta é **decisão do Gabriel**, listado em
[`juridico/README.md`](juridico/README.md): razão social e CNPJ, criar de
verdade a caixa `privacidade@4yu.com.br`, os quatro prazos de contrato, e virar
`EM_REVISAO` para `false` depois do advogado.

**A política subiu para a versão 1.1 em 18/08**, quando passou a descrever CPF,
endereço, a relação comercial e o prazo de guarda do recibo. Subir a versão faz
o aceite ser pedido de novo a quem já aceitou: é o comportamento certo, e é bom
saber antes de alguém estranhar.

O texto mora em `src/core/legal/`, não num `.md`, porque ele é tela.

### 3. Backup: o script está pronto e provado, falta escolher o destino

`npm run backup` faz o dump do schema, comprime, guarda fora do repositório e
apaga o que passou de sete dias. `npm run backup:testa <arquivo>` restaura num
banco descartável e confere que a conta volta de pé.

**A primeira restauração de mentira achou um defeito que o dump escondia:**
`pg_dump --schema app_verandi` não carrega as extensões, e como `pessoa.nome_busca`
chama `unaccent`, num banco novo toda inserção de pessoa falhava, uma por uma,
enquanto série e sessão entravam normalmente. Corrigido; a restauração volta com
as 84 pessoas.

**Faltam duas decisões, e as duas são suas:**

1. **Onde a cópia mora.** Hoje o padrão é `../backups-verandi`, na sua máquina.
   Qualquer destino em nuvem passa a ser um lugar novo onde dado de saúde
   descansa, e por isso entra na política como subprocessador.
2. **Quem dispara.** O plano gratuito da Vercel não roda `pg_dump`: é `cron` na
   sua máquina, ou ação agendada num repositório **privado**.

### 4. Nota fiscal: é configuração por cliente, não uma decisão

**Quem emite é o cliente, com o CNPJ dele, para o aluno dele.** O estúdio é o
prestador, o aluno é o tomador, e a 4YU não aparece no documento. Por isso a
nota nunca será uma chave da 4YU num emissor: cada conta traz certificado
digital A1, inscrição municipal, regime tributário, código de serviço e alíquota
de ISS, e o layout muda com a prefeitura de cada cidade.

O recibo, que é do estúdio e sai na hora, já existe e não depende de nada disso.

### 5. O que depende do Gabriel, e você não começa sozinho

- **Ilustrações do onboarding.** Prompts prontos em
  [`ARTE-ONBOARDING.md`](ARTE-ONBOARDING.md). Trocar é uma linha por arte em
  `src/core/onboarding/boas-vindas.ts`.
- **Vida nas telas** ([`planos/08`](planos/08-vida-nas-telas.md)): movimento na
  espera e ilustração nos estados vazios. Trava em três decisões dele.
- **As telas contra o protótipo.** Ele pediu para **não** fazer essa passada.

### 6. Higiene que pode esperar

- **Clicar numa aba não mostra espera.** As abas de `/financeiro`, `/recibos` e
  `/pessoas` são `<Link>` com `?aba=`, e o `loading.tsx` não dispara quando só o
  parâmetro muda: a tela fica parada até o servidor responder. Não é lentidão de
  consulta, é falta de estado de espera. `useLinkStatus` resolve.
- A **busca global** do cabeçalho é uma caixa desabilitada dizendo que entra no
  próximo marco.
- **A razão social provisória agora aparece em mais lugares.** A folha nova
  imprime o nome do emitente duas vezes por via: no topo e embaixo da linha de
  assinatura. Enquanto for `MGM Pilates` em vez do texto do cartão de CNPJ, o
  erro sai em dobro.
- **A cidade do recibo é lida do endereço do emitente**, e só quando ele termina
  em UF de duas letras. O endereço da MGM está vazio, então hoje o recibo sairia
  sem local. Preencher o endereço do emitente resolve os dois de uma vez.
- **A reentrega do webhook só dispara quando um evento novo é enfileirado**,
  porque o plano gratuito da Vercel não dá cron de minuto. Numa agenda em uso
  isso acontece muitas vezes por dia; a correção é um cron externo.
- `pessoa_resumo` recalcula quatro subconsultas por linha. Vai bem com mil
  pessoas por conta; não medimos com dez mil.
- **A cobrança também é materializada ao abrir a tela**, pelo mesmo motivo. Se
  um dia houver cron, os dois viram job e a materialização vira rede de
  segurança.

---

## O que os módulos novos deixaram anotado, e você não deve "corrigir"

Nenhum destes é defeito. São decisões, e as três primeiras já foram tentadas do
outro jeito em algum produto por alguém:

- **"Paga" não é status e "atrasada" não é coluna.** Pago é a soma dos
  pagamentos, lida na view `cobranca_resumo`; atrasada depende do dia de hoje no
  fuso da conta, e `current_date` no banco é o fuso do servidor.
- **Estorno não apaga o pagamento**, e cancelamento não apaga a cobrança nem o
  recibo. O fechamento de ontem, já conferido, não pode mudar de valor sozinho,
  e buraco na numeração é a primeira coisa que uma fiscalização pergunta.
- **O sistema não inventa dívida de antes de conhecer o contrato.** Contrato
  digitado hoje com início em janeiro cobra a partir do mês do cadastro.
- **Cobrança manual não existe.** Toda venda gera contrato, inclusive a avulsa,
  que é um contrato de um dia. A coluna `origem` já nasceu para a exceção ter
  onde morar sem migration corretiva.
- **Aula aplicada é a sessão que já passou e não foi cancelada**, mesmo sem
  ninguém presente: quem atende foi ao estúdio e esperou. As outras leituras
  estão nas colunas ao lado, para conferir em vez de acreditar.
- **O recibo sobrevive à anonimização**, por cinco anos contados da emissão. É a
  única exceção do produto, está escrita no código, no teste e na política, e a
  próxima correção da anonimização não deve apagá-lo achando que acerta.

---

## Como subir o ambiente

```bash
npx supabase start           # local, no Docker, faixa 564xx
npm run tipos                # se alguém mexeu em migration desde a última vez
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local`, senha `senha-de-teste-123`.

Para ver o onboarding de novo depois de tê-lo pulado:

```bash
docker exec supabase_db_verandi psql -U postgres -d postgres \
  -c "delete from app_verandi.onboarding;"
```

Se o Supabase local subir com config antiga (as rotas respondem
`Invalid schema: app_verandi`), os contêineres são de antes de uma mudança no
`supabase/config.toml`: `npx supabase stop --no-backup` e suba de novo.

**Não rode `supabase db reset` com a suíte de navegador aberta.** Os dois usam o
mesmo banco local, e o reset no meio de um teste dá deadlock e falha vermelha
que não é do código.

---

## Migration em produção: você aplica, e não pergunta

Decisão do Gabriel em 14/08. Perguntar a cada migration é atrito sem ganho,
porque a resposta é sempre a mesma enquanto o alcance for o nosso schema. O
risco real não é aplicar: é aplicar sem conferir o que a mudança derruba.

A conferência é fixa, e são cinco passos:

```bash
set -a && . ../.secrets/4yu.env && set +a
node scripts/aplica-em-producao.mjs --dry      # 1. o que está pendente
```

2. **O arquivo só toca `app_verandi`**: tem `set search_path` no topo e nenhum
   `public.` escrito. `public` é do AutoFluxos.
3. **O que ela cria ainda não existe lá.** Migration que já rodou por outro
   caminho falha no meio e deixa a metade anterior aplicada.
4. **Nada de fora depende do que ela derruba.** `drop view` e `drop function`
   levam o dependente junto, em silêncio:

```sql
select dependent_ns.nspname, dependent_view.relname
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class dependent_view on dependent_view.oid = r.ev_class
  join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace
  join pg_class source on source.oid = d.refobjid
  join pg_namespace source_ns on source_ns.oid = source.relnamespace
 where source_ns.nspname = 'app_verandi'
   and source.relname = 'a_view_que_vai_cair'
   and dependent_view.relname <> 'a_view_que_vai_cair';
```

5. Aplica, e **prova fora do console**. O console diz "ok" para coisa que não
   funciona. Confira: a coluna na tabela **e nas views que a expõem** (coluna
   nova não entra em view sozinha, foi a armadilha da `0043` e da `0044`), o
   `security_invoker` da view de pé, a contagem de tabelas em `public` intacta,
   e o site respondendo.

**Pergunte antes** em três casos, e só neles: a migration escapa do nosso
schema; existe dependente de fora; ou ela é destrutiva sem volta (`drop` de
coluna ou tabela com dado de cliente).

---

## As regras que não se descobrem lendo o código

| Regra | Detalhe |
|---|---|
| Segredo | `set -a && . ../.secrets/4yu.env && set +a`. **Nunca** dentro do repo, que é público. `npm run segredos` confere. |
| Migration nova | `node scripts/aplica-em-producao.mjs`, com a conferência acima. **Nunca** `supabase db push`. |
| Mexeu em migration | `npx supabase db reset` e depois **`npm run tipos`**. Sem isso o `tsc` segue passando com a forma antiga do banco. |
| Entidade nova no log | acrescente ao `check` de `log_configuracao.entidade` **na mesma migration** que cria a tabela, e ao tipo em `src/server/log.ts`. `registrar()` engole o erro de propósito, e a linha some calada. |
| Tipo derivado do banco | mora em `src/server/banco.ts`. **Nunca** em `banco.types.ts`, que é reescrito inteiro a cada geração. |
| Janela de período | monte com `instante(data, hora, fuso)`, nunca com `` `${data}T00:00:00Z` ``. Isso é meia-noite em Londres e corta as três últimas horas do dia brasileiro. |
| Impressão | tudo que não é a folha leva `data-imprimir="fora"`. Trilho, barra do celular e rodapé imprimiam **por baixo** do recibo, com o nome das telas atravessando o texto. E a folha imprime no fluxo: `position: absolute` a fazia flutuar por cima em vez de ocupar a página. Guardado em `tests/unit/impressao.test.ts`. |
| Nome de quem age, no papel | **nunca o e-mail.** Quem responde pelo negócio raramente é profissional cadastrado, e `user.email` como reserva põe o endereço pessoal dele num documento que vai embora com o cliente. Sem nome, a linha some. |
| Recusa em Server Action | volta como **valor** (`{ ok: false, erro }`), nunca como `throw`. Erro lançado ali não atravessa a rede com o nosso texto: o Next entrega um genérico com identificador, e a tela mostra "alguma coisa quebrou". Já aconteceu duas vezes, em `planos/acoes.ts` e em `config/acoes.ts`. |
| Cliente do Supabase | `clienteServidor()` é `cache()` do React, um por pedido. Não crie um cliente novo dentro de função nova: **o primeiro `getUser()` de cada cliente é uma ida ao servidor de autenticação**, e elas somam sem aparecer em lugar nenhum. |
| Placeholder de campo | nunca o valor que a pessoa ia digitar. Campo vazio com o texto certo dentro parece campo preenchido, e quem preencheu o resto sai achando que terminou. |
| Rota nova da API | chame a função de `server/`, que já recebe `contaId` e filtra por ele. Sem sessão não há RLS, e um `select` sem `conta_id` lê a conta de todo mundo. |
| Função que não confere papel | fora de arquivo `'use server'`. Tudo que um arquivo desses exporta vira endereço chamável de fora. Ver `server/financeiro/materializar.ts`. |
| `insert` em lote no PostgREST | todas as linhas com as mesmas chaves. Ele usa as colunas da primeira e manda `null` explícito nas outras, e o erro fala de coluna nula sem dizer por quê. |
| Build de produção | o compilador do React só roda nele, e derruba componente que reatribui variável durante o render. `next dev` bom e produção quebrada é isso até prova em contrário. |
| Sombra de valor composto | vai em `style`, não em `shadow-[...]`: vírgula ali quebra o gerador do Tailwind e o CSS **inteiro** deixa de ser produzido. |
| Campo numérico | `<input type="number">` aceita `e`, `+` e `.`. Recuse o que não é dígito, no navegador **e** no servidor. |
| Prop de Server para Client Component | só valor. Função é recusada em **tempo de execução**, e nem o `tsc` nem o `build` avisam. |
| `select` do supabase-js | string literal. Montado com `+` vira `string` e devolve `GenericStringError`, que fala de tudo menos do problema. |
| Dinheiro | inteiro em centavos, sempre. Nunca ponto flutuante: dez parcelas com desconto produzem dízima, e ela aparece no recibo. |
| Texto do produto | **Nada de travessão**. Vírgula, ponto ou dois-pontos. Há teste guardando os e-mails. |
| Palavra do cliente | nem artigo nem adjetivo colado nela: o gênero é da palavra e a palavra é do cliente. Lint em `tests/unit/regua-do-vocabulario.test.ts`. |
| Cor de texto | tem contraste mínimo, medido em `tests/unit/contraste.test.ts`. Não clareie para ficar igual ao protótipo. |
| Tela | ler o código do protótipo não substitui abrir a tela dele. [`VESTIR.md`](VESTIR.md). |
| Tamanho de texto | piso de **11px**, e o corpo em 15px. O protótipo desce mais, e o que o produto ganha descendo junto é uma tela que passa na WCAG e cansa quem lê o dia inteiro. Há teste medindo. |
| Destino de e-mail | o que o cadastro já sabe **não se pergunta de novo**. Campo vazio pedindo um dado que está na ficha é o caminho mais curto para ele sair digitado errado. |
| Conta de teste nova | cai no onboarding. `e2e/apoio.ts` pula os dois roteiros por padrão; passe `{ pularOnboarding: false }` para testá-lo. |
| Antes de dizer que acabou | `npm test`, `npm run build`, `npm run test:e2e`, `npm run segredos`. |
| Conta de demonstração | MGM Pilates · dona `contato@4yu.com.br` · senha no cofre da equipe. |

---

## As decisões travadas. Não reabra sem o Gabriel pedir

- **Cadastro público não será construído** enquanto a venda for ativa. A conta
  nasce pela mão da 4YU.
- **Organização com várias unidades não será construída agora.** O modelo atual
  já recebe uma depois: `conta` é a unidade de isolamento, e organização entra
  como tabela nova mais uma coluna anulável.
- **O profissional que atende em dois estúdios já funciona.** `usuario_conta`
  tem chave `(usuario_id, conta_id)` e `/contas` é o seletor; o teste é "quem
  pertence a duas contas enxerga as duas", em `tests/acesso.test.ts`. Não
  construa nada.
- **Cobrança automática não será construída.** Pix na mão está certo com um
  cliente. O sistema registra o que o negócio informa ter recebido.
- **O robô não decide nada.** Horário cheio não aparece para ele, não abre
  turma, não muda capacidade, não passa da lotação.
- **O onboarding é dentro do sistema**, não uma tela antes de entrar.
- **Importador de planilha não será construído.** Os dados do cliente entram
  pela tela.
- **A tela inicial se arruma por pessoa, e as colunas não trocam de conteúdo.**
  O arranjo é de quem usa, não da conta: dono e recepção abrem o dia por motivos
  diferentes. E a agenda precisa da coluna larga, então o que se arruma é a
  ordem dentro de cada coluna, não de qual coluna cada bloco é.
- **Cálculo de pagamento de profissional não entra no relatório de aulas.**
  Quanto vale a aula é contrato de trabalho, muda por pessoa e por modalidade.

---

## O que cinco sessões ensinaram, sem a cronologia

A cronologia está no `git log`, que conta melhor. O que não está em lugar nenhum
é isto:

1. **O silêncio é o defeito.** Os piores achados do projeto inteiro não
   quebraram nada: a chamada que cancelava sem dar crédito, o contraste que
   reprovava havia meses, a anonimização que deixava o CPF, o log que recusava
   `contrato` calado. Nenhum apareceu em teste, porque nenhum quebrava. Quando
   desconfiar de algo assim, **transforme a regra em número e teste**.
2. **Verifique fora do console.** O painel diz "publicado", "aplicado", "ok"
   para coisa que não funciona.
3. **Regra duplicada é regra que vai divergir.** A decisão sai para `core/` e as
   duas telas chamam.
4. **Coluna nova não entra em view sozinha.**
5. **A régua da palavra do cliente inclui a palavra neutra.** A pergunta certa é
   "escreveram uma palavra que é do cliente?", não "escreveram a palavra de um
   cliente?".
6. **Pergunta de produto se faz descrevendo a cena.** "Quem é o comprador?" não
   comunicou nada; "o dono acha vocês no Google ou vocês batem na porta dele?"
   resolveu.
7. **Documento do cliente não se reconstrói de memória.** Cinco dos sete
   relatórios do item 4 nasceram errados, e nenhum teste pegaria: todas as somas
   estavam certas. Se o documento não estiver à mão, peça, e escreva no plano o
   que foi suposto até ele chegar.
8. **Teste que roda só de tarde esconde defeito de fuso.** Dois furos de janela
   em UTC apareceram porque a suíte rodou às 21h. Se algo depende de "hoje",
   pergunte de quem é o hoje.
