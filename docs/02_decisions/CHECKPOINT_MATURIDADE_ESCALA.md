# CHECKPOINT DE MATURIDADE PARA ESCALA

## Status
DECISÃO • CHECKPOINT • INSTITUCIONAL

## Contexto

Este documento registra o resultado da verificação objetiva de aderência às regras canônicas de `context` e `domain` definidas em:
- `/docs/01_normative/REGRA_CANONICA_CRIACAO_DE_CONTEXT.md`
- `/docs/01_normative/REGRA_CANONICA_DOMAIN_METADATA.md`

---

## STATUS GERAL

**APTO_COM_RISCO**

---

## ACHADOS CRÍTICOS

### 1. Fallback silencioso de `domain` em marketplace

- **Local**: `backend/src/modules/marketplace/marketplace-categories.service.ts:44`
- **Violação**: `const domain = filters.marketplaceDomain || 'market';`
- **Tipo**: Fallback silencioso de `domain`
- **Impacto**: Violação da regra canônica que proíbe fallback implícito de `domain`
- **Status**: CRÍTICO

- **Local**: `backend/src/modules/marketplace/marketplace-public.routes.ts:82,94`
- **Violação**: `const targetDomain = req.query.domain || 'market';` e `const marketplaceDomain = c.metadata.marketplace_domain || 'market';`
- **Tipo**: Fallback silencioso de `domain`
- **Impacto**: Violação da regra canônica que proíbe fallback implícito de `domain`
- **Status**: CRÍTICO

---

## ACHADOS ACEITÁVEIS

### 1. Fallback de `context` em marketplace com TRAVA aplicada

- **Local**: `backend/src/modules/marketplace/marketplace-categories.service.ts:32,191`
- **Local**: `backend/src/modules/marketplace/marketplace-public.routes.ts:75`
- **Tipo**: Fallback 'professional' com TRAVA BLOCKED_BY_SCHEMA
- **Status**: ACEITÁVEL (travado, não pode ser replicado)

### 2. Default de `context` em método deprecated com TRAVA

- **Local**: `backend/src/core/categories/categories.service.ts:919`
- **Tipo**: Default `context: CategoryContext = 'professional'` em método deprecated
- **Status**: ACEITÁVEL (travado, método deprecated)

### 3. Default de `context` em validação ocupacional

- **Local**: `backend/src/core/categories/occupation-form-checker.service.ts:152`
- **Tipo**: Default `context: CategoryContext = 'professional'`
- **Status**: ACEITÁVEL (decisão institucional: ACEITAR_RISCO)

### 4. Hardcoded `context` 'hobby' com TRAVA

- **Local**: `backend/src/core/categories/categories.service.ts:2421`
- **Tipo**: Hardcoded 'hobby' com TRAVA aplicada
- **Status**: ACEITÁVEL (travado, não pode ser replicado)

### 5. Travas leves intactas

- **Local**: Todas as travas documentadas em `/docs/03_technical/TRAVA_LEVE_CONTEXT_FALLBACK.md`
- **Status**: INTACTAS (verificadas e presentes no código)

---

## CONFIRMAÇÃO DE ADERÊNCIA

### A) Fallbacks silenciosos de `context`

- **Status**: PARCIALMENTE ADERENTE
- **Observação**: Fallbacks existentes estão travados ou aceitos por decisão institucional. Nenhum novo fallback silencioso foi introduzido.

### B) Usos implícitos de `domain`

- **Status**: NÃO ADERENTE
- **Observação**: Existem fallbacks silenciosos de `domain` em marketplace (`domain || 'market'`) que violam a regra canônica.

### C) Pontos críticos (marketplace, services, profile, events)

- **Marketplace**: Usa fallback 'professional' com TRAVA aplicada (aceitável)
- **Services**: Não verificado (sem endpoints específicos encontrados)
- **Profile**: Não verificado (sem endpoints específicos encontrados)
- **Events**: Não verificado (sem endpoints específicos encontrados)

### D) Travas leves

- **Status**: INTACTAS
- **Observação**: Todas as travas documentadas estão presentes no código e funcionais.

---

**Data de verificação:** 2026-01-22
**Status:** DECISÃO • CHECKPOINT • INSTITUCIONAL



