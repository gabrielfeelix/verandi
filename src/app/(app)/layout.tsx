import { exigirConta, clienteServidor, contasDoUsuario } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { estadoDoOnboarding, encerrado, contaVazia } from '@/server/onboarding/consultas'
import { contarAtrasadas } from '@/server/financeiro/consultas'
import { hojeEm } from '@/server/agenda/fuso'
import { roteiroDe } from '@/core/onboarding/roteiro'
import { boasVindas } from '@/core/onboarding/boas-vindas'
import { aindaNeutro } from '@/core/vocabulario/predefinicoes'
import { Guia } from '@/components/onboarding/guia'
import { BoasVindas } from '@/components/onboarding/boas-vindas'
import { Sair } from '@/components/ui/sair'
import { FaixaSuporte } from '@/components/ui/faixa-suporte'
import { Rail, BarraInferior, type ItemRail } from '@/components/ui/rail'
import { RodapeLegal } from '@/components/ui/rodape-legal'

const PAPEL: Record<string, string> = {
  dono: 'Dono',
  recepcao: 'Recepção',
  profissional: 'Profissional',
  suporte: 'Suporte 4YU',
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const conta = await exigirConta()
  const db = await clienteServidor()

  /*
   * As quatro perguntas do trilho vão juntas, e não uma depois da outra.
   *
   * Nenhuma delas depende do resultado das outras: o vocabulário, as contas da
   * pessoa, quem ela é e o nome dela na grade são quatro idas independentes ao
   * banco. Em fila custavam a soma; juntas custam a mais lenta. É o mesmo tipo
   * de conta que fazia toda navegação parecer travada, e o layout é o pior
   * lugar para isso, porque **toda tela passa por aqui**.
   */
  const [voc, contas, { data: { user } }] = await Promise.all([
    carregarVocabulario(db, conta.contaId),
    contasDoUsuario(),
    db.auth.getUser(),
  ])
  const rotulos = resolverRotulos(voc)

  // o nome da grade é o nome da pessoa; quem não é profissional cai no e-mail
  const { data: eu } = await db
    .from('profissional').select('nome')
    .eq('conta_id', conta.contaId)
    .eq('usuario_id', user?.id ?? '')
    .maybeSingle()

  /*
   * O onboarding acontece **dentro** do sistema, e é decidido aqui.
   *
   * Não é uma tela antes de entrar: quem acabou de logar precisa ver o produto
   * carregado atrás, com o nome da conta no trilho e a agenda no lugar. Uma
   * segunda tela com a mesma cara do login faz a pessoa achar que o login não
   * funcionou. Então o sistema abre inteiro e as boas-vindas vêm por cima, com
   * o fundo escurecido, como qualquer modal do produto.
   *
   * O layout é onde isso mora porque é o único lugar por onde toda tela passa:
   * o link de um e-mail entra direto numa rota, e a ação de entrar já resolve o
   * destino do papel sozinha, sem passar pela raiz.
   *
   * A conta interna da 4YU fica fora: suporte não é cliente, e não há o que
   * ensinar a operar.
   */
  const onboarding = user && conta.papel !== 'suporte'
    ? await estadoDoOnboarding(db, conta.contaId, user.id)
    : null

  const mostrarBoasVindas = !!onboarding && !encerrado(onboarding['boas-vindas'])

  /*
   * Os apontamentos só valem enquanto há o que montar. Oferecer "cadastre um
   * serviço" a quem já tem a semana inteira no ar é o tutorial falando de um
   * problema que a pessoa resolveu sozinha.
   */
  const passos = onboarding && !encerrado(onboarding['primeiros-passos'])
      && !mostrarBoasVindas
      && await contaVazia(db, conta.contaId)
    ? roteiroDe(conta.papel, rotulos)
    : []

  const operacional = conta.papel === 'dono' || conta.papel === 'recepcao'

  /*
   * O número de cobranças em atraso vive no trilho porque é o único dado do
   * financeiro que precisa alcançar quem não estava indo até lá. Uma consulta
   * contada, com índice, e só para quem pode ver dinheiro: para a profissional
   * ela nem é feita.
   */
  const atrasadas = operacional
    ? await contarAtrasadas(db, conta.contaId, hojeEm(conta.fuso))
    : 0

  const itens: ItemRail[] = [
    { href: '/hoje', rotulo: 'Hoje', curto: 'Hoje', icone: 'hoje', guia: 'rail-hoje' },
    ...(operacional
      ? ([
          { href: '/semana', rotulo: 'Agenda', curto: 'Agenda', icone: 'semana', guia: 'rail-semana' },
          { href: '/pendencias', rotulo: 'Pendências', curto: 'Pend.', icone: 'pendencias', guia: 'rail-pendencias' },
          {
            href: '/pessoas',
            rotulo: rotulos.pessoa.plural,
            curto: rotulos.pessoa.plural,
            icone: 'pessoas',
            guia: 'rail-pessoas',
          },
          { href: '/vaga', rotulo: 'Buscar vaga', curto: 'Vaga', icone: 'vaga', guia: 'rail-vaga' },
          { href: '/grade', rotulo: 'Grade fixa', curto: 'Fixa', icone: 'grade', guia: 'rail-grade' },
          {
            href: '/financeiro',
            rotulo: 'Financeiro',
            curto: 'R$',
            icone: 'dinheiro',
            badge: atrasadas,
            badgeRotulo: 'em atraso',
            guia: 'rail-financeiro',
          },
          {
            href: '/recibos',
            rotulo: 'Recibos',
            curto: 'Recibo',
            icone: 'lista',
            guia: 'rail-recibos',
          },
        ] satisfies ItemRail[])
      : []),
    ...(conta.papel === 'dono' || conta.papel === 'suporte'
      ? ([
          {
            href: '/aulas',
            rotulo: 'Aulas',
            curto: 'Aulas',
            icone: 'regua',
            guia: 'rail-aulas',
          },
          { href: '/config', rotulo: 'Configuração', curto: 'Config', icone: 'config', guia: 'rail-config' },
        ] satisfies ItemRail[])
      : []),
    ...(conta.papel === 'suporte'
      ? ([{ href: '/contas-4yu', rotulo: 'Contas (4YU)', curto: '4YU', icone: 'conta' }] satisfies ItemRail[])
      : []),
  ]

  // em celular são quatro, não nove: quem está em pé na sala precisa do que usa
  const tabs = itens.filter((i) =>
    ['/hoje', '/semana', '/pessoas', '/pendencias'].includes(i.href),
  )

  return (
    <div className="min-h-dvh">
      {/* A faixa fica acima de tudo e não some enquanto o suporte estiver dentro
          de conta de cliente. Na conta da própria 4YU não há o que avisar. */}
      {conta.papel === 'suporte' && !conta.interna
        ? <FaixaSuporte conta={conta.nome} /> : null}

      <div className="flex min-h-dvh">
        {/*
          * `data-imprimir="fora"` num invólucro `contents`, que não existe para
          * a tela e existe para o papel.
          *
          * Sem isto o trilho inteiro ia junto no papel do recibo e da grade:
          * não como cabeçalho, mas **por baixo** da folha, com o nome das
          * telas atravessando o texto. `display: contents` some do fluxo na
          * tela, e a regra de impressão o apaga com os filhos dentro.
          */}
        <div data-imprimir="fora" className="contents">
        <Rail
          itens={itens}
          conta={conta.nome}
          pessoa={eu?.nome ?? user?.email ?? 'Você'}
          papel={PAPEL[conta.papel] ?? conta.papel}
          podeTrocar={contas.length > 1}
          sair={<Sair />}
        />
        </div>

        {/* `data-guia="tela"` é o alvo de reserva do onboarding: quando o
            elemento apontado não existe naquela conta, o balão aponta a área de
            trabalho inteira em vez de apontar o vazio */}
        <main data-guia="tela" className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">
          {/* A conta ativa aparece em toda tela de propósito: operar na conta
              errada é o erro mais caro que este sistema permite, e é silencioso.
              No rail ela está sempre no topo; em celular, aqui. */}
          <p data-imprimir="fora" className="mb-3 flex items-center gap-2 md:hidden">
            <span className="font-titulo text-[16px] font-semibold">{conta.nome}</span>
            <span className="text-[12.5px] text-tinta-media">
              {PAPEL[conta.papel] ?? conta.papel}
            </span>
            {contas.length > 1 ? (
              <a href="/contas" className="ml-auto text-[13.5px] text-marca underline">
                Trocar
              </a>
            ) : null}
          </p>

          {children}

          {/* mora dentro do `main` para respeitar o `pb-24` que a barra do
              celular exige: fora dele, o rodapé nasceria escondido atrás dela */}
          <div data-imprimir="fora">
            <RodapeLegal className="pt-8" />
          </div>
        </main>
      </div>

      <div data-imprimir="fora" className="contents">
        <BarraInferior itens={tabs} />
      </div>

      {mostrarBoasVindas ? (
        <BoasVindas
          cartoes={boasVindas(conta.papel, rotulos)}
          passoInicial={onboarding!['boas-vindas'].passo}
          perguntarTipo={conta.papel === 'dono' && aindaNeutro(voc)}
        />
      ) : null}

      {passos.length > 0 ? (
        <Guia passos={passos} passoInicial={onboarding!['primeiros-passos'].passo} />
      ) : null}
    </div>
  )
}
