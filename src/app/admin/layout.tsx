import { redirect } from 'next/navigation'
import { clienteServidor } from '@/server/conta'
import { ehSuporte } from '@/server/suporte/consultas'
import { Rail, BarraInferior, type ItemRail } from '@/components/ui/rail'
import { Cabecalho } from '@/components/ui/cabecalho'
import { SeletorDeConta } from '@/components/ui/seletor-de-conta'
import { RodapeLegal } from '@/components/ui/rodape-legal'
import { ProvedorDeTroca } from '@/components/ui/troca'
import { ProvedorDeAviso } from '@/components/ui/desfazer'

/**
 * A área de administração da 4YU.
 *
 * Mora fora do `(app)` porque não é tela de estúdio. Antes ela era um item a
 * mais no menu do estúdio, e o admin entrava numa Agenda, num Financeiro e
 * numa Configuração da conta interna, que é vazia e não é cliente de ninguém.
 * Aqui o menu é só o que o admin faz: ver a plataforma, as contas, as pessoas
 * e o que a equipe da 4YU fez.
 *
 * A checagem é o vínculo `suporte` na conta interna (`ehSuporte`). Ela protege
 * as **telas**; as ações conferem de novo por conta própria, porque ação de
 * servidor é endereço público e não passa por layout.
 */
const ITENS_DO_ADMIN: ItemRail[] = [
  { href: '/admin/visao-geral', rotulo: 'Visão geral', curto: 'Geral', icone: 'hoje' },
  { href: '/admin/empresas', rotulo: 'Empresas', curto: 'Empresas', icone: 'conta' },
  { href: '/admin/usuarios', rotulo: 'Usuários', curto: 'Usuários', icone: 'pessoas' },
  { href: '/admin/log', rotulo: 'Log', curto: 'Log', icone: 'lista' },
]

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/entrar')
  // quem não é admin volta para o estúdio com o motivo, como em toda tela
  // restrita; mandar para a raiz faria laço com quem ainda tem papel `suporte`
  // numa conta de cliente
  if (!(await ehSuporte(db))) redirect(`/hoje?restrita=${encodeURIComponent('Administração')}`)

  const pessoa = user.email ?? 'Admin'

  // o seletor daqui é o atalho para entrar em qualquer empresa como suporte
  const atual = { contaId: 'administracao', nome: 'Administração', papel: 'Admin 4YU' }

  return (
    <div className="min-h-dvh">
      <div className="flex min-h-dvh">
        <Rail itens={ITENS_DO_ADMIN} atual={atual} contas={[]} suporte />

        <div className="flex min-w-0 flex-1 flex-col">
          <Cabecalho
            destinos={ITENS_DO_ADMIN}
            pessoa={pessoa}
            email={user.email ?? ''}
            papel="Admin 4YU"
            configHref={null}
            comSino={false}
            suporte={false}
            podeTrocar
            seletor={<SeletorDeConta atual={atual} contas={[]} suporte claro />}
          />

          <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">
            <ProvedorDeAviso>
              <ProvedorDeTroca>{children}</ProvedorDeTroca>
            </ProvedorDeAviso>

            <RodapeLegal className="pt-8" />
          </main>
        </div>
      </div>

      <BarraInferior
        itens={ITENS_DO_ADMIN}
        principais={ITENS_DO_ADMIN.map((i) => i.href)}
      />
    </div>
  )
}
