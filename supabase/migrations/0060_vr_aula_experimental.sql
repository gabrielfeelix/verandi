-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A aula experimental tem grade própria, e ela é mais estreita que a agenda.
 *
 * O estúdio abre a semana inteira; a aula experimental cabe em pedaços dela —
 * no MGM, só Pilates aparelho, e nem em todo horário ("segunda 12h às 14h
 * indisponível", "quarta começa às 15h"). Quem chega pelo bot pedindo
 * experimental não pode ver o mesmo que quem já é aluno vê.
 *
 * **Por que dado e não desenho de fluxo.** A tentação é escrever a grade como
 * condição no editor do AutoFluxos, e é a escolha que envelhece pior: a regra
 * passaria a existir em dois lugares (a agenda real e o desenho), e quem muda a
 * grade é o Daniel, que não abre editor de fluxo. Aqui ele muda pela tela e o
 * bot obedece no mesmo instante, sem ninguém republicar nada. Foi o que o
 * próprio pedido descreveu: "depois que ele tiver com sistema, ele mesmo
 * disponibiliza ou não de acordo com a necessidade, manualmente".
 *
 * **Por que dois campos e não um.** `aceita_experimental` responde "esse
 * serviço recebe quem nunca veio?" e `janela_experimental` responde "em que
 * horários?". Um campo só obrigaria a inventar uma janela vazia para dizer
 * "não", e "não aceita" e "aceita em horário nenhum" são estados que a tela
 * precisa distinguir para explicar o que está acontecendo.
 */

alter table servico
  /*
   * Nasce `false`, e isso é de propósito.
   *
   * O contrário — todo serviço aceitando experimental até alguém desmarcar —
   * faria a Fisioterapia e o Personal aparecerem para quem pediu aula
   * experimental no minuto em que esta migration subisse, que é exatamente o
   * defeito relatado. Silêncio é recuperável; oferecer o que não existe custa
   * a conversa e a confiança.
   */
  add column aceita_experimental boolean not null default false,

  /*
   * As faixas em que a experimental cabe, por dia da semana.
   *
   * `null` = sem restrição de horário: o serviço aceita experimental em
   * qualquer sessão dele. Não é o mesmo que `[]`, que seria "em nenhuma".
   *
   * O formato é `{"dias": [[{"de":"08:00","ate":"12:00"}], ...]}`, com sete
   * listas e domingo em primeiro — o mesmo desenho de `HorarioDeAtendimento`
   * no AutoFluxos. Repetir o formato é a decisão barata: ele já é testado, já
   * tem tela, e "mais de uma faixa por dia" é o caso real (12h às 13h fechado
   * para o almoço, 14h em diante aberto).
   *
   * O `check` confere só o esqueleto — sete listas dentro de `dias`. O resto
   * mora no código, com teste, porque validar hora em SQL custa caro e erra
   * diferente do que a aplicação erra.
   */
  add column janela_experimental jsonb
    constraint servico_janela_experimental_tem_sete_dias check (
      janela_experimental is null
      or (
        jsonb_typeof(janela_experimental -> 'dias') = 'array'
        and jsonb_array_length(janela_experimental -> 'dias') = 7
      )
    );

comment on column servico.aceita_experimental is
  'O serviço recebe aula experimental? Nasce false: oferecer o que não existe '
  'custa mais caro que não oferecer.';

comment on column servico.janela_experimental is
  'Faixas por dia da semana (0=domingo) em que a experimental cabe. null = sem '
  'restrição de horário. Mesmo formato do horário de atendimento do AutoFluxos.';

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
