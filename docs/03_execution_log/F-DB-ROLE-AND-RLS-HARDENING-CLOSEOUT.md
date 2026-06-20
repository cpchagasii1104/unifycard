# F-DB-ROLE-AND-RLS-HARDENING-CLOSEOUT — EXECUTION (DOCS-ONLY · Yala PASS_WITH_WARNINGS · WM1 precisão cartorial)

Registra o **Yala reseal material = PASS_WITH_WARNINGS** da macro `F-DB-ROLE-AND-RLS-HARDENING` (commit `cd697da7`) e
corrige a precisão cartorial do **warning WM1**: o hardening está **READY / PROVEN-EPHEMERAL / PROD-FAIL-CLOSED**, mas
**NÃO está live no `unificard_dev`**. **DOCS-ONLY: zero código/migration/runtime/DB write/seed/worker/payout.**

- **HEAD before:** `cd697da7` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before:** limpo no escopo material (docs/memorias + untracked alheios) · **after:** limpo (cartório committado)
- **modo:** EXECUTOR · **natureza:** docs-only / Yala reseal closeout / correção cartorial de precisão (WM1)

## READ-FIRST
Normativos (00_AGENT_PROTOCOL, 07_NOMENCLATURA_CANONICA, SSOT_EXCLUSIVE_BANK_RULE, SSOT_CONTRACT,
SSOT_REGISTRY_UNIFICARD, PROHIBITED_STRUCTURES, LEIS_OPERACIONAIS), REMEDIATION_DECISIONS_LOG, REMEDIATION_DT_LOG,
STATUS_EXECUCAO_GLOBAL, GOLIVE-DECISION-PACK-CLOSEOUT, DB-ROLE-AND-RLS-HARDENING-EXECUTION + `git show --name-only cd697da7`.
Confirmado: o commit material alterou SOMENTE o eixo DB-role/RLS/preflight/guards/cartório (migration, preflight,
BOOT wiring, RLS test, runner, guard, negative-proof, package.json, exec log, DT_LOG, STATUS) — **sem abrir payout**.

## Yala verdict
- **VEREDITO: PASS_WITH_WARNINGS.**
- **Confirmado:** role `unificard_app` NOSUPERUSER/NOBYPASSRLS/NOLOGIN; grants mínimos; ENABLE+FORCE RLS nas 7 tabelas
  payout/approval/recovery na migration; policies tenant-scoped (`current_setting('app.current_tenant')`); `infra_bypass`
  só `TO unificard_infra`; preflight em BOOT; produção fail-closed se superuser/BYPASSRLS/RLS/policy ausente; guard em
  `validate:regression-guards`; negative-proofs NP1–NP7 mordem; teste efêmero prova `SET ROLE unificard_app` + bloqueio
  cross-tenant (SQLSTATE 42501); bank_* não relaxado; payout fechado.

## Warning WM1 (precisão cartorial)
- A migration `20260620120000_db_role_rls_hardening.sql` está **commitada (395 arquivos)**, mas **NÃO aplicada ao
  `unificard_dev`** (dev segue com **394 aplicadas / 395 arquivos**).
- As **7 tabelas alvo aparecem RLS OFF em dev** (a migration não rodou lá).
- A role `unificard_app` aparece no cluster por ser **objeto cluster-global** criado durante a execução **efêmera** —
  isso **NÃO prova** aplicação da migration no dev.
- **Estado correto:** `READY / PROVEN-EPHEMERAL / PROD-FAIL-CLOSED`. **NÃO declarar RLS live-em-dev.**

## Campos
- **commit material:** `cd697da7` — "security(db): harden app role and rls preflight".
- **migration criada:** `20260620120000_db_role_rls_hardening.sql` (presente; 395 arquivos).
- **migration aplicada no dev?:** **NÃO** (394 aplicadas em unificard_dev; RLS das 7 tabelas OFF em dev).
- **estado correto:** READY / PROVEN-EPHEMERAL / PROD-FAIL-CLOSED · **NOT LIVE IN DEV**.
- **payout status:** NOT AUTHORIZED · **PORTA-1 status:** NOT SEEDED · **worker status:** DEFAULT-OFF ·
  **external payout status:** NOT AUTHORIZED · **HTTP execution status:** disabled / 403 ·
  **destination_type:** internal_settlement-only · **bank_\* status:** não relaxado (RLS+FORCE preservada).
- **DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD:** OPEN (inalterada).

## Ativação real (passo OPERACIONAL fora do repo — NÃO executado aqui)
1. aplicar a migration no ambiente alvo; 2. dar `LOGIN`/`PASSWORD` à role `unificard_app`; 3. repontar o runtime para
`unificard_app`; 4. manter postgres/admin apenas para migrations/admin; 5. validar o pre-flight em produção/piloto;
6. confirmar RLS/force/policies aplicadas no ambiente alvo. **Isso NÃO autoriza:** PORTA-1 seed · ENABLE_PAYOUT_WORKER ·
external payout · HTTP execution · PIX-out · TED · PSP · go-live.

## Próxima macro
- **F-PAYOUT-TOCTOU-SAFETY-HARDENING** (agora).
- Posteriores (NÃO agora): F-ACTOR-WALLET-PAYOUT-EXTERNAL-RAIL-DESIGN · PORTA-1 seed · worker arming · external payout real.

## Arquivos alterados (docs-only)
`REMEDIATION_DT_LOG.md` · `STATUS_EXECUCAO_GLOBAL.md` · `docs/03_execution_log/F-DB-ROLE-AND-RLS-HARDENING-CLOSEOUT.md` (novo).

## Gates (docs-only, re-rodados)
actor-writer OK · bank-ledger OK · regression-guards 76 OK/0 FAIL · arch `--strict` critical_new=0 · check:migrations
395/395 · baseline 0113 = 0.

## Veredito
`F-DB-ROLE-AND-RLS-HARDENING` → **CLOSED / MATERIAL / YALA PASS_WITH_WARNINGS · READY / PROVEN-EPHEMERAL /
PROD-FAIL-CLOSED · NOT LIVE IN DEV**. Payout segue fechado. Próxima macro: F-PAYOUT-TOCTOU-SAFETY-HARDENING.
