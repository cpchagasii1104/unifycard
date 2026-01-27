# SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES (DECLARATIVO)

**Data:** 2024-12-19  
**Objetivo:** Criar camada organizacional e econômica de grupos, códigos de indicação e comissões declarativas, sem executar pagamentos.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migrations Criadas

**Arquivos:**
- `backend/migrations/203_create_groups.sql` - Tabela `groups`
- `backend/migrations/204_create_referral_codes.sql` - Tabela `referral_codes`
- `backend/migrations/205_create_commission_rules.sql` - Tabela `commission_rules`

**Estrutura:**

**groups:**
- Campos: id, tenant_id, name, parent_group_id (nullable), metadata
- Hierárquico (pode ter grupo pai)
- RLS habilitado

**referral_codes:**
- Campos: id, tenant_id, code (unique), owner_actor_id, group_id (nullable), is_active
- Código único por tenant
- Pode estar associado a um grupo

**commission_rules:**
- Campos: id, tenant_id, applies_to (GROUP | REFERRAL | PAYMENT_METHOD), applies_id, base_percentage, regional_percentage, platform_percentage
- Regras declarativas (não executam pagamentos)

### 1.2. Services Criados

**GroupService:**
- `createGroup()` - Cria grupo
- `listGroups()` - Lista grupos
- `getGroupById()` - Busca grupo

**ReferralService:**
- `createCode()` - Cria código de indicação
- `resolveCode()` - Resolve código e retorna owner/group

**CommissionService:**
- `createRule()` - Cria regra de comissão
- `resolveCommission()` - Calcula comissão (declarativo, não executa)

### 1.3. Integrações

**PaymentExecution:**
- Se houver `referral_code` no order metadata, resolve código
- Calcula comissão usando `CommissionService.resolveCommission()`
- Salva snapshot da comissão no metadata da transação e do receivable

**AccountsReceivable:**
- Persiste snapshot da comissão no metadata (somente leitura futura)

---

## 2. ESTRUTURA DE DADOS

### 2.1. groups

```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_group_id UUID, -- Hierárquico
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.2. referral_codes

```sql
CREATE TABLE referral_codes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL, -- Unique por tenant
    owner_actor_id UUID NOT NULL,
    group_id UUID, -- Opcional
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.3. commission_rules

```sql
CREATE TABLE commission_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    applies_to commission_applies_to NOT NULL, -- GROUP | REFERRAL | PAYMENT_METHOD
    applies_id UUID NOT NULL,
    base_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0,
    regional_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0,
    platform_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 3. CÁLCULO DE COMISSÃO

### 3.1. Prioridade de Resolução

**Ordem:**
1. REFERRAL (se referral_code fornecido)
2. GROUP (se group_id fornecido)
3. PAYMENT_METHOD (se payment_method_id fornecido)

**Lógica:**
```typescript
if (context.referralCodeId) {
  rule = findRule('REFERRAL', referralCodeId);
}
if (!rule && context.groupId) {
  rule = findRule('GROUP', groupId);
}
if (!rule && context.paymentMethodId) {
  rule = findRule('PAYMENT_METHOD', paymentMethodId);
}
```

### 3.2. Cálculo

**Valores calculados:**
- `baseAmountCents = amountCents * basePercentage`
- `regionalAmountCents = amountCents * regionalPercentage`
- `platformAmountCents = amountCents * platformPercentage`
- `totalAmountCents = base + regional + platform`

**Snapshot:**
- Todos os valores e percentuais salvos no metadata
- Imutável e auditável

---

## 4. INTEGRAÇÃO COM PAYMENT EXECUTION

### 4.1. Fluxo

**Quando:** `executePayment()` é chamado e payment é SUCCESS

**O que acontece:**
1. Busca `referral_code` no order metadata
2. Resolve código usando `ReferralService.resolveCode()`
3. Calcula comissão usando `CommissionService.resolveCommission()`
4. Salva snapshot no metadata da transação e do receivable

**Exemplo:**
```typescript
// No executePayment(), após sucesso:
const orderMetadata = order.metadata || {};
const referralCode = orderMetadata.referral_code;

if (referralCode) {
  const resolved = await referralService.resolveCode(tenantId, referralCode);
  if (resolved) {
    const commission = await commissionService.resolveCommission(tenantId, {
      amountCents: Math.round(intent.amount * 100),
      referralCodeId: resolved.referralCode.id,
      groupId: resolved.groupId,
    });
    
    // Snapshot salvo no metadata
    commissionSnapshot = commission.snapshot;
  }
}
```

---

## 5. GUARDRAILS RESPEITADOS

### 5.1. Comissão ≠ Split

- ✅ Comissão é cálculo declarativo
- ✅ Split é execução de divisão de pagamento
- ✅ Nenhum split criado automaticamente

### 5.2. Comissão ≠ Payout

- ✅ Comissão é cálculo
- ✅ Payout é execução de transferência
- ✅ Nenhum payout criado automaticamente

### 5.3. Comissão ≠ Ledger

- ✅ Comissão não altera ledger
- ✅ Apenas snapshot no metadata
- ✅ Ledger é source of truth

### 5.4. Tudo Declarativo e Auditável

- ✅ Todas as comissões geram snapshot
- ✅ Snapshot imutável no metadata
- ✅ Contexto completo registrado

---

## 6. ARQUIVOS CRIADOS

### 6.1. Migrations

1. `backend/migrations/203_create_groups.sql`
2. `backend/migrations/204_create_referral_codes.sql`
3. `backend/migrations/205_create_commission_rules.sql`

### 6.2. Types

4. `backend/src/modules/marketplace/group.types.ts`
5. `backend/src/modules/marketplace/referral.types.ts`
6. `backend/src/modules/marketplace/commission.types.ts`

### 6.3. Repositories

7. `backend/src/modules/marketplace/group.repository.ts`
8. `backend/src/modules/marketplace/referral.repository.ts`
9. `backend/src/modules/marketplace/commission.repository.ts`

### 6.4. Services

10. `backend/src/modules/marketplace/group.service.ts`
11. `backend/src/modules/marketplace/referral.service.ts`
12. `backend/src/modules/marketplace/commission.service.ts`

### 6.5. Integrações

13. `backend/src/modules/marketplace/payment-execution.service.ts` (atualizado - calcula comissão)

---

## 7. EXEMPLOS DE USO

### 7.1. Criar Grupo e Código de Indicação

```typescript
// Criar grupo
const group = await groupService.createGroup(tenantId, {
  name: 'Franquia Sul',
  parentGroupId: null,
}, 'actor-123', 'user-123');

// Criar código de indicação
const referralCode = await referralService.createCode(tenantId, {
  code: 'FRANQUIA-SUL-2024',
  ownerActorId: 'actor-123',
  groupId: group.id,
}, 'actor-123', 'user-123');
```

### 7.2. Criar Regra de Comissão

```typescript
// Criar regra para grupo
const commissionRule = await commissionService.createRule(tenantId, {
  appliesTo: 'GROUP',
  appliesId: group.id,
  basePercentage: 0.05, // 5%
  regionalPercentage: 0.02, // 2%
  platformPercentage: 0.01, // 1%
}, 'actor-123', 'user-123');
```

### 7.3. Calcular Comissão

```typescript
// Calcular comissão
const commission = await commissionService.resolveCommission(tenantId, {
  amountCents: 100000, // R$ 1.000,00
  referralCodeId: referralCode.id,
  groupId: group.id,
});

// Resultado:
// {
//   baseAmountCents: 5000,      // 5%
//   regionalAmountCents: 2000,  // 2%
//   platformAmountCents: 1000, // 1%
//   totalAmountCents: 8000,     // 8%
//   snapshot: { ... }
// }
```

---

## 8. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **Grupos funcionando:**
   - ✅ `createGroup()` cria grupo
   - ✅ Hierarquia suportada

2. **Códigos de indicação funcionando:**
   - ✅ `createCode()` cria código
   - ✅ `resolveCode()` resolve código

3. **Comissões calculadas:**
   - ✅ `resolveCommission()` calcula comissão
   - ✅ Snapshot salvo no metadata

4. **Nenhuma execução:**
   - ✅ Nenhum pagamento executado
   - ✅ Nenhum split criado
   - ✅ Nenhum payout criado

5. **Tudo declarativo:**
   - ✅ Apenas cálculo e snapshot
   - ✅ Tudo auditável

---

**Fim do Relatório**




