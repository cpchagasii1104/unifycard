# MINHA_MEMORIA_COMERCIO — IA-COMERCIO (append-only)

> Camada ESTADO da escada, ENTRE oferta (descoberta) e dinheiro (liquidação).
> READ-ONLY. Insumo, nunca GO. Edito só §14.10 do PLANO + este arquivo.

## EIXOS (sempre separados)
- **PEDIDOS/CONTRATAÇÃO:** orders · order_items · service_orders · service_booking_decisions (escolha HUMANA) · bookings. DECISION-0121/0122.
- **ESTOQUE/INVENTÁRIO:** product_variants · inventory_movements (append-only via trigger = SSOT) · inventory_balances (PROJEÇÃO) · inventory_lots · inventory_reservations · stock_transfers/receipts · purchase_orders · fulfillment_orders. ACTOR_PRIVATE (DECISION-0116).

## STOPs
- inventory_movements = SSOT append-only; inventory_balances = PROJEÇÃO. Não deduzir estoque fora dos movimentos; não tocar o trigger.
- Pedido NÃO toca bank_ledger (money = IA-DINHEIRO, a jusante).
- Gate canRepresentActor ANTES de criar/mutar pedido.
- service_booking_decisions = escolha humana; sistema sugere/filtra, nunca crava.
- Inventário escopado por actor representável, sem vazar cross-actor.

---

## 2026-06-20 · HEAD `dd270f41` (branch rescue-structural) · RODADA 1 re-baseline (revalidado de 1ª mão no disco)
**VEREDITO:** substrato dos 2 eixos MATERIALIZADO no disco e coerente. STOPs estruturais presentes no schema.

EVIDÊNCIAS-CHAVE:
- Append-only SSOT: `0102_inventory_movements.sql:66-84` (função + triggers BEFORE UPDATE/DELETE → RAISE EXCEPTION). RLS tenant `:61-64`.
- Projeção: `0103_inventory_balances.sql:24-45` (PK product_variant_id; "SSOT = movements"). Código: `inventory-balance.repository.ts:65-70` upsert ON CONFLICT; `inventory-movement.repository.ts:63,104` só INSERT.
- ACTOR_PRIVATE: `20260411120000_inventory_movements_actor_id.sql` (actor_id = unidade operacional). Consolidado empresa: `20260610120000_*can_view_consolidated_inventory*` (DEFAULT FALSE; não altera owner material).
- Escolha humana: `20260530494000_*service_booking_decisions*` (decided_by_actor_id, UNIQUE booking_id).
- Binding canônico (DECISION-0121): `20260613150000_booking_order_canonical_binding_integrity.sql` (FKs booking/decision/requester + UNIQUE parcial ≤1 service_order/booking; "NÃO toca Bank/ledger").
- Substrato service_orders: `20260530555000_*service_orders_substrate_with_f1*` (lowercase, settlement_flow). orders status: `0117_evolve_orders.sql:18-24`.
- Gate: `service-booking-decision.service.ts:111` → authorizationService.canRepresentActor(...) ANTES de gravar.

INCONCLUSIVO (read-only não alcança → IA-BANCO): trigger append-only EFETIVAMENTE habilitado no banco corrente (20260411120000 faz DISABLE p/ backfill — confirmar reabilitação) + contagem inventory_movements vs inventory_balances (drift de projeção).

DELTA vs plano dev-385: NÃO stale no substrato — service_orders materializado e binding canônico já no disco. Payout-hardening recente (dd270f41/cd697da7/e0fe89b9) NÃO toca meus eixos (frente IA-DINHEIRO).

FRONTEIRAS marcadas: IA-DINHEIRO (price_cents lido, não liquidado; service_payment_requests = borda) · IA-ACTOR/IA-AUTORIDADE (gate) · IA-OFERTA (PRÉ-transação) · IA-TEMPO (disponibilidade booking) · IA-BANCO (prova-viva).

---

## 2026-06-20 · HEAD `9f5e9c5e` · RODADA 7 (F-OFFER readiness — sombra material, READ-ONLY)
Barramento migrou para `docs/orquestracao/` (METODO/INBOX/respostas). Minha resposta: `respostas/IA-COMERCIO.md`. VEREDITO **PARTIAL** (BLOCKER-se-construído-agora no cruzamento por concept).

ASSIMETRIA-CHAVE (serviço concept-keyed; material NÃO):
- `canonical_services.concept_id NOT NULL → concepts(concept_id)` (Lei 7 / 0117 D / 0142). service_offerings casa por canonical_service_id.
- `canonical_products` = category_id → categories + opcional `product_concept_id → product_concepts` (NAMESPACE SEPARADO, "distinct from domain concepts", null until pipeline). canonical_variants = fingerprint/GTIN. NENHUM liga a domain `concepts`. → fura 0142 no lado material.

VERDADES PARALELAS (material): (1) product_concepts ≠ concepts; (2) 3 SSOTs de produto: products/catalog_products/canonical_products; (3) drift monetário: product_offers.price NUMERIC (RFC-003 pendente) × service_offerings.price_cents BIGINT × tenant_products já em cents; (4) keying da oferta divergente (concept vs fingerprint).

FOCO 2 (serviço×material BOM/compatibilidade/fitment modelo-ano) = **100% GREENFIELD** (zero BOM/requires/compat no disco).
FOCO 5 SLOT F-OFFER: reservar gancho OPCIONAL, aditivo, nullable, CONCEPT-KEYED (FK a concepts) de "material/recurso exigido" no contrato service_offering→booking→order; NÃO em conditions jsonb; NÃO por category/fingerprint. Só resolve após material convergir p/ concepts. Pré-acoplamento de DESENHO, gated.

INVENTÁRIO (meu eixo próprio) segue sólido: append-only SSOT (0102) + projeção (0103) + ACTOR_PRIVATE (0116). Prova-viva (rowcounts, price vivo, populamento de pontes, drift movements×balances, trigger habilitado) → INCONCLUSIVE → IA-BANCO.
