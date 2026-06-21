# sistema/banco — PROVA-VIVA (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa BANCO = prova-viva READ-ONLY do schema/runtime. Fonte: IA-BANCO (probe psql descartado, zero mutação) · HEAD `9f5e9c5e` · 2026-06-20.

## Rowcounts (= prova de CUSTO, regra JANELA VIRGEM)
| objeto | estado | janela |
|---|---|---|
| services / service_offerings / company_concept_publications / tenant_concept_offerings | **0 linhas** | BAIXO CUSTO |
| canonical_services | 1 | cuidado leve |
| actor_professional_concepts | 1 | cuidado leve |
| canonical_products | 35 | cuidado |
| availability | 48 (todas `owner_type='user'`) | cuidado |
| actor_capability_grants | 0 (dormant) | BAIXO CUSTO |
| **AUSENTES:** user_skills_categories · human_mvp_service_offers · tenant_products · product_concepts · catalog_products · unified_availability | não existem | ghost/baixo custo |

## Fatos estruturais
- FK: `→canonical_services` = RESTRICT (forte); `service_offerings.service_id→services` = SET NULL; `actor_professional_concepts.concept_id→concepts` = **NO ACTION (fraca)**.
- `detect_availability_conflicts()` = **STUB** (`BEGIN RETURN; END;`).
- CHECK `availability.owner_type` = 6 tipos incl `service_offering`. `purpose_concept_id` vivo.
- `product_offers.price_cents` = **BIGINT**. `product_concept_id` não existe.
- `inventory_movements` triggers append-only ativos; movements/balances 0/0.
- **Drift migration = 0** (disco 398 == schema_migrations 398; `db_role_rls_hardening` aplicada).

## Veredito
**PASS_TO_CONVERGENCE** — espinha canônica existe, vazia, FK forte ao canonical ⇒ convergência BAIXO CUSTO (janela virgem aberta). Não é blocker estrutural; o que resta são decisões de POLÍTICA (donos de eixo + Clayton).
