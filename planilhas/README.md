# Geradores das planilhas

`verandi.py` monta o **modelo anual** da Verandi. `mgm.py` + `extrai.py` montam
a planilha do MGM Pilates a partir da lista de turma que ele usa hoje.

```bash
python3 -m venv venv && ./venv/bin/pip install openpyxl
./venv/bin/python -c "import verandi; verandi.monta('Verandi — Modelo de Agenda.xlsx')"
```

## Duas coisas que quebram calado

**Fórmula vai em inglês, com vírgula.** O `.xlsx` guarda `COUNTIFS`, não
`CONT.SES` — o Excel só traduz na exibição. Escrever em português gera um
arquivo que abre com `#NOME?`.

**`FILTER` e `TEXTJOIN` pedem Excel 365 ou Google Sheets.** É opção consciente:
o destino é o Google Sheets, onde a planilha fica viva e o robô lê por API. Em
Excel 2019 a coluna de saída não calcula.

## A ideia do modelo

A aba **Grade** é a chave mestre — uma linha por horário, e não bloco
desenhado. Vagas livres, ocupação e a saída do robô saem dela por fórmula.
Acrescentar profissional, mudar capacidade ou abrir horário novo é acrescentar
linha, nunca redesenhar.
