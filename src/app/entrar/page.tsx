import { FormularioDeEntrada } from './formulario'

/**
 * A entrada.
 *
 * A rota é de servidor só para ler o `email` da barra de endereço: quem acabou
 * de criar a senha pelo convite chega aqui com ele preenchido, em vez de digitar
 * de novo o endereço que o sistema já conhece. Era o atrito anotado no
 * `HANDOFF`, e ele custava a primeira impressão de quem entra pela primeira vez.
 *
 * O endereço viaja na URL porque é o da própria pessoa, e ela acabou de digitá-lo
 * do outro lado. Nada mais entra aqui: parâmetro de barra de endereço não
 * identifica ninguém no sistema, e quem entra continua entrando por e-mail e
 * senha.
 */
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <FormularioDeEntrada emailInicial={email} />
}
