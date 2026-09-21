-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * Cai a coluna de horas, que a `0062` aposentou.
 *
 * A `0062` criou `minutos_minimos_cancelamento`, copiou os valores e deixou
 * `horas_minimas_cancelamento` para trás de propósito: derrubar na mesma
 * migration que introduz a substituta quebra a versão da aplicação que ainda
 * está no ar durante o deploy, e o erro cai em cima de quem estiver usando o
 * sistema naquele minuto.
 *
 * Esse minuto passou. O código que lê minutos está em produção — conferido pela
 * rota `GET /api/v1/participacoes/{id}`, que só existe nessa versão e responde
 * — e nenhum arquivo do repositório cita mais o nome antigo, fora
 * `banco.types.ts`, que é gerado a partir do schema e some junto.
 *
 * **Duas colunas para a mesma regra é uma regra que diverge.** Enquanto as duas
 * existem, alguém acaba escrevendo numa e lendo da outra: a conta passa a
 * mostrar um prazo na tela e a cobrar outro no cancelamento, sem erro nenhum
 * aparecer. É o tipo de defeito que só se descobre pela reclamação de quem
 * perdeu a reposição.
 *
 * Nada a converter aqui: a `0062` já fez `minutos = horas * 60` para todas as
 * contas, e é de `minutos` que o sistema lê desde então.
 */

alter table conta drop column if exists horas_minimas_cancelamento;

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
