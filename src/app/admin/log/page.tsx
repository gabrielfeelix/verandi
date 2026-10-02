import { listarLog } from '@/server/admin/consultas'
import { CabecalhoAdmin, ListaDoLog } from '@/components/admin/pecas'

/**
 * Tudo que a equipe da 4YU fez: entradas em conta de cliente, com início e fim,
 * e cada ação da administração, com o e-mail de quem fez.
 *
 * Ver dado de cliente sem que ninguém saiba é constrangedor de propósito, e o
 * log é a metade disso que fica: a faixa avisa durante, o log lembra depois.
 */
export default async function Log() {
  const eventos = await listarLog({ limite: 150 })
  return (
    <div className="flex flex-col gap-5">
      <CabecalhoAdmin
        titulo="Log"
        sub="Quem da 4YU fez o quê, e onde · as 150 ações mais recentes"
      />
      <ListaDoLog eventos={eventos} />
    </div>
  )
}
