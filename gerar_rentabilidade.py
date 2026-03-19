#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GERAR RELATÓRIO DE RENTABILIDADE DE PRODUTOS E CLIENTES
Lê dados locais (vendas, devoluções, movimentos, comissões) e gera HTML.

Uso:
  python gerar_rentabilidade.py                    (todos)
  python gerar_rentabilidade.py --clientes         (só aba clientes)
  python gerar_rentabilidade.py --produtos         (só aba produtos)
"""

import sys
import time
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

# ============================================================================
# CONFIGURAÇÃO
# ============================================================================

PASTA_BASE = Path(__file__).parent
PASTA_DADOS = PASTA_BASE / 'dados'
PASTA_MOVIMENTOS = PASTA_DADOS / 'movimentos'

ARQUIVO_VENDAS = PASTA_DADOS / 'VENDAS_2025.xlsx'
ARQUIVO_DEVOLUCOES = PASTA_DADOS / 'DEVOLUCOES_2025.xlsx'
ARQUIVO_COMISSOES = PASTA_DADOS / 'Vendedor vs Comissão.xlsx'
ARQUIVO_SAIDA = PASTA_BASE / 'Rentabilidade_2025.html'

MESES_NOME = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
               'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
MES_PARA_NUM = {}
for i, m in enumerate(MESES_NOME, 1):
    MES_PARA_NUM[m] = i
# Variações de encoding
MES_PARA_NUM['Março'] = 3
MES_PARA_NUM['Marco'] = 3


# ============================================================================
# FORMATAÇÃO
# ============================================================================

def fmt_brl(valor):
    """Formata valor em BRL: R$ 1.234"""
    if abs(valor) >= 1000:
        return f"R$ {valor:,.0f}".replace(',', '.')
    return f"R$ {valor:,.0f}"

def fmt_brl_dec(valor):
    """Formata valor em BRL com decimais: R$ 1.234,56"""
    s = f"{valor:,.2f}"
    s = s.replace(',', 'X').replace('.', ',').replace('X', '.')
    return f"R$ {s}"

def fmt_num(valor):
    """Formata número com separador de milhar"""
    return f"{valor:,.0f}".replace(',', '.')

def fmt_pct(valor):
    """Formata percentual"""
    return f"{valor:.1f}%"

def cor_margem(pct):
    """Retorna classe CSS baseada na margem"""
    if pct >= 40:
        return 'mg-alta'
    elif pct >= 20:
        return 'mg-media'
    return 'mg-baixa'


# ============================================================================
# CARREGAR DADOS
# ============================================================================

def carregar_vendas():
    """Carrega vendas com normalização"""
    print("  Carregando vendas...")
    df = pd.read_excel(ARQUIVO_VENDAS)

    # Mapear colunas por posição (encoding pode variar)
    df.columns = ['Data', 'CFOP', 'RazaoSocial', 'CNPJ', 'NomeFantasia',
                  'NotaFiscal', 'Operacao', 'Produto', 'Quantidade',
                  'ValorUnitario', 'TotalNF', 'Situacao', 'Etapa', 'Mes', 'Categoria']

    df['Produto'] = df['Produto'].str.strip().str.upper()
    df['NomeFantasia'] = df['NomeFantasia'].str.strip()
    df['CNPJ'] = df['CNPJ'].str.strip()
    df['MesNum'] = df['Mes'].map(MES_PARA_NUM)

    print(f"    {len(df):,} linhas, {df['Produto'].nunique()} produtos, {df['NomeFantasia'].nunique()} clientes")
    return df


def carregar_devolucoes():
    """Carrega devoluções com normalização"""
    print("  Carregando devoluções...")
    df = pd.read_excel(ARQUIVO_DEVOLUCOES)

    df.columns = ['Data', 'Operacao', 'CNPJ', 'NomeFantasia', 'Produto',
                  'Quantidade', 'ValorUnitario', 'TotalNF', 'NFDevolucao',
                  'NFOriginal', 'Mes']

    df['Produto'] = df['Produto'].str.strip().str.upper()
    df['NomeFantasia'] = df['NomeFantasia'].str.strip()
    df['CNPJ'] = df['CNPJ'].str.strip()
    df['Quantidade'] = df['Quantidade'].abs()
    df['TotalNF'] = df['TotalNF'].abs()
    df['MesNum'] = df['Mes'].map(MES_PARA_NUM)

    print(f"    {len(df):,} linhas, {df['Produto'].nunique()} produtos, {df['NomeFantasia'].nunique()} clientes")
    return df


def carregar_cmv_movimentos():
    """Carrega CMV por produto × mês direto dos movimentos (cada venda × seu CMC).
    Metodologia exata do OMIE: usa o CMC vigente no momento de cada venda,
    filtrando cancelamentos. Divergência vs DRE OMIE: ~0,01%."""
    print("  Carregando CMV dos movimentos (por transação)...")
    cmv_data = {}

    if not PASTA_MOVIMENTOS.exists():
        print("    AVISO: pasta movimentos não encontrada")
        return cmv_data

    arquivos = list(PASTA_MOVIMENTOS.glob('*.xlsx'))
    print(f"    {len(arquivos)} arquivos de movimentos")

    for arq in arquivos:
        nome = arq.stem.upper()
        try:
            df = pd.read_excel(arq)
            df['Data'] = pd.to_datetime(df['Data'], dayfirst=True, errors='coerce')
            df = df.dropna(subset=['Data'])
            df_2025 = df[df['Data'].dt.year == 2025]

            if len(df_2025) == 0:
                continue

            # Identificar NFs canceladas
            cancelamentos = df_2025[df_2025['Origem'].str.contains('Cancelamento', na=False)]
            nfs_canceladas = set(cancelamentos['Nota Fiscal'].dropna().astype(int))

            # Vendas válidas (excluir canceladas)
            vendas = df_2025[df_2025['Origem'] == 'Venda de Produto']
            vendas_validas = vendas[~vendas['Nota Fiscal'].astype(int).isin(nfs_canceladas)]

            # CMV por mês = soma(Qtd × CMC de cada venda)
            mensal = {}
            for _, row in vendas_validas.iterrows():
                mes = row['Data'].month
                qtd = abs(row['Quantidade'])
                cmc = row['CMC Unitario']
                cmv_linha = qtd * cmc
                if mes not in mensal:
                    mensal[mes] = {'cmv': 0, 'qtd': 0}
                mensal[mes]['cmv'] += cmv_linha
                mensal[mes]['qtd'] += qtd

            # CMC ponderado do mês = CMV / Qtd (para exibição)
            for m in mensal:
                if mensal[m]['qtd'] > 0:
                    mensal[m]['cmc_pond'] = mensal[m]['cmv'] / mensal[m]['qtd']
                else:
                    mensal[m]['cmc_pond'] = 0

            cmv_data[nome] = mensal
        except Exception as e:
            print(f"    ERRO {arq.name}: {e}")

    print(f"    CMV carregado para {len(cmv_data)} produtos")
    return cmv_data


def carregar_comissoes():
    """Carrega % desconto financeiro e comissão por cliente (CNPJ)"""
    print("  Carregando comissões...")
    df = pd.read_excel(ARQUIVO_COMISSOES)

    df.columns = ['Tags', 'CNPJ', 'NomeFantasia', 'Vendedor', 'DescontoFinanceiro', 'Comissao']
    df['CNPJ'] = df['CNPJ'].str.strip()
    df['DescontoFinanceiro'] = df['DescontoFinanceiro'].fillna(0)
    df['Comissao'] = df['Comissao'].fillna(0)

    # Dict por CNPJ
    comissoes = {}
    for _, row in df.iterrows():
        comissoes[row['CNPJ']] = {
            'desc_fin': row['DescontoFinanceiro'],
            'comissao': row['Comissao'],
            'vendedor': row['Vendedor'] if pd.notna(row['Vendedor']) else ''
        }

    print(f"    {len(comissoes)} clientes com comissão")
    return comissoes


# ============================================================================
# CALCULAR RENTABILIDADE
# ============================================================================

def calcular(vendas, devolucoes, cmv_movimentos, comissoes):
    """Calcula rentabilidade por cliente × produto × mês.
    CMV usa dados por transação dos movimentos OMIE (exato como DRE OMIE)."""
    print("  Calculando rentabilidade...")

    # Agregar vendas por cliente × produto × mês
    vend_agg = vendas.groupby(['NomeFantasia', 'CNPJ', 'Produto', 'MesNum']).agg(
        qtd_vendida=('Quantidade', 'sum'),
        receita=('TotalNF', 'sum'),
        preco_medio=('ValorUnitario', 'mean')
    ).reset_index()

    # Agregar devoluções por cliente × produto × mês
    dev_agg = devolucoes.groupby(['NomeFantasia', 'Produto', 'MesNum']).agg(
        qtd_devolvida=('Quantidade', 'sum'),
        valor_devolvido=('TotalNF', 'sum')
    ).reset_index()

    # Merge
    merged = vend_agg.merge(dev_agg, on=['NomeFantasia', 'Produto', 'MesNum'], how='left')
    merged['qtd_devolvida'] = merged['qtd_devolvida'].fillna(0)
    merged['valor_devolvido'] = merged['valor_devolvido'].fillna(0)

    # CMV por transação: usa CMC ponderado do mês (calculado dos movimentos OMIE)
    def get_cmc_pond(produto, mes):
        """Retorna CMC ponderado do mês (CMV total / Qtd total dos movimentos)"""
        prod_upper = produto.upper().replace(' ', '_')
        for chave in [prod_upper, produto.upper()]:
            if chave in cmv_movimentos and mes in cmv_movimentos[chave]:
                return cmv_movimentos[chave][mes]['cmc_pond']
        return 0

    def get_cmv_total_produto(produto, mes):
        """Retorna CMV total do produto no mês (soma de cada venda × CMC do momento)"""
        prod_upper = produto.upper().replace(' ', '_')
        for chave in [prod_upper, produto.upper()]:
            if chave in cmv_movimentos and mes in cmv_movimentos[chave]:
                return cmv_movimentos[chave][mes]['cmv']
        return 0

    def get_qtd_mov(produto, mes):
        """Retorna qtd vendida nos movimentos OMIE para o produto no mês"""
        prod_upper = produto.upper().replace(' ', '_')
        for chave in [prod_upper, produto.upper()]:
            if chave in cmv_movimentos and mes in cmv_movimentos[chave]:
                return cmv_movimentos[chave][mes]['qtd']
        return 0

    # Para cada linha (cliente × produto × mês), distribuir o CMV proporcional à qtd
    # CMV do cliente = (qtd_cliente / qtd_total_produto_mes) × CMV_total_produto_mes
    def calcular_cmv_proporcional(row):
        prod = row['Produto']
        mes = int(row['MesNum'])
        qtd_cli = row['qtd_vendida']
        cmv_total = get_cmv_total_produto(prod, mes)
        qtd_total = get_qtd_mov(prod, mes)
        if qtd_total > 0 and qtd_cli > 0:
            return (qtd_cli / qtd_total) * cmv_total
        return 0

    merged['cmv'] = merged.apply(calcular_cmv_proporcional, axis=1)
    merged['cmc'] = np.where(merged['qtd_vendida'] > 0,
                              merged['cmv'] / merged['qtd_vendida'], 0)

    # Receita líquida
    merged['receita_liquida'] = merged['receita'] - merged['valor_devolvido']

    # Margem bruta
    merged['margem_bruta'] = merged['receita_liquida'] - merged['cmv']
    merged['margem_pct'] = np.where(merged['receita_liquida'] > 0,
                                     merged['margem_bruta'] / merged['receita_liquida'] * 100, 0)

    # % devolução
    merged['pct_dev'] = np.where(merged['qtd_vendida'] > 0,
                                  merged['qtd_devolvida'] / merged['qtd_vendida'] * 100, 0)

    # Comissão
    def get_comissao(cnpj):
        if cnpj in comissoes:
            return comissoes[cnpj].get('comissao', 0)
        return 0

    def get_desc_fin(cnpj):
        if cnpj in comissoes:
            return comissoes[cnpj].get('desc_fin', 0)
        return 0

    merged['pct_comissao'] = merged['CNPJ'].apply(get_comissao)
    merged['pct_desc_fin'] = merged['CNPJ'].apply(get_desc_fin)
    # Fórmula correta: comissão sobre valor NF, desc. fin. sobre comissão bruta
    merged['comissao_bruta'] = merged['receita'] * merged['pct_comissao']
    merged['desc_financeiro'] = merged['comissao_bruta'] * merged['pct_desc_fin']
    merged['comissao_liquida'] = merged['comissao_bruta'] - merged['desc_financeiro']

    # Rentabilidade líquida = Receita Líquida - Comissão Líquida - CMV
    merged['rentabilidade'] = merged['receita_liquida'] - merged['comissao_liquida'] - merged['cmv']

    produtos_com_cmv = merged[merged['cmv'] > 0]['Produto'].nunique()
    produtos_sem_cmv = merged[merged['cmv'] == 0]['Produto'].nunique()
    print(f"    Produtos com CMV: {produtos_com_cmv} | Sem CMV: {produtos_sem_cmv}")
    print(f"    Linhas calculadas: {len(merged):,}")

    return merged


# ============================================================================
# AGREGAR PARA RELATÓRIOS
# ============================================================================

def agregar_por_cliente(dados):
    """Ranking de clientes + detalhe por produto × mês"""
    clientes = {}

    for nome_cli, grupo_cli in dados.groupby('NomeFantasia'):
        # Totais do cliente
        totais = {
            'receita': grupo_cli['receita'].sum(),
            'devol': grupo_cli['valor_devolvido'].sum(),
            'receita_liq': grupo_cli['receita_liquida'].sum(),
            'cmv': grupo_cli['cmv'].sum(),
            'margem': grupo_cli['margem_bruta'].sum(),
            'comissao': grupo_cli['comissao_liquida'].sum(),
            'rentabilidade': grupo_cli['rentabilidade'].sum(),
            'qtd_vendida': grupo_cli['qtd_vendida'].sum(),
            'qtd_devolvida': grupo_cli['qtd_devolvida'].sum(),
        }
        totais['margem_pct'] = (totais['margem'] / totais['receita_liq'] * 100) if totais['receita_liq'] > 0 else 0
        totais['pct_dev'] = (totais['qtd_devolvida'] / totais['qtd_vendida'] * 100) if totais['qtd_vendida'] > 0 else 0

        # Produtos do cliente × mês
        produtos = {}
        for nome_prod, grupo_prod in grupo_cli.groupby('Produto'):
            meses = {}
            for _, row in grupo_prod.iterrows():
                m = int(row['MesNum'])
                qtd = row['qtd_vendida']
                rec = row['receita']
                cmv = row['cmv']
                rec_liq_m = row['receita_liquida']
                margem_r = rec_liq_m - cmv
                meses[m] = {
                    'qtd': qtd,
                    'preco_unit': rec / qtd if qtd > 0 else 0,
                    'receita': rec,
                    'cmc_unit': row['cmc'],
                    'cmv': cmv,
                    'margem_r': margem_r,
                    'margem_pct': row['margem_pct'],
                    'qtd_dev': row['qtd_devolvida'],
                    'pct_dev': row['pct_dev'],
                    'valor_dev': row['valor_devolvido'],
                    'comissao': row['comissao_liquida'],
                    'pct_comissao': row['pct_comissao'],
                    'desc_fin': row['desc_financeiro'],
                    'pct_desc_fin': row['pct_desc_fin'],
                    'rentabilidade': row['rentabilidade'],
                }
            # Total do produto nesse cliente
            total_prod = {
                'qtd': grupo_prod['qtd_vendida'].sum(),
                'receita': grupo_prod['receita'].sum(),
                'cmv': grupo_prod['cmv'].sum(),
                'qtd_dev': grupo_prod['qtd_devolvida'].sum(),
                'valor_dev': grupo_prod['valor_devolvido'].sum(),
                'comissao': grupo_prod['comissao_liquida'].sum(),
                'desc_fin': grupo_prod['desc_financeiro'].sum(),
                'rentabilidade': grupo_prod['rentabilidade'].sum(),
            }
            rec_liq = grupo_prod['receita_liquida'].sum()
            total_prod['margem_r'] = rec_liq - total_prod['cmv']
            total_prod['margem_pct'] = ((rec_liq - total_prod['cmv']) / rec_liq * 100) if rec_liq > 0 else 0
            total_prod['pct_dev'] = (total_prod['qtd_dev'] / total_prod['qtd'] * 100) if total_prod['qtd'] > 0 else 0
            total_prod['pct_dev_r'] = (total_prod['valor_dev'] / total_prod['receita'] * 100) if total_prod['receita'] > 0 else 0
            total_prod['preco_unit'] = total_prod['receita'] / total_prod['qtd'] if total_prod['qtd'] > 0 else 0
            total_prod['cmc_unit'] = total_prod['cmv'] / total_prod['qtd'] if total_prod['qtd'] > 0 else 0
            total_prod['pct_cmc'] = (total_prod['cmc_unit'] / total_prod['preco_unit'] * 100) if total_prod['preco_unit'] > 0 else 0
            total_prod['pct_cmv'] = (total_prod['cmv'] / total_prod['receita'] * 100) if total_prod['receita'] > 0 else 0
            total_prod['pct_comissao'] = (total_prod['comissao'] / total_prod['receita'] * 100) if total_prod['receita'] > 0 else 0
            total_prod['pct_desc_fin'] = (total_prod['desc_fin'] / total_prod['receita'] * 100) if total_prod['receita'] > 0 else 0

            produtos[nome_prod] = {'meses': meses, 'total': total_prod}

        clientes[nome_cli] = {'totais': totais, 'produtos': produtos}

    return clientes


def agregar_por_produto(dados):
    """Ranking de produtos + detalhe por cliente × mês"""
    produtos = {}

    for nome_prod, grupo_prod in dados.groupby('Produto'):
        totais = {
            'receita': grupo_prod['receita'].sum(),
            'devol': grupo_prod['valor_devolvido'].sum(),
            'receita_liq': grupo_prod['receita_liquida'].sum(),
            'cmv': grupo_prod['cmv'].sum(),
            'margem': grupo_prod['margem_bruta'].sum(),
            'qtd_vendida': grupo_prod['qtd_vendida'].sum(),
            'qtd_devolvida': grupo_prod['qtd_devolvida'].sum(),
        }
        totais['margem_pct'] = (totais['margem'] / totais['receita_liq'] * 100) if totais['receita_liq'] > 0 else 0
        totais['pct_dev'] = (totais['qtd_devolvida'] / totais['qtd_vendida'] * 100) if totais['qtd_vendida'] > 0 else 0

        clientes = {}
        for nome_cli, grupo_cli in grupo_prod.groupby('NomeFantasia'):
            meses = {}
            for _, row in grupo_cli.iterrows():
                m = int(row['MesNum'])
                qtd = row['qtd_vendida']
                rec = row['receita']
                cmv = row['cmv']
                rec_liq_m = row['receita_liquida']
                margem_r = rec_liq_m - cmv
                meses[m] = {
                    'qtd': qtd,
                    'preco_unit': rec / qtd if qtd > 0 else 0,
                    'receita': rec,
                    'cmc_unit': row['cmc'],
                    'cmv': cmv,
                    'margem_r': margem_r,
                    'margem_pct': row['margem_pct'],
                    'qtd_dev': row['qtd_devolvida'],
                    'pct_dev': row['pct_dev'],
                    'valor_dev': row['valor_devolvido'],
                    'comissao': row['comissao_liquida'],
                    'pct_comissao': row['pct_comissao'],
                    'desc_fin': row['desc_financeiro'],
                    'pct_desc_fin': row['pct_desc_fin'],
                    'rentabilidade': row['rentabilidade'],
                }
            total_cli = {
                'qtd': grupo_cli['qtd_vendida'].sum(),
                'receita': grupo_cli['receita'].sum(),
                'cmv': grupo_cli['cmv'].sum(),
                'qtd_dev': grupo_cli['qtd_devolvida'].sum(),
                'valor_dev': grupo_cli['valor_devolvido'].sum(),
                'comissao': grupo_cli['comissao_liquida'].sum(),
                'desc_fin': grupo_cli['desc_financeiro'].sum(),
                'rentabilidade': grupo_cli['rentabilidade'].sum(),
            }
            rec_liq = grupo_cli['receita_liquida'].sum()
            total_cli['margem_r'] = rec_liq - total_cli['cmv']
            total_cli['margem_pct'] = ((rec_liq - total_cli['cmv']) / rec_liq * 100) if rec_liq > 0 else 0
            total_cli['pct_dev'] = (total_cli['qtd_dev'] / total_cli['qtd'] * 100) if total_cli['qtd'] > 0 else 0
            total_cli['pct_dev_r'] = (total_cli['valor_dev'] / total_cli['receita'] * 100) if total_cli['receita'] > 0 else 0
            total_cli['preco_unit'] = total_cli['receita'] / total_cli['qtd'] if total_cli['qtd'] > 0 else 0
            total_cli['cmc_unit'] = total_cli['cmv'] / total_cli['qtd'] if total_cli['qtd'] > 0 else 0
            total_cli['pct_cmc'] = (total_cli['cmc_unit'] / total_cli['preco_unit'] * 100) if total_cli['preco_unit'] > 0 else 0
            total_cli['pct_cmv'] = (total_cli['cmv'] / total_cli['receita'] * 100) if total_cli['receita'] > 0 else 0
            total_cli['pct_comissao'] = (total_cli['comissao'] / total_cli['receita'] * 100) if total_cli['receita'] > 0 else 0
            total_cli['pct_desc_fin'] = (total_cli['desc_fin'] / total_cli['receita'] * 100) if total_cli['receita'] > 0 else 0

            clientes[nome_cli] = {'meses': meses, 'total': total_cli}

        produtos[nome_prod] = {'totais': totais, 'clientes': clientes}

    return produtos


# ============================================================================
# GERAR HTML
# ============================================================================

def gerar_mix_table(itens, label_item, label_total, id_prefix):
    """Gera tabela mix detalhada (item × mês) com todas as métricas"""
    NUM_METRICAS = 10

    html = '<table class="mix-table"><tbody>\n'
    html += f'<tr class="col-head"><td>METRICA</td>'
    for m in MESES_CURTO:
        html += f'<td>{m.upper()}</td>'
    html += '<td>TOTAL</td></tr>\n'

    # Totais por mês
    tk = ['qtd', 'receita', 'cmv', 'margem_r', 'qtd_dev', 'valor_dev', 'comissao', 'desc_fin', 'rentabilidade']
    total_meses = {m: {k: 0 for k in tk} for m in range(1, 13)}
    total_geral = {k: 0 for k in tk}

    def vp(val, pct, fmt_v='num'):
        """Valor (percentual) numa célula"""
        if val == 0:
            return '<td>-</td>'
        v = fmt_num(val) if fmt_v == 'num' else fmt_brl_dec(val)
        return f'<td>{v} ({fmt_pct(pct)})</td>'

    for nome, dados in sorted(itens.items(), key=lambda x: -x[1]['total']['receita']):
        meses = dados['meses']
        total = dados['total']

        # Pular itens sem receita
        if total.get('receita', 0) == 0:
            continue

        # Acumular totais
        for m in range(1, 13):
            d = meses.get(m, {})
            for k in tk:
                total_meses[m][k] += d.get(k, 0)
        for k in tk:
            total_geral[k] += total.get(k, 0)

        # Product/Client name header
        html += f'<tr style="background:var(--border-light)"><td colspan="14" style="font-weight:700;color:var(--primary);font-size:0.82rem;padding:12px 12px 6px;border-bottom:none">{nome}</td></tr>\n'
        html += f'<tr class="col-head"><td>METRICA</td>'
        for m in MESES_CURTO:
            html += f'<td>{m.upper()}</td>'
        html += '<td>TOTAL</td></tr>\n'

        # 1. Qtd
        html += f'<tr class="m-info"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-info">i</span>Qtd</td>'
        for m in range(1, 13):
            v = meses.get(m, {}).get('qtd', 0)
            html += f'<td>{fmt_num(v) if v > 0 else "-"}</td>'
        html += f'<td class="total-col">{fmt_num(total["qtd"])}</td></tr>\n'

        # 2. R$ Unit. Pond.
        html += '<tr class="m-info"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-info">i</span>R$ Unit. Pond.</td>'
        for m in range(1, 13):
            v = meses.get(m, {}).get('preco_unit', 0)
            html += f'<td>{fmt_brl_dec(v) if v > 0 else "-"}</td>'
        html += f'<td class="total-col">{fmt_brl_dec(total.get("preco_unit", 0))}</td></tr>\n'

        # 3. Receita
        html += '<tr class="m-receita"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-result">=</span>Receita</td>'
        for m in range(1, 13):
            v = meses.get(m, {}).get('receita', 0)
            html += f'<td>{fmt_num(v) if v > 0 else "-"}</td>'
        html += f'<td>{fmt_num(total["receita"])}</td></tr>\n'

        # 4. Devol. Qtd | %
        html += '<tr class="m-devol-num"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-num">#</span>Devol. Qtd</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            html += vp(d.get('qtd_dev', 0), d.get('pct_dev', 0))
        html += vp(total.get('qtd_dev', 0), total.get('pct_dev', 0)) + '</tr>\n'

        # 5. Devol. R$ | %
        html += '<tr class="m-deduct-rs"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-deduct">-</span>Devol. R$</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            vd = d.get('valor_dev', 0)
            rec = d.get('receita', 0)
            pct = (vd / rec * 100) if rec > 0 else 0
            html += vp(vd, pct)
        vd_t = total.get('valor_dev', 0)
        pct_t = (vd_t / total['receita'] * 100) if total['receita'] > 0 else 0
        html += vp(vd_t, pct_t) + '</tr>\n'

        # 6. Desc. Fin. | %
        html += '<tr class="m-deduct-rs"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-deduct">-</span>Desc. Fin.</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            v = d.get('desc_fin', 0)
            pct = d.get('pct_desc_fin', 0) * 100 if d.get('pct_desc_fin', 0) < 1 else d.get('pct_desc_fin', 0)
            html += vp(v, pct)
        html += vp(total.get('desc_fin', 0), total.get('pct_desc_fin', 0)) + '</tr>\n'

        # 7. Comissão | %
        html += '<tr class="m-deduct-rs"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-deduct">-</span>Comissao</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            v = d.get('comissao', 0)
            pct = d.get('pct_comissao', 0) * 100 if d.get('pct_comissao', 0) < 1 else d.get('pct_comissao', 0)
            html += vp(v, pct)
        html += vp(total.get('comissao', 0), total.get('pct_comissao', 0)) + '</tr>\n'

        # 8. Custo Unit. Pond. | %
        html += '<tr class="m-cost-first m-deduct-rs"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-deduct">-</span>Custo Unit. Pond.</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            cmc = d.get('cmc_unit', 0)
            preco = d.get('preco_unit', 0)
            pct = (cmc / preco * 100) if preco > 0 else 0
            html += f'<td>{fmt_brl_dec(cmc)} ({fmt_pct(pct)})</td>' if cmc > 0 else '<td>-</td>'
        cmc_t = total.get('cmc_unit', 0)
        pct_t = total.get('pct_cmc', 0)
        html += f'<td>{fmt_brl_dec(cmc_t)} ({fmt_pct(pct_t)})</td>' if cmc_t > 0 else '<td>-</td>'
        html += '</tr>\n'

        # 9. CMV | %
        html += '<tr class="m-deduct-rs"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-deduct">-</span>CMV</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            cmv = d.get('cmv', 0)
            rec = d.get('receita', 0)
            pct = (cmv / rec * 100) if rec > 0 else 0
            html += vp(cmv, pct)
        html += vp(total['cmv'], total.get('pct_cmv', 0)) + '</tr>\n'

        # 10. Margem R$ | % (com cor)
        html += '<tr class="m-margem"><td style="display:flex;align-items:center"><span class="dre-icon dre-icon-final">=</span>Margem</td>'
        for m in range(1, 13):
            d = meses.get(m, {})
            mg = d.get('margem_r', 0)
            pct = d.get('margem_pct', 0)
            if d.get('receita', 0) > 0:
                cls = cor_margem(pct)
                html += f'<td class="{cls}">{fmt_num(mg)} ({fmt_pct(pct)})</td>'
            else:
                html += '<td>-</td>'
        cls_t = cor_margem(total.get('margem_pct', 0))
        html += f'<td class="{cls_t}" style="font-weight:800">{fmt_num(total.get("margem_r", 0))} ({fmt_pct(total.get("margem_pct", 0))})</td></tr>\n'

    # ── Linha TOTAL ──
    html += f'<tr class="row-total-sep"><td colspan="{NUM_METRICAS + 3}" style="border-top:3px solid var(--accent);padding:0"></td></tr>\n'

    rec_t = total_geral['receita']
    cmv_t = total_geral['cmv']
    mg_r_t = total_geral['margem_r']
    q_t = total_geral['qtd']

    bg = ' style="background:#eff6ff"'

    # Total 1. Qtd
    html += f'<tr class="row-qtd"{bg}><td rowspan="{NUM_METRICAS}" style="font-weight:800;color:var(--accent)">{label_total}</td><td>Qtd</td>'
    for m in range(1, 13):
        html += f'<td>{fmt_num(total_meses[m]["qtd"]) if total_meses[m]["qtd"] > 0 else "-"}</td>'
    html += f'<td style="font-weight:800">{fmt_num(q_t)}</td></tr>\n'

    # Total 2. R$ Unit. Pond.
    html += f'<tr class="row-receita"{bg}><td>R$ Unit. Pond.</td>'
    for m in range(1, 13):
        q = total_meses[m]['qtd']; r = total_meses[m]['receita']
        html += f'<td>{fmt_brl_dec(r/q) if q > 0 else "-"}</td>'
    html += f'<td>{fmt_brl_dec(rec_t/q_t) if q_t > 0 else "-"}</td></tr>\n'

    # Total 3. Receita
    html += f'<tr class="row-receita"{bg}><td>Receita</td>'
    for m in range(1, 13):
        html += f'<td>{fmt_num(total_meses[m]["receita"]) if total_meses[m]["receita"] > 0 else "-"}</td>'
    html += f'<td style="font-weight:800">{fmt_num(rec_t)}</td></tr>\n'

    # Total 4. Devol. Qtd
    html += f'<tr class="row-cmv"{bg}><td>Devol. Qtd</td>'
    for m in range(1, 13):
        d = total_meses[m]['qtd_dev']; q = total_meses[m]['qtd']
        pct = (d / q * 100) if q > 0 else 0
        html += vp(d, pct)
    d_t = total_geral['qtd_dev']; pct_t = (d_t / q_t * 100) if q_t > 0 else 0
    html += vp(d_t, pct_t) + '</tr>\n'

    # Total 5. Devol. R$
    html += f'<tr class="row-cmv"{bg}><td>Devol. R$</td>'
    for m in range(1, 13):
        vd = total_meses[m]['valor_dev']; r = total_meses[m]['receita']
        pct = (vd / r * 100) if r > 0 else 0
        html += vp(vd, pct)
    vd_t = total_geral['valor_dev']; pct_t = (vd_t / rec_t * 100) if rec_t > 0 else 0
    html += vp(vd_t, pct_t) + '</tr>\n'

    # Total 6. Desc. Fin.
    html += f'<tr class="row-cmv"{bg}><td>Desc. Fin.</td>'
    for m in range(1, 13):
        v = total_meses[m]['desc_fin']; r = total_meses[m]['receita']
        pct = (v / r * 100) if r > 0 else 0
        html += vp(v, pct)
    df_t = total_geral['desc_fin']; pct_t = (df_t / rec_t * 100) if rec_t > 0 else 0
    html += vp(df_t, pct_t) + '</tr>\n'

    # Total 7. Comissão
    html += f'<tr class="row-cmv"{bg}><td>Comissao</td>'
    for m in range(1, 13):
        v = total_meses[m]['comissao']; r = total_meses[m]['receita']
        pct = (v / r * 100) if r > 0 else 0
        html += vp(v, pct)
    cm_t = total_geral['comissao']; pct_t = (cm_t / rec_t * 100) if rec_t > 0 else 0
    html += vp(cm_t, pct_t) + '</tr>\n'

    # Total 8. Custo Unit. Pond.
    html += f'<tr class="row-cmv"{bg}><td>Custo Unit. Pond.</td>'
    for m in range(1, 13):
        q = total_meses[m]['qtd']; c = total_meses[m]['cmv']; r = total_meses[m]['receita']
        cmc = c / q if q > 0 else 0
        preco = r / q if q > 0 else 0
        pct = (cmc / preco * 100) if preco > 0 else 0
        html += f'<td>{fmt_brl_dec(cmc)} ({fmt_pct(pct)})</td>' if cmc > 0 else '<td>-</td>'
    cmc_t = cmv_t / q_t if q_t > 0 else 0
    preco_t = rec_t / q_t if q_t > 0 else 0
    pct_t = (cmc_t / preco_t * 100) if preco_t > 0 else 0
    html += f'<td>{fmt_brl_dec(cmc_t)} ({fmt_pct(pct_t)})</td>' if cmc_t > 0 else '<td>-</td>'
    html += '</tr>\n'

    # Total 9. CMV
    html += f'<tr class="row-cmv"{bg}><td>CMV</td>'
    for m in range(1, 13):
        c = total_meses[m]['cmv']; r = total_meses[m]['receita']
        pct = (c / r * 100) if r > 0 else 0
        html += vp(c, pct)
    pct_t = (cmv_t / rec_t * 100) if rec_t > 0 else 0
    html += vp(cmv_t, pct_t) + '</tr>\n'

    # Total 10. Margem
    html += f'<tr class="row-margem"{bg}><td>Margem</td>'
    for m in range(1, 13):
        r = total_meses[m]['receita']; c = total_meses[m]['cmv']
        mg = r - c; pct = (mg / r * 100) if r > 0 else 0
        if r > 0:
            cls = cor_margem(pct)
            html += f'<td class="{cls}">{fmt_num(mg)} ({fmt_pct(pct)})</td>'
        else:
            html += '<td>-</td>'
    mg_pct_final = ((rec_t - cmv_t) / rec_t * 100) if rec_t > 0 else 0
    html += f'<td class="{cor_margem(mg_pct_final)}" style="font-weight:800">{fmt_num(mg_r_t)} ({fmt_pct(mg_pct_final)})</td></tr>\n'

    html += '</tbody></table></div>'
    return html


def gerar_html(dados_clientes, dados_produtos, dados_calc):
    """Gera o HTML completo com abas Clientes e Produtos"""
    print("  Gerando HTML...")

    # KPIs globais
    receita_total = dados_calc['receita'].sum()
    devol_total = dados_calc['valor_devolvido'].sum()
    cmv_total = dados_calc['cmv'].sum()
    receita_liq = receita_total - devol_total
    margem_total = receita_liq - cmv_total
    margem_pct = (margem_total / receita_liq * 100) if receita_liq > 0 else 0
    n_clientes = dados_calc['NomeFantasia'].nunique()
    n_produtos = dados_calc['Produto'].nunique()

    # CSS (design v14)
    css = """<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
:root{--bg:#f5f6f8;--primary:#1b2a4a;--primary-light:#2a3d66;--success:#0d9e5f;--success-light:rgba(13,158,95,0.07);--warning:#e67e22;--warning-light:rgba(230,126,34,0.07);--danger:#dc3545;--danger-light:rgba(220,53,69,0.06);--white:#fff;--text:#1b1f2a;--text-secondary:#5f6780;--text-muted:#9ba3b8;--border:#e4e7ec;--border-light:#f0f2f5;--accent:#1a5cff;--accent-dim:rgba(26,92,255,0.06);--shadow-sm:0 1px 2px rgba(0,0,0,0.04);--shadow:0 2px 8px rgba(0,0,0,0.06);--radius:12px;--radius-sm:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.main-content{padding:32px;max-width:1200px;margin:0 auto}
.page-header{margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.page-header h2{font-size:1.7rem;font-weight:800;color:var(--text);letter-spacing:-0.5px}
.page-header p{color:var(--text-muted);font-size:0.95rem;font-weight:400}
.section-title{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid var(--border)}
.tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:2px solid var(--border)}
.tab{padding:12px 28px;font-size:.85rem;font-weight:600;color:var(--text-muted);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .2s}
.tab:hover{color:var(--text)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.tab-panel{display:none}
.tab-panel.active{display:block}
.cards-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:28px}
.summary-card{background:var(--white);border-radius:var(--radius-sm);box-shadow:var(--shadow-sm);border:1px solid var(--border);padding:10px 12px;position:relative;overflow:hidden}
.summary-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#1e40af,#3b82f6)}
.summary-card.card-success::before{background:linear-gradient(90deg,#059669,#10b981)}
.summary-card.card-danger::before{background:linear-gradient(90deg,#dc2626,#ef4444)}
.summary-card.card-warning::before{background:linear-gradient(90deg,#d97706,#f59e0b)}
.card-label{font-size:0.6rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;white-space:nowrap}
.card-value{font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:700;color:var(--text);white-space:nowrap}
.ranking{width:100%;border-collapse:collapse;margin-bottom:24px}
.ranking th{background:transparent;color:var(--text-muted);padding:12px 16px;font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.8px;text-align:left;border-bottom:2px solid var(--border)}
.ranking th:not(:first-child):not(:nth-child(2)){text-align:right}
.ranking td{padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:.82rem}
.ranking td:not(:first-child):not(:nth-child(2)){text-align:right;font-variant-numeric:tabular-nums;font-weight:600;font-family:'JetBrains Mono',monospace;font-size:.78rem}
.ranking tr{cursor:pointer;transition:background .15s}
.ranking tr:hover{background:var(--accent-dim)}
.ranking tr.active{background:rgba(26,92,255,0.06)}
.ranking .nome{font-weight:600;color:var(--text)}
.ranking .pos{color:var(--text-muted);font-weight:700;width:30px}
.mg-alta{color:var(--success)}
.mg-media{color:var(--warning)}
.mg-baixa{color:var(--danger)}
.detalhe{display:none;margin:0 0 16px 0}
.detalhe.aberto{display:block}
.detalhe .table-wrap{max-height:80vh;overflow:auto}
.detalhe-header{background:linear-gradient(90deg,#dbeafe,#eff6ff);padding:10px 16px;font-weight:700;font-size:.8rem;color:#1e40af;display:flex;justify-content:space-between;align-items:center}
.detalhe-header .fechar{cursor:pointer;font-size:.7rem;color:var(--muted);padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:#fff}
.detalhe-header .fechar:hover{background:#fee2e2;color:var(--danger)}
.mix-table{width:100%;border-collapse:collapse;font-size:.75rem}
.mix-table th{background:transparent;color:var(--muted);padding:10px 12px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.8px;text-align:center;border-bottom:2px solid var(--border);position:sticky;top:0}
.mix-table th:first-child,.mix-table th:nth-child(2){text-align:left}
.mix-table td{padding:7px 12px;border-bottom:1px solid #f0f2f5;text-align:center;font-variant-numeric:tabular-nums;font-size:.75rem}
.mix-table td:first-child{text-align:left;font-weight:600;color:var(--text);vertical-align:top;padding-top:10px}
.mix-table td:nth-child(2){text-align:left;font-size:.65rem;color:var(--muted);font-weight:500}
.mix-table tr:hover td{background:rgba(26,92,255,0.02)}
.mix-table tr.row-qtd td{border-top:2px solid var(--border);padding-top:14px}
.mix-table tr.row-receita td,.mix-table tr.row-cmv td{font-size:.7rem}
.mix-table tr.row-margem td{font-weight:700;font-size:.7rem;padding-bottom:14px;border-bottom:none}
.mix-table td:last-child{font-weight:700;background:#f8fafc}
.footer{background:#f8fafc;border-top:1px solid var(--border);padding:14px 28px;display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted)}
.footer-sig{font-weight:600;color:var(--text)}
@media(max-width:640px){
.kpi-grid{grid-template-columns:repeat(3,1fr)}
.header h1{font-size:.85rem}
.content{padding:12px}
.tab{padding:8px 14px;font-size:.7rem}
.ranking td,.ranking th{padding:6px 8px;font-size:.65rem}
.mix-table{font-size:.6rem}
.mix-table th{font-size:.45rem}
.footer{flex-direction:column;gap:4px;text-align:center}
}
</style>"""

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rentabilidade de Produtos e Clientes - 2025</title>
{css}
</head>
<body>
<div class="main-content">
    <div class="page-header">
        <div>
            <h2>Analise de Rentabilidade</h2>
            <p>Produtos e Clientes — 2025</p>
        </div>
    </div>
    <div class="cards-grid">
        <div class="summary-card"><div class="card-label"><i class="fas fa-users" style="margin-right:4px"></i> Clientes</div><div class="card-value">{n_clientes}</div></div>
        <div class="summary-card"><div class="card-label"><i class="fas fa-boxes-stacked" style="margin-right:4px"></i> Produtos</div><div class="card-value">{n_produtos}</div></div>
        <div class="summary-card card-success"><div class="card-label"><i class="fas fa-dollar-sign" style="margin-right:4px"></i> Receita Liquida</div><div class="card-value">{fmt_brl(receita_liq)}</div></div>
        <div class="summary-card card-warning"><div class="card-label"><i class="fas fa-calculator" style="margin-right:4px"></i> CMV Total</div><div class="card-value">{fmt_brl(cmv_total)}</div></div>
        <div class="summary-card card-success"><div class="card-label"><i class="fas fa-chart-line" style="margin-right:4px"></i> Margem</div><div class="card-value">{fmt_brl(margem_total)}</div></div>
        <div class="summary-card {"card-success" if margem_pct >= 40 else "card-warning" if margem_pct >= 20 else "card-danger"}"><div class="card-label"><i class="fas fa-percent" style="margin-right:4px"></i> Margem %</div><div class="card-value">{fmt_pct(margem_pct)}</div></div>
    </div>
    <div class="tabs">
        <div class="tab active" onclick="showTab(0)">Clientes ({n_clientes})</div>
        <div class="tab" onclick="showTab(1)">Produtos ({n_produtos})</div>
    </div>
"""

    # ═══ TAB CLIENTES ═══
    html += '<div class="tab-panel active" id="tab0">\n'
    html += '<div class="section-title">Ranking de Clientes</div>\n'

    ranking_cli = sorted(dados_clientes.items(), key=lambda x: -x[1]['totais']['receita'])

    html += '<table class="ranking"><thead><tr><th class="pos">#</th><th>Cliente</th><th>Receita</th><th>CMV</th><th>Dev%</th><th>Margem</th><th>%</th></tr></thead><tbody>\n'
    for i, (nome_cli, dados_cli) in enumerate(ranking_cli):
        t = dados_cli['totais']
        cls_mg = cor_margem(t['margem_pct'])
        id_cli = f'c{i}'
        html += f'<tr onclick="toggleDetalhe(\'{id_cli}\',this)" data-det="{id_cli}">'
        html += f'<td class="pos">{i+1}</td><td class="nome">{nome_cli}</td>'
        html += f'<td>{fmt_brl(t["receita"])}</td><td>{fmt_brl(t["cmv"])}</td>'
        html += f'<td>{fmt_pct(t["pct_dev"])}</td>'
        html += f'<td class="{cls_mg}">{fmt_brl(t["margem"])}</td>'
        html += f'<td class="{cls_mg}">{fmt_pct(t["margem_pct"])}</td></tr>\n'
    html += '</tbody></table>\n'

    # Detalhes dos clientes (fora da tabela)
    for i, (nome_cli, dados_cli) in enumerate(ranking_cli):
        id_cli = f'c{i}'
        html += f'<div class="detalhe" id="{id_cli}"><div class="card">'
        html += f'<div class="card-header-det" onclick="fecharDetalhe(\'{id_cli}\')">'
        html += f'<span><i class="fas fa-store" style="margin-right:8px"></i>{nome_cli}</span>'
        html += f'<div style="display:flex;align-items:center;gap:12px"><span class="badge">Mix de Produtos</span>'
        html += f'<span class="fechar"><i class="fas fa-times"></i></span></div></div>\n'
        html += '<div class="card-body"><div class="table-wrap">\n'
        if dados_cli['produtos']:
            html += gerar_mix_table(dados_cli['produtos'], 'Produto', 'TOTAL CLIENTE', id_cli)
        html += '</div></div></div></div>\n'

    html += '</div>\n'  # tab0

    # ═══ TAB PRODUTOS ═══
    html += '<div class="tab-panel" id="tab1">\n'
    html += '<div class="section-title">Ranking de Produtos</div>\n'

    ranking_prod = sorted(dados_produtos.items(), key=lambda x: -x[1]['totais']['receita'])

    html += '<table class="ranking"><thead><tr><th class="pos">#</th><th>Produto</th><th>Receita</th><th>CMV</th><th>Dev%</th><th>Margem</th><th>%</th></tr></thead><tbody>\n'
    for i, (nome_prod, dados_prod) in enumerate(ranking_prod):
        t = dados_prod['totais']
        cls_mg = cor_margem(t['margem_pct'])
        id_prod = f'p{i}'
        html += f'<tr onclick="toggleDetalhe(\'{id_prod}\',this)" data-det="{id_prod}">'
        html += f'<td class="pos">{i+1}</td><td class="nome">{nome_prod}</td>'
        html += f'<td>{fmt_brl(t["receita"])}</td><td>{fmt_brl(t["cmv"])}</td>'
        html += f'<td>{fmt_pct(t["pct_dev"])}</td>'
        html += f'<td class="{cls_mg}">{fmt_brl(t["margem"])}</td>'
        html += f'<td class="{cls_mg}">{fmt_pct(t["margem_pct"])}</td></tr>\n'
    html += '</tbody></table>\n'

    # Detalhes dos produtos (fora da tabela)
    for i, (nome_prod, dados_prod) in enumerate(ranking_prod):
        id_prod = f'p{i}'
        html += f'<div class="detalhe" id="{id_prod}"><div class="card">'
        html += f'<div class="card-header-det" onclick="fecharDetalhe(\'{id_prod}\')">'
        html += f'<span><i class="fas fa-leaf" style="margin-right:8px"></i>{nome_prod}</span>'
        html += f'<div style="display:flex;align-items:center;gap:12px"><span class="badge">Clientes</span>'
        html += f'<span class="fechar"><i class="fas fa-times"></i></span></div></div>\n'
        html += '<div class="card-body"><div class="table-wrap">\n'
        if dados_prod['clientes']:
            html += gerar_mix_table(dados_prod['clientes'], 'Cliente', 'TOTAL PRODUTO', id_prod)
        html += '</div></div></div></div>\n'

    html += '</div>\n'  # tab1

    # Footer + JS
    html += f"""

</div>
<div class="footer">Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} — Adm. Alexsander Machado — CRA 20-22229</div>
<script>
function showTab(idx){{
    document.querySelectorAll('.tab').forEach(function(t,i){{t.classList.toggle('active',i===idx)}});
    document.querySelectorAll('.tab-panel').forEach(function(p,i){{p.classList.toggle('active',i===idx)}});
    document.querySelectorAll('.detalhe').forEach(function(d){{d.classList.remove('aberto')}});
    document.querySelectorAll('.ranking tr').forEach(function(r){{r.classList.remove('active')}});
}}
function toggleDetalhe(id,tr){{
    var el=document.getElementById(id);
    if(!el)return;
    var aberto=el.classList.contains('aberto');
    // Fechar todos no mesmo painel
    var panel=el.closest('.tab-panel');
    if(!panel){{
        // detalhe está fora da tabela, buscar o tab-panel pai
        var prev=el.previousElementSibling;
        while(prev){{
            panel=prev.closest('.tab-panel');
            if(panel)break;
            prev=prev.previousElementSibling;
        }}
        if(!panel) panel=el.parentElement;
    }}
    panel.querySelectorAll('.detalhe').forEach(function(d){{d.classList.remove('aberto')}});
    panel.querySelectorAll('.ranking tr').forEach(function(r){{r.classList.remove('active')}});
    if(!aberto){{
        el.classList.add('aberto');
        if(tr)tr.classList.add('active');
        el.scrollIntoView({{behavior:'smooth',block:'nearest'}});
    }}
}}
function fecharDetalhe(id){{
    var el=document.getElementById(id);
    if(el){{
        el.classList.remove('aberto');
        // Remover active da linha correspondente
        var trs=document.querySelectorAll('tr[data-det=\"'+id+'\"]');
        trs.forEach(function(t){{t.classList.remove('active')}});
    }}
}}
</script>
</body>
</html>"""

    return html


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("GERAR RELATÓRIO DE RENTABILIDADE 2025")
    print("=" * 70)
    inicio = time.time()

    # Validar arquivos
    for arq, nome in [(ARQUIVO_VENDAS, 'Vendas'), (ARQUIVO_DEVOLUCOES, 'Devoluções'), (ARQUIVO_COMISSOES, 'Comissões')]:
        if not arq.exists():
            print(f"  ERRO: {nome} não encontrado: {arq}")
            return

    # Carregar dados
    vendas = carregar_vendas()
    devolucoes = carregar_devolucoes()
    cmv_movimentos = carregar_cmv_movimentos()
    comissoes = carregar_comissoes()

    # Calcular
    dados = calcular(vendas, devolucoes, cmv_movimentos, comissoes)

    # Agregar
    print("  Agregando por cliente...")
    dados_clientes = agregar_por_cliente(dados)
    print(f"    {len(dados_clientes)} clientes")

    print("  Agregando por produto...")
    dados_produtos = agregar_por_produto(dados)
    print(f"    {len(dados_produtos)} produtos")

    # Gerar HTML
    html = gerar_html(dados_clientes, dados_produtos, dados)

    # Salvar
    with open(ARQUIVO_SAIDA, 'w', encoding='utf-8') as f:
        f.write(html)

    duracao = time.time() - inicio
    tamanho = ARQUIVO_SAIDA.stat().st_size / 1024

    print(f"\n  Salvo: {ARQUIVO_SAIDA}")
    print(f"  Tamanho: {tamanho:.0f} KB")
    print(f"  Duração: {duracao:.1f}s")
    print("=" * 70)


if __name__ == '__main__':
    main()
