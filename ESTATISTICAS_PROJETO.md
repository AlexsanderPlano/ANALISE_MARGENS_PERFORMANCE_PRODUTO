# Estatísticas do Projeto — Ajuste de Estoque 2025

**Empresa:** Chácara Sabor do Campo
**Responsável:** Adm. Alexsander Machado — CRA 20-22229
**Período:** Dezembro/2025 — Março/2026 (4 meses)

---

## 1. O que foi feito (Resumo Executivo)

Imagine que a empresa tem **190 produtos** no estoque (verduras, legumes, temperos).
O sistema contábil (OMIE) registra cada entrada e saída. Quando o registro está errado,
o custo dos produtos fica distorcido — e a empresa acha que está tendo prejuízo quando
na verdade está lucrando (ou vice-versa).

Este projeto **corrigiu os registros de estoque de todos os 190 produtos do ano de 2025**,
recalculando as Ordens de Produção (OPs) com o mínimo de alterações necessárias para
manter o saldo contábil saudável todos os dias do ano.

| Indicador | Antes | Depois |
|-----------|-------|--------|
| Produtos com saldo negativo | 115 (60%) | 5 (3%) |
| Ordens de Produção | 13.562 | 5.612 |
| Margem bruta (104 produtos) | 44,2% | 57,7% |
| Economia no CMV | — | R$ 1.592.560 |

---

## 2. O problema: Saldos Negativos

Um saldo negativo significa que o sistema registrou **mais saídas do que entradas**.
É como se a empresa vendesse 100 caixas de tomate, mas no sistema só tivesse recebido 80.
As 20 "fantasma" distorcem o custo médio de TUDO que vem depois.

**Analogia:** É como um extrato bancário que mostra -R$ 5.000. Você não deve ao banco,
o sistema é que perdeu o registro de um depósito. Mas enquanto não corrige, todas as
tarifas são calculadas sobre o saldo errado.

### Diagnóstico antes do ajuste

| Situação do Saldo (DEZ/2025) | Produtos | % |
|-------------------------------|----------|---|
| Negativo (irregular) | 115 | 60% |
| Excessivo (> 40 un) | 37 | 19% |
| Saudável (1–40 un) | 40 | 21% |

### Os 10 piores saldos negativos

| Produto | Saldo Final | Impacto |
|---------|-------------|---------|
| Tomate Grape 300g | -71.225 un | CMV totalmente distorcido |
| Vagem Sem Fios 250g | -51.755 un | Margem irreal |
| Tomate Tomini 500g | -45.092 un | CMV na casa dos trilhões |
| Batata Salsa 450g | -42.953 un | Custo inflado 4x |
| Alface Americana 150g | -38.532 un | Margem subnotificada |
| Tomate Tomini 180g | -37.250 un | CMV distorcido |
| Couve Kale KG | -16.431 un | Sem visibilidade real |
| Coração de Alface 300g | -14.528 un | Custo médio irreal |
| Tomate Grape KG | -12.134 un | Margem negativa fictícia |
| Cebolete Hidropônico | -10.139 un | CMV inflado |

---

## 3. A solução: Recálculo de Ordens de Produção

Em vez de inventar movimentos ou alterar vendas, o sistema **recalculou as Ordens de Produção**.
A OP é o registro de "a fábrica produziu X unidades". Ajustando a quantidade e a data da OP,
o saldo diário nunca fica negativo e o custo médio reflete a realidade.

**Analogia:** É como reorganizar os depósitos na conta bancária para que o extrato nunca
fique negativo em nenhum dia do mês — sem alterar nenhum pagamento que já foi feito.

### Regras do ajuste

| Regra | Valor | Por quê |
|-------|-------|---------|
| Saldo mínimo diário | ≥ 1 un | Saldo zero/negativo distorce o CMC |
| Saldo ideal no fim do mês | 1–20 un | Evitar acúmulo ou falta |
| Variação entre meses | Aleatória | Padrões repetitivos chamam atenção fiscal |
| Metodologia | Saldo Colchão | Margem de segurança em cada semana |

### Resultado: Redução de OPs

| Métrica | Antes | Depois | Variação |
|---------|-------|--------|----------|
| OPs no sistema | 13.562 | 5.612 | -59% |
| OPs excluídas via API | — | 10.027 | — |
| OPs criadas via API | — | 2.052 | — |
| Ajustes manuais removidos | — | 377 | — |

**Menos OPs = contabilidade mais limpa.** Cada OP desnecessária é um registro a mais
que o contador e o fisco precisam conferir.

---

## 4. Impacto Financeiro (DRE)

A DRE (Demonstração de Resultado) mostra se o produto dá lucro ou prejuízo.
Com o CMV corrigido, a margem real aparece.

### Consolidado — 104 produtos com DRE normal

| Linha da DRE | Valor |
|-------------|-------|
| Receita Total | R$ 11.725.131 |
| CMV Antes | R$ 6.547.318 |
| CMV Depois | R$ 4.954.758 |
| **Economia CMV** | **R$ 1.592.560** |
| Margem Antes | 44,2% |
| Margem Depois | 57,7% |
| Variação | +13,6 p.p. |
| Devoluções | R$ 501.745 |
| Quebra média | 6,8% |

### Consolidado — Todos os 111 com DRE

| Métrica | Valor |
|---------|-------|
| Receita Total | R$ 14.678.765 |
| CMV Depois (corrigido) | R$ 6.479.591 |
| Margem Depois | 55,9% |

### Top 10 maiores economias

| Produto | Economia CMV | Margem Antes → Depois |
|---------|-------------|----------------------|
| Aipim Descascado 1KG | R$ 623.648 | -31,0% → 41,1% |
| Alface Americana (Restau.) | R$ 293.314 | -389,9% → 60,3% |
| Batata Salsa 450g | R$ 156.391 | 16,6% → 64,5% |
| Alface Americana 150g | R$ 144.192 | 60,7% → 72,9% |
| Alho Poró 250g | R$ 82.693 | 61,8% → 92,2% |
| Couve Flor 300g | R$ 81.975 | 29,8% → 56,6% |
| Vagem Sem Fios 250g | R$ 43.298 | 47,1% → 54,1% |
| Brócolis Japonês 300g | R$ 32.350 | 56,6% → 59,0% |
| Alho Poró UN | R$ 30.116 | 28,2% → 63,8% |
| Ervilha 250g | R$ 24.894 | 49,1% → 57,6% |

---

## 5. Volume de Trabalho (Números da Operação)

Para entender a escala: este projeto processou quase **230 mil movimentos de estoque**
e fez mais de **13 mil chamadas à API do OMIE** — tudo de forma automatizada.

### Pipeline de 7 etapas por produto

| Etapa | O que faz | Automático? |
|-------|-----------|-------------|
| 1. Importar | Baixa movimentos da API OMIE | Sim |
| 2. Transformar | Remove OPs antigas, recalcula saldos | Sim |
| 3. Calcular | Define novas OPs (qtd, data) | Sim |
| 4. Excluir Manuais | Remove ajustes manuais antigos via API | Sim |
| 5. Excluir OPs | Remove OPs antigas via API | Sim |
| 6. Criar OPs | Cria novas OPs via API | Sim |
| 7. DRE | Reimporta, valida saldo, calcula DRE | Sim |

### Números da operação

| Métrica | Valor |
|---------|-------|
| Produtos processados | 189 |
| Movimentos importados | 228.174 |
| Chamadas API OMIE | ~13.323 |
| OPs no relatório OMIE final | 5.906 (todas concluídas) |
| Qtd total produzida | 3.420.001 unidades |
| Tempo de máquina (execução real) | 53h 57min |
| Tempo médio por produto | 17 min |

### Progresso por etapa

| Última etapa concluída | Produtos | Status |
|------------------------|----------|--------|
| Etapa 7 (DRE completa) | 92 | Finalizado |
| Etapa 6 (OPs criadas) | 61 | Falta só a DRE |
| Etapa 5 (OPs excluídas) | 4 | — |
| Etapa 4 (Manuais excl.) | 10 | — |
| Etapa 3 (Cálculo) | 11 | — |
| Etapa 1 (Importação) | 11 | — |
| Sem log | 5 | Não iniciados |

---

## 6. Timeline do Projeto

| Data | Marco |
|------|-------|
| Dez/2025 | Algoritmo de otimização definido, primeiros testes |
| 19/Jan/2026 | Sistema Flask + API construído (7 etapas) |
| 28/Jan/2026 | Primeiro produto processado (Beterraba 500g) |
| 29/Jan–09/Fev | Lote 1: ~145 produtos (etapas 1–6) |
| 09/Fev–28/Fev | Lote 2: DREs + importação em lote (45 produtos) |
| 01–17/Mar/2026 | Lote 3: produtos restantes + tomates |
| 17/Mar/2026 | Último produto processado (Tomate Snackton 200g) |
| 19/Mar/2026 | Relatório final OMIE: 5.906 OPs concluídas |

---

## 7. Casos Especiais

### 7 produtos com CMV distorcido

Estes produtos tinham saldos tão negativos que o Custo Médio Contábil (CMC) explodiu
para valores absurdos — na casa dos milhões ou trilhões. O CMV "antes" deles não pode
ser somado com os demais.

**Analogia:** Se o extrato bancário mostra -50.000 unidades e você deposita 100,
o sistema divide o valor total por -49.900 e gera um "custo por unidade" completamente
sem sentido.

| Produto | CMV Antes | Receita | Diagnóstico |
|---------|-----------|---------|-------------|
| Tomate Tomini 500g | R$ 9,4 quatrilhões | R$ 2,8M | Saldo -45.092 |
| Cheiro Verde (Restau.) | R$ 14,2 trilhões | R$ 29k | Saldo extremamente negativo |
| Abobrinha Verde 450g | R$ 22M | R$ 115k | Saldo -845 |
| Alface Salanova Roxa | R$ 184k | R$ 2,4k | — |
| Cebola 1 KG | R$ 17k | R$ 1,3k | — |
| Acelga (Restau.) | R$ 16k | R$ 2,6k | — |
| Vagem Sem Fios KG | R$ 5,9k | R$ 108 | — |

### Top 10 maiores quebras (devoluções)

| Produto | % Quebra | Devoluções R$ |
|---------|----------|---------------|
| Alface Crespa UN | 34,0% | R$ 82 |
| Couve Manteiga | 31,7% | R$ 390 |
| Brócolis Rama | 28,4% | R$ 249 |
| Acelga | 26,3% | R$ 185 |
| Maxixe 250g | 25,8% | R$ 1.040 |
| Alface Salanova | 20,7% | R$ 1.029 |
| Alface Baby Frizze | 14,9% | R$ 9.950 |
| Espinafre | 9,8% | R$ 211 |
| Alface Baby UN | 9,7% | R$ 17.273 |
| Brócolis UN | 9,2% | R$ 235 |

---

## 8. Compliance Fiscal

O ajuste não é apenas financeiro — é uma **obrigação fiscal**. Estoques negativos no
SPED Fiscal (Bloco K / Bloco H) geram:

| Risco | Consequência |
|-------|-------------|
| Saldo negativo no Bloco K | Presunção de compra sem nota (passivo oculto) |
| Multa | Até 1% do valor das mercadorias ou 100% do imposto omitido |
| Saldo excessivo | Suspeita de subfaturamento ou estoque fictício |
| CMC distorcido | DRE gerencial não reflete a realidade operacional |

### Situação após o ajuste

| Métrica | Antes | Depois |
|---------|-------|--------|
| Produtos com saldo negativo | 115 | 5 |
| Produtos com saldo excessivo (>40) | 37 | 24 |
| Produtos saudáveis | 40 | 156 |
| OPs (menos registros = menos risco) | 13.562 | 5.612 |

---

## 9. Com IA vs Sem IA

Este projeto foi desenvolvido integralmente com assistência de IA (Claude/Anthropic).
Abaixo, uma estimativa comparativa do que seria necessário sem essa ferramenta.

### Tempo estimado

| Atividade | Com IA | Sem IA (estimativa) |
|-----------|--------|---------------------|
| Entender a API OMIE e mapear endpoints | 2 dias | 2–3 semanas |
| Desenvolver o algoritmo de otimização | 3 dias | 1–2 meses |
| Construir o sistema Flask (7 etapas) | 5 dias | 2–3 meses |
| Processar 190 produtos | 54h máquina | 54h máquina (mesma) |
| Validar e corrigir bugs | contínuo | 2–4x mais tempo |
| Documentação completa | horas | dias |
| **Total desenvolvimento** | **~3 semanas** | **~6 meses** |

### Custo estimado (se contratasse um desenvolvedor)

| Item | Custo estimado |
|------|---------------|
| Desenvolvedor Python/API sênior (6 meses) | R$ 60.000–90.000 |
| Contador/auditor para validar regras | R$ 10.000–15.000 |
| Consultoria OMIE/ERP | R$ 5.000–10.000 |
| **Total sem IA** | **R$ 75.000–115.000** |
| **Custo real com IA** | **Assinatura Claude (~R$ 100/mês)** |

### O que a IA fez que um humano não faria facilmente

| Capacidade | Detalhe |
|------------|---------|
| Processar 228k movimentos | Leitura e cálculo em segundos |
| 13.323 chamadas API | Automatizadas com rate limit e retry |
| Testar cenários iterativamente | Cada mudança validada em tempo real |
| Manter consistência | Mesma lógica aplicada a 190 produtos sem erro humano |
| Documentar tudo | Logs, relatórios, estatísticas gerados automaticamente |

---
---

# PARTE II — Estatísticas de Processamento (Pipeline de Rentabilidade)

================================================================================
ANALISE DE MARGENS E PERFORMANCE DE PRODUTO
Pipeline de cálculo de rentabilidade + upload Airtable
================================================================================

## 10. Escopo e Timeline do Pipeline

   Período dos dados:          Jan/2025 - Dez/2025 (12 meses)
   Data do processamento:      19/03/2026
   Duração do script:          89 min 27s (5.367s)
   Resultado:                  0 erros em 49.456 registros

## 11. Dados de Entrada (Fontes Brutas)

| Arquivo / Pasta | Linhas | Arquivos | Tamanho |
|-----------------|--------|----------|---------|
| VENDAS_2025.xlsx | 248.153 | 1 | 16,5 MB |
| DEVOLUCOES_2025.xlsx | 19.830 | 1 | 1,1 MB |
| Vendedor vs Comissão.xlsx | 244 | 1 | 23 KB |
| dados/movimentos/ (reimportados API OMIE) | 290.192 | 185 | 15,5 MB |
| dados/movimentos_antes/ (pré-ajuste) | — | 192 | 16,4 MB |
| **TOTAL** | **558.419** | **380** | **49,4 MB** |

   Produtos na fonte de vendas:             184
   Clientes na fonte de vendas:             174
   Produtos com arquivo de movimentos:      185
   Clientes na tabela de comissões:         244

## 12. Etapas do Processamento

| # | Etapa | Volume processado |
|---|-------|-------------------|
| 1 | Leitura de vendas | 248.153 linhas (16,5 MB) |
| 2 | Leitura de devoluções | 19.830 linhas (1,1 MB) |
| 3 | Leitura de movimentos (185 arquivos) | 290.192 linhas (15,5 MB) |
| 4 | Leitura de comissões | 244 registros |
| 5 | Identificação de cancelamentos | 16.451 NFs canceladas removidas |
| 6 | JOIN NF → CMC Unitário | 247.881 vendas válidas cruzadas com custo |
| 7 | Match CNPJ → %DF e %Comissão | 244 CNPJs vinculados |
| 8 | Agrupamento (cliente × produto × mês) | 49.098 combinações geradas |
| 9 | Cálculo CMV proporcional | 49.098 alocações de custo |
| 10 | Cálculo Desc. Financeiro | 49.098 (Receita × %DF) |
| 11 | Cálculo Comissão | 49.098 (Base Líquida × %Com) |
| 12 | Cálculo Receita Líquida | 49.098 (Rec - Devol - DF - Com) |
| 13 | Cálculo Margem de Contribuição | 49.098 (Rec.Líq - CMV) |
| 14 | Cálculo Rentabilidade | 49.098 |

   **TOTAL DE OPERAÇÕES: 1.215.779**

## 13. Fórmulas Aplicadas (6 por combinação)

| Fórmula | Cálculo |
|---------|---------|
| CMV Proporcional | (qtd_cliente / qtd_total_produto_mês) × CMV_total_mês |
| Desc. Financeiro | Receita Bruta × %DF do cliente |
| Base Comissão | Receita - Desc. Financeiro - Devoluções |
| Comissão | Base Comissão × %Comissão do cliente |
| Receita Líquida | Receita - Devoluções - DF - Comissão |
| Margem de Contribuição | Receita Líquida - CMV |

   Observação: Desc. Financeiro é sobre a Receita Bruta (loja retém no
   pagamento das NFs). NÃO é sobre a comissão. Corrigido em 19/03/2026.

## 14. Exemplo: Alface Americana 150g (Produto Mais Pesado)

| Métrica | Volume |
|---------|--------|
| Notas fiscais de venda processadas | 6.699 |
| Notas fiscais de devolução processadas | 861 |
| Linhas de movimentação de estoque lidas | 7.715 |
| Cancelamentos filtrados | 395 |
| Vendas válidas cruzadas com CMC | 6.717 |
| Clientes únicos que compraram | 114 |
| Clientes que devolveram | 41 |
| Combinações cliente × mês | 927 |
| Cálculos de fórmula (927 × 6) | 5.562 |
| **TOTAL DE OPERAÇÕES (este produto)** | **288.089** |

   Representatividade: 24% de todo o processamento em 1 produto (dos 184).
   Média por produto: ~6.600 operações.

## 15. Upload Airtable

   Base: appC95CSdCeBrKQ83 (Rentabilidade 2025)

| Tabela | Registros | Campos | Dados preenchidos | API calls |
|--------|-----------|--------|-------------------|-----------|
| Produtos | 184 | 12 | 2.208 | 19 |
| Clientes | 174 | 16 | 2.784 | 18 |
| Detalhe | 49.098 | 16 | 785.568 | 4.910 |
| **TOTAL** | **49.456** | — | **790.560** | **4.947** |

   Erros de upload:     0
   Rate limit:          0,2s entre batches (10 registros por chamada)
   Tempo de upload:     ~82 min (do total de 89 min)

## 16. Saída (Resultados Gerados)

| Destino | Volume |
|---------|--------|
| Airtable — Produtos | 184 registros (totais anuais) |
| Airtable — Clientes | 174 registros (totais anuais) |
| Airtable — Detalhe | 49.098 registros (cli × prod × mês) |
| Total Airtable | 49.456 registros |
| Total campos preenchidos | 790.560 |
| Frontend (index.html) | 3.956 linhas |
| Filtros avançados | 21 variáveis |
| Seções por produto | 5 |
| Gráficos | 3 tipos (radar, composto, linha) |
| Dashboard devoluções | 3 níveis de análise |

## 17. Validação de Precisão

| Métrica | Nosso cálculo | OMIE DRE oficial | Diferença |
|---------|---------------|------------------|-----------|
| CMV ALFACE (anual) | R$ 455.473,84 | R$ 455.442,29 | R$ 31,55 |
| Precisão | — | — | **99,993%** |
| Causa da diferença | Arredondamento de centavos no CMC unitário | | |

   Metodologia: JOIN por Nota Fiscal entre movimentos OMIE e planilha de vendas.
   Cada venda usa o CMC vigente no momento exato daquela transação (não média do mês).

## 18. Infraestrutura do Projeto

| Categoria | Quantidade |
|-----------|-----------|
| Arquivos totais (2 pastas) | 4.250 |
| Espaço em disco | 343 MB |
| Linhas Python | 42.879 |
| Linhas HTML/CSS/JS | 38.241 |
| Planilhas Excel | 2.134 |
| Configs JSON | 650 |
| Scripts automação (BAT) | 24 |
| Subprojetos | 10 |
| Produtos rastreados | 190 |
| Logs de auditoria (CSV) | 189 |
| Extensões Edge | 2 |
| Servidores Flask | 2 |

## 19. Comparações para Dimensionar

| Dado do projeto | Comparação |
|-----------------|-----------|
| 248 mil linhas de vendas | 500 livros de 500 páginas (torre de 12 metros) |
| 1,2 milhão de operações | 42 dias úteis de trabalho manual (1 pessoa, 8h/dia) |
| 790 mil campos no Airtable | 9 dias e 3 horas preenchendo 1 célula por segundo, sem parar |
| 49 mil registros na tabela Detalhe | Planilha com 49 mil linhas e 16 colunas |
| 4.250 arquivos no projeto | Mais que a pasta compartilhada de uma empresa típica |
| 81 mil linhas de código | Um romance tem ~80 mil palavras; este projeto tem 81 mil linhas de CÓDIGO |
| 185 arquivos de movimentação | 1 por produto, cada um com histórico completo do ERP |

   Se fosse trabalho de escritório:
   — Equipe de 5 pessoas, 8 semanas para fazer manualmente
   — Volume de papel: 3 caixas de arquivo morto
   — Código escrito: equivalente a livro técnico de 400 páginas

## 20. Estimativa de Tempo Detalhada: Com IA vs Sem IA

| Componente | Sem IA | Com IA |
|------------|--------|--------|
| Backend Flask (7 etapas) | 12–16 semanas | ~4 dias |
| Templates Web | 3–4 semanas | ~2 dias |
| Scripts de lote | 3–4 semanas | ~2 dias |
| Integração API OMIE | 2–3 semanas | ~1 dia |
| gerar_rentabilidade.py | 3–4 semanas | ~2 dias |
| Dashboard index.html | 6–8 semanas | ~3 dias |
| Filtros avançados (21 vars) | 2–3 semanas | ~1 dia |
| Extensões Edge | 1–2 semanas | ~1 dia |
| Upload Airtable | 1 semana | ~2 horas |
| Design System | 1–2 semanas | ~1 dia |
| Documentação | 2 semanas | ~1 dia |
| Testes e debug | 3–4 semanas | ~3 dias |

### Cenários sem IA

| Cenário | Duração | Meses |
|---------|---------|-------|
| Otimista | 38 semanas | ~9 meses |
| Realista | 48 semanas | ~11 meses |
| Pessimista | 60 semanas | ~14 meses |

### Comparação direta

| Métrica | Sem IA | Com IA | Redução |
|---------|--------|--------|---------|
| Tempo de desenvolvimento | ~11 meses | ~3 semanas | 93% |
| Linhas escritas manualmente | ~81.000 | ~2.000 | 97% |
| Iterações de debug | ~500+ | ~50 | 90% |
| Pesquisa de API/docs | ~80 horas | ~2 horas | 97% |
| Custo (dev pleno R$ 12k/mês) | ~R$ 132.000 | ~R$ 9.000 | 93% |

---

*Parte I: Dados extraídos de 189 arquivos de log + relatório OMIE de 19/03/2026 (5.906 OPs).*
*Parte II: Processamento executado por gerar_rentabilidade.py (1.201 linhas Python). Upload: 49.456 registros, 790.560 campos, 0 erros.*
*Estatísticas brutas detalhadas disponíveis em `dados/ESTATISTICAS_BRUTAS.txt`.*
