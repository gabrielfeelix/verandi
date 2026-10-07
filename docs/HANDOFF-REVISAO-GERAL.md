# Handoff: revisão geral de lógica, modais e UX (07/out/2026)

Para o próximo agente. Em 07/out o sistema ganhou muita coisa num dia, a
pedido do MGM (cliente pagante, Daniel e Edu), e **quase nada foi testado
na tela**: o Docker estava desligado. Os erros de lógica que o cliente achou
em produção mostram que é hora de uma revisão de verdade antes de qualquer
coisa nova.

## Leia antes

1. `docs/HANDOFF-VARREDURA-UX.md`: regras do Gabriel, ambiente local, prints
   (`.rascunho/aud.spec.ts`), e2e de uma tela, espera do deploy.
2. `docs/BANCO-COMPARTILHADO.md`: produção é dividida com o AutoFluxos.
   Migration só pelo `node scripts/aplica-em-producao.mjs`; nunca
   `supabase db push`/`reset`. Nada em produção sem autorização explícita.
3. `docs/TAREFAS-VARREDURA.md`: a lista viva.

Regras que mais custaram hoje: resposta curta; decisão tomada, não opções;
print 1440 e 390 antes de entregar UI; `npx tsc --noEmit -p .` limpo sem
filtro; só o e2e da tela mexida, um por vez; travessão proibido; placeholder
começa com "Exemplo:"; texto em tom de SaaS B2B; ações otimistas; push na
`main` publica e o deploy pode ser conferido em segundo plano, sem travar
o trabalho.

## O que entrou em 07/out (tudo no ar, na `main`)

| Commit | O quê |
|---|---|
| `ebc5409` | Pacotes: Aulas a fazer, Pacote acabando, Pacote esgotado (Pendências, ficha, Alunos). Encaixe liga a aula ao pacote/avulsa com saldo. |
| `a98469e`, `2cfa61d`, `18b3254`, `412582b` | Aula avulsa (ficha e Agenda): modalidade nova inline, lugares, professor com foto, valor com cobrança. `CampoDinheiro`, `Escolha` com avatar. |
| `fe0e41b` | Aulas do plano semanal a fazer no mês (caso Thais: 2x/semana com 1 horário fixo). Valor da avulsa na linha da aula (não para professor). |
| `d162b1b` | `CampoDinheiro` em Receber, Corrigir valor e preços do plano. |
| `c46b417` | Marcar aula em modalidade sem grade abre dia e hora livres; valor no Encaixar de aula avulsa; topo de Recibos compacto. |
| `c0762ee` | Migration **0071** (`participacao.credito_encerrado_em`/`_motivo`), aplicada em produção. Crédito encerrado não conta em Pendências, ficha, Alunos e menu de reposição. |
| `f45a326`, `27885c0` | `planilhas/importa_presencas.py`: histórico do MGM jan/25 a out/26 (22 planilhas), ex-alunos inativos pelo controle de pagamentos, casamento de nomes por grafia/apelido/horário. |
| `0b9b838` | `planilhas/acerta_professor.py`: professor de cada aula antiga conforme a planilha (Bruna inativa). |

Dados em produção (MGM), feitos com autorização do Gabriel: ~10.200
participações importadas; créditos de reposição anteriores a 01/10/2026
encerrados ("acertados no papel"); capacidade das turmas em 3, exceto as 8
com 4 fixos; padrão do Pilates aparelho 3. **06/10/2026 não foi tocado**: o
Gabriel faz esse dia com o cliente.

## Erros de lógica já achados pelo cliente (aprenda com eles)

- Importação **somou** créditos de reposição em vez de refletir o estado
  real (Rogério com 7 em vez de 2). Corrigido com 0071.
- Aulas antigas com o professor de **hoje** da turma (1.258). Corrigido.
- Modalidade sem grade travava o Marcar aula. Corrigido.
- Pacote e avulsa nunca baixavam saldo (encaixe não ligava o contrato).
  Corrigido.

Padrão comum: regra escrita para o caso feliz, sem pensar no dado que já
existe ou no caminho alternativo. Procure isso em cada fluxo.

## Tarefas, nesta ordem

### 1. Bateria local do que entrou hoje

Ambiente: Docker Desktop ligado; Supabase local da Verandi; aplicar a 0071
no local (`npx supabase migration up --local`); `npx next dev -p 3200`.
Rode um por vez: `e2e/sessao.spec.ts`, `encaixe`, `planos`, `financeiro`,
`recibo`, `config`, `modais-e-busca`, `matricula`. Teste à mão, com print:
Aula avulsa (ficha e Agenda, com e sem aluno, com e sem valor, modalidade
nova), Marcar aula em Fisioterapia, Encaixar com valor numa aula avulsa,
Pendências com os grupos novos, cartão Plano da ficha com pacote e com plano
semanal, `CampoDinheiro` (digitar, colar "R$ 1.980,00", apagar).
Pendências conhecidas de antes: `e2e/onboarding.spec.ts` (2 testes) e
`e2e/matricula.spec.ts` ("horário cheio é recusado") já falhavam.

### 2. Revisão de todos os modais

Para cada um: campos certos e obrigatórios certos, máscara e tipo do campo
(dinheiro com `CampoDinheiro`, data, hora, telefone), menu da casa e não
`<select>` nativo (`ui/escolha.tsx`, com avatar quando é pessoa), busca de
pessoa com avatar (padrão de `sessao/modal-encaixe.tsx`), mensagem de erro
que diz o que fazer, botão principal com verbo, ação otimista, e **a regra
de negócio por trás** (o que grava, o que cobra, o que libera vaga, o que
avisa o bot). Arquivos com modal:

`contratos/matricula.tsx`, `financeiro/lista.tsx` (Receber, Corrigir,
Cancelar, Emitir recibo, Estornar), `recibo/lista.tsx`, `recibo/enviar.tsx`,
`pessoas/marcar-aula.tsx`, `pessoas/aula-avulsa.tsx`, `pessoas/nova-pessoa.tsx`,
`pessoas/editar-pessoa.tsx`, `pessoas/acoes-da-ficha.tsx`, `pessoas/vagas.tsx`,
`sessao/modal-encaixe.tsx`, `sessao/modal-cancelar.tsx`, `licenca/modal-volta.tsx`,
`pendencias/lista.tsx`, `grade/editor-serie.tsx`, `grade/linha-da-grade.tsx`,
`config/catalogo.tsx`, `config/planos.tsx`, `config/equipe.tsx`,
`config/usuarios.tsx`, `config/funcionamento.tsx`, `config/integracoes.tsx`,
`avaliacao/nova-avaliacao.tsx`, `avaliacao/visor.tsx`, `hoje/saudacao.tsx`,
`onboarding/boas-vindas.tsx`, `admin/*`.

Uma frente por commit, e2e da tela, print antes e depois.

### 3. Pendências redesenhada

Hoje é uma coluna de grupos com linhas. O Gabriel quer ver mais rápido:
**tabela no padrão de Alunos** (`ui/tabela.tsx`, `ui/linha-que-abre.tsx`)
ou **kanban** por tipo. Decida e aplique. Sugestão: tabela única com coluna
Tipo (etiqueta), Aluno (avatar), Detalhe, Há quanto tempo, Ação; filtros em
chips por tipo com contagem (como Alunos) e ação principal na linha. Kanban
fica bonito com 3 a 5 colunas e vira rolagem lateral com 10 tipos; pense no
celular. Grupos atuais: chamada não feita, reposição em aberto, licença,
reserva esperando, horário sem contrato, pacote esgotado, pacote acabando,
aulas a fazer (pacote/avulsa com saldo e plano semanal), cadastro incompleto.
`pendencia_dispensada.tipo` tem `check` fixo no banco: tipo novo não se
dispensa sem migration (`SEM_DISPENSAR` em `src/core/pendencias.ts`).

### 4. Matrícula do aluno

Existe: `pessoa.identificador_externo`, na tela "Nº da ficha". Mas é
**opcional e digitado à mão**, e há aluno sem. Proposta a avaliar: número
gerado sozinho no cadastro (próximo livre da conta, editável, único por
conta), coluna em Alunos e no cabeçalho da ficha, busca por ele (já existe).
Pede migration (sequência ou função + `unique (conta_id,
identificador_externo)`); confira duplicatas antes no banco do MGM, que veio
de planilha. A API do bot lê esse campo: não mude o nome.

### 5. UX das outras telas

Mesma régua das varreduras 1 a 3, agora com o olhar de **fluxo**: cada tela
responde a pergunta de quem abre? cada botão leva aonde promete? o que
acontece com dado antigo, com aluno de licença, com professor (não vê
dinheiro), no celular?

### 6. Pendente do cliente

O Gabriel mandou ao Daniel a lista de ~20 nomes da planilha sem par (Vera,
Gustavo, Gabriela, Thais, Paula, Renata, Alexandre, Mauricio, Fernanda,
Luciana, Lucilene, Mayumi, Socorro, Gyovana, Emily, Tina, Mario Prado,
Adriana Vianna, Gleyciane, Guta, Ezequiel). Com a resposta: ajuste o
casamento ou cadastre, e rode de novo (não duplica):

```bash
set -a && . ../.secrets/4yu.env && set +a
F="../autofluxos/CONTROLE DE PAGAMENTOS E RENOVAÇÕES(1) (1).xlsx"
python3 planilhas/importa_presencas.py .rascunho/presenca/*.xlsx --financeiro "$F" --pula 2026-10-06 [--confirmo]
python3 planilhas/acerta_professor.py .rascunho/presenca/*.xlsx --pula 2026-10-06 [--confirmo]
```

Depois de importar, encerre os créditos anteriores a 01/10/2026 dos
registros novos (o SQL está na mensagem do commit `c0762ee` e na conversa
de 07/out: `registrado_por_origem = 'importacao'`, falta/falta_avisada, sem
reposição ligada, `credito_encerrado_em is null`). As planilhas originais
estão em `../autofluxos/presenca-mgm/` (ignorada pelo git); a cópia de
trabalho em `.rascunho/presenca/`. **Nunca** as copie para dentro de um repo.

## Relatório final

Curto, por tela: o que estava errado, o que mudou, print. O que ficou de
fora e por quê.
