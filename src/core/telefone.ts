/**
 * Telefone sem DDD é telefone que não disca.
 *
 * A planilha de onde vem quase todo cadastro escreve o número do jeito que se
 * fala na recepção — "9.8109-1840" —, porque quem anota e quem liga moram na
 * mesma cidade. No sistema isso não se sustenta: o aviso de cancelamento sai
 * por WhatsApp, e o WhatsApp precisa do país e do DDD. Guardar nove dígitos é
 * guardar um número que ninguém consegue usar depois, e não há como adivinhar
 * o DDD — 44, 41, 55 e 11 são todos plausíveis para o mesmo cadastro.
 *
 * Por isso o DDD é obrigatório na hora de salvar, e o campo o cobra na cara,
 * em vez de aceitar e falhar meses depois na hora de avisar alguém.
 */

/** Os DDDs que existem no Brasil. Fora desta lista, é dígito trocado. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export const soDigitos = (v: string): string => v.replace(/\D/g, '')

/**
 * `(44) 99999-9999` enquanto se digita, sem exigir que a pessoa digite os
 * parênteses. Aceita o número incompleto: a máscara acompanha, não trava.
 */
export function mascararTelefone(bruto: string): string {
  const n = soDigitos(bruto).slice(0, 11)
  if (n.length <= 2) return n
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

/**
 * O que está errado no número, ou `null` quando está certo.
 *
 * Vazio é válido: 30% dos cadastros reais não têm telefone, e exigir um é o
 * jeito mais rápido de fazer a recepção inventar número.
 */
export function erroDoTelefone(bruto: string | null | undefined): string | null {
  const n = soDigitos(bruto ?? '')
  if (!n) return null

  if (n.length === 8 || n.length === 9) {
    // com nove dígitos não dá para saber se falta o DDD ou um dígito do
    // número; a mensagem diz as duas coisas em vez de chutar uma
    return 'Faltou o DDD. Com ele são 10 dígitos no fixo e 11 no celular: (44) 99999-9999.'
  }
  if (n.length !== 10 && n.length !== 11) {
    return 'Número incompleto. Com DDD são 10 dígitos no fixo e 11 no celular.'
  }
  if (!DDDS.has(Number(n.slice(0, 2)))) {
    return `${n.slice(0, 2)} não é um DDD que existe. Confira os dois primeiros dígitos.`
  }
  // celular brasileiro ganhou o nono dígito em 2016, e ele é sempre 9
  if (n.length === 11 && n[2] !== '9') {
    return 'Celular com 11 dígitos começa com 9 depois do DDD.'
  }
  return null
}

export const telefoneValido = (bruto: string | null | undefined): boolean =>
  erroDoTelefone(bruto) === null

/** O que vai para o banco: só dígitos, ou `null` quando não há telefone. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  return soDigitos(bruto ?? '') || null
}

/**
 * O número **guardado**, para ler na tela. Não é o mesmo que `mascararTelefone`.
 *
 * A máscara serve para quem digita, e por isso vai formatando o que chega: com
 * três dígitos ela já abre parênteses, porque quem está digitando sabe que
 * ainda falta o resto. Aplicada a um número salvo pela metade, ela mente. Um
 * cadastro com `985285028` aparecia como `(98) 5285-028`, e a ficha dizia
 * "falta o DDD" logo embaixo: os parênteses promoviam a dezena do celular a
 * DDD do Maranhão, e a tela passava a discordar de si mesma.
 *
 * Aqui o DDD só ganha parênteses quando ele existe. Quando não existe, o lugar
 * dele aparece vazio, como `XX`, que é o que a nota abaixo pede para preencher.
 */
export function exibirTelefone(bruto: string | null | undefined): string {
  const n = soDigitos(bruto ?? '')

  if ((n.length === 10 || n.length === 11) && DDDS.has(Number(n.slice(0, 2)))) {
    return mascararTelefone(n)
  }
  if (n.length === 9) return `(XX) ${n.slice(0, 5)}-${n.slice(5)}`
  if (n.length === 8) return `(XX) ${n.slice(0, 4)}-${n.slice(4)}`
  return n
}

/** O código do Brasil, que o WhatsApp manda e o cadastro não guarda. */
const DDI_BRASIL = '55'

/**
 * As formas em que este número pode estar gravado, para procurar o cadastro.
 *
 * **É o que permite o bot reconhecer quem já é aluno.** A automação chega com o
 * identificador do WhatsApp — `5544998887766`, com país e sem máscara — e o
 * cadastro guarda `44998887766`, sem país, porque é o que a recepção digita.
 * Comparar literalmente diz que são duas pessoas.
 *
 * Devolve **lista**, e não um valor único, por causa do nono dígito. Celular
 * brasileiro ganhou um `9` na frente em 2016, mas o identificador de contas
 * antigas do WhatsApp continua vindo sem ele: o mesmo aparelho aparece como
 * `5544998887766` na conversa e `4498887766` na ficha. Em vez de eleger uma
 * forma canônica e torcer para o outro lado ter escolhido a mesma, geramos
 * todas as que significam o mesmo aparelho e procuramos por qualquer uma.
 *
 * Lista vazia quer dizer **não dá para procurar com segurança**, e é o caso do
 * número sem DDD: `98765-4321` pode ser de onze estados, e chutar o DDD da conta
 * casaria a conversa de uma pessoa com a ficha de outra. Não reconhecer é um
 * caminho normal — reconhecer errado não tem conserto.
 */
export function chavesDeBusca(bruto: string): string[] {
  const todos = soDigitos(bruto)
  if (!todos) return []

  const semDdi =
    todos.startsWith(DDI_BRASIL) && (todos.length === 12 || todos.length === 13)
      ? todos.slice(2)
      : todos

  if (semDdi.length !== 10 && semDdi.length !== 11) return []
  if (!DDDS.has(Number(semDdi.slice(0, 2)))) return []

  const ddd = semDdi.slice(0, 2)
  const numero = semDdi.slice(2)
  const chaves = new Set([`${ddd}${numero}`])

  if (numero.length === 9 && numero.startsWith('9')) {
    // Com o nono dígito: gera também a forma antiga, sem ele.
    chaves.add(`${ddd}${numero.slice(1)}`)
  } else if (numero.length === 8 && /^[6-9]/.test(numero)) {
    // Sem o nono, e o primeiro dígito diz que é celular. Fixo começa com 2 a 5
    // e nunca ganhou nono dígito — inventar um criaria uma chave que não existe
    // em cadastro nenhum.
    chaves.add(`${ddd}9${numero}`)
  }

  return [...chaves]
}
