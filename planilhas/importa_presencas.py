# -*- coding: utf-8 -*-
"""A presença anotada na lista de turma do MGM, para o histórico do sistema.

    set -a && . ../.secrets/4yu.env && set +a
    python3 planilhas/importa_presencas.py "LISTA ... - SETEMBRO 26.xlsx" [--pula 2026-10-06] [--confirmo]

Pedido do MGM (07/out/2026): ver o histórico de setembro, que só existia na
planilha. `importa_vagas.py` tinha deixado a presença de fora por falta de
legenda; a legenda abaixo foi decidida com o Gabriel nesta data.

- `P...` (P, P REP, P ANT, P EXP, P AULA...): presente. Com "REP" na célula, a
  origem é reposição.
- `F`, `F EXP`, `F REP`, `F ANT`: falta. `FAR`: falta justificada. `LIC`: licença.
- `FER`: feriado, sem aula. `X`, `XX`, horário solto ("16H"), `FISIO`, `FASCIA`
  e o resto: ignorados (outro serviço ou sentido incerto).

O que não muda:

- **Registro feito no sistema** (recepção, bot, profissional) nunca é
  sobrescrito: só participação ainda `esperada`/`confirmada` vinda da
  importação ou do sistema ganha o status da planilha.
- **Data futura** fica de fora (a planilha já traz licença marcada à frente), e
  `--pula` tira dias inteiros (o 06/10, que o Gabriel faz com o cliente).
- Linha de personal, domicílio e fisioterapia, como em `importa_vagas.py`.

Sessão que não existe (antes de 18/09 a agenda não tinha gerado) é criada
com os dados da série. Pode rodar de novo: o que já está gravado não duplica.
"""
import os
import re
import sys
import unicodedata
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import openpyxl  # noqa: E402
from importa_grade import DIA_NUM, limpo, norm_hora, sem_desenho, sql  # noqa: E402
from importa_vagas import FORA, MES, SERVICO, SLUG  # noqa: E402


def chave(nome):
    """Nome sem acento, caixa e espaço sobrando: "Lucília  Cini" = "LUCILIA CINI"."""
    s = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'\s+', ' ', re.sub(r'\(.*?\)', '', s)).strip()


def status_de(celula):
    """(status, é_reposição) ou None quando a célula não vira registro."""
    v = re.sub(r'\s+', ' ', celula.strip().upper())
    if not v:
        return None
    rep = 'REP' in v
    if v.startswith('P') and not v.startswith('PERS'):
        return ('presente', rep)
    if v == 'FAR':
        return ('falta_avisada', False)
    if v == 'F' or re.match(r'^F (EXP|REP|ANT)', v):
        return ('falta', rep)
    if v == 'LIC':
        return ('licenca', False)
    return None


def le(caminho, ano, mes):
    """Uma linha por (data, hora, matrícula) com o que a célula diz."""
    wb = openpyxl.load_workbook(sem_desenho(caminho), data_only=True)
    registros, ignorados = [], {}
    for ws in wb.worksheets:
        dia = ws.title.strip().upper()
        if dia not in DIA_NUM:
            continue
        cabecas = [r for r in range(1, ws.max_row + 1) if limpo(ws.cell(r, 1).value) == 'Vagas']
        for i, cabeca in enumerate(cabecas):
            fim = cabecas[i + 1] - 1 if i + 1 < len(cabecas) else ws.max_row
            hora = norm_hora(ws.cell(cabeca + 1, 2).value)
            # o número do dia está no cabeçalho, às vezes com anotação ("11 nath")
            colunas = {}
            for c in range(9, ws.max_column + 1):
                m = re.match(r'\s*(\d{1,2})', limpo(ws.cell(cabeca, c).value))
                if m:
                    colunas[c] = date(ano, mes, int(m.group(1))).isoformat()
            for r in range(cabeca + 1, fim + 1):
                mat = limpo(ws.cell(r, 4).value)
                nome = re.sub(r'\s+', ' ', limpo(ws.cell(r, 5).value))
                if not nome or FORA.search(nome):
                    continue
                na_vaga = isinstance(ws.cell(r, 1).value, int)
                for c, dia_iso in colunas.items():
                    celula = limpo(ws.cell(r, c).value)
                    st = status_de(celula)
                    if not st:
                        if celula:
                            ignorados[celula.upper()] = ignorados.get(celula.upper(), 0) + 1
                        continue
                    registros.append({'data': dia_iso, 'dia': dia, 'hora': hora, 'mat': mat,
                                      'nome': nome, 'status': st[0], 'rep': st[1],
                                      'na_vaga': na_vaga})
    return registros, ignorados


def main():
    if not os.environ.get('SUPABASE_ACCESS_TOKEN'):
        sys.exit('falta SUPABASE_ACCESS_TOKEN: carregue o .secrets/4yu.env')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit('uso: importa_presencas.py <planilha.xlsx> [--pula AAAA-MM-DD] [--confirmo]')
    seco = '--confirmo' not in sys.argv
    pula = {sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == '--pula'}
    args = [a for a in args if a not in pula]
    caminho = args[0]

    m = re.search(r'-\s*(\w+)\s+(\d{2})', os.path.basename(caminho).upper())
    if not m or m.group(1) not in MES:
        sys.exit('o nome do arquivo não diz o mês ("... - SETEMBRO 26.xlsx")')
    ano, mes = 2000 + int(m.group(2)), MES[m.group(1)]

    conta = sql(f"select id, fuso from app_verandi.conta where slug = '{SLUG}'")[0]
    conta_id, fuso = conta['id'], conta['fuso']
    hoje = sql(f"select (now() at time zone '{fuso}')::date::text as d")[0]['d']
    servico_id = sql(f"select id from app_verandi.servico where conta_id = '{conta_id}' "
                     f"and nome = '{SERVICO}'")[0]['id']

    todas = sql("select id, identificador_externo as m, nome from app_verandi.pessoa "
                f"where conta_id = '{conta_id}'")
    pessoas = {str(int(p['m'])): p for p in todas if (p['m'] or '').isdigit()}

    def por_nome(nome):
        """Sem matrícula na linha: só vale quando o nome aponta um aluno só."""
        k = chave(nome)
        if len(k) < 3:
            return None
        iguais = [p for p in todas if chave(p['nome']) == k]
        if len(iguais) == 1:
            return iguais[0]
        comeca = [p for p in todas if chave(p['nome']).startswith(k + ' ')]
        return comeca[0] if len(comeca) == 1 else None
    series = {(s['dia'], s['hora']): s for s in sql(
        "select id, dia_semana as dia, to_char(hora_inicio, 'HH24:MI') as hora "
        f"from app_verandi.serie where conta_id = '{conta_id}' and servico_id = '{servico_id}'")}

    registros, ignorados = le(caminho, ano, mes)
    validos, futuros, pulados, sem_pessoa, sem_turma = [], 0, 0, set(), set()
    for r in registros:
        if r['data'] in pula:
            pulados += 1
            continue
        if r['data'] > hoje:
            futuros += 1
            continue
        pessoa = (pessoas.get(str(int(r['mat']))) if r['mat'].isdigit() else None) \
            or por_nome(r['nome'])
        if not pessoa:
            sem_pessoa.add(f"{r['mat'] or 'sem nº'} {r['nome']}")
            continue
        serie = series.get((DIA_NUM[r['dia']], r['hora']))
        if not serie:
            sem_turma.add(f"{r['dia'][:3].title()} {r['hora']}")
            continue
        origem = 'reposicao' if r['rep'] else ('recorrente' if r['na_vaga'] else 'avulso')
        validos.append((serie['id'], r['data'], pessoa['id'], r['status'], origem))

    # a mesma pessoa duas vezes no mesmo horário (linha repetida): vale a última
    unicos = {(s, d, p): (st, o) for s, d, p, st, o in validos}
    por_status = {}
    for st, _ in unicos.values():
        por_status[st] = por_status.get(st, 0) + 1
    print(f'{os.path.basename(caminho)}: {len(unicos)} registros até {hoje}')
    print('  ' + ', '.join(f'{k}: {v}' for k, v in sorted(por_status.items())))
    print(f'  {len({(s, d) for s, d, _ in unicos})} aulas; fora: {futuros} futuros, {pulados} do dia pulado')
    if sem_pessoa:
        print(f'  matrícula sem cadastro ({len(sem_pessoa)}): ' + '; '.join(sorted(sem_pessoa)))
    if sem_turma:
        print(f'  horário sem turma ({len(sem_turma)}): ' + ', '.join(sorted(sem_turma)))
    if ignorados:
        print('  células ignoradas: ' + ', '.join(f'{k} ({v})' for k, v in
                                                 sorted(ignorados.items(), key=lambda x: -x[1])))

    if seco:
        print('  ensaio: nada foi gravado. Para valer: --confirmo')
        return

    linhas = ',\n'.join(
        f"('{s}'::uuid, '{d}'::date, '{p}'::uuid, '{st}', '{o}')"
        for (s, d, p), (st, o) in unicos.items())
    antes = sql(f"select count(*)::int as n from app_verandi.participacao where conta_id = '{conta_id}'")[0]['n']
    sql(f"""
begin;
create temp table imp (serie_id uuid, dia date, pessoa_id uuid, status text, origem text) on commit drop;
insert into imp values
{linhas};

-- a aula que a agenda ainda não tinha gerado nasce com os dados da série
insert into app_verandi.sessao (conta_id, serie_id, servico_id, profissional_id, local_id,
                                inicio, duracao_min, capacidade, status)
select distinct se.conta_id, se.id, se.servico_id, se.profissional_id, se.local_id,
       (i.dia + se.hora_inicio) at time zone '{fuso}', se.duracao_min, se.capacidade,
       'prevista'::app_verandi.status_sessao
from imp i join app_verandi.serie se on se.id = i.serie_id
on conflict (serie_id, inicio) do nothing;

-- registro novo entra; o que ainda espera chamada (da importação ou do
-- sistema) ganha o status; o que alguém registrou não é tocado
insert into app_verandi.participacao (conta_id, sessao_id, pessoa_id, origem, status,
                                      registrado_por_origem)
select '{conta_id}', s.id, i.pessoa_id, i.origem::app_verandi.origem_participacao,
       i.status::app_verandi.status_participacao, 'importacao'
from imp i
join app_verandi.serie se on se.id = i.serie_id
join app_verandi.sessao s on s.serie_id = i.serie_id
 and s.inicio = (i.dia + se.hora_inicio) at time zone '{fuso}'
on conflict (sessao_id, pessoa_id) do update set status = excluded.status
where app_verandi.participacao.status in ('esperada', 'confirmada')
  and app_verandi.participacao.registrado_por_origem in ('importacao', 'sistema');
commit;
""")
    depois = sql(f"select count(*)::int as n from app_verandi.participacao where conta_id = '{conta_id}'")[0]['n']
    print(f'  gravado: {depois - antes} participações novas (as demais atualizadas ou já registradas)')


if __name__ == '__main__':
    main()
