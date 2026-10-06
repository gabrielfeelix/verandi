import Link from 'next/link'
import { ADMINISTRA, clienteServidor, exigirPapel } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { PADRAO, type ChaveVocabulario, type Rotulos } from '@/core/vocabulario/padrao'
import type { Db } from '@/server/supabase'
import {
  carregarPadroes, carregarFuncionamento, emitenteDaConta, listarDatasFechadas,
  urlDaAssinatura,
  ultimaAlteracao, listarLocais, listarServicos,
} from '@/server/config/consultas'
import { hojeEm } from '@/server/agenda/fuso'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { Icone, type NomeIcone } from '@/components/ui/icones'
import { SecaoLocais, SecaoServicos } from '@/components/config/catalogo'
import { SecaoPlanos } from '@/components/config/planos'
import { SecaoRecibo } from '@/components/config/recibo'
import { listarPlanos } from '@/server/planos/consultas'
import { SecaoPadroes } from '@/components/config/padroes'
import { SecaoVocabulario } from '@/components/config/vocabulario'
import { SecaoFuncionamento } from '@/components/config/funcionamento'
import { SecaoEquipe } from '@/components/config/equipe'
import { listarEquipe } from '@/server/config/equipe'
import { SecaoUsuarios } from '@/components/config/usuarios'
import { SecaoIntegracoes } from '@/components/config/integracoes'
import { avisoDaConta } from '@/server/webhook/consultas'
import { listarChaves } from '@/server/api/chave'
import { listarConvites, listarUsuarios } from '@/server/usuarios/consultas'
import { AreaQueTroca } from '@/components/ui/troca'
import Carregando from './loading'

// os glifos são os do protótipo: mono, discretos, e o suficiente para achar a
// seção pelo canto do olho depois da terceira visita
/*
 * Seis seções, e não dez. Serviço e plano se configuram juntos (o plano é o
 * preço do serviço); quem dá aula e quem entra no sistema são a mesma pergunta
 * de equipe; locais, horário de funcionamento e padrões dizem como a agenda
 * funciona. Dez itens faziam procurar onde estava cada coisa.
 *
 * As chaves antigas (`?s=planos`, `?s=usuarios`...) continuam valendo: caem na
 * seção que as contém, e nenhum link antigo quebra.
 */
const SECOES = [
  { chave: 'servicos', icone: 'lista', inclui: ['servicos', 'planos'] },
  { chave: 'equipe', icone: 'pessoas', inclui: ['equipe', 'usuarios'] },
  { chave: 'funcionamento', icone: 'relogio', inclui: ['funcionamento', 'locais', 'padroes'] },
  { chave: 'recibo', icone: 'recibo', inclui: ['recibo'] },
  { chave: 'vocabulario', icone: 'texto', inclui: ['vocabulario'] },
  { chave: 'integracoes', icone: 'clipe', inclui: ['integracoes'] },
] as const satisfies ReadonlyArray<{ chave: string; icone: NomeIcone; inclui: readonly string[] }>

type Secao = (typeof SECOES)[number]['chave']
type Painel = (typeof SECOES)[number]['inclui'][number]

/**
 * O menu fala a língua da conta onde nomeia coisas do negócio: quem chama
 * serviço de "modalidade" lê "Modalidades e planos".
 */
function rotuloDaSecao(chave: Secao, r: Rotulos): string {
  if (chave === 'servicos') return `${r.servico.plural} e planos`
  if (chave === 'equipe') return `${r.profissional.plural} e acessos`
  return { funcionamento: 'Funcionamento', vocabulario: 'Vocabulário',
           integracoes: 'Integrações', recibo: 'Recibo' }[chave]
}

/** O que cada palavra do vocabulário nomeia, em uma linha. */
const EXPLICA: Record<ChaveVocabulario, string> = {
  pessoa: 'quem é atendido',
  profissional: 'quem atende',
  servico: 'o que é oferecido',
  local: 'onde acontece',
  serie: 'o horário que se repete toda semana',
  sessao: 'um encontro num dia e hora',
  vaga: 'o lugar de alguém num horário fixo',
}

/**
 * A Configuração da conta: é aqui que a Verandi deixa de ser genérica e vira o
 * sistema daquele negócio.
 *
 * Uma seção por vez, escolhida pela URL: assim recarregar cai no mesmo lugar e
 * o link de "vem ver isto aqui" funciona.
 */
export default async function Config({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const conta = await exigirPapel(ADMINISTRA, 'Configuração')

  const { s } = await searchParams
  const secao: Secao = SECOES.find((x) => (x.inclui as readonly string[]).includes(s ?? ''))?.chave
    ?? 'servicos'
  const paineis: readonly Painel[] = SECOES.find((x) => x.chave === secao)!.inclui
  const mostra = (p: Painel) => paineis.includes(p)

  const db = await clienteServidor()
  const voc = await carregarVocabulario(db, conta.contaId)
  const rotulos = resolverRotulos(voc)

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[28px] leading-[1.05] font-semibold tracking-[-.02em]">
            Configuração da conta
          </h1>
          <p className="pt-[3px] text-[14.5px] text-tinta-media">
            Modalidades, equipe, horários, preços e as palavras que aparecem nas
            telas.
          </p>
        </header>

        <div className="grid items-start gap-4 md:grid-cols-[236px_minmax(0,1fr)]">
          {/* no celular as dez seções viram uma faixa que rola de lado: em
              lista, ocupavam a primeira tela inteira antes do conteúdo */}
          <nav
            aria-label="Seções da configuração"
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] *:shrink-0 md:mx-0 md:flex-col md:gap-0.5 md:rounded-cartao md:border md:border-linha md:bg-superficie md:p-2"
          >
            {SECOES.map((x) => (
              <Link
                key={x.chave}
                href={`/config?s=${x.chave}`}
                aria-current={secao === x.chave ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-media px-3 transition-colors duration-150 ${
                  secao === x.chave
                    ? 'bg-escuro text-tinta-clara'
                    : 'border border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave md:border-0 md:bg-transparent'
                }`}
              >
                <Icone nome={x.icone} tamanho={18} />
                <span
                  className={`text-[14.5px] ${secao === x.chave ? 'font-medium' : ''}`}
                >
                  {rotuloDaSecao(x.chave, rotulos)}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex min-w-0 flex-col gap-3.5">

        {/* `data-guia` é a âncora do balão do onboarding, e nada além disso:
            ele só é lido pelo guia, e sumir daqui não quebra a tela. */}
        {mostra('servicos') ? (
          <div data-guia="config-servicos">
            <SecaoServicos
              servicos={await listarServicos(db, conta.contaId)}
              rotulo={rotulos.servico}
              rotuloSerie={rotulos.serie}
              rotuloSessoes={rotulos.sessao.plural}
            />
          </div>
        ) : null}

        {mostra('planos') ? (
          <SecaoPlanos
            planos={await listarPlanos(db, conta.contaId)}
            servicos={await listarServicos(db, conta.contaId)}
            rotuloServico={rotulos.servico}
          />
        ) : null}

        {mostra('recibo') ? <PainelDoRecibo db={db} contaId={conta.contaId} /> : null}

        {mostra('equipe') ? (
          <SecaoEquipe
            equipe={await listarEquipe(db, conta.contaId)}
            servicos={(await listarServicos(db, conta.contaId))
              .filter((x) => x.ativo)
              .map((x) => ({ id: x.id, nome: x.nome }))}
            rotuloProfissional={rotulos.profissional.singular}
            rotuloPlural={rotulos.profissional.plural}
            rotuloSeries={rotulos.serie.plural}
            rotuloSessoes={rotulos.sessao.plural}
          />
        ) : null}

        {mostra('funcionamento') ? (
          <SecaoFuncionamento
            dias={await carregarFuncionamento(db, conta.contaId)}
            datas={await listarDatasFechadas(db, conta.contaId, hojeEm(conta.fuso))}
          />
        ) : null}

        {mostra('locais') ? (
          <SecaoLocais
            locais={await listarLocais(db, conta.contaId)}
            rotulo={rotulos.local}
            rotuloSeries={rotulos.serie.plural}
            rotuloSessoes={rotulos.sessao.plural}
          />
        ) : null}

        {mostra('padroes') ? (
          <SecaoPadroes
            padroes={await carregarPadroes(db, conta.contaId)}
            ultima={await ultimaAlteracao(db, conta.contaId, 'conta')}
          />
        ) : null}

        {mostra('vocabulario') ? (
          <SecaoVocabulario
            itens={(Object.keys(PADRAO) as ChaveVocabulario[]).map((chave) => ({
              chave,
              singular: rotulos[chave].singular,
              plural: rotulos[chave].plural,
              padrao: PADRAO[chave],
              explica: EXPLICA[chave],
            }))}
          />
        ) : null}

        {mostra('usuarios') ? (
          <SecaoUsuarios
            usuarios={await listarUsuarios(db, conta.contaId)}
            convites={await listarConvites(db, conta.contaId)}
            meuId={(await db.auth.getUser()).data.user?.id ?? ''}
          />
        ) : null}

        {mostra('integracoes') ? (
          <SecaoIntegracoes
            chaves={await listarChaves(db, conta.contaId)}
            aviso={await avisoDaConta(conta.contaId)}
          />
        ) : null}

          </div>
        </div>
      </div>
    </ProvedorDeAviso>
    </AreaQueTroca>
  )
}


/**
 * O painel do recibo carrega o emitente e a URL da assinatura juntos.
 *
 * Componente próprio porque a URL do balde privado precisa ser assinada, e
 * assinar dentro do JSX da página deixaria dois `await` encadeados no meio da
 * árvore, que é onde eles somem da vista de quem lê depois.
 */
async function PainelDoRecibo({ db, contaId }: { db: Db; contaId: string }) {
  const emitente = await emitenteDaConta(db, contaId)
  return (
    <SecaoRecibo
      emitente={emitente}
      assinatura={await urlDaAssinatura(db, emitente.assinaturaPath)}
    />
  )
}
