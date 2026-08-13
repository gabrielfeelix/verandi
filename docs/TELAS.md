# Verandi — as telas

O que cada tela **serve para fazer**, o que ela mostra e o que é possível fazer
nela. Não decide visual: nada aqui diz onde fica botão, que cor tem, que fonte
usa. Isso é escolha de quem desenhar.

As entidades citadas (`pessoa`, `sessao`, `participacao`, `serie`...) estão
definidas em [ARQUITETURA.md](ARQUITETURA.md).

---

## Regras que valem em todas as telas

**Rótulo é traduzido, sempre.** Nenhuma tela escreve "pessoa" ou "sessão" para o
usuário. Ela lê o `vocabulario` da conta e escreve "Aluno", "Cliente" ou
"Paciente". Quem desenha deve tratar todo nome de entidade como texto variável,
não como palavra fixa no layout — inclusive no plural e no cabeçalho de coluna.

**A porta de entrada depende do papel.** `profissional` cai em **Hoje**;
`dono` e `recepcao` caem em **Grade da semana**; `suporte` cai em **Contas**.
Ninguém escolhe onde começar — o sistema já sabe.

**Celular é o caso real, não o caso reduzido.** A tela de sessão é usada em pé,
numa sala, com a mão ocupada. Grade da semana é a única que assume tela larga; em
celular ela vira um dia por vez. Todas as outras funcionam iguais nos três
tamanhos.

**Lotada é lotada — e abrir vaga é uma ação, não um contorno.** Horário cheio não
aparece como disponível, nem na tela nem para o bot. Para caber mais um, o
profissional **aumenta a capacidade daquela sessão**, e aí a vaga existe de
verdade. Nenhuma tela deve oferecer "encaixar mesmo assim": ou a capacidade sobe,
ou não cabe.

**Fora capacidade, nada bloqueia.** Data passada aceita registro. Sessão
cancelada aceita correção. Pessoa sem telefone é normal — 30% não têm. A única
recusa do banco é a mesma pessoa duas vezes na mesma sessão.

**Desfazer, não confirmar.** Nenhuma ação de registro pede confirmação: ela
acontece e oferece desfazer. Pedem confirmação só as três destrutivas — cancelar
sessão, remover pessoa da série, revogar token.

**Ocupação é sempre visível no formato `ocupadas/capacidade`.** Quando passa da
capacidade, o número continua aparecendo (`5/4`) com destaque de alerta. Nunca
esconder, nunca truncar.

**Vazio é estado de projeto, não acidente.** Conta nova não tem série, pessoa nem
sessão. Toda lista precisa de um estado vazio que diga o que fazer em seguida, e
o caminho mais curto para a primeira ação.

**Toda ação registra quem fez.** Não precisa aparecer na tela principal, mas
precisa existir e ser visível no histórico da pessoa e da sessão.

---

## 1. Entrar

**Serve para** dar acesso a quem já foi convidado. Não existe cadastro público:
conta nova é criada pela 4YU, usuário novo entra por convite.

**Quem usa:** todos.

**Mostra:** marca, campo de e-mail, campo de senha, link de "esqueci a senha".

**Dá para:** entrar; pedir redefinição de senha.

**O que importa:** erro de senha nunca revela se o e-mail existe. Depois de
entrar, o destino é decidido pelo papel — quem tem uma conta só nunca vê a tela
de escolher conta.

---

## 2. Convite e definir senha

**Serve para** transformar um convite em acesso.

**Quem usa:** profissional ou recepção recém-convidado; dono de conta nova.

**Mostra:** nome de quem convidou, nome da conta, papel que a pessoa vai receber,
campo de nome e de senha.

**Dá para:** aceitar o convite definindo a senha.

**O que importa:** o convite mostra **qual conta e qual papel** antes de aceitar —
sem isso a pessoa não sabe no que está entrando. Convite expira, e o estado
expirado precisa de mensagem que diga o que fazer (pedir outro para quem
convidou), não um erro genérico.

---

## 3. Trocar de conta

**Serve para** escolher em qual negócio trabalhar, quando a pessoa pertence a mais
de um.

**Quem usa:** quem tem duas contas ou mais — a professora que atende dois
estúdios, e o suporte da 4YU.

**Mostra:** lista de contas com nome e papel em cada uma.

**Dá para:** entrar numa conta; voltar a trocar depois, de qualquer tela.

**O que importa:** quem tem uma conta só **nunca vê esta tela**. A conta ativa
precisa ficar visível em todas as telas depois — operar na conta errada é o erro
mais caro que este sistema permite, e ele é silencioso.

---

## 4. Hoje

**Serve para** responder, em um olhar, "o que eu tenho pela frente e o que já
fiz". É a casa do profissional.

**Quem usa:** `profissional` como tela inicial; `dono` e `recepcao` como atalho.

**Mostra:** as sessões do dia, em ordem de horário. Cada uma traz horário,
serviço, local, profissional (quando quem olha vê a agenda de mais de um),
ocupação `3/4`, e o estado da chamada: **pendente**, **feita** ou **cancelada**.
Separa visualmente o que já passou do que ainda vem, e indica qual é a próxima.

**Dá para:** abrir uma sessão; trocar o dia (ontem, amanhã, escolher data);
para dono e recepção, alternar entre "minha agenda" e "todos os profissionais".

**O que importa:** a informação que mais vale é **quais chamadas estão pendentes**
— é o que a professora esquece. Sessão cancelada continua aparecendo, riscada e
com o motivo, porque sumir gera a pergunta "cadê a aula das 10h".

Dia sem sessão nenhuma é comum (domingo, feriado) e precisa dizer isso com
naturalidade, não parecer erro de carregamento.

---

## 5. Sessão

**Serve para** ver e resolver tudo de um horário específico: quem está, quem veio,
quem entra, quem sai. **É a tela mais usada do sistema e a que decide se ele
substitui a planilha.**

**Quem usa:** `profissional` para registrar; `recepcao` e `dono` para gerir.

**Mostra:**
- cabeçalho: data, horário, serviço, profissional, local, ocupação `3/4`, e o
  estado da sessão
- a lista de participações, cada linha com nome da pessoa, **origem** (recorrente,
  avulso, reposição, encaixe, reserva), **status** atual, e as marcas que a pessoa
  carrega — tag (gestante), observação, telefone ausente
- quando a participação é reposição, **de qual falta ela veio**
- quem registrou a chamada e quando, se já foi feita

**Dá para:**
- **marcar todos como presentes de uma vez** — é a ação principal, porque no dado
  real 140 de 235 registros são presença
- mudar o status de uma pessoa: presente, falta, falta avisada, licença
- **encaixar alguém** — busca uma pessoa existente ou cadastra na hora, escolhendo
  a origem (avulso, reposição, encaixe, reserva). Se estiver lotada, esta ação só
  fica disponível depois de aumentar a capacidade
- **aumentar ou diminuir a capacidade só desta sessão** — não mexe na grade fixa
  nem nas outras semanas
- quando é reposição, apontar **qual falta** está sendo reposta, a partir das
  faltas em aberto daquela pessoa
- remover uma participação
- escrever observação numa participação
- **cancelar a sessão inteira** com motivo (o que dispara notificação)
- trocar o profissional só daquela sessão
- desfazer a última ação

**O que importa:**

Registrar a chamada de uma turma de quatro pessoas tem que caber em **um toque
mais as exceções**. Sessões são pequenas — de 1 a 4 pessoas no caso real — então
o caminho comum é "todos vieram, menos uma". Se isso exigir quatro toques em
vez de dois, a planilha ganha.

A **origem** precisa ser distinguível de relance. Quem está na vaga fixa e quem
está de encaixe são situações diferentes para quem dá a aula, e hoje a planilha
resolve isso por posição — os fixos numerados em cima, os avulsos escritos
embaixo. A tela precisa preservar essa leitura.

Chamada de sessão futura não faz sentido e não deve ser oferecida como ação
principal — mas também não pode ser proibida, porque adiantar acontece.

**Tolerância a rede ruim é requisito, não refinamento.** A tela é usada em sala,
com sinal fraco. O registro aparece aplicado na hora e sincroniza depois; se
falhar, avisa sem perder o que foi digitado.

Cancelar sessão é a única ação desta tela que pede confirmação — e a confirmação
precisa dizer **quantas pessoas serão avisadas**.

---

## 6. Grade da semana

**Serve para** ver a operação inteira de uma vez. É a substituta direta da
planilha, e é a tela que faz o cliente aceitar largar o Excel.

**Quem usa:** `dono` e `recepcao` como tela inicial.

**Mostra:** a semana em grade — dias como colunas, horários como linhas. Cada
célula traz serviço, profissional, ocupação `3/4` e sinal de sessão cancelada ou
lotada. Dias de feriado ou fechamento vêm marcados na coluna inteira.

**Dá para:** navegar entre semanas; ir para uma data; filtrar por profissional,
serviço ou local; abrir uma sessão; criar um horário avulso num espaço vazio;
imprimir ou exportar a semana.

**O que importa:**

O caso real é **70 horários por semana**. A grade precisa aguentar essa densidade
sem virar rolagem infinita — o valor dela é justamente caber num olhar.

Em celular, grade de sete colunas não funciona: vira **um dia por vez**, com
navegação lateral entre dias. Não é degradação, é a forma correta no tamanho
pequeno.

O filtro por profissional é o mais usado, porque a pergunta frequente é "como
está a semana da Marina".

Exportar/imprimir parece secundário e não é: o negócio tem uma folha na parede há
anos, e tirar isso de uma vez é o tipo de perda que faz o cliente voltar atrás.

---

## 7. Buscar vaga

**Serve para** responder "quando tem horário para essa pessoa?" — a pergunta que a
recepção atende no telefone, e a mesma que o bot faz pela API.

**Quem usa:** `recepcao` e `dono`. A mesma lógica serve o endpoint
`/api/v1/disponibilidade`.

**Mostra:** os horários livres dentro de um período, considerando serviço,
profissional e local escolhidos. Cada resultado traz dia, horário, profissional,
local e quantas vagas restam.

**Dá para:** escolher serviço, profissional, local e faixa de dias/horários;
marcar direto a partir de um resultado; ver, numa lista à parte, os horários
**cheios** — que não são resultado de busca, e sim candidatos a ter a capacidade
aumentada por quem pode.

**O que importa:**

**Cheio não é resultado.** Esta é a regra mais importante desta tela, e ela é a
mesma para o bot: se a turma tem cinco vagas e cinco pessoas, aquele horário
simplesmente não aparece como opção. Mostrar o cheio junto com o livre é o que
faz a recepção prometer vaga que não existe.

Os cheios aparecem separados, rotulados como tal, e a única coisa que dá para
fazer a partir dali é ir até a sessão e aumentar a capacidade — decisão que é do
profissional, não de quem está atendendo o telefone.

Esta tela e o endpoint `/api/v1/disponibilidade` **têm que dar a mesma
resposta**. Divergência entre o que a recepção vê e o que o bot diz é o defeito
que destrói a confiança no sistema inteiro. A lógica mora no `core/`, e as duas
pontas chamam ela.

---

## 8. Novo agendamento

**Serve para** colocar uma pessoa num horário. É fluxo, não tela de menu: chega
sempre com contexto já preenchido.

**Quem usa:** `recepcao` e `dono`; `profissional` dentro da própria agenda.

**Chega de três lugares**, e cada um preenche uma parte:
- da **Sessão** → o horário já está escolhido, falta a pessoa
- da **ficha da Pessoa** → a pessoa já está escolhida, falta o horário
- da **Buscar vaga** → os dois já estão escolhidos, falta confirmar

**Mostra:** a pessoa (com busca ou cadastro na hora), o horário escolhido com
serviço, profissional, local e ocupação, e a origem do agendamento.

**Dá para:** buscar pessoa por nome, telefone ou identificador; cadastrar pessoa
nova sem sair do fluxo; escolher a origem; quando é reposição, escolher **qual
falta** está sendo reposta; decidir se é só desta vez ou se vira **vaga
recorrente**.

**Não dá para** confirmar num horário lotado. Se lotou entre escolher e
confirmar, o fluxo avisa e oferece dois caminhos: outro horário, ou pedir aumento
de capacidade a quem pode. Conferir a vaga **na hora de gravar** é obrigatório —
entre mostrar e clicar, alguém pode ter ocupado.

**O que importa:**

A busca de pessoa é o ponto crítico. Nomes se repetem e são escritos de formas
diferentes entre meses — no dado real a mesma pessoa aparece com grafias
distintas. A busca precisa ser tolerante a acento e a nome parcial, e cada
resultado precisa de algo que **desambigue**: telefone, identificador, ou o
horário fixo da pessoa. Escolher a pessoa errada é um erro que só aparece
semanas depois.

"Cadastrar na hora" tem que existir de verdade, com **nome apenas** como mínimo.
Exigir telefone aqui é o jeito mais rápido de fazer a recepção inventar um número.

Quando vira vaga recorrente, a diferença tem que estar clara: **isso ocupa aquele
horário toda semana, por tempo indeterminado.**

---

## 9. Pessoas

**Serve para** encontrar alguém e enxergar a base — quem é atendido, em que
situação.

**Quem usa:** `recepcao` e `dono`; `profissional` restrito a quem ele atende.

**Mostra:** lista com nome, telefone, horário fixo (quando tem), última presença e
situação. Contagem do total.

**Dá para:** buscar; filtrar por **sem telefone**, **sem horário fixo**, **plano
vencendo**, **faltou nas últimas duas**, **inativo**, e por tag; abrir a ficha;
cadastrar pessoa nova; exportar a lista.

**O que importa:**

Os filtros são o motivo desta tela existir — a planilha já dá a lista, o que ela
não dá é "quem está sumindo" e "quem eu não consigo avisar". No dado real, 30% não
têm telefone e 23% não têm identificador; esses recortes são trabalho pendente
visível, não estatística.

Pessoa inativa não some, fica fora do padrão. Quem parou em março precisa
continuar existindo no histórico de março.

---

## 10. Ficha da pessoa

**Serve para** ver tudo de uma pessoa num lugar: quem é, quando vem, e o que
aconteceu.

**Quem usa:** todos, com o que cada papel pode ver.

**Mostra:**
- identificação: nome, telefone, e-mail, identificador, nascimento, tags,
  observação livre
- **vagas recorrentes**: quais horários fixos ela ocupa, desde quando
- **próximas sessões** dela
- **histórico**: sessões passadas com o status de cada uma, em ordem
- **reposições em aberto**: faltas que geraram crédito e ainda não foram usadas
- vencimento de plano, como data que avisa — sem valor, sem cobrança

**Dá para:** editar dados e tags; escrever observação; agendar (leva ao fluxo 8);
criar ou encerrar vaga recorrente; marcar como inativa; ver e usar uma reposição
em aberto.

**O que importa:**

Esta ficha é a **linha entre agenda e CRM**, e ela é traçada aqui de propósito:
entra histórico, tag, observação e contato. Não entra funil, negociação,
proposta, valor nem cobrança. Quando alguém pedir "só um campinho de valor pago",
a resposta é que isso é o produto financeiro, e ele é outro.

Encerrar uma vaga recorrente **não apaga o passado**. A vaga tem vigência; sair do
horário das 7h em agosto não pode reescrever março.

O histórico é o que responde "ela vem mesmo?" — a pergunta que hoje se responde
folheando meses de planilha.

---

## 11. Pendências

**Serve para** ser a primeira tela do dia de quem opera: o que exige ação humana
hoje.

**Quem usa:** `recepcao` e `dono`.

**Mostra**, em grupos, cada um com contagem:
- **chamadas não feitas** — sessões que já passaram e ninguém registrou
- **reposições em aberto** — faltas com crédito não usado, com há quanto tempo
- **reservas esperando** — quem pediu horário que estava cheio
- **planos vencendo** — nos próximos dias
- **cadastros incompletos** — sem telefone, sem identificador
- **falhas de envio** — notificação que não saiu

**Dá para:** ir direto ao item; resolver o que dá para resolver dali (agendar a
reposição, marcar a chamada); dispensar um item com motivo.

**O que importa:**

Cada grupo aqui é uma coisa que a planilha perde. Reposição em aberto hoje vive na
memória de quem escreveu `REP 05/6` numa célula — e some quando essa pessoa entra
de férias.

A lista precisa ser **esvaziável**. Pendência que nunca zera vira ruído e a pessoa
para de abrir a tela; por isso dispensar com motivo existe.

Reposição em aberto precisa mostrar **há quanto tempo** — crédito de seis meses
atrás é uma conversa diferente de crédito da semana passada.

---

## 12. Grade fixa

**Serve para** montar e manter a estrutura que se repete: quais horários existem,
com quem, onde, para quantos. É configuração — usada muito no começo e pouco
depois.

**Quem usa:** `dono`; `recepcao` só lê.

**Mostra:** as séries agrupadas por dia da semana, cada uma com horário, serviço,
profissional, local, capacidade, quantas vagas estão ocupadas e a vigência.
Séries encerradas ficam separadas.

**Dá para:** criar série; editar; duplicar (montar a semana inteira é repetir com
variação); encerrar a partir de uma data; ver e gerir **quem ocupa** cada vaga.

**O que importa:**

Montar 70 séries na mão é o pior momento da vida do cliente com o produto.
Duplicar precisa ser bom, e **criar uma série em vários dias de uma vez** precisa
existir — a mesma turma de 7h costuma acontecer segunda, quarta e sexta.

Ao editar, a tela precisa deixar explícito que **a mudança vale daqui para frente**
e não reescreve as sessões que já aconteceram. Essa é a confusão mais provável do
sistema inteiro, e é onde a confiança se perde se ficar ambígua.

Encerrar uma série tem que dizer **quantas pessoas ocupam vaga nela** antes de
confirmar.

---

## 13. Configuração da conta

**Serve para** ajustar o sistema ao negócio, sem código. É aqui que a Verandi deixa
de ser genérica e vira "o sistema do estúdio".

**Quem usa:** `dono`; `suporte` da 4YU.

**Seções:**

- **Serviços** — nome, duração, capacidade padrão, ativo. É onde entram "pilates
  solo", "fáscia", "boxe infantil", "corte".
- **Profissionais** — nome, cor na grade, se tem login. **Existe sem usuário:** um
  nome na grade não precisa de acesso ao sistema.
- **Locais** — sala, cadeira, consultório, domicílio.
- **Vocabulário** — como este negócio chama pessoa, profissional, série, sessão e
  serviço. Muda o texto de todas as telas.
- **Funcionamento e feriados** — dias e horários em que o negócio abre; datas
  fechadas.
- **Usuários** — quem tem acesso, com que papel; convidar, mudar papel, remover.
- **Integrações** — token de API para o AutoFluxos e endereço do webhook de saída.

**O que importa:**

**Vocabulário é a seção que carrega a promessa do produto.** Ela precisa mostrar o
efeito antes de salvar — a pessoa escolhe "Aluno" e vê onde isso aparece.

Token de API se mostra **uma vez, na criação**. Depois só o nome, a data do último
uso e revogar. Guardar token legível no banco é o tipo de decisão que só dói
depois de vazar.

Remover usuário nunca apaga o que ele registrou. Presença marcada pela Sofia
continua marcada pela Sofia depois que a Sofia sai.

Desativar serviço, profissional ou local **não pode quebrar histórico** — some das
escolhas novas, continua aparecendo no passado.

---

## 14. Importar planilha

**Serve para** trazer a operação que já existe sem redigitar meses de dados. É a
diferença entre o cliente começar hoje ou começar "quando der".

**Quem usa:** `suporte` da 4YU junto com o `dono`, na implantação.

**Fluxo em quatro passos:**
1. **Enviar** o arquivo
2. **Conferir o que foi entendido** — quantos horários, quantas pessoas, quantas
   presenças, quais profissionais e serviços foram identificados
3. **Resolver o que não casou** — pessoa que parece duplicada, telefone sem DDD,
   marca de presença desconhecida, nome de profissional escrito de várias formas
4. **Confirmar** e ver o resultado

**Mostra:** no passo 3, cada linha problemática com o dado original ao lado da
interpretação proposta, e a escolha disponível.

**Dá para:** decidir caso a caso; aplicar a mesma decisão a todos os casos iguais;
deixar de fora; importar só a estrutura (grade e pessoas) sem o histórico de
presença; desfazer a importação inteira.

**O que importa:**

**O importador relata, nunca adivinha.** Este é o requisito principal desta tela.
Dado real vem torto: 77% com identificador, 70% com telefone, DDD ausente na
maioria, e a mesma pessoa escrita de dois jeitos entre julho e agosto. Um
importador que "resolve sozinho" cria duplicatas silenciosas que só aparecem meses
depois, quando já são a base inteira.

Os casos que a planilha do MGM garante que vão aparecer, e que a tela precisa
tratar de frente:
- profissional escrito de **doze formas diferentes** para cerca de seis pessoas
  (`Prof. SOFIA`, `PROF. SOFIA`, `Prof.SOFIA`, `SOFIA`)
- anotação dentro do nome (`(PERSONAL)`, `(Gestante)`, `- RESERVA`, `(Pers.
  Nath)`) que na verdade é serviço, tag, origem ou profissional
- gente escrita **abaixo** das vagas numeradas — são as 47 pessoas fora da grade,
  e elas não são erro
- marcas de presença desconhecidas (`XX`, `F EXP`) que precisam de decisão humana
- horário fechado escrito na célula do nome

Desfazer a importação inteira precisa existir. A primeira tentativa quase nunca é
a boa, e sem desfazer o cliente fica com uma base suja e medo de tentar de novo.

---

## 15. Contas (4YU)

**Serve para** a 4YU criar, configurar e diagnosticar as contas dos clientes.

**Quem usa:** `suporte`.

**Mostra:** todas as contas com nome, plano, quando foi criada, e sinais de vida —
sessões na última semana, chamadas feitas, último acesso, falhas de envio.

**Dá para:** criar conta; entrar numa conta como suporte; ver o log de ações de
suporte; suspender.

**O que importa:**

Entrar como suporte precisa ficar **visível dentro da conta** enquanto durar — uma
faixa que não some. Ver dado de cliente sem que ninguém saiba é o tipo de acesso
que precisa ser constrangedor de propósito.

Toda ação feita como suporte fica registrada com quem fez.

Os sinais de vida são o que responde "o cliente está usando?" antes de ele
reclamar — chamada que parou de ser feita é o primeiro sintoma de abandono.

---

## Mapa de rotas

```
/entrar                        1
/convite/[token]               2
/contas                        3 · e 15 para suporte
/                              4  (profissional) · 6 (dono, recepção)
/hoje                          4
/semana                        6
/sessao/[id]                   5
/vaga                          7
/agendar                       8
/pessoas                       9
/pessoas/[id]                 10
/pendencias                   11
/grade                        12
/config                       13  (seções: servicos · profissionais · locais ·
                                   vocabulario · funcionamento · usuarios ·
                                   integracoes)
/importar                     14
```

## O que fica para depois

Não são telas esquecidas — são telas que o modelo comporta e que não entram no
primeiro marco:

- **Lista de espera automática** — hoje `reserva` é origem de participação e
  aparece em Pendências; o aviso automático quando abre vaga é marco 2.
- **Confirmação por bot** — a tela não muda; a participação passa a ter
  `origem: bot` no registro. Depende só da API.
- **Relatórios** — frequência, ocupação por horário, quem está sumindo.
- **Aplicativo da pessoa atendida** — fora de escopo por decisão de produto.
- **Financeiro e contratos** — outro produto.
