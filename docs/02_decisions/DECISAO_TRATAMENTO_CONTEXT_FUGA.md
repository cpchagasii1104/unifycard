# DECISÃO DE TRATAMENTO — FUGA SEMÂNTICA DE CONTEXT

## Status
DECISÃO INSTITUCIONAL • VINCULANTE

## Contexto

Este documento fixa a estratégia institucional de tratamento para cada item identificado em `AUDITORIA_CONTEXT_FUGA_SEMANTICA.md` e classificado em `CLASSIFICACAO_RISCO_CONTEXT_FUGA.md`.

---

## BACKEND

### Hardcoded

- Referência: Local: `backend/src/core/categories/categories.routes.ts:78` | Tipo de uso: hardcoded | Valor utilizado: `'professional'` | Domínio afetado: categories
- Nível de risco: CRITICO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/core/categories/categories.routes.ts:157` | Tipo de uso: hardcoded | Valor utilizado: `'professional'` | Domínio afetado: categories
- Nível de risco: CRITICO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/modules/human-mvp/human-mvp-service-offer.service.ts:62` | Tipo de uso: hardcoded | Valor utilizado: `'professional'` | Domínio afetado: services
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/core/categories/categories.service.ts:2332` | Tipo de uso: hardcoded | Valor utilizado: `'professional'` | Domínio afetado: categories
- Nível de risco: CRITICO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/core/categories/categories.service.ts:2421` | Tipo de uso: hardcoded | Valor utilizado: `'hobby'` | Domínio afetado: categories
- Nível de risco: MEDIO
- Ação decidida: TRAVAR

- Referência: Local: `backend/src/core/categories/categories.service.ts:3036` | Tipo de uso: hardcoded | Valor utilizado: `'professional'` | Domínio afetado: categories
- Nível de risco: MEDIO
- Ação decidida: ACEITAR_RISCO

### Fallback

- Referência: Local: `backend/src/core/categories/categories.routes.ts:845` | Tipo de uso: fallback | Valor utilizado: `req.body.context || 'professional'` | Domínio afetado: categories
- Nível de risco: CRITICO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/modules/marketplace/marketplace-categories.service.ts:32` | Tipo de uso: fallback | Valor utilizado: `'professional'` (comentário: BLOCKED_BY_SCHEMA) | Domínio afetado: marketplace
- Nível de risco: ALTO
- Ação decidida: TRAVAR

- Referência: Local: `backend/src/modules/marketplace/marketplace-categories.service.ts:190` | Tipo de uso: fallback | Valor utilizado: `'professional'` (comentário: BLOCKED_BY_SCHEMA) | Domínio afetado: marketplace
- Nível de risco: ALTO
- Ação decidida: TRAVAR

- Referência: Local: `backend/src/modules/marketplace/marketplace-public.routes.ts:75` | Tipo de uso: fallback | Valor utilizado: `'professional'` (comentário: BLOCKED_BY_SCHEMA) | Domínio afetado: marketplace
- Nível de risco: ALTO
- Ação decidida: TRAVAR

### Default em parâmetro

- Referência: Local: `backend/src/core/categories/categories.service.ts:918` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: MEDIO
- Ação decidida: TRAVAR

- Referência: Local: `backend/src/core/categories/categories.service.ts:1360` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: CRITICO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/core/categories/occupation-form-checker.service.ts:152` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: MEDIO
- Ação decidida: ACEITAR_RISCO

### Forçado com as any

- Referência: Local: `backend/src/core/categories/categories.service.ts:1760` | Tipo de uso: forçado | Valor utilizado: `context: context as CategoryContext` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/core/categories/categories.service.ts:1841` | Tipo de uso: forçado | Valor utilizado: `context: context as CategoryContext` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `backend/src/core/categories/categories.service.ts:1879` | Tipo de uso: forçado | Valor utilizado: `context: context as CategoryContext` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

---

## FRONTEND

### Hardcoded

- Referência: Local: `frontend/src/components/ProfileProfessional.tsx:226` | Tipo de uso: hardcoded | Valor utilizado: `'professional' as CategoryContext` | Domínio afetado: profile
- Nível de risco: BAIXO
- Ação decidida: ACEITAR_RISCO

- Referência: Local: `frontend/src/components/ProfileProfessional.tsx:331` | Tipo de uso: hardcoded | Valor utilizado: `'professional' as CategoryContext` | Domínio afetado: profile
- Nível de risco: BAIXO
- Ação decidida: ACEITAR_RISCO

- Referência: Local: `frontend/src/components/ProfileProfessional.tsx:355` | Tipo de uso: hardcoded | Valor utilizado: `'professional' as CategoryContext` | Domínio afetado: profile
- Nível de risco: BAIXO
- Ação decidida: ACEITAR_RISCO

- Referência: Local: `frontend/src/components/ProfileLearning.tsx:244` | Tipo de uso: hardcoded | Valor utilizado: `'learning' as CategoryContext` | Domínio afetado: profile
- Nível de risco: BAIXO
- Ação decidida: ACEITAR_RISCO

- Referência: Local: `frontend/src/components/ProfileLearning.tsx:348` | Tipo de uso: hardcoded | Valor utilizado: `'learning' as CategoryContext` | Domínio afetado: profile
- Nível de risco: BAIXO
- Ação decidida: ACEITAR_RISCO

- Referência: Local: `frontend/src/components/ProfileLearning.tsx:371` | Tipo de uso: hardcoded | Valor utilizado: `'learning' as CategoryContext` | Domínio afetado: profile
- Nível de risco: BAIXO
- Ação decidida: ACEITAR_RISCO

### Default em parâmetro

- Referência: Local: `frontend/src/api/categories.ts:149` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `frontend/src/api/categories.ts:184` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `frontend/src/api/categories.ts:346` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

- Referência: Local: `frontend/src/api/categories.ts:362` | Tipo de uso: omitido | Valor utilizado: `context: CategoryContext = 'professional'` | Domínio afetado: categories
- Nível de risco: ALTO
- Ação decidida: CORRIGIR_AGORA

---

**Data de decisão:** 2026-01-22  
**Status:** DECISÃO INSTITUCIONAL • VINCULANTE



