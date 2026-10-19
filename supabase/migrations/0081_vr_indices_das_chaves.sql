-- Índice em toda chave estrangeira de `app_verandi`, e fora um repetido.
--
-- O painel apontou 35 chaves sem índice em 19/out/2026, todas em tabelas de
-- poucas centenas de linhas ou menos (as de `participacao` e `sessao` já
-- foram na `0079`). Hoje o Postgres prefere ler essas tabelas inteiras; o
-- índice passa a valer quando elas crescem, e ao apagar a linha do outro lado
-- da chave (conta, pessoa, plano, profissional, usuário), que sem ele varre a
-- tabela que aponta para ela. Custa poucos kB cada.
--
-- Efeito esperado no painel: o aviso de chave sem índice zera, e estes
-- índices aparecem como "não usados" até as tabelas crescerem.
--
-- `participacao_sessao_ix` sai porque `participacao_sessao_pessoa_uk`
-- começa pela mesma coluna e cobre toda busca por sessão.
--
-- Parciais onde a coluna aceita vazio.

set search_path = app_verandi, extensions;

create index if not exists acesso_suporte_usuario_id_fk_ix
  on app_verandi.acesso_suporte (usuario_id);

create index if not exists avaliacao_conta_id_fk_ix
  on app_verandi.avaliacao (conta_id);

create index if not exists avaliacao_profissional_id_fk_ix
  on app_verandi.avaliacao (profissional_id)
  where profissional_id is not null;

create index if not exists avaliacao_foto_conta_id_fk_ix
  on app_verandi.avaliacao_foto (conta_id);

create index if not exists avaliacao_foto_posicao_id_fk_ix
  on app_verandi.avaliacao_foto (posicao_id);

create index if not exists chave_api_criada_por_usuario_id_fk_ix
  on app_verandi.chave_api (criada_por_usuario_id)
  where criada_por_usuario_id is not null;

create index if not exists contrato_criado_por_usuario_id_fk_ix
  on app_verandi.contrato (criado_por_usuario_id)
  where criado_por_usuario_id is not null;

create index if not exists contrato_plano_id_fk_ix
  on app_verandi.contrato (plano_id);

create index if not exists convite_aceito_por_usuario_id_fk_ix
  on app_verandi.convite (aceito_por_usuario_id)
  where aceito_por_usuario_id is not null;

create index if not exists convite_criado_por_usuario_id_fk_ix
  on app_verandi.convite (criado_por_usuario_id)
  where criado_por_usuario_id is not null;

create index if not exists envio_de_recibo_conta_id_fk_ix
  on app_verandi.envio_de_recibo (conta_id);

create index if not exists envio_de_recibo_enviado_por_usuario_id_fk_ix
  on app_verandi.envio_de_recibo (enviado_por_usuario_id)
  where enviado_por_usuario_id is not null;

create index if not exists espera_pessoa_id_fk_ix
  on app_verandi.espera (pessoa_id);

create index if not exists evento_saida_conta_id_fk_ix
  on app_verandi.evento_saida (conta_id);

create index if not exists local_conta_id_fk_ix
  on app_verandi.local (conta_id);

create index if not exists log_configuracao_por_usuario_id_fk_ix
  on app_verandi.log_configuracao (por_usuario_id)
  where por_usuario_id is not null;

create index if not exists onboarding_conta_id_fk_ix
  on app_verandi.onboarding (conta_id);

create index if not exists pagamento_registrado_por_usuario_id_fk_ix
  on app_verandi.pagamento (registrado_por_usuario_id)
  where registrado_por_usuario_id is not null;

create index if not exists pausa_conta_id_fk_ix
  on app_verandi.pausa (conta_id);

create index if not exists pendencia_dispensada_dispensado_por_usuario_id_fk_ix
  on app_verandi.pendencia_dispensada (dispensado_por_usuario_id)
  where dispensado_por_usuario_id is not null;

create index if not exists pessoa_tag_conta_id_fk_ix
  on app_verandi.pessoa_tag (conta_id);

create index if not exists plano_servico_id_fk_ix
  on app_verandi.plano (servico_id);

create index if not exists preferencia_home_usuario_id_fk_ix
  on app_verandi.preferencia_home (usuario_id);

create index if not exists profissional_usuario_id_fk_ix
  on app_verandi.profissional (usuario_id)
  where usuario_id is not null;

create index if not exists profissional_servico_servico_id_fk_ix
  on app_verandi.profissional_servico (servico_id);

create index if not exists recibo_contrato_id_fk_ix
  on app_verandi.recibo (contrato_id)
  where contrato_id is not null;

create index if not exists recibo_emitido_por_usuario_id_fk_ix
  on app_verandi.recibo (emitido_por_usuario_id)
  where emitido_por_usuario_id is not null;

create index if not exists recibo_substitui_id_fk_ix
  on app_verandi.recibo (substitui_id)
  where substitui_id is not null;

create index if not exists serie_local_id_fk_ix
  on app_verandi.serie (local_id)
  where local_id is not null;

create index if not exists serie_profissional_id_fk_ix
  on app_verandi.serie (profissional_id)
  where profissional_id is not null;

create index if not exists serie_servico_id_fk_ix
  on app_verandi.serie (servico_id);

create index if not exists servico_conta_id_fk_ix
  on app_verandi.servico (conta_id);

create index if not exists usuario_conta_conta_id_fk_ix
  on app_verandi.usuario_conta (conta_id);

create index if not exists vaga_conta_id_fk_ix
  on app_verandi.vaga (conta_id);

create index if not exists vaga_pessoa_id_fk_ix
  on app_verandi.vaga (pessoa_id);

drop index if exists app_verandi.participacao_sessao_ix;  -- coberto por participacao_sessao_pessoa_uk (sessao_id, pessoa_id)
