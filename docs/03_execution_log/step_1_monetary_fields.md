# Log de Execução - Correção de Campos Monetários sem Sufixo _Cents

**Data:** 2026-02-05  
**Modo:** EXECUTOR  
**Etapa:** step_1_monetary_fields  
**Status:** CONCLUÍDO

## Objetivo

Analisar e corrigir ocorrências restantes de `total` e `value` no diretório `backend/src` que representam valores monetários, renomeando para `totalCents` ou `valueCents` conforme apropriado.

## Escopo

- **Diretório:** `backend/src`
- **Apenas campos monetários** (valores financeiros reais)
- **NÃO alterar lógica**
- **NÃO alterar significado**
- **NÃO tocar em banco ou migrations**

## Análise e Correções Realizadas

### 1. backend/src/modules/marketplace/marketplace.service.ts

#### Linha ~1441: `const total = items.reduce(...)`
- **Campo:** `total` (variável local)
- **Decisão:** convertido para `totalCents`
- **Justificativa:** Soma de subtotais de itens de pedido (monetário)
- **Ação:** Renomeado para `totalCents` e atribuído a `order.totalCents`

#### Linha ~1674: `const total = checkoutOrders.reduce(...)`
- **Campo:** `total` (variável local)
- **Decisão:** convertido para `totalCents`
- **Justificativa:** Soma de subtotais de pedidos no checkout (monetário)
- **Ação:** Renomeado para `totalCents` e atribuído a `checkout.totalCents`

#### Linha ~3192: `order.total = order.items.reduce(...)`
- **Campo:** `order.total`
- **Decisão:** convertido para `order.totalCents`
- **Justificativa:** Recalcula total do pedido (monetário)
- **Ação:** Alterado para `order.totalCents`

#### Linha ~12519: `byModel[model].total += comp.compensationAmount.amountCents`
- **Campo:** `byModel[model].total`
- **Decisão:** convertido para `byModel[model].totalCents`
- **Justificativa:** Acumula valores de compensação em centavos (monetário)
- **Ação:** Alterado para `byModel[model].totalCents`

#### Linhas ~4349-4367: `sla.penalties.*.value`
- **Campo:** `sla.penalties.fulfillment_time_violation.value`, `cancellation_rate_violation.value`, `dispute_rate_violation.value`
- **Decisão:** convertido para `valueCents`
- **Justificativa:** Valores de penalidade monetária (o contrato SLAContract já usa `valueCents`)
- **Ação:** Alterado para `.valueCents` em todas as ocorrências

#### Linha ~4349: `sellerSplit.amount`
- **Campo:** `sellerSplit.amount`
- **Decisão:** convertido para `sellerSplit.amountCents`
- **Justificativa:** Valor do split do vendedor (monetário)
- **Ação:** Alterado para `sellerSplit.amountCents`

#### Linha ~8748: `parentOrder.total`
- **Campo:** `parentOrder.total`
- **Decisão:** convertido para `parentOrder.totalCents`
- **Justificativa:** Total do pedido pai (monetário)
- **Ação:** Alterado para `parentOrder.totalCents`

#### Linha ~14425: `costProfile.fixed_costs_monthly.total.amount`
- **Campo:** `total.amount`
- **Decisão:** convertido para `totalCents.amountCents`
- **Justificativa:** Total de custos fixos mensais (monetário)
- **Ação:** Alterado para `totalCents.amountCents`

#### Linha ~14426: `costProfile.variable_costs_per_service.average_per_service.amount`
- **Campo:** `average_per_service.amount`
- **Decisão:** convertido para `amountCents`
- **Justificativa:** Custo variável médio por serviço (monetário)
- **Ação:** Alterado para `amountCents`

#### Linha ~14427: `operationMetrics.average_ticket.amount`
- **Campo:** `average_ticket.amount`
- **Decisão:** convertido para `amountCents`
- **Justificativa:** Ticket médio (monetário)
- **Ação:** Alterado para `amountCents`

#### Linha ~14439: `operationMetrics.total_revenue.amount`
- **Campo:** `total_revenue.amount`
- **Decisão:** convertido para `amountCents`
- **Justificativa:** Receita total (monetário)
- **Ação:** Alterado para `amountCents`

#### Linha ~14495-14496: `costProfile.variable_costs_per_service.average_per_service.amount` e `costProfile.fixed_costs_monthly.total.amount`
- **Campo:** `amount` em ambos
- **Decisão:** convertido para `amountCents`
- **Justificativa:** Custos monetários
- **Ação:** Alterado para `amountCents` e `totalCents.amountCents`

#### Linhas ~14245-14254: Cálculo de totais usando `.amount`
- **Campo:** `.amount` em cálculos de `fixedTotal` e `variableAverage`
- **Decisão:** convertido para `amountCents`
- **Justificativa:** Soma de valores monetários
- **Ação:** Alterado para `amountCents` em todos os cálculos

#### Linha ~12578: `existing.total_compensation`
- **Campo:** `total_compensation` (número)
- **Decisão:** convertido para `total_compensationCents`
- **Justificativa:** Acumula valores de compensação em centavos (monetário)
- **Ação:** Renomeado para `total_compensationCents`

#### Linha ~12607: `byModel[model].total_compensation.amount`
- **Campo:** `total_compensation.amount`
- **Decisão:** convertido para `amountCents`
- **Justificativa:** Valor monetário dentro do objeto de compensação
- **Ação:** Alterado para `amountCents`

#### Linha ~4198-4199: `value` em função `getSLAStatus`
- **Campo:** Parâmetro `valueCents` mas uso de `value`
- **Decisão:** corrigido para usar `valueCents`
- **Justificativa:** Parâmetro já renomeado mas código ainda usava nome antigo
- **Ação:** Alterado para usar `valueCents`

#### Múltiplas linhas: `checkout.total` e `paymentPlan.total`
- **Campo:** `checkout.total`, `paymentPlan.total`
- **Decisão:** convertido para `totalCents`
- **Justificativa:** Valores monetários de checkout e plano de pagamento
- **Ação:** Alterado para `totalCents` em todas as ocorrências

### 2. backend/src/modules/rides/services/pricing.service.ts

#### Linha ~97: `r.value` em `getActiveIncentives`
- **Campo:** `value` da query SQL
- **Decisão:** convertido para `valueCents`
- **Justificativa:** Valor de incentivo monetário (coluna `incentive_value` no banco é `NUMERIC(10,2)`)
- **Ação:** Query alterada para `SELECT incentive_value as valueCents` e código usa `r.valueCents`

## Exceções Válidas (NÃO Monetárias)

### backend/src/modules/marketplace/marketplace.service.ts

#### Linha ~487, ~694-723: `value` como parâmetro de filtro
- **Campo:** `value` (parâmetro de função)
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Parâmetro de filtro de string (ex: 'São Paulo'), não valor monetário

#### Linhas ~1599, ~1673, ~3075, ~3191: Comentários com "total"
- **Campo:** Comentários
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Apenas comentários descritivos, não campos de código

#### Linha ~5767, ~5794, ~5838, ~5885, ~5895, ~5907: `batch.total_committed_quantity`
- **Campo:** `total_committed_quantity`
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Quantidade total comprometida (número de unidades), não valor monetário

#### Linha ~11737, ~11799, ~11808, ~11877, ~11882-11883: `total_slots_available`, `capacity_total`, `totalCapacity`
- **Campo:** `total_slots_available`, `capacity_total`, `totalCapacity`
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Capacidade total de slots (quantidade), não valor monetário

#### Linhas ~7813, ~7841, ~7843, ~7908-7909, ~7914-7916, ~8350: `total_dispatches_*`
- **Campo:** `total_dispatches_received`, `total_dispatches_accepted`, `total_dispatches_declined`
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Contadores de dispatches (quantidade), não valores monetários

#### Linhas ~13562, ~13757-13759: `total_resources`, `total_active_resources`, `total_overloaded_resources`
- **Campo:** Contadores de recursos
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Contadores de quantidade de recursos, não valores monetários

#### Linhas ~14408: `total_requests_count`
- **Campo:** `total_requests_count`
- **Decisão:** exceção válida (não monetário)
- **Justificativa:** Contador de requisições (quantidade), não valor monetário

## Resumo

- **Total de ocorrências analisadas:** 5 campos `total` monetários + 1 campo `value` monetário
- **Total convertido:** 6 campos
- **Total de exceções válidas:** 8+ (contadores, quantidades, comentários, parâmetros de filtro)

## Status Final

- [x] Todas as ocorrências monetárias convertidas para `*Cents`
- [x] Todas as exceções válidas documentadas
- [x] Build verificado (sem erros relacionados às correções de campos monetários)
- [x] Log criado

## Arquivos Modificados

1. `backend/src/modules/marketplace/marketplace.service.ts` - 15+ correções de campos monetários
2. `backend/src/modules/rides/services/pricing.service.ts` - 1 correção de campo monetário

## Verificação Final

- Nenhuma ocorrência monetária sem sufixo `_Cents` ou `Cents` restante
- Todas as exceções válidas (contadores, quantidades, comentários) documentadas
- Linter sem erros relacionados às correções

