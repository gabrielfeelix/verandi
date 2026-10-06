-- Licença como período acompanhado, e não só como status de uma aula.
--
-- Até aqui a licença existia aula a aula, no status da participação, e nada
-- dizia quando a pessoa voltava. O estúdio pediu o contrário: ver sempre quem
-- está afastado, com a data prevista de volta, e ser lembrado quando ela chega,
-- porque "quem está de licença" numa lista que ninguém abre é lista esquecida.
--
-- O status `licenca` da participação continua sendo o registro da aula. Esta
-- tabela é o acompanhamento: abre na primeira licença marcada, fecha quando a
-- pessoa volta (presença na chamada, "Voltou" em Pendências, ou o bot).

set search_path = app_verandi, extensions;

create table if not exists licenca (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references conta (id) on delete cascade,
  pessoa_id  uuid not null references pessoa (id) on delete cascade,
  inicio     date not null default current_date,
  /* opcional: nem toda licença chega com data, e a sem data também se acompanha */
  volta_prevista date,
  criado_em  timestamptz not null default now(),
  criado_por_usuario_id uuid,
  /*
   * A pessoa avisou que voltou e não quis reagendar agora. A licença continua
   * aberta: o horário dela ainda está guardado e alguém precisa ligar.
   */
  voltou_sem_reagendar_em timestamptz,
  encerrada_em timestamptz,
  encerrada_por text check (encerrada_por in ('presenca', 'operador', 'bot')),
  constraint licenca_datas check (volta_prevista is null or volta_prevista >= inicio)
);

/* uma licença aberta por pessoa: a segunda marcação estende, não duplica */
create unique index if not exists licenca_aberta_uk on licenca (pessoa_id)
  where encerrada_em is null;
create index if not exists licenca_da_conta on licenca (conta_id)
  where encerrada_em is null;

comment on table licenca is
  'acompanhamento do afastamento: abre na licença marcada, fecha na volta. '
  'O status licenca da participação continua sendo o registro de cada aula';

alter table licenca enable row level security;

drop policy if exists licenca_le on licenca;
create policy licenca_le on licenca for select
  using (conta_id in (select app_verandi.contas_do_usuario()));

/* quem marca licença na chamada é quem a abre, inclusive o profissional */
drop policy if exists licenca_escreve on licenca;
create policy licenca_escreve on licenca for all
  using (app_verandi.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]));

/* só esta tabela: o grant em massa reabriria as tabelas técnicas da 0048 */
grant select, insert, update, delete on licenca to authenticated;
grant all on licenca to service_role;

/*
 * Quem já está afastado hoje entra aberto, para a lista não nascer vazia: a
 * última aula registrada nos últimos sessenta dias está como licença. O início
 * é a primeira licença depois da última presença ou falta.
 */
with ultima as (
  select distinct on (pa.pessoa_id) pa.pessoa_id, pa.conta_id, pa.status
    from participacao pa
    join sessao s on s.id = pa.sessao_id
   where pa.status in ('presente', 'falta', 'falta_avisada', 'licenca')
     and s.inicio <= now()
     and s.inicio >= now() - interval '60 days'
   order by pa.pessoa_id, s.inicio desc
)
insert into licenca (conta_id, pessoa_id, inicio)
select u.conta_id, u.pessoa_id,
       (min(s.inicio) at time zone c.fuso)::date
  from ultima u
  join conta c on c.id = u.conta_id
  join participacao pa on pa.pessoa_id = u.pessoa_id and pa.status = 'licenca'
  join sessao s on s.id = pa.sessao_id
 where u.status = 'licenca'
   and s.inicio <= now()
   and s.inicio > coalesce((
         select max(s2.inicio)
           from participacao p2 join sessao s2 on s2.id = p2.sessao_id
          where p2.pessoa_id = u.pessoa_id
            and p2.status in ('presente', 'falta', 'falta_avisada')
            and s2.inicio <= now()
       ), '-infinity'::timestamptz)
   and not exists (
         select 1 from licenca l where l.pessoa_id = u.pessoa_id and l.encerrada_em is null)
 group by u.conta_id, u.pessoa_id, c.fuso;
