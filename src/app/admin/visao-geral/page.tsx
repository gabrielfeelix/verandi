import Link from 'next/link'
import { resumoDaPlataforma, listarLog } from '@/server/admin/consultas'
import { CabecalhoAdmin, ListaDoLog, Numero } from '@/components/admin/pecas'
import { cartao } from '@/components/ui/pecas'

/** Lista longa aqui esconde o log embaixo; o resto está em Contas. */
const PARADAS_A_VISTA = 6

/**
 * A primeira tela do admin: a plataforma em quatro números, as contas que
 * pararam de usar e o que a equipe fez por último.
 *
 * "Parada" é conta ativa sem ninguém da equipe dela entrando há uma semana. É
 * o sinal mais barato de abandono, e chega antes da reclamação ou do
 * cancelamento.
 */
export default async function VisaoGeral() {
  const [r, log] = await Promise.all([resumoDaPlataforma(), listarLog({ limite: 8 })])

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoAdmin titulo="Visão geral" sub="A plataforma inteira, do jeito que está agora" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Empresas ativas" valor={r.contasAtivas} href="/admin/empresas"
          nota={r.contasSuspensas ? `${r.contasSuspensas} suspensa${r.contasSuspensas > 1 ? 's' : ''}` : 'nenhuma suspensa'} />
        <Numero rotulo="Usuários" valor={r.usuarios} href="/admin/usuarios" nota="com acesso a alguma empresa" />
        <Numero rotulo="Admins" valor={r.admins} href="/admin/usuarios?f=admin" nota="equipe da 4YU" />
        <Numero rotulo="Suporte em aberto" valor={r.acessosEmAberto} href="/admin/log" alerta
          nota={r.acessosEmAberto ? 'alguém não saiu do suporte' : 'ninguém dentro de empresa'} />
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-titulo text-[18px] font-semibold">Empresas paradas</h2>
        {r.contasParadas.length === 0 ? (
          <p className={`px-4.5 py-4 text-[14.5px] text-tinta-media ${cartao}`}>
            Toda empresa ativa teve alguém entrando nos últimos sete dias.
          </p>
        ) : (
          <ul className={`overflow-hidden ${cartao}`}>
            {r.contasParadas.slice(0, PARADAS_A_VISTA).map((c) => (
              <li key={c.id} className="border-b border-linha-fina last:border-b-0">
                <Link
                  href={`/admin/empresas/${c.id}`}
                  className="flex items-center justify-between gap-3 px-4.5 py-3 hover:bg-superficie-tenue"
                >
                  <span className="text-[14.5px] font-medium">{c.nome}</span>
                  <span className="text-[13.5px] font-medium text-alerta">
                    {c.ultimoAcesso
                      ? `último acesso em ${new Date(c.ultimoAcesso).toLocaleDateString('pt-BR')}`
                      : 'ninguém entrou ainda'}
                  </span>
                </Link>
              </li>
            ))}
            {r.contasParadas.length > PARADAS_A_VISTA ? (
              <li className="px-4.5 py-3 text-[13.5px] text-tinta-media">
                e mais {r.contasParadas.length - PARADAS_A_VISTA} na lista de{' '}
                <Link href="/admin/empresas" className="text-marca underline">empresas</Link>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-titulo text-[18px] font-semibold">Últimas ações da 4YU</h2>
          <Link href="/admin/log" className="text-[13.5px] text-marca underline">Ver o log inteiro</Link>
        </div>
        <ListaDoLog eventos={log} />
      </section>
    </div>
  )
}
