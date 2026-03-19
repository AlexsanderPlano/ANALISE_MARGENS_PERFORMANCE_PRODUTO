#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
REIMPORTAR MOVIMENTOS EM LOTE — Base limpa para Rentabilidade
Busca movimentos 2025 de todos os produtos via API OMIE.
Salva em rentabilidade/dados/movimentos/PRODUTO.xlsx

Uso:
  python reimportar_movimentos.py                    (todos os produtos)
  python reimportar_movimentos.py TOMATE GRAPE 300G  (produto especifico)

Progresso salvo: interrompe e retoma de onde parou.
Rate limit: 5s entre produtos, pausa 30s a cada 10.
"""

import sys
import time
import json
import logging
from datetime import datetime
from pathlib import Path

# Adicionar pasta pai ao path para importar controle_ajuste
sys.path.insert(0, str(Path(__file__).parent.parent))

from controle_ajuste import (
    carregar_json,
    salvar_json,
    carregar_status,
    listar_movimentos_estoque,
    obter_saldo_valor_produto,
    salvar_excel_com_tabela,
    ARQUIVO_LISTA_PRODUTOS,
    PASTA_PROCESSADOS,
    OMIE_APP_KEY,
    OMIE_APP_SECRET,
)
import pandas as pd

# ============================================================================
# CONFIGURACAO
# ============================================================================

PASTA_BASE = Path(__file__).parent
PASTA_MOVIMENTOS = PASTA_BASE / 'dados' / 'movimentos'
ARQUIVO_LOG = PASTA_BASE / 'reimportar_movimentos_log.txt'
ARQUIVO_PROGRESSO = PASTA_BASE / 'reimportar_movimentos_progresso.json'

DELAY_ENTRE_PRODUTOS = 5    # segundos entre produtos
DELAY_ENTRE_LOTES = 30      # segundos a cada 10 produtos
PRODUTOS_POR_LOTE = 10


# ============================================================================
# LOGGING
# ============================================================================

def configurar_logging():
    logger = logging.getLogger('reimportar_movimentos')
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter('%(asctime)s | %(levelname)-7s | %(message)s',
                            datefmt='%Y-%m-%d %H:%M:%S')

    fh = logging.FileHandler(ARQUIVO_LOG, encoding='utf-8')
    fh.setLevel(logging.INFO)
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    return logger


# ============================================================================
# PROGRESSO
# ============================================================================

def carregar_progresso():
    if ARQUIVO_PROGRESSO.exists():
        try:
            with open(ARQUIVO_PROGRESSO, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def salvar_progresso(progresso):
    arquivo_tmp = ARQUIVO_PROGRESSO.with_suffix('.tmp')
    with open(arquivo_tmp, 'w', encoding='utf-8') as f:
        json.dump(progresso, f, ensure_ascii=False, indent=2)
    arquivo_tmp.replace(ARQUIVO_PROGRESSO)


# ============================================================================
# BUSCAR PRODUTO
# ============================================================================

def buscar_produto(termo, lista_produtos):
    """Busca produto por nome parcial ou codigo OMIE"""
    termo_upper = termo.replace(' ', '_').upper()
    termo_num = termo.strip()

    resultados = []
    for prod in lista_produtos:
        nome = prod['descricao'].replace(' ', '_')
        codigo = str(prod.get('codigo_omie', ''))

        if termo_num.isdigit() and codigo == termo_num:
            resultados.append(prod)
            continue

        palavras = termo_upper.split('_')
        if all(p in nome.upper() for p in palavras):
            resultados.append(prod)

    return resultados


# ============================================================================
# REIMPORTAR MOVIMENTOS DE UM PRODUTO
# ============================================================================

def reimportar_produto(nome_produto, codigo_produto, status_produto, log):
    """
    Busca movimentos 2025 via API e salva em dados/movimentos/PRODUTO.xlsx
    Retorna: (sucesso: bool, linhas: int, mensagem: str)
    """
    data_inicio = '01/01/2025'
    data_fim = '31/12/2025'

    log.info(f"    Buscando movimentos {data_inicio} a {data_fim}...")

    movimentos, msg = listar_movimentos_estoque(codigo_produto, data_inicio, data_fim)

    if movimentos is None:
        return False, 0, f"Erro API: {msg}"

    if len(movimentos) == 0:
        return True, 0, "Nenhum movimento encontrado"

    log.info(f"    Movimentos encontrados: {len(movimentos)}")

    # Ordenar: OPs primeiro no dia, cancelamentos após vendas
    def ordem_movimento(mov):
        data = datetime.strptime(mov.get('dtMov'), '%d/%m/%Y')
        origem = mov.get('desOrigem', '')
        if 'Ordem de Produ' in origem:
            tipo = 0
        elif 'Cancelamento' in origem:
            tipo = 2
        elif 'Venda' in origem:
            tipo = 1
        else:
            tipo = 3
        id_mov = mov.get('idMov', 0)
        return (data, tipo, id_mov)

    mov_ordenados = sorted(movimentos, key=ordem_movimento)

    # Saldo inicial
    saldo_usuario = status_produto.get('saldo_inicial_usuario') if status_produto else None
    valor_usuario = status_produto.get('valor_inicial_usuario') if status_produto else None

    if saldo_usuario is not None:
        saldo_ini = saldo_usuario
        cmc_ini = valor_usuario if valor_usuario is not None else 0
    else:
        dados_planilha = obter_saldo_valor_produto(nome_produto)
        if dados_planilha:
            saldo_ini = dados_planilha['saldo']
            cmc_ini = dados_planilha['valor']
        else:
            saldo_ini = 0
            cmc_ini = 0

    log.info(f"    Saldo inicial: {saldo_ini} @ R$ {cmc_ini:.4f}")

    # Filtrar apenas 2025
    movs_2025 = [m for m in mov_ordenados if '2025' in m.get('dtMov', '')]

    # Criar linhas
    linhas = [{
        'Data': '31/12/2024',
        'Origem': 'Saldo Inicial',
        'Quantidade': saldo_ini,
        'Valor': cmc_ini,
        'Saldo Acumulado': saldo_ini,
        'CMC Unitario': cmc_ini,
        'CMC Total': saldo_ini * cmc_ini,
        'Nota Fiscal': '',
        'Operacao': '',
        'Cliente ou Fornecedor': ''
    }]

    for mov in movs_2025:
        mp = mov.get('movPeriodo', [])
        entrada = next((m for m in mp if '2.Entrada' in m.get('tipo', '')), {})
        saida = next((m for m in mp if '3.Sa' in m.get('tipo', '')), {})
        atual = next((m for m in mp if '4.Atual' in m.get('tipo', '')), {})

        qtde = (entrada.get('qtde', 0) or 0) + (saida.get('qtde', 0) or 0)
        valor = entrada.get('cmcUnitario', 0) or abs(saida.get('cmcUnitario', 0) or 0)

        linhas.append({
            'Data': mov.get('dtMov', ''),
            'Origem': mov.get('desOrigem', ''),
            'Quantidade': qtde,
            'Valor': valor,
            'Saldo Acumulado': 0,
            'CMC Unitario': atual.get('cmcUnitario', 0),
            'CMC Total': atual.get('cmcTotal', 0),
            'Nota Fiscal': mov.get('numDoc', ''),
            'Operacao': mov.get('numPedido', ''),
            'Cliente ou Fornecedor': mov.get('desCliFornec', '')
        })

    df = pd.DataFrame(linhas)

    # Converter data
    df['Data'] = pd.to_datetime(df['Data'], format='%d/%m/%Y', errors='coerce')

    # Reordenar: OPs primeiro, Cancelamento após sua NF
    df['Dia'] = df['Data'].dt.date
    df['ordem_dia'] = df.groupby('Dia').cumcount().astype(float)

    mask_op = df['Origem'].str.contains('Ordem de Produ', na=False)
    df.loc[mask_op, 'ordem_dia'] = -1

    for dia in df['Dia'].unique():
        mask_dia = df['Dia'] == dia
        df_dia = df[mask_dia]

        venda_pos = {}
        for idx, row in df_dia.iterrows():
            if 'Venda' in str(row['Origem']) and 'Cancelamento' not in str(row['Origem']):
                nf = row.get('Nota Fiscal')
                if pd.notna(nf) and nf != '':
                    venda_pos[nf] = df.loc[idx, 'ordem_dia']

        for idx, row in df_dia.iterrows():
            if 'Cancelamento' in str(row['Origem']):
                nf = row.get('Nota Fiscal')
                if pd.notna(nf) and nf in venda_pos:
                    df.loc[idx, 'ordem_dia'] = venda_pos[nf] + 0.5

    df = df.sort_values(['Data', 'ordem_dia']).reset_index(drop=True)
    df = df.drop(columns=['Dia', 'ordem_dia'], errors='ignore')

    # Recalcular saldo acumulado
    saldo = 0
    saldos = []
    for idx, row in df.iterrows():
        qtd = row['Quantidade'] if pd.notna(row['Quantidade']) else 0
        saldo += qtd
        saldos.append(saldo)
    df['Saldo Acumulado'] = saldos

    # Salvar
    PASTA_MOVIMENTOS.mkdir(parents=True, exist_ok=True)
    arquivo_saida = PASTA_MOVIMENTOS / f'{nome_produto}.xlsx'

    salvar_excel_com_tabela(
        df, arquivo_saida,
        nome_tabela="TabelaMovimentos",
        colunas_centralizar=['Quantidade', 'Saldo Acumulado']
    )

    return True, len(df), f"{len(df)} linhas"


# ============================================================================
# MAIN
# ============================================================================

def main():
    log = configurar_logging()

    filtro = '_'.join(sys.argv[1:]) if len(sys.argv) > 1 else None

    log.info("=" * 70)
    log.info("REIMPORTAR MOVIMENTOS — Base limpa para Rentabilidade")
    if filtro:
        log.info(f"Filtro: {filtro}")
    log.info("=" * 70)
    inicio_geral = time.time()

    # Carregar lista de produtos
    lista_produtos = carregar_json(ARQUIVO_LISTA_PRODUTOS)
    if not lista_produtos:
        log.error("lista_produtos.json nao encontrado!")
        return

    # Carregar status (para saldo inicial)
    status = carregar_status()
    produtos_status = status.get('produtos', {})

    # Filtrar por produto
    if filtro:
        encontrados = buscar_produto(filtro, lista_produtos)
        if not encontrados:
            log.error(f"Nenhum produto encontrado para: {filtro.replace('_', ' ')}")
            return
        if len(encontrados) > 1:
            log.info(f"{len(encontrados)} produtos encontrados:")
            for i, p in enumerate(encontrados, 1):
                log.info(f"  {i:3d}. {p['descricao']}")
            log.info("Seja mais especifico no nome.")
            return
        produtos = encontrados
    else:
        produtos = lista_produtos

    log.info(f"Produtos a processar: {len(produtos)}")

    # Carregar progresso
    progresso = carregar_progresso()

    # Filtrar pendentes
    pendentes = []
    ja_feitos = 0
    for prod in produtos:
        nome = prod['descricao'].replace(' ', '_')
        if not filtro and progresso.get(nome, {}).get('concluido', False):
            ja_feitos += 1
            continue
        pendentes.append(prod)

    if ja_feitos:
        log.info(f"Ja reimportados: {ja_feitos}")
    log.info(f"Pendentes: {len(pendentes)}")

    if not pendentes:
        log.info("Nada a fazer.")
        return

    # Processar
    ok_count = 0
    erro_count = 0
    total_linhas = 0
    erros = []
    no_lote = 0

    for i, prod in enumerate(pendentes, 1):
        nome = prod['descricao'].replace(' ', '_')
        codigo = prod.get('codigo_omie')

        if not codigo:
            log.warning(f"  [{i}/{len(pendentes)}] {nome} — sem codigo OMIE, pulando")
            continue

        log.info(f"")
        log.info(f"[{i}/{len(pendentes)}] {nome} (cod: {codigo})")
        log.info("-" * 50)
        inicio_prod = time.time()

        st_prod = produtos_status.get(nome, {})

        try:
            sucesso, linhas, msg = reimportar_produto(nome, codigo, st_prod, log)
            duracao = time.time() - inicio_prod

            if sucesso:
                ok_count += 1
                total_linhas += linhas
                log.info(f"  OK ({duracao:.1f}s) — {msg}")

                progresso[nome] = {
                    'concluido': True,
                    'linhas': linhas,
                    'data': datetime.now().isoformat()
                }
            else:
                erro_count += 1
                erros.append((nome, msg))
                log.warning(f"  FALHA ({duracao:.1f}s) — {msg}")

                progresso[nome] = {'concluido': False}

                if 'rate_limit' in msg.lower() or 'http_500' in msg.lower():
                    log.error("PARANDO — API instavel")
                    salvar_progresso(progresso)
                    break

            salvar_progresso(progresso)

        except Exception as e:
            duracao = time.time() - inicio_prod
            erro_count += 1
            erros.append((nome, str(e)))
            log.error(f"  ERRO ({duracao:.1f}s) — {e}")

        # Rate limit
        no_lote += 1
        if no_lote >= PRODUTOS_POR_LOTE and i < len(pendentes):
            log.info(f"  Pausa {DELAY_ENTRE_LOTES}s (lote de {PRODUTOS_POR_LOTE})")
            time.sleep(DELAY_ENTRE_LOTES)
            no_lote = 0
        elif i < len(pendentes):
            time.sleep(DELAY_ENTRE_PRODUTOS)

    # Resumo
    duracao_total = time.time() - inicio_geral
    minutos = int(duracao_total // 60)
    segundos = int(duracao_total % 60)

    log.info("")
    log.info("=" * 70)
    log.info("RESUMO")
    log.info("=" * 70)
    log.info(f"  Processados: {ok_count + erro_count}/{len(pendentes)}")
    log.info(f"  Sucesso: {ok_count}")
    log.info(f"  Erros:   {erro_count}")
    log.info(f"  Total linhas: {total_linhas:,}")
    log.info(f"  Duracao: {minutos}min {segundos}s")
    log.info(f"  Destino: {PASTA_MOVIMENTOS}")

    if erros:
        log.info("")
        log.info("PRODUTOS COM ERRO:")
        for nome, msg in erros:
            log.info(f"  - {nome}: {msg}")

    log.info("")
    log.info("=" * 70)
    log.info("FIM DA REIMPORTACAO")
    log.info("=" * 70)


if __name__ == '__main__':
    main()
