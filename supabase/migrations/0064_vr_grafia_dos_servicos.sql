-- Dois nomes de serviço da MGM, corrigidos: grafia e tamanho.
--
-- Vieram de um defeito visto no WhatsApp. O menu de modalidades do bot monta as
-- opções com o nome do serviço, e a Cloud API corta rótulo em 20 caracteres:
-- "Toque de Tensigridade" tem 21 e chegava como "Toque de Tensigridad", com a
-- última letra comida. O validador do fluxo não pega isso porque só confere
-- rótulo escrito à mão, e estes nascem da API em tempo de execução.
--
-- Olhando o nome, apareceu também a grafia. O termo técnico é *miofascial*, da
-- fáscia, e estava "Miofacial", sem o "s". O conceito de Buckminster Fuller é
-- *tensegridade* (tensional integrity), e estava "Tensigridade".
--
-- As duas correções foram confirmadas pelo Gabriel em 22/set/2026, porque
-- mudam nome comercial de serviço e isso aparece na tela da recepção e no
-- contrato: não é decisão de quem escreve a migration.
--
--   Liberação Miofacial     -> Liberação Miofascial    (20 caracteres, cabe)
--   Toque de Tensigridade   -> Toque Tensegridade      (18 caracteres, cabe)
--
-- Os planos levam o nome **escrito dentro do nome deles**, e não por
-- referência: sem mexer neles, "Miofacial" continuaria vivo na hora de
-- cadastrar contrato, que é onde a recepção lê. Por isso os dois `update`.
--
-- Escopo: só a conta da MGM Pilates, pelo id literal e não por `nome ilike
-- '%MGM%'`. O ilike acerta hoje, com duas contas no banco, e passaria a pegar
-- junto qualquer conta futura cujo nome contivesse MGM: renomear serviço de
-- outro cliente é exatamente o tipo de estrago que não se percebe. Nome de
-- serviço é dado de cada estúdio, e outra conta pode escrever diferente.

update app_verandi.servico
   set nome = 'Liberação Miofascial'
 where conta_id = 'c145c34b-cbaa-40af-a52f-e71e689853a0'
   and nome = 'Liberação Miofacial';

update app_verandi.servico
   set nome = 'Toque Tensegridade'
 where conta_id = 'c145c34b-cbaa-40af-a52f-e71e689853a0'
   and nome = 'Toque de Tensigridade';

update app_verandi.plano
   set nome = replace(nome, 'Liberação Miofacial', 'Liberação Miofascial')
 where conta_id = 'c145c34b-cbaa-40af-a52f-e71e689853a0'
   and nome like '%Liberação Miofacial%';

update app_verandi.plano
   set nome = replace(nome, 'Toque de Tensigridade', 'Toque Tensegridade')
 where conta_id = 'c145c34b-cbaa-40af-a52f-e71e689853a0'
   and nome like '%Toque de Tensigridade%';
