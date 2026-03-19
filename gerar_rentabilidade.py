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
    # Fórmula confirmada (2026-03-19):
    # Desc. Financeiro = Receita Bruta × %DF (loja retém no pagamento das NFs)
    # Comissão = (Receita - DF - Devoluções) × %Comissão
    merged['desc_financeiro'] = merged['receita'] * merged['pct_desc_fin']
    merged['base_comissao'] = merged['receita'] - merged['desc_financeiro'] - merged['valor_devolvido']
    merged['comissao'] = merged['base_comissao'].clip(lower=0) * merged['pct_comissao']

    # Receita Líquida = Receita - Devoluções - DF - Comissão
    merged['receita_liquida'] = merged['receita'] - merged['valor_devolvido'] - merged['desc_financeiro'] - merged['comissao']

    # Margem de Contribuição = Receita Líquida - CMV
    merged['margem_bruta'] = merged['receita_liquida'] - merged['cmv']

    # Rentabilidade = Margem de Contribuição (sinônimo neste contexto)
    merged['rentabilidade'] = merged['margem_bruta']
    merged['margem_pct'] = np.where(merged['receita'] > 0,
                                     merged['margem_bruta'] / merged['receita'] * 100, 0)

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
            'comissao': grupo_cli['comissao'].sum(),
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
                    'comissao': row['comissao'],
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
                'comissao': grupo_prod['comissao'].sum(),
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
                    'comissao': row['comissao'],
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
                'comissao': grupo_cli['comissao'].sum(),
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
# AIRTABLE UPLOAD
# ============================================================================

AIRTABLE_TOKEN = 'pat0KFWb7Vc0aevY1.9511b6c89f912e5c581d17fbd06427e55ca13d5cd2cc0631b4a6d810152b463f'
AIRTABLE_BASE = 'appC95CSdCeBrKQ83'
AIRTABLE_TABLES = {
    'produtos': 'tblvS4zY6EofPsYCr',
    'clientes': 'tblB6qHTf7MGqjs5K',
    'detalhe':  'tbluXAa4patQHyxmc',
    'painel':   'tblUUOhkcr76Hu4oQ',
}
AIRTABLE_URL = f'https://api.airtable.com/v0/{AIRTABLE_BASE}'


def airtable_batch_create(table_id, records, rate_limit=0.25):
    """Cria registros em lote no Airtable (máx 10 por request)"""
    import requests
    url = f'{AIRTABLE_URL}/{table_id}'
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    total = len(records)
    criados = 0
    erros = 0

    for i in range(0, total, 10):
        batch = records[i:i+10]
        payload = {'records': [{'fields': r} for r in batch]}
        try:
            resp = requests.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                criados += len(batch)
            else:
                erros += len(batch)
                print(f"    ERRO batch {i//10+1}: {resp.status_code} — {resp.text[:200]}")
            time.sleep(rate_limit)
        except Exception as e:
            erros += len(batch)
            print(f"    ERRO request: {e}")

    return criados, erros


def airtable_delete_all(table_id, rate_limit=0.25):
    """Deleta todos os registros de uma tabela (para limpar antes de popular)"""
    import requests
    url = f'{AIRTABLE_URL}/{table_id}'
    headers = {'Authorization': f'Bearer {AIRTABLE_TOKEN}'}
    total_deleted = 0

    while True:
        resp = requests.get(url, headers=headers, params={'pageSize': 100})
        if resp.status_code != 200:
            print(f"    ERRO list: {resp.status_code}")
            break
        data = resp.json()
        record_ids = [r['id'] for r in data.get('records', [])]
        if not record_ids:
            break

        # Delete em batches de 10
        for i in range(0, len(record_ids), 10):
            batch = record_ids[i:i+10]
            params = [('records[]', rid) for rid in batch]
            del_resp = requests.delete(url, headers=headers, params=params)
            if del_resp.status_code == 200:
                total_deleted += len(batch)
            else:
                print(f"    ERRO delete: {del_resp.status_code}")
            time.sleep(rate_limit)

    return total_deleted


def upload_airtable(dados_produtos, dados_clientes, dados_calc, comissoes_dict, analise_semanal=None):
    """Popula as 3 tabelas do Airtable com dados calculados"""
    print("\n  === UPLOAD AIRTABLE ===")

    # 1. Limpar tabelas existentes
    for nome, tid in AIRTABLE_TABLES.items():
        print(f"  Limpando tabela {nome}...")
        n = airtable_delete_all(tid)
        print(f"    {n} registros deletados")

    # 2. TABELA PRODUTOS
    print("  Populando Produtos...")
    prod_records = []
    for nome_prod, dp in dados_produtos.items():
        t = dp['totais']
        rec = t.get('receita', 0)
        cmv = t.get('cmv', 0)
        margem = t.get('margem', 0)
        margem_pct = t.get('margem_pct', 0)
        qtd_v = t.get('qtd_vendida', 0)
        qtd_d = t.get('qtd_devolvida', 0)
        devol = t.get('devol', 0)
        pct_dev = t.get('pct_dev', 0)

        # Comissão e DF totais para o produto
        prod_rows = dados_calc[dados_calc['Produto'] == nome_prod]
        comissao_total = prod_rows['comissao'].sum() if len(prod_rows) > 0 else 0
        df_total = prod_rows['desc_financeiro'].sum() if len(prod_rows) > 0 else 0
        rent_total = prod_rows['rentabilidade'].sum() if len(prod_rows) > 0 else 0

        prod_records.append({
            'Produto': nome_prod,
            'Receita': round(rec, 2),
            'CMV': round(cmv, 2),
            'Margem R$': round(margem, 2),
            'Margem %': round(margem_pct, 1),
            'Qtd Vendida': int(qtd_v),
            'Qtd Devolvida': int(qtd_d),
            'Devol %': round(pct_dev, 1),
            'Comissão Bruta': round(comissao_total, 2),
            'Desc Financeiro': round(df_total, 2),
            'Comissão Líquida': round(comissao_total, 2),
            'Rentabilidade': round(rent_total, 2),
        })

    criados, erros = airtable_batch_create(AIRTABLE_TABLES['produtos'], prod_records)
    print(f"    Produtos: {criados} criados, {erros} erros")

    # 3. TABELA CLIENTES
    print("  Populando Clientes...")
    cli_records = []
    for nome_cli, dc in dados_clientes.items():
        t = dc['totais']

        # Buscar CNPJ e vendedor do cliente
        cli_rows = dados_calc[dados_calc['NomeFantasia'] == nome_cli]
        cnpj = cli_rows['CNPJ'].iloc[0] if len(cli_rows) > 0 else ''
        vendedor = comissoes_dict.get(cnpj, {}).get('vendedor', '')
        pct_df = comissoes_dict.get(cnpj, {}).get('desc_fin', 0)
        pct_com = comissoes_dict.get(cnpj, {}).get('comissao', 0)
        comissao_total = cli_rows['comissao'].sum() if len(cli_rows) > 0 else 0
        df_total = cli_rows['desc_financeiro'].sum() if len(cli_rows) > 0 else 0
        rent_total = cli_rows['rentabilidade'].sum() if len(cli_rows) > 0 else 0

        cli_records.append({
            'Cliente': nome_cli,
            'CNPJ': cnpj,
            'Vendedor': vendedor,
            'Receita': round(t.get('receita', 0), 2),
            'CMV': round(t.get('cmv', 0), 2),
            'Margem R$': round(t.get('margem', 0), 2),
            'Margem %': round(t.get('margem_pct', 0), 1),
            'Qtd Vendida': int(t.get('qtd_vendida', 0)),
            'Qtd Devolvida': int(t.get('qtd_devolvida', 0)),
            'Devol %': round(t.get('pct_dev', 0), 1),
            'Comissão Bruta': round(comissao_total, 2),
            'Desc Financeiro': round(df_total, 2),
            'Comissão Líquida': round(comissao_total, 2),
            'Rentabilidade': round(rent_total, 2),
            'Pct Desc Fin': round(pct_df * 100 if pct_df < 1 else pct_df, 1),
            'Pct Comissão': round(pct_com * 100 if pct_com < 1 else pct_com, 1),
        })

    criados, erros = airtable_batch_create(AIRTABLE_TABLES['clientes'], cli_records)
    print(f"    Clientes: {criados} criados, {erros} erros")

    # 4. TABELA DETALHE (cliente × produto × mês)
    print("  Populando Detalhe...")
    det_records = []
    for _, row in dados_calc.iterrows():
        chave = f"{row['NomeFantasia']}|{row['Produto']}|{int(row['MesNum'])}"
        det_records.append({
            'Chave': chave,
            'Cliente': row['NomeFantasia'],
            'Produto': row['Produto'],
            'Mês': int(row['MesNum']),
            'Qtd': int(row['qtd_vendida']),
            'Preço Unit': round(row['receita'] / row['qtd_vendida'], 2) if row['qtd_vendida'] > 0 else 0,
            'Receita': round(row['receita'], 2),
            'Qtd Devolvida': int(row['qtd_devolvida']),
            'Valor Devolvido': round(row['valor_devolvido'], 2),
            'CMC Unit': round(row['cmc'], 2),
            'CMV': round(row['cmv'], 2),
            'Margem R$': round(row['margem_bruta'], 2),
            'Margem %': round(row['margem_pct'], 1),
            'Comissão': round(row['comissao'], 2),
            'Desc Financeiro': round(row['desc_financeiro'], 2),
            'Rentabilidade': round(row['rentabilidade'], 2),
        })

    criados, erros = airtable_batch_create(AIRTABLE_TABLES['detalhe'], det_records, rate_limit=0.2)
    print(f"    Detalhe: {criados} criados, {erros} erros")
    print(f"    Total registros Detalhe: {len(det_records)}")

    # 5. TABELA PAINEL (dados semanais como JSON)
    if analise_semanal:
        print("  Populando Painel...")
        import json as _json
        painel_records = []
        for nome_prod, dados_sem in analise_semanal.items():
            painel_records.append({
                'Produto': nome_prod,
                'DadosPainel': _json.dumps(dados_sem, ensure_ascii=False),
            })
        criados, erros = airtable_batch_create(AIRTABLE_TABLES['painel'], painel_records)
        print(f"    Painel: {criados} criados, {erros} erros")

    print("  === UPLOAD CONCLUIDO ===\n")


# ============================================================================
# ANÁLISE SEMANAL (dados diários para o painel operacional)
# ============================================================================

def gerar_analise_semanal(vendas):
    """Gera dados de vendas por dia da semana, semana do mês, para cada produto.
    Retorna dict: produto -> { mediaAnualDia, avgAnualPorDia[6], meses[12][semanas] }
    Cada semana: { id, sales[6], clients[6], nfs[6], deliveries[6], histDayAvg[6] }
    Dias: 0=SEG, 1=TER, 2=QUA, 3=QUI, 4=SEX, 5=SAB
    """
    print("  Gerando analise semanal...")
    vendas_dt = vendas.copy()
    vendas_dt['Data'] = pd.to_datetime(vendas_dt['Data'], dayfirst=True, errors='coerce')
    vendas_dt = vendas_dt.dropna(subset=['Data'])
    vendas_dt['DiaSemana'] = vendas_dt['Data'].dt.dayofweek  # 0=Mon..6=Sun
    vendas_dt = vendas_dt[vendas_dt['DiaSemana'] < 6]  # Excluir domingo
    vendas_dt['SemanaNo'] = vendas_dt['Data'].apply(lambda d: (d.day - 1) // 7)  # 0-based week of month
    vendas_dt['DiaMes'] = vendas_dt['Data'].dt.day

    resultado = {}

    for nome_prod, grupo in vendas_dt.groupby('Produto'):
        meses_data = []
        qtd_por_dia_ano = [0] * 6  # total qtd por dia da semana no ano
        dias_por_dia_ano = [0] * 6  # qtd de dias úteis por dia da semana no ano
        datas_semana = []  # 12 meses x N semanas x 6 dias
        medianas_mes = []  # 12 meses x 6 dias
        clientes_unicos_mes = []
        clientes_unicos_semana = []

        for mes in range(1, 13):
            gm = grupo[grupo['MesNum'] == mes]

            # Contar dias úteis por dia da semana neste mês
            dias_no_mes = [0] * 6
            if len(gm) > 0:
                datas_unicas = gm['Data'].dt.date.unique()
                for d in datas_unicas:
                    dow = pd.Timestamp(d).dayofweek
                    if dow < 6:
                        dias_no_mes[dow] += 1

            # Agrupar por semana do mês
            semanas_dict = {}
            for _, row in gm.iterrows():
                sw = row['SemanaNo']
                if sw not in semanas_dict:
                    semanas_dict[sw] = {'sales': [0]*6, 'clients': [set() for _ in range(6)],
                                         'nfs': [0]*6, 'deliveries': [0]*6, 'datas': [0]*6}
                di = row['DiaSemana']
                semanas_dict[sw]['sales'][di] += row['Quantidade']
                semanas_dict[sw]['clients'][di].add(row['NomeFantasia'])
                semanas_dict[sw]['nfs'][di] += 1
                semanas_dict[sw]['datas'][di] = row['DiaMes']

            # Entregas: dia seguinte útil
            # SEG->TER, TER->QUA, QUA->QUI, QUI->SEX, SEX->SAB, SAB->SEG(prox semana)
            for sw in semanas_dict:
                s = semanas_dict[sw]
                deliv = [0] * 6
                for di in range(5):  # seg-sex → entrega no dia seguinte
                    deliv[di + 1] += s['nfs'][di]
                # SAB → entrega SEG (próxima semana, mas contamos nesta)
                deliv[0] += s['nfs'][5]
                s['deliveries'] = deliv

            # Média do mês por dia
            qtd_dia_mes = [0] * 6
            for sw in semanas_dict:
                for di in range(6):
                    qtd_dia_mes[di] += semanas_dict[sw]['sales'][di]

            hist_day_avg = [0] * 6
            for di in range(6):
                hist_day_avg[di] = round(qtd_dia_mes[di] / dias_no_mes[di]) if dias_no_mes[di] > 0 else 0
                qtd_por_dia_ano[di] += qtd_dia_mes[di]
                dias_por_dia_ano[di] += dias_no_mes[di]

            # Mediana do mês por dia (mediana das qtd semanais, excluindo zeros)
            med_mes = [0] * 6
            for di in range(6):
                vals = [semanas_dict[sw]['sales'][di] for sw in semanas_dict if semanas_dict[sw]['sales'][di] > 0]
                if vals:
                    vals.sort()
                    n = len(vals)
                    med_mes[di] = round((vals[n//2] + vals[(n-1)//2]) / 2)
            medianas_mes.append(med_mes)

            # Clientes únicos do mês por dia
            cli_sets_dia = [set() for _ in range(6)]
            cli_set_mes = set()
            for sw in semanas_dict:
                for di in range(6):
                    cli_sets_dia[di].update(semanas_dict[sw]['clients'][di])
                    cli_set_mes.update(semanas_dict[sw]['clients'][di])
            clientes_unicos_mes.append({
                'total': len(cli_set_mes),
                'porDia': [len(cli_sets_dia[di]) for di in range(6)]
            })

            # Clientes únicos por semana
            cli_sem = []
            for sw in sorted(semanas_dict.keys()):
                cli_set = set()
                for di in range(6):
                    cli_set.update(semanas_dict[sw]['clients'][di])
                cli_sem.append(len(cli_set))
            clientes_unicos_semana.append(cli_sem)

            # Datas por semana
            datas_mes = []
            for sw in sorted(semanas_dict.keys()):
                datas_mes.append(semanas_dict[sw]['datas'])
            datas_semana.append(datas_mes)

            # Semanas para output
            weeks = []
            for sw in sorted(semanas_dict.keys()):
                s = semanas_dict[sw]
                weeks.append({
                    'id': str(sw + 1),
                    'sales': [int(v) for v in s['sales']],
                    'clients': [len(s['clients'][di]) for di in range(6)],
                    'nfs': s['nfs'],
                    'deliveries': s['deliveries'],
                    'histDayAvg': hist_day_avg,
                })
            meses_data.append(weeks)

        # Médias anuais por dia
        avg_anual = [round(qtd_por_dia_ano[di] / dias_por_dia_ano[di]) if dias_por_dia_ano[di] > 0 else 0 for di in range(6)]

        # Mediana anual por dia
        mediana_ano = [0] * 6
        for di in range(6):
            all_weekly_vals = []
            for mes in range(12):
                for w in meses_data[mes]:
                    if w['sales'][di] > 0:
                        all_weekly_vals.append(w['sales'][di])
            if all_weekly_vals:
                all_weekly_vals.sort()
                n = len(all_weekly_vals)
                mediana_ano[di] = round((all_weekly_vals[n//2] + all_weekly_vals[(n-1)//2]) / 2)

        resultado[nome_prod] = {
            'avgAnualPorDia': avg_anual,
            'meses': meses_data,
            'datasSemanais': datas_semana,
            'medianasMes': medianas_mes,
            'medianaAno': mediana_ano,
            'clientesUnicosMes': clientes_unicos_mes,
            'clientesUnicosSemana': clientes_unicos_semana,
        }

    print(f"    {len(resultado)} produtos com dados semanais")
    return resultado


# ============================================================================
# GERAR JS COM DADOS PARA O FRONTEND
# ============================================================================

def gerar_js_lista(dados_calc, dados_produtos, dados_clientes):
    """Gera dados-lista.js LEVE (~50KB) com só totais anuais para carga inicial rápida"""
    import json
    print("  Gerando dados-lista.js (leve)...")

    all_produtos = []
    for nome_prod in sorted(dados_produtos.keys()):
        dp = dados_produtos[nome_prod]
        t = dp['totais']
        rec = t.get('receita', 0)
        cmv_val = t.get('cmv', 0)
        mg = t.get('margem', 0)
        qtd = t.get('qtd_vendida', 0)
        dq_val = t.get('qtd_devolvida', 0)
        devol = t.get('devol', 0)
        pp = rec / qtd if qtd > 0 else 0
        cu = cmv_val / qtd if qtd > 0 else 0

        prod_rows = dados_calc[dados_calc['Produto'] == nome_prod]
        df_total = prod_rows['desc_financeiro'].sum() if len(prod_rows) > 0 else 0
        com_total = prod_rows['comissao'].sum() if len(prod_rows) > 0 else 0

        all_produtos.append({
            'nome': nome_prod,
            'qtd': int(qtd), 'pp': round(pp, 2), 'rec': round(rec, 0),
            'dq': int(dq_val), 'pdq': round((dq_val/qtd*100) if qtd > 0 else 0, 1),
            'drs': round(devol, 0), 'pdrs': round((devol/rec*100) if rec > 0 else 0, 1),
            'df': round(df_total, 0), 'pdf': round((df_total/rec*100) if rec > 0 else 0, 1),
            'com': round(com_total, 0), 'pcom': round((com_total/rec*100) if rec > 0 else 0, 1),
            'cu': round(cu, 2), 'pcu': round((cu/pp*100) if pp > 0 else 0, 1),
            'cmv': round(cmv_val, 0), 'pcmv': round((cmv_val/rec*100) if rec > 0 else 0, 1),
            'mg': round(mg, 0), 'pmg': round((mg/rec*100) if rec > 0 else 0, 1),
            'meses': [],  # vazio — será carregado sob demanda do Airtable
        })

    all_clientes = []
    for nome_cli in sorted(dados_clientes.keys(), key=lambda x: -dados_clientes[x]['totais']['receita']):
        dc = dados_clientes[nome_cli]
        t = dc['totais']
        cli_rows = dados_calc[dados_calc['NomeFantasia'] == nome_cli]
        com_val = cli_rows['comissao'].sum() if len(cli_rows) > 0 else 0
        all_clientes.append({
            'nome': nome_cli,
            'rec': round(t.get('receita', 0)),
            'drs': round(t.get('devol', 0)),
            'pdrs': round(t.get('pct_dev', 0), 1),
            'com': round(com_val),
            'cmv': round(t.get('cmv', 0)),
            'mg': round(t.get('margem', 0)),
            'pmg': round(t.get('margem_pct', 0), 1),
        })

    js = '// dados-lista.js — LEVE (so totais anuais, sem detalhe mensal)\n'
    js += f'// {len(all_produtos)} produtos, {len(all_clientes)} clientes\n'
    js += f'// Gerado em: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n\n'
    js += 'const ALL_PRODUTOS = ' + json.dumps(all_produtos, ensure_ascii=False) + ';\n\n'
    js += 'const ALL_CLIENTES = ' + json.dumps(all_clientes, ensure_ascii=False) + ';\n'

    saida = PASTA_BASE / 'dados-lista.js'
    with open(saida, 'w', encoding='utf-8') as f:
        f.write(js)

    tamanho = saida.stat().st_size / 1024
    print(f"    {len(all_produtos)} produtos + {len(all_clientes)} clientes ({tamanho:.0f} KB)")


def gerar_js_dados(dados_calc, dados_produtos, dados_clientes, devolucoes, comissoes_dict, vendas=None, analise_semanal_precomp=None):
    """Gera dados-produtos.js com todos os produtos no formato do frontend"""
    import json
    print("  Gerando dados-produtos.js...")

    # Análise semanal (dados diários) — usa pre-computado se disponível
    analise_semanal = analise_semanal_precomp if analise_semanal_precomp else (gerar_analise_semanal(vendas) if vendas is not None else {})

    # Agregar detalhe por produto × mês (somar todos os clientes)
    prod_mes = dados_calc.groupby(['Produto', 'MesNum']).agg(
        qtd=('qtd_vendida', 'sum'),
        rec=('receita', 'sum'),
        cmv=('cmv', 'sum'),
        dq=('qtd_devolvida', 'sum'),
        drs=('valor_devolvido', 'sum'),
        df=('desc_financeiro', 'sum'),
        com=('comissao', 'sum'),
    ).reset_index()

    # Agregar devoluções por produto × mês (para top clientes)
    dev_prod_cli = devolucoes.groupby(['Produto', 'NomeFantasia']).agg(
        qtd_dev=('Quantidade', 'sum'),
        val_dev=('TotalNF', 'sum'),
    ).reset_index()

    # Devoluções mensais por produto
    MES_MAP = {}
    for i, m in enumerate(['Janeiro','Fevereiro','Marco','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'], 1):
        MES_MAP[m] = i
    devolucoes_cp = devolucoes.copy()
    devolucoes_cp['MesNum'] = devolucoes_cp['Mes'].map(MES_MAP)
    dev_prod_mes = devolucoes_cp.groupby(['Produto', 'MesNum']).agg(
        qtd_dev=('Quantidade', 'sum'),
        val_dev=('TotalNF', 'sum'),
        n_cli=('NomeFantasia', 'nunique'),
    ).reset_index()
    # Top cliente por produto × mês
    dev_top_cli_mes = devolucoes_cp.groupby(['Produto', 'MesNum', 'NomeFantasia']).agg(
        val=('TotalNF', 'sum'),
    ).reset_index()

    all_produtos = []
    for nome_prod in sorted(dados_produtos.keys()):
        dp = dados_produtos[nome_prod]
        t = dp['totais']
        rec = t.get('receita', 0)
        cmv_val = t.get('cmv', 0)
        mg = t.get('margem', 0)
        qtd = t.get('qtd_vendida', 0)
        dq_val = t.get('qtd_devolvida', 0)
        devol = t.get('devol', 0)

        pp = rec / qtd if qtd > 0 else 0
        cu = cmv_val / qtd if qtd > 0 else 0
        pdq = (dq_val / qtd * 100) if qtd > 0 else 0
        pdrs = (devol / rec * 100) if rec > 0 else 0
        pcmv = (cmv_val / rec * 100) if rec > 0 else 0
        pmg = (mg / rec * 100) if rec > 0 else 0

        # DF e comissão totais
        prod_rows = dados_calc[dados_calc['Produto'] == nome_prod]
        df_total = prod_rows['desc_financeiro'].sum() if len(prod_rows) > 0 else 0
        com_total = prod_rows['comissao'].sum() if len(prod_rows) > 0 else 0
        pdf = (df_total / rec * 100) if rec > 0 else 0
        pcom = (com_total / rec * 100) if rec > 0 else 0
        pcu = (cu / pp * 100) if pp > 0 else 0

        # Meses
        pm = prod_mes[prod_mes['Produto'] == nome_prod]
        meses = []
        for m in range(1, 13):
            row = pm[pm['MesNum'] == m]
            if len(row) > 0:
                r = row.iloc[0]
                m_rec = r['rec']
                m_qtd = r['qtd']
                m_cmv = r['cmv']
                m_dq = r['dq']
                m_drs = r['drs']
                m_df = r['df']
                m_com = r['com']
                m_pp = m_rec / m_qtd if m_qtd > 0 else 0
                m_cu = m_cmv / m_qtd if m_qtd > 0 else 0
                m_mg = m_rec - m_drs - m_df - m_com - m_cmv
                meses.append({
                    'qtd': int(m_qtd), 'pp': round(m_pp, 2), 'rec': round(m_rec, 0),
                    'dq': int(m_dq), 'pdq': round((m_dq/m_qtd*100) if m_qtd > 0 else 0, 1),
                    'drs': round(m_drs, 0), 'pdrs': round((m_drs/m_rec*100) if m_rec > 0 else 0, 1),
                    'df': round(m_df, 0), 'pdf': round((m_df/m_rec*100) if m_rec > 0 else 0, 1),
                    'com': round(m_com, 0), 'pcom': round((m_com/m_rec*100) if m_rec > 0 else 0, 1),
                    'cu': round(m_cu, 2), 'pcu': round((m_cu/m_pp*100) if m_pp > 0 else 0, 1),
                    'cmv': round(m_cmv, 0), 'pcmv': round((m_cmv/m_rec*100) if m_rec > 0 else 0, 1),
                    'mg': round(m_mg, 0), 'pmg': round((m_mg/m_rec*100) if m_rec > 0 else 0, 1),
                })
            else:
                meses.append({'qtd':0,'pp':0,'rec':0,'dq':0,'pdq':0,'drs':0,'pdrs':0,
                              'df':0,'pdf':0,'com':0,'pcom':0,'cu':0,'pcu':0,
                              'cmv':0,'pcmv':0,'mg':0,'pmg':0})

        # Devoluções (para dashboard multinível)
        dev_meses_data = []
        dm = dev_prod_mes[dev_prod_mes['Produto'] == nome_prod]
        for mi in range(1, 13):
            dm_row = dm[dm['MesNum'] == mi]
            m_data = pm[pm['MesNum'] == mi]
            qtd_venda = int(m_data.iloc[0]['qtd']) if len(m_data) > 0 else 0
            rec_venda = round(m_data.iloc[0]['rec']) if len(m_data) > 0 else 0
            if len(dm_row) > 0:
                dr = dm_row.iloc[0]
                qtd_d = int(dr['qtd_dev'])
                rs_d = round(dr['val_dev'])
                n_c = int(dr['n_cli'])
                # Top cliente do mês
                top_rows = dev_top_cli_mes[(dev_top_cli_mes['Produto'] == nome_prod) & (dev_top_cli_mes['MesNum'] == mi)]
                top_cli = top_rows.sort_values('val', ascending=False).iloc[0]['NomeFantasia'] if len(top_rows) > 0 else ''
            else:
                qtd_d = 0; rs_d = 0; n_c = 0; top_cli = ''
            dev_meses_data.append({
                'qtdVenda': qtd_venda, 'recVenda': rec_venda,
                'qtdDev': qtd_d, 'rsDev': rs_d,
                'pctQtd': round((qtd_d/qtd_venda*100) if qtd_venda > 0 else 0, 1),
                'pctRec': round((rs_d/rec_venda*100) if rec_venda > 0 else 0, 1),
                'nCli': n_c, 'topCli': top_cli,
            })

        # Top 10 clientes devolução (anual)
        dpc = dev_prod_cli[dev_prod_cli['Produto'] == nome_prod].sort_values('val_dev', ascending=False).head(10)
        top_clientes_devol = [{'nome': r['NomeFantasia'], 'qtd': int(r['qtd_dev']), 'valor': round(r['val_dev'])} for _, r in dpc.iterrows()]

        all_produtos.append({
            'nome': nome_prod,
            'qtd': int(qtd), 'pp': round(pp, 2), 'rec': round(rec, 0),
            'dq': int(dq_val), 'pdq': round(pdq, 1),
            'drs': round(devol, 0), 'pdrs': round(pdrs, 1),
            'df': round(df_total, 0), 'pdf': round(pdf, 1),
            'com': round(com_total, 0), 'pcom': round(pcom, 1),
            'cu': round(cu, 2), 'pcu': round(pcu, 1),
            'cmv': round(cmv_val, 0), 'pcmv': round(pcmv, 1),
            'mg': round(mg, 0), 'pmg': round(pmg, 1),
            'meses': meses,
            'devolucoes': {'meses': dev_meses_data},
            'topClientesDevol': top_clientes_devol,
            'painel': analise_semanal.get(nome_prod, None),
        })

    # Clientes
    all_clientes = []
    for nome_cli in sorted(dados_clientes.keys(), key=lambda x: -dados_clientes[x]['totais']['receita']):
        dc = dados_clientes[nome_cli]
        t = dc['totais']
        cli_rows = dados_calc[dados_calc['NomeFantasia'] == nome_cli]
        cnpj = cli_rows['CNPJ'].iloc[0] if len(cli_rows) > 0 else ''
        com_val = cli_rows['comissao'].sum() if len(cli_rows) > 0 else 0
        all_clientes.append({
            'nome': nome_cli,
            'rec': round(t.get('receita', 0)),
            'drs': round(t.get('devol', 0)),
            'pdrs': round(t.get('pct_dev', 0), 1),
            'com': round(com_val),
            'cmv': round(t.get('cmv', 0)),
            'mg': round(t.get('margem', 0)),
            'pmg': round(t.get('margem_pct', 0), 1),
        })

    # Escrever JS
    js = '// Dados gerados automaticamente por gerar_rentabilidade.py\n'
    js += f'// {len(all_produtos)} produtos, {len(all_clientes)} clientes\n'
    js += f'// Gerado em: {datetime.now().strftime("%d/%m/%Y %H:%M")}\n\n'
    js += 'const ALL_PRODUTOS = ' + json.dumps(all_produtos, ensure_ascii=False) + ';\n\n'
    js += 'const ALL_CLIENTES = ' + json.dumps(all_clientes, ensure_ascii=False) + ';\n'

    saida = PASTA_BASE / 'dados-produtos.js'
    with open(saida, 'w', encoding='utf-8') as f:
        f.write(js)

    tamanho = saida.stat().st_size / 1024
    print(f"    {len(all_produtos)} produtos + {len(all_clientes)} clientes")
    print(f"    Salvo: {saida} ({tamanho:.0f} KB)")


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

    # Gerar análise semanal (usada pelo JS e pelo Airtable)
    analise_semanal = gerar_analise_semanal(vendas)

    # Gerar JS para o frontend
    gerar_js_lista(dados, dados_produtos, dados_clientes)  # leve (~50KB)
    gerar_js_dados(dados, dados_produtos, dados_clientes, devolucoes, comissoes, vendas=vendas, analise_semanal_precomp=analise_semanal)  # completo (~2.4MB)

    # Upload Airtable
    if '--no-airtable' not in sys.argv:
        upload_airtable(dados_produtos, dados_clientes, dados, comissoes, analise_semanal=analise_semanal)
    else:
        print("  (Airtable upload ignorado — --no-airtable)")

    # Gerar HTML
    if '--no-html' not in sys.argv:
        html = gerar_html(dados_clientes, dados_produtos, dados)
        with open(ARQUIVO_SAIDA, 'w', encoding='utf-8') as f:
            f.write(html)
        tamanho = ARQUIVO_SAIDA.stat().st_size / 1024
        print(f"\n  HTML salvo: {ARQUIVO_SAIDA} ({tamanho:.0f} KB)")
    else:
        print("  (HTML ignorado — --no-html)")

    duracao = time.time() - inicio
    print(f"  Duração total: {duracao:.1f}s")
    print("=" * 70)


if __name__ == '__main__':
    main()
