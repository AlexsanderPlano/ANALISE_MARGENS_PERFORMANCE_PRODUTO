# Rentabilidade de Produtos e Clientes — 2025

## Visão Geral

Análise de rentabilidade que cruza CMV corrigido (pós-ajuste de estoque) com receita,
devoluções, descontos financeiros e comissões para determinar a rentabilidade real
por produto e por cliente.

---

## Arquitetura

```
RENTABILIDADE_VENDAS_2025/          ← Este projeto
├── dados/                          ← Fontes de dados (Excel + movimentos OMIE)
├── gerar_rentabilidade.py          ← Calcula tudo + popula Airtable
├── reimportar_movimentos.py        ← Busca movimentos OMIE via API
├── index.html                      ← Frontend (consome Airtable, deploy Netlify)
└── mix_produtos_v14.html           ← Modelo canônico de design

Airtable "Rentabilidade 2025"       ← Backend de dados calculados
  Base ID: appC95CSdCeBrKQ83
  ├── Produtos (totais anuais)
  ├── Clientes (totais anuais)
  └── Detalhe (cliente × produto × mês)

Netlify                             ← Hosting do index.html
  URL: (a definir)

Portal Plano BPO                    ← Card com link para o Netlify
  C:\Users\alex\Documents\PORTAL_BPO\
```

---

## Fluxo de Dados

```
1. Fontes brutas (Excel + API OMIE)
       ↓
2. gerar_rentabilidade.py (calcula CMV, margem, comissão)
       ↓
3. Airtable "Rentabilidade 2025" (dados calculados)
       ↓
4. index.html (frontend leve, carrega sob demanda)
       ↓
5. Netlify (hosting) → Card no Portal Plano BPO
```

---

## Fontes de Dados

| Variável | Fonte | Arquivo |
|----------|-------|---------|
| Receita (qtd × preço NF) | NFs de venda | `dados/VENDAS_2025.xlsx` |
| CMV (qtd × CMC do mês) | Movimentos OMIE reimportados | `dados/movimentos/PRODUTO.xlsx` |
| CMV antes (comparativo) | Movimentos originais | `dados/movimentos_antes/PRODUTO.xlsx` |
| Devoluções | NFs de devolução | `dados/DEVOLUCOES_2025.xlsx` |
| Desc. Financeiro + Comissão | Cadastro clientes | `dados/Vendedor vs Comissão.xlsx` |
| Qtd Vendida | Movimentos OMIE (vendas brutas) | `dados/movimentos/PRODUTO.xlsx` |

### Esquema VENDAS_2025.xlsx
Data, CFOP, Razão Social, CNPJ/CPF, Nome Fantasia, Nota Fiscal, Operação,
Produto, Quantidade, Valor Unitário, Total NF, Situação, Etapa, Mês, Categoria

### Esquema DEVOLUCOES_2025.xlsx
Data, Operação, CNPJ/CPF, Nome Fantasia, Produto, Quantidade, Valor Unitário,
Total NF, NF Devolução, NF Original, Mês

### Esquema Vendedor vs Comissão.xlsx
Tags, CNPJ/CPF, Nome Fantasia, Vendedor, Desconto Financeiro (%), Comissão (%)

---

## Airtable — Base: Rentabilidade 2025

**Base ID:** `appC95CSdCeBrKQ83`
**Token (PAT):** `pat0KFWb7Vc0aevY1.9511b6c89f912e5c581d17fbd06427e55ca13d5cd2cc0631b4a6d810152b463f`

### Tabela: Produtos (totais anuais por produto)
| Campo | Tipo |
|---|---|
| Produto | Texto (primário) |
| Receita, CMV, Margem R$, Comissão Bruta, Desc Financeiro, Comissão Líquida, Rentabilidade | Moeda BRL |
| Margem %, Devol % | Decimal |
| Qtd Vendida, Qtd Devolvida | Inteiro |

### Tabela: Clientes (totais anuais por cliente)
| Campo | Tipo |
|---|---|
| Cliente | Texto (primário) |
| CNPJ, Vendedor | Texto |
| Receita, CMV, Margem R$, Comissão Bruta, Desc Financeiro, Comissão Líquida, Rentabilidade | Moeda BRL |
| Margem %, Devol %, Pct Desc Fin, Pct Comissão | Decimal |
| Qtd Vendida, Qtd Devolvida | Inteiro |

### Tabela: Detalhe (cliente × produto × mês)
| Campo | Tipo |
|---|---|
| Chave | Texto (primário, formato "CLIENTE\|PRODUTO\|MES") |
| Cliente, Produto | Texto |
| Mês, Qtd, Qtd Devolvida | Inteiro |
| Preço Unit, Receita, Valor Devolvido, CMC Unit, CMV, Margem R$, Comissão, Desc Financeiro, Rentabilidade | Moeda BRL |
| Margem % | Decimal |

---

## Cálculos

### Quantidade Vendida
Fonte: movimentos reimportados (API OMIE), NÃO planilha Power BI.
Vendas brutas = total de saídas com Origem "Venda de Produto".

### DRE por Produto/Cliente
```
Qtd Vendas (bruta, dos movimentos OMIE)
R$ Unit. Ponderado (Receita / Qtd)
Receita Bruta (soma Total NF das vendas)
(-) Devoluções Qtd | R$
= Receita Líquida
(-) Comissão Bruta (Valor NF × % Comissão por cliente)
    (-) Desc. Financeiro (Comissão Bruta × % Desc. Fin. por cliente)
(-) Comissão Líquida (Com. Bruta - Desc. Fin.)
(-) Custo Unit. Ponderado (CMC do mês da venda)
(-) CMV (Qtd × CMC)
= Margem R$ | %
```

### Fórmula de Comissão e Desconto Financeiro (corrigida 2026-03-19)
```
Para cada combinação cliente × produto × mês:
  Desc. Financeiro  = Receita Bruta × %DF do cliente (0% a 16%)
  Base Comissão     = Receita Bruta - Desc. Financeiro - Devoluções
  Comissão          = Base Comissão × %Comissão do cliente (0,8% padrão)

O Desc. Financeiro é sobre a RECEITA BRUTA (loja retém no pagamento das NFs).
NÃO é sobre a comissão bruta (fórmula anterior estava errada).
Devoluções reduzem a base de comissão.
```

---

## Design System (v14 — modelo canônico)

**Arquivo referência:** `mix_produtos_v14.html`
**REGRA:** Usar 100% na íntegra, não alterar nada do design.

### Fontes
- Outfit (corpo), JetBrains Mono (números), DM Sans
- Font Awesome 6.5.1 (ícones)

### CSS Variables
```css
--bg: #f5f6f8; --primary: #1b2a4a; --accent: #1a5cff;
--success: #0d9e5f; --warning: #e67e22; --danger: #dc3545;
--border: #e4e7ec; --border-light: #f0f2f5;
--radius: 12px; --radius-sm: 8px;
```

### Componentes
- **Page Header:** h2 800 + subtitle muted
- **Summary Cards:** grid, barra colorida 3px topo (::before), JetBrains Mono
- **Card:** header gradient azul (#1e40af → #3b82f6), colapsável com chevron
- **Tabela:** col-head #d5dae3, JetBrains Mono valores
- **DRE Icons:** badges circulares 22px: = result (verde), - deduct (vermelho), % pct (azul), i info (cinza)
- **Receita:** fundo verde sólido, texto branco
- **Margem:** fundo #f4f7fc, texto accent, indicadores ▲▼●
- **Custo:** separador 3px antes do primeiro item

### Métricas (ordem no detalhe)
1. Qtd Vendas (i)
2. R$ Unit. Pond. (i)
3. Receita (=) — fundo verde
4. Devol. Qtd (#) + Devol. R$ (-)
5. Desc. Financeiro (-) + Comissão (-)
6. Custo Unit. Pond. (-) — separador 3px antes
7. CMV (-)
8. Margem R$ (=) + % — fundo azul claro

---

## Scripts

| Script | Função |
|--------|--------|
| `reimportar_movimentos.py` | Busca movimentos 2025 via API OMIE → `dados/movimentos/` |
| `gerar_rentabilidade.py` | Calcula rentabilidade + popula Airtable |

---

## Deploy

1. `gerar_rentabilidade.py` calcula e popula Airtable
2. `index.html` consome Airtable via API (leve, ~50KB)
3. Deploy no Netlify (URL própria)
4. Criar card no Portal Plano BPO (`PORTAL_BPO/apps.html`) com link

---

## Status

- [x] Pasta do projeto criada
- [x] Dados copiados (vendas, devoluções, movimentos, comissões)
- [x] 190 produtos reimportados via API OMIE
- [x] Base Airtable criada (appC95CSdCeBrKQ83)
- [x] 3 tabelas definidas (Produtos, Clientes, Detalhe)
- [x] Modelo design v14 definido
- [x] Fórmulas validadas (comissão, CMV, margem)
- [x] Documentação completa (este arquivo)
- [ ] Script para popular Airtable
- [x] index.html (frontend leve — mockado, 4 abas)
- [ ] Deploy Netlify
- [ ] Card no Portal Plano BPO
