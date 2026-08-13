# Verandi — arquitetura

O que o sistema é por dentro: o vocabulário, as entidades, e as decisões que não
dá para tomar duas vezes. As telas estão em [TELAS.md](TELAS.md); a ordem de
construção em [PLANO.md](PLANO.md); o briefing original em
[../handoff](../handoff).

## O princípio, e o teste que ele dá

A Verandi é um SaaS de agendamento multi-inquilino. Não é o sistema do MGM
Pilates, não é o sistema do CT de boxe. O primeiro cliente é a **evidência**, não
o alvo.

Isso dá um teste objetivo para qualquer pedido que aparecer:

> Isto é **agendamento**, ou é **este cliente**?

Se for do cliente, vira linha de configuração — nunca coluna nova, nunca `if` no
código. É a mesma régua do [`ARQUITETURA.md` do
AutoFluxos](../../autofluxos/docs/ARQUITETURA.md), e existe pelo mesmo motivo: no
dia em que for preciso mexer no código para encaixar um cliente, o produto virou
consultoria com passo extra.

O risco do outro lado é real e vale dizer em voz alta: **quem projeta genérico no
abstrato costuma acertar ninguém.** O jeito de ter os dois é *derivar* o genérico
de um caso real — construir olhando para a planilha do MGM e recusar com
disciplina qualquer coisa dela que tente entrar no `src/`.

## O vocabulário é neutro por dentro e traduzido na borda

O código não conhece "aluno", "turma", "professor", "paciente" ou "matrícula".
Conhece isto:

| Interno | É | No pilates vira | No salão vira | Na clínica vira |
|---|---|---|---|---|
| `conta` | o negócio que assina | Estúdio | Salão | Clínica |
| `pessoa` | quem é atendido | Aluno | Cliente | Paciente |
| `profissional` | quem atende | Professor | Profissional | Doutor |
| `servico` | o que é feito | Pilates solo | Corte | Consulta |
| `local` | onde acontece | Sala 1 | Cadeira 2 | Consultório A |
| `serie` | a regra que se repete | Turma | — | — |
| `sessao` | a ocorrência datada | Aula | Horário | Atendimento |
| `vaga` | a reserva permanente numa série | Matrícula | — | — |
| `participacao` | uma pessoa numa sessão | Presença | Agendamento | Consulta marcada |

A tradução mora numa tabela `vocabulario` por conta e acontece **só na borda da
tela**. Nenhuma consulta, migration, endpoint ou nome de arquivo usa o rótulo
traduzido.

Isso não é preciosismo: é o que permite vender para o barbeiro sem tocar em
código, e é o que impede o produto de virar "software de pilates" por acidente
de nomenclatura. Nome de tabela é para sempre.

## A decisão central: série → sessão → participação

As duas formas de agenda que o briefing identifica — vaga recorrente e horário
avulso — **não são dois modelos**. São o mesmo modelo com uma peça opcional.

```
serie ──gera──> sessao <──pendura── participacao ──> pessoa
(regra)         (data)              (o estado)
```

- **`serie`** é a regra: quarta-feira, 10h00, pilates solo, Carol, sala 1,
  capacidade 4, valendo de março até segunda ordem. É a "turma" do pilates e a
  "grade fixa" de qualquer negócio. Um negócio 100% avulso simplesmente não tem
  séries.
- **`sessao`** é a ocorrência datada: quarta, 12 de agosto, 10h00. Nasce de uma
  série ou nasce sozinha (avulso). É onde se cancela, se troca o profissional,
  se conta a ocupação.
- **`vaga`** é a reserva permanente de uma pessoa numa série — a "matrícula".
  Tem vigência própria, porque em março a pessoa entra no horário das 7h e em
  agosto ela sai.
- **`participacao`** é uma pessoa numa sessão específica. **É a única linha onde
  estado de presença existe.**

O ponto que faz o modelo fechar: quando a sessão nasce, as vagas ativas daquela
série são copiadas para participações. A recorrência não é um tipo diferente de
agendamento — é um agendamento que alguém não precisou digitar.

### Origem e status, ou: por que a prosa da planilha some

`participacao` carrega **origem** (de onde veio) e **status** (o que aconteceu),
e são coisas diferentes que a planilha mistura na mesma célula.

```
origem:  recorrente · avulso · reposicao · encaixe · reserva
status:  esperada · confirmada · presente · falta · falta_avisada · licenca · cancelada
```

Mais `reposicao_de_id`, uma chave estrangeira para a participação que gerou o
crédito, e `registrado_por` (usuário + origem: `profissional`, `recepcao`, `bot`,
`sistema`).

Com isso, tudo que hoje é rabisco vira dado consultável:

| Na planilha | Vira |
|---|---|
| `P` (140 ocorrências) | `status: presente` |
| `F` (13) | `status: falta` |
| `FAR` (31) | `status: falta_avisada` |
| `LIC` (17) | `status: licenca` |
| `XX` / `X` (17) | **a confirmar com a operação** antes de importar |
| `F EXP` (2) | **a confirmar** |
| `REP 05/6` (6) | `origem: reposicao` + `reposicao_de_id` apontando para a falta |
| `P ANT 19H` (5) | idem — presente em outro horário É reposição |
| `CLAUDIO - RESERVA` | `origem: reserva` |
| `(PERSONAL)`, `(Pers. Nath)` | `servico` + `profissional` |
| `(Gestante)` | tag na pessoa |
| `(Fascia)` | `servico` |
| `Domicílio` | `local` |

O `REP 05/6` virando chave estrangeira é o que faz a tela de reposições em aberto
existir de graça. Hoje esse controle mora na memória de quem escreveu.

**A lição que generaliza, e que vale para toda feature futura:** se o estado não
tiver campo, a pessoa escreve prosa, e o dado morre. Quando aparecer um estado
novo, ele entra como opção — não como observação.

### A sessão nasce sob demanda, não por cron

Materializar o ano inteiro à frente enche o banco de linhas que ninguém olhou e
transforma qualquer mudança de grade numa migração de dados. Não materializar
nada torna impossível pendurar presença. A saída é criar a sessão **no primeiro
momento em que ela é olhada ou tocada**:

- alguém abre a semana na grade → materializa a semana inteira, numa transação
- alguém encaixa, cancela ou marca presença numa data futura → materializa
  aquela sessão
- a API responde disponibilidade → materializa a janela consultada

A corrida entre dois desses caminhos é resolvida pelo banco, não por lógica que a
gente esquece de escrever:

```sql
UNIQUE (serie_id, inicio)
```

com `INSERT ... ON CONFLICT DO NOTHING`. É o mesmo truque do
`messages.wa_message_id UNIQUE` do AutoFluxos: transformar concorrência em
constraint. **Sem job agendado, sem horizonte artificial, sem sessão duplicada.**

Consequência que precisa estar clara: uma sessão que ninguém olhou **não existe
como linha**, e isso é correto. Ela é derivável da série a qualquer momento. O
que existe é o que teve estado.

### Editar a grade não reescreve o passado

Mudar a capacidade, o horário ou o profissional de uma série **não toca nas
sessões que já existem**. A série descreve o futuro; a sessão guarda o que valia
naquele dia. Por isso `sessao` carrega cópia de `servico_id`,
`profissional_id`, `local_id` e `capacidade` em vez de só apontar para a série.

Sem isso, trocar a Carol pela Thalya em setembro reescreveria quem deu aula em
março — e a planilha de março passaria a mentir. É o mesmo motivo pelo qual o
AutoFluxos congela `sessions.flow_version_id`.

## Capacidade avisa, nunca bloqueia

No dado real do MGM, **47 pessoas estão fora da grade** — escritas à mão embaixo
das vagas numeradas. Reserva, reposição, personal, encaixe, domicílio. Não é
bagunça: é a operação funcionando.

Um sistema que recusa a quinta pessoa numa turma de quatro perde para o Excel no
primeiro dia, porque o Excel aceita. Então:

- capacidade é **exibida** (`5/4` em vermelho), nunca imposta
- `encaixe` é uma origem de primeira classe, não um contorno
- a única coisa que o sistema recusa é a **mesma pessoa duas vezes na mesma
  sessão** (`UNIQUE (sessao_id, pessoa_id)`), porque isso é sempre erro de dedo

A regra geral, que vale como decisão de produto: **o sistema descreve a
realidade, não governa ela.** Data no passado aceita registro. Sessão cancelada
aceita correção. Pessoa sem telefone é normal — 30% não têm.

## Multi-inquilino desde a primeira migration

`conta_id` em toda tabela de domínio, **RLS ligada com política desde o dia um**.

Aqui a Verandi diverge do AutoFluxos de propósito: lá a RLS está ligada e sem
política nenhuma, porque não há login e todo acesso passa pelo servidor. Aqui há
login desde o começo, então a política vem junto. Acrescentar isolamento depois
custa migração em toda tabela e revisão de toda consulta — e uma consulta
esquecida é vazamento entre clientes.

```
usuario         → Supabase Auth
usuario_conta   → usuario_id, conta_id, papel, ativo
```

Um usuário pode pertencer a mais de uma conta. Isso não é feature de luxo: é o
que faz o acesso de suporte da 4YU existir sem backdoor, e é o que permite a
mesma professora atender dois estúdios.

### Papéis

| Papel | Pode |
|---|---|
| `dono` | tudo na conta dele, inclusive configuração e usuários |
| `recepcao` | marcar, remarcar, cancelar e cadastrar pessoa para todos — não mexe em configuração |
| `profissional` | a agenda dele, as pessoas dele, registrar atendimento |
| `suporte` | acesso da 4YU, para configurar e diagnosticar; toda ação fica registrada |

O papel `recepcao` existe porque em salão e clínica quem marca não é quem atende.
No pilates é a mesma pessoa — e é exatamente o tipo de diferença que tem que ser
papel, não sistema diferente.

**`profissional` é um papel, não um cadastro separado.** A tabela `profissional`
existe e pode não ter usuário nenhum ligado a ela — a Thalya pode ser um nome na
grade antes de ter login. `profissional.usuario_id` é anulável de propósito.

## Notificação sai por evento, nunca por chamada direta

Cancelou a sessão, abriu vaga na reserva, falta lembrar do horário de amanhã:
tudo isso vira **uma linha numa tabela de eventos de saída**. Entregadores leem
dela.

```
evento_saida   id, conta_id, tipo, payload jsonb,
               criado_em, entregue_em, tentativas, ultimo_erro
```

Dois entregadores no começo:

- **webhook assinado → AutoFluxos**, que fala WhatsApp com o cliente final
- **e-mail → Resend** (3 mil/mês no plano gratuito, no domínio `4yu.com.br`)

Duas regras que evitam retrabalho, herdadas do briefing:

1. **A Verandi nunca fala com a Meta.** Quem tem o número, a janela de 24 horas e
   os modelos aprovados é o AutoFluxos.
2. **O AutoFluxos nunca guarda série, vaga ou presença.** Ele lê e escreve pela
   API; o dado mora aqui.

O padrão outbox custa uma tabela e paga em três coisas: a escrita de domínio não
depende de rede, reenviar é reprocessar uma linha, e ganhar um terceiro canal
(SMS, push do app futuro) não mexe em nada do domínio.

## A superfície de API para o AutoFluxos

Token estático em cabeçalho, guardado como hash, escopo por conta — é o que o
cofre do AutoFluxos consome hoje.

```
GET  /api/v1/disponibilidade?dia=quarta[&servico=][&profissional=]
     → { "livres": "7h00;10h00;15h00" }
```

O ponto e vírgula não é capricho: é o formato que o bloco de pergunta dinâmica do
AutoFluxos consome direto, sem tradução no meio.

```
GET  /api/v1/pessoa?telefone=5511999990000
     → { "encontrado": true, "nome": "...", "recorrencia": "segunda 7h00" }
     → { "encontrado": false }
```

Vai responder `false` com frequência. **Não reconhecer é caminho normal, não
erro.**

```
POST /api/v1/agendamento
     { "telefone", "dia", "hora", "tipo": "reposicao" }
     → { "ok": true, "profissional": "Carol" }
     → { "ok": false, "motivo": "esse horário encheu" }

POST /api/v1/presenca
     { "telefone", "sessao", "status": "confirmada" | "falta_avisada" }

GET  /api/v1/catalogo
     → serviços, profissionais e grade
```

`POST /api/v1/presenca` é o que faz a confirmação por bot funcionar **sem tabela
nova**: o AutoFluxos muda o status da participação com `origem: bot`. A pessoa
avisa que não vai, a vaga abre, e quem estava na reserva pode ser chamado. Não
está no primeiro marco, mas o modelo já comporta.

Confere a vaga **na hora de gravar**, não só na hora de mostrar: entre mostrar e
clicar, alguém pode ter ocupado.

## As entidades

```sql
conta               id, nome, slug, fuso, criado_em
vocabulario         conta_id, chave, singular, plural
usuario_conta       usuario_id, conta_id, papel, ativo

pessoa              id, conta_id, nome, telefone, email, identificador_externo,
                    nascimento, observacao, ativo
pessoa_tag          pessoa_id, tag                    -- gestante, domicílio, ...
profissional        id, conta_id, nome, usuario_id?, cor, ativo
servico             id, conta_id, nome, duracao_min, capacidade_padrao, ativo
local               id, conta_id, nome, ativo

serie               id, conta_id, servico_id, profissional_id, local_id,
                    dia_semana, hora_inicio, duracao_min, capacidade,
                    vigencia_inicio, vigencia_fim?, ativo
vaga                id, conta_id, serie_id, pessoa_id, inicio, fim?, ativo
sessao              id, conta_id, serie_id?, servico_id, profissional_id, local_id,
                    inicio timestamptz, duracao_min, capacidade,
                    status, motivo_cancelamento
                    UNIQUE (serie_id, inicio)
participacao        id, conta_id, sessao_id, pessoa_id, origem, status,
                    reposicao_de_id?, observacao,
                    registrado_por_usuario_id?, registrado_por_origem, registrado_em
                    UNIQUE (sessao_id, pessoa_id)

excecao_calendario  id, conta_id, data, tipo, descricao   -- feriado, fechado
evento_saida        id, conta_id, tipo, payload, criado_em, entregue_em, tentativas
token_api           id, conta_id, nome, hash, ultimo_uso_em, revogado_em
importacao          id, conta_id, arquivo, resumo jsonb, criado_em
importacao_linha    importacao_id, linha, dado jsonb, resultado, motivo
```

Detalhes que evitam bug caro:

- **`UNIQUE (serie_id, inicio)`** — a materialização sob demanda depende dele.
- **`UNIQUE (sessao_id, pessoa_id)`** — a única regra que o sistema impõe.
- **`sessao` copia serviço, profissional, local e capacidade** — o passado não se
  reescreve.
- **`profissional.usuario_id` anulável** — nome na grade antes de ter login.
- **`vaga.inicio` / `vaga.fim`** — a matrícula tem vigência; sem isso, quem saiu
  em agosto some do histórico de março.

## Fuso, feriado e semana que não existe

Tudo em `timestamptz`, com o fuso na conta. A série guarda **hora local e dia da
semana**; a sessão materializa em instante absoluto. O Brasil não tem mais
horário de verão desde 2019, mas escrever certo agora custa zero e escrever
errado custa uma madrugada em algum outubro.

`excecao_calendario` cobre feriado e fechamento. A sessão de um dia marcado como
feriado nasce `cancelada` com o motivo, em vez de não nascer — assim ela aparece
na grade riscada, e ninguém pergunta "cadê a aula de quarta".

## Stack e estrutura

Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, RLS) + Vercel +
Tailwind. Igual ao AutoFluxos, de propósito: uma stack só para o grupo manter.

Em desenvolvimento o Supabase roda **local, no Docker**, pela CLI. Isso resolve
o teto de dois projetos ativos do plano gratuito — a organização `4YU Systems` já
tem `radar-ofertas` e `autofluxos` ativos, com o `Otimiza Gestor` pausado. Só na
hora do deploy é que se decide entre pausar um, abrir segunda organização, ou
pagar Pro.

```
verandi/
├── docs/            ARQUITETURA.md · TELAS.md · PLANO.md · ESTADO.md
├── supabase/migrations/
└── src/
    ├── core/        ★ zero import de Next, Supabase ou rede
    │   ├── agenda/  expandir série · aplicar exceção · ocupação · encaixe cabe?
    │   ├── vocabulario/
    │   └── importar/  ler planilha → linhas + o que não casou
    ├── server/      repositórios, server actions, entregadores de evento
    ├── app/         rotas (ver TELAS.md)
    └── components/  burros, trocáveis
```

**`core/` não importa nada de `app/`, `server/` ou do banco.** A dependência anda
numa direção só. É o padrão que já provou valer no AutoFluxos, e aqui ele vale
mais ainda: a matemática de agenda — expandir recorrência, aplicar exceção,
contar ocupação, decidir se o encaixe cabe — é onde os bugs difíceis moram, e é
exatamente o que dá para testar em milissegundos sem subir banco nenhum.

**O frontend é descartável de propósito.** Componentes burros, dados vindo de
server actions. O protótipo visual entra trocando a casca, sem mexer no fluxo.

## O que fica fora, de propósito

Cada item é uma coisa boa que só atrapalha agora. Ficam anotados porque o modelo
tem que **caber** neles, não porque serão construídos.

- **Financeiro** — cobrança, mensalidade, boleto, conciliação. `pessoa` guarda
  vencimento de plano como *data*, para avisar; cobrar não.
- **Contrato e assinatura digital.**
- **Aplicativo da pessoa atendida.** O WhatsApp é o app dela. Isso derruba login
  público, recuperação de senha e tela de aluno.
- **Conteúdo** — vídeo, trilha, feed, comunidade.
- **Onboarding por ramo** — perguntar o segmento no cadastro e já entregar
  pré-configurado. O modelo comporta; não vale construir agora.
- **Lista de espera com aviso automático** — `origem: reserva` já existe no
  modelo; o aviso automático é marco 2.
