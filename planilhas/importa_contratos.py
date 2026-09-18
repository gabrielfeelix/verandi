# -*- coding: utf-8 -*-
"""Importa os contratos vigentes do MGM, do controle de pagamentos e renovações.

    set -a && . ../.secrets/4yu.env && set +a
    python3 planilhas/importa_contratos.py "CONTROLE DE PAGAMENTOS E RENOVAÇÕES.xlsx"
    python3 planilhas/importa_contratos.py "...xlsx" --confirmo

A planilha é o histórico inteiro do estúdio: uma faixa por aluno, e dentro dela
uma linha por matrícula ou renovação, desde 2014. O que interessa aqui é a
linha marcada como `vig` mais recente de cada um — é o contrato que está em pé
hoje. O resto é passado e fica onde está.

**Nenhuma cobrança é criada.** O que esses contratos deviam já foi pago, fora do
sistema, ao longo de anos. Materializar as parcelas agora encheria o financeiro
do estúdio de dívida que não existe, e o primeiro relatório sairia mentindo. As
cobranças passam a ser geradas a partir da próxima renovação, que é quando o
sistema vira o dono do ciclo.

O plano de cada linha vem escrito à mão e de setenta maneiras — "ANU 2X",
"anu2x", "ANUX 2X", "anux 2x" são o mesmo plano anual de duas vezes por semana.
A tradução está em `NORMALIZA`, e o que não casar é listado em vez de ser
adivinhado: contrato com plano errado cobra valor errado na renovação.

O preço gravado é o que o aluno **pagou**, não o de tabela. Um anual de 2x
fechado em 2025 custou R$ 6.300 e hoje custa R$ 6.600; usar a tabela de hoje
reescreveria o que foi combinado com a pessoa.
"""
import json
import os
import re
import sys
import tempfile
import urllib.request
import zipfile

import openpyxl

REF = os.environ.get('VERANDI_SUPABASE_REF', 'xxxynoshwirupkdzwxbj')
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN')
SLUG = 'mgm-pilates'

# Como a planilha escreve o plano -> o código dele no catálogo do sistema.
# A chave é o texto já sem espaço, sem acento e em maiúscula.
NORMALIZA = {
    'MEN1X': '001', 'MENS1X': '001', 'MEN': '001',
    'MEN2X': '002', 'MENS2X': '002', 'MENS': '002', 'MSEM2X': '002',
    'MEN3X': '003', 'MENS3X': '003',
    'TRI1X': '004', 'TRIM1X': '004',
    'TRI2X': '005', 'TRIM2X': '005', 'QUA2X': '005', 'QUAD2X': '005', 'BIM2X': '005',
    'TRI3X': '006', 'TRIM3X': '006',
    'SEM1X': '007',
    'SEM2X': '008', 'SEM': '008', 'SEXM2X': '008', 'SEX2X': '008', 'NA2X': '008',
    'SEM3X': '009', 'SEM32X': '009',
    'ANU1X': '010', 'ANUAL1X': '010',
    'ANU2X': '011', 'AN2X': '011', 'ANE2X': '011', 'ANUX2X': '011', 'ANUAL2X': '011', 'ANU': '011',
    'ANU3X': '012', 'ANUAL3X': '012',
    'PER2X': '014', 'PERS2X': '014', 'PRS2X': '014', 'PERSN2X': '014',
    'PERSEM2X': '014', 'PERS2XSEM': '014', 'PERS': '014',
    'PER10S': '015', '10SES': '015',
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
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        # O corpo do erro é onde o Postgres diz o que recusou; sem ele sobra
        # "400 Bad Request", que não ajuda ninguém.
        raise SystemExit(f'banco recusou: {e.read().decode()[:500]}')


def sem_desenho(caminho):
    """O openpyxl desiste destes arquivos por causa das imagens; a cópia não as tem."""
    destino = os.path.join(tempfile.mkdtemp(), 'pag.xlsx')
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


def data(v):
    t = str(v or '')
    return t[:10] if re.match(r'\d{4}-\d{2}-\d{2}', t) else ''


def so_digito(v):
    """A matrícula aparece como ".007" num lugar e como "7" no outro; o zero à
    esquerda é resto de formatação e não distingue ninguém."""
    d = re.sub(r'\D', '', str(v or ''))
    return str(int(d)) if d else ''


def chave_plano(v):
    """"ANU 2X", "anu2x" e "ANUX 2X" são a mesma coisa escrita de três jeitos."""
    t = str(v or '').upper()
    t = (t.replace('Ã', 'A').replace('Á', 'A').replace('Ê', 'E').replace('É', 'E')
          .replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U').replace('Ç', 'C'))
    return re.sub(r'[^A-Z0-9]', '', t)


def valor_cent(v):
    """O valor vem como número ou como "1.740,00"."""
    if isinstance(v, (int, float)):
        return round(float(v) * 100)
    t = re.sub(r'[^\d,.]', '', str(v or ''))
    if not t:
        return None
    t = t.replace('.', '').replace(',', '.') if ',' in t else t
    try:
        return round(float(t) * 100)
    except ValueError:
        return None


def le_vigentes(caminho):
    """A linha `vig` mais recente de cada aluno — o contrato que está em pé."""
    ws = openpyxl.load_workbook(sem_desenho(caminho), data_only=True)['ATIVOS']
    por_aluno, atual = [], None
    for linha in ws.iter_rows(min_row=7, values_only=True):
        nome = str(linha[0]).strip() if linha[0] else ''
        if nome:
            atual = {'nome': nome, 'matricula': so_digito(linha[1]), 'vigentes': []}
            por_aluno.append(atual)
        if atual and str(linha[10] or '').strip().lower().startswith('vig'):
            atual['vigentes'].append({
                'renovacao': data(linha[5]),
                'inicio': data(linha[6]),
                'fim': data(linha[9]) or data(linha[7]),  # a licença adia o vencimento
                'plano': str(linha[11] or '').strip(),
                'valor_cent': valor_cent(linha[12]),
                # A coluna "Forma" da planilha é o parcelamento ("12 X 525,00"),
                # não a forma de pagamento. O banco só aceita pix, dinheiro,
                # crédito, débito, transferência ou boleto, e a planilha não
                # registra nenhum deles em lugar nenhum: fica vazio em vez de
                # virar palpite. O parcelamento se deduz do plano e do valor.
                'parcelamento': str(linha[13] or '').strip(),
            })
    contratos = []
    for a in por_aluno:
        if not a['vigentes']:
            continue
        # Dois alunos têm duas linhas vigentes; vale a renovação mais recente.
        ultimo = sorted(a['vigentes'], key=lambda v: v['renovacao'] or v['inicio'])[-1]
        contratos.append({**ultimo, 'nome': a['nome'], 'matricula': a['matricula']})
    return contratos


def cita(v):
    return 'null' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"


def main():
    if not TOKEN:
        sys.exit('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
    if len(sys.argv) < 2:
        sys.exit('uso: python3 planilhas/importa_contratos.py <planilha.xlsx> [--confirmo]')

    seco = '--confirmo' not in sys.argv
    contratos = le_vigentes(sys.argv[1])

    conta = sql(f"select id from app_verandi.conta where slug = '{SLUG}'")
    if not conta:
        sys.exit(f"conta '{SLUG}' não encontrada")
    conta_id = conta[0]['id']

    pessoas = {
        so_digito(p['identificador_externo']): p
        for p in sql(f"select id, nome, identificador_externo from app_verandi.pessoa where conta_id = '{conta_id}'")
        if p['identificador_externo']
    }
    planos = {
        p['codigo']: p
        for p in sql(f"select id, codigo, nome from app_verandi.plano where conta_id = '{conta_id}'")
    }

    prontos, sem_pessoa, sem_plano, sem_data = [], [], [], []
    for c in contratos:
        pessoa = pessoas.get(c['matricula'])
        codigo = NORMALIZA.get(chave_plano(c['plano']))
        plano = planos.get(codigo) if codigo else None
        if not pessoa:
            sem_pessoa.append(c)
        elif not plano:
            sem_plano.append(c)
        elif not c['inicio']:
            sem_data.append(c)
        else:
            prontos.append({**c, 'pessoa': pessoa, 'plano_id': plano['id'], 'plano_nome': plano['nome']})

    print(f'{len(contratos)} contratos vigentes na planilha\n')
    print(f'  {len(prontos)} prontos para importar')
    for rotulo, lista in (('sem pessoa cadastrada', sem_pessoa), ('plano não reconhecido', sem_plano), ('sem data de início', sem_data)):
        if lista:
            print(f'\n  {len(lista)} {rotulo}:')
            for c in lista:
                print(f"     mat {c['matricula'] or '—':>5}  {c['nome'][:32]:34} {c['plano'][:14]:16} {c['inicio']}")

    if seco:
        print('\nensaio: nada foi gravado. Para valer: --confirmo')
        return

    jaTem = sql(f"select count(*)::int as n from app_verandi.contrato where conta_id = '{conta_id}'")[0]['n']
    if jaTem:
        sys.exit(f'a conta já tem {jaTem} contratos. Zere antes, ou sairiam dobrados.')

    comandos = ['begin;']
    for c in prontos:
        dia = int(c['inicio'][8:10])
        comandos.append(
            'insert into app_verandi.contrato (conta_id, pessoa_id, plano_id, inicio, fim, dia_vencimento, '
            'preco_aplicado_cent, vinculo_usado, forma_pagamento, status) values ('
            f"'{conta_id}', '{c['pessoa']['id']}', '{c['plano_id']}', '{c['inicio']}'::date, "
            f"{cita(c['fim'])}::date, {dia}, {c['valor_cent'] or 0}, false, null, 'ativo');"
        )
    comandos.append('commit;')
    sql('\n'.join(comandos))

    n = sql(f"select count(*)::int as n from app_verandi.contrato where conta_id = '{conta_id}'")[0]['n']
    print(f'\ngravado: {n} contratos — nenhuma cobrança criada')


if __name__ == '__main__':
    main()
