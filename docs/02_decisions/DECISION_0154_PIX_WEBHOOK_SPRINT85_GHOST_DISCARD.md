# DECISION-0154 — DISCARD do webhook PIX ghost SPRINT-85

> **Arquivo canônico.** Fonte append-only viva: `REMEDIATION_DECISIONS_LOG.md` (§ DECISION-0154). Criado em 2026-07-03 para fechar a lacuna de rastreabilidade apontada no `auditoria.md` (DECISIONs 0154–0158 viviam só no log). Conteúdo idêntico ao promulgado.

- **Data:** 2026-06-24
- **Frente:** F-CAMADA-1-GATE-IDEMPOTENCIA-OUTBOX-G1 (gate #35 da Matriz Consolidada Camada 1) · **HEAD (pré-commit):** `00b25b9a`
- **Tipo:** Arquitetural / saneamento de ghost — **MATERIAL** (remove rota+repo dead-code; **NÃO toca dinheiro/Bank/migration/schema**).
- **Status:** **PROMULGADA / DISCARD.**

## Contexto
O READ-FIRST do #35 (idempotência/outbox/replay) encontrou DOIS caminhos de webhook PIX: (1) **canônico vivo** `POST /gateway/pix/webhook` (`pix-webhook.controller`) com HMAC fail-closed + dedup de ingestão por `gateway_webhook_events` ON CONFLICT (provider, reference_id); (2) **ghost SPRINT-85** `POST /webhooks/pix/:provider` (`pixWebhookRoutes`) + repo `pix-webhook.repository.ts`, que escreve na tabela **`pix_webhook_events` — NUNCA criada em nenhuma migration** → quebrava em runtime. Dois caminhos para a mesma função, um deles morto.

## Decisão soberana (Clayton · D1)
**DISCARD** do ghost SPRINT-85. **NÃO reviver** (`REVIVAL_REQUIRED` só com migration + decisão própria). **NÃO criar** a tabela `pix_webhook_events`, **NÃO criar** migration, **NÃO criar** webhook novo. Caminho canônico de webhook PIX permanece **exclusivamente** `/gateway/pix/webhook`.

## Materialização / Prova
Removido o `register(pixWebhookRoutes)` em `app.builder.ts`; removida a export `pixWebhookRoutes` de `pix.routes.ts` (preservada a leitura GET de status de cobrança usada por `marketplace.routes`); deletado o repo órfão `pix-webhook.repository.ts`. Guard `audit-webhook-resolver-idempotency` (anti-revival: migration/app.builder/export) + **NP 3×**. tsc 43 (0 novos) · regression EXIT 0 · bank-ledger/actor-writer OK · architectural critical_new=0. **ZERO bank_*/migration/worker/PORTA-1/payout/dinheiro.**

## Consequências
`DT-PIX-WEBHOOK-SPRINT85-GHOST` CLOSED/DISCARD. Matriz #35/#18 → FECHADO. RLS-live físico segue NÃO VIRADO (à época); dinheiro/payout/worker HOLD.

- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8).
- **Referências:** `docs/04_audit/CAMADA_1_READINESS_MATRIX.md` (#35/#18) · `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` · `HANDLER_EXECUTION_AND_RELIABILITY.md` · `07_NOMENCLATURA_CANONICA.md` §4.12.1.
