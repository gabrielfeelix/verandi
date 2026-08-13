# Plano 02 — Operação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Os passos usam caixa (`- [ ]`).

**Objetivo:** as telas que fazem o negócio operar sem a planilha — registrar a
chamada do dia pelo celular, encaixar uma reposição, e ver a semana no desktop.

**Arquitetura:** as telas são Server Components que leem pelo cliente **do
usuário** (com RLS valendo), e escrevem por server actions. Nenhuma tela chama a
chave de serviço. A grade materializa a janela antes de listar. Toda regra de
agenda continua no `core/`; as telas só perguntam.

**Spec:** [`../TELAS.md`](../TELAS.md) e [`../ARQUITETURA.md`](../ARQUITETURA.md)

**Depende de:** [Plano 01](01-fundacao.md), concluído.

## Restrições globais

Valem as do [Plano 01](01-fundacao.md), mais estas:

- **Ler e escrever pelo cliente do usuário** (`clienteServidor()`), nunca pelo
  admin. As políticas existem para valer; usar a chave de serviço numa tela é
  desligar a segurança que o Plano 01 construiu.
- **Nenhuma tela escreve o nome de uma entidade fixo no JSX.** Todo rótulo sai
  do `vocabulario` da conta. Um teste varre o `src/app/` procurando "Aluno",
  "Turma", "Paciente" e "Professor" e falha se achar.
- **Frontend é descartável.** Componentes burros, dados vindo de server
  components e server actions. Estilo mínimo, para o protótipo visual trocar a
  casca depois sem mexer no fluxo.
- **Nenhuma ação de registro pede confirmação.** Acontece e oferece desfazer.
  Confirmam só cancelar sessão e remover participação.
- **Toda escrita grava quem fez** (`registrado_por_usuario_id` e
  `registrado_por_origem`).

## Decisões que este plano toma

**A chamada é derivada, não é coluna.** Uma sessão está "com chamada pendente"
quando ainda tem participação em `esperada` ou `confirmada`. Não existe
`sessao.chamada_feita` — coluna de estado derivado é coluna que um dia mente.

**"Todos vieram" preenche as lacunas, não sobrescreve decisão.** A ação afeta só
quem está em `esperada`/`confirmada`. Quem já foi marcado como falta continua
falta. O professor às vezes marca a exceção primeiro; perder isso seria pior que
exigir um toque a mais.

**A grade materializa antes de listar.** Abrir a semana é o gatilho principal da
materialização sob demanda do Plano 01.

**Sessão é uma tela só, com dois modos.** Não existe `/chamada/[id]` separado de
`/sessao/[id]`: no celular a diferença some, e duas URLs para a mesma pergunta é
como se perde gente. Os controles de presença aparecem quando a sessão já
começou; gerir participação está sempre disponível para quem pode.

## Estrutura de arquivos

```
src/
├── core/agenda/
│   └── chamada.ts             estado da chamada, derivado das participações
├── server/
│   ├── vocabulario.ts         carrega e memoriza o vocabulário da conta
│   ├── agenda/
│   │   ├── consultas.ts       sessões de um intervalo, com ocupação
│   │   └── acoes.ts           server actions de presença, encaixe, capacidade
│   └── pessoas/
│       ├── consultas.ts       busca, lista com filtros, ficha
│       └── acoes.ts           criar e editar pessoa, criar e encerrar vaga
├── app/(app)/
│   ├── layout.tsx             shell: conta ativa, vocabulário, navegação
│   ├── hoje/page.tsx
│   ├── semana/page.tsx
│   ├── sessao/[id]/page.tsx
│   ├── pessoas/page.tsx
│   ├── pessoas/[id]/page.tsx
│   ├── vaga/page.tsx
│   └── agendar/page.tsx
├── app/contas/page.tsx        trocar de conta
└── components/
    ├── sessao/                lista de participação, controles de presença
    ├── grade/                 a grade semanal
    └── ui/                    peças burras compartilhadas
```

---

### Tarefa 1: Shell e vocabulário

**Arquivos:** criar `src/server/vocabulario.ts`, `src/app/(app)/layout.tsx`,
`src/app/contas/page.tsx`, `src/app/contas/acoes.ts`; teste
`tests/vocabulario-conta.test.ts`.

**Interfaces produzidas:**
- `carregarVocabulario(db: Db, contaId: string): Promise<Vocabulario>` — memoizado
  por requisição com `React.cache`
- `exigirConta(): Promise<ContaAtiva>` — redireciona para `/entrar` se não houver

**Aceite:**
- entrar como `dono` mostra o nome da conta na tela
- a conta com `vocabulario.pessoa = Aluno` faz a navegação escrever "Alunos"; a
  conta sem vocabulário escreve "Pessoas"
- quem tem duas contas vê `/contas` e troca; quem tem uma não vê a tela
- trocar de conta muda o cookie e o conteúdo da tela seguinte

- [ ] Escrever teste de integração: duas contas com vocabulários diferentes,
      `carregarVocabulario` devolve o certo para cada, e cai no padrão quando a
      conta não configurou
- [ ] Rodar e ver falhar
- [ ] Implementar `carregarVocabulario` e `exigirConta`
- [ ] Implementar o layout com nome da conta, papel e navegação por papel
- [ ] Implementar `/contas` com a ação de trocar
- [ ] Rodar e ver passar · commitar

---

### Tarefa 2: Consultar sessões de um intervalo

**Arquivos:** criar `src/core/agenda/chamada.ts`,
`src/server/agenda/consultas.ts`; testes `tests/unit/chamada.test.ts` e
`tests/consultas.test.ts`.

**Interfaces produzidas:**

```ts
// core/agenda/chamada.ts
export type EstadoChamada = 'sem_ninguem' | 'pendente' | 'feita'
export function estadoDaChamada(status: StatusParticipacao[]): EstadoChamada

// server/agenda/consultas.ts
export type SessaoResumo = {
  id: string
  inicio: string
  duracaoMin: number
  servico: string
  profissional: string | null
  local: string | null
  status: 'prevista' | 'realizada' | 'cancelada'
  motivoCancelamento: string | null
  ocupacao: Ocupacao
  chamada: EstadoChamada
}
export type ParticipacaoDetalhe = {
  id: string
  pessoaId: string
  nome: string
  telefone: string | null
  tags: string[]
  origem: OrigemParticipacao
  status: StatusParticipacao
  reposicaoDeId: string | null
  observacao: string | null
}
export type SessaoDetalhe = SessaoResumo & { participacoes: ParticipacaoDetalhe[] }

export function sessoesDoIntervalo(
  db: Db, contaId: string, de: string, ate: string,
  filtro?: { profissionalId?: string; servicoId?: string; localId?: string },
): Promise<SessaoResumo[]>

export function sessaoDetalhe(db: Db, sessaoId: string): Promise<SessaoDetalhe | null>
```

`sessoesDoIntervalo` **materializa a janela antes de ler**, chamando
`materializarJanela` do Plano 01.

**Aceite:**
- `estadoDaChamada([])` é `sem_ninguem`; com alguma `esperada` é `pendente`; só
  com decididos é `feita`; `falta_avisada` conta como decidido
- abrir um intervalo onde nada foi materializado cria as sessões e devolve elas
- a ocupação de cada sessão bate com `calcularOcupacao`
- sessão cancelada aparece na lista, com o motivo — não some
- filtrar por profissional devolve só as dele

---

### Tarefa 3: Tela Sessão, em leitura

**Arquivos:** criar `src/app/(app)/sessao/[id]/page.tsx`,
`src/components/sessao/lista-participacao.tsx`; teste `e2e/sessao.spec.ts`.

**Mostra** (ver [TELAS.md §5](../TELAS.md)): data, horário, serviço,
profissional, local, ocupação `3/4`, estado da sessão; e a lista de
participações com nome, **origem**, **status**, tags, e aviso de telefone
ausente.

**Aceite:**
- quem está na vaga fixa e quem está de encaixe são distinguíveis sem clicar
- ocupação aparece como `ocupadas/capacidade`, e `5/4` fica em destaque
- pessoa sem telefone tem marca visível, e a tela não quebra
- sessão cancelada mostra o motivo
- a tela usa o rótulo da conta ("Alunos"), não a palavra do código

---

### Tarefa 4: Chamada — em lote e por pessoa

**Arquivos:** criar `src/server/agenda/acoes.ts`,
`src/components/sessao/controles-presenca.tsx`; testes
`tests/acoes-presenca.test.ts` e `e2e/chamada.spec.ts`.

**Interfaces produzidas:**

```ts
export function marcarTodosPresentes(sessaoId: string): Promise<{ marcadas: number }>
export function mudarStatus(participacaoId: string, status: StatusParticipacao): Promise<void>
```

**Aceite:**
- `marcarTodosPresentes` numa sessão de quatro pendentes marca as quatro
- **não sobrescreve quem já foi decidido**: com três pendentes e uma falta, marca
  três e a falta continua falta
- mudar status grava `registrado_por_usuario_id` e `registrado_por_origem`
- `profissional` consegue registrar presença; um usuário de outra conta não
- no navegador: abrir a sessão, um toque em "Todos vieram", um toque para derrubar
  a exceção, e a chamada fica `feita`
- desfazer devolve o status anterior

---

### Tarefa 5: Encaixar e ajustar capacidade

**Arquivos:** modificar `src/server/agenda/acoes.ts`; criar
`src/components/sessao/encaixar.tsx`; testes em `tests/acoes-presenca.test.ts` e
`e2e/encaixe.spec.ts`.

**Interfaces produzidas:**

```ts
export function encaixar(entrada: {
  sessaoId: string; pessoaId: string
  origem: 'avulso' | 'reposicao' | 'encaixe' | 'reserva'
  reposicaoDeId?: string
}): Promise<{ ok: true } | { ok: false; motivo: 'lotada' | 'ja_participa' }>

export function ajustarCapacidade(sessaoId: string, capacidade: number): Promise<void>
export function cancelarSessao(sessaoId: string, motivo: string): Promise<void>
export function removerParticipacao(participacaoId: string): Promise<void>
```

`encaixar` **confere a vaga na hora de gravar**, relendo a ocupação e passando
por `avaliarEncaixe` — não confia no que a tela mostrava.

**Aceite:**
- encaixar em sessão com vaga funciona
- **encaixar em sessão lotada é recusado com `motivo: 'lotada'`**, e a tela
  oferece aumentar a capacidade em vez de forçar
- subir a capacidade e encaixar de novo funciona, e a série continua com a
  capacidade antiga
- a mesma pessoa duas vezes é recusada com `ja_participa`
- reposição grava `reposicao_de_id` apontando para a falta escolhida
- cancelar sessão pede confirmação e mostra quantas pessoas serão avisadas

---

### Tarefa 6: Tela Hoje

**Arquivos:** criar `src/app/(app)/hoje/page.tsx`; teste `e2e/hoje.spec.ts`.

**Aceite:**
- lista as sessões do dia em ordem, com ocupação e estado da chamada
- **chamada pendente é a informação em destaque** — é o que se esquece
- `profissional` vê só as dele; `dono` e `recepcao` alternam entre a própria
  agenda e a de todos
- dá para andar para ontem, amanhã e uma data escolhida
- dia sem sessão diz isso com naturalidade, sem parecer erro
- sessão cancelada aparece riscada, com o motivo

---

### Tarefa 7: Grade da semana

**Arquivos:** criar `src/app/(app)/semana/page.tsx`,
`src/components/grade/grade-semana.tsx`; teste `e2e/semana.spec.ts`.

**Aceite:**
- dias em coluna, horários em linha, célula com serviço, profissional e ocupação
- aguenta 70 horários numa semana sem virar rolagem infinita
- em viewport de celular vira **um dia por vez**, com navegação lateral
- filtrar por profissional funciona (é o filtro mais usado)
- feriado marca a coluna inteira
- clicar na célula abre a sessão
- abrir uma semana nunca materializada cria as sessões

---

### Tarefa 8: Pessoas e ficha

**Arquivos:** criar `src/server/pessoas/consultas.ts`,
`src/server/pessoas/acoes.ts`, `src/app/(app)/pessoas/page.tsx`,
`src/app/(app)/pessoas/[id]/page.tsx`; testes `tests/pessoas.test.ts` e
`e2e/pessoas.spec.ts`.

**Interfaces produzidas:**

```ts
export type FiltroPessoa =
  | 'sem_telefone' | 'sem_horario_fixo' | 'plano_vencendo' | 'faltou_duas' | 'inativa'

export function listarPessoas(db, contaId, opts: {
  busca?: string; filtros?: FiltroPessoa[]
}): Promise<PessoaLinha[]>

export function fichaDaPessoa(db, pessoaId): Promise<Ficha | null>
export function criarPessoa(entrada: { nome: string; telefone?: string }): Promise<string>
export function criarVaga(serieId: string, pessoaId: string, inicio: string): Promise<void>
export function encerrarVaga(vagaId: string, fim: string): Promise<void>
```

**Aceite:**
- busca tolerante a acento e a nome parcial (`emilia` acha `Emília`)
- cada resultado traz algo que desambigua: telefone, identificador ou horário fixo
- os cinco filtros funcionam e podem combinar
- criar pessoa **só com nome** funciona
- a ficha mostra vagas recorrentes, próximas sessões, histórico e **reposições em
  aberto**
- encerrar vaga **não apaga o passado**: o histórico de antes do fim continua lá
- pessoa inativa some do padrão e continua no histórico

---

### Tarefa 9: Buscar vaga e Novo agendamento

**Arquivos:** criar `src/app/(app)/vaga/page.tsx`,
`src/app/(app)/agendar/page.tsx`; testes `tests/disponibilidade.test.ts` e
`e2e/agendar.spec.ts`.

**Interfaces produzidas:**

```ts
export function horariosLivres(db, contaId, opts: {
  de: string; ate: string
  servicoId?: string; profissionalId?: string; localId?: string
}): Promise<{ livres: SessaoResumo[]; cheios: SessaoResumo[] }>
```

Usa `temVagaParaOferecer` do `core/`. **É a mesma função que o endpoint
`/api/v1/disponibilidade` vai usar no marco 2** — a tela e o bot não podem
discordar.

**Aceite:**
- **cheio nunca aparece entre os livres** — vem em lista separada e rotulada
- o fluxo de agendar chega preenchido pelos três caminhos (da sessão, da ficha,
  da busca)
- cadastrar pessoa nova sem sair do fluxo funciona
- reposição deixa escolher qual falta está sendo reposta
- se lotou entre escolher e confirmar, avisa e oferece outro horário
- dá para transformar em vaga recorrente, e a tela diz claramente que aquilo
  ocupa o horário toda semana

---

### Tarefa 10: Fechar o plano

- [ ] `npm test` e `npm run test:e2e` inteiros
- [ ] `grep` provando que o `core/` continua puro
- [ ] `grep` provando que nenhuma tela tem "Aluno", "Turma", "Paciente" ou
      "Professor" escrito fixo
- [ ] `npm run build` limpo
- [ ] Atualizar `docs/ESTADO.md`
- [ ] Commitar

## Auto-revisão

**Cobertura da spec.** Do `TELAS.md`, este plano entrega as telas 3 (Trocar
conta, T1), 4 (Hoje, T6), 5 (Sessão, T3–T5), 6 (Grade, T7), 7 (Buscar vaga, T9),
8 (Novo agendamento, T9), 9 (Pessoas, T8) e 10 (Ficha, T8). Ficam para o Plano
03 as telas 2 (Convite), 11 (Pendências), 12 (Grade fixa), 13 (Configuração), 14
(Importar) e 15 (Contas 4YU).

**Buraco conhecido e aceito:** sem a tela 12, a grade fixa precisa ser cadastrada
por script ou direto no banco para testar. É de propósito — construir o editor de
séries antes de existir tela que mostre o resultado é trabalhar às cegas.

**Nível de detalhe.** Este plano especifica decisões, interfaces e critério de
aceite; não transcreve implementação. É calibragem deliberada: o Plano 01 trazia
o código inteiro e mesmo assim divergiu em quatro pontos na execução — o que a
execução ensina vai para o `ESTADO.md`, que é onde se lê depois.
