# sistema/oferta — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Conhecimento durável da etapa OFERTA. Cita a fonte; não a substitui. Fonte: respostas IA-OFERTA/IA-BANCO/IA-ACTOR · DECISION-0117/0122/0142.

## SSOT
- **`service_offerings`** = SSOT contratável de serviço. concept-keyed via `canonical_service_id` (NOT NULL) → `canonical_services.concept_id` (NOT NULL). owner = `provider_actor_id`. preço = `price_cents` **BIGINT**. autoridade = `canRepresentActor(provider)`. tempo = `availability owner_type='service_offering'`.
- **`canonical_services`** = SSOT identidade do serviço (concept_id NOT NULL → concepts; FK RESTRICT/forte).
- **`company_concept_publications`** = SSOT publicação PJ (concept_id, KYB+canManageCompany); **`tenant_concept_offerings`** = read-model projetado in-tx (reconcilia, NÃO é paralelo).

## Estado vivo (IA-BANCO, HEAD 9f5e9c5e)
- services/service_offerings/company_concept_publications/tenant_concept_offerings = **0 linhas** (VIRGEM). canonical_services=1.
- `service_offerings.service_id→services` = SET NULL (legado/projeção).

## Achados / riscos
1. **Ponte declaração→oferta AUSENTE:** o writer de offering NÃO verifica se o provider declarou o concept (`actor_professional_concepts` PF / `company_concept_publications` PJ). Provider pode ofertar concept que nunca declarou.
2. **Discovery viola DECISION-0142:** `discoverServices`/`services-discovery`/`human-mvp-matching` casam por `category_id`/`domain`, não por `concept_id`. Re-key = fatia própria.
3. **Owner-tempo ambíguo:** `owner_type='service'` (legado, lido por `service-feed.plugin`) × `'service_offering'` (canônico, 0117 D). 0×0 linhas vivas → convergir a baixo custo.
4. **Preço:** faturável só `service_offerings.price_cents` BIGINT. `services.price_cents` (BIGINT) é indicativo de descoberta.

## Para a cirurgia (F-OFFER) — janela virgem aberta (tudo vazio)
Criar ponte (gate de capacidade), re-key discovery por concept_id, conter owner='service', reservar SLOT material concept-keyed nullable. Ver CONSOLIDADO da frente, blueprint 1–7.
