import openpyxl, re
exec(open('extrai.py').read().split("t, a = extrai")[0])
import mgm

turmas, _ = extrai('./limpo-AGOSTO.xlsx')
# normaliza e preenche professor para baixo dentro do dia
ultimo = {}
for t in turmas:
    t['hora_norm'] = mgm.norm_hora(t['hora'])
    p = mgm.norm_prof(t['prof'])
    if p: ultimo[t['dia']] = p
    t['prof_norm'] = p or ultimo.get(t['dia'], '')
turmas = [t for t in turmas if t['hora_norm']]
r = mgm.monta(turmas, '/home/gabfelix/dev/4yu-apps/autofluxos/MGM Pilates — Turmas e Alunos.xlsx')
print('turmas:', r[0], '| matriculadas:', r[1], '| linhas de aluno:', r[2])
