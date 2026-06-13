# 2026-06-13 — F-SERVICE-OFFERING-CANONICAL-BINDING (MODO: EXECUTOR)

Conecta a oferta comercial canônica (`service_offerings`) à cadeia decision/order, reduzindo a
dependência de autoridade do legado `services`. Parent `68c99da6` · branch `rescue-structural` ·
dev 379 → **380** · DECISION-0122.

## Bootstrap normativo (§2.2.2, incremental §4.2)

Mesmo domínio das frentes anteriores desta sessão (AUTORIDADE/TEMPO/ESTADO/ONTOLOGIA) — bootstrap
já cumprido (Constituição/Leis/SSOT_REGISTRY/Lei de Coerência/AUTHORITY_LAW/18_DOMAIN_ONTOLOGY).
Âncora: DECISION-0117 (service_offering/canonical_services) + 0118 D2 + 0121. SSOT: C2 oferta =
`service_offerings`; Temporal `unified_availability`; Authority fachada→canActAs. Pilares: AUTORIDADE+
TEMPO+ESTADO+ONTOLOGIA (FINANCEIRO/CONCEPT intocados). GATE §2.3.2: PASS (Lei 4 respeitada — service_id
NOT NULL preservado; sem mini-core; sem Bank).

## Modelo material (READ-FIRST → desenho)

- `service_offerings.service_id` SEMPRE null na criação; provider_actor_id soberano; availability
  owner_type='service_offering' já resolve provider. service_orders.service_id NOT NULL (Lei 4 → não
  nullable). Zero readers legados. rows=0.
- **Decisão:** coluna NULLABLE `service_offering_id` (FK→service_offerings) em decisions+orders;
  gravada do SSOT `availability.ownerId` quando offering-owned (nunca do cliente); service_id legado/
  projeção (de metadata validado contra provider). Ver DECISION-0122.

## Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `migrations/20260613160000_service_offering_canonical_binding.sql` | +service_offering_id (FK SET NULL) + índice parcial em decisions e orders |
| `service-order.types.ts` | ServiceOrder + CreateServiceOrderInput: serviceOfferingId |
| `service-order.repository.ts` | Row + toServiceOrder + createOrder INSERT/RETURNING + todos SELECT/RETURNING |
| `service-order.service.ts` | confirmBookingFromDecision: deriva serviceOfferingId do SSOT + anti-divergência + passa ao createOrder; createOrder dormente threada |
| `service-booking-decision.types.ts` | ServiceBookingDecision + Input + Row: serviceOfferingId |
| `service-booking-decision.repository.ts` | mapping + create INSERT/RETURNING + SELECTs |
| `service-booking-decision.service.ts` | createDecision: deriva serviceOfferingId do SSOT (override cliente) |
| `scripts/audit-booking-order-authority-binding.mjs` | check: serviceOfferingId de fonte cliente proibido |
| `scripts/negative-proof-booking-order-authority-binding.ps1` | fase 3 (offering de fonte cliente) |
| `src/scripts/validate-pipeline-e2e-service-offering-canonical-binding.ts` (novo) + wrapper (novo) | e2e 11/11 |

## Provas

| Prova | Resultado |
| --- | --- |
| e2e `service-offering-canonical-binding` (DB efêmera) | **11/11** |
| T1/T6 legítimo: order+decision com service_offering_id=oferta (SSOT), worker=provider | ✅ |
| T2 confused-deputy oferta · T3 service_id alheio (409) · T5 provider mismatch | ✅ |
| T4 metadata.serviceOfferingId spoof IGNORADO (grava oferta da availability) | ✅ |
| T6b service_id legado/projeção preservado · T7 duplicidade | ✅ |
| T8 POST /service-orders 403 · T9 dispute containment · T10 Bank intocado | ✅ |
| Guard checked=5/0 (offering-from-client) + prova negativa TRIPLA | ✅ |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo nos arquivos tocados |
| migration count | dev 379 → 380 |

## Hard stops respeitados

Zero Bank; reversal/dispute containment intactos; POST /service-orders não reaberto; service-hire
firewall intacto; RBAC V2/FASE6/R2/PJ/CNAE/frontend não tocados; metadata não autoriza; service_id
legado não autoriza (autoridade = provider resolvido do SSOT); sem SELECT */devLog.

## Cartório

- DECISION-0122 + REMEDIATION_DECISIONS_LOG.
- `DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING`: OPEN → **PARTIAL / CONTAINED** (oferta agora é
  recurso canônico registrado; resíduo = service_id NOT NULL p/ ofertas sem service de apoio + população
  de service_offerings.service_id, exige mudança estrutural/produto).

## Estado

F-SERVICE-OFFERING-CANONICAL-BINDING: **IMPLEMENTED / HOLD PARA RESEAL**.
