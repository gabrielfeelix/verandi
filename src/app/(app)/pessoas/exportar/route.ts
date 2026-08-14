import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { listarPessoas, type FiltroPessoa } from '@/server/pessoas/consultas'
import { situacaoDe, DIAS_CURTOS } from '@/core/pessoas/situacao'

/**
 * A lista que está na tela, em planilha.
 *
 * Exporta **o filtro atual**, não a base inteira: quem clica em "Exportar"
 * depois de filtrar "sem telefone" quer os cinco, e receber os vinte e oito
 * seria a segunda vez que a pessoa tem que filtrar na mão.
 *
 * Ponto e vírgula, e não vírgula, porque o Excel em português abre `,` como
 * decimal e joga a planilha inteira numa coluna só. O BOM existe pelo mesmo
 * motivo prático: sem ele "Otávio" abre como "OtÃ¡vio".
 */
function celula(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: Request) {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))

  const url = new URL(req.url)
  const { linhas } = await listarPessoas(db, conta.contaId, {
    busca: url.searchParams.get('q') ?? undefined,
    filtros: url.searchParams.getAll('f') as FiltroPessoa[],
    tag: url.searchParams.get('t') ?? undefined,
    fuso: conta.fuso,
    tudo: true,
  })

  const cabecalho = [
    'Nome', 'Telefone', 'Identificador', rotulos.serie.singular,
    'Última presença', 'Situação', 'Faltas em 30 dias', 'Reposições em aberto',
  ]

  const corpo = linhas.map((p) => [
    p.nome,
    // no arquivo o número vai inteiro: exportar é justamente para poder ligar
    p.telefone,
    p.identificadorExterno,
    p.horarioFixo ? `${DIAS_CURTOS[p.horarioFixo.diaSemana]} ${p.horarioFixo.hora}` : '',
    p.ultimaPresenca ? p.ultimaPresenca.slice(0, 10) : '',
    situacaoDe(p).rotulo,
    p.faltasRecentes,
    p.reposicoesAbertas,
  ])

  const csv = '﻿' + [cabecalho, ...corpo]
    .map((l) => l.map(celula).join(';'))
    .join('\r\n')

  const hoje = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition':
        `attachment; filename="${rotulos.pessoa.plural.toLowerCase()}-${hoje}.csv"`,
    },
  })
}
