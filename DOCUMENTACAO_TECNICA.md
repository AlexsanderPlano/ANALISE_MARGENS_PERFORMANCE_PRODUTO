# Rentabilidade de Vendas 2025 — Documentação Técnica

**Versão:** 1.0
**Última atualização:** 2026-03-19
**Arquivo principal:** `index.html` (~2000+ linhas — single-file HTML/CSS/JS)
**Stack:** HTML + CSS + JavaScript puro + Chart.js 4.4.1 + API Airtable (REST)

---

## 1. Visão Geral

### O que é
Dashboard de análise de rentabilidade por produto, cruzando CMV corrigido (pós-ajuste de estoque) com receita, devoluções, descontos financeiros e comissões para determinar a rentabilidade real.

### Para quem
Gestores comerciais que precisam:
- Entender a rentabilidade real de cada produto
- Identificar meses fortes/fracos e seus drivers
- Analisar padrão de vendas por dia da semana
- Monitorar devoluções por cliente e período
- Comparar performance com médias e medianas

### Arquitetura
```
RENTABILIDADE_VENDAS_2025/
├── index.html              ← Frontend completo (single-file)
├── painel-data.js          ← Dados calculados (ALFACE AMERICANA 150G)
├── mapa-ui.js              ← Ferramenta de inspeção visual
├── gerar_rentabilidade.py  ← Script de cálculo (Python/pandas)
├── inspetor.js             ← Inspetor de elementos
├── dados/
│   ├── VENDAS_2025.xlsx           ← 248k linhas, 184 produtos, 174 clientes
│   ├── DEVOLUCOES_2025.xlsx       ← 19.8k linhas
│   ├── Vendedor vs Comissão.xlsx  ← 244 clientes com %DF e %Comissão
│   └── movimentos/                ← 190 arquivos (1 por produto, API OMIE)
│       └── ALFACE_AMERICANA_150G.xlsx
├── mix_produtos_v14.html   ← Modelo canônico de design
└── DOCUMENTACAO_TECNICA.md ← Este arquivo
```

### Airtable
- **Base:** `appC95CSdCeBrKQ83`
- **Tabelas:** Produtos, Clientes, Detalhe (cliente × produto × mês)
- **Status:** Base criada, dados pendentes de população em lote

---

## 2. Fontes de Dados e Cálculos

### 2.1 CMV (Custo da Mercadoria Vendida)

**Metodologia:** JOIN por Nota Fiscal entre movimentos OMIE e vendas

```
Para cada NF de venda:
  1. Buscar NF em movimentos/PRODUTO.xlsx
  2. Extrair CMC Unitário daquela venda (campo "CMC Unitario")
  3. CMV da NF = |Quantidade| × CMC Unitário

Filtros:
  - Excluir cancelamentos (NFs com "Cancelamento de Venda" correspondente)
  - Só usar "Venda de Produto"
```

**Precisão:** 99,993% vs DRE OMIE (diferença R$ 31,56 em R$ 455.442 — arredondamento)

**Fonte do CMC:** Calculado pelo OMIE internamente:
```
CMC = (Saldo Anterior × CMC Anterior + Qtd Entrada × Valor Entrada) / (Saldo Anterior + Qtd Entrada)
```

### 2.2 Desconto Financeiro

```
Para cada NF de venda:
  1. Buscar CNPJ do cliente
  2. Buscar %Desc.Fin na planilha "Vendedor vs Comissão.xlsx"
  3. Desc.Fin = TotalNF × %Desc.Fin do cliente

Obs: Retido pelas lojas, não é sobre a comissão
Obs: %DF varia por cliente (0%, 5%, 6.5%, 16%)
```

### 2.3 Comissão

```
Base Comissão = Receita Bruta - Desc. Financeiro - Devoluções
Comissão = Base Comissão × 0,8%
```

### 2.4 Devoluções

```
Fonte: DEVOLUCOES_2025.xlsx (devoluções financeiras, NF de estorno)
Qtd Devolvida = Σ |Quantidade| por produto × mês
Valor Devolvido = Σ |TotalNF| por produto × mês

Obs: São devoluções FINANCEIRAS, não entrada física no estoque
Obs: A planilha já contém NomeFantasia (cliente), não precisa cruzar
```

### 2.5 DRE Completa por Produto

```
  Qtd Vendas
  R$ Unit. Ponderado = Receita / Qtd
= RECEITA BRUTA
  (-) Devoluções R$
  (-) Desc. Financeiro = Receita NF × %DF do cliente
  (-) Comissão = (Receita - Desc.Fin - Devol) × 0,8%
= RECEITA LÍQUIDA
  (-) Custo Unit. Ponderado = CMV / Qtd
  (-) CMV = Σ (Qtd cada venda × CMC do momento)
= MARGEM DE CONTRIBUIÇÃO
  Marg. Contrib. Unitária = Margem / Qtd
```

### 2.6 Dias da Semana

```
Quantidade vendida: agrupada pelo DIA DA NF (quando vendeu)
Entregas (NFs): agrupadas pelo DIA DE ENTREGA (dia seguinte útil)

Regra de entrega:
  NF Segunda → Entrega Terça
  NF Terça → Entrega Quarta
  NF Quarta → Entrega Quinta
  NF Quinta → Entrega Sexta
  NF Sexta → Entrega Sábado
  NF Sábado → Entrega Segunda
```

### 2.7 Médias e Medianas

```
Média Mês por dia = Total Qtd daquele dia no mês / Nº de dias úteis daquele dia no mês
  Ex: Média SEG Jan = 3.972 / 4 segundas = 993

Mediana Mês por dia = Mediana das Qtd semanais daquele dia (exclui zeros)
  Ex: Valores SEG Jan: 369, 621, 1.182, 1.800
      Mediana = (621 + 1.182) / 2 = 901

Média Ano por dia = Total Qtd daquele dia no ano / Nº de dias úteis daquele dia no ano
  Ex: Média SEG Ano = 53.089 / 52 = 1.020

Mediana Ano por dia = Mediana de todas as semanas do ano para aquele dia
```

### 2.8 Faixas vs Normal (Mediana)

```
% Desvio = (Valor Real - Mediana) / Mediana × 100

Classificação:
  Muito acima do normal:  > +50%
  Acima do normal:        +15% a +50%
  Normal:                 ±15%
  Abaixo do normal:       -15% a -50%
  Muito abaixo do normal: < -50%
```

### 2.9 Análise de Variância (Drivers de Margem)

```
Para cada mês, comparar com média anual:
  Qtd:   se qtd_mes >= média_anual_qtd → Favorável (🟢)
  Preço: se pp_mes >= média_anual_pp → Favorável (🟢)
  Custo: se cu_mes <= média_anual_cu → Favorável (🟢, invertido)

Score: 0/3 (Crítico) a 3/3 (Excelente)
```

### 2.10 Clientes Únicos

```
Por dia: NomeFantasia.nunique() do dia (pode repetir entre dias)
Por semana: NomeFantasia.nunique() da semana (comprou 1x = conta 1)
Por mês total: NomeFantasia.nunique() do mês inteiro
Por mês por dia: NomeFantasia.nunique() de todas as SEG do mês (comprou em 4 SEG = conta 1)
```

### 2.11 Dias de Pagamento (destaque no calendário)

```
Dias com demanda alta (💰):
  Dia 5 — CLT recebe salário
  Dia 6 — Dia seguinte ao salário
  Dia 20 — CLT recebe adiantamento
  Dia 21 — Dia seguinte ao adiantamento
  Último dia útil do mês — Func. público recebe

Dias pós-pagamento (🛒):
  Dia 1 e 2 da primeira semana — Func. público compra
```

### 2.12 Devoluções — Análise

```
Tabela mensal:
  Para cada mês:
    qtdVenda, recVenda — de VENDAS_2025.xlsx
    qtdDev, rsDev — de DEVOLUCOES_2025.xlsx (abs)
    pctQtd = qtdDev / qtdVenda × 100
    pctRec = rsDev / recVenda × 100
    nCli = clientes únicos que devolveram
    topCli = cliente com maior Σ |TotalNF| no mês

Top 10 clientes:
    R$ Dev = Σ |TotalNF| anual por cliente
    % Total = R$ Dev cliente / R$ Dev total × 100
    % Acumulado = soma progressiva (Pareto)

Radar: Qtd devolvida por mês (12 eixos, valores absolutos)
Barras: Top 10 clientes por R$ devolvido (10 cores)
```

---

## 3. Estrutura do Frontend

### 3.1 Navegação

```
App Header (sticky)
├── Hamburger (sidebar)
└── Título + Status Airtable

Tabs Bar: Visão Geral | Por Produto | Por Cliente | Ajustes Estoque

Sidebar: Navegação + Exportar PDF
```

### 3.2 Aba "Por Produto" — Estrutura do Card

```
div.card.produto-card
├── div.card-header (azul, clicável, colapsável)
│   └── "ALFACE AMERICANA 150G" + chevron
│
└── div.card-body.card-collapsible
    │
    ├── div.sec-estrutura ← Estrutura de Resultado
    │   ├── .section-header (borda indigo)
    │   ├── .cards-grid (linha 1: 13 elementos — 7 cards + 6 operadores)
    │   │   [Qtd] × [R$ Unit] = [Receita] − [Devol] − [Desc.Fin] − [Comissão] = [Rec.Líq]
    │   └── .cards-grid-row2 (linha 2: 13 elementos)
    │       [Custo Unit] × [Qtd] = [CMV] | [Rec.Líq] − [CMV] = [Marg.Contrib] ÷ [Marg.Unit]
    │
    ├── div.sec-spread ← Spread de Margem de Contribuição x Volume
    │   ├── .section-header (borda verde)
    │   ├── .chart-container
    │   │   ├── canvas#chart-qtd-N (linha azul, Qtd Vendas)
    │   │   └── canvas#chart-preco-N (verde Preço, vermelho Custo, área margem)
    │   ├── Análise de Variância (.section-header borda laranja)
    │   │   ├── 12 mini-cards (score 0-3, semáforos, valores)
    │   │   └── Legenda (Qtd e Preço: acima/abaixo | Custo: invertido)
    │
    ├── div.sec-dre ← DRE — Demonstrativo de Resultado
    │   ├── .section-header (borda dark)
    │   └── table (17 métricas × 12 meses + Total)
    │
    ├── div.sec-devolucoes ← Análise de Devoluções
    │   ├── .section-header (borda vermelha)
    │   ├── canvas (barras: vendas vs devoluções por mês)
    │   ├── table (mensal: Qtd Venda, Qtd Dev, %, R$, Clientes, Top)
    │   ├── canvas (radar: qtd devolvida por mês)
    │   └── canvas (barras verticais: top 10 clientes)
    │
    └── div.sec-analise ← Análise Histórica de Vendas
        ├── .section-header (borda indigo) + select mês
        ├── Conteúdo por mês (12 divs, 1 visível)
        │   └── table (por semana)
        │       ├── Data (calendário com 💰🛒)
        │       ├── Vendas (un)
        │       ├── Δ Média Mês
        │       ├── vs Normal (valor | % + classificação + ref)
        │       ├── Δ Média Ano
        │       ├── Clientes (únicos por dia, total único por semana)
        │       ├── NFs
        │       └── Entregas (dia entrega = NF + 1 dia útil)
        │
        ├── Bloco Referências
        │   ├── Média Mês (verde)
        │   ├── Mediana Mês (amarelo)
        │   ├── Média Ano (azul)
        │   ├── Mediana Ano (roxo)
        │   └── Legenda faixas vs Normal
        │
        ├── Totais
        │   ├── Σ Vendas + x̄ Vendas/dia
        │   ├── Σ Clientes (únicos mês por dia)
        │   ├── Σ NFs
        │   └── Σ Entregas
        │
        └── Linha Performance (dark)
            └── Qtd Total | Clientes | NFs | Entregas | Status
```

---

## 4. Design System

### 4.1 Paleta de Cores

```css
:root {
    --bg: #f5f6f8;
    --primary: #1e293b;           /* Slate dark */
    --primary-light: #334155;     /* Slate */
    --success: #0d9e5f;           /* Verde */
    --warning: #e67e22;           /* Laranja */
    --danger: #dc3545;            /* Vermelho */
    --white: #ffffff;
    --text: #1b1f2a;              /* Texto principal */
    --text-secondary: #5f6780;    /* Cinza único (labels, dados) */
    --text-muted: #9ba3b8;        /* Cinza claro (poucos usos) */
    --border: #e4e7ec;            /* Borda única */
    --accent: #4338ca;            /* Indigo */
    --accent-dim: rgba(67,56,202,0.06);
}
```

### 4.2 Escala Tipográfica

```css
:root {
    --fs-xs: 0.55rem;    /* 8.8px — badges, ref, labels tiny */
    --fs-sm: 0.65rem;    /* 10.4px — labels, legendas */
    --fs-md: 0.78rem;    /* 12.5px — dados tabela, valores */
    --fs-lg: 0.88rem;    /* 14.1px — valores principais */
    --fs-xl: 1.1rem;     /* 17.6px — totais, destaques */
    --fs-2xl: 1.5rem;    /* 24px — título página */
    --fw-normal: 500;    /* Texto corrido */
    --fw-bold: 600;      /* Labels */
    --fw-black: 700;     /* Dados, títulos (max JetBrains Mono) */
}
```

### 4.3 Fontes

| Fonte | Uso | Pesos carregados |
|-------|-----|-----------------|
| Outfit | Títulos, labels, texto | 300-800 |
| JetBrains Mono | Números, dados, valores | 400-700 |
| DM Sans | Botões, elementos UI | 400-700 |

### 4.4 Section Headers

```css
.section-header {
    margin-top: 28px;
    margin-bottom: 16px;
    padding: 10px 16px;
    border-left: 4px solid var(--accent);
}
.section-header h3 { font-size: 20px; }

/* Variantes de cor */
.border-accent  → var(--accent)  indigo
.border-success → var(--success) verde
.border-warning → var(--warning) laranja
.border-primary → var(--primary) dark
.border-danger  → var(--danger)  vermelho
```

### 4.5 Seções e Containers

```css
/* Cada seção dentro do card */
sec() → margin: 12px 16px;
        padding: 16px;
        background: white;
        border-left/right: 1px solid var(--border);
        border-top/bottom: 2px solid var(--border);
        border-radius: var(--radius);
```

---

## 5. Arquivos de Dados

### 5.1 painel-data.js

```javascript
DEVOLUCOES_ALFACE         // 12 meses: qtdVenda, recVenda, qtdDev, rsDev, pctQtd, pctRec, nCli, topCli
TOP_CLIENTES_DEVOL        // Top 10 clientes: nome, qtd, valor
CLIENTES_UNICOS_MES       // 12 meses: total + porDia[6]
CLIENTES_UNICOS_SEMANA    // 12 meses × 4-6 semanas: únicos por semana
MEDIANA_MES               // 12 meses × 6 dias: mediana qtd por dia
MEDIANA_ANO               // 6 dias: mediana anual por dia
DATAS_SEMANA              // 12 meses × 4-6 semanas × 6 dias: dia do mês
PAINEL_ALFACE             // mediaAnualDia, avgAnualPorDia[6], meses[12][semanas]
  Cada semana: sales[6], clients[6], nfs[6], deliveries[6], histDayAvg[6]
```

### 5.2 gerar_rentabilidade.py

```python
carregar_cmv_movimentos()   # CMV por transação (JOIN por NF, filtra cancelamentos)
calcular()                  # CMV proporcional por cliente, comissão corrigida
agregar_por_cliente()       # Ranking clientes + detalhe por produto × mês
agregar_por_produto()       # Ranking produtos + detalhe por cliente × mês
```

**Fórmulas corrigidas:**
- CMV = Σ(Qtd × CMC de cada venda), não CMC fim do mês
- Desc.Fin = Receita × %DF (sobre receita, não sobre comissão)
- Comissão = (Receita - DF - Devol) × 0,8%

---

## 6. Funções JavaScript

### Navegação
| Função | Descrição |
|--------|-----------|
| `navegarTab(el)` | Troca de aba |
| `toggleSidebar()` | Abre/fecha sidebar |
| `toggleCard(header)` | Expande/colapsa card |
| `trocarMesPainel(id, idx)` | Troca mês no painel operacional |
| `trocarMesDias(id, idx)` | Troca mês nos dias da semana (legacy) |
| `toggleDiaSemana(id)` | Expande/colapsa dias (legacy) |

### Dados
| Função | Descrição |
|--------|-----------|
| `carregarDados()` | Tenta Airtable, fallback mock |
| `airtableFetchAll(tableId)` | Busca todos registros com paginação |
| `renderTudo()` | Renderiza todas as abas |
| `renderVisaoGeral()` | Cards + rankings |
| `renderProdutos()` | Cards de produto com 5 seções |
| `renderClientes()` | Tabela ranking clientes |
| `renderAjustes()` | DRE comparativa |

### Formatação
| Função | Descrição |
|--------|-----------|
| `fmtBRL(v)` | R$ 1.234 |
| `fmtBRL2(v)` | R$ 1.234,56 |
| `fmtNum(v)` | 1.234 |
| `fmtPct(v)` | 12,3% |
| `fmtVal(v, type)` | Formatação por tipo (int, money, reais, pct) |
| `mgClass(p)` | Classe de cor da margem (alta/media/baixa) |

### Filtros Avançados (21 variáveis)

| Função | Descrição |
|--------|-----------|
| `toggleFilterPanel()` | Abre/fecha o painel colapsável de filtros |
| `toggleMultiSelect(name)` | Abre/fecha dropdown multi-select (Produtos/Clientes) |
| `filterMultiOptions(input, id)` | Busca texto dentro do dropdown multi-select |
| `updateMultiLabel(name)` | Atualiza label do trigger ("Todos" / "3 selecionados") |
| `togglePill(el, group)` | Toggle ativo/inativo em pill de classificação |
| `initFilterPanel()` | Popula todos os filtros: pills meses/dias, multi-selects, range sliders, classificações |
| `updateRange(key)` | Atualiza barra ativa e labels min/max do range slider |
| `readFilterState()` | Lê todos os inputs do painel e atualiza `FILTER_STATE` |
| `classifyProduct(card)` | Deriva classificações (faixaMargem, statusDevolucao, tendenciaPreco) dos data-attributes |
| `getActiveFilterCount()` | Conta quantos filtros estão ativos (para o badge) |
| `aplicarFiltros()` | Função principal: lê estado, filtra cards, atualiza contagem e badge |
| `limparFiltros()` | Reseta todos os filtros para padrão e re-aplica |
| `filtrarProdutos()` | Wrapper legacy → chama `aplicarFiltros()` |

### Objeto FILTER_STATE

```javascript
{
    // Dimensões (7)
    meses: [],           // [0..11] índices de meses ativos
    produtos: [],        // nomes de produtos selecionados
    clientes: [],        // nomes de clientes selecionados
    vendedor: '',        // futuro (Airtable)
    categoria: '',       // futuro (Airtable)
    diasSemana: [],      // [0..5] seg=0..sáb=5

    // Métricas (9) — null = sem filtro, {min,max} = range ativo
    taxaDevolucao, margem, receita, precoMedio, custoUnit,
    volume, cmvPct, descFinanceiro, comissao

    // Classificações (5) — array de valores ativos
    faixaMargem: [],     // ['excelente','boa','regular','critica']
    scoreVariancia: [],  // ['3','2','1','0']
    faixaVsNormal: [],   // ['acima','normal','abaixo']
    statusDevolucao: [], // ['normal','atencao','critico']
    tendenciaPreco: []   // ['alta','estavel','queda']
}
```

### Data Attributes nos Cards

Cada `.produto-card` recebe `data-*` para filtragem sem re-render:
```
data-nome, data-nome-full, data-pdrs, data-pmg, data-rec,
data-pp, data-cu, data-qtd, data-pcmv, data-pdf, data-pcom
```

### Classificações derivadas

| Classificação | Regra |
|---------------|-------|
| Faixa Margem | >50% Excelente, 40-50% Boa, 30-40% Regular, <30% Crítica |
| Status Devolução | <5% Normal, 5-10% Atenção, >10% Crítico |
| Tendência Preço | Mock: "Estável" (requer dados mensais de todos os produtos) |
| Score Variância | Pendente (requer dados de variância por produto) |
| Faixa vs Normal | Pendente (requer medianas de todos os produtos) |

### CSS

Todas as classes prefixadas `adv-filter-*` / `adv-*` para evitar conflito:
- `.adv-filter-bar` — barra com input, toggle, botões
- `.adv-filter-body` / `.collapsed` — painel colapsável (max-height transition)
- `.adv-pill` / `.active` — pills toggle (classificações, meses, dias)
- `.adv-range-wrap` — dual range slider (2 inputs sobrepostos)
- `.adv-multi-wrap` / `.adv-multi-dropdown` — dropdown com checkboxes
- `.adv-btn-apply` / `.adv-btn-clear` — botões de ação

---

## 7. Mapa UI (mapa-ui.js)

### Melhoria: Explorador de Árvore Progressivo

```
▶ section#por-produto          ← clica, entra
  ▶ div.page-header
  ▶ div.filter-bar
  ▼ div#containerProdutos      ← expandido
    ▼ div.card.produto-card
      ▶ div.card-header
      ▼ div.card-body
        ▶ div.sec-estrutura
        ▶ div.sec-spread
        ▶ div.sec-dre
        ▶ div.sec-devolucoes
        ▶ div.sec-analise
```

- **◀ Voltar** → volta ao nível anterior
- **Breadcrumbs** clicáveis → pula direto
- **Duplo clique** → destaca na página
- **Contagem de filhos** por nó

---

## 8. Dados do ALFACE AMERICANA 150G (validados)

### DRE Anual
```
Receita Bruta:        R$ 1.186.457   100,0%
(-) Devoluções:       R$    66.755     5,6%
(-) Desc. Financeiro: R$    77.345     6,5%
(-) Comissão:         R$     8.340     0,7%
(-) CMV:              R$   455.065    38,4%
= Margem Contrib.:    R$   578.950    48,8%
```

### Volumes
```
Qtd Vendas:    333.660 un
NFs:           6.699
Clientes:      114 únicos
Meses:         12 (Jan-Dez 2025)
```

### CMV validado vs OMIE
```
CMV OMIE DRE oficial:     R$ 455.442,29
CMV nosso (JOIN por NF):  R$ 455.473,84
Diferença:                R$ 31,55 (0,007%)
```

### Devoluções
```
Total R$:              R$ 66.755
Total Qtd:             19.218 un
Clientes que devolvem: 41
Top 10 = 66,8% do total
#1 MUFFATO PORTAO = 16,3%
```

---

## 9. Seção Devoluções — Dashboard Multinível (sec-devolucoes)

### Redesign completo (2026-03-19)
Seção substituída por dashboard multinível com Tailwind CSS + Lucide Icons + Inter font.

### Estrutura
```
sec-devolucoes (overflow:visible)
├── Cabeçalho + Badge Alerta (mês com maior % devolução, dinâmico)
├── KPIs (4 cards: Faturamento, Total Devolvido, Volume Qtd, Impacto Top 10)
├── Nível 1: Visão Geral e Sazonalidade
│   ├── Radar — Volume Físico (qtd devolvida por mês, 12 eixos)
│   └── Gráfico Composto — Eficiência Financeira
│       ├── Barras cinza: R$ Venda (eixo direito)
│       ├── Linha vermelha: % Devolução (eixo esquerdo)
│       ├── Linha verde: Preço Médio Ponderado (eixo oculto y2)
│       └── Linha tracejada amarela: Meta 5%
├── Nível 2: Estratégia de Contenção (Top 10)
│   └── 10 barras verticais proporcionais (altura = valor / máximo × 100%)
├── Nível 3: Deep Dive — Produto
│   ├── Share de Vendas (% do faturamento total empresa) ← PENDENTE AIRTABLE
│   ├── Share de Devoluções (% das devoluções total empresa) ← PENDENTE AIRTABLE
│   ├── Alerta de Desproporção + Taxa SKU
│   └── Gráfico Representatividade Mensal
│       ├── Barras verdes: Receita produto/mês
│       ├── Linha vermelha: % Devolução/mês
│       └── Linha indigo tracejada: % Faturamento Total/mês ← MOCK (totalEmpresaMes hardcoded)
└── Diagnóstico Geral + Ação Estratégica (2 cards texto)
```

### Dados pendentes (Airtable)
| Campo | Origem | Status |
|-------|--------|--------|
| Share de Vendas (%) | receita produto / receita total empresa | Pendente — exibido como "— %" |
| Share de Devoluções (%) | devol produto / devol total empresa | Pendente — exibido como "— %" |
| % Faturamento Total/mês | receita produto mês / receita empresa mês | Mock — array `totalEmpresaMes` hardcoded |

### Fórmula confirmada
```
Desc. Financeiro = Receita Bruta × %DF do cliente
Motivo: a loja retém ao fazer o pagamento das NFs (não é sobre comissão)
```

### CDNs adicionados
- Tailwind CSS (preflight desabilitado para não conflitar com CSS existente)
- Lucide Icons (createIcons() chamado após render)
- Google Fonts Inter (400, 500, 700, 900)

---

## 10. Pendências para Produção

| Etapa | Status | Descrição |
|-------|--------|-----------|
| Atualizar gerar_rentabilidade.py | Pendente | Fórmulas corrigidas + dados semanais |
| Calcular 190 produtos | Pendente | Script em lote |
| Popular Airtable | Pendente | Tabelas Produtos, Clientes, Detalhe, PainelSemanal |
| Frontend consumir Airtable | Pendente | Trocar mocks por fetch |
| Share Vendas/Devoluções (Nível 3) | Pendente | Depende de faturamento total empresa no Airtable |
| totalEmpresaMes (gráfico share) | Pendente | Substituir mock por dados reais |
| Botão exportar PDF | Pendente | |
| Botão exportar HTML | Pendente | |
| Deploy Netlify | Pendente | |
| Card no Portal BPO | Pendente | |

---

## 11. Changelog

### v1.2 (2026-03-19)
- Filtros avançados: 21 variáveis (7 dimensões + 9 métricas + 5 classificações)
- Painel colapsável com toggle, badge de contagem, limpar/aplicar
- Dimensões: Meses (pills), Produtos/Clientes (multi-select com busca), Vendedor, Categoria, Dias da Semana
- Métricas: 9 dual-range sliders (Taxa Devol, Margem, Receita, Preço, Custo, Volume, CMV, DF, Comissão)
- Classificações: Faixa Margem, Status Devolução, Tendência Preço, Score Variância, Faixa vs Normal
- Data-attributes nos cards para filtragem sem re-render
- FILTER_STATE object para estado centralizado
- 13 funções novas documentadas
- Pendentes: Vendedor, Categoria, Score Variância, Faixa vs Normal (requerem Airtable)

### v1.1 (2026-03-19)
- sec-devolucoes redesenhada: dashboard multinível (3 níveis)
- Nível 1: Radar qtd devolvida + gráfico composto (barras venda + linhas %dev/preço/meta)
- Nível 2: Top 10 clientes com barras verticais proporcionais (HTML, sem Chart.js)
- Nível 3: Deep Dive com share vendas/devoluções (pendente Airtable) + gráfico representatividade mensal
- Diagnóstico + Ação Estratégica (cards texto)
- CDNs: Tailwind CSS (preflight off), Lucide Icons, Inter font
- Fórmula DF confirmada: sobre Receita Bruta (loja retém no pagamento)
- sec-devolucoes movida para depois de sec-analise
- overflow:visible na sec-devolucoes (evita corte dos elementos Tailwind)

### v1.0 (2026-03-19)
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
