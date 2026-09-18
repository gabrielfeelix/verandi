# -*- coding: utf-8 -*-
"""Importa a grade fixa do MGM a partir da lista de turma e presença.

    set -a && . ../.secrets/4yu.env && set +a
    python3 planilhas/importa_grade.py "LISTA DE TURMA E PRESENÇA - SETEMBRO 26.xlsx"
    python3 planilhas/importa_grade.py "...xlsx" --confirmo

A planilha é a que o estúdio usa hoje: uma aba por dia, e dentro dela um bloco
por horário, com o professor escrito acima e as vagas numeradas à esquerda. O
leitor é o mesmo `extrai.py` que já servia à planilha de agosto — o formato não
mudou.

Cada bloco vira uma **série**: o horário fixo da semana que gera as sessões. A
capacidade é quantas vagas o bloco numera, e não um número igual para todos:
alguns horários têm 3 e outros 4. Horário marcado como fechado entra como série
inativa, e não some — some quer dizer "nunca existiu", inativo quer dizer "hoje
não tem".

Duas coisas que o arquivo faz e que quebram um leitor ingênuo:

**O professor é escrito uma vez e vale para os blocos seguintes do mesmo dia.**
Bloco sem nome herda de quem veio antes, que é como a folha é lida no papel.

**O openpyxl não abre este arquivo.** As imagens dele trazem um `pitchFamily`
fora da faixa que a biblioteca aceita, e ela desiste do arquivo inteiro com
"could not read worksheets". A cópia sem desenho é feita aqui, em memória de
disco temporária, e o original nunca é tocado.
"""
import json
import os
import re
import sys
import tempfile
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import openpyxl  # noqa: E402

REF = os.environ.get('VERANDI_SUPABASE_REF', 'xxxynoshwirupkdzwxbj')
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN')
SLUG = 'mgm-pilates'
SERVICO = 'Pilates aparelho'

# O índice do banco é 0=domingo, como em JavaScript.
DIA_NUM = {'SEGUNDA': 1, 'TERÇA': 2, 'QUARTA': 3, 'QUINTA': 4, 'SEXTA': 5, 'SÁBADO': 6}

# O nome curto que a folha usa para cada professora, e o nome inteiro dela.
PROFESSORAS = {
    'MARCIA': 'Márcia Gramani Mutti',
    'MÁRCIA': 'Márcia Gramani Mutti',
    'NATHALIA': 'Nathália Pereira Sandalo de Toledo',
    'NATHÁLIA': 'Nathália Pereira Sandalo de Toledo',
    'THALYA': 'Thalya Mendes Santos de Jesus',
    'CAROL': 'Carolina Cristina Molina Santana',
}


def sql(query):
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': query}).encode(),
        headers={
            'authorization': f'Bearer {TOKEN}',
            'content-type': 'application/json',
            'user-agent': 'curl/8.5.0',
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def sem_desenho(caminho):
    """Uma cópia do arquivo sem as imagens, que é o que o openpyxl engasga."""
    destino = os.path.join(tempfile.mkdtemp(), 'turmas.xlsx')
    origem = zipfile.ZipFile(caminho)
    saida = zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED)
    for item in origem.infolist():
        nome = item.filename
        if 'drawing' in nome.lower() or nome.startswith('xl/media/'):
            continue
        dado = origem.read(nome)
        if nome.endswith('.rels'):
            dado = re.sub(r'<Relationship[^>]*drawing[^>]*/>', '', dado.decode('utf8'), flags=re.I).encode('utf8')
        elif nome.startswith('xl/worksheets/') and nome.endswith('.xml'):
            dado = re.sub(r'<drawing[^>]*/>', '', dado.decode('utf8')).encode('utf8')
        saida.writestr(item, dado)
    saida.close()
    return destino


def limpo(v):
    return '' if v is None else str(v).strip()


def norm_hora(h):
    m = re.match(r'(\d{1,2})\s*h\s*(\d{0,2})', limpo(h), re.I)
    return f'{int(m.group(1)):02d}:{(m.group(2) or "00").zfill(2)}' if m else ''


def le_turmas(caminho):
    """Um bloco por horário, na mesma leitura que `extrai.py` faz."""
    wb = openpyxl.load_workbook(sem_desenho(caminho), data_only=True)
    turmas = []
    for ws in wb.worksheets:
        dia = ws.title.strip().upper()
        if dia not in DIA_NUM:
            continue
        cabecas = [r for r in range(1, ws.max_row + 1) if limpo(ws.cell(r, 1).value) == 'Vagas']
        ultima_prof = ''
        for i, cabeca in enumerate(cabecas):
            fim = cabecas[i + 1] - 1 if i + 1 < len(cabecas) else ws.max_row
            prof = ''
            for r in range(max(1, cabeca - 3), cabeca):
                v = limpo(ws.cell(r, 1).value)
                if v.startswith('Prof'):
                    prof = v.replace('Prof.', '').strip().upper()
            if prof:
                ultima_prof = prof
            else:
                prof = ultima_prof

            hora, codigo, capacidade, fechado = '', '', 0, False
            for r in range(cabeca + 1, fim + 1):
                vaga = ws.cell(r, 1).value
                if not hora:
                    hora = norm_hora(ws.cell(r, 2).value)
                if not codigo:
                    codigo = limpo(ws.cell(r, 3).value)
                if isinstance(vaga, int):
                    capacidade += 1
                if 'fech' in limpo(ws.cell(r, 5).value).lower():
                    fechado = True
            if not hora:
                continue
            turmas.append({
                'dia': dia, 'hora': hora, 'prof': prof,
                'codigo': codigo.lstrip('.'), 'capacidade': capacidade, 'fechado': fechado,
            })
    return turmas


def cita(v):
    return 'null' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"


def main():
    if not TOKEN:
        sys.exit('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
    if len(sys.argv) < 2:
        sys.exit('uso: python3 planilhas/importa_grade.py <planilha.xlsx> [--confirmo]')

    seco = '--confirmo' not in sys.argv
    turmas = le_turmas(sys.argv[1])

    conta = sql(f"select id from app_verandi.conta where slug = '{SLUG}'")
    if not conta:
        sys.exit(f"conta '{SLUG}' não encontrada")
    conta_id = conta[0]['id']

    servico = sql(f"select id from app_verandi.servico where conta_id = '{conta_id}' and nome = '{SERVICO}'")
    if not servico:
        sys.exit(f"serviço '{SERVICO}' não existe — rode scripts/semeia-mgm.mjs antes")
    servico_id = servico[0]['id']

    local = sql(f"select id from app_verandi.local where conta_id = '{conta_id}' limit 1")
    local_id = local[0]['id'] if local else None

    profs = {p['nome']: p['id'] for p in sql(f"select id, nome from app_verandi.profissional where conta_id = '{conta_id}'")}

    desconhecidas = sorted({t['prof'] for t in turmas if t['prof'] and t['prof'] not in PROFESSORAS})
    sem_prof = [t for t in turmas if not t['prof']]

    abertas = [t for t in turmas if not t['fechado']]
    print(f'{len(turmas)} turmas na planilha — {len(abertas)} abertas, {len(turmas) - len(abertas)} fechadas')
    print(f'{sum(t["capacidade"] for t in abertas)} vagas nas turmas abertas\n')
    for dia in DIA_NUM:
        doDia = [t for t in turmas if t['dia'] == dia]
        if doDia:
            print(f'  {dia.title():9} {len(doDia)} turmas · ' + ', '.join(
                f'{t["hora"]}{"(fechada)" if t["fechado"] else ""}' for t in doDia))
    if desconhecidas:
        print('\n  professor sem correspondência na equipe: ' + ', '.join(desconhecidas))
    if sem_prof:
        print(f'  turmas sem professor: {len(sem_prof)}')

    jaTem = sql(f"select count(*)::int as n from app_verandi.serie where conta_id = '{conta_id}'")[0]['n']
    if jaTem:
        sys.exit(f'\na conta já tem {jaTem} séries. Zere antes, ou a grade sairia dobrada.')

    if seco:
        print('\nensaio: nada foi gravado. Para valer: --confirmo')
        return

    # A vigência começa hoje: a grade descreve o que o estúdio faz agora, e
    # série retroativa geraria sessão de aula que já aconteceu.
    comandos = ['begin;']
    for t in turmas:
        prof_id = profs.get(PROFESSORAS.get(t['prof'], ''))
        comandos.append(
            'insert into app_verandi.serie (conta_id, servico_id, profissional_id, local_id, dia_semana, '
            'hora_inicio, duracao_min, capacidade, vigencia_inicio, ativo, codigo) values ('
            f"'{conta_id}', '{servico_id}', {cita(prof_id)}::uuid, {cita(local_id)}::uuid, {DIA_NUM[t['dia']]}, "
            f"'{t['hora']}'::time, 60, {max(t['capacidade'], 1)}, current_date, "
            f"{'false' if t['fechado'] else 'true'}, {cita(t['codigo'])});"
        )
    comandos.append('commit;')
    sql('\n'.join(comandos))

    n = sql(f"select count(*)::int as n from app_verandi.serie where conta_id = '{conta_id}'")[0]['n']
    print(f'\ngravado: {n} séries')


if __name__ == '__main__':
    main()
