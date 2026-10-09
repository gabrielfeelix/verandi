/**
 * A etiqueta azul de quem vem pelo Gympass/Wellhub.
 *
 * Aparece na ficha, na lista de Pessoas e na chamada: é na chamada que a
 * recepção precisa lembrar de conferir o check-in do aplicativo, e um
 * interruptor escondido no cadastro não lembrava ninguém (MGM, 09/out/2026).
 */
export function EtiquetaGympass() {
  return (
    <span
      title="Aluno Gympass / Wellhub"
      className="shrink-0 rounded-minima bg-info-fundo px-1.5 py-[3px] text-[12px] font-semibold text-info"
    >
      Gympass
    </span>
  )
}
