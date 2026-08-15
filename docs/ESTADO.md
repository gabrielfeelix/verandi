# Onde paramos

Arquivo de leitura obrigatória ao voltar ao projeto. É o único que pode estar
desatualizado sem causar dano, desde que se saiba disso.

**Chegando agora?** Leia este inteiro e depois [`HANDOFF.md`](HANDOFF.md), que
diz o que a última sessão fez e por qual ponta pegar o que falta.

> **ANTES DE QUALQUER MUDANÇA DE BANCO:** leia
> [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md). A Verandi divide o projeto
> Supabase de produção com o AutoFluxos: `app_verandi` é nosso; `public` é dele;
> Auth, Storage, extensões, Data API, cotas e backup são globais. Produção usa
> somente `node scripts/aplica-em-producao.mjs`, nunca `supabase db push`.

**Última atualização:** 15/ago/2026 · **A Verandi está no ar em
`https://verandi.4yu.com.br`, com uma conta de cliente, e-mail saindo de
verdade, onboarding e a porta do bot aberta.**

**O produto opera; o negócio ainda não pode vender.** Termos, privacidade e
contrato de operador saíram como minuta em 15/08 e esperam assinatura; faltam
backup e monitoramento, e nada disso é código de funcionalidade. A lista inteira
está em [`HANDOFF.md`](HANDOFF.md).

---

## Em uma frase

Uma conta nasce vazia, se configura inteira pela tela e opera a semana, com a
cara do protótipo, no ar, com convite e senha chegando por e-mail, e com uma
API que o bot do AutoFluxos já consegue ler.

## O que aconteceu em 14/ago, em ordem

1. **O banco foi para `app_verandi`.** O plano gratuito do Supabase dá dois
   projetos por conta (não por organização), e os dois já estavam ocupados. A
   Verandi passou a dividir o projeto do AutoFluxos, separada por schema.
2. **Deploy.** Vercel ligada ao GitHub: push na `main` publica. Domínio
   `verandi.4yu.com.br`.
3. **E-mail.** Domínio `verandi.mail.4yu.com.br` autenticado no Brevo, convite
   saindo, webhook avisando quando não chega.
4. **Segurança.** Cadastro público fechado, senha mínima 8, RLS conferida
   tabela a tabela.
5. **"Esqueci a senha" virou nosso**, porque o do Supabase é incompatível com o
   rastreio de clique do Brevo.
6. **Os três acertos de interface foram feitos**: o trilho nasce aberto, o login
   corta um salto e mantém o "Entrando…" até a próxima tela pintar, e criar e
   editar item de lista virou modal em Serviços, Equipe, Locais, Usuários e
   Grade. Junto veio uma correção que valia para os cinco modais que já
   existiam: **a página rolava atrás do modal**, o que o DESIGN-SYSTEM 4.7
   proíbe. O que ficou pendente e por quê está em
   [`planos/07-acertos-de-interface.md`](planos/07-acertos-de-interface.md).
7. **O onboarding entrou, e mora dentro do sistema.** O produto abre inteiro e
   as boas-vindas vêm por cima, no mesmo modal do resto: a primeira versão era
   uma rota com a casca do login, e uma segunda tela igual à de entrar faz a
   pessoa achar que o login não funcionou. O último cartão pergunta como o
   negócio chama as coisas e escreve o vocabulário de uma vez; depois vêm os
   apontamentos: uma visita guiada de quinze passos, com a tela inteira escura e
   só o alvo aceso, navegando sozinha pelo menu e por cada destino. Migration
   `0042`, já em produção. Detalhe em
   [`planos/05-onboarding.md`](planos/05-onboarding.md), e os prompts para gerar
   a arte definitiva em [`ARTE-ONBOARDING.md`](ARTE-ONBOARDING.md).
8. **Duas listas novas de trabalho**, do Gabriel olhando o produto e a
   concorrência: [`planos/08-vida-nas-telas.md`](planos/08-vida-nas-telas.md)
   (movimento da marca na espera, ilustração onde não há dado) e
   [`planos/09-defeitos-apontados.md`](planos/09-defeitos-apontados.md) (a barra
   fixa da Sessão repete o que já está no cabeçalho).

## O que aconteceu depois, ainda em 14/ago

9. **A barra fixa da Sessão sai em tela larga** e fica no celular. O protótipo
   desenha as duas, e aqui a tela diverge dele de propósito. Ver
   [`planos/09-defeitos-apontados.md`](planos/09-defeitos-apontados.md).
10. **O que o plano 07 tinha deixado de fora entrou**: Funcionamento virou modal
    por dia, e a confirmação destrutiva de local e profissional passou a dizer
    quantas séries e sessões dependem do item. E o que estava escondido ali era
    um defeito: **feriado com "cancelar e avisar" não dava crédito a ninguém**.
    Agora dá.
11. **As duas dívidas de modelo foram decididas pelo Gabriel e implementadas**,
    migration `0043`: anonimizar preservando a linha, e observação de
    participação com "visível para". Detalhe na seção abaixo.
12. **A observação da ficha também separa quem enxerga**, migration `0044`. A
    `0043` tinha resolvido metade: `participacao.observacao` é o que se escreve
    na chamada, e `pessoa.observacao` é a faixa "Atenção na aula", aberta o
    tempo todo, que é justamente onde alguém escreve "hérnia de disco". Fechar
    metade do vazamento não fecha vazamento nenhum.
13. **A régua do vocabulário varreu o produto inteiro**, e virou lint com teste.
    Três telas passaram a falar a língua da conta pela primeira vez.
14. **Seis dívidas técnicas fechadas**: tipos do banco gerados e ligados aos
    dois clientes, `/contas-4yu` com busca e paginação, encaixe buscando no
    servidor, `/hoje` e `/semana` sem escrever a cada leitura, e o contraste
    corrigido com teste que o mede.

## As duas decisões de modelo, e o que ficou no código

**Direito do titular: anonimiza, não apaga.** `delete` em `pessoa` levaria
`participacao` por cascade e com ela a presença de todo mundo que estava na
mesma turma; o titular tem direito aos dados dele, não ao registro de operação
de terceiros. `anonimizarPessoa` zera nome, telefone, e-mail, nascimento,
observação, marcações e a observação escrita nas chamadas, marca
`pessoa.anonimizada_em` e registra no `log_configuracao` quem atendeu e quando,
**sem copiar o nome para o log**. Só dono e suporte veem o botão, e ele exige
digitar o nome, porque não existe desfazer. Fica no pé da coluna lateral da
ficha, longe de "Editar".

**Observação: quem escreve escolhe quem lê. Nas duas caixas.** Colunas
`participacao.observacao_visivel` (`0043`) e `pessoa.observacao_visivel`
(`0044`), com `profissionais` e `todos`, e o **padrão fecha**: quem anota entre
uma turma e outra não vai lembrar de restringir depois, e o erro de deixar
aberto é o que não tem volta. A recepção não recebe o texto restrito, e a tela
dela nem oferece reescrever, senão a próxima gravação apagaria a anotação do
profissional; a ação no servidor recusa também, porque esconder na tela sem
barrar ali seria proteger a leitura e perder o dado.

As duas caixas precisam da mesma régua, e isso demorou uma migration para ficar
claro: a da chamada vale para hoje, a da ficha vale para sempre, e é a segunda
que recebe "hérnia de disco, não pode carga axial". Fechar só uma delas faz a
frase migrar para a que continua aberta.

Onde o texto some, a tela **diz que ele existe**. Uma ficha sem observação e uma
ficha com observação restrita não podem parecer iguais: se parecerem, a recepção
escreve por cima achando que o campo está vazio. Na `0044` a conta existente não
perde nada e não vaza mais, porque o `default` fecha o que já estava escrito, e
a direção segura do erro é essa.

**A separação não é RLS, e isso é decisão.** RLS é por linha; esconder uma
coluna de um papel seria privilégio de coluna, e privilégio no Postgres é por
papel do banco. Aqui todo usuário logado é o mesmo `authenticated`, e "recepção"
é uma linha em `usuario_conta`: não existe política que expresse isso. Quem
filtra é `src/server`, que é o único caminho até o dado. Vira RLS de verdade no
dia em que existir view por papel.

## O próximo passo, em ordem

**O produto opera; o negócio não está pronto para vender.** A lista completa,
com o porquê de cada item, está em [`HANDOFF.md`](HANDOFF.md), na seção "O que
falta para a Verandi ficar de pé". Em ordem de risco:

1. ~~**Termos de uso, política de privacidade e o contrato de operador.**~~
   **Minuta feita em 15/08.** Os três documentos existem, escritos a partir do
   que o sistema faz; termos e privacidade estão no ar em `/termos` e
   `/privacidade`, com link no rodapé do sistema, nas telas de acesso e no pé de
   todo e-mail. O que sobrou é decisão do Gabriel, listada em
   [`juridico/README.md`](juridico/README.md). Detalhe na seção abaixo.
2. **Backup.** Não existe. Estava anotado como "aceitável enquanto não há
   cliente pagante", e vender encerra a ressalva. `pg_dump` agendado para fora
   do Supabase resolve a maior parte do medo, e precisa de uma restauração de
   mentira para valer.
3. **Saber quando quebra.** Um 500 em produção é invisível hoje.
4. **Uma página no site.** `4yu.com.br` não tem `/verandi`, e o produto está no
   ar.
5. ~~**Marco 2, Fase 3:** escrever pela API.~~ **Feita em 15/08**, com a
   documentação pública em `/api-docs` e o desenho de até onde a automação vai
   em [`planos/12-api-que-escreve.md`](planos/12-api-que-escreve.md).
6. **Marco 2, Fases 4 e 5:** o aviso de volta e a lista de espera.
7. **O que depende do Gabriel:** ilustrações do onboarding e "vida nas telas".

## O papel, e onde ele mora

Termos de uso, política de privacidade e adendo de operador foram redigidos em
15/08 **a partir do que o sistema faz**, e não de modelo de mercado. É por isso
que eles conseguem afirmar coisas que a maioria das políticas de SaaS não
afirma: o acesso do suporte é registrado porque existe `acesso_suporte`, o
segredo da chave de API não é recuperável porque a coluna guarda só o `sha256`,
a anotação tem controle de leitura porque existe `observacao_visivel` com padrão
fechado.

**Termos e privacidade moram em `src/core/legal/`, não num `.md`**, porque são
tela: a mesma estrutura que a página desenha é a que
`tests/unit/legal.test.ts` confere. O adendo, que é assinado e não publicado,
está em `docs/juridico/`. O `README.md` de lá é o que a próxima sessão precisa
ler: ele lista o que só o Gabriel decide (CNPJ, prazos de contrato, a caixa
`privacidade@4yu.com.br`, e a chave `EM_REVISAO`).

**As rotas são públicas de propósito.** Quem mais precisa da política é quem não
tem login: o titular do dado e o jurídico da clínica que ainda avalia a compra.
Há teste de navegador prendendo isso, porque reorganizar a lista de rotas
públicas do `proxy.ts` derrubaria o documento em silêncio.

**Onde o dado é tratado, conferido na API de cada fornecedor:** banco no Brasil
(Supabase, `sa-east-1`) e aplicação no Brasil (Vercel, `gru1`, movida de `iad1`
em 15/08 justamente para o dado não sair do país), e-mail na União Europeia
(Brevo, coberto pela decisão de adequação da ANPD de jan/2026). Os documentos
internos diziam "Supabase e Brevo, os dois com dado no exterior", que era dedução
pela sede da empresa. A região da Vercel mora em `vercel.json`, versionada.

**O aceite dos documentos é registrado**, migration `0046`: quem, quando, de qual
endereço e **qual versão** estava no ar. Grava ao criar a senha do convite e ao
entrar, e o segundo caminho existe porque quem já usava o produto antes dos
documentos nunca passaria pelo primeiro. A tabela não é dado de conta: RLS ligada
sem política e `revoke` explícito, com teste provando os dois cadeados.

## Como mexer nisto sem quebrar produção

| O quê | Como |
|---|---|
| Segredo | `set -a && . ../.secrets/4yu.env && set +a`. **Nunca** dentro do repo: ele é público. `npm run segredos` confere. |
| Migration nova | `node scripts/aplica-em-producao.mjs`, sem perguntar: a conferência de cinco passos está no [`HANDOFF.md`](HANDOFF.md). **Nunca** `supabase db push`. |
| Deploy | `git push origin main` publica sozinho. |
| Mexeu em e-mail | `npx tsx scripts/previa-email.ts voce@email.com` e olhe no cliente; depois `scripts/espelha-no-brevo.ts`. |
| Antes de dizer que acabou | `npm test`, `npm run build`, `npm run test:e2e`, `npm run segredos`. |
| Conta nova na mão | `node scripts/cria-conta.mjs "Nome" dono@email.com [senha]`, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de produção no ambiente. |

**Conta de demonstração em produção:** `MGM Pilates`, dona
`contato@4yu.com.br`. Reflete o cliente real do AutoFluxos (responsável Daniel),
com vocabulário de pilates, três modalidades, duas salas e a semana configurada.
O e-mail do Daniel **não** foi usado de propósito: criar acesso e senha para
alguém que não pediu é errado, e qualquer e-mail chegaria de verdade nele.

## A Tarefa 10, e o que ela achou

A jornada inteira, sem `psql` e sem seed, num banco recém-resetado: suporte
entra → cria a conta em `/contas-4yu` → copia o convite → o dono define a senha
→ cadastra serviço, profissional e local em `/config` → monta uma grade de três
dias em `/grade` → convida uma recepção → cadastra uma pessoa → cria a vaga na
ficha → registra a chamada em `/sessao/[id]`, que termina em **"Chamada feita"**.
Treze passos, todos pela tela.

Dois defeitos apareceram, e nenhum teste os pegava. Os dois viviam no espaço
entre "cada peça funciona" e "a primeira instalação existe":

- **O primeiro suporte não nascia.** `usuario_conta.conta_id` é `not null`,
  `ehSuporte` exige a linha e criar conta exige ser suporte: banco novo travava
  antes do primeiro clique, e só o seed furava. Agora existe a **conta interna**
  (migration `0040`), e o primeiro usuário entra por
  `node scripts/bootstrap-suporte.mjs <e-mail>`.
- **Sair do suporte apagava o suporte.** O vínculo temporário e o vínculo que
  diz "é da 4YU" eram a mesma linha: entrar e sair da conta que hospedava o
  vínculo deixava o usuário sem acesso a nada. Agora `ehSuporte` só olha a conta
  interna, ela não é listada como cliente, e `sairDoSuporte` nunca apaga o
  vínculo de lá.

Um terceiro achado é atrito, não defeito, e ficou como está: o botão **"Entrar
na conta"** do convite não entra, leva a `/entrar?novo=1`, com o texto trocado
mas sem o e-mail preenchido.

## Verificado agora

| O quê | Resultado |
|---|---|
| `npm run build` | limpo |
| `npm test` | **358 passaram** |
| `npm run test:e2e` | **154 passaram** |
| `npm run segredos` | nenhuma credencial de produção no repositório |
| tabelas em `app_verandi` · em `public` | **24 · 0** (as 12 do AutoFluxos seguem intactas) |
| RLS em produção | 20 de 20; `anon` não alcança nada |
| `https://verandi.4yu.com.br` | 200, falando com o banco de produção |
| migrations em produção (`0030` a `0047`) · onboarding abrindo lá | **as 18 aplicadas** · sim, sem 5xx |
| migrations `0044` e `0045` em produção | aplicadas; a `0044` com a coluna na tabela **e na view**, a `0045` com RLS ligada, política única e `anon` sem alcance |
| contraste dos tokens de texto | 15 pares medidos, todos em AA |
| régua do vocabulário no `src/` inteiro | limpa, com lint guardando |
| Tarefa 10, jornada inteira em banco virgem | 13 passos, terminou em "Chamada feita" |
| `core/` sem import de banco, Next ou rede | limpo |
| nenhuma tela com "Aluno"/"Turma"/"Paciente"/"Professor" fixo | limpo |
| nenhum "hoje" calculado em UTC no servidor | limpo |

---

## O que existe

**Banco:** dezoito migrations (`0030_vr_` a `0047_vr_`), RLS com política em todas as
tabelas, provada por teste. **Tudo mora no schema `app_verandi`, não em
`public`**, o porquê está inteiro em `migrations/0030_vr_schema_app_verandi.sql`.

```
conta (com os padrões da operação; `interna` marca a conta da própria 4YU)
usuario_conta · vocabulario · convite
pessoa · pessoa_tag · profissional · profissional_servico · servico · local
serie · vaga · sessao · participacao · excecao_calendario
funcionamento · pendencia_dispensada · acesso_suporte · log_configuracao
onboarding (progresso do tutorial, por pessoa e por conta)
pessoa.anonimizada_em · participacao.observacao_visivel (0043)
pessoa.observacao_visivel (0044) · chave_api (0045)
aceite_de_termos (0046, prova de aceite) · pedido_idempotente (0047)
view pessoa_resumo · função usuarios_da_conta (security definer)
balde privado foto-profissional
```

**`core/`**, puro, testável sem subir nada. Aritmética de data, expansão de
série, ocupação, encaixe, estado da chamada, vocabulário, destino por papel,
manutenção de série (linhas em lote, colisão, alcance da edição, sessões órfãs),
estado de convite, papéis concedíveis.

**Vestir as telas**, fechado. As doze telas foram comparadas com o protótipo e
corrigidas. O que ficou de fora são seis blocos do protótipo que dependem de dado
que ainda não existe (busca guardada, log por pessoa, SMTP, hora do aviso, plano
da conta, integrações), a lista, o método e as armadilhas estão em
[`planos/04-vestir-telas.md`](planos/04-vestir-telas.md), **leia antes de mexer
em tela**.

**Design system**, `docs/DESIGN.md` é o contrato; `/amostra` mostra as nove
peças em todas as variações. `Design system Verandi-att/DESIGN-SYSTEM.md` é a
especificação de interface: onde a tela divergir dele, é a tela que muda. O
método de comparação está em [`VESTIR.md`](VESTIR.md), e as duas capturas saem
de `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`.

**Quatro divergências do protótipo, de propósito**, cada uma escrita no commit
que a criou: alvo de toque de 44px onde o protótipo desenha 34px (a Sessão é
usada em pé); etiqueta de ocupação só fica laranja **acima** da capacidade, como
o protótipo renderiza, turma cheia é estado normal do dia; a busca global do
cabeçalho fica reservada e desabilitada, porque a funcionalidade não existe e
inventá-la seria pior do que deixá-la faltando; e a **barra fixa da Sessão só
existe em tela estreita**, enquanto o protótipo a desenha junto do cabeçalho:
em 1440 as duas caem na mesma dobra e viram dois "Marcar todos presentes".

**Telas:**

| Rota | O quê | Vestida? |
|---|---|---|
| `/entrar` | login, com destino por papel, e link para `/esqueci` | sim |
| `/esqueci` · `/enviado` | pedir senha nova, sem sessão | sim |
| `/contas` | trocar de conta | sim |
| `/hoje` | agenda do dia, com a próxima turma em destaque | sim |
| `/semana` | grade da semana **e o modo Dia por recurso** | sim |
| `/sessao/[id]` | a tela do produto, chamada, encaixe, capacidade, menu por pessoa | sim |
| `/pessoas` · `/pessoas/[id]` | lista, busca e ficha | sim |
| `/vaga` | busca de horário livre | sim |
| `/grade` | criar, editar, duplicar e encerrar horário fixo | sim |
| `/config` | serviços, equipe, locais, padrões, vocabulário, funcionamento, usuários | sim |
| `/pendencias` | o inbox de quem opera | sim |
| `/contas-4yu` | contas dos clientes, com sinais de vida | sim |
| `/convite/[token]` | aceitar convite e definir senha | sim |
| `/amostra` | os primitivos do design system |, |

**API v1**, para o bot do AutoFluxos e para quem vier depois. Sete rotas, com
`Authorization: Bearer vr_…`, e a referência em [`API.md`](API.md):
`GET /api/v1/disponibilidade`, `/catalogo` e `/pessoas?busca=`. Sem sessão não
há RLS para proteger, então **quem isola conta de conta é o `conta_id` na
consulta da rota** — e é por isso que as rotas chamam as funções de `server/`
em vez de montarem consulta própria.

---

## O que falta

### Plano 03, fechado

- **Tarefa 10: feita.** A jornada inteira pela tela, num banco virgem. O que ela
  achou está na seção lá em cima.
- **Tarefa 11, vestir: feita.** O trilho lateral escuro substituiu a barra de
  links, e as doze telas foram refeitas contra a captura do protótipo. Entraram
  junto as três coisas que o modelo aguentava e a tela não expunha: o **menu por
  pessoa** na Sessão (observação, apontar reposição, trocar origem, remover), o
  modo **Dia por recurso** em `/semana` (colunas = sala ou profissional) e o
  **filtro por local**. O método está em [`VESTIR.md`](VESTIR.md); as capturas
  saem de `scripts/tira-prototipo.mjs` e `scripts/tira-produto.mjs`.

### Acesso, e por que o "esqueci a senha" é nosso

Existem seis telas de acesso, e todas usam a mesma casca e a arte de
`ui/arte-acesso.ts`: `/entrar`, `/esqueci`, `/enviado`, `/convite/[token]` (que
serve tanto para aceitar convite quanto para criar senha nova), `/contas` e o
painel de troca de conta.

**O `recover` do Supabase Auth não é usado, e não pode ser.** O rastreio de
clique do Brevo reescreve todo link e não dá para desligar (eles dizem que não
pretendem permitir). O token do Supabase é consumido no GET, então o rastreador
abre o link antes da pessoa e ela recebe `otp_expired`. Foi assim que descobrimos:
o link chegou como `sendibt2.com/tr/cl/...` e morreu antes do primeiro clique.

O nosso token só é consumido no POST que grava a senha, então robô que abre a
página não quebra nada. `/esqueci` cria uma linha `tipo: 'senha'` em `convite`,
válida por 30 minutos, e manda o e-mail pela API do Brevo.

Três decisões que estão no código e não se deduzem sozinhas: a resposta é a
mesma para e-mail que existe e para inventado (senão o formulário público vira
lista de quem trabalha no estúdio); só há **um pedido em aberto por e-mail**
(senão vira máquina de encher caixa alheia e queimar a cota do Brevo); e o
caminho antigo continua vivo em Configuração, Usuários, porque quem não recebe
e-mail ainda precisa ser atendido.

### Texto do produto não leva travessão

Nem e-mail, nem tela, nem rótulo. Travessão é marca de texto gerado por máquina,
e num produto que vende confiança para dono de estúdio isso derruba a
credibilidade antes de a pessoa ler o conteúdo. Onde a frase pedia travessão,
virou vírgula, ponto ou dois-pontos. Há teste guardando os e-mails.

### E-mail, o que está de pé, e o que falta

De pé: domínio `verandi.mail.4yu.com.br` autenticado no Brevo (DKIM assinando),
convite saindo pela API com template no código, e senha e troca de e-mail saindo
pelo Auth do Supabase via relay SMTP do Brevo, em português.

**Falta o webhook de eventos, e é o que mais importa.** Hoje o Brevo não avisa
nada de volta, então **bounce é invisível**: a dona convida `maria@gmial.com`
com o erro de digitação, a tela diz "Convite enviado", o e-mail volta e ninguém
fica sabendo, até virar chamado para a 4YU. Com `POST /v3/webhooks` apontando
para uma rota nossa, `hard_bounce`/`blocked`/`spam` viram estado na tela: "o
convite voltou, confira o endereço". É a mesma régua do resto do produto, a
tela diz o que aconteceu, não o que se tentou fazer. **Depende do deploy**,
porque webhook precisa de URL pública.

Não vale agora, e é decisão: **automação no Brevo** (não há cliente nem sincronia
do nosso banco para lá, esteira sem nada para processar envelhece e depois
ninguém confia nela), **atributo de contato** (há um contato) e **IP dedicado**
(sem volume constante, IP dedicado entrega pior, porque a reputação nunca
aquece).

### Marco 2, o bot conversa com a agenda

O bot é do **AutoFluxos**, não da Verandi: ele atende no WhatsApp e marca aqui
por API. Cinco fases, com o porquê de cada uma em
[`planos/10-marco-2-api.md`](planos/10-marco-2-api.md):

1. **A chave e a tela de Integrações.** ✔ feito, em produção.
2. **Ler a agenda:** `disponibilidade`, `catalogo`, `pessoas?busca=`. ✔ feito.
3. **Marcar:** cadastrar pessoa, marcar e desmarcar, com `Idempotency-Key`. ✔
   feito, com a ficha que o bot lê e a documentação pública em `/api-docs`.
4. **Avisar de volta:** outbox, webhook assinado, reentrega.
5. **Lista de espera**, que só funciona depois da 4.

A regra que atravessa tudo: **o robô não decide nada.** Horário cheio não
aparece para ele, ele não abre turma, não muda capacidade e não passa da
lotação. Isso já está em `core/agenda/encaixe.ts` e agora é contrato de API.

Duas coisas que o modelo já previa e economizam trabalho: `origem_registro` tem
`bot` desde a `0033`, e `horariosLivres` foi escrita para o endpoint de
disponibilidade.

### Fora de escopo, e por quê

| O quê | Por quê |
|---|---|
| Importador de planilha | escrever contra o formato de um cliente é consultoria com passo extra; volta com o segundo negócio migrando |
| Financeiro, cobrança, contrato | outro produto |
| Aplicativo de quem é atendido | o WhatsApp é o app dela |
| Relatórios | depois que houver dado real para relatar |

---

## Decisões que mudaram no meio

**Encaixe acima da capacidade agora é permitido, com aviso, e configurável.**
Caiu o princípio "ou a capacidade sobe, ou não cabe". Ficou a metade que
importa: `temVagaParaOferecer`, busca de vaga e API do robô, continua
recusando horário cheio, e isso não é configurável. A recepção decide olhando
para quem está na frente dela; o robô não decide nada.

**O protótipo virou a especificação de interface.** Ver a revisão de 13/ago em
`docs/planos/03-configuracao.md`.

**Convite e redefinição de senha não dependem de e-mail.** O dono copia o link
da tela. Sem isso, toda senha esquecida na primeira semana seria um chamado para
a 4YU com a chave de serviço na mão.

## Decisão pendente, de gente

**Onde o Supabase de produção vai morar, resolvido por ora: dividido com o
AutoFluxos.** O plano gratuito dá **dois projetos por conta**, não por
organização (criar org nova não ajuda, verificado), e `radar-ofertas` e
`autofluxos` já ocupam os dois. Então a Verandi mora no schema `app_verandi`
dentro do projeto do AutoFluxos.

O que isso custa, escrito para ninguém se assustar depois: **não há backup** no
plano gratuito, e restaurar é do banco inteiro, acidente num produto leva o
outro junto. É aceitável enquanto não há cliente pagante e deixa de ser no dia
que houver.

A saída da Verandi já está desenhada: restaurar o dump num projeto novo, manter
`app_verandi` nele e derrubar `app_verandi` no projeto antigo. O caminho do
AutoFluxos ainda exige uma etapa a mais, porque ele mora em `public` e não existe
`app_autofluxos`: antes de separá-lo, será preciso migrar seus objetos para um
schema próprio ou extrair explicitamente o conjunto de objetos de `public`.
Nos dois caminhos sobra tratar `auth.users` e Storage, que são globais e não
acompanham um `drop schema`.

**Já está aplicado em produção** (projeto `autofluxos`, ref `xxxynoshwirupkdzwxbj`):
21 objetos em `app_verandi`, 4 funções, 39 políticas, e as 12 tabelas do
AutoFluxos em `public` intocadas. Migration nova vai por
`node scripts/aplica-em-producao.mjs`, **não** por `supabase db push`, que
compararia a pasta local com a `schema_migrations` compartilhada e passaria a
reclamar das versões do outro produto. O controle mora em
`app_verandi.migrations_aplicadas`. Desfazer tudo:
`supabase/desfazer-verandi.sql`.

`app_verandi` já precisa estar em painel → Integrations → Data API → Settings →
**Exposed schemas** para o site em produção funcionar. Não remova nem altere
essa lista sem conferir os dois produtos: o cache do PostgREST é compartilhado,
e uma mudança errada pode tirar Verandi e AutoFluxos do ar ao mesmo tempo.

## Dívidas técnicas anotadas

- ~~O aplicador de produção confunde qualquer falha de leitura com banco
  virgem.~~ **Resolvido.** Ele pergunta `to_regclass(...)` antes, que responde
  sem erro nos dois casos; só "a tabela não existe" segue como banco virgem, e
  qualquer outra falha para antes de escrever. Virou urgente quando aplicar
  migration deixou de ser pergunta a cada vez.
- ~~Os `.returns<T[]>()` espalhados.~~ **Resolvido**, e o que sobrou tem
  critério. Eram 67 chamadas com tipo escrito à mão; ficaram **10**, e cada uma
  tem comentário dizendo qual das duas coisas ela acrescenta:

  1. **Coluna `text` com `check`.** O Postgres não tem união de texto, e o
     gerador escreve `string`. `observacao_visivel`, `excecao_calendario.tipo`,
     `convite.tipo`, `vocabulario.chave`, `onboarding.roteiro`, `entrega`. Quem
     sabe que são dois ou três valores é a migration. (Onde o banco usa `enum` de
     verdade, como `status` e `origem` da participação, a união vem sozinha e o
     tipo à mão saiu.)
  2. **Leitura de view.** View não carrega `NOT NULL`: o arquivo gerado descreve
     `pessoa_resumo` com toda coluna anulável, `id` e `nome` inclusive. É verdade
     para o Postgres e mentira para o produto.

  Os três `as unknown as` sumiram: `rpc()` passou a vir tipado pelo arquivo
  gerado. E um achado do caminho: **`select` montado com `+` não funciona.** O
  supabase-js lê a lista de colunas como tipo literal, e concatenação vira
  `string`, que devolve `GenericStringError` — o erro que fala de tudo menos do
  problema. Quebre a linha dentro das aspas.

### As sete resolvidas em 14/08, de tarde

Ficam aqui por um tempo, com o que cada uma virou, porque a próxima pessoa vai
procurar por elas.

- **Tipos do banco: gerados.** `src/server/banco.types.ts`, por `npm run tipos`
  (script em `scripts/gera-tipos.mjs`, só o schema `app_verandi`). Os dois
  clientes passaram a ser genéricos nele, e `db.from('pesoa')` deixou de
  compilar. Quatro erros reais apareceram na hora de ligar: `status` como
  `string` na materialização, `detalhe` como `Record<string, unknown>` no log,
  `db.from(variável)` no onboarding e três objetos de update sem tipo.
  **Migration nova pede `npm run tipos`**, senão o `tsc` segue passando com a
  forma antiga.
- **`/contas-4yu` pagina e busca.** Vinte por página, busca por nome ou
  identificador, tudo na URL. A consulta de sinais deixou de varrer sessão e
  vínculo do banco inteiro: agora é `in_` nos vinte ids da página, e o
  `listUsers` do Auth para de virar páginas assim que acha quem procura.
- **O encaixe não baixa mais a conta inteira.** `/sessao/[id]` mandava todas as
  pessoas ativas para o navegador em toda visita, para um campo que só busca a
  partir de duas letras. Virou `buscarCandidatos()` no servidor, com `nome_busca`
  e oito resultados, com 200ms de espera no cliente.
- **`/hoje` e `/semana` deixaram de escrever a cada leitura.**
  `materializarJanela` confere o que já existe com uma consulta e, no caso comum
  (janela pronta), não escreve nada. O `upsert` continua para o que sobrar,
  porque ele é a garantia contra corrida entre duas abas.
- **Contraste: medido, e agora com teste.** `tinta-fraca` e `tinta-apagada`
  viraram `#656E6A`; a etiqueta neutra, o texto fraco do e-mail e as tintas
  `positivo`, `alerta` e `atenção` também subiram, porque as três reprovavam
  sobre o próprio fundo delas. `tests/unit/contraste.test.ts` mede cada par.
- **A régua do vocabulário varreu o produto.** Vinte e poucas frases mudaram, e
  três telas passaram a falar a língua da conta pela primeira vez: a
  Configuração de Serviços e Locais (que escrevia "serviço" e "local" à mão, do
  título ao aviso de sucesso), o menu lateral da Configuração e os três campos
  do editor de série. `tests/unit/regua-do-vocabulario.test.ts` é um lint que
  varre `src/` e falha se um artigo ou adjetivo voltar a colar na palavra do
  cliente.
- **`pessoa.observacao` separa quem enxerga**, migration `0044`, com o mesmo
  desenho da `0043`: coluna `observacao_visivel`, padrão fechado, recepção não
  lê nem sobrescreve, e a faixa continua dizendo que existe anotação restrita
  para ninguém escrever por cima achando que o campo está vazio.

---

## Versões

Next **16.3.0** · React **19.2.8** · Tailwind **4** · TypeScript **5** · Vitest
**4.1.10** · Playwright · Supabase CLI **2.114.0** · Node **24.18.0**.

## Como subir

```bash
npx supabase start           # local, no Docker, faixa 564xx
node scripts/semear-dev.mjs  # conta de teste com 74 séries e 133 vagas
npm run dev
```

Instalação nova, sem seed: a migration `0040` cria a conta interna, e
`node scripts/bootstrap-suporte.mjs <e-mail>` faz o primeiro usuário da 4YU. É
por aí que a tela de contas passa a existir.

Entrar com `dono@dev.local`, `prof@dev.local`, `recepcao@dev.local` ou
`suporte@dev.local` (este último é o único jeito de ver `/contas-4yu`), senha
`senha-de-teste-123`. **`supabase db reset` apaga o seed**, rode o semeador de
novo depois.

As faixas 543xx e 554xx já estão ocupadas na mesma máquina pelo `radar-ofertas`
e pelo `otimiza-gestor`; a Verandi usa **56421** (API), **56422** (banco) e
**56423** (studio).

## Armadilhas que já custaram tempo

- **O `alter default privileges` da `0030` é cinto e é faca.** Ele concede a
  `authenticated` tudo que nascer em `app_verandi` depois, inclusive tabela
  criada fora de migration. Foi assim que a `migrations_aplicadas` nasceu sem
  RLS e com `delete` liberado para qualquer usuário logado de qualquer cliente:
  bastava apagar uma linha para o aplicador rodar a migration de novo. Tabela
  que não é dado de conta precisa de `enable row level security` **e**
  `revoke all ... from anon, authenticated` explícitos. `service_role` passa
  por cima de RLS e continua alcançando.
- **O Brevo põe "Cancelar assinatura" em e-mail transacional, e não dá para
  desligar sozinho.** O cabeçalho `List-Unsubscribe` é obrigatório em tudo que
  sai por SMTP ou API, a documentação deles diz que campanha e transacional não
  se distinguem no fluxo, então o cabeçalho vai em todos. Existe um caminho
  oficial, abrir chamado pedindo a troca por `List-Help`, e **o Gabriel decidiu
  em 14/08/2026 não abrir**: fica como está. O que isso custa, para ninguém se
  assustar depois: quem clicar ali para de receber convite e redefinição de
  senha, e não vai ligar uma coisa à outra. Não reabra essa discussão sem ele.
  O alívio é que o bloqueio de transacional é **por remetente**, não pela conta
  inteira. Quando alguém disser "não recebi", olhe a lista antes do código:
  `GET https://api.brevo.com/v3/smtp/blockedContacts`. Existe `DELETE` para
  desbloquear, mas desbloquear quem pediu para sair é problema jurídico, não
  técnico, use para diagnosticar, não para reverter.
- **Lista do Brevo é marketing; transacional não passa por lista.** Convite e
  senha vão por API para um endereço só. Se alguém propuser "uma lista com os
  usuários para mandar senha", é confusão entre os dois mundos, e enche a base
  de contato de gente que nunca consentiu com a 4YU.
  As listas que existem (pasta `Verandi`): **4** Donos de conta · **5**
  Interessados · **6** Onboarding em aberto. Nenhuma inclui equipe da conta
  (recepção, profissional) nem quem é atendido, e isso é decisão, não
  esquecimento: o e-mail dessa gente foi coletado pelo cliente, não por nós, e
  usá-lo para falar do nosso produto é problema de consentimento antes de ser
  de bom gosto.
- **Os quatro modelos na tela do Brevo são cópia, e nascem desativados.**
  `scripts/espelha-no-brevo.ts` os manda para lá só para dar para olhar o visual
  sem abrir o projeto; nada em produção envia usando eles. Editar por lá não
  muda e-mail nenhum, e é justamente por isso que ficam desativados e com
  `[cópia, editar no código]` no nome. Rode o script de novo depois de mexer em
  `src/core/email/`, senão a cópia envelhece. O `{{ .ConfirmationURL }}` vira um
  endereço de exemplo na cópia: é sintaxe do Supabase, e o Brevo tenta
  interpretar `{{ }}` com a linguagem dele e recusa o modelo com erro de parser
  numa linha que não diz nada.
- **Os templates de e-mail moram no código, não dentro do Brevo.** A conta lá
  tem **zero** templates de propósito: o HTML sai de `src/core/email/` no campo
  `htmlContent` a cada envio, e o Brevo é só o carteiro. É o que deixa o texto
  versionado, revisável em diff e coberto por teste, e é o que permite a lista
  "o que você vai poder fazer" mudar conforme o papel sem virar três templates
  para manter em sincronia. Se um dia alguém que não programa precisar editar
  copy, aí sim vale migrar, e o custo é ganhar uma segunda fonte de verdade.
- **`api.supabase.com` devolve 403 `error code: 1010` para cliente HTTP que não
  se parece com navegador ou curl.** É Cloudflare, não Supabase: a mensagem não
  cita token nem permissão, e manda procurar no lugar errado, o `urllib` do
  Python apanhou disso, e o mesmo pedido no `curl` passou. Mande um
  `User-Agent` explícito.
- **Cliente do Supabase novo precisa de `db: { schema: ESQUEMA }`.** São nove
  pontos de criação em quatro lugares que ninguém junta na cabeça: `src/server`,
  `scripts/*.mjs`, `tests/setup` e **`e2e/`**. Esquecer um não quebra o build nem
  o `tsc`, quebra em execução com `Could not find the table 'public.conta' in
  the schema cache`. Foi o `e2e/apoio.ts` que ficou para trás na primeira
  passada. O nome vem de `src/server/esquema.ts`; nos `.mjs` é repetido à mão,
  porque `.mjs` não importa `.ts`.
- **`GRANT` é camada separada de RLS.** Se o erro for `42501`, olhe o `grant`
  antes da política. Toda migration termina com o bloco de grants.
- **Insert em lote pelo PostgREST normaliza as linhas e não aplica o default da
  coluna.** Omitir uma chave em uma linha quebra o lote inteiro com `23502`.
  Regra: todas as linhas carregam as mesmas chaves.
- **Arquivo `'use server'` só exporta função async.** Constante ou função pura
  exportada de lá quebra o build, e o erro aponta para a rota, não para o
  arquivo. Mordeu três vezes; o lugar delas é o `core/`.
- **`security definer` sem `search_path` fixo** é escalada de privilégio à
  espera de acontecer.
- **View precisa de `security_invoker = true`**, senão passa por cima da RLS.
- **Coluna gerada exige função `IMMUTABLE`.**
- **Consulta do Supabase precisa de `.returns<T[]>()`** enquanto não houver tipos
  gerados; `.single()` sem genérico devolve `never`; retorno de `rpc` ainda
  precisa de `as unknown as`.
- **`middleware.ts` virou `proxy.ts`** no Next 16.
- **React reseta o formulário depois que a action termina.** Reler o `FormData`
  num segundo passo lê um formulário vazio: guarde o pedido em estado.
- **Data em `toISOString().slice(0, 10)` é UTC.** Depois das 21h em Brasília já é
  o dia seguinte. No servidor use `hojeEm(conta.fuso)`; no navegador,
  `toLocaleDateString('en-CA')`.
- **No teste, não navegue logo depois de clicar numa ação.** Ela roda numa
  transição, e sair da página no meio testa o estado anterior. Espere o efeito
  (`expect.poll` no banco, ou o sumiço do elemento). Mordeu três vezes.
- **O banco de teste não é limpo entre execuções.** Nome fixo em dado de teste
  vira seletor ambíguo na segunda rodada; use algo único.
- **A suíte e2e roda contra build de produção.** O `next dev` recompila cada rota
  e cresce sem devolver, passou de 1,7 GB numa suíte e derrubou o navegador por
  falta de memória. Em produção a mesma suíte caiu de 8,8 para 4,3 minutos.
- **No Playwright, `getByRole('alert')` colide com o anunciador de rota do
  Next.** Use o texto. E `getByLabel` não casa com `placeholder`.
- **`aria-label` não pode repetir o rótulo do campo nos botões vizinhos.** Os
  `−`/`+` de Padrões e os quatro botões de status da Sessão levavam o nome do
  campo (ou da pessoa) dentro do rótulo; com isso `getByLabel('Prazo da
  reposição')` casava com três elementos, e nem o teste nem o leitor de tela
  conseguiam apontar o campo. O contexto vem da ordem na linha, não da repetição.
- **Vestir tela quebra teste de propósito, e isso é contrato.** Os testes de
  navegador buscam por papel e por texto: mudar "Todos vieram" para "Marcar
  todos presentes" quebra dez deles. Atualizar o teste é certo, desde que o
  commit diga qual texto mudou e por quê.
- **`<dialog>` nativo não trava a rolagem da página.** Ele prende o foco e deixa
  o resto inerte, o que engana: a roda do mouse fora do card continua rolando o
  que está atrás, e o DESIGN-SYSTEM 4.7 proíbe isso em letras maiúsculas. Quem
  trava é a casca do modal, com contador (dois modais abertos não se destravam)
  e compensação da barra de rolagem (senão a página pula 15px ao abrir). Isso
  não aparece em `tsc` nem em teste: mede-se com `window.scrollY` depois de um
  `wheel`.
- **`listUsers()` do Supabase devolve só os 50 primeiros.** O banco de
  desenvolvimento não é limpo entre execuções, então `dono@dev.local` saiu da
  primeira página e o semeador passou a morrer com `Cannot read properties of
  null` — que era o `createUser` devolvendo `user: null` porque o e-mail já
  existia. Quem procura usuário por e-mail precisa virar as páginas.
- **O papel `suporte` mora na conta interna, nunca na de cliente.** O vínculo em
  conta de cliente é temporário e é apagado ao sair; se ele também respondesse
  por "é da 4YU", sair de uma conta tiraria o acesso a tudo. Foi assim que era.
- **Plano escrito não quer dizer plano certo.** A Tarefa 10 estava escrita como
  "entrar como `suporte@dev.local`" num banco sem seed, passo impossível, e
  ninguém tinha percebido porque a jornada nunca fora feita inteira.
- **Ler o código do protótipo não substitui abrir a tela dele.** Foi o erro que
  originou o `VESTIR.md`: tokens certos, telas genéricas. Rode os dois
  capturadores e compare 1440×1000 lado a lado.
