# Execution Log — F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE

**Data:** 2026-06-11
**Frente:** F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE (macrofrente integrada, GO único de 6 checkpoints)
**HEAD origem:** `d865a04d` / **Branch:** rescue-structural
**Modo:** DOCS (DECISION) + MIGRATION + BACKEND + FRONTEND + E2E + GATE
**Governado por:** GO integrado da IA Diretora (ratificação de produto: Clayton) → **DECISION-0117** (promulgada ANTES do runtime)

## Commits

| Commit | CP | Conteúdo | Prova |
|---|---|---|---|
| `a664eeb0` | 0 | DECISION-0117 (decisões A–H; reancoragem honesta do contrato órfão C.1–C.34) | docs-only |
| `9ab5233c` | CP1 | Fundação canônica: migration `20260611150000` (canonical_units ×11 · canonical_variants · canonical_services · canonical_catalog_events append-only · duplicate_of · services.canonical_service_id · concepts seed); sugestão empresarial → fila → curadoria humana admin; LOCAL scoped; marca normalizada no pipeline; merge redirect; writer de services exige canônico ATIVO | e2e efêmero **35/35** |
| `e551e581` | CP2 | Mídia content-addressed: migration `20260611160000` (media_assets sha-256 UNIQUE · relações canônicas · business_media); pipeline MIME→magic→scan→storage opaco→INSERT c/ compensação (molde DECISION-0112) | e2e efêmero **20/20** |
| `d44ceade` | CP3 | Templates versionados: migration `20260611170000` (business_templates/versions imutáveis por REFERÊNCIA · company_template_applications auditáveis · seeds distribuidora-de-bebidas + 3 templates); aplicação manual-assistida idempotente; personalização sem tocar template; v2 não reescreve | e2e efêmero **15/15** |
| `70d3df6b` | CP4 | Ofertas: migration `20260611180000` (offers variant-aware c/ internal_sku/sale_unit/min_quantity/conditions/fulfillment/status · activations c/ variante · ponte product_variants.canonical_variant_id · service_offerings); products/visible MERCHANT-scoped + unidade consistente + KYB/publicação no reader (**DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION CLOSED**); Unified Availability p/ ofertas de serviço | e2e efêmero **16/16** |
| `2bc06e73` | CP5 | Menu/discovery: module-registry governado + `GET /navigation/modules` (projeção por contexto/template/KYB; STUB/TOMBSTONE fora) + GlobalSidebar consome projeção (NAV_GROUPS/PILOT_HIDDEN absorvidos) + busca `/marketplace/catalog/items/*` agrupada 1-item→N-ofertas (preço POR unidade) | e2e efêmero **13/13** |
| (commit F) | CP6 | E2E INTEGRADO `validate-pipeline-e2e-canonical-catalog-templates-offering.ts` + gate `audit-canonical-catalog-closure.mjs` no `validate:regression-guards` + provas negativas + matriz completa + cartório | integrado **21/21**; gate 61/5/0/0/0; provas negativas **8/8** |

## CP6 — provas

- **E2E integrado 21/21** (efêmero): 3 empresas por nascimento REAL (supermercado/distribuidora/salão, CNPJs distintos, page actors distintos, KYB controlado por admin humano); templates distintos aplicados sem efeito comercial (I2); Coca-Cola Original 1L retornável = 1 concept + 1 canônico + 1 variante + 1 mídia (reenvio por B reutiliza blob — I4); A e B na MESMA variante com SKUs/preços/estoques próprios (I5/I6/I9); busca 1 item → 2 ofertas, preço mínimo POR unidade (I7/I8); isolamento cross-merchant 403 + banco imutável (I10); serviço: 1 canônico → 2 prestadores, preços/durações próprios, agendas na Unified Availability, ZERO schedules paralelos (I11–I13); menus por contexto + menu não concede autoridade (I14–I16); revogação KYB de A retira SÓ as superfícies públicas de A — canônico, mídia e oferta de B permanecem (I17); suspensão de oferta de serviço retira só ela (I18); kg+un fail-closed (I19); snapshots bank_ledger/bank_transactions/bank_accounts idênticos (I20); storage local sem resíduo (CLEANUP).
- **Gate** `audit-canonical-catalog-closure.mjs` (em `validate:regression-guards` + `validate:canonical-catalog`): família explícita de **19 arquivos**; veda: cura de actor (regime PJ-B3), Bank writer (FINANCIAL_HARD_STOP), preço/estoque em entidade canônica, empresa criando global READY, oferta sem variante/readiness, serviço sem canônico, mídia sem dedup de hash (exige a CHAMADA `this.findByContentHash(contentHash)` — token decorativo não satisfaz), images JSONB como SSOT, template opaco/sem versão/com efeito comercial, menu hardcoded, estoque público tenant-wide, unidades somadas, agenda paralela, discovery sem KYB/publicação; `NEW_UNCLASSIFIED` para arquivo novo em core/catalog|core/media-assets|core/navigation. Resultado: **61 CLOSED_CANONICAL / 5 KNOWN_OPEN_OUTSIDE_CANONICAL / 0 / 0 / 0**. stripComments order-safe herdado do gate PJ.
- **Provas negativas 8/8** (`backend/scripts/negative-proofs-canonical.ps1`, injeção REAL → gate FAIL → restauração byte-idêntica sha256-verificada → gate OK):
  P1 price_cents no canônico (sha `8d2a1a90…`) · P2 oferta sem readiness de variante (sha `db66c054…`) · P3 soma tenant-wide reintroduzida (sha `e1902336…`) · P4 menu hardcoded (sha `43e8cf19…`) · P5 serviço sem canônico (sha `8b9ee14e…`) · P6 ensureUserActor em writer comercial (sha `db66c054…`) · P7 discovery ignora KYB (sha `e1902336…`) · P8 dedup de media hash removido (sha `7171ffe7…`).
- **Gates vizinhos atualizados:** `audit-pj-human-to-company-closure.mjs` (família +2: business-templates.service/company-templates.routes — o NEW_UNCLASSIFIED do gate PJ os pegou na matriz, como desenhado) e `audit-inventory-reader-scope.mjs` (product-visibility KNOWN_OPEN → SCOPED_APPROVED + check 3c de regressão; FIXED_REGRESSION=3).

## Matriz de regressões

(Resultado completo na entrega; itens: gates actor-writer/bank-ledger/regression-guards(+canonical)/arch--strict/system-state/git-diff-check/tsc BE baseline-only/tsc FE; e2es dev: pj-integrado · c1-journey · c1-birth · c1-read-purity · inventory-consolidated · inventory-legacy-readers · groups-mine · self-escalation · role-vocabulary; e2es efêmeros: 6 da frente canônica + 20 da matriz PJ/serviços/ativação/publicação/KYB.)

## Migrations

369–372 (4 novas, aditivas, forward-only, idempotentes; zero edição de migration aplicada; checksums preservados): `20260611150000_canonical_variants_services_units_foundation` · `20260611160000_media_assets_canonical` · `20260611170000_business_templates_versioned` · `20260611180000_offerings_variant_sku_service`.

## DTs

- **CLOSED:** `DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION`.
- **OPEN (nova, honesta):** `DT-MARKETPLACE-LEGACY-MEMORY-PRODUCT-ROUTES` (rotas em memória com caller vivo no frontend; substituto canônico vivo; remoção = fatia própria).
- **OPEN (inalteradas, fora do corte):** DT-COMMERCIAL-PRICE-FEDERATED-SSOT · DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK/HYBRID-ATOMIC (0102 §13) · reconciliation metrics · FASE-6 stubs · providers produção.

## Veredito

Macrofrente **tecnicamente concluída — AGUARDANDO RESEAL YALA** (não declarada CLOSED). Zero Bank writer; zero actor cure; zero migration editada; drift protegido intocado.
