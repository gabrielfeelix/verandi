-- Desfaz por inteiro a instalação da Verandi no banco do AutoFluxos.
-- Tudo que as migrations 0030–0040 criam está listado aqui. É seguro rodar
-- mais de uma vez.

drop policy if exists foto_profissional_le        on storage.objects;
drop policy if exists foto_profissional_escreve   on storage.objects;
drop policy if exists foto_profissional_atualiza  on storage.objects;
drop policy if exists foto_profissional_apaga     on storage.objects;

delete from storage.objects where bucket_id = 'foto-profissional';
delete from storage.buckets where id = 'foto-profissional';

-- leva junto tabelas, view, funções, tipos, políticas e o controle de
-- migrations, que mora dentro do próprio schema de propósito
drop schema if exists app_verandi cascade;

-- `unaccent` fica de fora de propósito: extensão é global e removê-la pode
-- quebrar algo que passou a usá-la. Se for mesmo para limpar tudo:
--   drop extension if exists unaccent;
