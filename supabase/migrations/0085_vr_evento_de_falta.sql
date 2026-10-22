-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A falta sem aviso vira evento (a ponte com o AutoFluxos).
 *
 * É a hora de o AutoFluxos escrever "sentimos sua falta, quer marcar a
 * reposição?", que é o que segura aluno. Só acrescenta um tipo à lista: nada
 * muda nos eventos que já existem, e conta sem webhook ativo nem enfileira.
 */
alter table evento_saida
  drop constraint evento_saida_tipo_check,
  add constraint evento_saida_tipo_check check (tipo in
    ('participacao.criada', 'participacao.cancelada', 'sessao.cancelada',
     'vaga.aberta', 'presenca.falta'));
