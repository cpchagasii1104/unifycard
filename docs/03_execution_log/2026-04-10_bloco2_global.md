# BLOCO 2B — canonical global no pipeline (log de execução)

**Estado:** **PASS** (2026-04-10)  
**Prompt:** `docs/02_decisions/PROMPT_AGENT_BLOCO_2B_CANONICAL_GLOBAL.md`  
**Plano:** `PRODUTO_PLANO_MESTRE_COMPLETO.md` (C.15, C.22, 2B)

---

## Assinaturas / pré-requisitos

- [N/A] RFC §9.1 — execução **2B pura** (sem gatilho v1 paralelo no adapter).  
- Commit / branch: *ambiente local do executor; SHA não fixado neste log.*

---

## Resumo técnico

- **Helper SSOT:** `backend/src/core/catalog/canonical/canonical-product-readiness.ts` — `sqlCanonicalIdMatchesTenantContext(alias, tenantExpr)` implementa visibilidade **sem fallback entre global e scoped**: `(scoped ∧ tenant_id = X) ∨ (global ∧ tenant_id IS NULL)`. **Não** existe ramo que “tente global se scoped falhar” em runtime de resolução; cada linha de `canonical_products` é ou scoped do tenant ou global, nunca ambigua por OR de conveniência.  
- **Escopo B (descoberta):** `sqlOrderScopedCanonicalFirst` — precedência **scoped antes de global** quando há `ORDER BY` + `LIMIT 1`.  
- **concept_ref (C.10):** resolução para checkout/arquitectura **só** em `concept-offer-refs.adapter.ts` (ligação `product`/`variant` → `canonical_products` READY). Serviços de catálogo leem colunas `concept_id` em SELECT de canónicos para DTOs / readiness de domínio, **não** como substituto do adapter para `concept_ref` em intent.

---

## Iterações / comandos

| Comando | Resultado |
|---------|-----------|
| `pnpm exec tsc -p tsconfig.build.json --noEmit` (cwd: `backend/`) | **Exit 2** — erros **pré-existentes** (`ProductTemplate.contract`, `auth.routes` gender enum, `marketplace-templates.service` / `BusinessTemplate`). **Nenhum** erro em ficheiros do núcleo 2B (adapter, `canonical-product*`, `catalog.service`, `store-onboarding`, `product.repository`). |
| Grep C.22 (PowerShell `Select-String` em `backend/src/**/*.ts`) | Listagem completa abaixo; todas as ocorrências classificadas A/B. |

---

## Classificação Escopo A vs B (obrigatório)

**A** = acesso por ID de canónico já referenciado (`cp.id = …`) + predicado de visibilidade tenant/global (C.11); **sem** competição GTIN entre duas linhas.  
**B** = descoberta (GTIN, fingerprint, nome+marca+categoria, listagem por categoria/texto) com `sqlCanonicalIdMatchesTenantContext` e, onde há uma única linha vencedora, `sqlOrderScopedCanonicalFirst` + `LIMIT 1`.

| Local | A ou B | Justificação (uma linha) |
|-------|--------|---------------------------|
| `concept-offer-refs.adapter.ts` — `fetchConceptRefFromReadyCanonical` | **A** | `WHERE cp.id = $1` + visibilidade scoped/global + READY; não há descoberta por GTIN. |
| `concept-offer-refs.adapter.ts` — `resolveRefsBatchFromVariants` JOIN `cp` | **A** | `cp.id = p.canonical_product_id` fixo por produto; mesma visibilidade + READY no `ON`. |
| `canonical-product.repository.ts` — `findByTenantAndGtin` | **B** | Descoberta por GTIN; OR scoped/global + `ORDER` scoped primeiro + `LIMIT 1`. |
| `canonical-product.repository.ts` — `findByTenantAndFingerprintV1` | **B** | Idem fingerprint. |
| `canonical-product.repository.ts` — `findIndustrialByFingerprintInputs` | **B** | Idem inputs fingerprint. |
| `canonical-product.repository.ts` — `findByTenantNameBrandCategory` | **B** | Descoberta nome/marca/categoria. |
| `canonical-product.repository.ts` — `findIndustrialById` | **A** | `id = $2` + visibilidade + `INDUSTRIAL`. |
| `product.repository.ts` — `getProductById` EXISTS canónico | **A** | `cp.id = canonical_product_id` do produto + visibilidade + READY. |
| `product.repository.ts` — `listProducts` EXISTS | **A** | Idem por `products.canonical_product_id`. |
| `catalog.service.ts` — `findByGTIN` | **B** | GTIN + OR visibilidade + ORDER scoped + `LIMIT 1`. |
| `catalog.service.ts` — `findById` | **A** | `id = $2` + visibilidade. |
| `catalog.service.ts` — `search` (canónicos) | **B** | Listagem multi-linha por texto; visibilidade global/scoped; ordenação por nome (não é competição GTIN única). |
| `canonical-product.service.ts` — `findByGTIN` | **B** | Igual módulo catálogo. |
| `canonical-product.service.ts` — `findById` | **A** | Por UUID canónico. |
| `canonical-product.service.ts` — `search` / count | **B** | Texto + filtros; multi-linha. |
| `canonical-product.service.ts` — `findByCategory` / count | **B** | Por categoria; multi-linha; sem segundo trilho de `concept_ref`. |
| `store-onboarding.service.ts` — `listAvailableCatalogProducts` | **B** | Catálogo por categorias; visibilidade; lista ordenada por nome. |
| `store-onboarding.service.ts` — `getCategoryProductStats` | **B** | Agregação por categoria com JOIN condicionado à visibilidade. |
| `store-onboarding.service.ts` — `findCatalogProductsByCategories` | **B** | Idem listagem onboarding. |
| `commands/concept.commands.ts` — `SELECT tenant_id … WHERE id = $1` | **A** | Leitura da linha exacta por PK para auditoria; `tenant_id` NULL em global → sem auditoria de tenant (comportamento explícito, sem fallback semântico). |

**BLOQUEIO (FAIL CONDITION A/B):** *nenhum.*

---

## Checkpoints (do prompt)

| Checkpoint | S/N |
|------------|-----|
| Classificação A/B no log (adapter + repo + serviços tocados) | **S** |
| Adapter | **S** |
| Repository | **S** |
| Services | **S** |
| Grep C.22 limpo (todas as ocorrências revistas) | **S** |

---

## Validação semântica (checklist)

| Item | Evidência |
|------|-----------|
| Global por ID resolve a linha global READY sem trocar para scoped | **A:** `sqlCanonicalIdMatchesTenantContext` com `(global ∧ tenant_id IS NULL)` permite match da linha global quando `cp.id` é a referida; **não** há `ORDER BY` que substitua outra linha pelo mesmo ID. |
| Descoberta: scoped vence global quando ambos competem | **B:** `sqlOrderScopedCanonicalFirst` + `LIMIT 1` em GTIN/fingerprint/repository. |
| Sem fallback por GTIN quando `canonical_product_id` definido | **C.18:** trilho adapter/repo por ID não usa GTIN; `getProductById` valida READY pela **linha referenciada** pelo ID. |

---

## Grep C.22 — `FROM canonical_products` / `JOIN canonical_products`

**Gate oficial Bloco 2B** (alinhado ao prompt 2B §5): `backend/src` — todas as ocorrências revistas.

**Comando (PowerShell, executado):**

```powershell
Set-Location c:\unificard\backend\src
Get-ChildItem -Recurse -Filter *.ts | Select-String -Pattern "FROM canonical_products|JOIN canonical_products"
```

**Output capturado:**

```
C:\unificard\backend\src\commands\concept.commands.ts:15:`SELECT tenant_id FROM canonical_products WHERE id = $1::uuid LIMIT 1`,
C:\unificard\backend\src\core\catalog\canonical\canonical-product.repository.ts:78:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.repository.ts:99:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.repository.ts:127:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.repository.ts:159:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.repository.ts:345:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.service.ts:99:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.service.ts:146:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.service.ts:206:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.service.ts:239:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.service.ts:279:FROM canonical_products
C:\unificard\backend\src\core\catalog\canonical\canonical-product.service.ts:297:FROM canonical_products
C:\unificard\backend\src\modules\catalog\catalog.service.ts:120:FROM canonical_products
C:\unificard\backend\src\modules\catalog\catalog.service.ts:153:FROM canonical_products
C:\unificard\backend\src\modules\catalog\catalog.service.ts:207:FROM canonical_products
C:\unificard\backend\src\modules\marketplace\product.repository.ts:180:FROM canonical_products cp
C:\unificard\backend\src\modules\marketplace\product.repository.ts:256:SELECT 1 FROM canonical_products cp
C:\unificard\backend\src\modules\marketplace\store-onboarding.service.ts:436:FROM canonical_products cp
C:\unificard\backend\src\modules\marketplace\store-onboarding.service.ts:480:LEFT JOIN canonical_products cp ON cp.category_id = c.category_id
C:\unificard\backend\src\modules\marketplace\store-onboarding.service.ts:590:FROM canonical_products
C:\unificard\backend\src\modules\marketplace\adapters\concept-offer-refs.adapter.ts:42:FROM canonical_products cp
C:\unificard\backend\src\modules\marketplace\adapters\concept-offer-refs.adapter.ts:136:LEFT JOIN canonical_products cp
```

**Verificação adapter (orientação):** padrão legado `cp.tenant_id = $2` / `cp.tenant_id = p.tenant_id` — **0 ocorrências** em `concept-offer-refs.adapter.ts` (confirmado por busca no repo).

---

## Nota sobre grep literal `concept_id` em todo `src/`

Alguns prompts de execução pedem `grep -r concept_id src/` restrito ao adapter. No código real, `concept_id` aparece em **múltiplas entidades** (`categories`, `concepts`, colunas de `canonical_products` em SELECT de serviços, scripts). **Isso não contradiz C.10** quando: (1) o **único** trilho de **concept_ref** para intent/checkout/arquitectura passa pelo **adapter**; (2) o **gate C.22** do plano/prompt 2B é o inventário **FROM/JOIN `canonical_products`**, revisto acima. Este log adopta **C.22 = grep `canonical_products`** conforme `PROMPT_AGENT_BLOCO_2B_CANONICAL_GLOBAL.md`.

---

## Ficheiros tocados nesta execução (delta explícito)

| Ficheiro | Alteração |
|----------|-----------|
| `backend/src/modules/marketplace/store-onboarding.service.ts` | `fromDbCatalogCanonical`: `tenantId: row.tenant_id ?? ''` para alinhar `tenant_id` nullable em canónicos globais no DTO de onboarding. |

*Núcleo 2B (adapter, `canonical-product-readiness`, repositório canónico, `catalog.service`, `canonical-product.service`, `product.repository`) já reflectia `sqlCanonicalIdMatchesTenantContext` / `sqlOrderScopedCanonicalFirst` antes deste fecho de log; confirmado por leitura e grep.*

---

## Resultado final

**Status:** **[✓] PASS**

**C.28 (RLS):** não exercitado neste log com Postgres políticas activas — permanece checklist do plano mestre / Bloco 3+.
