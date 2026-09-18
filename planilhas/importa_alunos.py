# -*- coding: utf-8 -*-
"""Importa a lista de alunos ativos do MGM para a conta dele na Verandi.

    set -a && . ../.secrets/4yu.env && set +a
    python3 planilhas/importa_alunos.py "CADASTRO DE ALUNOS ATIVOS.xlsx"
    python3 planilhas/importa_alunos.py "CADASTRO DE ALUNOS ATIVOS.xlsx" --confirmo

A planilha tem CPF e telefone de gente de verdade e **não entra no
repositório**. O script a lê de onde ela estiver, por caminho.

O que a planilha traz: matrícula, nome, nascimento, CPF, celular, e-mail e o
contrato de cada um. O contrato é o que faltava até agora para saber quem
comprou o quê — mas ele não vira contrato no sistema aqui, porque contrato
precisa de data de início e de valor pago, e a planilha não diz nenhum dos
dois. Ele fica anotado na observação interna da pessoa, de onde quem for
digitar a matrícula o lê sem ter que abrir o Excel de novo.

O telefone vem em formatos diferentes e vários sem o nono dígito ("11
9805-8827" tem dez). A normalização é a mesma de `mgm.py`, e o número que não
couber em onze dígitos é gravado como veio, para ninguém perder contato por
causa de um palpite.
"""
import json
import os
import re
import sys
import urllib.request

import openpyxl

REF = os.environ.get('VERANDI_SUPABASE_REF', 'xxxynoshwirupkdzwxbj')
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN')
SLUG = 'mgm-pilates'
PRIMEIRA_LINHA = 8  # a planilha tem seis linhas de cabeçalho e o título na 7


def sql(query):
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': query}).encode(),
        headers={
            'authorization': f'Bearer {TOKEN}',
            'content-type': 'application/json',
            # Sem User-Agent explícito o Cloudflare da api.supabase.com devolve 403.
            'user-agent': 'curl/8.5.0',
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def texto(v):
    return '' if v is None else str(v).strip()


def norm_fone(f):
    """O formato dominante na planilha vem sem o nono dígito, e às vezes sem DDD."""
    d = re.sub(r'\D', '', texto(f))
    if not d:
        return ''
    if len(d) == 9:
        d = '11' + d
    elif len(d) == 8:
        d = '119' + d
    elif len(d) == 10:
        d = d[:2] + '9' + d[2:]
    return f'({d[:2]}) {d[2:7]}-{d[7:11]}' if len(d) == 11 else texto(f)


def norm_cpf(v):
    d = re.sub(r'\D', '', texto(v))
    return f'{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}' if len(d) == 11 else texto(v)


def norm_nome(v):
    return ' '.join(texto(v).split())


def norm_nasc(v):
    t = texto(v)
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', t)
    if m:
        return t[:10]
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', t)
    if m:
        return f'{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}'
    return None


def norm_mat(v):
    """As matrículas vêm como '.007' e '106' — o ponto é resto de formatação."""
    return texto(v).lstrip('.')


def cita(v):
    if v is None or v == '':
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"


def le(caminho):
    ws = openpyxl.load_workbook(caminho, data_only=True).worksheets[0]
    alunos = []
    for linha in ws.iter_rows(min_row=PRIMEIRA_LINHA, values_only=True):
        if not any(c is not None and texto(c) for c in linha):
            continue
        mat, nome, nasc, _idade, cpf, cel, email, contrato = (list(linha) + [None] * 8)[:8]
        alunos.append({
            'matricula': norm_mat(mat),
            'nome': norm_nome(nome),
            'nascimento': norm_nasc(nasc),
            'cpf': norm_cpf(cpf),
            'telefone': norm_fone(cel),
            'email': texto(email).lower(),
            'contrato': texto(contrato),
        })
    return alunos


def main():
    if not TOKEN:
        sys.exit('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
    if len(sys.argv) < 2:
        sys.exit('uso: python3 planilhas/importa_alunos.py <planilha.xlsx> [--confirmo]')

    caminho = sys.argv[1]
    seco = '--confirmo' not in sys.argv
    alunos = le(caminho)

    conta = sql(f"select id from app_verandi.conta where slug = '{SLUG}'")
    if not conta:
        sys.exit(f"conta '{SLUG}' não encontrada")
    conta_id = conta[0]['id']

    print(f'{len(alunos)} alunos na planilha\n')

    sem_email = [a['nome'] for a in alunos if not a['email']]
    sem_cpf = [a['nome'] for a in alunos if not a['cpf']]
    # "gmail.cop" passa em qualquer validação de formato: o que denuncia o erro
    # de digitação é o fim do endereço, não a sintaxe dele.
    fim_conhecido = ('.com', '.com.br', '.br', '.net', '.org', '.org.br', '.gov.br', '.edu.br')
    suspeito = [
        f"{a['nome']} ({a['email']})"
        for a in alunos
        if a['email']
        and (
            not re.match(r'^[^@\s]+@[^@\s]+\.[a-z]{2,}$', a['email'])
            or not a['email'].endswith(fim_conhecido)
        )
    ]
    for rotulo, lista in (('sem e-mail', sem_email), ('sem CPF', sem_cpf), ('e-mail suspeito', suspeito)):
        if lista:
            print(f'  {rotulo}: ' + ', '.join(lista))

    jaTem = sql(f"select count(*)::int as n from app_verandi.pessoa where conta_id = '{conta_id}'")[0]['n']
    if jaTem:
        sys.exit(f'\na conta já tem {jaTem} pessoas. Zere antes, ou o script duplicaria o cadastro.')

    if seco:
        print('\nensaio: nada foi gravado. Para valer: --confirmo')
        return

    comandos = ['begin;']
    for a in alunos:
        # O contrato da planilha vira observação interna, não contrato no
        # sistema: contrato precisa de data de início e de valor, e a planilha
        # não traz nenhum dos dois.
        obs = f"Plano na planilha de alunos ativos: {a['contrato']}" if a['contrato'] else None
        comandos.append(
            "insert into app_verandi.pessoa "
            "(conta_id, nome, telefone, email, nascimento, cpf, identificador_externo, observacao, ativo) values ("
            f"'{conta_id}', {cita(a['nome'])}, {cita(a['telefone'])}, {cita(a['email'])}, "
            f"{cita(a['nascimento'])}::date, {cita(a['cpf'])}, {cita(a['matricula'])}, {cita(obs)}, true);"
        )
    comandos.append('commit;')
    sql('\n'.join(comandos))

    n = sql(f"select count(*)::int as n from app_verandi.pessoa where conta_id = '{conta_id}'")[0]['n']
    print(f'\ngravado: {n} pessoas')


if __name__ == '__main__':
    main()
