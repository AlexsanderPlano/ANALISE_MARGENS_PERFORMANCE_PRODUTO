#!/usr/bin/env python3
"""Gera documento completo de estatisticas do Projeto Ajuste Estoque 2025."""
import json
from collections import defaultdict, Counter

with open('dados/estatisticas_ajuste_estoque.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

produtos = data['produtos']
sem_log = data['sem_log']
sem_dre = data['sem_dre']
com_dre = [p for p in produtos if p['has_dre']]
normais = [p for p in com_dre if p['cmv_antes'] <= p['receita'] * 5]
distorcidos = [p for p in com_dre if p['cmv_antes'] > p['receita'] * 5]

# Saldos mensais
saldo_stats_antes = defaultdict(lambda: {'neg': 0, 'exc': 0, 'ok': 0, 'total': 0})
saldo_stats_depois = defaultdict(lambda: {'neg': 0, 'exc': 0, 'ok': 0, 'total': 0})
for p in produtos:
    for m_str, val in p.get('saldo_antes_mensal', {}).items():
        m = int(m_str)
        saldo_stats_antes[m]['total'] += 1
        if val < 0: saldo_stats_antes[m]['neg'] += 1
        elif val > 40: saldo_stats_antes[m]['exc'] += 1
        else: saldo_stats_antes[m]['ok'] += 1
    for m_str, val in p.get('saldo_depois_mensal', {}).items():
        m = int(m_str)
        saldo_stats_depois[m]['total'] += 1
        if val < 0: saldo_stats_depois[m]['neg'] += 1
        elif val > 40: saldo_stats_depois[m]['exc'] += 1
        else: saldo_stats_depois[m]['ok'] += 1

# Totals
tot_tempo = sum(p['tempo_exec_s'] for p in produtos)
tot_ops_a = sum(p['ops_antigas'] for p in produtos)
tot_ops_n = sum(p['ops_novas'] for p in produtos)
tot_ops_criadas = sum(p['ops_criadas'] for p in produtos)
tot_ops_excl = sum(p['ops_excluidas'] for p in produtos)
tot_manuais = sum(p['manuais_excl'] for p in produtos)
tot_mov = sum(p['movimentos'] for p in produtos)

# DRE normais
tot_rec_n = sum(p['receita'] for p in normais)
tot_cmv_a_n = sum(p['cmv_antes'] for p in normais)
tot_cmv_d_n = sum(p['cmv_depois'] for p in normais)
tot_dev_n = sum(p['devol_r'] for p in normais)

# DRE todos
tot_rec = sum(p.get('receita', 0) for p in com_dre)
tot_cmv_d = sum(p.get('cmv_depois', 0) for p in com_dre)

etapa_dist = Counter(p['ultima_etapa'] for p in produtos)
quebras = [p['quebra_pct'] for p in com_dre if p.get('quebra_pct', 0) > 0]
quebra_media = sum(quebras) / len(quebras) if quebras else 0

piores_saldo = []
for p in produtos:
    sa = p.get('saldo_antes_mensal', {})
    if '12' in sa:
        piores_saldo.append((p['nome'], sa['12']))
piores_saldo.sort(key=lambda x: x[1])

top_eco = sorted(normais, key=lambda x: x.get('economia', 0), reverse=True)
top_quebra = sorted([p for p in com_dre if p.get('quebra_pct', 0) > 0], key=lambda x: x['quebra_pct'], reverse=True)

meses = ['', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

chamadas = tot_ops_excl + tot_ops_criadas + len(produtos)*2 + len(produtos)*2 + tot_manuais + len(com_dre)

# === GERAR DOCUMENTO ===
lines = []
def L(s=''): lines.append(s)

L('=' * 80)
L('ESTATISTICAS COMPLETAS - PROJETO AJUSTE ESTOQUE 2025')
L('Chacara Sabor do Campo - Adm. Alexsander Machado CRA 20-22229')
L('Documento gerado automaticamente a partir dos logs de processamento')
L('=' * 80)
L()

L('## 1. ESCOPO E TIMELINE')
L(f'   Periodo oficial:          Dez/2025 - Mar/2026 (4 meses)')
L(f'   Primeiro log maquina:     28/01/2026 16:48 (Beterraba 500g)')
L(f'   Ultimo log maquina:       17/03/2026 02:32 (Tomate Snackton 200g)')
L(f'   Tempo execucao maquina:   {tot_tempo//3600}h {(tot_tempo%3600)//60}min {tot_tempo%60}s')
L(f'   Tempo medio por produto:  {tot_tempo//len(produtos)//60}min {(tot_tempo//len(produtos))%60}s')
L()

L('## 2. PRODUTOS')
L(f'   Total pastas processadas: {len(produtos) + len(sem_log)}')
L(f'   Com log de execucao:      {len(produtos)}')
L(f'   Sem log (5):              {", ".join(sem_log)}')
L(f'   Com DRE completa (E7):    {len(com_dre)}')
L(f'   Sem DRE (parados):        {len(sem_dre)}')
L(f'   DRE normais:              {len(normais)}')
L(f'   DRE distorcidos (CMV>5x): {len(distorcidos)}')
L()

L('## 3. DISTRIBUICAO POR ULTIMA ETAPA CONCLUIDA')
for e in sorted(etapa_dist.keys()):
    bar = '#' * etapa_dist[e]
    L(f'   Etapa {e}: {etapa_dist[e]:3d} produtos  {bar}')
L()

L('## 4. ORDENS DE PRODUCAO')
L(f'   OPs antigas encontradas:  {tot_ops_a:>6,}')
L(f'   OPs excluidas via API:    {tot_ops_excl:>6,}')
L(f'   OPs novas calculadas:     {tot_ops_n:>6,}')
L(f'   OPs criadas via API:      {tot_ops_criadas:>6,}')
L(f'   Reducao:                  {tot_ops_a:,} -> {tot_ops_n:,} (-{tot_ops_a-tot_ops_n:,}, -{(tot_ops_a-tot_ops_n)/tot_ops_a*100:.0f}%)')
L(f'   Ajustes manuais excl.:    {tot_manuais:>6,}')
L(f'   Movimentos importados:    {tot_mov:>6,}')
L()
L(f'   Relatorio OMIE (19/03/2026):')
L(f'   Total OPs no sistema:     5.906 (todas concluidas)')
L(f'   Qtd total produzida:      3.420.001 unidades')
L(f'   Criadas via Integracao:   100%')
L(f'   Periodo inclusao:         28/01/2026 - 17/03/2026')
L(f'   Meses: Jan/26=651, Fev/26=3.947, Mar/26=1.308')
L()

L('## 5. CHAMADAS API OMIE (estimativa)')
L(f'   Importar movimentos:      {len(produtos)*2:>6,}')
L(f'   Saldos (antes+depois):    {len(produtos)*2:>6,}')
L(f'   Excluir OPs:              {tot_ops_excl:>6,}')
L(f'   Criar OPs:                {tot_ops_criadas:>6,}')
L(f'   Excluir manuais:          {tot_manuais:>6,}')
L(f'   Buscar receita/devol:     {len(com_dre):>6,}')
L(f'   TOTAL:                    ~{chamadas:,}')
L()

L('## 6. DRE CONSOLIDADA (104 produtos normais)')
L(f'   Receita total:            R$ {tot_rec_n:>14,.2f}')
L(f'   CMV Antes:                R$ {tot_cmv_a_n:>14,.2f}')
L(f'   CMV Depois:               R$ {tot_cmv_d_n:>14,.2f}')
L(f'   Economia CMV:             R$ {tot_cmv_a_n-tot_cmv_d_n:>14,.2f}')
mg_a = (tot_rec_n - tot_cmv_a_n) / tot_rec_n * 100
mg_d = (tot_rec_n - tot_cmv_d_n) / tot_rec_n * 100
L(f'   Margem antes:             {mg_a:>10.1f}%')
L(f'   Margem depois:            {mg_d:>10.1f}%')
L(f'   Variacao margem:          +{mg_d - mg_a:.1f} p.p.')
L(f'   Devolucoes:               R$ {tot_dev_n:>14,.2f}')
L(f'   Quebra media:             {quebra_media:.1f}%')
L()

L('## 7. DRE CONSOLIDADA (todos 111 com DRE)')
L(f'   Receita total:            R$ {tot_rec:>14,.2f}')
L(f'   CMV Depois:               R$ {tot_cmv_d:>14,.2f}')
mg_all = (tot_rec - tot_cmv_d) / tot_rec * 100
L(f'   Margem depois:            {mg_all:>10.1f}%')
L()

L('## 8. SALDOS ANTES DO AJUSTE (mensal)')
L(f'   {"Mes":>4s} | {"Neg":>4s} | {"Exc>40":>6s} | {"OK":>4s} | {"Total":>5s} | {"%Neg":>5s}')
L(f'   {"-"*4:>4s} | {"-"*4:>4s} | {"-"*6:>6s} | {"-"*4:>4s} | {"-"*5:>5s} | {"-"*5:>5s}')
for m in range(1, 13):
    s = saldo_stats_antes[m]
    pct = s['neg'] / s['total'] * 100 if s['total'] > 0 else 0
    L(f'   {meses[m]:>4s} | {s["neg"]:>4d} | {s["exc"]:>6d} | {s["ok"]:>4d} | {s["total"]:>5d} | {pct:>4.0f}%')
L()

L('## 9. SALDOS DEPOIS DO AJUSTE (mensal)')
L(f'   {"Mes":>4s} | {"Neg":>4s} | {"Exc>40":>6s} | {"OK":>4s} | {"Total":>5s} | {"%Neg":>5s}')
L(f'   {"-"*4:>4s} | {"-"*4:>4s} | {"-"*6:>6s} | {"-"*4:>4s} | {"-"*5:>5s} | {"-"*5:>5s}')
for m in range(1, 13):
    s = saldo_stats_depois[m]
    pct = s['neg'] / s['total'] * 100 if s['total'] > 0 else 0
    L(f'   {meses[m]:>4s} | {s["neg"]:>4d} | {s["exc"]:>6d} | {s["ok"]:>4d} | {s["total"]:>5d} | {pct:>4.0f}%')
L()

L('## 10. TOP 20 PIORES SALDOS ANTES (DEZ/2025)')
for nome, saldo in piores_saldo[:20]:
    L(f'   {nome[:40]:40s} | {saldo:>10,.0f} un')
L()

L('## 11. TOP 20 MAIORES SALDOS - EXCESSO (DEZ/2025)')
for nome, saldo in reversed(piores_saldo[-20:]):
    L(f'   {nome[:40]:40s} | {saldo:>10,.0f} un')
L()

L('## 12. TOP 20 MAIORES ECONOMIAS CMV')
for p in top_eco[:20]:
    L(f'   {p["nome"][:35]:35s} | eco=R$ {p["economia"]:>10,.2f} | mg {p["margem_antes"]:5.1f}% -> {p["margem_depois"]:5.1f}%')
L()

L('## 13. PRODUTOS COM CMV DISTORCIDO (7)')
L('   (CMV antes > 5x receita — saldo negativo extremo distorceu o CMC)')
for p in sorted(distorcidos, key=lambda x: x['cmv_antes'], reverse=True):
    L(f'   {p["nome"][:35]:35s} | CMV_A=R$ {p["cmv_antes"]:>18,.2f} | Rec=R$ {p["receita"]:>10,.2f}')
L()

L('## 14. TOP 15 MAIORES QUEBRAS (%)')
for p in top_quebra[:15]:
    L(f'   {p["nome"][:35]:35s} | {p["quebra_pct"]:5.1f}% | devol=R$ {p["devol_r"]:>8,.2f} ({p["devol_q"]} un)')
L()

L('## 15. PRODUTOS SEM DRE - PENDENTES (78)')
L('   Falta rodar a Etapa 7 (reimportar + calcular DRE)')
# Agrupar por ultima etapa
by_etapa = defaultdict(list)
for p in produtos:
    if not p['has_dre']:
        by_etapa[p['ultima_etapa']].append(p['nome'])
for e in sorted(by_etapa.keys()):
    L(f'   --- Parados na Etapa {e} ({len(by_etapa[e])} produtos) ---')
    for nome in sorted(by_etapa[e]):
        L(f'       {nome}')
L()

L('## 16. PRODUTOS SEM LOG (5)')
for nome in sem_log:
    L(f'   {nome}')
L()

L('## 17. LISTA COMPLETA - TODOS OS 111 COM DRE')
L(f'   {"#":>3s} | {"Produto":<35s} | {"Receita":>12s} | {"CMV Antes":>12s} | {"CMV Depois":>12s} | {"Economia":>12s} | {"Mg.A":>6s} | {"Mg.D":>6s} | {"Quebra":>6s}')
L(f'   {"-"*3} | {"-"*35} | {"-"*12} | {"-"*12} | {"-"*12} | {"-"*12} | {"-"*6} | {"-"*6} | {"-"*6}')
for i, p in enumerate(sorted(com_dre, key=lambda x: x['nome']), 1):
    eco = p.get('economia', 0)
    L(f'   {i:3d} | {p["nome"][:35]:<35s} | {p["receita"]:>12,.2f} | {p["cmv_antes"]:>12,.2f} | {p["cmv_depois"]:>12,.2f} | {eco:>12,.2f} | {p["margem_antes"]:>5.1f}% | {p["margem_depois"]:>5.1f}% | {p["quebra_pct"]:>5.1f}%')

# Salvar
output = '\n'.join(lines)
with open('dados/ESTATISTICAS_AJUSTE_ESTOQUE_2025.txt', 'w', encoding='utf-8') as f:
    f.write(output)

print(output)
print()
print(f'=== Documento salvo em dados/ESTATISTICAS_AJUSTE_ESTOQUE_2025.txt ===')
