# -*- coding: utf-8 -*-
"""Acrescenta a aba AutoFluxos à planilha do cliente **sem tocar no resto**.

O openpyxl não devolve imagem ao salvar — abrir e salvar a planilha do MGM
apagava a logo dele. Então o arquivo não é reescrito: a aba nova é injetada no
zip, e todo o resto sai byte a byte igual ao original.

O layout dele fica exatamente como está. A aba nova só observa.
"""
import zipfile, re, shutil
from xml.sax.saxutils import escape

def col(n):
    s = ''
    while n: n, r = divmod(n-1, 26); s = chr(65+r) + s
    return s

def celula(lin, c, valor=None, formula=None, estilo=0):
    ref = f'{col(c)}{lin}'
    s = f' s="{estilo}"' if estilo else ''
    if formula is not None:
        return f'<c r="{ref}"{s}><f>{escape(formula)}</f></c>'
    if isinstance(valor, (int, float)):
        return f'<c r="{ref}"{s}><v>{valor}</v></c>'
    if valor is None or valor == '':
        return f'<c r="{ref}"{s}/>'
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{escape(str(valor))}</t></is></c>'

def monta_xml(turmas, dias_ordem):
    linhas = []
    def add(lin, celulas): linhas.append(f'<row r="{lin}">' + ''.join(celulas) + '</row>')

    add(1, [celula(1, 1, 'AutoFluxos — horários com vaga')])
    add(2, [celula(2, 1, 'Aba lida pelo robô do WhatsApp. Ela apenas observa as abas de turma; nada aqui precisa ser editado.')])

    add(4, [celula(4, i+1, t) for i, t in enumerate(['Dia', 'Hora', 'Vagas', 'Ocupadas', 'Livres', 'Para o robô'])])
    r = 5
    faixas = {}
    for t in turmas:
        aba = t['aba']
        ini, fim = t['linha_ini'], t['linha_fim']
        add(r, [
            celula(r, 1, t['dia']),
            celula(r, 2, t['hora']),
            celula(r, 3, t['capacidade']),
            celula(r, 4, formula=f"COUNTA('{aba}'!E{ini}:E{fim})"),
            celula(r, 5, formula=f'MAX(0,C{r}-D{r})'),
            celula(r, 6, formula=f'IF(E{r}>0,B{r}&";","")'),
        ])
        faixas.setdefault(t['dia'], [r, r])[1] = r
        r += 1

    base = r + 2
    add(base, [celula(base, 1, 'Dia'), celula(base, 2, 'Horários com vaga'), celula(base, 3, 'Quantos')])
    for i, dia in enumerate(dias_ordem):
        lin = base + 1 + i
        f = faixas.get(dia)
        acc = ''
        if f:
            acc = '&'.join(f'F{x}' for x in range(f[0], f[1] + 1))
        add(lin, [
            celula(lin, 1, dia),
            celula(lin, 2, formula=(f'IF(({acc})="","",LEFT(({acc}),LEN(({acc}))-1))' if acc else None), valor=('' if acc else '')),
            celula(lin, 3, formula=f'IF(B{lin}="",0,LEN(B{lin})-LEN(SUBSTITUTE(B{lin},";",""))+1)'),
        ])
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetFormatPr defaultRowHeight="15"/>'
            '<cols><col min="1" max="1" width="12" customWidth="1"/>'
            '<col min="2" max="2" width="30" customWidth="1"/>'
            '<col min="3" max="6" width="11" customWidth="1"/></cols>'
            '<sheetData>' + ''.join(linhas) + '</sheetData></worksheet>'), base

def injeta(origem, destino, turmas, dias_ordem, nome_aba='AutoFluxos'):
    shutil.copy(origem, destino)
    zin = zipfile.ZipFile(origem)
    nomes = zin.namelist()
    usados = [int(m.group(1)) for n in nomes if (m := re.match(r'xl/worksheets/sheet(\d+)\.xml$', n))]
    novo = max(usados) + 1
    caminho = f'xl/worksheets/sheet{novo}.xml'

    wbxml = zin.read('xl/workbook.xml').decode('utf-8')
    ids = [int(m) for m in re.findall(r'sheetId="(\d+)"', wbxml)]
    rels = zin.read('xl/_rels/workbook.xml.rels').decode('utf-8')
    rids = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels)]
    rid = max(rids) + 1

    xml, _ = monta_xml(turmas, dias_ordem)
    wbxml = wbxml.replace('</sheets>', f'<sheet name="{nome_aba}" sheetId="{max(ids)+1}" r:id="rId{rid}"/></sheets>')
    rels = rels.replace('</Relationships>',
        f'<Relationship Id="rId{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{novo}.xml"/></Relationships>')
    ct = zin.read('[Content_Types].xml').decode('utf-8')
    ct = ct.replace('</Types>',
        f'<Override PartName="/{caminho}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')

    trocas = {'xl/workbook.xml': wbxml, 'xl/_rels/workbook.xml.rels': rels, '[Content_Types].xml': ct}
    zout = zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        dado = trocas.get(item.filename)
        zout.writestr(item, dado.encode('utf-8') if dado else zin.read(item.filename))
    zout.writestr(caminho, xml.encode('utf-8'))
    zout.close(); zin.close()
    return novo
