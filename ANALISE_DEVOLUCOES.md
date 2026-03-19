---
name: Analise Devoluções × Preço × Quantidade
description: Case de análise aprofundada sobre correlação entre variação de preço, volume e devoluções
type: reference
---

# Análise de Sensibilidade: Devoluções × Preço × Quantidade

## Objetivo
Investigar se existe relação entre variação de preço, variação de quantidade comprada
e taxa de devolução, por cliente × produto × mês.

## Fontes de Dados
- `VENDAS_2025.xlsx` — 248.153 linhas, 184 produtos, 174 clientes
- `DEVOLUCOES_2025.xlsx` — 19.830 linhas, 100 produtos, 95 clientes
- Granularidade: Cliente × Produto × Mês (comparação mês a mês)

## Metodologia
1. Agregar vendas e devoluções por cliente × produto × mês
2. Calcular variação de preço médio e quantidade mês a mês (mesmo cliente × produto)
3. Calcular % de devolução = qtd devolvida / qtd vendida × 100
4. Filtrar outliers (devolução > 100% = devolução de meses anteriores)
5. Cruzar faixas de variação de preço × faixas de variação de quantidade

## Tratamento de Outliers
- Devolução > 100% da venda do mês: excluída da análise
- Causa: devoluções de vendas de meses anteriores caindo no mês atual
- Exemplo: TOMATE EXTRA TASTY 450G Março — vendeu 1un, devolveram 38un (3.800%)
- Esses registros distorcem a média (77,7% → 1,7% após remoção)
- Recomendação: usar MEDIANA junto com média para identificar distorções

---

## Resultado 1: Análise por Faixa de Preço (isolada)

| Faixa Preço | Ocorrências | % Dev Médio | % Dev Mediana | % Perda Receita |
|---|---|---|---|---|
| Desceu >20% | 49 | 1,7% | 0,0% | 4,4% |
| Desceu 10-20% | 83 | 3,1% | 1,5% | 5,0% |
| Desceu 5-10% | 78 | 3,0% | 1,5% | 5,7% |
| Estável ±5% | 1.002 | 2,8% | 0,0% | 3,6% |
| Subiu 5-10% | 78 | 3,3% | 2,6% | 4,3% |
| Subiu 10-20% | 68 | 2,9% | 1,3% | 2,9% |
| Subiu >20% | 84 | 1,9% | 0,0% | 2,1% |

**Conclusão:** Variação de preço isolada NÃO tem correlação forte com devolução.
Todos na faixa 1,7% a 3,3%. O impacto é na perda em R$ (desconto reduz receita).

---

## Resultado 2: Análise por Volume Comprado

| Volume por cliente/mês | % Devolução |
|---|---|
| Até 100 un | 0,0% |
| 100-500 un | 0,9% |
| 500-2.000 un | 3,9% |
| 2.000-5.000 un | 4,1% |
| 5.000-10.000 un | 4,2% |

**Conclusão:** Quanto MAIS compra, MAIS devolve (em %). Relação direta com volume.

---

## Resultado 3: Sazonalidade

| Mês | % Devolução |
|---|---|
| Agosto | 2,8% (menor) |
| Julho | 3,1% |
| Abril | 3,1% |
| Setembro | 3,3% |
| Fevereiro | 3,8% |
| Maio | 4,0% |
| Janeiro | 4,2% |
| Junho | 4,3% |
| Outubro | 4,6% |
| Dezembro | 4,8% |
| **Novembro** | **5,9% (maior)** |

**Conclusão:** Novembro é o pior mês. Possivelmente por aquecimento pré-natal
que gera pedidos maiores com sobra.

---

## Resultado 4: Top 15 Clientes que Mais Devolvem

| Cliente | Qtd Vendida | % Devolução | Receita |
|---|---|---|---|
| MUFFATO MAX CHAPADA | 17.008 | **23,8%** | R$ 98.312 |
| MUFFATO MAX CASTRO | 9.641 | **21,0%** | R$ 62.756 |
| MUFFATO SANTA FELICIDADE | 32.439 | **20,9%** | R$ 195.941 |
| MUFFATO MAX JOAO BETEGA | 15.789 | 17,2% | R$ 91.152 |
| MUFFATO UVARANAS | 28.623 | 16,1% | R$ 179.805 |
| MUFFATO OLARIAS | 59.055 | 15,3% | R$ 375.820 |
| CASA FIESTA AV IGUACU | 15.080 | 14,9% | R$ 81.186 |
| MUFFATO MAX JUSCELINO | 19.874 | 14,3% | R$ 120.727 |
| MUFFATO MAX OFICINAS | 25.655 | 13,9% | R$ 151.465 |
| MUFFATO MAX PARANAGUA | 23.493 | 12,8% | R$ 144.907 |

**Conclusão:** Muffato domina os top devedores. Padrão de rede com alto volume + perecíveis.

---

## Resultado 5: Cenários Combinados (Preço × Quantidade)

Análise por cliente × produto × mês, comparando variação mês a mês.

| Cenário | Ocorrências | % Dev | Interpretação |
|---|---|---|---|
| Preço DESCEU + Qtd SUBIU | 2.935 | 2,9% | Desconto atraiu volume, devolução baixa |
| Preço DESCEU + Qtd ESTÁVEL | 982 | 5,1% | Desconto não gerou volume, devolveu mais |
| Preço DESCEU + Qtd DESCEU | 2.882 | **6,4%** | Pior: desconto + menos compra + mais devolução |
| Preço ESTÁVEL + Qtd ESTÁVEL | 4.550 | 3,3% | Baseline |
| Preço SUBIU + Qtd SUBIU | 3.411 | **2,8%** | Melhor: demanda forte, pouca devolução |
| Preço SUBIU + Qtd ESTÁVEL | 1.235 | 3,1% | Absorveu aumento sem impacto |
| Preço SUBIU + Qtd DESCEU | 3.721 | 4,2% | Resistiu ao aumento, devolveu mais |

---

## Resultado 6: Matriz Cruzada

% Devolução média por faixa de variação de preço × variação de quantidade:

```
                   Qtd caiu>30%  Qtd caiu10-30%  Qtd estavel  Qtd sub10-30%  Qtd sub>30%
Preco desc>10%        6,7%          5,9%           5,4%          3,2%          2,6%
Preco desc5-10%       6,8%          5,4%           4,4%          4,0%          3,1%
Preco estavel         4,6%          3,9%           3,4%          3,2%          2,6%
Preco sub5-10%        5,8%          5,0%           3,1%          3,5%          3,1%
Preco sub>10%         3,7%          3,4%           3,2%          2,8%          2,5%
```

---

## Descoberta Principal

**A devolução está correlacionada com a VARIAÇÃO DE QUANTIDADE, não com o preço.**

Leitura da matriz por colunas (vertical):
- Quando qtd CAI muito: 3,7% a 6,8% de devolução (ALTO)
- Quando qtd ESTÁVEL: 3,1% a 5,4% (MÉDIO)
- Quando qtd SOBE muito: 2,5% a 3,1% (BAIXO)

Leitura por linhas (horizontal):
- Variação de preço tem impacto menor (diferença de ~1-2 pontos)
- Variação de quantidade tem impacto maior (diferença de ~3-4 pontos)

### Explicação do Comportamento

A cadeia causal provável para perecíveis:

```
Cliente REDUZ pedido
  -> Pode ter produto do mês anterior parado na gôndola
  -> Devolve o antigo (vencido/sem qualidade)
  -> % devolução sobe (denominador menor + numerador com devol de meses passados)

Cliente AUMENTA pedido
  -> Gôndola gira mais rápido
  -> Menos produto vence
  -> % devolução cai
```

O preço influencia indiretamente:
```
Preço DESCE -> pode ou não gerar mais volume
  -> Se gera volume: devolução cai (2,9%)
  -> Se NÃO gera volume: devolução sobe (6,4%) = pior cenário

Preço SOBE -> pode ou não reduzir volume
  -> Se mantém volume: devolução normal (2,8%) = melhor cenário
  -> Se reduz volume: devolução sobe (4,2%)
```

---

## Recomendações para o Negócio

1. **Monitorar clientes que REDUZEM volume** — são os que vão devolver mais.
   Ação: verificar giro de gôndola antes de aceitar redução de pedido.

2. **Desconto só faz sentido se GERAR VOLUME** — desconto sem aumento de
   compra é o pior cenário (6,4% devolução). Melhor manter preço.

3. **Aumento de preço não causa devolução** — se o cliente mantém ou aumenta
   o volume após aumento de preço, a devolução cai. O mercado absorve.

4. **Foco por cliente, não por produto** — Muffato devolve 15-24% em várias
   lojas. O problema é operacional (giro de gôndola), não de preço.

5. **Novembro é crítico** — 5,9% de devolução. Revisar política de pedidos
   mínimos no período pré-natal.

---

## Próximos Passos

- [ ] Cruzar % devolução com rentabilidade líquida por cliente (CMV + comissão + desconto financeiro)
- [ ] Identificar clientes onde devolução torna a operação deficitária
- [ ] Análise de giro por produto × cliente (dias de estoque na gôndola)
- [ ] Simular cenários: "se Muffato Chapada reduzir devolução para 10%, quanto ganha?"
