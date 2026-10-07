set search_path = app_verandi, extensions;

/*
 * Aula experimental como origem própria.
 *
 * Quem chega pela primeira vez entrava como "avulso", e o estúdio precisa ver
 * a diferença: experimental é quem está conhecendo, avulso é quem paga uma
 * aula solta. A cobrança segue a da avulsa (valor opcional, na hora de marcar).
 */
alter type origem_participacao add value if not exists 'experimental' after 'avulso';

/*
 * Aluno que vem pelo Gympass/Wellhub.
 *
 * Uma marca no cadastro, e não etiqueta: etiqueta é condição de saúde
 * ("lesão", "gestante") e é livre por conta; convênio é como a pessoa paga.
 */
alter table pessoa add column if not exists gympass boolean not null default false;
