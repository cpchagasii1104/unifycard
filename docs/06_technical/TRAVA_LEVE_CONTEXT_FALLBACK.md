# TRAVAS LEVES — CONTEXT FALLBACK

## Status
TÉCNICO • TRAVA • NORMATIVO

## Contexto

Este documento lista as travas leves aplicadas para impedir novos usos incorretos de `context` com fallback, hardcode ou default, conforme decisão em `/docs/02_decisions/DECISAO_TRATAMENTO_CONTEXT_FUGA.md`.

---

## TRAVAS APLICADAS

### Backend

- **Arquivo**: `backend/src/core/categories/categories.service.ts:2421`
- **Tipo**: Comentário normativo
- **Referência**: context hardcoded 'hobby' em validação de hobby gate
- **Trava**: Comentário "TRAVA: context hardcoded 'hobby' - não criar novos usos hardcoded, context deve ser explícito"

- **Arquivo**: `backend/src/core/categories/categories.service.ts:918`
- **Tipo**: Comentário normativo
- **Referência**: Método deprecated `searchCategories` com default `context: CategoryContext = 'professional'`
- **Trava**: Comentário "TRAVA: context com default 'professional' - não criar novos usos deste método"

- **Arquivo**: `backend/src/modules/marketplace/marketplace-categories.service.ts:32`
- **Tipo**: Comentário normativo
- **Referência**: Fallback 'professional' (BLOCKED_BY_SCHEMA)
- **Trava**: Comentário "TRAVA: BLOCKED_BY_SCHEMA - context obrigatório - usar 'professional' como fallback até definir context específico para marketplace - NÃO criar novos usos deste padrão"

- **Arquivo**: `backend/src/modules/marketplace/marketplace-categories.service.ts:190`
- **Tipo**: Comentário normativo
- **Referência**: Fallback 'professional' (BLOCKED_BY_SCHEMA)
- **Trava**: Comentário "TRAVA: BLOCKED_BY_SCHEMA - context obrigatório - usar 'professional' como fallback até definir context específico para marketplace - NÃO criar novos usos deste padrão"

- **Arquivo**: `backend/src/modules/marketplace/marketplace-public.routes.ts:75`
- **Tipo**: Comentário normativo
- **Referência**: Fallback 'professional' (BLOCKED_BY_SCHEMA)
- **Trava**: Comentário "TRAVA: BLOCKED_BY_SCHEMA - context obrigatório - usar 'professional' como fallback até definir context específico para marketplace - NÃO criar novos usos deste padrão"

---

**Data de criação:** 2026-01-22
**Status:** TÉCNICO • TRAVA • NORMATIVO



