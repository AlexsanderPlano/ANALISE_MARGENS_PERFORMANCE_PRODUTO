# Changelog — Rentabilidade de Produtos e Clientes 2025

## v1.3 (2026-03-19)
### Airtable populado + Fórmula DF corrigida no script
- Fórmula DF corrigida em `gerar_rentabilidade.py`: Receita Bruta x %DF (era Comissão Bruta x %DF)
- Fórmula Comissão corrigida: (Receita - DF - Devoluções) x %Comissão (base líquida)
- Função `upload_airtable()` adicionada ao script (batch create com rate limit)
- Função `airtable_delete_all()` para limpar tabelas antes de popular
- Airtable populado: 184 Produtos + 174 Clientes + ~49k Detalhe
- Flags `--no-airtable` e `--no-html` para controle de execução
- Encoding corrigido nos prints (box drawing → ASCII)
- `ESTATISTICAS_PROJETO.md` criado (279 linhas, 8 seções, 15 tabelas)

## v1.2 (2026-03-19)
### Filtros avançados (21 variáveis)
- Painel colapsável com toggle, badge de contagem, limpar/aplicar
- 7 dimensões: Meses (pills), Produtos/Clientes (multi-select com busca), Vendedor, Categoria, Dias da Semana
- 9 métricas: dual-range sliders (Taxa Devol, Margem, Receita, Preço, Custo, Volume, CMV, DF, Comissão)
- 5 classificações: Faixa Margem, Status Devolução, Tendência Preço, Score Variância, Faixa vs Normal
- `FILTER_STATE` object centralizado + 13 funções novas
- Data-attributes nos `.produto-card` para filtragem sem re-render
- Substituiu `filtrarProdutos()` por `aplicarFiltros()` (com fallback legacy)
- CSS prefixado `adv-*` (~120 linhas)
- Pendentes: Vendedor, Categoria, Score Variância, Faixa vs Normal (requerem dados Airtable)

## v1.1 (2026-03-19)
### sec-devolucoes redesenhada (dashboard multinível)
- Seção devoluções substituída por dashboard de 3 níveis com Tailwind CSS
- Nível 1: Radar qtd devolvida + gráfico composto (barras venda + linhas %dev/preço/meta)
- Nível 2: Top 10 clientes com barras verticais proporcionais (HTML puro)
- Nível 3: Deep Dive com share vendas/devoluções (pendente Airtable) + gráfico representatividade mensal
- Diagnóstico + Ação Estratégica (cards texto dinâmicos)
- CDNs adicionados: Tailwind CSS (preflight off), Lucide Icons, Inter font
- Fórmula DF confirmada: sobre Receita Bruta (loja retém no pagamento)
- sec-devolucoes movida para depois de sec-analise
- overflow:visible na sec-devolucoes

## v1.0 (2026-03-19)
### Frontend completo (5 seções por produto)
- Estrutura do projeto e dados copiados
- CMV corrigido: JOIN por NF (99,993% vs OMIE)
- Desc. Financeiro corrigido: sobre receita, por CNPJ
- Comissão corrigida: sobre base líquida
- 5 seções no card de produto (estrutura, spread, DRE, devoluções, análise)
- Gráficos Chart.js (spread preço/custo, devoluções, radar, barras)
- Painel operacional semanal com 8 linhas por semana
- Análise de variância com mini-cards e semáforos
- Faixas vs Normal (mediana) com 5 classificações
- Dias de pagamento destacados
- Clientes únicos (semana, mês, dia)
- Design system unificado (indigo, 6 tamanhos, 3 pesos, 2 cinzas)
- Section headers com borda lateral colorida
- Mapa UI com explorador de árvore progressivo
- Exportar PDF (jsPDF + autoTable, 3 páginas) e HTML por produto

## v0.1.0 (2026-03-17)
### Estrutura inicial
- Criada pasta do projeto
- Copiados dados de vendas, devoluções, movimentos e comissões
- 190 produtos reimportados via API OMIE (movimentos 2025)
- Base Airtable criada: `appC95CSdCeBrKQ83` com 3 tabelas (Produtos, Clientes, Detalhe)
- Modelo de design definido: `mix_produtos_v14.html`
- Fórmulas validadas (comissão, CMV, margem) com relatório real
- Documentação completa em `README.md`
