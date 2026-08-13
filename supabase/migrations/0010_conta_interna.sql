-- A conta da própria 4YU.
--
-- Existe porque o papel `suporte` precisa de onde morar. Sem ela, o primeiro
-- suporte não nasce: `usuario_conta.conta_id` é `not null`, `ehSuporte` exige a
-- linha, e criar conta exige ser suporte — banco novo trava antes do primeiro
-- clique. E, hospedando o vínculo numa conta de cliente, sair do suporte
-- naquela conta apagava a linha e o usuário perdia o acesso inteiro.
--
-- Ela não é conta de cliente: não aparece na lista de `/contas-4yu`, e ninguém
-- entra nela como suporte.

alter table conta add column interna boolean not null default false;

-- uma só, sempre: duas contas internas seria duas verdades sobre quem é a 4YU
create unique index conta_interna_unica on conta (interna) where interna;

insert into conta (nome, slug, fuso, interna)
values ('4YU', '4yu', 'America/Sao_Paulo', true)
on conflict (slug) do update set interna = true;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
