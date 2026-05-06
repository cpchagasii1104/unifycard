# Fase 4 — remoção do símbolo legado `importProductTemplates`

**Data:** 2026-04-09  

## Objectivo

Zero ocorrências de `importProductTemplates` em `backend/` (grep no repositório).

## Alterações

- Método renomeado para `activateLegacyProductTemplatesForStore` em:
  - `backend/src/modules/marketplace/marketplace-templates.service.ts`
  - `backend/src/modules/marketplace/application/services/catalog-application.service.ts`
  - `backend/src/modules/marketplace/services/marketplace-catalog.service.ts`
- Rota `POST .../import-product-templates` passa a invocar `activateLegacyProductTemplatesForStore` (corpo HTTP inalterado).
- `importCanonicalCatalog` delega ao novo nome interno.
- Relatórios markdown em `backend/src/modules/marketplace/RELATORIO_*.md` alinhados ao novo identificador.

## Trilho canónico preferencial

`storeOnboardingService.createStoreOnboarding` (catálogo universal) — ver `PRODUTO_PLANO_MESTRE_COMPLETO.md` Fase 4.

## Verificação

```bash
rg "importProductTemplates" backend
```

**Resultado esperado:** 0 linhas (confirmado na execução).
