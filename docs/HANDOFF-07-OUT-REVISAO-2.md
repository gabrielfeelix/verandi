# Handoff: revisão geral, segunda metade (07/out/2026)

Continua `docs/HANDOFF-REVISAO-GERAL.md`. Leia ele antes (regras, ambiente,
banco compartilhado). Aqui só o que mudou e o que falta.

## Feito (tudo na `main`, deploy READY)

| Commit | O quê |
|---|---|
| `a3ca7c0` | e2e de matrícula e onboarding atualizados (tela bloqueia horário cheio; tamanho da visita vem de `roteiroDe`). |
| `ece62f7` | Aula avulsa cobrada liga ao contrato dela (`PedidoDeEncaixe.contratoId`, validado), não ao pacote mais antigo. Desfaz sessão e contrato se um passo falha. |
| `7b2e753` | `CampoDinheiro`: texto colado é lido em reais ("120" = 120,00). |
| `13684c0` | Encaixe pago em aula avulsa passa pelo limite do plano livre. |
| `abf1642`, `fafcdd8` | Aulas a fazer: respeita licença e vigência; horário fixo conta nas semanas ainda sem sessão gerada (`somarHorariosFixosSemSessao`). |
| `ad3fa20` | Marcar aula sem horário com lugar não promete reposição. |
| `86b2628` | Aula cancelada devolve saldo de pacote e avulsa (`contratoComSaldo`). |
| `e5327d6` | Pagamento não aceita data futura. |
| `4e681a1` | Encerrar horário, trancar, encerrar contrato e inativar tiram a pessoa das aulas já geradas (`tirarDasAulasDepoisDoFim`) e avisam a fila. |
| `2fd309b` | Pendências virou tabela única com chips por tipo; "Em aberto" em dias de calendário. |

e2e novos: `e2e/aula-avulsa.spec.ts` (4), `e2e/encerrar-horario.spec.ts` (2),
`tests/pacote.test.ts`.

Produção, com autorização do Gabriel: apagadas 5 participações paradas de
Pilates aparelho (Carmem Lucia Buzzerio e Silvia Espiridião). Consulta de
conferência (só leitura) deu 0 restantes.

## Modais já revisados

Financeiro (Receber, Corrigir, Cancelar, Estornar, Emitir), Cancelar aula,
Volta de licença, Inativar, Aula avulsa, Marcar aula, Encaixar, Dispensar
pendência, Matrícula (horário cheio).

## Falta

1. **Tarefa 2, modais restantes**: `config/catalogo.tsx`, `config/planos.tsx`,
   `config/equipe.tsx`, `config/usuarios.tsx`, `config/funcionamento.tsx`,
   `config/integracoes.tsx`, `avaliacao/nova-avaliacao.tsx`, `avaliacao/visor.tsx`,
   `grade/editor-serie.tsx`, `grade/linha-da-grade.tsx`, `pessoas/nova-pessoa.tsx`,
   `pessoas/editar-pessoa.tsx`, `recibo/*`, `hoje/saudacao.tsx`, `admin/*`.
   Olhe a regra de negócio, não só o campo: o padrão dos bugs de hoje foi
   dado já existente (sessões geradas à frente, participação de aula
   cancelada, contrato em vigor) que a regra não considerava.
2. **Tarefa 5**: fluxo das outras telas (Hoje, Agenda, Grade, Alunos, ficha,
   Financeiro, Configuração), no celular e com o olhar do professor.

## Atenção

- Outra sessão trabalhou em paralelo na mesma `main` (Nº da ficha, aula
  experimental e Gympass, migration 0072). Antes de commitar, `git status` e
  `git diff` dos seus arquivos: commite só o que é seu.
- Modal de encaixe sem print automático: o roteiro `.rascunho/rev.spec.ts`
  travou no botão Encaixar. Os e2e cobrem.
