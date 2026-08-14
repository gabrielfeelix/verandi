-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * Os padrões da conta e o que faltava no catálogo.
 *
 * Vieram do protótipo, que é a especificação: seção Padrões da Configuração,
 * capacidade do local, e a escolha do que fazer com as sessões de um dia
 * fechado.
 */

-- ---------------------------------------------------------------------------
-- Padrões da conta
-- ---------------------------------------------------------------------------

/*
 * Colunas em `conta`, não uma tabela chave-valor: são seis, são tipadas, e o
 * banco checa cada uma. Chave-valor guarda "quatro" numa coluna de texto e
 * descobre no dia em que alguém digita errado.
 */
alter table conta
  add column capacidade_padrao     integer not null default 4
    check (capacidade_padrao > 0),
  add column duracao_padrao_min    integer not null default 50
    check (duracao_padrao_min > 0),
  -- folga entre uma sessão e a próxima: gera o próximo horário sugerido e
  -- impede a busca de vaga oferecer encaixe colado
  add column intervalo_min         integer not null default 10
    check (intervalo_min >= 0),
  -- até quando o crédito de uma falta pode ser usado. Sem prazo, "reposição em
  -- aberto" nunca sai da lista, e lista que não zera vira ruído
  add column prazo_reposicao_dias  integer not null default 60
    check (prazo_reposicao_dias > 0),
  /*
   * Encaixe acima da capacidade.
   *
   * Vale para a pessoa na recepção decidindo abrir exceção — nunca para a API
   * do bot, que continua sem enxergar horário cheio de qualquer jeito. 5/4 é um
   * estado que alguém criou de propósito, com nome e registro.
   */
  add column encaixe_acima         boolean not null default true,
  -- falta avisada gera crédito de reposição? A opção "só com 3h de
  -- antecedência" do protótipo espera o marco 2: hoje não guardamos quando a
  -- pessoa avisou, só quando a recepção digitou
  add column credito_falta_avisada boolean not null default true,
  -- os chips de horário da tela de série. Campo livre continua existindo
  add column horarios_sugeridos    time[] not null default
    array['07:00','08:00','09:00','10:00','11:00',
          '17:00','18:00','19:00','20:00']::time[];

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

/*
 * Quantas pessoas cabem na sala.
 *
 * É o limite físico atrás do limite comercial, e ficou mais útil agora que
 * encaixe acima da capacidade é permitido: serve de aviso ("a Sala 2 comporta
 * 4"), nunca de bloqueio. Anulável porque nem todo negócio conta lugar.
 */
alter table local
  add column capacidade integer check (capacidade > 0);

/*
 * O que fazer com as sessões de um dia fechado.
 *
 * `cancelar_avisar` cancela as sessões daquele dia e libera crédito para quem
 * tinha vaga fixa; `so_marcar` deixa a agenda como está e apenas sinaliza o
 * dia. Sem essa escolha, marcar um feriado depois que a semana já foi aberta
 * deixava sessão órfã na grade.
 */
alter table excecao_calendario
  add column acao text not null default 'cancelar_avisar'
    check (acao in ('cancelar_avisar', 'so_marcar'));

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
