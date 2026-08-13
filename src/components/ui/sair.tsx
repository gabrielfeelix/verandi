import { sair } from '@/app/contas/acoes'

export function Sair() {
  return (
    <form action={sair}>
      <button type="submit" className="text-sm underline">Sair</button>
    </form>
  )
}
