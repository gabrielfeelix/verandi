# Banco de produção compartilhado — leitura obrigatória

> **Pare antes de mexer no banco.** Desde 14/ago/2026, Verandi e AutoFluxos
> usam o mesmo projeto Supabase de produção. São produtos diferentes e não
> compartilham tabelas de domínio, mas compartilham Postgres, Auth, Storage,
> extensões, Data API, cotas e o destino de backup.

Este documento é a fonte de verdade do lado da Verandi. Deve ser lido antes de
qualquer alteração em migration, Supabase, autenticação, RLS, Storage,
extensão, função SQL, view ou configuração da Data API.

## O mapa atual

| Produto | Onde moram os dados | Autenticação atual | Isolamento interno |
|---|---|---|---|
| **Verandi** | schema `app_verandi` | Supabase Auth | `conta_id` + RLS com políticas por usuário e papel |
| **AutoFluxos** | schema `public` | senha única do painel; banco acessado no servidor com chave secreta | RLS ligada e sem políticas; só o servidor acessa |

Schema separa **produto de produto**. RLS separa **conta de conta** dentro da
Verandi. Nenhum substitui o outro.

## Regras que não podem ser quebradas

1. **Nunca rode `supabase db push`, `supabase db reset` ou outro comando de
   reconciliação contra produção.** `supabase db reset` continua válido apenas
   no Supabase local da Verandi.
2. **Toda migration da Verandi começa com
   `set search_path = app_verandi, extensions`.** `public` fica fora do caminho
   de propósito. Objeto de domínio deve ser criado em `app_verandi`.
3. **Nunca leia, altere, referencie ou crie dependência contra tabelas de
   `public`.** Elas pertencem ao AutoFluxos. A integração entre os produtos é
   por API/evento, não por consulta cruzada.
4. **Toda criação de cliente Supabase declara
   `db: { schema: ESQUEMA }`.** Vale para servidor, proxy, scripts, testes e
   e2e. Um cliente apontado para o schema padrão pode cair em `public` sem o
   TypeScript perceber.
5. **Migration de produção só passa por
   `node scripts/aplica-em-producao.mjs`.** O controle é
   `app_verandi.migrations_aplicadas`; não use nem altere o histórico global do
   CLI para tentar conciliar os dois repositórios.
6. **O nome da próxima migration vem do diretório.** Hoje a última é `0042`; a
   próxima é `0043`, enquanto nenhuma nova tiver sido criada. Use o formato
   `NNNN_vr_descricao.sql`.
7. **RLS e `GRANT` são camadas diferentes.** Toda tabela de domínio nasce com
   RLS e política por `conta_id`. Tabela técnica sem dono recebe RLS sem política
   e `revoke all from anon, authenticated`.
8. **Função `security definer` precisa de `search_path` fixo e permissões
   mínimas.** View precisa de `security_invoker = true` quando lê dado protegido.
9. **Mudança global exige avaliar os dois produtos antes.** Isso inclui Auth,
   SMTP e redirect do Auth, Storage, extensões, schemas expostos, PostgREST,
   região, rede, limites, backup e restauração.
10. **Segredo nunca entra no repositório, migration, log ou documento.** A
    `service_role` ignora RLS e não é uma fronteira entre os produtos.

## Migrations da Verandi

- `0030_vr_schema_app_verandi.sql` cria a divisória;
- `0031_vr_...` a `0042_vr_...` constroem o produto;
- cada arquivo usa `app_verandi` e termina com os `GRANT`s necessários;
- aplicação incremental em produção:
  `node scripts/aplica-em-producao.mjs`;
- conferência sem aplicar: `node scripts/aplica-em-producao.mjs --dry`;
- controle de versões: `app_verandi.migrations_aplicadas`;
- remoção planejada: `supabase/desfazer-verandi.sql`, que também trata Storage.

O aplicador deve parar diante de qualquer estado ambíguo. Erro de autenticação,
permissão ou rede não significa “banco virgem”. Se a leitura de
`migrations_aplicadas` falhar por motivo diferente de tabela inexistente, a
operação precisa ser interrompida e investigada.

> **Gap conhecido antes da próxima migration de produção:** a implementação
> atual de `jaAplicadas()` captura qualquer erro e devolve conjunto vazio. Antes
> de aplicar a próxima migration, ela precisa distinguir “a tabela ainda não
> existe” de falha de token, permissão, rede ou API. Até isso ser corrigido, uma
> leitura que falhou não pode ser tratada como autorização para reaplicar tudo.

## O que o schema não separa

- **`auth.users`:** a identidade é global. Pertencer ao Auth não concede acesso;
  o vínculo `usuario_conta` e as políticas da Verandi é que autorizam.
- **Configuração do Auth:** cadastro, senha mínima, SMTP, templates e URLs de
  redirect valem para o projeto inteiro. Antes de mudar, conferir o impacto no
  AutoFluxos presente e futuro.
- **Storage:** buckets e `storage.objects` ficam fora de `app_verandi`. Nome de
  bucket/política deve identificar o produto e o roteiro de remoção deve
  limpá-los explicitamente.
- **Extensões:** são globais. Nunca remover sem conferir o outro produto.
- **Data API/PostgREST:** `app_verandi` precisa permanecer exposto. Alterar a
  lista de schemas ou recarregar o cache tem raio de impacto compartilhado.
- **Operação:** CPU, conexões, tamanho, cotas, indisponibilidade, backup e
  restauração afetam os dois.
- **Desastre:** no plano gratuito não há PITR. Um erro destrutivo pode atingir
  ambos e restaurar significa restaurar o projeto inteiro.

## Checklist antes de qualquer alteração de banco

- [ ] Li este documento e o estado atual do AutoFluxos.
- [ ] Confirmei `git status` e preservei trabalho local.
- [ ] Descobri a última migration pelo diretório.
- [ ] Confirmei `app_verandi` como destino de cada objeto de domínio.
- [ ] Confirmei que não há referência a tabela de `public`.
- [ ] Avaliei efeitos globais em Auth, Storage, extensões e Data API.
- [ ] Defini `GRANT`, RLS, políticas e `search_path`.
- [ ] Rodei testes locais e o aplicador com `--dry`.
- [ ] Só pedi aplicação em produção depois de revisar o SQL completo.
- [ ] Verifiquei Verandi e AutoFluxos depois da aplicação.

## Quando separar os projetos

O compartilhamento é temporário e motivado por custo. Ele deixa de ser
aceitável quando houver cliente pagante, exigência de backup/isolamento, volume
que faça um produto afetar o outro ou necessidade de credenciais
administrativas realmente separadas.

Na separação, tratar também `auth.users`, Storage, extensões, Data API, secrets e
os objetos do AutoFluxos que ainda vivem em `public`. Hoje não existe
`app_autofluxos`, então um roteiro que mande apenas derrubar esse schema está
incompleto.
