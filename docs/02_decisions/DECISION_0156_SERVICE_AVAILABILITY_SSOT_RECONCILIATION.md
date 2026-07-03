# DECISION-0156 — Reconciliation of Service Availability SSOT and Honest Opportunity Notification

> **Arquivo canônico.** Fonte append-only viva: `REMEDIATION_DECISIONS_LOG.md` (§ DECISION-0156). Criado em 2026-07-03 para fechar a lacuna de rastreabilidade apontada no `auditoria.md`.

- **Data:** 2026-07-01
- **Frente:** F-SERVICE-AVAILABILITY-SSOT-RECONCILIATION-PACK · **Slice 0 (docs-only)** · **HEAD (pré-commit):** `085917f86`
- **Tipo:** Arquitetural / temporal-autoritativa (DOCS-ONLY) — **NÃO MATERIAL**. Promulga sequência de reconciliação e ratifica SSOT temporal já existente.
- **Status:** **PROMULGADA / DOCS-ONLY / DECISION_PROMULGATED.** Classificação da agenda: **`AGENDA_SSOT_COM_CONFLITO`** (SSOT temporal já decidido na norma; runtime ainda não obedece totalmente) — **NÃO** `AGENDA_INDECISA`.

## Contexto
Auditoria estratégica READ-ONLY (busca/orquestração/agenda/dispatch) + READ-FIRST temporal revelaram que o marketplace de serviços é hoje **pull** ("prateleira inteligente"), sem orquestrador automático, sem push ao prestador, e que a **agenda não filtra vitrine** — só barra no ato do pedido. Achado decisivo: **o SSOT temporal NÃO é uma decisão em aberto** — já foi promulgado (`unified_availability`/`unified_bookings` = SSOT temporal soberano; owner canônico do tempo contratável da oferta = `owner_type='service_offering'`, DECISION-0117 D / 0118 D2 / 0146 §A.5). O conflito é **drift de runtime** contra norma já batida (reader legado `owner_type='service'`, blob `services.metadata.availability`, `service_discovery_requests` como 2º trilho, `detect_availability_conflicts()` STUB, `SERVICE_BOOKING_REQUESTED` nunca emitido, confirm que bypassa lock, create sem validar futuro/pausa/capacity).

## Decisão soberana (Clayton · marteladas D1–D7)
1. **D1 — SSOT temporal da oferta (RATIFICAÇÃO):** SSOT temporal é `availability`/`bookings` via Unified Availability; owner canônico da oferta contratável = `owner_type='service_offering'` (→ `service_offerings.provider_actor_id`). NÃO criar novo SSOT; NÃO tratar `services.metadata.availability` como autoridade; `owner_type='service'` é legado a **conter**.
2. **D2 — Vitrine sem data:** discovery sem data deve **esconder** oferta sem nenhuma disponibilidade futura ativa no SSOT temporal canônico.
3. **D3 — Vitrine com data/hora:** discovery com data/hora filtra por **janela compatível no SSOT temporal canônico**. PROIBIDO usar o blob JSON como fonte soberana.
4. **D4 — Aviso ao prestador:** `SERVICE_BOOKING_REQUESTED` deve nascer no **create booking canônico**, mirando o dono resolvido via `resolveAvailabilityOwner` (offering = `provider_actor_id`), não hint de `payload.actorId`. NÃO emitir antes de A+B (agenda + discovery honestos).
5. **D5 — `services.metadata.availability`:** **aposentar** como caminho de agenda. Legado/transição documentada, sem autoridade.
6. **D6 — `service_discovery_requests`:** precisa **convergir** ao trilho canônico (`bookings`/`service_orders`) **ou ser aposentado**. Não pode ser 2ª verdade/reserva paralela.
7. **D7 — confirmação/lock:** **obrigatório** — todo caminho que transforma booking aceito em compromisso/`service_order` passa pelo **lock/conflito canônico**.

## Ordem obrigatória de execução (fatias materiais futuras, cada uma com GO próprio)
**Slice A** (reconciliar runtime ao SSOT temporal: conter reader legado `service`; destino do blob D5; função de conflito) → **Slice B** (discovery respeitar agenda futura D2/D3; corrigir bug TZ) → **Slice C** (emitir `SERVICE_BOOKING_REQUESTED` honesto). **A antes de B antes de C** — inverter faria o sistema avisar sobre horário que não existe.

## HOLD explícito
Dispatch automático estilo Uber · dinheiro · checkout · payout · PORTA-1 · firewall · ranking material · 2º provider material · worker/cron de distribuição.

## Materialização / Prova
**NENHUMA** (docs-only). **Δbank=0.** Abre 7 DTs OPEN para os achados materiais (ver `REMEDIATION_DT_LOG.md`). Slice A material = **HOLD até GO próprio**.

- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8).
- **Referências:** `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` · `docs/01_normative/CORE_TEMPORAL_CONTRACT.md` · DECISION-0072/0014/0117/0118/0132/0146/0147/0148.

> **Estado vivo (nota 2026-07-03):** a cadeia material desta DECISION foi posteriormente FECHADA (Slices A/B + efeitos), conforme `REMEDIATION_DT_LOG.md` e reconciliação §7 do `auditoria.md` — o estado vivo é **CLOSED**. Este arquivo registra a promulgação (Slice 0 docs-only) da qual a execução partiu.
