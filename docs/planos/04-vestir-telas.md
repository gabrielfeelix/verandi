# Vestir as telas com o design system novo

Estado em 13/08/2026. Branch `design-system-novo`, já mesclada em `main`.

O design system novo (`Design system Verandi-att/DESIGN-SYSTEM.md`) passou a ser
a fonte de verdade. Os tokens e primitivos já estão aplicados no produto inteiro;
o que **falta é a comparação tela a tela com o protótipo**, que é onde as
diferenças de layout aparecem.

## O método, use este, não outro

Ler o código do protótipo não substitui olhar a tela renderizada. Foi esse
atalho que produziu telas "com os tokens certos" e nenhuma semelhança com o
desenho.

```bash
npx supabase start && node scripts/semear-dev.mjs
npm run dev                                   # noutro terminal
node scripts/tira-prototipo.mjs .prototipo    # protótipo, 1440×1000
node scripts/tira-produto.mjs .produto        # produto, mesma viewport
```

Depois, **para cada tela**: abrir as duas capturas lado a lado → escrever a lista
de diferenças (estrutura, posição, hierarquia, tamanho de fonte, o que falta) →
corrigir → recapturar → comparar de novo. Só passar adiante quando bater.

A marcação de cada tela está em `Design system Verandi-att/Verandi.dc.html`,
com o estilo literal embutido em cada elemento. `grep -n "Vagas recorrentes"`
leva direto ao trecho.

**Escopo combinado com o Gabriel:** construir os blocos que faltam, não só
rearranjar o que existe. Onde não houver dado no banco, dizer e deixar o bloco
de fora, nunca inventar número.

## Feito

| Tela | O que mudou |
|---|---|
| **Ficha da pessoa** | ações saíram de dentro do bloco de conteúdo para o canto superior direito (Agendar · Editar dados · Marcar inativa); entraram as abas Agenda/Histórico/Reposições/Perfil; entrou a coluna direita (Atenção na aula, Contato, Plano, Em números); Histórico ganhou a faixa das 12 semanas |
| **Buscar vaga** | 9469px → 4901px; período em campos de data virou faixa de dias em chips; padrão caiu de 14 para 7 dias; entraram turno e local; o lotado saiu da lista separada e entrou na mesma lista atrás do interruptor "incluir lotados" |
| **Hoje** | já estava perto; só a pilha de avatares aparecia cortada |
| **Sessão** | as ações saíram da coluna e foram para o canto do cabeçalho (Marcar todos presentes · Encaixar · cancelar); entrou a nota de registro sob o título; cada linha ganhou **por que a pessoa está ali** (`vaga fixa desde março`, `repõe a falta de 05/06 · Solo 07:00`); entrou o **Histórico da turma**; o Resumo passou a ter os quatro estados do protótipo; a barra do rodapé ganhou as duas ações. O painel "Vagas" virou **modal de encaixe** (com a capacidade do dia dentro) e **modal de cancelar** |
| **Alunos** | subtítulo com ativos/inativos; chip "Todos" e contagem em cada chip; chips das etiquetas da conta, vindos de `pessoa_tag`; botão **Exportar** (CSV do filtro atual); `id 1042` sob o nome; telefone mascarado; a coluna de horário fixo passou a mostrar o horário, não a contagem; situação `ativa · plano vencendo · faltando · inativa`; a ressalva do inativo colou na paginação |
| **Semana** | faixa "10 – 16 de agosto"; contagem de sessões em cada coluna de dia; hoje em escuro; **Imprimir** com folha de impressão de verdade; marcador **agora** na célula corrente; etiqueta "N salas" nas turmas paralelas; legenda de cinco itens |
| **Grade fixa** | entrou a coluna de 300px com **Capacidade da semana** e a nota sobre encerrar/duplicar; cada linha ganhou **Quem ocupa**; as ações viraram ícone; as datas viraram `desde mar/26`; séries encerradas ganharam Duplicar |
| **Pendências** | cabeçalho de grupo com o número em 30px; **verbo específico** em cada botão (Marcar chamada · Agendar reposição · Encaixar · Completar); corte em três itens com "Ver as outras N"; `esvaziado hoje`; **Exportar**; coluna direita com Resumo e a nota. De 4551px para ~1000px |
| **Configuração** | **Aberto/Fechado virou interruptor deslizante** (`role="switch"`), semana começando na segunda; **Locais** virou fileira de chips; **Usuários** recolheu as ações no menu ⋮; **Padrões** ganhou "última alteração em DD/MM por fulano", de `log_configuracao` |
| **Contas 4YU** | cabeçalho com Log de suporte e Nova conta; tabela com colunas; `criada em ago/26`; Entrar mais menu ⋮; o log virou modal; o aviso foi para o fim |

## Blocos do protótipo que **não** dá para construir hoje

Não são esquecimento; falta dado. Se forem construídos, precisam de migration
antes:

- **"Últimas buscas"** na Vaga, precisa guardar busca por usuário.
- **"Últimas ações"** na ficha, precisa de log por pessoa; o `src/server/log.ts`
  hoje só cobre configuração.
- **Telas de acesso `esqueci`, `enviado` e `nova senha`**, dependem de SMTP,
  marco 2. A arte e os textos já estão prontos em
  `src/components/ui/arte-acesso.ts`, esperando.
- **"Só com 3h de antecedência"** em Padrões, exige saber a que horas a pessoa
  avisou; hoje só se sabe quando a recepção registrou.
- **Plano da conta** em Contas 4YU (o "Padrão · criada em mar/24" do protótipo) ,
  não existe coluna de plano. A tela mostra o identificador e a data de criação.
- **Seção Integrações** da configuração, não há nada para integrar ainda.

## Armadilhas que já custaram caro

1. **`rounded-[--radius-x]` não existe no Tailwind v4.** Vira
   `border-radius: --radius-x` e o navegador descarta calado, o app rodou sem
   canto arredondado nenhum e nada acusou. Token de `@theme` gera utilitário
   próprio: `rounded-cartao`, `shadow-modal`. Há quatro testes em
   `e2e/primitivos.spec.ts` que medem estilo computado e falham se voltar.
2. **`tsc` e os testes não veem CSS.** Antes de dizer que uma tela ficou pronta,
   medir com `getComputedStyle` no navegador.
3. **Data em teste com `toISOString()` é UTC**, e a conta vive em
   America/Sao_Paulo. Entre 21h e meia-noite as duas discordam. Use dois dias de
   folga, não um.
4. **O seed morre depois da suíte de navegador.** `npx supabase db reset --local`
   e `node scripts/semear-dev.mjs` de novo antes de capturar. `db reset` falha
   com `LegacyDbSetupError` de vez em quando; rodar de novo resolve.
5. **Constante importada de módulo `'use client'` para componente de servidor
   chega vazia.** O React devolve uma referência de módulo, não o objeto, o
   `tsc` passa, nada quebra, e o elemento some da tela. Foi o que apagou os
   pontos coloridos do "Resumo" de Pendências. Constante compartilhada entre
   servidor e cliente mora em módulo sem diretiva (`components/*/tintas.ts`).
6. **Glifo de texto como ícone de ação some.** O `⌫` do protótipo não existe nas
   três fontes do produto e o navegador substituiu por um desenho de 8px
   ilegível dentro de um botão de 44px. Ícone de ação é SVG do `ui/icones.tsx`;
   glifo só em decoração miúda.
7. **`input[type=time]` segue o locale do navegador, não o `lang` do
   documento.** As capturas rodavam em `en-US` e mostravam "06:30 AM", uma
   diferença falsa contra o protótipo. Os dois scripts de captura fixam
   `locale: 'pt-BR'` e `timezoneId: 'America/Sao_Paulo'`.
8. **`/contas-4yu` é do papel `suporte`.** Capturar essa tela logado como dono
   devolvia a agenda do dia com o nome errado no arquivo. O script sai e entra
   como `suporte@dev.local` no fim.
9. **A suíte e2e inteira fica instável com a máquina carregada.** Falhas
   diferentes a cada rodada, todas passando quando o arquivo roda sozinho.
   Antes de investigar uma falha da suíte cheia, rodar o spec isolado.
