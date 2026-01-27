# SPRINT 66: HARDENING LÓGICO P0/P1

**Data:** 2024-12-19  
**Objetivo:** Remover/neutralizar governança automática opaca (gating/penalty/score) e mover thresholds para Policy Registry, mantendo o sistema explicável e auditável.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

**Status:** ✅ CONCLUÍDO - Todas as tarefas P0 implementadas

### 1.1. Policy Registry - Thresholds Centralizados

**Arquivos Alterados:**
- `backend/src/core/policy/policy.types.ts` - Adicionados domínios `risk`, `marketplace`, `category`
- `backend/src/core/policy/policy-registry.ts` - Adicionadas 9 novas policy keys

**Policy Keys Criadas:**

1. **Risk Management:**
   - `risk.penalty.score_threshold_warning` (default: 40)
   - `risk.penalty.score_threshold_critical` (default: 20)
   - `risk.penalty.score_threshold_blocked` (default: 0)
   - `risk.enforcement.strict_mode` (default: false)

2. **Marketplace Simulation:**
   - `marketplace.simulation.price_elasticity_default` (default: -1.5)
   - `marketplace.simulation.default_margin_percentage` (default: 15)
   - `marketplace.simulation.confidence_min_data_points_low` (default: 7)
   - `marketplace.simulation.confidence_min_data_points_medium` (default: 30)

3. **Category Input Gate:**
   - `category.input_gate.soft_deny_enabled` (default: false)

### 1.2. Soft-Block Implementado

**Arquivo:** `backend/src/core/reputation/penalty.service.ts`

**Mudanças:**
- ✅ Thresholds movidos para Policy Registry
- ✅ Soft-block por padrão (alerta, não bloqueio)
- ✅ Hard-block apenas se `risk.enforcement.strict_mode=true`
- ✅ Criação automática de alertas quando score baixo detectado
- ✅ Auditoria institucional com `referenceId`

**Comportamento Antes:**
```typescript
// Bloqueava automaticamente se score < threshold
if (score.current_score < SCORE_THRESHOLDS.WARNING) {
  return { allowed: false, reason: 'Score muito baixo' };
}
```

**Comportamento Depois:**
```typescript
// Soft-block por padrão (alerta)
if (score.current_score < warningThreshold) {
  // Criar alerta
  await alertService.createAlert(...);
  
  // Se strict_mode=true, bloquear
  if (strictMode) {
    return { allowed: false, reason: ..., referenceId: ... };
  }
  
  // Se strict_mode=false, permitir mas avisar
  return { allowed: true, warning: ..., referenceId: ... };
}
```

### 1.3. Decision Simulation - Elasticidade do Policy Registry

**Arquivos Alterados:**
- `backend/src/modules/marketplace/decision-simulation.service.ts`
- `backend/src/modules/marketplace/pricing-strategy.service.ts`

**Mudanças:**
- ✅ Elasticidade lida do Policy Registry (`marketplace.simulation.price_elasticity_default`)
- ✅ Margem padrão lida do Policy Registry (`marketplace.simulation.default_margin_percentage`)
- ✅ Confidence thresholds lidos do Policy Registry

**Antes:**
```typescript
const elasticity = -1.5; // Hardcoded
const marginPercentage = 15; // Hardcoded
```

**Depois:**
```typescript
const elasticity = policyRegistry.getPolicyValue<number>(
  'marketplace',
  'price_elasticity_default',
  -1.5 // default
) || -1.5;
```

### 1.4. Scores Explicáveis - Breakdown Completo

**Arquivos Alterados:**
- `backend/src/modules/social/social-2.0.service.ts`
- `backend/src/modules/work-instant/smart-matching.service.ts`

**Social Feed - Breakdown Adicionado:**
```typescript
relevanceScore: {
  score: weightedScore,
  breakdown: {
    contentWeight: {
      value: contentWeight,
      weight: 0.8,
      contribution: contentWeight * 0.8,
      explanation: "Peso do conteúdo baseado no modo de atuação"
    },
    baseRelevance: {
      value: baseRelevanceScore.score,
      weight: 0.2,
      contribution: baseRelevanceScore.score * 0.2,
      explanation: "Score de relevância base (targeting + perfil)",
      factors: baseRelevanceScore.breakdown
    },
    finalScore: weightedScore,
    explanation: "Score final: X (80%) + Y (20%) = Z"
  }
}
```

**Smart Matching - Breakdown Adicionado:**
```typescript
scoreBreakdown: {
  finalScore: w.finalScore,
  factors: [
    { name: 'distance', value: ..., weight: 0.35, contribution: ..., explanation: "..." },
    { name: 'reputation', value: ..., weight: 0.25, contribution: ..., explanation: "..." },
    // ... outros fatores
  ],
  explanation: "Score final calculado pela média ponderada de 7 fatores"
}
```

### 1.5. Frontend - Remoção de Scoring Local

**Arquivo:** `frontend/src/utils/feedScoring.ts`

**Mudança:**
- ✅ Removido cálculo de score local
- ✅ Ordenação apenas por data (neutro e auditável)
- ✅ Score deve vir do backend com breakdown

**Antes:**
```typescript
export function sortFeedByRelevance(items, context) {
  const itemsWithScores = items.map(item => ({
    item,
    score: scoreFeedItem(item, context), // Calculado localmente
  }));
  itemsWithScores.sort((a, b) => b.score - a.score);
  return itemsWithScores.map(entry => entry.item);
}
```

**Depois:**
```typescript
export function sortFeedByRelevance(items, context) {
  // SPRINT 66: Ordenar apenas por data (mais recente primeiro)
  // Score deve vir do backend, não calculado localmente
  return items.sort((a, b) => {
    const dateA = getItemDate(a.item);
    const dateB = getItemDate(b.item);
    return dateB.getTime() - dateA.getTime();
  });
}
```

### 1.6. Bank Limit Enforcement - Mensagens Padronizadas

**Arquivo:** `backend/src/modules/bank/bank-limit.service.ts`

**Mudanças:**
- ✅ Erro padronizado com payload estruturado
- ✅ `errorCode: 'DAILY_LIMIT_EXCEEDED'`
- ✅ Campos: `limitType`, `limitAmount`, `usedToday`, `attemptedAmount`, `referenceId`

**Antes:**
```typescript
const error = new Error('Limite diário atingido');
(error as any).statusCode = 403;
throw error;
```

**Depois:**
```typescript
const error = new Error('Limite diário atingido') as Error & {
  statusCode?: number;
  errorCode?: string;
  limitType?: string;
  limitAmount?: number;
  usedToday?: number;
  attemptedAmount?: number;
  referenceId?: string;
};
error.statusCode = 403;
error.errorCode = 'DAILY_LIMIT_EXCEEDED';
error.limitType = limitType;
error.limitAmount = limit.currentAmount;
error.usedToday = usedToday;
error.attemptedAmount = attemptedAmount;
error.referenceId = referenceId; // Do auditService.record
throw error;
```

---

## 2. ANTES/DEPOIS DO COMPORTAMENTO

### 2.1. Penalty Service - canPerformAction

**ANTES:**
- Bloqueava automaticamente se `score < WARNING` (40) para CREATE_EVENT/RECEIVE_INVITATION
- Bloqueava automaticamente se `score < CRITICAL` (20) para PURCHASE
- Thresholds hardcoded
- Sem alertas
- Sem auditoria com referenceId

**DEPOIS:**
- Soft-block por padrão (alerta, não bloqueio)
- Hard-block apenas se `risk.enforcement.strict_mode=true`
- Thresholds do Policy Registry
- Alerta criado automaticamente quando score baixo detectado
- Auditoria com `referenceId` para rastreabilidade
- Retorno inclui `warning` se soft-block, `referenceId` sempre

### 2.2. Decision Simulation

**ANTES:**
- Elasticidade hardcoded: `-1.5`
- Margem padrão hardcoded: `15%`
- Confidence thresholds hardcoded: `7` (LOW), `30` (MEDIUM)

**DEPOIS:**
- Elasticidade do Policy Registry: `marketplace.simulation.price_elasticity_default`
- Margem padrão do Policy Registry: `marketplace.simulation.default_margin_percentage`
- Confidence thresholds do Policy Registry: `marketplace.simulation.confidence_min_data_points_low/medium`

### 2.3. Social Feed

**ANTES:**
- Score calculado mas breakdown incompleto
- Breakdown não incluía pesos e contribuições
- Sem explicação legível

**DEPOIS:**
- Breakdown completo com:
  - `contentWeight`: valor, peso (0.8), contribuição, explicação
  - `baseRelevance`: valor, peso (0.2), contribuição, explicação, fatores
  - `finalScore`: score final
  - `explanation`: explicação legível

### 2.4. Smart Matching

**ANTES:**
- Score calculado mas não retornado
- Breakdown não disponível
- Pesos hardcoded (0.35, 0.25, 0.20, etc.)

**DEPOIS:**
- Score retornado com breakdown completo
- Cada fator inclui: nome, valor, peso, contribuição, explicação
- Breakdown disponível no response para auditoria

### 2.5. Frontend Feed Scoring

**ANTES:**
- Calculava score localmente (não auditável)
- Ordenava por score calculado localmente
- Podia divergir do backend

**DEPOIS:**
- Não calcula score localmente
- Ordena apenas por data (neutro)
- Score deve vir do backend com breakdown

---

## 3. POLICY KEYS CRIADAS

### 3.1. Risk Management

| Key | Domain | Default | Descrição |
|-----|--------|---------|-----------|
| `risk.penalty.score_threshold_warning` | `risk` | `40` | Score mínimo para ações que requerem warning (CREATE_EVENT, RECEIVE_INVITATION) |
| `risk.penalty.score_threshold_critical` | `risk` | `20` | Score mínimo para ações críticas (PURCHASE) |
| `risk.penalty.score_threshold_blocked` | `risk` | `0` | Score mínimo para conta bloqueada |
| `risk.enforcement.strict_mode` | `risk` | `false` | Se `true`, bloqueia ações automaticamente por score. Se `false`, apenas alerta (soft-block) |

### 3.2. Marketplace Simulation

| Key | Domain | Default | Descrição |
|-----|--------|---------|-----------|
| `marketplace.simulation.price_elasticity_default` | `marketplace` | `-1.5` | Elasticidade de preço padrão (aumento de 10% = redução de 15% na demanda) |
| `marketplace.simulation.default_margin_percentage` | `marketplace` | `15` | Margem padrão (em %) para simulações quando não há histórico |
| `marketplace.simulation.confidence_min_data_points_low` | `marketplace` | `7` | Número mínimo de pontos de dados para confiança LOW |
| `marketplace.simulation.confidence_min_data_points_medium` | `marketplace` | `30` | Número mínimo de pontos de dados para confiança MEDIUM |

### 3.3. Category Input Gate

| Key | Domain | Default | Descrição |
|-----|--------|---------|-----------|
| `category.input_gate.soft_deny_enabled` | `category` | `false` | Se `true`, requer aprovação manual em vez de bloquear completamente (soft deny) |

---

## 4. SOFT-BLOCK VS STRICT-MODE

### 4.1. Soft-Block (Padrão)

**Quando:** `risk.enforcement.strict_mode=false` (default)

**Comportamento:**
- ✅ Ação é **permitida** (não bloqueada)
- ✅ Alerta criado automaticamente
- ✅ Auditoria registrada com `referenceId`
- ✅ Retorno inclui `warning` com explicação

**Exemplo:**
```typescript
const result = await penaltyService.canPerformAction(tenantId, actorId, 'user', 'CREATE_EVENT', userId);
// result = {
//   allowed: true,
//   warning: "Score muito baixo (35 < 40) para criar eventos",
//   referenceId: "audit-123"
// }
```

### 4.2. Strict-Mode (Hard-Block)

**Quando:** `risk.enforcement.strict_mode=true`

**Comportamento:**
- ❌ Ação é **bloqueada**
- ✅ Alerta criado automaticamente
- ✅ Auditoria registrada com `referenceId`
- ✅ Retorno inclui `reason` com explicação

**Exemplo:**
```typescript
const result = await penaltyService.canPerformAction(tenantId, actorId, 'user', 'CREATE_EVENT', userId);
// result = {
//   allowed: false,
//   reason: "Score muito baixo (35 < 40) para criar eventos",
//   referenceId: "audit-123"
// }
```

### 4.3. Casos Sempre Hard-Block

**Débitos Pendentes:**
- Sempre bloqueiam (segurança financeira)
- Não afetados por `strict_mode`

**Penalidades Ativas:**
- Sempre bloqueiam (decisão explícita)
- Não afetados por `strict_mode`

---

## 5. CHECKLIST DE VERIFICAÇÃO

### 5.1. Policy Registry

- ✅ Domínios `risk`, `marketplace`, `category` adicionados
- ✅ 9 policy keys criadas com defaults seguros
- ✅ Todos os thresholds P0/P1 movidos para Policy Registry
- ✅ Fallbacks para defaults se policy não existir

### 5.2. Soft-Block

- ✅ Penalty service implementa soft-block por padrão
- ✅ Alerta criado automaticamente quando score baixo
- ✅ Auditoria registrada com `referenceId`
- ✅ Hard-block apenas se `strict_mode=true`
- ✅ Débitos e penalidades sempre bloqueiam (hard-block)

### 5.3. Scores Explicáveis

- ✅ Social feed retorna breakdown completo
- ✅ Smart matching retorna breakdown completo
- ✅ Breakdown inclui: valor, peso, contribuição, explicação
- ✅ Frontend não calcula score localmente

### 5.4. Bank Limit

- ✅ Erro padronizado com `errorCode: 'DAILY_LIMIT_EXCEEDED'`
- ✅ Payload estruturado: `limitType`, `limitAmount`, `usedToday`, `attemptedAmount`, `referenceId`
- ✅ Auditoria registrada com `referenceId`

### 5.5. Build/Lint/Test

- ✅ Sem erros de lint
- ✅ Imports corretos
- ✅ Tipos TypeScript corretos
- ✅ Testes mínimos criados:
  - `backend/src/core/reputation/__tests__/soft-block.test.ts` - Testa soft-block
  - `backend/src/modules/marketplace/__tests__/policy-registry-thresholds.test.ts` - Testa Policy Registry

---

## 6. ARQUIVOS ALTERADOS

### 6.1. Backend

1. `backend/src/core/policy/policy.types.ts`
   - Adicionados domínios: `risk`, `marketplace`, `category`

2. `backend/src/core/policy/policy-registry.ts`
   - Adicionadas 9 policy keys com defaults

3. `backend/src/core/reputation/penalty.service.ts`
   - Thresholds movidos para Policy Registry
   - Soft-block implementado
   - Alerta automático quando score baixo
   - Auditoria com `referenceId`

4. `backend/src/modules/marketplace/decision-simulation.service.ts`
   - Elasticidade do Policy Registry
   - Margem padrão do Policy Registry
   - Confidence thresholds do Policy Registry

5. `backend/src/modules/marketplace/pricing-strategy.service.ts`
   - Elasticidade do Policy Registry
   - Confidence thresholds do Policy Registry

6. `backend/src/modules/social/social-2.0.service.ts`
   - Breakdown completo de relevância adicionado

7. `backend/src/modules/work-instant/smart-matching.service.ts`
   - Breakdown completo de score adicionado

8. `backend/src/modules/bank/bank-limit.service.ts`
   - Erro padronizado com payload estruturado
   - `referenceId` incluído no erro

### 6.2. Frontend

1. `frontend/src/utils/feedScoring.ts`
   - Removido cálculo de score local
   - Ordenação apenas por data

---

## 7. COMPATIBILIDADE

### 7.1. Breaking Changes

**Nenhum breaking change crítico:**
- `canPerformAction` agora aceita `actingUserId` opcional (não quebra chamadas existentes)
- Retorno de `canPerformAction` agora inclui `warning` e `referenceId` opcionais (não quebra código existente)
- Smart matching agora retorna `scoreBreakdown` (campo adicional, não quebra)
- Social feed agora retorna `relevanceScore.breakdown` completo (melhoria, não quebra)

### 7.2. Migração

**Nenhuma migração necessária:**
- Policy Registry usa defaults se policy não existir
- Soft-block é padrão (sistema funciona normalmente)
- Strict-mode é opt-in via policy

---

## 8. PRÓXIMOS PASSOS (P2/P3)

### 8.1. P2 - Pendentes

1. **Category Input Gate - Soft Deny:**
   - Implementar `soft_deny_enabled` no `category-input-gate.service.ts`
   - Retornar `REQUIRES_APPROVAL` em vez de `DENY` se soft deny ativo

2. **Smart Matching - Pesos do Policy Registry:**
   - Mover pesos (0.35, 0.25, etc.) para Policy Registry
   - Permitir configuração por categoria

3. **Feed Priority Service:**
   - Expor breakdown de priorização
   - Remover `metricsBonus` opaco

### 8.2. P3 - Pendentes

1. **Confidence Level Thresholds:**
   - Já implementado (P0/P1)
   - ✅ Concluído

---

## 9. CONCLUSÃO

**Status:** ✅ CONCLUÍDO

**Mudanças Implementadas:**
- ✅ 9 policy keys criadas
- ✅ Soft-block implementado (penalty service)
- ✅ Thresholds movidos para Policy Registry (P0/P1)
- ✅ Scores explicáveis (breakdown completo)
- ✅ Frontend não calcula score localmente
- ✅ Bank limit com mensagens padronizadas

**Resultado:**
- Nenhum gating automático por score sem `strict_mode`
- Nenhum threshold hardcoded em P0/P1 (todos em Policy Registry)
- Scores/rankings explicáveis (breakdown) ou removidos
- Frontend não calcula score local
- Tudo auditável (referenceId e metadata)

**Testes Criados:**
- `backend/src/core/reputation/__tests__/soft-block.test.ts` - Valida soft-block, alertas, auditoria
- `backend/src/modules/marketplace/__tests__/policy-registry-thresholds.test.ts` - Valida Policy Registry

**Próximos Passos (P2/P3):**
- Implementar P2 (category input gate soft deny, smart matching pesos)
- Documentar policy keys no README
- Executar testes em CI/CD

---

## 10. CHECKLIST FINAL (CRITÉRIO DE PRONTO)

### A) P0 — REMOVER GATING CRÍTICO
- ✅ **Penalty Service:** Soft-block implementado (alerta + registro auditável)
- ✅ **Penalty Service:** Hard-block apenas se `strict_mode=true`
- ✅ **Logs/Audit:** `actor_id`, `acting_user_id`, `authority_source`, `reason`, `referenceId` registrados
- ✅ **Alerta Automático:** Criado quando score baixo detectado
- ✅ **Retorno:** Inclui `warning` (soft-block) ou `reason` (hard-block) + `referenceId`

### B) POLICY REGISTRY — THRESHOLDS
- ✅ **9 Policy Keys Criadas:**
  - `risk.penalty.score_threshold_warning` (default: 40)
  - `risk.penalty.score_threshold_critical` (default: 20)
  - `risk.penalty.score_threshold_blocked` (default: 0)
  - `risk.enforcement.strict_mode` (default: false)
  - `marketplace.simulation.price_elasticity_default` (default: -1.5)
  - `marketplace.simulation.default_margin_percentage` (default: 15)
  - `marketplace.simulation.confidence_min_data_points_low` (default: 7)
  - `marketplace.simulation.confidence_min_data_points_medium` (default: 30)
  - `category.input_gate.soft_deny_enabled` (default: false)
- ✅ **Hardcode Removido:**
  - Elasticidade: `decision-simulation.service.ts`, `pricing-strategy.service.ts`
  - Margem padrão: `decision-simulation.service.ts`
  - Confidence thresholds: `decision-simulation.service.ts`, `pricing-strategy.service.ts`
  - Score thresholds: `penalty.service.ts`
- ✅ **Fallbacks:** Defaults aplicados se policy não existir

### C) EXPLICABILIDADE DE SCORE/RANKING
- ✅ **Social Feed:** Breakdown completo com `contentWeight`, `baseRelevance`, pesos, contribuições, explicação
- ✅ **Smart Matching:** Breakdown completo com 7 fatores (distance, reputation, performance, etc.)
- ✅ **Frontend:** Scoring local removido, ordenação apenas por data
- ✅ **Breakdown Inclui:** valor, peso, contribuição, explicação para cada fator

### D) TESTES MÍNIMOS
- ✅ **Soft-Block Test:** Valida que ações não são bloqueadas automaticamente por score
- ✅ **Policy Registry Test:** Valida que thresholds são lidos do registry
- ✅ **Auditoria Test:** Valida que `referenceId` é gerado

---

## 11. VALIDAÇÃO FINAL

### ✅ Critério de Pronto Atendido

1. **Nenhum gating crítico automático ativo:**
   - ✅ Penalty service usa soft-block por padrão
   - ✅ Hard-block apenas se `strict_mode=true` (opt-in)

2. **Thresholds hardcoded críticos removidos:**
   - ✅ Todos os thresholds P0/P1 movidos para Policy Registry
   - ✅ Fallbacks seguros implementados

3. **Policy Registry governa valores:**
   - ✅ 9 policy keys criadas
   - ✅ Todos os serviços lêem do registry

4. **Diffs e checklist entregues:**
   - ✅ Documento completo com antes/depois
   - ✅ Checklist de verificação
   - ✅ Lista de arquivos alterados

---

**Fim do Relatório**

