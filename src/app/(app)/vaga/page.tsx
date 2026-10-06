import { redirect } from 'next/navigation'

/**
 * Buscar vaga deixou de ser tela em 06/out/2026.
 *
 * "Tem horário quinta?" é o filtro "Só com vaga" da Agenda, e marcar começa
 * pela pessoa, no "Marcar aula" da ficha. A rota fica para favorito e link
 * antigo não darem em 404.
 */
export default function BuscarVaga() {
  redirect('/semana?vaga=sim')
}
