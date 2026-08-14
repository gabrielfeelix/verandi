/**
 * O schema onde a Verandi mora dentro do Postgres.
 *
 * Não é `public` porque, enquanto não há cliente pagante, o banco de produção é
 * dividido com o AutoFluxos — o porquê está inteiro em
 * `supabase/migrations/0030_vr_schema_app_verandi.sql`.
 *
 * Fica num módulo sem dependência nenhuma de propósito: o `proxy.ts` roda no
 * middleware, e importar dali o cliente do Supabase engordaria o pacote que
 * roda a cada requisição.
 *
 * Não vire isto em variável de ambiente. Schema diferente entre a máquina de
 * quem desenvolve e a produção é a classe de bug que só aparece depois do
 * deploy, e o ganho seria zero: o nome é estrutura, não configuração.
 */
export const ESQUEMA = 'app_verandi'
