import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { PADRAO, type ChaveVocabulario } from '@/core/vocabulario/padrao'
import {
  carregarPadroes, carregarFuncionamento, listarDatasFechadas,
  listarLocais, listarServicos,
} from '@/server/config/consultas'
import { hojeEm } from '@/server/agenda/fuso'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { SecaoLocais, SecaoServicos } from '@/components/config/catalogo'
import { SecaoPadroes } from '@/components/config/padroes'
import { SecaoVocabulario } from '@/components/config/vocabulario'
import { SecaoFuncionamento } from '@/components/config/funcionamento'
import { SecaoEquipe } from '@/components/config/equipe'
import { listarEquipe } from '@/server/config/equipe'
import { SecaoUsuarios } from '@/components/config/usuarios'
import { listarConvites, listarUsuarios } from '@/server/usuarios/consultas'

const SECOES = [
  { chave: 'servicos', rotulo: 'Serviços' },
  { chave: 'equipe', rotulo: 'Equipe' },
  { chave: 'locais', rotulo: 'Locais' },
  { chave: 'padroes', rotulo: 'Padrões' },
  { chave: 'vocabulario', rotulo: 'Vocabulário' },
  { chave: 'funcionamento', rotulo: 'Funcionamento' },
  { chave: 'usuarios', rotulo: 'Usuários' },
] as const

type Secao = (typeof SECOES)[number]['chave']

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
      <div className="flex max-w-4xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="font-titulo text-[30px] font-semibold tracking-[-.02em]">
            Configuração
          </h1>
          <p className="text-tinta-media">
            Ajusta o sistema ao negócio, sem código.
          </p>
        </header>

        <nav className="flex flex-wrap gap-1" aria-label="Seções da configuração">
          {SECOES.map((x) => (
            <Link
              key={x.chave}
              href={`/config?s=${x.chave}`}
              aria-current={secao === x.chave ? 'page' : undefined}
              className={`rounded-[--radius-peca] px-3 py-2 text-[13px] ${
                secao === x.chave
                  ? 'bg-escuro font-medium text-tinta-clara'
                  : 'text-tinta-media hover:bg-superficie-mais-suave'
              }`}
            >
              {x.rotulo}
            </Link>
          ))}
        </nav>

        {secao === 'servicos' ? (
          <SecaoServicos servicos={await listarServicos(db, conta.contaId)} />
        ) : null}

        {secao === 'equipe' ? (
          <SecaoEquipe
            equipe={await listarEquipe(db, conta.contaId)}
            servicos={(await listarServicos(db, conta.contaId))
              .filter((x) => x.ativo)
              .map((x) => ({ id: x.id, nome: x.nome }))}
            rotuloProfissional={rotulos.profissional.singular}
          />
        ) : null}

        {secao === 'locais' ? (
          <SecaoLocais locais={await listarLocais(db, conta.contaId)} />
        ) : null}

        {secao === 'padroes' ? (
          <SecaoPadroes padroes={await carregarPadroes(db, conta.contaId)} />
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

        {secao === 'funcionamento' ? (
          <SecaoFuncionamento
            dias={await carregarFuncionamento(db, conta.contaId)}
            datas={await listarDatasFechadas(db, conta.contaId, hojeEm(conta.fuso))}
          />
        ) : null}
      </div>
    </ProvedorDeAviso>
  )
}
