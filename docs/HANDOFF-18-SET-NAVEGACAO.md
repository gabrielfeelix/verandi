# Handoff, 18/set/2026: navegação instantânea, e o cliente que assinou

Para quem pega a próxima sessão sem ter visto esta. Leia este arquivo inteiro
antes de abrir código. Ele tem duas partes: **o que já foi feito hoje** (para
não redescobrir nem refazer) e **a tarefa que ficou aberta**, que é a única
coisa pendente de código.

> **Banco compartilhado:** antes de qualquer mudança em Supabase, migration,
> Auth, RLS, Storage ou Data API, leia [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).
> A Verandi mora em `app_verandi`; o AutoFluxos mora em `public`, no mesmo
> projeto. Produção só aceita `node scripts/aplica-em-producao.mjs`.

---

## A TAREFA: toda troca de tela tem que ser instantânea

**Este é o pedido, nas palavras do Gabriel:** "toda vez que eu clico numa aba
dentro do contato ou em outras abas do sistema, ele demora, e só aí muda. Todas
têm que mudar INSTANTANEAMENTE, pode até não carregar na hora pelos dados, mas
tem que ser instantâneo a mudança, a diferença é que enquanto carrega vai ter um
skeleton."

Traduzindo para o que isso exige do código: **a tela nova aparece no primeiro
quadro depois do clique, com esqueleto no lugar do dado que ainda não chegou.**
Hoje o clique fica parado esperando o servidor responder, e só então a tela
troca. O resultado é que o sistema parece travado, mesmo quando a resposta leva
poucos centésimos.

Ele sugeriu, para a ficha da pessoa: carregar tudo de uma vez ao entrar e trocar
de aba sem ir ao servidor. **Avalie, mas não assuma que é a melhor saída.** A
ficha tem sete abas (Agenda, Histórico, Reposições, Avaliação, Contratos,
Perfil) e carregar as sete de uma vez pode deixar a entrada lenta para acelerar
a troca, que é trocar um problema por outro. O que ele quer de verdade é que
**nada pareça travado**, e isso se resolve com fronteira de carregamento, não
necessariamente com pré-carregar tudo.

### Por onde começar

1. **Meça antes de mexer.** Quanto demora hoje, por tela, é o número que decide
   se o problema é rede, consulta ou ausência de esqueleto. Sem isso o trabalho
   vira palpite. A distância não é o problema: Vercel está em `gru1` e Supabase
   em `sa-east-1`, os dois em São Paulo, já conferido.
2. **Levante quais rotas têm `loading.tsx` e quais não têm.** Hoje existe em
   `src/app/(app)/recibos/` e `src/app/(app)/recibos/[id]/`. No App Router, rota
   sem `loading.tsx` não tem fronteira de Suspense, e a navegação **bloqueia**
   até o server component terminar. É a explicação mais provável do que ele está
   sentindo, e a correção é barata.
3. **As abas da ficha** (`src/app/(app)/pessoas/[id]/page.tsx`, arquivo grande,
   mais de 900 linhas) precisam ser olhadas com atenção: veja se cada aba é uma
   navegação de verdade (`?aba=`, com round-trip) ou estado de cliente. Se for
   navegação, ou ganha fronteira de carregamento com esqueleto, ou vira estado
   local com os dados já em mãos.
4. **Prefetch.** `next/link` faz prefetch por padrão em produção, mas só do que
   é estático. Confira se as telas mais usadas se beneficiam.

### O custo fixo que vale atacar junto

**Toda server action paga três idas em série antes de fazer o trabalho:**
`db.auth.getUser()` (bate na API de Auth do Supabase), a consulta a
`usuario_conta` para descobrir a conta, e só então a consulta que interessa.
`contaAtiva()` em `src/server/conta.ts` já usa `cache()` do React, o que resolve
repetição **dentro do mesmo pedido**, mas cada ação é um pedido novo.

Isso já foi medido de um jeito indireto e valeu a pena: ver o commit `8df24ed`,
que tirou a busca do modal de encaixe do servidor por essa razão. Pode haver
ganho em validar a sessão sem ida à rede (JWT assimétrico com JWKS), mas
**segurança primeiro**: `getUser()` existe porque valida de verdade, e trocar
por `getSession()` sem verificar assinatura é regressão de segurança, não
otimização. Se for por esse caminho, leia a documentação atual do Supabase antes.

### O que NÃO fazer

- Não desça a conta inteira no HTML de toda tela. Isso já foi feito uma vez e
  foi revertido de propósito: 800 cadastros viravam 800 linhas de nome e
  telefone em toda abertura de chamada. O comentário está em
  `src/server/agenda/acoes.ts`, em `buscarCandidatos`.
- Não troque esqueleto por spinner centralizado. O esqueleto existe para a tela
  já ter a forma certa antes do dado; spinner é a mesma espera com outra roupa.
- Não mexa em banco para resolver isto. As consultas são pequenas: a conta do
  MGM tem 79 pessoas e 70 séries.

---

## O que já foi feito hoje, e não precisa ser refeito

### O cliente assinou, e a conta dele saiu do ensaio

O MGM Pilates (Daniel Mutti, administrador) é o primeiro cliente pagante. O
contato técnico do dia a dia é o Eduardo Yamamoto, que repassa o que o Daniel
decide.

A conta `mgm-pilates` foi **zerada** em produção: 2509 linhas de dado de ensaio
apagadas, incluindo 40 recibos que já tinham gasto número. Sem isso, a primeira
venda real sairia como A-000041. O script é
[`scripts/zera-conta.mjs`](../scripts/zera-conta.mjs), commit `dd40c79`, e ele
mantém de propósito a conta, os usuários, as chaves de API, o funcionamento e o
vocabulário, que são configuração e não dado.

Depois disso, entrou o cadastro de verdade, tudo lido dos documentos do cliente:

| o que | quanto | de onde | script |
|---|---|---|---|
| serviços e planos | 9 e 29 | `SISTEMA ADMINISTRATIVO PARA STUDIO MGM PILATES.docx` | `scripts/semeia-mgm.mjs` |
| pessoas | 79 | `CADASTRO DE ALUNOS ATIVOS.xlsx` | `planilhas/importa_alunos.py` |
| grade | 70 séries, 56 abertas | `LISTA DE TURMA E PRESENÇA - SETEMBRO 26.xlsx` | `planilhas/importa_grade.py` |
| contratos vigentes | 63, R$ 258.098,50 | `CONTROLE DE PAGAMENTOS E RENOVAÇÕES.xlsx` | `planilhas/importa_contratos.py` |
| equipe | 4 instrutoras | lista que o cliente mandou | (feito na mão) |

**As planilhas não estão no repositório e não devem entrar:** têm CPF e telefone
de 79 pessoas reais. Elas estão soltas na raiz de `4yu-apps/autofluxos/`, e os
scripts as leem por caminho. Se sumirem, peça ao Gabriel.

**Nenhuma cobrança foi criada, e isso é decisão.** O que os 63 contratos deviam
já foi pago fora do sistema ao longo de anos; materializar as parcelas encheria
o financeiro de dívida que não existe. O sistema vira dono do ciclo na próxima
renovação de cada um. O preço gravado é o que a pessoa **pagou**, não o de
tabela: um anual de 2x fechado em 2025 custou R$ 6.300 e hoje custa R$ 6.600.

**As licenças históricas não viraram `pausa`, de propósito.** A coluna "Novo
Venc" da planilha já traz o vencimento adiado, e ela foi usada como `fim` do
contrato. Criar as pausas faria `fimProrrogado` adiar de novo, por cima.

### Três correções de código

- `3ee27b1`: **"plano vencido" deixou de se esconder dentro de "plano vencendo"**.
  A conta usava `<= 15 dias`, e um vencimento de quatro meses atrás também
  satisfaz isso. Agora são dois rótulos e dois chips, cortados em hoje. Na conta
  do MGM isso revelou 10 pessoas invisíveis, de 6 dias a 1012 de atraso. O
  estúdio mantém essa gente entre os ativos de propósito, esperando retorno.
- `8df24ed`: **busca do modal de encaixe filtra no navegador**, com a lista
  descendo uma vez quando o modal abre. Acima de 600 cadastros volta ao
  servidor. A normalização de nome virou `src/core/pessoas/busca.ts` e agora é a
  mesma nos dois lados, com teste de paridade.
- `43063f9`: **as duas vias do recibo voltaram a caber numa folha**. A altura era
  livre e a segunda via caía na página 2. Agora a folha mede 273mm na impressão
  e as duas vias repartem a altura. **Ainda não foi testado no papel**, e o papel
  é a única prova que vale.

### O emitente do recibo está completo

Razão social `MARCIA GRAMANI MUTTI ESCOLA DE ATIVIDADES FISICAS S/S LTDA`, CNPJ
`20.521.814/0001-89`, Avenida Paulista 352 Andar 5 Conj. 55, Bela Vista, CEP
01310-905, telefone `(11) 93213-9312`. Tudo conferido contra a Receita.

**Duas armadilhas encontradas, que valem como regra geral:** o CNPJ que estava
na conta era `05570714000159`, que a Receita devolve como **KABUM S.A.**; e o
telefone era um número com DDD 44, que é do próprio Gabriel testando. Antes de
deixar um documento fiscal em pé, confira em
`https://brasilapi.com.br/api/cnpj/v1/<numero>`.

---

## O que depende do cliente, e trava trabalho

Nada disto se resolve sem resposta do Daniel. As duas primeiras são dinheiro
cobrado errado toda vez que alguém vender aquele pacote:

1. **RPG pacote 10 a R$ 2.100.** Todos os outros pacotes cobram nove sessões;
   nove de R$ 230 dá R$ 2.070.
2. **Liberação Miofacial pacote 10 a R$ 810.** Nove sessões de R$ 150 dão
   R$ 1.350, e R$ 810 é exatamente o pacote da Ventosaterapia, a linha de cima
   no documento.
3. Códigos repetidos no documento: 104 aparece na sessão e no pacote de RPG (o
   pacote entrou como 106), e 119/120 aparecem duas vezes em Massagem.
4. Drenagem e Massagem dizem "alunos MGM" nas quatro linhas; foi assumido que o
   segundo par é quem não é aluno.
5. **Quantas pessoas cabem numa aula de Pilates aparelho.** Está 5, que é chute.
6. **8 contratos não importados:** quatro pessoas que estão no controle de
   pagamentos e não no cadastro de ativos (Gabriela Brogiolo da Silva 37, Diva
   Moreira de Araújo 301, Carmo Roberto Barbeto 403, Caterina Emilia Salzano
   Milani 429, esta última treinando em duas turmas de quarta); três com plano
   que não existe na tabela (`5 MÊS`, `5M`, `15 au av`); e Juliana Crivari
   Palharini sem data de início.
7. **Dado sujo no cadastro:** duas pessoas sem e-mail (Roberta Bernardi Gramani,
   Sonia Maria de Souza Cavalcante), uma sem CPF (Willian Herl) e o e-mail
   `emiliatupperware@gmail.copm`, que passa em validação de sintaxe e nunca
   receberia recibo.
8. **A alocação aluno para turma não foi importada.** A lista de presença
   identifica por matrícula e nem todas batem com o cadastro.

---

## A outra fila, no AutoFluxos

Esta fila é do repositório vizinho (`4yu-apps/autofluxos/`), não deste. Veio de
um recado do Eduardo em 09/set e ainda não foi tocada. O fluxo em questão é o
`Fluxo - Atendimento`, versão 4, e os nós citados existem com esses nomes:

1. **Bug:** escolher Fisioterapia leva à aula experimental em vez de seguir o
   fluxo. Experimental só existe para Pilates aparelho, então o bot oferece o
   que o estúdio não faz.
2. Falta a opção "Comunicar cancelamento de aula".
3. "Marcar uma aula" deve virar "Marcar uma reposição".
4. Falta o aviso de cancelamento fora do prazo: "você está tentando cancelar a
   aula do dia X fora do período permitido, caso realize o cancelamento essa
   aula não poderá ser reposta, deseja prosseguir?". O prazo é 2h, e já está
   configurado na conta (`horas_minimas_cancelamento = 2`).
5. Falta resposta para quem escreve fora do horário de atendimento.
6. O nó `valores` foge do preço; deve citar faixa ("a partir de X, 1x por
   semana; período e frequência maiores embutem desconto").
7. **O endereço no bot está errado**: diz "Avenida Paulista, 3525". O certo é
   352, como no cartão de CNPJ.
8. O catálogo do bot tem três serviços (Pilates, Fisioterapia, Personal); o
   estúdio oferece oito modalidades.

---

## Como o Gabriel trabalha

Vale saber antes de responder a primeira mensagem. Ele é designer, não
programador: quer a decisão tomada e implementada, não uma lista de opções.
Resposta curta, pendência em uma linha. Commit e push sempre, sem perguntar, na
`main` (o deploy sai sozinho no push). Nada de esperar teste: valide com
`npx tsc --noEmit`, `npm run build` e o teste do arquivo que você mexeu, nunca a
suíte inteira. Quando precisar que ele abra um painel externo, mande o link
clicável.

E não escreva travessão em arquivo nenhum.
