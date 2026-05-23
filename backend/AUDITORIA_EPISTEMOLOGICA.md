# Auditoria Epistemológica do Sistema Unificard

**Data**: 2026-05-07
**Branch**: rescue-structural
**Propósito**: Separar evidência material de inferência arquitetural

---

## Metodologia

Esta auditoria usa o framework de **tipagem epistemológica**, que classifica estruturas do sistema em:

1. **Evidência material** - código executável, implementado
2. **Runtime skeleton** - código implementado mas apenas stub/logging
3. **Axioma arquitetural** - conceito definido mas sem implementação unificada
4. **Roadmap implícito** - comentários indicando futuras implementações
5. **Lore fantasma** - conceitos que soam coerentes mas não existem

---

## 1. GATES - Inventário Epistêmico

### ✅ Runtime Real (Implementados e Executáveis)

#### 1.1. CategoryInputGateService
- **Arquivo**: `src/core/categories/category-input-gate.service.ts`
- **Tipo**: Classe implementada com lógica completa
- **Métodos**: `validate()` com 4 etapas (lexical, form check, hobby gate, CBO match)
- **Performance**: <60ms
- **Integrações**:
  - categoryLexicalGateService
  - occupationFormCheckerService
  - cboMatcherService
  - categoryInputAuditService
  - hobbyVerbHeuristicService
  - hobbyMatcherService
- **Testes**: `tests/integration/hobby-gate.test.ts`
- **STATUS**: ✅ RUNTIME REAL

#### 1.2. CategoryLexicalGateService
- **Arquivo**: `src/core/categories/category-lexical-gate.service.ts`
- **Tipo**: Classe implementada
- **Métodos**: `validate()` (blacklist/whitelist lexical)
- **Performance**: 0-2ms
- **Lógica**: Match exato de palavras completas, nunca substring
- **STATUS**: ✅ RUNTIME REAL

#### 1.3. PlanGateService
- **Arquivo**: `src/core/plan/plan-gate.service.ts`
- **Tipo**: Classe implementada
- **Métodos**:
  - `getUserPlan()` - query SQL real
  - `canUseVoice()`
  - `canUseFullAI()`
  - `getPlanFeatures()`
  - `validateFeatureAccess()`
- **Regras**: free/pro/enterprise
- **STATUS**: ✅ RUNTIME REAL

#### 1.4. HobbyGate (Composite)
- **Evidência**: Testes de integração completos
- **Componentes**:
  - HobbyVerbHeuristicService
  - HobbyMatcherService (exact + fuzzy)
  - HobbyRateLimitService
- **STATUS**: ✅ RUNTIME REAL

### 📊 Estatísticas de Gates

- **Total de arquivos com "gate"**: 78
- **Gates implementados auditados**: 4
- **Gates em guards financeiros**: ~10 (financial-rate-limit-guard, etc)
- **Testes de integração**: 3 arquivos (hobby-gate, category-input-gate, category-navigation-vs-search)

---

## 2. ENGINES - Inventário Epistêmico

### ✅ Runtime Real (Implementados e Executáveis)

#### 2.1. PolicyResolutionEngine
- **Arquivo**: `src/core/policy-resolution/policy-resolution-engine.ts`
- **Tipo**: Classe implementada
- **Métodos**:
  - `resolvePolicy()` - ajustes dinâmicos por contexto
  - `calculateRegionAdjustment()`
  - `calculateModuleAdjustment()` ⚠️ TEMPORARY_HEURISTIC
  - `calculateDemandAdjustment()`
  - `calculateSupplyAdjustment()`
  - `calculateGrowthAdjustment()` ⚠️ TEMPORARY_HEURISTIC
- **Integrações**:
  - policyRegistry
  - decisionLogService
- **Notas**:
  - Ajustes heurísticos temporários marcados para substituição
  - Modo read-only - não altera políticas originais
- **STATUS**: ✅ RUNTIME REAL (com heurísticas temporárias)

#### 2.2. AIEngine
- **Arquivo**: `src/core/ai/ai-engine.ts`
- **Tipo**: Classe implementada
- **Métodos**:
  - `think()` - processa prompts internos
- **Detecção de região**: user_residence → tenant.region → root-config
- **Integrações**:
  - tenantService
  - worldService
  - identityService
  - residenceService
  - rootConfigService
- **STATUS**: ✅ RUNTIME REAL

#### 2.3. BankSplitEngineService
- **Arquivo**: `src/modules/bank/bank-split-engine.service.ts`
- **Tipo**: Classe implementada
- **Métodos**:
  - `getSplitConfig()` - usa Policy Registry com fallback hardcoded
  - Split rules para múltiplos contextos (service_booking, event_ticket, ride_payment, p2p_transfer)
- **Integrações**:
  - bankAccountService
  - bankPolicyService
  - userGroupAllocationRepository
- **STATUS**: ✅ RUNTIME REAL

#### 2.4. SimulationEngine
- **Arquivo**: `src/core/simulation/simulation-engine.ts`
- **Tipo**: Classe implementada (função pura e determinística)
- **Métodos**:
  - `simulateRegionalSplit()` - calcula cenários alternativos
- **Integrações**:
  - policyRegistry
  - policyResolutionEngine
  - decisionLogService
- **STATUS**: ✅ RUNTIME REAL

#### 2.5. TrustEngineService
- **Arquivo**: `src/modules/trust/trust-engine.service.ts`
- **Tipo**: Classe implementada
- **Blindagem institucional**:
  - "Scores são apenas informativos (observacionais)"
  - "Nenhum score editável manualmente"
  - "Nenhuma decisão sem evidência"
  - "Regras determinísticas, sem IA opinativa"
- **Métodos**:
  - `calculateRiskLevel()` - baseado em score
- **Mapas**:
  - SCORE_IMPACT_MAP (26 tipos de eventos)
  - EVENT_SEVERITY_MAP (LOW/MEDIUM/HIGH)
- **STATUS**: ✅ RUNTIME REAL (observacional, não decisório)

#### 2.6. ReconciliationEngine
- **Arquivos**:
  - `src/modules/reconciliation/reconciliation-engine.service.ts`
  - `src/workers/reconciliation-engine-worker.ts`
- **STATUS**: ✅ RUNTIME REAL (não auditado em detalhe)

#### 2.7. RiskScoringEngine
- **Arquivo**: `src/core/reporting/ai/RiskScoringEngine.ts`
- **STATUS**: ✅ RUNTIME REAL (não auditado em detalhe)

### 📊 Estatísticas de Engines

- **Total de arquivos com "engine"**: 87
- **Engines implementados auditados**: 7
- **Engines com TEMPORARY_HEURISTIC**: 2 (PolicyResolution, ProductDemand)

---

## 3. ORCHESTRATORS E PIPELINES - Inventário Epistêmico

### ⚠️ Runtime Skeleton (Stub/Logging)

#### 3.1. CanonicalOrchestratorService
- **Arquivo**: `src/core/orchestrator/canonical-orchestrator.service.ts`
- **Tipo**: Classe implementada (apenas logging)
- **Métodos**:
  - `receiveEvent()` - apenas console.log estruturado
- **Comentário crítico**:
  ```typescript
  // Por enquanto, apenas logar
  // Futuramente: IA, Capital, Governança podem ser ativados aqui
  // sem alterar módulos existentes
  ```
- **STATUS**: ⚠️ RUNTIME SKELETON + 🔮 ROADMAP IMPLÍCITO
- **Lore detectado**: "IA, Capital, Governança" mencionados mas não implementados

### ✅ Runtime Real (Implementados e Executáveis)

#### 3.2. canonical-product-creation.pipeline
- **Arquivo**: `src/core/catalog/canonical/canonical-product-creation.pipeline.ts`
- **Tipo**: Função pura implementada
- **Métodos**:
  - `getOrCreateIndustrialWithDeps()`
- **Lógica**:
  1. GTIN lookup
  2. Match nome + marca + categoria
  3. INSERT INDUSTRIAL
  4. Hooks opcionais (onIndustrialCreatedUnresolved)
- **STATUS**: ✅ RUNTIME REAL

#### 3.3. Event Creation Orchestrator
- **Arquivo**: `src/core/events/event-creation.orchestrator.ts`
- **STATUS**: ✅ RUNTIME REAL (não auditado em detalhe)

#### 3.4. Intent Orchestrator
- **Arquivo**: `src/modules/social/intent-orchestrator.service.ts`
- **STATUS**: ✅ RUNTIME REAL (não auditado em detalhe)

### 📊 Estatísticas de Orchestrators

- **Total de arquivos com "orchestrat"**: 59
- **Orchestrators auditados**: 4
- **Orchestrators em skeleton mode**: 1 (Canonical)

---

## 4. ROADMAP IMPLÍCITO - Mapeamento de "Futuramente"

### 4.1. Comentários "Por enquanto" (Stubs Temporários)

#### Localização: `src/core`

| Arquivo | Linha | Comentário | Status |
|---------|-------|------------|--------|
| `webauthn.service.ts` | 10, 119, 159, 178 | "Por enquanto, apenas verifica" / "TODO: Validar assinatura criptográfica" | STUB |
| `audit.service.ts` | 131 | "Por enquanto, apenas log estruturado" | STUB |
| `alert.service.ts` | 83-84 | "TODO: Implementar envio de email. Por enquanto, apenas loga" | STUB |
| `dashboard/daily-metrics.service.ts` | 119, 160 | "Por enquanto, retorna 100% (placeholder)" / "precisa integrar com Stripe" | MOCK |
| `feed/feed.service.ts` | 111, 123, 225 | "Por enquanto, sempre false" / "conteúdo mockado" / "retorna vazio" | MOCK |
| `checkout/CheckoutService.ts` | 48, 98, 117, 121, 130 | "TODO: Integrar com serviço real de UnifyCard" / "Por enquanto, retorna sucesso (mock)" | MOCK |
| `orchestrator/canonical-orchestrator.service.ts` | 28-30 | "Futuramente: IA, Capital, Governança podem ser ativados aqui" | ROADMAP IMPLÍCITO |

### 4.2. TEMPORARY_HEURISTIC (Código Provisório)

| Arquivo | Contexto | Nota |
|---------|----------|------|
| `policy-resolution-engine.ts` | `calculateModuleAdjustment()` | Multiplicadores por módulo são heurísticas temporárias |
| `policy-resolution-engine.ts` | `calculateGrowthAdjustment()` | Variação de crescimento fixa (5%) será substituída por dados reais |
| `product-demand.service.ts` | Normalizações e thresholds | Valores fixos serão substituídos por dados de demanda real |

### 4.3. Padrão "TODO FASE X"

| Arquivo | Fase | Descrição |
|---------|------|-----------|
| `event.service.ts` | FASE 2 | "Validação de economia quando necessário" |
| `event.service.ts` | FASE 3 | "Integração read-only com Agenda Universal" (2 ocorrências) |

---

## 5. LORE FANTASMA - Conceitos Sem Evidência Material

### 5.1. "IA, Capital, Governança" (Mencionados no Canonical Orchestrator)

**Evidência de menção**: `src/core/orchestrator/canonical-orchestrator.service.ts:29`

```typescript
// Futuramente: IA, Capital, Governança podem ser ativados aqui
// sem alterar módulos existentes
```

**Auditoria**:
- ✅ **IA**: AIEngine existe (`src/core/ai/ai-engine.ts`)
- ❓ **Capital**: Nenhum arquivo com "capital.*engine" ou "capital.*layer" encontrado
- ❓ **Governança**: Nenhum arquivo com "governance.*engine" ou "governance.*layer" encontrado

**Classificação**:
- IA: ✅ Runtime real (mas não integrado ao orchestrator)
- Capital: 🔮 Lore fantasma (conceito mencionado, implementação ausente)
- Governança: 🔮 Lore fantasma (conceito mencionado, implementação ausente)

### 5.2. "Trust Pipeline"

**Busca**: `trust.*pipeline`
**Resultado**: 12 arquivos mencionam "trust", mas nenhum arquivo com "trust pipeline" encontrado

**Evidência material**:
- ✅ TrustEngineService existe
- ✅ trustRepository existe
- ✅ trust.routes existe
- ❌ "Trust pipeline" como estrutura unificada: **não encontrado**

**Classificação**:
- Trust Engine: ✅ Runtime real
- "Trust Pipeline": 🔮 Lore fantasma ou ⚙️ Semântica distribuída (conceito emerge do fluxo, não existe como classe/módulo)

### 5.3. "Payment Pipeline"

**Evidência de uso**: Mencionado em comentários como conceito de fluxo

**Auditoria**:
- ❌ Nenhum arquivo `payment-pipeline.ts` encontrado
- ✅ Existem múltiplos serviços de pagamento (pix.service, payment-link.service, etc)

**Classificação**: ⚙️ **Semântica distribuída** (conceito emerge da composição de serviços, não existe como artefato único)

### 5.4. "Auth Pipeline"

**Evidência**: Mencionado em webauthn e auth.service

**Auditoria**:
- ❌ Nenhum arquivo `auth-pipeline.ts` encontrado
- ✅ auth.service existe
- ✅ webauthn.service existe

**Classificação**: ⚙️ **Semântica distribuída**

---

## 6. SEDIMENTAÇÃO HISTÓRICA vs CONSOLIDAÇÃO ARQUITETURAL

### 6.1. Branch `rescue-structural` - O Que É Real?

**Evidência material** (git status):
- Remoções de código morto: `fund/`, `catalog-payment.service.ts`, `EventOrganizerResolver.ts`, etc
- Refatorações em economy/distribution
- Commits sobre "checkpoint append-only" e "sessão fechada"

**Inferência arquitetural** (minha análise anterior):
> "Isso sugere que você está em meio a uma consolidação arquitetural profunda."

**Classificação epistêmica**:
- ✅ **Evidência**: Código morto removido, arquivos modificados
- ⚠️ **Inferência**: "Consolidação arquitetural profunda" é interpretação do padrão observado
- ❓ **Intent real**: Precisa ser confirmado pelo humano

**Fenômeno detectado**:
- Padrão observado → Narrativa sistêmica coerente
- Risco: **Teleologia retroativa** (assumir que padrões maduros foram planejados)

---

## 7. FENÔMENOS EPISTÊMICOS DETECTADOS

### 7.1. Pattern Completion (Completar Lacunas)

**Exemplo detectado**:
- Vejo: "CanonicalOrchestrator" + comentário "Futuramente: IA, Capital, Governança"
- Inferência automática: "Existe uma camada de governança arquitetural planejada"
- Realidade: Apenas AIEngine existe; Capital e Governança são lore

**Risco**: Criar roadmap fantasma a partir de comentários isolados

### 7.2. Lore-Driven Architecture

**Exemplo detectado**:
- "Trust pipeline" soa coerente
- Mas não existe como artefato material
- Emerge da composição de TrustEngine + trustRepository + trust.routes

**Risco**: Confundir semântica distribuída com estrutura centralizada

### 7.3. Heurísticas Temporárias Tornando-se Permanentes

**Exemplo detectado**:
- PolicyResolutionEngine tem `TEMPORARY_HEURISTIC` em 2 métodos
- Comentário: "Futuramente será substituída por dados reais"
- Risco: Heurística temporária vira "fonte da verdade" por inércia

### 7.4. Stubs Permanentes

**Exemplo detectado**:
- CanonicalOrchestrator: "Por enquanto, apenas logar"
- AlertService: "TODO: Implementar envio de email. Por enquanto, apenas loga"
- CheckoutService: "Por enquanto, retorna sucesso (mock)"

**Risco**: "Por enquanto" vira produção silenciosamente

---

## 8. TABELA EPISTÊMICA CONSOLIDADA

| Conceito | Tipo | Evidência | Status |
|----------|------|-----------|--------|
| **CategoryInputGate** | Gate | `category-input-gate.service.ts` | ✅ Runtime Real |
| **CategoryLexicalGate** | Gate | `category-lexical-gate.service.ts` | ✅ Runtime Real |
| **PlanGate** | Gate | `plan-gate.service.ts` | ✅ Runtime Real |
| **HobbyGate** | Gate | Composite (3 services) | ✅ Runtime Real |
| **PolicyResolutionEngine** | Engine | `policy-resolution-engine.ts` | ✅ Runtime Real (+ heurísticas temporárias) |
| **AIEngine** | Engine | `ai-engine.ts` | ✅ Runtime Real |
| **BankSplitEngine** | Engine | `bank-split-engine.service.ts` | ✅ Runtime Real |
| **SimulationEngine** | Engine | `simulation-engine.ts` | ✅ Runtime Real |
| **TrustEngine** | Engine | `trust-engine.service.ts` | ✅ Runtime Real (observacional) |
| **ReconciliationEngine** | Engine | `reconciliation-engine.service.ts` | ✅ Runtime Real |
| **RiskScoringEngine** | Engine | `RiskScoringEngine.ts` | ✅ Runtime Real |
| **CanonicalOrchestrator** | Orchestrator | `canonical-orchestrator.service.ts` | ⚠️ Runtime Skeleton (stub) |
| **CanonicalProductCreationPipeline** | Pipeline | `canonical-product-creation.pipeline.ts` | ✅ Runtime Real |
| **EventCreationOrchestrator** | Orchestrator | `event-creation.orchestrator.ts` | ✅ Runtime Real |
| **IntentOrchestrator** | Orchestrator | `intent-orchestrator.service.ts` | ✅ Runtime Real |
| **Capital Layer** | Conceito | Comentário em orchestrator | 🔮 Lore Fantasma |
| **Governança Layer** | Conceito | Comentário em orchestrator | 🔮 Lore Fantasma |
| **Trust Pipeline** | Conceito | Emerge de TrustEngine + repo + routes | ⚙️ Semântica Distribuída |
| **Payment Pipeline** | Conceito | Emerge de múltiplos serviços | ⚙️ Semântica Distribuída |
| **Auth Pipeline** | Conceito | Emerge de auth + webauthn services | ⚙️ Semântica Distribuída |
| **Consolidação Arquitetural Profunda** | Inferência | Branch rescue-structural | ⚠️ Interpretação de Padrão |

---

## 9. RECOMENDAÇÕES OPERACIONAIS

### 9.1. Para Conversas com IA

1. **Sempre exigir tipagem epistemológica**:
   - "Isso existe como arquivo?" → Evidência material
   - "Isso emerge do fluxo?" → Semântica distribuída
   - "Isso está em comentário?" → Roadmap implícito

2. **Bloquear pattern completion**:
   - Não assumir que "IA, Capital, Governança" existem porque soam coerentes
   - Sempre pedir evidência de arquivo/classe/método

3. **Auditar "Por enquanto" periodicamente**:
   - Stubs podem virar produção silenciosamente
   - "TODO" sem issue tracker vira dívida técnica invisível

### 9.2. Para Governança de Código

1. **Marcar heurísticas temporárias com prazo**:
   ```typescript
   // TEMPORARY_HEURISTIC (até SPRINT 40 ou integração com dados reais)
   ```

2. **Documentar semântica distribuída explicitamente**:
   ```typescript
   /**
    * CONCEITO: Trust Pipeline
    * TIPO: Semântica distribuída
    * EMERGE DE: TrustEngine + trustRepository + trust.routes
    * NÃO É: Uma classe/módulo centralizado
    */
   ```

3. **Criar registro de lore fantasma**:
   - Documentar conceitos mencionados mas não implementados
   - Decidir: implementar ou remover menção

---

## 10. CONCLUSÃO

### O Que É Real (Evidência Material)

- **Gates**: 4 implementados (Category Input, Lexical, Plan, Hobby)
- **Engines**: 7 implementados (Policy, AI, BankSplit, Simulation, Trust, Reconciliation, RiskScoring)
- **Orchestrators**: 3 reais + 1 skeleton (Event Creation, Intent, CanonicalProduct Pipeline + Canonical Orchestrator stub)
- **Total de arquivos TypeScript**: 1.692
- **Total de arquivos auditados**: ~30

### O Que É Inferência/Lore

- **Capital Layer**: Mencionado, não implementado
- **Governança Layer**: Mencionado, não implementado
- **Trust Pipeline**: Semântica distribuída (não artefato)
- **Payment Pipeline**: Semântica distribuída (não artefato)
- **Consolidação arquitetural profunda**: Interpretação de padrão (precisa confirmação humana)

### Fenômeno Central Detectado

**O sistema possui uma arquitetura híbrida**:
- ✅ Estruturas materiais (gates, engines)
- ⚙️ Semântica distribuída (pipelines emergentes)
- 🔮 Lore aspiracional (Capital, Governança)
- ⚠️ Stubs temporários (orchestrator, alerts, checkout)

**Risco primário**: Confundir sedimentação histórica com design intencional.

**Contramédica epistêmica**: Sempre rotular tipo de conhecimento (evidência, inferência, projeção, fantasia).

---

**Auditado por**: Claude Sonnet 4.5
**Aprovado por**: [Pendente]
**Próxima auditoria**: [A definir]
