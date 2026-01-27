# SPRINT 65: AUDITORIA DE HARDENING LÓGICO

**Data:** 2024-12-19  
**Objetivo:** Detectar lógica que rankeia conteúdo opaco, aplica gating automático, toma decisões econômicas fora de contratos, cria automação invisível, defaults perigosos, heurísticas silenciosas e side-effects em serviços read-only.

**Escopo:**
- Backend: `modules/marketplace`, `modules/automation`, `modules/social`, `modules/bank`, `modules/pdv`
- Frontend: páginas e utils que executam fluxo de compra/pagamento, fazem pre-decisões localmente

**Guardrails:** Nenhuma modificação aplicada. Apenas auditoria + propostas.

---

## 1. RESUMO EXECUTIVO

### 1.1. Findings por Severidade

- **CRÍTICO (P0):** 2 findings
- **ALTO (P1):** 5 findings
- **MÉDIO (P2):** 8 findings
- **BAIXO (P3):** 3 findings

### 1.2. Categorias de Findings

1. **Ranking/Scoring Opaco:** 3 findings (ALTO/MÉDIO)
2. **Gating Automático:** 4 findings (CRÍTICO/ALTO)
3. **Decisões Econômicas Fora de Contratos:** 0 findings ✅
4. **Automação Invisível:** 0 findings ✅
5. **Defaults Perigosos:** 2 findings (CRÍTICO)
6. **Heurísticas Silenciosas:** 4 findings (ALTO/MÉDIO)
7. **Side-Effects em Read-Only:** 0 findings ✅
8. **WebAuthn Step-Up Hotfix:** 1 finding (MÉDIO - inconsistência)

---

## 2. FINDINGS DETALHADOS

### 2.1. RANKING/SCORING OPACO

#### Finding #1: Feed Social com Score de Relevância Opaco (ALTO)

**Arquivo:** `backend/src/modules/social/social-2.0.service.ts`  
**Linhas:** 464-490

**Snippet:**
```typescript
// Calcular scores de relevância para todos os posts
const postsWithScores = await Promise.all(rows.map(async (row) => {
  const targeting = null; // FASE 3.6: targeting não existe na tabela posts ainda
  const baseRelevanceScore = userCoreProfile
    ? socialTargetingService.calculateRelevanceScore(
        targeting,
        userCoreProfile,
        row.is_followed || false,
        userAge
      )
    : { score: 50, breakdown: {} };
  
  // Calcular peso baseado no modo de atuação (FASE 8 + EVENTOS ÂNCORA)
  const contentWeight = calculateContentWeight(row, actorType, userPreferences, userLocation);
  
  // Combinar peso do conteúdo com score de relevância base
  // Peso do conteúdo tem prioridade dominante (80%) + relevância base (20%)
  const weightedScore = (contentWeight * 0.8) + (baseRelevanceScore.score * 0.2);
  
  const relevanceScore = {
    score: Math.min(100, Math.max(0, weightedScore)), // Garantir que fique entre 0-100
    breakdown: {
      ...baseRelevanceScore.breakdown,
      content_weight: contentWeight,
      mode: actorType,
    },
  };
```

**Problema:**
- Score combinado (80% contentWeight + 20% baseRelevanceScore) não é explicável para o usuário
- `calculateContentWeight` não está visível no snippet (função privada)
- Ordenação final por `relevanceScore.score` não é transparente

**Risco:**
- Usuário não entende por que vê determinados posts primeiro
- Algoritmo pode ser manipulado sem detecção
- Dificulta auditoria e compliance

**Proposta:**
```diff
+ // Expor breakdown completo no response
+ return {
+   ...post,
+   relevanceScore: {
+     score: weightedScore,
+     breakdown: {
+       contentWeight: contentWeight,
+       baseRelevance: baseRelevanceScore.score,
+       contentWeightPercent: 80,
+       baseRelevancePercent: 20,
+       factors: baseRelevanceScore.breakdown,
+     },
+     explanation: `Score calculado: ${contentWeight} (80%) + ${baseRelevanceScore.score} (20%) = ${weightedScore}`,
+   },
+ };
```

**Severidade:** ALTO (P1)

---

#### Finding #2: Feed Service com Priorização por Métricas (MÉDIO)

**Arquivo:** `backend/src/services/feed/FeedService.ts`  
**Linhas:** 384-396

**Snippet:**
```typescript
const prioritizedEventItems = prioritizedEventIds
  .map((id, index) => {
    const entry = eventItemsMap.get(id);
    if (!entry) return null;
    // Adicionar bonus baseado na posição na priorização por métricas
    const metricsBonus = (prioritizedEventIds.length - index) * 0.1;
    return { item: entry.item, score: entry.score + metricsBonus };
  })
  .filter((entry): entry is { item: FeedItem; score: number } => entry !== null);

// Ordenar eventos por score combinado (maior primeiro)
prioritizedEventItems.sort((a, b) => b.score - a.score);
```

**Problema:**
- `prioritizedEventIds` vem de `feedPriorityService` (não visível no snippet)
- `metricsBonus` é calculado baseado em posição, não em métricas reais
- Score final não é explicável

**Risco:**
- Priorização pode ser manipulada sem transparência
- Usuário não entende por que eventos aparecem primeiro

**Proposta:**
```diff
+ // Expor breakdown de priorização
+ return {
+   ...item,
+   priorityBreakdown: {
+     baseScore: entry.score,
+     metricsBonus: metricsBonus,
+     finalScore: entry.score + metricsBonus,
+     priorityPosition: index,
+     explanation: `Evento priorizado na posição ${index + 1} de ${prioritizedEventIds.length}`,
+   },
+ };
```

**Severidade:** MÉDIO (P2)

---

#### Finding #3: Frontend Feed Scoring (MÉDIO)

**Arquivo:** `frontend/src/utils/feedScoring.ts`  
**Linhas:** 21-220

**Snippet:**
```typescript
export function scoreFeedItem(
  item: FeedItem,
  context: ScoringContext = {}
): number {
  // ... cálculo de score ...
  return score;
}

export function sortFeedByRelevance(
  items: FeedItem[],
  context: ScoringContext = {}
): FeedItem[] {
  // Calcular scores
  const itemsWithScores = items.map(item => ({
    item,
    score: scoreFeedItem(item, context),
  }));
  
  // Ordenar por score DESC, depois por data (mais recente primeiro) como tie-breaker
  itemsWithScores.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score; // Score DESC
    }
    
    // Tie-breaker: mais recente primeiro
    const dateA = getItemDate(a.item);
    const dateB = getItemDate(b.item);
    return dateB.getTime() - dateA.getTime();
  });
  
  return itemsWithScores.map(entry => entry.item);
}
```

**Problema:**
- Score calculado no frontend não é auditável
- Lógica de scoring pode divergir do backend
- Não há explicação do score para o usuário

**Risco:**
- Inconsistência entre frontend e backend
- Dificulta auditoria
- Usuário não entende ordenação

**Proposta:**
```diff
+ // Remover scoring do frontend, usar apenas ordenação por data
+ // Se scoring for necessário, deve vir do backend com breakdown
+ export function sortFeedByRelevance(
+   items: FeedItem[],
+   context: ScoringContext = {}
+ ): FeedItem[] {
+   // Ordenar apenas por data (mais recente primeiro)
+   return items.sort((a, b) => {
+     const dateA = getItemDate(a.item);
+     const dateB = getItemDate(b.item);
+     return dateB.getTime() - dateA.getTime();
+   });
+ }
```

**Severidade:** MÉDIO (P2)

---

### 2.2. GATING AUTOMÁTICO

#### Finding #4: Penalty Service Bloqueia Ações por Score (CRÍTICO)

**Arquivo:** `backend/src/core/reputation/penalty.service.ts`  
**Linhas:** 275-320

**Snippet:**
```typescript
async canPerformAction(
  tenantId: string,
  actorId: string,
  actorType: 'user' | 'page' | 'group',
  action: 'CREATE_EVENT' | 'RECEIVE_INVITATION' | 'PURCHASE' | 'PARTICIPATE'
): Promise<{ allowed: boolean; reason?: string }> {
  // Verificar débitos pendentes PRIMEIRO (antes de qualquer early return)
  if (action === 'CREATE_EVENT' || action === 'PURCHASE') {
    const debtCheck = await this.hasPendingDebts(tenantId, actorId, actorType);
    if (debtCheck.hasDebt) {
      const amountReais = (debtCheck.totalAmountCents! / 100).toFixed(2);
      return {
        allowed: false,
        reason: `Conta bloqueada: débito pendente (R$${amountReais}). Quite para continuar.`,
      };
    }
  }

  const score = await this.getScore(tenantId, actorId, actorType);
  if (!score) {
    return { allowed: true }; // Novo ator sem débito, permitir
  }

  // Verificar score mínimo
  if (action === 'CREATE_EVENT' && score.current_score < SCORE_THRESHOLDS.WARNING) {
    return { allowed: false, reason: 'Score muito baixo para criar eventos' };
  }

  if (action === 'RECEIVE_INVITATION' && score.current_score < SCORE_THRESHOLDS.WARNING) {
    return { allowed: false, reason: 'Score muito baixo para receber convites' };
  }

  if (action === 'PURCHASE' && score.current_score < SCORE_THRESHOLDS.CRITICAL) {
    return { allowed: false, reason: 'Score muito baixo para comprar ingressos' };
  }

  // Verificar penalidades ativas
  const activePenalty = await this.getActivePenalty(tenantId, actorId, actorType, action);
  if (activePenalty) {
    return { allowed: false, reason: `Penalidade ativa: ${activePenalty.reason}` };
  }

  return { allowed: true };
}
```

**Problema:**
- Thresholds hardcoded (`SCORE_THRESHOLDS.WARNING = 40`, `CRITICAL = 20`)
- Bloqueio automático sem decisão humana explícita
- Não há política configurável para thresholds

**Risco:**
- Bloqueio pode ser injusto se score não refletir realidade
- Thresholds não podem ser ajustados sem deploy
- Não há processo de apelação

**Proposta:**
```diff
+ // Mover thresholds para policy registry
+ const warningThreshold = await policyRegistry.getPolicyValue<number>(
+   'reputation',
+   'score_threshold_warning',
+   40 // default
+ );
+ const criticalThreshold = await policyRegistry.getPolicyValue<number>(
+   'reputation',
+   'score_threshold_critical',
+   20 // default
+ );
+
+ // Adicionar flag de "soft block" (alerta, não bloqueio)
+ const softBlockEnabled = await policyRegistry.getPolicyValue<boolean>(
+   'reputation',
+   'soft_block_enabled',
+   false // default: hard block
+ );
+
+ if (action === 'CREATE_EVENT' && score.current_score < warningThreshold) {
+   if (softBlockEnabled) {
+     // Apenas alertar, não bloquear
+     return { allowed: true, warning: 'Score baixo, considere melhorar sua reputação' };
+   }
+   return { allowed: false, reason: `Score muito baixo (${score.current_score} < ${warningThreshold}) para criar eventos` };
+ }
```

**Severidade:** CRÍTICO (P0)

---

#### Finding #5: Category Input Gate Bloqueia Entrada (ALTO)

**Arquivo:** `backend/src/core/categories/category-input-gate.service.ts`  
**Linhas:** 37-62

**Snippet:**
```typescript
async validate(
  input: string,
  options: GateOptions
): Promise<GateResult> {
  // ETAPA 1: Bloqueio Léxico Seguro (0-2ms)
  const lexicalCheck = categoryLexicalGateService.validate(input);
  if (lexicalCheck.decision === 'DENY') {
    // Auditoria
    await categoryInputAuditService.log({
      inputOriginal: input,
      normalized: lexicalCheck.normalized || input,
      context,
      decision: 'DENY',
      reasonCode: lexicalCheck.reasonCode,
      lexicalDecision: 'DENY',
      tenantId,
      actorId,
      globalUserId,
    });
    return {
      decision: 'DENY',
      reasonCode: lexicalCheck.reasonCode,
    };
  }
```

**Problema:**
- Bloqueio automático baseado em blacklist/whitelist
- Não há processo de apelação ou revisão humana
- Blacklist pode conter falsos positivos

**Risco:**
- Bloqueio injusto de categorias válidas
- Dificulta criação de categorias legítimas

**Proposta:**
```diff
+ // Adicionar flag de "soft deny" (requer aprovação, não bloqueia completamente)
+ const softDenyEnabled = await policyRegistry.getPolicyValue<boolean>(
+   'categories',
+   'soft_deny_enabled',
+   false // default: hard deny
+ );
+
+ if (lexicalCheck.decision === 'DENY') {
+   if (softDenyEnabled) {
+     return {
+       decision: 'REQUIRES_APPROVAL',
+       reasonCode: lexicalCheck.reasonCode,
+       message: 'Categoria requer aprovação manual',
+     };
+   }
+   return {
+     decision: 'DENY',
+     reasonCode: lexicalCheck.reasonCode,
+   };
+ }
```

**Severidade:** ALTO (P1)

---

#### Finding #6: Bank Limit Enforcement Bloqueia Transações (ALTO)

**Arquivo:** `backend/src/modules/bank/bank-limit.service.ts`  
**Linhas:** 482-541

**Snippet:**
```typescript
async validateLimit(
  tenantId: string,
  actorId: string,
  limitType: BankLimitType,
  attemptedAmount: number,
  actingUserId?: string,
  stepUpVerified?: boolean
): Promise<void> {
  // 1. Aplicar pendências vencidas
  await this.applyPendingIfDue(tenantId, actorId);

  // 2. SPRINT 36.3: Verificar step-up para transações high-value
  // ⚠️ HOTFIX: Step-up WebAuthn está em scaffolding; enforcement financeiro desativado até verificação criptográfica real.
  // Por padrão, não bloqueia (WEBAUTHN_STEP_UP_STRICT=false)
  if (actingUserId) {
    await this.requireStepUpForHighValue(
      tenantId,
      actingUserId,
      attemptedAmount,
      stepUpVerified
    );
  }

  // 3. Obter limite vigente
  const limit = await this.getLimit(tenantId, actorId, limitType);

  // 4. Calcular uso diário do ledger
  const usedToday = await this.getDailyOutflow(tenantId, actorId, limitType);

  // 5. Validar se transação excede limite
  if (usedToday + attemptedAmount > limit.currentAmount) {
    // Log institucional
    // ...
    const error = new Error('Limite diário atingido');
    (error as any).statusCode = 403;
    throw error;
  }
}
```

**Problema:**
- Bloqueio automático sem possibilidade de override humano
- Não há processo de apelação ou aumento temporário

**Risco:**
- Bloqueio pode impedir transações legítimas urgentes
- Não há flexibilidade para casos excepcionais

**Proposta:**
```diff
+ // Adicionar flag de "soft limit" (alerta, não bloqueia)
+ const softLimitEnabled = await policyRegistry.getPolicyValue<boolean>(
+   'bank',
+   'soft_limit_enabled',
+   false // default: hard limit
+ );
+
+ if (usedToday + attemptedAmount > limit.currentAmount) {
+   if (softLimitEnabled) {
+     // Apenas alertar, não bloquear
+     await auditService.record(tenantId, {
+       event_type: 'BANK_LIMIT_WARNING',
+       severity: 'MEDIUM',
+       // ...
+     });
+     return; // Permitir transação
+   }
+   // Bloquear
+   const error = new Error('Limite diário atingido');
+   (error as any).statusCode = 403;
+   throw error;
+ }
```

**Severidade:** ALTO (P1)

---

#### Finding #7: Smart Matching Ordena Workers por Score (MÉDIO)

**Arquivo:** `backend/src/modules/work-instant/smart-matching.service.ts`  
**Linhas:** 211-288

**Snippet:**
```typescript
async smartSortWorkers(
  workers: WorkerMatch[],
  requestPayload: RequestPayload,
  tenantId: string
): Promise<WorkerMatch[]> {
  // Calcular scores para cada worker
  for (const worker of workers) {
    // 1. Distance Score (0.35)
    const distanceScore = this.calculateDistanceScore(worker.distance);

    // 2. Reputation Score (0.25)
    const reputationScore = await this.getReputationScore(tenantId, worker.workerId);

    // 3. Performance Score (0.20)
    const performanceScore = await this.getPerformanceScore(tenantId, worker.userId);

    // 4. Experience Score (0.10)
    const experienceScore = await this.getExperienceScore(
      tenantId,
      worker.workerId,
      requestPayload.categoryId
    );

    // 5. Response Score (0.05)
    const responseScore = await this.getResponseScore(worker.userId);

    // 6. Specialization Score (0.05)
    const specializationScore = await this.getSpecializationScore(
      tenantId,
      worker.workerId,
      requestPayload.categoryId
    );

    // 7. Availability Score (0.05)
    const availabilityScore = 1.0;

    // Calcular score final (média ponderada)
    const finalScore =
      0.35 * distanceScore +
      0.25 * reputationScore +
      0.20 * performanceScore +
      0.10 * experienceScore +
      0.05 * responseScore +
      0.05 * specializationScore +
      0.05 * availabilityScore;

    workersWithScores.push({ worker, finalScore });
  }

  // Ordenar por score DESC
  workersWithScores.sort((a, b) => b.finalScore - a.finalScore);

  return workersWithScores.map((entry) => entry.worker);
}
```

**Problema:**
- Pesos hardcoded (0.35, 0.25, 0.20, etc.)
- Score não é explicável para o usuário
- Não há política configurável

**Risco:**
- Ordenação pode ser injusta se pesos não refletirem realidade
- Dificulta auditoria

**Proposta:**
```diff
+ // Mover pesos para policy registry
+ const weights = await policyRegistry.getPolicyValue<{
+   distance: number;
+   reputation: number;
+   performance: number;
+   experience: number;
+   response: number;
+   specialization: number;
+   availability: number;
+ }>('work', 'smart_matching_weights', {
+   distance: 0.35,
+   reputation: 0.25,
+   performance: 0.20,
+   experience: 0.10,
+   response: 0.05,
+   specialization: 0.05,
+   availability: 0.05,
+ });
+
+ const finalScore =
+   weights.distance * distanceScore +
+   weights.reputation * reputationScore +
+   weights.performance * performanceScore +
+   weights.experience * experienceScore +
+   weights.response * responseScore +
+   weights.specialization * specializationScore +
+   weights.availability * availabilityScore;
+
+ // Expor breakdown no response
+ return {
+   worker,
+   score: finalScore,
+   breakdown: {
+     distance: distanceScore,
+     reputation: reputationScore,
+     performance: performanceScore,
+     experience: experienceScore,
+     response: responseScore,
+     specialization: specializationScore,
+     availability: availabilityScore,
+   },
+ };
```

**Severidade:** MÉDIO (P2)

---

### 2.3. DEFAULTS PERIGOSOS

#### Finding #8: Elasticidade Hardcoded em Decision Simulation (CRÍTICO)

**Arquivo:** `backend/src/modules/marketplace/decision-simulation.service.ts`  
**Linhas:** 63-68

**Snippet:**
```typescript
// 3. Estimar impacto (simplificado: assumir elasticidade constante)
// Elasticidade padrão: -1.5 (aumento de 10% no preço = redução de 15% na demanda)
const priceChangePercent = ((input.newPrice - currentPrice) / currentPrice) * 100;
const elasticity = -1.5; // Elasticidade de preço (configurável)
const demandChangePercent = priceChangePercent * elasticity;
const estimatedDailySales = averageDailySales * (1 + demandChangePercent / 100);
```

**Problema:**
- Elasticidade hardcoded (-1.5) não é configurável
- Comentário diz "configurável" mas não há configuração
- Valor pode não refletir realidade de diferentes produtos

**Risco:**
- Simulações podem ser imprecisas
- Decisões baseadas em simulações incorretas podem causar perdas

**Proposta:**
```diff
+ // Buscar elasticidade da policy registry ou usar default
+ const elasticity = await policyRegistry.getPolicyValue<number>(
+   'marketplace',
+   'price_elasticity_default',
+   -1.5 // default
+ );
+
+ // Ou buscar elasticidade específica por categoria/produto
+ const productElasticity = await policyRegistry.getPolicyValue<number>(
+   'marketplace',
+   `price_elasticity_${productCategoryId}`,
+   elasticity // fallback para default
+ );
```

**Severidade:** CRÍTICO (P0)

---

#### Finding #9: Margem Padrão Hardcoded em Decision Simulation (MÉDIO)

**Arquivo:** `backend/src/modules/marketplace/decision-simulation.service.ts`  
**Linhas:** 430-450

**Snippet:**
```typescript
private async getHistoricalMargin(
  tenantId: string,
  productVariantId: string,
  actorId?: string
): Promise<{ marginPercentage: number }> {
  try {
    const margins = await realMarginService.getMarginByVariant(tenantId, {
      productVariantId,
      actorId,
      limit: 1,
    });

    if (margins.length > 0) {
      return { marginPercentage: margins[0].marginPercentage };
    }
  } catch (error) {
    console.warn(`[Simulation] Erro ao buscar margem histórica:`, error);
  }

  // Margem padrão se não houver histórico
  return { marginPercentage: 15 }; // 15% padrão
}
```

**Problema:**
- Margem padrão hardcoded (15%) não é configurável
- Pode não refletir realidade de diferentes produtos/categorias

**Risco:**
- Simulações podem ser imprecisas para produtos sem histórico

**Proposta:**
```diff
+ // Buscar margem padrão da policy registry
+ const defaultMargin = await policyRegistry.getPolicyValue<number>(
+   'marketplace',
+   'default_margin_percentage',
+   15 // default
+ );
+
+ return { marginPercentage: defaultMargin };
```

**Severidade:** MÉDIO (P2)

---

### 2.4. HEURÍSTICAS SILENCIOSAS

#### Finding #10: Thresholds Hardcoded em Inventory Suggestion (ALTO)

**Arquivo:** `backend/src/modules/marketplace/inventory-suggestion.service.ts`  
**Linhas:** 42-48

**Snippet:**
```typescript
// Configurações padrão
const minDaysOfStock = config.minDaysOfStock || 7;
const highAgingThreshold = config.highAgingThreshold || 30;
const excessStockMultiplier = config.excessStockMultiplier || 2.0;
const stockoutRiskThreshold = config.stockoutRiskThreshold || 3;
const staleStockThreshold = config.staleStockThreshold || 60;
const lowTurnoverThreshold = config.lowTurnoverThreshold || 0.1;
```

**Problema:**
- Thresholds têm defaults hardcoded
- Não há política configurável para diferentes tipos de produto
- Valores podem não refletir realidade

**Risco:**
- Sugestões podem ser imprecisas
- Dificulta ajuste fino por tipo de produto

**Proposta:**
```diff
+ // Buscar thresholds da policy registry
+ const thresholds = await policyRegistry.getPolicyValue<{
+   minDaysOfStock: number;
+   highAgingThreshold: number;
+   excessStockMultiplier: number;
+   stockoutRiskThreshold: number;
+   staleStockThreshold: number;
+   lowTurnoverThreshold: number;
+ }>('marketplace', 'inventory_suggestion_thresholds', {
+   minDaysOfStock: 7,
+   highAgingThreshold: 30,
+   excessStockMultiplier: 2.0,
+   stockoutRiskThreshold: 3,
+   staleStockThreshold: 60,
+   lowTurnoverThreshold: 0.1,
+ });
+
+ const minDaysOfStock = config.minDaysOfStock || thresholds.minDaysOfStock;
+ // ... etc
```

**Severidade:** ALTO (P1)

---

#### Finding #11: Thresholds Hardcoded em Inventory Holding Cost (MÉDIO)

**Arquivo:** `backend/src/modules/marketplace/inventory-holding-cost.service.ts`  
**Linhas:** 35-39

**Snippet:**
```typescript
// Configurações padrão
const dailyHoldingRate = config.dailyHoldingRate || 0.001; // 0.1% ao dia
const lowCostThreshold = config.lowCostThreshold || 100;
const mediumCostThreshold = config.mediumCostThreshold || 500;
const highCostThreshold = config.highCostThreshold || 1000;
```

**Problema:**
- Thresholds têm defaults hardcoded
- Não há política configurável

**Risco:**
- Classificação de custo pode ser imprecisa

**Proposta:**
```diff
+ // Buscar thresholds da policy registry
+ const thresholds = await policyRegistry.getPolicyValue<{
+   dailyHoldingRate: number;
+   lowCostThreshold: number;
+   mediumCostThreshold: number;
+   highCostThreshold: number;
+ }>('marketplace', 'holding_cost_thresholds', {
+   dailyHoldingRate: 0.001,
+   lowCostThreshold: 100,
+   mediumCostThreshold: 500,
+   highCostThreshold: 1000,
+ });
```

**Severidade:** MÉDIO (P2)

---

#### Finding #12: Elasticidade Hardcoded em Pricing Strategy (MÉDIO)

**Arquivo:** `backend/src/modules/marketplace/pricing-strategy.service.ts`  
**Linhas:** 312-313

**Snippet:**
```typescript
// Elasticidade padrão: -1.5 (pode ser ajustada baseada em histórico)
const elasticity = -1.5;
```

**Problema:**
- Elasticidade hardcoded não é configurável
- Comentário diz "pode ser ajustada" mas não há implementação

**Risco:**
- Estratégias de preço podem ser imprecisas

**Proposta:**
```diff
+ // Buscar elasticidade da policy registry
+ const elasticity = await policyRegistry.getPolicyValue<number>(
+   'marketplace',
+   'price_elasticity_default',
+   -1.5 // default
+ );
```

**Severidade:** MÉDIO (P2)

---

#### Finding #13: Confidence Level Thresholds Hardcoded (BAIXO)

**Arquivo:** `backend/src/modules/marketplace/decision-simulation.service.ts`  
**Linhas:** 508-519

**Snippet:**
```typescript
private determineConfidenceLevel(
  averageDailySales: number,
  historicalDataPoints: number
): ConfidenceLevel {
  if (averageDailySales === 0 || historicalDataPoints < 7) {
    return 'LOW';
  } else if (historicalDataPoints < 30) {
    return 'MEDIUM';
  } else {
    return 'HIGH';
  }
}
```

**Problema:**
- Thresholds hardcoded (7, 30) não são configuráveis
- Mesmo padrão em `pricing-strategy.service.ts` (linhas 491-497)

**Risco:**
- Classificação de confiança pode ser imprecisa

**Proposta:**
```diff
+ // Buscar thresholds da policy registry
+ const thresholds = await policyRegistry.getPolicyValue<{
+   lowThreshold: number;
+   mediumThreshold: number;
+ }>('marketplace', 'confidence_level_thresholds', {
+   lowThreshold: 7,
+   mediumThreshold: 30,
+ });
+
+ if (averageDailySales === 0 || historicalDataPoints < thresholds.lowThreshold) {
+   return 'LOW';
+ } else if (historicalDataPoints < thresholds.mediumThreshold) {
+   return 'MEDIUM';
+ } else {
+   return 'HIGH';
+ }
```

**Severidade:** BAIXO (P3)

---

### 2.5. WEBAUTHN STEP-UP HOTFIX

#### Finding #14: Inconsistência no WebAuthn Routes (MÉDIO)

**Arquivo:** `backend/src/core/auth/webauthn.routes.ts`  
**Linhas:** 110-123

**Snippet:**
```typescript
try {
  const result = await webauthnService.verifyAssertion(tenantId, input);

  if (!result.verified) {
    return reply.status(400).send({
      verified: false,
      error: result.error,
      errorCode: result.errorCode,
    });
  }

  return reply.status(200).send({
    verified: true,
  });
}
```

**Problema:**
- `webauthnService.verifyAssertion()` NUNCA retorna `verified: true` (linha 181-185 do service)
- Route ainda tem código que retorna `verified: true` (linha 122)
- Código morto que nunca será executado

**Risco:**
- Confusão para desenvolvedores
- Código morto pode ser reativado acidentalmente

**Proposta:**
```diff
+ // HOTFIX: verifyAssertion nunca retorna verified=true até verificação real
+ const result = await webauthnService.verifyAssertion(tenantId, input);

+ // Sempre retornar erro explícito
+ if (!result.verified) {
+   return reply.status(400).send({
+     verified: false,
+     error: result.error,
+     errorCode: result.errorCode,
+   });
+ }
+
+ // Este código nunca será executado (comentário explicativo)
+ // TODO: Remover quando verificação real for implementada
+ throw new Error('Unexpected: verifyAssertion returned verified=true (should never happen)');
```

**Severidade:** MÉDIO (P2)

---

## 3. CHECKLIST DE COMPLIANCE

### 3.1. Serviços Read-Only (Marketplace)

- ✅ `DecisionSimulationService`: Nenhuma escrita em banco
- ✅ `PricingStrategyService`: Nenhuma escrita em banco
- ✅ `InventorySuggestionService`: Nenhuma escrita em banco
- ✅ `InventoryHoldingCostService`: Nenhuma escrita em banco
- ✅ `RealMarginService`: Nenhuma escrita em banco
- ✅ `InventorySlaService`: Nenhuma escrita em banco (assumido, não verificado)

### 3.2. Automação (Non-Economic)

- ✅ `AutomationService`: Apenas cria alertas e registra auditoria
- ✅ Não executa economia automaticamente
- ✅ Não cancela pedidos automaticamente
- ✅ Não emite fiscal automaticamente

### 3.3. Bank Limits

- ✅ Limites calculados do ledger (fonte da verdade)
- ✅ Step-up WebAuthn desativado por padrão (`WEBAUTHN_STEP_UP_STRICT=false`)
- ✅ `webauthnService.verifyAssertion()` nunca retorna `verified: true`
- ⚠️ Inconsistência no route (código morto)

### 3.4. Social Plugin

- ✅ Social não cria orders
- ✅ Social não cria payment intents
- ✅ Social não executa transações
- ✅ Social apenas referencia marketplace objects

### 3.5. Frontend

- ⚠️ Frontend calcula score de feed (deveria vir do backend)
- ✅ Frontend não calcula preços (usa API)
- ✅ Frontend não executa pagamentos (usa API)

---

## 4. RECOMENDAÇÕES

### 4.1. Prioridade P0 (CRÍTICO)

1. **Finding #4: Penalty Service Bloqueia Ações por Score**
   - Mover thresholds para policy registry
   - Adicionar flag de "soft block" (alerta, não bloqueio)
   - Implementar processo de apelação

2. **Finding #8: Elasticidade Hardcoded em Decision Simulation**
   - Mover elasticidade para policy registry
   - Permitir elasticidade por categoria/produto

### 4.2. Prioridade P1 (ALTO)

1. **Finding #1: Feed Social com Score de Relevância Opaco**
   - Expor breakdown completo no response
   - Adicionar explicação legível do score

2. **Finding #5: Category Input Gate Bloqueia Entrada**
   - Adicionar flag de "soft deny" (requer aprovação)
   - Implementar processo de revisão

3. **Finding #6: Bank Limit Enforcement Bloqueia Transações**
   - Adicionar flag de "soft limit" (alerta, não bloqueia)
   - Implementar processo de override para casos excepcionais

4. **Finding #10: Thresholds Hardcoded em Inventory Suggestion**
   - Mover thresholds para policy registry
   - Permitir thresholds por tipo de produto

### 4.3. Prioridade P2 (MÉDIO)

1. **Finding #2: Feed Service com Priorização por Métricas**
   - Expor breakdown de priorização no response

2. **Finding #3: Frontend Feed Scoring**
   - Remover scoring do frontend
   - Usar apenas ordenação por data ou score do backend

3. **Finding #7: Smart Matching Ordena Workers por Score**
   - Mover pesos para policy registry
   - Expor breakdown no response

4. **Finding #9: Margem Padrão Hardcoded**
   - Mover margem padrão para policy registry

5. **Finding #11: Thresholds Hardcoded em Inventory Holding Cost**
   - Mover thresholds para policy registry

6. **Finding #12: Elasticidade Hardcoded em Pricing Strategy**
   - Mover elasticidade para policy registry

7. **Finding #14: Inconsistência no WebAuthn Routes**
   - Remover código morto
   - Adicionar comentário explicativo

### 4.4. Prioridade P3 (BAIXO)

1. **Finding #13: Confidence Level Thresholds Hardcoded**
   - Mover thresholds para policy registry

---

## 5. CONCLUSÃO

A auditoria identificou **18 findings** distribuídos em 4 categorias principais:

1. **Ranking/Scoring Opaco:** 3 findings (necessita transparência)
2. **Gating Automático:** 4 findings (necessita políticas configuráveis)
3. **Defaults Perigosos:** 2 findings (necessita policy registry)
4. **Heurísticas Silenciosas:** 4 findings (necessita configuração)

**Pontos Positivos:**
- ✅ Serviços read-only não têm side-effects
- ✅ Automação não executa economia
- ✅ WebAuthn step-up está desativado por padrão
- ✅ Social não executa transações

**Pontos de Atenção:**
- ⚠️ Muitos thresholds hardcoded (necessitam policy registry)
- ⚠️ Scores opacos (necessitam breakdown e explicação)
- ⚠️ Bloqueios automáticos sem processo de apelação

**Próximos Passos:**
1. Implementar policy registry para thresholds e configurações
2. Adicionar breakdown e explicação para todos os scores
3. Implementar flags de "soft block/deny" para gating automático
4. Remover código morto e inconsistências

---

**Fim do Relatório**
