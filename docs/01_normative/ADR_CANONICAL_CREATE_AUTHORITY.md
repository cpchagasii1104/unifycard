# ADR — Autoridade para criação de `canonical_products`

**Data:** 2026-04-13  
**Status:** ATIVO

## Contexto

§5.1 do `PLANO_FASE_ATUAL.md` exige decisão explícita mapeada ao sistema de autoridade existente, sem modelo paralelo.

## Decisão

1. **Criação de `canonical_products` INDUSTRIAL via onboarding de loja** (`POST /marketplace/store-onboarding`):  
   - Requer permissão **`MARKETPLACE_STORE_CREATE`**, aplicada no `preHandler` da rota.  
   - O actor da loja e o tenant são os contextos operacionais; canónicos criados ou reutilizados seguem o fluxo já implementado em `store-onboarding.service.ts`.

2. **Criação direta via API pública dedicada a `canonical_products`**:  
   - **Não existe** rota HTTP pública atual que exponha insert directo de canónico fora do onboarding.  
   - Quando existir, deverá exigir a chave **`canonical_products:create`** (declarada em `MAPA_CANONICO_PERMISSIONS_v1.md` e `permission-keys.ts`) e papéis adicionais definidos por produto.

3. **Perfis normativos §5.1 (indústria / distribuidor autorizado vs marketplace comum)**:  
   - Distinção fina entre indústria e distribuidor autorizado é **decisão de produto** (papéis / `company_types` / convites).  
   - Até essa especificação: **`MARKETPLACE_STORE_CREATE` + onboarding** é o **gate de entrada** canónico para criação de canónicos no trilho marketplace.

## Consequências

- Não se introduz coluna ad-hoc tipo `tenants.can_create_canonical` sem revisão deste ADR.  
- Evoluções de API directa devem referenciar este documento e o mapa de permissões.

## Referências

- `PLANO_FASE_ATUAL.md` §5.1  
- `MAPA_CANONICO_PERMISSIONS_v1.md` — secção `canonical_products:create`  
- `backend/src/core/authorization/permission-keys.ts`

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- MAPA_CANONICO_PERMISSIONS_v1.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->