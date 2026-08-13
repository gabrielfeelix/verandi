# Plano 03 — Configuração

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Os passos usam caixa (`- [ ]`).

**Objetivo:** uma conta nasce vazia, se configura sozinha e passa a operar — sem
ninguém da 4YU abrir `psql` nem rodar script de seed.

**Critério de pronto, em uma frase:**

> Criar uma conta pela tela, montar a grade, convidar quem vai usar, e operar a
> semana.

**Arquitetura:** igual ao Plano 02 — Server Components lendo pelo cliente **do
usuário**, escrita por server actions, regra de agenda no `core/`. A única
exceção é a tela de Contas da 4YU (Tarefa 9), que precisa da chave de serviço e
carrega a checagem de papel explícita.

**Spec:** [`../TELAS.md`](../TELAS.md) telas 2, 11, 12, 13 e 15 ·
[`../ARQUITETURA.md`](../ARQUITETURA.md)

**Depende de:** [Plano 01](01-fundacao.md) e [Plano 02](02-operacao.md),
concluídos.

## Restrições globais

Valem as dos Planos 01 e 02, mais estas:

- **Toda migration termina com o bloco de grants.** `GRANT` é camada separada de
  RLS; sem ele até a chave de serviço leva `42501`. Já mordeu.
- **Em insert em lote, toda linha carrega as mesmas chaves.** O PostgREST
  normaliza as linhas e preenche o que falta com `NULL` — o default da coluna
  não é aplicado. Mordeu duas vezes; esta é a tarefa que mais faz insert em
  lote (criar série em vários dias).
- **Desativar nunca apaga.** Serviço, profissional, local e usuário saem das
  escolhas novas e continuam aparecendo no passado. Nenhuma tela deste plano tem
  `delete` de cadastro.
- **Editar configuração vale daqui para frente.** Nenhuma tela deste plano
  reescreve sessão que já aconteceu, e todas dizem isso em texto na tela.
- **Nada de rótulo fixo no JSX.** Continua valendo o teste que varre `src/app/`.

## Decisões que este plano toma

**Editar série não toca em sessão passada, e toca no futuro só onde ninguém
mexeu.** Materialização é idempotente por `UNIQUE (serie_id, inicio)`, então
sessão futura já materializada tem que ser reconciliada de propósito: a edição
atualiza as sessões `prevista` com `inicio > now()` que ainda batem com a série;
sessão com capacidade ajustada à mão ou já `realizada`/`cancelada` fica como
está. Essa é a confusão mais provável do sistema inteiro — a tela precisa dizer
quantas sessões futuras vão mudar **antes** de salvar.

**Encerrar série é `vigencia_fim`, nunca `delete`.** Apagar série órfã as sessões
(`on delete set null`) e mata o histórico do horário. Encerrar mostra quantas
vagas estão ocupadas antes de confirmar.

**Convite é token com hash, e o link é copiado da tela.** Sem e-mail: o dono cria
o convite e manda o link por WhatsApp. Guardar token legível no banco é decisão
que só dói depois de vazar, então a tabela guarda `sha256` e a tela mostra o
token **uma vez**. Quando o Resend entrar (marco 2), o e-mail vira só mais um
caminho para o mesmo token.

**Pendência é derivada; dispensa é fato.** Nenhuma coluna `pendencia`. Cada grupo
é uma consulta sobre o dado que já existe; o que se grava é o ato de dispensar,
numa tabela própria, com motivo e quem fez. Coluna de estado derivado é coluna
que um dia mente — a mesma decisão da chamada, no Plano 02.

**Horário de funcionamento entra agora, com um consumidor só.** `funcionamento`
serve para a tela de Grade sugerir faixa e para a busca de vaga não oferecer 3h
da manhã. Sem consumidor seria campo que ninguém lê.

**Criar conta é a única escrita com chave de serviço.** A RLS não tem como
autorizar quem cria a própria linha em `conta`. A server action confere
`papel = 'suporte'` em alguma conta antes de qualquer coisa, e registra em
`acesso_suporte`.

**Acesso de suporte é visível enquanto durar.** Faixa fixa no shell, e a linha
em `acesso_suporte` grava início e fim. Ver dado de cliente sem ninguém saber é
o tipo de acesso que precisa ser constrangedor de propósito.

## Riscos que este plano não tinha visto

Levantados durante a execução, depois das Tarefas 1 e 2. Os dois primeiros já
são defeito no código, não hipótese.

**1. Editar a grade deixa sessão futura órfã.** A materialização é idempotente
por `UNIQUE (serie_id, inicio)` e **nunca apaga**. Encerrar uma série, ou mudar
o dia da semana dela, não toca nas sessões já materializadas: elas continuam em
`/hoje` e `/semana` como aula que não existe mais, e o encaixe continua
oferecendo vaga nelas. Não adianta só atualizar campo — o que sai da grade tem
que ser **cancelado com motivo**, para aparecer riscado em vez de sumir. Vale
igual para feriado marcado depois que a semana já foi aberta. Entra na Tarefa 3
e na Tarefa 4.

**2. "Hoje" está sendo calculado em UTC.** `listarSeries` (Tarefa 2) e a
semeadura de participação em `materializar.ts` (Plano 01) usam
`toISOString().slice(0, 10)`. Depois das 21h no horário de Brasília isso já é o
dia seguinte: a ocupação da grade muda de número à noite, e a turma das 21h
semeia participação contra a data errada. O `core/` está certo — quem erra é a
borda, que tinha que passar por `conta.fuso`. Entra na Tarefa 3.

**3. Capacidade pode ficar menor que a ocupação.** Baixar a capacidade de 6 para
4 numa série com seis vagas ocupadas é aceito hoje sem uma palavra. A tela
precisa dizer quantas pessoas ocupam antes de salvar — é a mesma cortesia que
encerrar já vai ter.

**4. Configuração não registra quem fez.** O `TELAS.md` diz "toda ação registra
quem fez", e só `participacao` registra. Quem mudou a capacidade da série, quem
desativou o serviço, quem mexeu no vocabulário: nada disso fica. É o tipo de
coisa que ninguém sente falta até a primeira conversa "eu não mudei isso" — e aí
custa migration em cinco tabelas e revisão de toda action. Resolvido agora com
uma tabela só, `log_configuracao`, escrita pelas actions de configuração.

**5. Convite pode escalar privilégio.** Nada impede o `dono` de convidar alguém
como `suporte`, que é o papel da 4YU e enxerga conta de cliente. Os papéis
convidáveis pelo dono são `dono`, `recepcao` e `profissional`; `suporte` só sai
da tela de Contas da 4YU. Entra na Tarefa 5, e o teste é de recusa.

**6. Sobrou um "hoje" em UTC no Plano 02.** `listarPessoas`, filtro
`plano_vencendo` (`server/pessoas/consultas.ts`), calcula o limite com
`toISOString()`. É a mesma família do risco 2, com dano menor — um filtro de
"vence nos próximos dias" erra por um dia à noite. Corrigir junto da Tarefa 7,
que é quem volta a mexer em plano vencendo.

### Anotado, fora do marco 1

**Direito do titular do dado (LGPD).** A Verandi guarda nome, telefone,
nascimento e observação de gente que **não é usuária do sistema** e nunca
consentiu com ela diretamente — quem coleta é o estúdio. Uma hora vem o pedido
de exportar ou apagar os dados de uma pessoa, e apagar `pessoa` hoje leva junto
`participacao` por cascade, ou seja, apaga o histórico de presença do negócio.
Não é trabalho do marco 1, mas é decisão de modelo: provavelmente anonimizar a
pessoa (nome, telefone, e-mail) preservando a linha, em vez de deletar. Escrito
aqui para não ser descoberto no dia do pedido.

## Estrutura de arquivos

```
supabase/migrations/
└── 0005_configuracao.sql      convite, funcionamento, pendencia_dispensada,
                               acesso_suporte

src/
├── core/
│   ├── agenda/serie.ts        dias a criar, colisão de horário, reconciliação
│   └── acesso/convite.ts      validade e estado do convite (puro)
├── server/
│   ├── config/
│   │   ├── consultas.ts       catálogo da conta, funcionamento, feriados
│   │   └── acoes.ts           CRUD de serviço, profissional, local, vocabulário
│   ├── grade/
│   │   ├── consultas.ts       séries agrupadas por dia, com ocupação
│   │   └── acoes.ts           criar, editar, duplicar, encerrar série
│   ├── usuarios/
│   │   ├── consultas.ts       quem tem acesso, convites em aberto
│   │   └── acoes.ts           convidar, aceitar, mudar papel, remover
│   ├── pendencias/
│   │   └── consultas.ts       os seis grupos, e a dispensa
│   └── suporte/
│       ├── consultas.ts       contas com sinais de vida
│       └── acoes.ts           criar conta, entrar como suporte
├── app/(app)/
│   ├── grade/page.tsx
│   ├── config/page.tsx        seções por query string
│   ├── pendencias/page.tsx
│   └── contas-4yu/page.tsx
├── app/convite/[token]/page.tsx
└── components/
    ├── grade/editor-serie.tsx
    ├── config/                seções burras
    └── ui/faixa-suporte.tsx
```

---

### Tarefa 1: Migration 0005 e o `core/` da série

**Arquivos:** criar `supabase/migrations/0005_configuracao.sql`,
`src/core/agenda/serie.ts`, `src/core/acesso/convite.ts`; testes
`tests/unit/serie.test.ts`, `tests/unit/convite.test.ts`, e o caso novo em
`tests/rls.test.ts`.

**Tabelas:**

```sql
convite              id, conta_id, email, papel, token_hash, criado_por_usuario_id,
                     criado_em, expira_em, aceito_em, aceito_por_usuario_id,
                     revogado_em
                     UNIQUE (conta_id, lower(email))
                       where aceito_em is null and revogado_em is null

funcionamento        conta_id, dia_semana, abre time, fecha time
                     PRIMARY KEY (conta_id, dia_semana)
                     CHECK (fecha > abre)

pendencia_dispensada id, conta_id, tipo, referencia_id, motivo,
                     dispensado_por_usuario_id, dispensado_em
                     UNIQUE (conta_id, tipo, referencia_id)

acesso_suporte       id, conta_id, usuario_id, iniciado_em, encerrado_em
```

RLS em todas: leitura para quem é da conta; escrita para `dono` e `suporte`,
menos `pendencia_dispensada`, que `recepcao` também escreve — é quem opera a
tela. `acesso_suporte` só aceita insert de quem tem papel `suporte` **e** só no
próprio nome, e não tem política de delete: log que o próprio autor apaga não é
log.

**Desvio assumido na execução:** o plano previa uma função `security definer`
para ler o convite pelo token sem sessão. Ela não existe, e não deve existir:
aceitar convite cria usuário no Auth, o que já é trabalho de chave de serviço,
então o fluxo inteiro roda no servidor com o token fazendo o papel de
credencial. A função seria superfície a mais para o mesmo resultado, e abrir
`convite` para `anon` daria janela de enumeração.

**Interfaces produzidas:**

```ts
// core/agenda/serie.ts
export type NovaSerie = {
  servicoId: string; profissionalId?: string; localId?: string
  diasSemana: number[]; horaInicio: string; duracaoMin: number
  capacidade: number; vigenciaInicio: string; vigenciaFim?: string
}
/** Uma linha por dia pedido — todas com as mesmas chaves, por causa do lote. */
export function linhasDaSerie(nova: NovaSerie, contaId: string): LinhaSerie[]

/** Duas séries colidem quando dividem dia, profissional ou local, e se sobrepõem no tempo. */
export function colide(a: SerieBase, b: SerieBase): 'profissional' | 'local' | null

/** Quais sessões futuras uma edição alcança, e quais ela deixa em paz. */
export function alcanceDaEdicao(
  sessoes: SessaoParaReconciliar[], agora: Date,
): { atualiza: string[]; preserva: string[] }

// core/acesso/convite.ts
export type EstadoConvite =
  | 'valido' | 'expirado' | 'ja_aceito' | 'revogado' | 'inexistente'
export function estadoDoConvite(c: ConviteBase | null, agora: Date): EstadoConvite
```

**Aceite:**
- `linhasDaSerie` com três dias devolve três linhas, e **todas com o mesmo
  conjunto de chaves** (teste explícito, é a armadilha do lote)
- `colide` acusa mesmo profissional em horário sobreposto; não acusa serviços
  diferentes em locais diferentes; horário encostado (10h–11h e 11h–12h) não
  colide
- `alcanceDaEdicao` preserva sessão `realizada`, `cancelada`, passada, e a que
  teve capacidade mexida à mão
- `estadoDoConvite` cobre os cinco estados. **`ja_aceito` ganha de `expirado`** —
  invertido em relação ao que este plano dizia antes de executar: quem já aceitou
  precisa saber que é só entrar, e "o prazo acabou" manda a pessoa pedir um
  convite que ela não precisa. Não vaza nada, porque quem tem o token é quem foi
  convidado
- teste de RLS: usuário de outra conta não lê `convite`, `funcionamento`,
  `pendencia_dispensada` nem `acesso_suporte`
- `npx supabase db reset` aplica as cinco migrations limpo

- [ ] Escrever os testes unitários e o de RLS
- [ ] Rodar e ver falhar
- [ ] Escrever a migration, com o bloco de grants no fim
- [ ] Implementar `core/agenda/serie.ts` e `core/acesso/convite.ts`
- [ ] Rodar e ver passar · commitar

---

### Tarefa 2: Grade fixa — ler e criar

**Arquivos:** criar `src/server/grade/consultas.ts`, `src/server/grade/acoes.ts`,
`src/app/(app)/grade/page.tsx`, `src/components/grade/editor-serie.tsx`; testes
`tests/grade.test.ts` e `e2e/grade.spec.ts`.

**Mostra** ([TELAS.md §12](../TELAS.md)): séries agrupadas por dia da semana, cada
uma com horário, serviço, profissional, local, capacidade, **quantas vagas estão
ocupadas** e a vigência. Séries encerradas em lista separada.

**Interfaces produzidas:**

```ts
export type SerieLinha = {
  id: string; diaSemana: number; horaInicio: string; duracaoMin: number
  servico: string; profissional: string | null; local: string | null
  capacidade: number; ocupadas: number
  vigenciaInicio: string; vigenciaFim: string | null; encerrada: boolean
}
export function listarSeries(db: Db, contaId: string): Promise<SerieLinha[]>

export function criarSeries(nova: NovaSerie): Promise<
  { ok: true; ids: string[] } | { ok: false; colisoes: Colisao[] }>
```

`criarSeries` cria **uma série por dia pedido, num insert só**. Colisão não
bloqueia — ela avisa e deixa confirmar, porque dois profissionais na mesma sala
pode ser real.

**Aceite:**
- conta vazia mostra estado vazio que diz o que fazer e leva à primeira ação
- criar "segunda, quarta e sexta às 7h" numa tela só cria três séries
- criar série com profissional já ocupado naquele horário **avisa** e deixa
  seguir
- `ocupadas` bate com a contagem de `vaga` viva na data de hoje
- série encerrada aparece na lista separada, com a data de fim
- `recepcao` vê a tela e não vê os botões de escrita; `profissional` não vê a
  rota
- abrir `/grade` não materializa sessão nenhuma (é configuração, não agenda)

---

### Tarefa 3: Grade fixa — editar, duplicar, encerrar

**Arquivos:** criar `supabase/migrations/0006_log_configuracao.sql`; modificar
`src/core/agenda/serie.ts`, `src/server/agenda/fuso.ts`,
`src/server/agenda/materializar.ts`, `src/server/grade/*` e a tela; testes em
`tests/unit/serie.test.ts`, `tests/grade.test.ts` e `e2e/grade.spec.ts`.

**Interfaces produzidas:**

```ts
// core/agenda/serie.ts
/** O que sai da grade tem que ser cancelado, não esquecido. */
export function sessoesOrfas(
  sessoes: SessaoParaReconciliar[], continuaValendo: (s) => boolean, agora: Date,
): string[]

// server/agenda/fuso.ts
export function hojeEm(fuso: string): string

// server/grade/acoes.ts
export function previewEdicao(serieId: string, mudanca: MudancaSerie): Promise<Preview>
export function editarSerie(serieId: string, mudanca: MudancaSerie): Promise<void>
export function duplicarSerie(serieId: string, diasSemana: number[]): Promise<string[]>
export function encerrarSerie(serieId: string, fim: string):
  Promise<{ ok: true; sessoesCanceladas: number } | { ok: false; vagasAtivas: number }>
```

`Preview` responde de uma vez as três perguntas que a tela precisa fazer antes
de salvar: quantas sessões futuras mudam, quantas ficam como estão, e **quantas
saem da grade** (mudança de dia ou de horário) e vão ser canceladas.

**Aceite (o que já estava):**
- editar mostra **antes de salvar** quantas sessões futuras mudam e quantas ficam
  como estão, e a tela diz em texto que o passado não muda
- editar capacidade não toca em sessão que já teve capacidade ajustada à mão
  (é a regra "lotada é lotada" do Plano 02, e ela não pode ser desfeita por
  configuração)
- editar não toca em sessão `realizada` nem `cancelada`
- duplicar para dois dias cria duas séries iguais, com a vigência de hoje
- encerrar com gente na vaga **pede confirmação dizendo quantas pessoas**, e a
  série some das escolhas novas sem sumir do histórico
- encerrar não apaga sessão nenhuma, e a semana passada continua igual

**Aceite (o que os riscos acrescentaram):**
- mudar o dia da semana **cancela as sessões futuras do dia antigo**, com motivo,
  e elas aparecem riscadas em vez de sumir; as do dia novo nascem na próxima
  materialização
- encerrar cancela as sessões futuras depois da data de fim, pelo mesmo caminho
- sessão futura cancelada por reconciliação não volta a nascer: a série já não a
  cobre mais
- a ocupação da grade **não muda de número às 21h** — `hojeEm(conta.fuso)`, e um
  teste com fuso de conta diferente de UTC prova
- baixar a capacidade abaixo da ocupação **avisa quantas pessoas ocupam** antes
  de salvar, e deixa seguir (é a mesma regra do encaixe: quem decide é quem opera)
- criar, editar, duplicar e encerrar gravam linha em `log_configuracao` com quem
  fez; o log não tem política de update nem de delete

---

### Tarefa 4: Config — catálogo e vocabulário

**Arquivos:** criar `src/server/config/consultas.ts`,
`src/server/config/acoes.ts`, `src/app/(app)/config/page.tsx`,
`src/components/config/`; testes `tests/config.test.ts` e `e2e/config.spec.ts`.

**Seções** ([TELAS.md §13](../TELAS.md)): serviços, profissionais, locais,
vocabulário, funcionamento e feriados. Usuários é a Tarefa 6; integrações é
marco 2 e **não entra**.

**Interfaces produzidas:**

```ts
export function salvarServico(e: { id?: string; nome: string; duracaoMin: number
  capacidadePadrao: number; ativo: boolean }): Promise<string>
export function salvarProfissional(e: { id?: string; nome: string; cor?: string
  ativo: boolean }): Promise<string>
export function salvarLocal(e: { id?: string; nome: string; ativo: boolean }): Promise<string>
export function salvarVocabulario(itens: ItemVocabulario[]): Promise<void>
export function salvarFuncionamento(dias: FaixaDia[]): Promise<void>
export function salvarFeriado(e: { data: string; tipo: 'feriado' | 'fechado'
  descricao?: string }): Promise<void>
```

**Aceite:**
- criar serviço, profissional e local funciona, e eles aparecem na hora no editor
  de série
- **desativar não some do passado**: serviço desativado continua no nome da
  sessão de ontem e sai das escolhas novas
- profissional **sem usuário** é criado normalmente (nome na grade antes de ter
  login)
- vocabulário mostra o efeito **antes de salvar** — escolheu "Aluno", a tela
  mostra onde isso aparece
- salvar vocabulário muda o texto da navegação e das outras telas na visita
  seguinte
- feriado marcado faz a sessão daquele dia nascer `cancelada` com o motivo, e ela
  aparece riscada na grade (é o comportamento do Plano 01 — aqui só se prova pela
  tela)
- funcionamento salvo aparece como faixa sugerida no editor de série
- `recepcao` não alcança `/config`; `dono` e `suporte` alcançam

---

### Tarefa 5: Convite — criar e aceitar

**Arquivos:** criar `src/server/usuarios/consultas.ts`,
`src/server/usuarios/acoes.ts`, `src/app/convite/[token]/page.tsx`; testes
`tests/usuarios.test.ts` e `e2e/convite.spec.ts`.

**Interfaces produzidas:**

```ts
export function convidar(e: { email: string; papel: Papel }):
  Promise<{ id: string; token: string }>   // token em claro, uma vez só
export function aceitarConvite(token: string, senha: string):
  Promise<{ ok: true; contaId: string } | { ok: false; motivo: EstadoConvite }>
export function revogarConvite(id: string): Promise<void>
```

`aceitarConvite` roda **sem sessão**: cria o usuário no Auth (ou vincula o que já
existe com aquele e-mail), grava `usuario_conta`, e marca `aceito_em` — tudo numa
transação lógica, com o token conferido por hash.

**Aceite:**
- convidar mostra o link **uma vez**, com aviso de que não dá para ver de novo
- o banco guarda só o hash — teste conferindo que o token em claro não está em
  nenhuma coluna
- abrir o link define senha e entra já na conta, com o papel do convite
- convite expirado, já aceito ou inexistente cada um dá sua mensagem, e nenhum
  vaza se o e-mail existe
- convidar e-mail que já é usuário de outra conta vincula sem criar usuário novo
- convite pendente aparece na lista, com quando expira, e dá para revogar
- token revogado não aceita

---

### Tarefa 6: Usuários da conta

**Arquivos:** modificar `src/server/usuarios/*`, `src/app/(app)/config/page.tsx`;
testes em `tests/usuarios.test.ts` e `e2e/config.spec.ts`.

**Interfaces produzidas:**

```ts
export function listarUsuarios(db: Db, contaId: string): Promise<UsuarioLinha[]>
export function mudarPapel(usuarioId: string, papel: Papel): Promise<void>
export function removerUsuario(usuarioId: string): Promise<void>  // ativo = false
```

**Aceite:**
- lista mostra quem tem acesso, com papel e último acesso
- mudar papel muda o que a pessoa alcança na visita seguinte
- **remover nunca apaga registro**: presença marcada pela Sofia continua marcada
  pela Sofia depois que a Sofia sai (teste conferindo
  `registrado_por_usuario_id`)
- o último `dono` da conta não pode ser removido nem rebaixado
- ninguém muda o próprio papel para cima
- remover é `ativo = false` em `usuario_conta`, e a pessoa perde o acesso na hora

---

### Tarefa 7: Pendências

**Arquivos:** criar `src/server/pendencias/consultas.ts`,
`src/app/(app)/pendencias/page.tsx`; testes `tests/pendencias.test.ts` e
`e2e/pendencias.spec.ts`.

**Os grupos** ([TELAS.md §11](../TELAS.md)): chamada não feita · reposição em
aberto (com há quanto tempo) · reserva esperando · plano vencendo · cadastro
incompleto. **Falha de envio não entra** — `evento_saida` é marco 2.

**Interfaces produzidas:**

```ts
export type TipoPendencia =
  | 'chamada_nao_feita' | 'reposicao_aberta' | 'reserva_esperando'
  | 'plano_vencendo' | 'cadastro_incompleto'
export type Pendencia = {
  tipo: TipoPendencia; referenciaId: string; titulo: string
  detalhe: string; desde: string | null; href: string
}
export function listarPendencias(db: Db, contaId: string): Promise<Pendencia[]>
export function dispensar(tipo: TipoPendencia, referenciaId: string, motivo: string): Promise<void>
```

**Aceite:**
- sessão que já passou com participação `esperada` aparece em "chamada não feita";
  registrar a chamada tira ela da lista sem passo extra
- reposição em aberto mostra **há quanto tempo** — crédito de seis meses atrás
  lê diferente de crédito da semana passada
- dispensar com motivo tira o item e ele não volta
- **a lista é esvaziável**: um cenário de teste resolve tudo e a tela fica vazia,
  dizendo isso com naturalidade
- cada item leva direto ao lugar onde se resolve
- `recepcao` e `dono` alcançam; `profissional` não

---

### Tarefa 8: Faixa de suporte e log de acesso

**Arquivos:** criar `src/components/ui/faixa-suporte.tsx`,
`src/server/suporte/acoes.ts`; modificar `src/app/(app)/layout.tsx`; testes em
`tests/suporte.test.ts` e `e2e/suporte.spec.ts`.

**Aceite:**
- quem entra numa conta com papel `suporte` vê uma faixa que **não some** em
  nenhuma tela e em nenhum tamanho
- entrar como suporte grava linha em `acesso_suporte` com início; sair grava o
  fim
- ação feita como suporte grava `registrado_por_usuario_id` normalmente
- usuário comum nunca vê a faixa

---

### Tarefa 9: Contas (4YU)

**Arquivos:** criar `src/server/suporte/consultas.ts`,
`src/app/(app)/contas-4yu/page.tsx`; testes `tests/suporte.test.ts` e
`e2e/suporte.spec.ts`.

**Interfaces produzidas:**

```ts
export type ContaSinais = {
  id: string; nome: string; slug: string; criadaEm: string; ativa: boolean
  sessoesUltimaSemana: number; chamadasFeitas: number; ultimoAcesso: string | null
}
export function listarContas(): Promise<ContaSinais[]>
export function criarConta(e: { nome: string; slug: string; fuso: string
  emailDono: string }): Promise<{ contaId: string; token: string }>
export function suspenderConta(contaId: string): Promise<void>
```

`criarConta` é a **única** escrita com `clienteAdmin()`. Ela confere
`papel = 'suporte'` antes de tudo, cria a conta, semeia o vocabulário padrão, e
devolve um convite de `dono` já pronto — o mesmo mecanismo da Tarefa 5.

**Aceite:**
- criar conta pela tela devolve o link de convite do dono, e o dono aceita e entra
  numa conta vazia que funciona
- a conta nasce com o vocabulário padrão, não com vocabulário nenhum
- os sinais de vida batem: sessões da última semana, chamadas feitas, último
  acesso
- **quem não é `suporte` não alcança a rota nem a server action** — teste
  chamando a action direto com usuário `dono`
- suspender tira o acesso da conta sem apagar dado
- entrar numa conta como suporte mostra a faixa da Tarefa 8

---

### Tarefa 10: Fechar o plano

- [ ] Corrigir `e2e/apoio.ts`: `usuarioDe` e `contaDeTeste` engolem o `error` do
      Supabase e quebram depois em `data!`, com mensagem inútil. Lançar o erro.
- [ ] `npm test` e `npm run test:e2e` inteiros
- [ ] `grep` provando que o `core/` continua puro
- [ ] `grep` provando que nenhuma tela tem "Aluno", "Turma", "Paciente" ou
      "Professor" escrito fixo
- [ ] `grep` provando que `clienteAdmin()` só aparece em
      `server/suporte/acoes.ts`, `server/agenda/materializar.ts` e
      `server/usuarios/acoes.ts`
- [ ] `npm run build` limpo
- [ ] **A prova do plano, feita à mão, sem `psql` e sem seed:** criar conta →
      aceitar o convite → cadastrar serviço, profissional e local → montar uma
      grade de três dias → convidar uma recepção → cadastrar uma pessoa → criar
      a vaga → registrar a chamada
- [ ] Atualizar `docs/ESTADO.md`
- [ ] Commitar

## Auto-revisão

**Cobertura da spec.** Do `TELAS.md`, este plano entrega as telas 2 (Convite,
T5), 11 (Pendências, T7), 12 (Grade fixa, T2–T3), 13 (Configuração, T4 e T6) e
15 (Contas 4YU, T8–T9). Fecha o marco 1.

**O que ficou de fora, e por quê:**

| O quê | Por quê |
|---|---|
| Tela 14, Importar planilha | Fora do marco 1 por decisão de produto: escrever contra o formato de um cliente é a consultoria com passo extra. Volta quando houver um segundo negócio migrando. |
| `/config` → Integrações (token de API) | O token só serve para a API do marco 2. Construir a tela antes do consumidor é adivinhar o formato. |
| Pendência "falhas de envio" | Depende de `evento_saida`, que é marco 2. |
| E-mail de convite | Depende do Resend, que é marco 2. O link copiável entrega o mesmo resultado hoje. |

**Risco maior deste plano:** a reconciliação da Tarefa 3. É a única operação que
mexe em dado já materializado, e errar nela reescreve passado — exatamente o que
a arquitetura promete não fazer. Por isso `alcanceDaEdicao` é função pura,
testada sem banco, antes de existir tela.

**Nível de detalhe.** Igual ao Plano 02: decisões, interfaces e critério de
aceite, sem transcrever implementação. O que a execução ensinar vai para o
`ESTADO.md`.
