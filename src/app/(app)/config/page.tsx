import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { PADRAO, type ChaveVocabulario, type Rotulos } from '@/core/vocabulario/padrao'
import {
  carregarPadroes, carregarFuncionamento, emitenteDaConta, listarDatasFechadas,
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
import { cartao } from '@/components/ui/pecas'

// os glifos são os do protótipo: mono, discretos, e o suficiente para achar a
// seção pelo canto do olho depois da terceira visita
const SECOES = [
  { chave: 'servicos', icone: 'lista' },
  { chave: 'planos', icone: 'regua' },
  { chave: 'recibo', icone: 'dinheiro' },
  { chave: 'equipe', icone: 'pessoas' },
  { chave: 'locais', icone: 'local' },
  { chave: 'padroes', icone: 'regua' },
  { chave: 'vocabulario', icone: 'texto' },
  { chave: 'funcionamento', icone: 'relogio' },
  { chave: 'usuarios', icone: 'chave' },
  { chave: 'integracoes', icone: 'lista' },
] as const satisfies ReadonlyArray<{ chave: string; icone: NomeIcone }>

type Secao = (typeof SECOES)[number]['chave']

/**
 * O menu da Configuração fala a língua da conta nas três seções que nomeiam
 * coisas do negócio.
 *
 * "Serviços", "Equipe" e "Locais" estavam escritos aqui, e o painel de cada uma
 * já mostrava a palavra do cliente no título: quem chamava serviço de
 * "modalidade" clicava em "Serviços" e caía numa tela chamada "Modalidades".
 * As outras quatro nomeiam partes do sistema, não do negócio, e ficam.
 */
function rotuloDaSecao(chave: Secao, r: Rotulos): string {
  if (chave === 'servicos') return r.servico.plural
  if (chave === 'equipe') return r.profissional.plural
  if (chave === 'locais') return r.local.plural
  // "Planos e valores" é palavra nossa: todo negócio que cobra chama o que
  // vende de plano, e o gênero não muda com o vocabulário da conta
  return { padroes: 'Padrões', vocabulario: 'Vocabulário',
           funcionamento: 'Funcionamento', usuarios: 'Usuários',
           integracoes: 'Integrações', planos: 'Planos e valores',
           recibo: 'Recibo' }[chave]
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
 * Uma seção por vez, escolhida pela URL — assim recarregar cai no mesmo lugar e
 * o link de "vem ver isto aqui" funciona.
 */
export default async function Config({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') redirect('/hoje')

  const { s } = await searchParams
  const secao: Secao = SECOES.some((x) => x.chave === s) ? (s as Secao) : 'servicos'

  const db = await clienteServidor()
  const voc = await carregarVocabulario(db, conta.contaId)
  const rotulos = resolverRotulos(voc)

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Configuração da conta
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            É aqui que o sistema deixa de ser genérico e vira o sistema do
            negócio.
          </p>
        </header>

        <div className="grid items-start gap-4 md:grid-cols-[236px_minmax(0,1fr)]">
          <nav
            aria-label="Seções da configuração"
            className={`flex flex-col gap-0.5 ${cartao} p-2`}
          >
            {SECOES.map((x) => (
              <Link
                key={x.chave}
                href={`/config?s=${x.chave}`}
                aria-current={secao === x.chave ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-media px-3 transition-colors duration-150 ${
                  secao === x.chave
                    ? 'bg-escuro text-tinta-clara'
                    : 'text-tinta-media hover:bg-superficie-mais-suave'
                }`}
              >
                <Icone nome={x.icone} tamanho={18} />
                <span
                  className={`text-[13.5px] ${secao === x.chave ? 'font-medium' : ''}`}
                >
                  {rotuloDaSecao(x.chave, rotulos)}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex min-w-0 flex-col gap-3.5">

        {/* `data-guia` é a âncora do balão do onboarding, e nada além disso:
            ele só é lido pelo guia, e sumir daqui não quebra a tela. */}
        {secao === 'servicos' ? (
          <div data-guia="config-servicos">
            <SecaoServicos
              servicos={await listarServicos(db, conta.contaId)}
              rotulo={rotulos.servico}
              rotuloSerie={rotulos.serie}
              rotuloSessoes={rotulos.sessao.plural}
            />
          </div>
        ) : null}

        {secao === 'planos' ? (
          <SecaoPlanos
            planos={await listarPlanos(db, conta.contaId)}
            servicos={await listarServicos(db, conta.contaId)}
            rotuloServico={rotulos.servico}
          />
        ) : null}

        {secao === 'recibo' ? (
          <SecaoRecibo emitente={await emitenteDaConta(db, conta.contaId)} />
        ) : null}

        {secao === 'equipe' ? (
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

        {secao === 'locais' ? (
          <SecaoLocais
            locais={await listarLocais(db, conta.contaId)}
            rotulo={rotulos.local}
            rotuloSeries={rotulos.serie.plural}
            rotuloSessoes={rotulos.sessao.plural}
          />
        ) : null}

        {secao === 'padroes' ? (
          <SecaoPadroes
            padroes={await carregarPadroes(db, conta.contaId)}
            ultima={await ultimaAlteracao(db, conta.contaId, 'conta')}
          />
        ) : null}

        {secao === 'vocabulario' ? (
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

        {secao === 'usuarios' ? (
          <SecaoUsuarios
            usuarios={await listarUsuarios(db, conta.contaId)}
            convites={await listarConvites(db, conta.contaId)}
            meuId={(await db.auth.getUser()).data.user?.id ?? ''}
          />
        ) : null}

        {secao === 'integracoes' ? (
          <SecaoIntegracoes
            chaves={await listarChaves(db, conta.contaId)}
            aviso={await avisoDaConta(conta.contaId)}
          />
        ) : null}

        {secao === 'funcionamento' ? (
          <SecaoFuncionamento
            dias={await carregarFuncionamento(db, conta.contaId)}
            datas={await listarDatasFechadas(db, conta.contaId, hojeEm(conta.fuso))}
          />
        ) : null}
          </div>
        </div>
      </div>
    </ProvedorDeAviso>
  )
}
