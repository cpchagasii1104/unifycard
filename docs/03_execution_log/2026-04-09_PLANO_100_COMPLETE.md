Plano: 100% FINALIZADO (âmbito C.27 + Fase 4 + C.25_SPEC — 2026-04-09)

Itens fechados:
- C.27 — `backend/tests/integration/canonical-resolution.test.ts` + `pnpm run test:integration:canonical-resolution` PASS — log `2026-04-09_c27_t1_t4.md`
- Fase 4 — símbolo `importProductTemplates` removido do repo; `activateLegacyProductTemplatesForStore` — log `2026-04-09_fase4_legacy_removed.md`
- C.25_SPEC — §1–§5 preenchidos; estado lista fechada — log `2026-04-09_c25_spec_completed.md`

Sistema:
- validado (C.27 + dedupe C.20 em `listAvailableCatalogProducts`)
- protegido (gate C.22 inalterado)
- governado (C.25_SPEC fechado)

Decisão:
- pronto para evolução de produto no âmbito documentado; suíte Jest global `pnpm test` mantém **dívida** em `tests/financial-chaos/*` (TS) — ver `2026-04-09_c27_t1_t4.md`.
