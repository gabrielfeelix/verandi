# Administração da 4YU (`/admin`)

Criada em 02/out/2026. Antes disso, o admin era um item "Contas (4YU)" no menu
do estúdio, e tudo que não fosse criar, entrar ou suspender conta (trocar senha,
dar acesso de admin, achar em que conta alguém trabalha) era SQL direto no
banco de produção.

## Quem é admin

Admin é quem tem vínculo `suporte`, ativo, na **conta interna** (`conta.interna =
true`, slug `4yu`). A checagem é `ehSuporte` em
`src/server/suporte/consultas.ts`. O vínculo `suporte` que o "Entrar" cria numa
conta de cliente é temporário e **não** faz ninguém admin.

Em 02/out/2026 os admins de produção são `gab.feelix@gmail.com`,
`contato@4yu.com.br` e `yamamotoduarte@gmail.com`.

## Telas

| Rota | O que responde |
|---|---|
| `/admin` | porta; redireciona para a visão geral. É o destino do papel `suporte` (`destinoDoPapel`) |
| `/admin/visao-geral` | contas ativas e suspensas, usuários, admins, suporte em aberto, contas paradas há 7 dias, últimas ações |
| `/admin/contas` | a lista que era `/contas-4yu`: criar conta, entrar, suspender. O nome abre o detalhe |
| `/admin/contas/[id]` | abas Dados (nome e fuso editáveis), Pessoas (quem tem acesso, convites pendentes, link de senha) e Log; zona de perigo com suspender |
| `/admin/usuarios` | todo usuário da Verandi: contas e papel de cada um, último acesso. Ações: link de senha, dar e tirar admin, suspender e devolver acesso, novo admin |
| `/admin/log` | entradas em conta de cliente (início e fim) e cada ação da administração, com o e-mail de quem fez |
| `/suspensa` | onde para a equipe de uma conta suspensa |
| `/contas-4yu` | endereço antigo; redireciona para `/admin/contas` mantendo a busca |

O layout de `/admin` (`src/app/admin/layout.tsx`) tem menu próprio e barra a
entrada de quem não é admin, mandando para `/hoje?restrita=Administração`. **Ele
protege só as telas.** Cada ação em `src/server/admin/acoes.ts` confere
`ehSuporte` de novo, porque ação de servidor é endereço público.

No estúdio, o item "Contas (4YU)" saiu do menu. O admin que cai na conta interna
pelo `(app)` vai direto para `/admin`. Dentro de conta de cliente a faixa âmbar
continua, e "Sair do suporte" volta para `/admin/contas`.

## Decisões, e por quê

- **Sem migration.** As ações sobre usuário vão para `log_configuracao` com
  `entidade = 'usuario_conta'`, presas à conta interna (a tabela exige
  `conta_id`), com `detalhe.porSuporte = true` e a frase pronta em
  `detalhe.oQue`. Os `check` de `entidade` e `acao` não mudaram.
- **Suspender usuário é banir no Auth** (`ban_duration`), não desligar vínculo.
  Barra o login e a renovação da sessão; quem estava dentro sai quando o token
  vence, em até uma hora. Devolver o acesso devolve todos os vínculos como
  estavam. É seguro só porque **o AutoFluxos não usa o Auth do Supabase** (tem
  Better Auth, tabelas `af_*`): em 02/out/2026 os 4 usuários do Auth tinham
  vínculo na Verandi. Se o AutoFluxos passar a usar o Auth, revisar isto.
- **Admin não suspende a si mesmo nem outro admin**: tira o admin antes. E a
  plataforma nunca fica sem admin (sem nenhum, só `scripts/bootstrap-suporte.mjs`
  cria o próximo).
- **Novo admin** com e-mail já existente só ganha o vínculo, e a senha não muda.
  E-mail novo nasce confirmado, com a senha digitada pelo admin, porque `suporte`
  não é papel convidável (`PAPEIS_CONVIDAVEIS`).
- **Link de senha** é o mesmo convite `tipo: 'senha'` do "esqueci a senha",
  válido por 24 horas, e revoga os links anteriores. Ele tenta mandar por e-mail
  e sempre mostra o link, para mandar pelo WhatsApp.
- **Equipe da conta não se gerencia no admin.** Convidar, trocar papel e remover
  ficam na Configuração do estúdio, onde vale a regra de "sempre sobra um dono".
  O admin chega lá pelo "Entrar como suporte". Duas portas para a mesma regra
  seriam dois lugares para quebrá-la.
- **Conta suspensa agora bloqueia.** Antes, suspender só mudava `conta.ativo`, e
  a única coisa que olhava para isso era a chave da API. Agora `exigirConta`
  (`src/server/conta.ts`) manda para `/suspensa` quem não é suporte. O suporte
  passa, para diagnosticar e reativar. A barreira é na aplicação; a RLS
  (`tem_papel`) não olha `conta.ativo`.
- **Leituras paginadas.** O PostgREST corta resposta em 1000 linhas sem avisar;
  `listarUsuarios` e `resumoDaPlataforma` leem de mil em mil (`todas()` em
  `src/server/admin/consultas.ts`). No banco local, com mais de 1000 vínculos,
  a busca não achava usuário novo antes disso.

## O que o AutoFluxos tem e ficou de fora, de propósito

- **Planos, pedidos e consumo:** a Verandi ainda não cobra por plano.
- **Matriz de funções e capacidades:** quatro papéis fixos bastam para estúdio.
- **"Entrar como" outro usuário** (impersonar): entrar na conta resolve.
- **Excluir usuário:** suspender cobre o caso sem apagar histórico.
- **2FA para admin:** o AutoFluxos exige. Na Verandi ainda não; é o próximo
  passo de segurança desta área (Supabase Auth MFA, TOTP), e precisa de tela de
  cadastro do fator antes de virar obrigatório, senão tranca os admins de fora.

## Como foi testado (02/out/2026)

Build de produção local (`npm run build` + `next start`) contra o Supabase local:

- `e2e/suporte.spec.ts`, 8 de 8; `e2e/entrar.spec.ts`, 6 de 6 (o suporte cai em
  `/admin/visao-geral`).
- `tests/unit/destino.test.ts` e `tests/acesso.test.ts`, 10 de 10.
- Roteiro manual automatizado com 23 verificações conferidas no banco: criar,
  tirar e devolver admin; suspender e devolver usuário (e o suspenso não entra);
  link de senha; editar conta e recusar fuso inválido; suspender conta (o dono
  cai em `/suspensa`) e reativar; entrar e sair do suporte; `/contas-4yu` com
  busca; dono barrado em `/admin`.
- O `e2e/suporte.spec.ts` estava quebrado desde `17fe970` (o convite passou a
  pedir "Seu nome"); corrigido junto.
