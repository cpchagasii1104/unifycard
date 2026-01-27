# AUDITORIA CONTEXT — FUGA SEMÂNTICA

## Status
TÉCNICO • AUDITORIA • OBJETIVO

## Contexto

Este documento mapeia todos os pontos onde `context` (CategoryContext) é usado de forma que pode causar fuga semântica no sistema.

---

## BACKEND

### Hardcoded

- Local: `backend/src/core/categories/categories.routes.ts:78`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional'`
- Domínio afetado: categories

- Local: `backend/src/core/categories/categories.routes.ts:157`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional'`
- Domínio afetado: categories

- Local: `backend/src/modules/human-mvp/human-mvp-service-offer.service.ts:62`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional'`
- Domínio afetado: services

- Local: `backend/src/core/categories/categories.service.ts:2332`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional'`
- Domínio afetado: categories

- Local: `backend/src/core/categories/categories.service.ts:2421`
- Tipo de uso: hardcoded
- Valor utilizado: `'hobby'`
- Domínio afetado: categories

- Local: `backend/src/core/categories/categories.service.ts:3036`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional'`
- Domínio afetado: categories

### Fallback

- Local: `backend/src/core/categories/categories.routes.ts:845`
- Tipo de uso: fallback
- Valor utilizado: `req.body.context || 'professional'`
- Domínio afetado: categories

- Local: `backend/src/modules/marketplace/marketplace-categories.service.ts:32`
- Tipo de uso: fallback
- Valor utilizado: `'professional'` (comentário: BLOCKED_BY_SCHEMA)
- Domínio afetado: marketplace

- Local: `backend/src/modules/marketplace/marketplace-categories.service.ts:190`
- Tipo de uso: fallback
- Valor utilizado: `'professional'` (comentário: BLOCKED_BY_SCHEMA)
- Domínio afetado: marketplace

- Local: `backend/src/modules/marketplace/marketplace-public.routes.ts:75`
- Tipo de uso: fallback
- Valor utilizado: `'professional'` (comentário: BLOCKED_BY_SCHEMA)
- Domínio afetado: marketplace

### Default em parâmetro

- Local: `backend/src/core/categories/categories.service.ts:918`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

- Local: `backend/src/core/categories/categories.service.ts:1360`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

- Local: `backend/src/core/categories/occupation-form-checker.service.ts:152`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

### Forçado com as any

- Local: `backend/src/core/categories/categories.service.ts:1760`
- Tipo de uso: forçado
- Valor utilizado: `context: context as CategoryContext`
- Domínio afetado: categories

- Local: `backend/src/core/categories/categories.service.ts:1841`
- Tipo de uso: forçado
- Valor utilizado: `context: context as CategoryContext`
- Domínio afetado: categories

- Local: `backend/src/core/categories/categories.service.ts:1879`
- Tipo de uso: forçado
- Valor utilizado: `context: context as CategoryContext`
- Domínio afetado: categories

---

## FRONTEND

### Hardcoded

- Local: `frontend/src/components/ProfileProfessional.tsx:226`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional' as CategoryContext`
- Domínio afetado: profile

- Local: `frontend/src/components/ProfileProfessional.tsx:331`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional' as CategoryContext`
- Domínio afetado: profile

- Local: `frontend/src/components/ProfileProfessional.tsx:355`
- Tipo de uso: hardcoded
- Valor utilizado: `'professional' as CategoryContext`
- Domínio afetado: profile

- Local: `frontend/src/components/ProfileLearning.tsx:244`
- Tipo de uso: hardcoded
- Valor utilizado: `'learning' as CategoryContext`
- Domínio afetado: profile

- Local: `frontend/src/components/ProfileLearning.tsx:348`
- Tipo de uso: hardcoded
- Valor utilizado: `'learning' as CategoryContext`
- Domínio afetado: profile

- Local: `frontend/src/components/ProfileLearning.tsx:371`
- Tipo de uso: hardcoded
- Valor utilizado: `'learning' as CategoryContext`
- Domínio afetado: profile

### Default em parâmetro

- Local: `frontend/src/api/categories.ts:149`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

- Local: `frontend/src/api/categories.ts:184`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

- Local: `frontend/src/api/categories.ts:346`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

- Local: `frontend/src/api/categories.ts:362`
- Tipo de uso: omitido
- Valor utilizado: `context: CategoryContext = 'professional'`
- Domínio afetado: categories

---

**Data de auditoria:** 2026-01-22  
**Status:** TÉCNICO • AUDITORIA • OBJETIVO



