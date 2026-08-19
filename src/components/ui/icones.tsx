/**
 * O vocabulário de ícones do design system.
 *
 * Um traço só, `viewBox` de 20, `currentColor`: o ícone herda a cor de quem o
 * contém e nunca precisa de uma variante escura. Sem biblioteca externa — um
 * pacote de ícones traz mil desenhos para usar doze, e traz junto o dia em que
 * ele muda de estilo sozinho numa atualização.
 *
 * Glifo de texto (`‹ › ⋯ ✎`) continua valendo em decoração miúda, nunca como
 * ícone principal de uma ação.
 */
export type NomeIcone = keyof typeof TRACOS

const TRACOS = {
  /* estado de participação */
  check: <path d="M4.5 10.5l3.8 3.8L15.5 6.5" />,
  x: <path d="M5.8 5.8l8.4 8.4M14.2 5.8l-8.4 8.4" />,
  aviso: (
    <>
      <path d="M10 3.4l7.1 12.3H2.9z" />
      <path d="M10 8.4v3.1" />
      <path d="M10 14h.01" />
    </>
  ),
  licenca: (
    <>
      <circle cx="10" cy="10" r="6.4" />
      <path d="M5.5 5.5l9 9" />
    </>
  ),

  /* anexo e aviso */
  clipe: (
    <path d="M13.4 7.3l-5 5a1.9 1.9 0 002.7 2.7l5.1-5.1a3.5 3.5 0 00-5-5l-5.1 5.1a5.1 5.1 0 007.2 7.2l4.6-4.6" transform="scale(.85) translate(1.4 -.6)" />
  ),
  sino: (
    <>
      <path d="M5.6 8.4a4.4 4.4 0 018.8 0c0 3.4 1.2 4.4 1.2 4.4H4.4s1.2-1 1.2-4.4z" />
      <path d="M8.4 15.4a1.8 1.8 0 003.2 0" />
    </>
  ),

  /* navegação */
  hoje: (
    <>
      <rect x="3" y="4.6" width="14" height="12.4" rx="2.2" />
      <path d="M3 8.6h14M7 3.2v2.8M13 3.2v2.8" />
      <circle cx="10" cy="12.8" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  semana: (
    <>
      <rect x="2.6" y="4.6" width="14.8" height="12.4" rx="2.2" />
      <path d="M2.6 8.6h14.8M7.5 8.6V17M12.5 8.6V17" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="8" cy="7.4" r="2.9" />
      <path d="M2.9 16.4c0-2.8 2.3-4.3 5.1-4.3s5.1 1.5 5.1 4.3" />
      <path d="M14.2 5.3a2.3 2.3 0 010 4.5" />
      <path d="M15.2 12.4c1.3.5 2 1.8 2 4" />
    </>
  ),
  pendencias: (
    <>
      <path d="M5.4 4.4h9.2l2.4 7.2v3.5a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-3.5z" />
      <path d="M3 11.6h3.9l1.1 2h4l1.1-2H17" />
    </>
  ),
  vaga: (
    <>
      <circle cx="8.9" cy="8.9" r="5.1" />
      <path d="M12.7 12.7L17 17" />
    </>
  ),
  grade: (
    <>
      <rect x="2.6" y="3.6" width="14.8" height="12.8" rx="2.2" />
      <path d="M2.6 8h14.8M2.6 12h14.8M8 3.6v12.8" />
    </>
  ),
  config: (
    <>
      <path d="M3.4 6.4h13.2M3.4 13.6h13.2" />
      <circle cx="8" cy="6.4" r="2" />
      <circle cx="13" cy="13.6" r="2" />
    </>
  ),
  conta: <path d="M10 2.6L17.4 10 10 17.4 2.6 10z" />,

  /* seções da configuração */
  lista: (
    <>
      <path d="M7 5.6h9.5M7 10h9.5M7 14.4h9.5" />
      <circle cx="3.9" cy="5.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.9" cy="14.4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  local: (
    <>
      <path d="M10 17.4c0 0 5.4-4.9 5.4-9a5.4 5.4 0 10-10.8 0c0 4.1 5.4 9 5.4 9z" />
      <circle cx="10" cy="8.2" r="2.1" />
    </>
  ),
  regua: (
    <>
      <rect x="2.6" y="6.8" width="14.8" height="6.4" rx="1.8" />
      <path d="M6.3 6.8v2.6M10 6.8v3.6M13.7 6.8v2.6" />
    </>
  ),
  texto: (
    <>
      <path d="M4 6.2V4.8h12v1.4" />
      <path d="M10 4.8v10.4M7.6 15.2h4.8" />
    </>
  ),
  relogio: (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M10 5.9V10l2.9 1.8" />
    </>
  ),
  chave: (
    <>
      <circle cx="6.9" cy="6.9" r="3.4" />
      <path d="M9.4 9.4l6.2 6.2M13.2 13.2l-1.5 1.5M15.6 15.6l-1.4 1.4" />
    </>
  ),

  /* ações */
  kebab: (
    <>
      <circle cx="10" cy="4.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="15.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  sair: (
    <>
      <path d="M8.2 3.6H5.4A1.6 1.6 0 003.8 5.2v9.6a1.6 1.6 0 001.6 1.6h2.8" />
      <path d="M12.4 13.2L15.8 10l-3.4-3.2M15.8 10H8" />
    </>
  ),
  antes: <path d="M12.2 4.8L7 10l5.2 5.2" />,
  depois: <path d="M7.8 4.8L13 10l-5.2 5.2" />,
  acima: <path d="M4.8 12.2L10 7l5.2 5.2" />,
  abaixo: <path d="M4.8 7.8L10 13l5.2-5.2" />,
  // dois controles deslizantes: é o desenho que virou "ajustar isto aqui"
  arrumar: (
    <>
      <path d="M3.4 6.6h13.2M3.4 13.4h13.2" />
      <circle cx="7.6" cy="6.6" r="1.9" />
      <circle cx="12.4" cy="13.4" r="1.9" />
    </>
  ),
  mais: <path d="M10 4.4v11.2M4.4 10h11.2" />,
  menos: <path d="M4.4 10h11.2" />,
  lapis: (
    <>
      <path d="M13.4 3.6l3 3-8.5 8.5-3.7.7.7-3.7z" />
      <path d="M11.6 5.4l3 3" />
    </>
  ),
  fechar: <path d="M5.8 5.8l8.4 8.4M14.2 5.8l-8.4 8.4" />,
  /*
   * Cancelar o horário inteiro.
   *
   * O protótipo desenha `⌫` como texto. Não dá: o glifo não existe nas três
   * fontes do produto, e o navegador substitui por um desenho de 8px que fica
   * ilegível dentro de um botão de 44px — foi exatamente o que apareceu na
   * tela. Círculo cortado é o sinal universal de "cancelado" e é um traço só.
   */
  /*
   * Cédula, e não cifrão: `$` é glifo de texto e não desenha em traço, e o
   * símbolo de moeda muda de país para país. Retângulo com um círculo dentro é
   * dinheiro em qualquer lugar.
   */
  dinheiro: (
    <>
      <rect x="2.6" y="5" width="14.8" height="10" rx="2" />
      <circle cx="10" cy="10" r="2.3" />
    </>
  ),
  proibido: (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M5.2 5.2l9.6 9.6" />
    </>
  ),
} as const

export function Icone({
  nome,
  tamanho = 20,
  className = '',
}: {
  nome: NomeIcone
  tamanho?: number
  className?: string
}) {
  return (
    <svg
      /*
       * Decorativo por padrão: quem chama põe o texto ao lado ou um `title` no
       * botão. Ícone com rótulo próprio faz o leitor de tela ler duas vezes.
       */
      aria-hidden
      focusable="false"
      viewBox="0 0 20 20"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {TRACOS[nome]}
    </svg>
  )
}
