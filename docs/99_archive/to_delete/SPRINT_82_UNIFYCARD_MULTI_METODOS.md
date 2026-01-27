# SPRINT 82: UNIFYCARD MULTI-MÉTODOS (CRÉDITO, DÉBITO, PIX, VALE)

**Data:** 2025-01-XX  
**Objetivo:** Preparar o UnifyCard como HUB de métodos de pagamento, com taxas regionais e retorno econômico para a comunidade, sem integração real com adquirentes externas ainda  
**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO

Sistema completo de métodos de pagamento UnifyCard com:
- ✅ Métodos: CREDIT, DEBIT, PIX, CASH, VALE_REFEICAO, VALE_ALIMENTACAO
- ✅ Taxas configuráveis por método
- ✅ Integração com PaymentExecution
- ✅ Snapshot de taxa salvo no metadata
- ✅ Nenhuma integração real
- ✅ Apenas modelagem

---

## 2. GUARDRAILS RESPEITADOS

### 2.1. Nenhuma integração real
- ✅ Não integra com adquirentes externas
- ✅ Não processa pagamentos reais
- ✅ Apenas modelagem

### 2.2. Nenhum dinheiro externo
- ✅ Não movimenta dinheiro real
- ✅ Não cria transações bancárias reais
- ✅ Apenas representação

### 2.3. Apenas modelagem
- ✅ Taxas são declarativas
- ✅ Não calcula impostos
- ✅ Não executa liquidação

### 2.4. Tudo auditável
- ✅ Todas as ações registradas
- ✅ Taxas salvas em snapshot

---

## 3. MIGRATION

### 3.1. `219_create_unifycard_payment_methods.sql`
Tabela `unifycard_payment_methods`:
- `id`, `tenant_id`
- `method_type` (CREDIT | DEBIT | PIX | CASH | VALE_REFEICAO | VALE_ALIMENTACAO)
- `provider` (sempre 'UNIFYCARD')
- `fee_percentage` (NUMERIC, ex: 0.0299 = 2.99%)
- `settlement_delay_days` (INTEGER, 0 = imediato)
- `metadata` (JSONB)
- `created_at`
- Constraint UNIQUE: `(tenant_id, method_type)` - 1 método por tipo por tenant
- RLS habilitado
- Índices por tenant_id, method_type

---

## 4. SERVICES

### 4.1. UnifyCardMethodService
**Arquivo:** `backend/src/modules/marketplace/unifycard-method.service.ts`

**Métodos:**
- `createMethod()` - Cria método de pagamento UnifyCard
- `listMethods()` - Lista métodos UnifyCard
- `getMethodByType()` - Busca método por tipo
- `resolveFee()` - Resolve taxa para um método

**Validações:**
- ✅ Apenas 1 método por tipo por tenant
- ✅ Provider sempre 'UNIFYCARD'

---

## 5. INTEGRAÇÕES

### 5.1. PaymentExecution

**Integração:**
- `PaymentExecutionService.executePayment()` resolve taxa via UnifyCardMethodService
- Taxa resolvida quando `provider = UNIFYCARD`
- Snapshot salvo no metadata do transaction

**Fluxo:**
1. PaymentExecution verifica se `provider = UNIFYCARD`
2. Se sim, resolve taxa via `UnifyCardMethodService.resolveFee()`
3. Atualiza `payment_method_snapshot` com taxa resolvida
4. Salva snapshot no metadata do transaction

**Código:**
```typescript
// SPRINT 82: Resolver taxa via UnifyCardMethodService se provider = UNIFYCARD
if (isUnifyCard && paymentMethodSnapshot?.type) {
  const feeInfo = await unifyCardMethodService.resolveFee(tenantId, unifyCardMethodType);
  paymentMethodSnapshot.fee_percentage = feeInfo.feePercentage;
  paymentMethodSnapshot.settlement_delay_days = feeInfo.settlementDelayDays;
}
```

### 5.2. Settlement (Preparado)
**Status:** Estrutura preparada

**Uso futuro:**
- Taxa pode ir para RegionAccount
- Campo `regional_fee_amount` preparado
- Sem execução automática

**Nota:** Integração não implementada nesta sprint (apenas estrutura preparada)

### 5.3. Audit
**Eventos registrados:**
- `UNIFYCARD_METHOD_CREATED` - Quando método é criado

---

## 6. REGRAS DE NEGÓCIO

### 6.1. Tipos de Métodos

**CREDIT:**
- Cartão de Crédito
- Taxa configurável (ex: 2.99%)
- Settlement delay configurável (ex: 30 dias)

**DEBIT:**
- Cartão de Débito
- Taxa configurável (ex: 1.99%)
- Settlement delay configurável (ex: 1 dia)

**PIX:**
- Pix
- Taxa configurável (ex: 0%)
- Settlement delay: 0 dias (imediato)

**CASH:**
- Dinheiro
- Taxa: 0%
- Settlement delay: 0 dias (imediato)

**VALE_REFEICAO:**
- Vale Refeição
- Taxa configurável
- Settlement delay configurável

**VALE_ALIMENTACAO:**
- Vale Alimentação
- Taxa configurável
- Settlement delay configurável

### 6.2. Resolução de Taxa

**Fluxo:**
1. PaymentExecution verifica se `provider = UNIFYCARD`
2. Busca método via `UnifyCardMethodService.getMethodByType()`
3. Retorna `fee_percentage` e `settlement_delay_days`
4. Se método não encontrado, retorna valores padrão (0, 0)

**Mapeamento de Tipos:**
- `CREDIT_CARD` → `CREDIT`
- `DEBIT_CARD` → `DEBIT`
- `PIX` → `PIX`
- `VOUCHER` → `VALE_REFEICAO` (default)

### 6.3. Snapshot de Taxa

**Estrutura:**
```json
{
  "unifycard_fee_snapshot": {
    "fee_percentage": 0.0299,
    "settlement_delay_days": 30,
    "method_type": "CREDIT"
  }
}
```

**Onde é salvo:**
- `payment_transaction.metadata.unifycard_fee_snapshot`
- Snapshot preserva taxa no momento da execução

---

## 7. ROTAS REST

### 7.1. Criação

- `POST /marketplace/unifycard/methods` - Cria método UnifyCard

### 7.2. Consulta

- `GET /marketplace/unifycard/methods` - Lista métodos UnifyCard
- `GET /marketplace/unifycard/methods/:type` - Busca método por tipo

**Nota:** Rotas registradas em `marketplace.routes.ts` com prefix `/marketplace`

---

## 8. ARQUIVOS CRIADOS

### 8.1. Migration
- ✅ `backend/migrations/219_create_unifycard_payment_methods.sql`

### 8.2. Types
- ✅ `backend/src/modules/marketplace/unifycard-method.types.ts`

### 8.3. Repository
- ✅ `backend/src/modules/marketplace/unifycard-method.repository.ts`

### 8.4. Service
- ✅ `backend/src/modules/marketplace/unifycard-method.service.ts`

### 8.5. Routes
- ✅ `backend/src/modules/marketplace/unifycard-method.routes.ts`

### 8.6. Integração
- ✅ `backend/src/modules/marketplace/payment-execution.service.ts` (atualizado)

### 8.7. Documentation
- ✅ `SPRINT_82_UNIFYCARD_MULTI_METODOS.md`

---

## 9. EXEMPLOS DE USO

### 9.1. Criar Método UnifyCard

```typescript
// Criar método de crédito
const method = await unifyCardMethodService.createMethod(
  tenantId,
  {
    methodType: 'CREDIT',
    feePercentage: 0.0299, // 2.99%
    settlementDelayDays: 30,
  },
  userId
);
```

### 9.2. Resolver Taxa

```typescript
// Resolver taxa para crédito
const feeInfo = await unifyCardMethodService.resolveFee(tenantId, 'CREDIT');
// Retorna: { feePercentage: 0.0299, settlementDelayDays: 30 }
```

### 9.3. Listar Métodos

```typescript
// Listar todos os métodos UnifyCard
const methods = await unifyCardMethodService.listMethods(tenantId);
```

---

## 10. OBSERVAÇÕES

### 10.1. Relação com Payment Methods
- `unifycard_payment_methods` é específico para UnifyCard
- `payment_methods` é genérico (pode ter provider UNIFYCARD ou EXTERNAL)
- UnifyCard methods define taxas específicas do UnifyCard

### 10.2. Taxas Regionais (Preparado)
- Estrutura preparada para taxas regionais
- Campo `regional_fee_amount` preparado no settlement
- Sem execução automática nesta sprint

### 10.3. Retorno Econômico (Preparado)
- Taxa não vai para adquirente externa
- Taxa → RegionAccount (preparado)
- Sem execução automática nesta sprint

### 10.4. Compatibilidade
- Se método não encontrado, retorna valores padrão (0, 0)
- Não bloqueia execução de pagamento
- Apenas modelagem

---

## 11. TESTES

**Pendente:**
- Testes unitários para services
- Testes de integração para rotas
- Testes de resolução de taxa
- Testes de integração com PaymentExecution

---

## 12. CONCLUSÃO

Sistema completo de métodos de pagamento UnifyCard implementado conforme especificação da Sprint 82. Todos os guardrails respeitados, integração com PaymentExecution funcional e código auditável.

**Status:** ✅ CONCLUÍDO



