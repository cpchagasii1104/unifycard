# DECISION-0149 — RLS Cross-Tenant Connection Model (Opção B-heavy) · F-RLS-CROSS-TENANT-CONNECTION-DECISION

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL (CONEXÃO/RLS) / TENANT-LOOP CANÔNICO** (Clayton 2026-06-23; IA-DINHEIRO no loop).
**NÃO** altera `docs/01_normative`. **NÃO** toca runtime/migration/role/env/dinheiro. Precede a execução material (`F-RLS-CROSS-TENANT-CONNECTION-MATERIALIZATION`), que só roda após GO próprio.

**Data:** 2026-06-23 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `9e372089` · **Tipo:** arquitetural / conexão-RLS (docs-only) · **Frente:** F-RLS-CROSS-TENANT-CONNECTION-DECISION
· **Responsável:** Clayton (decisão soberana) / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + IA-DINHEIRO (lente adversarial)
· **READ-FIRST (3 ângulos, READ-ONLY):** 2 monitores + 4 workers cross-tenant mapeados; **`unificard_infra` verificado: `rolbypassrls=false`, `rolcanlogin=false`, sem `DATABASE_INFRA_URL`/infra-pool** — o "bypass" é só via policies `infra_bypass` nas 7 tabelas financeiras, NÃO atributo de role. Logo usar infra agora = **criar chave-mestra nova** (LOGIN+pool+contrato), desnecessário.

**Deriva de / subordinada a:** DECISION-0113/0118 (autoridade server-side) · DECISION-0110 (firewall financeiro) · F-DB-ROLE-AND-RLS-HARDENING (role `unificard_app` NOBYPASSRLS + preflight). **Vinculada a:** [[DT-RLS-RUNTIME-TENANT-CONTEXT-BASELINE]].

---

## §0 — Natureza e contexto
Após o dreno mecânico de tenant-context (baseline 11→0 dos runtime tenant-scoped), restam **acessos genuinamente CROSS-TENANT** (jobs/monitores que leem/escrevem além de um tenant). Sob a role de runtime `unificard_app` (NOBYPASSRLS), esses acessos retornam 0 linhas. A pergunta: **quem pode usar "binóculo global"?** `unificard_infra` parecia a resposta, mas o READ-FIRST provou que **ele não está pronto** (sem LOGIN, sem pool, sem bypass por atributo) — usá-lo agora seria fabricar uma chave-mestra. Regra soberana: **chave-mestra só com contrato/escopo/log/razão**; runtime normal NUNCA usa bypass.

## §A — A DECISÃO (soberana de Clayton, 2026-06-23 · Opção B-heavy)

1. **Runtime normal NUNCA usa conexão global/bypass** para tabela RLS. Usa tenant-context: `runQueryWithTenant` · `runQueriesWithTenant` · `getClientWithTenant` (ou wrapper que sete `app.current_tenant`).
2. **Cross-tenant ≠ bypass automático.** Padrão canônico p/ jobs/monitores cross-tenant: (a) **descobrir tenants por fonte NÃO-RLS/autorizada** (preferencialmente tabela `tenants`), (b) **iterar tenant-by-tenant**, (c) cada leitura/escrita com `app.current_tenant`.
3. **`unificard_infra` NÃO ganha LOGIN/pool nesta decisão** (não tem LOGIN; sem `DATABASE_INFRA_URL`; sem infra-pool; bypass é policy específica, não atributo). Criar esse caminho agora = blast radius + contrato/auditoria próprios → adiado.
4. **`ledger-integrity-monitor`:** `ADMIN_ONLY` ou `TENANT_LOOP` (conforme menor patch). Se algum dia exigir infra-role → **decisão própria + wrapper nomeado + allowlist**. Sem infra genérico agora.
5. **`reconciliation.repository`:** discovery via tabela `tenants`/registry NÃO-RLS, depois iterar tenant-by-tenant. **NUNCA** descobrir tenants varrendo tabela financeira RLS.
6. **Workers:** `financial-metrics-worker` / `risk-analysis-worker` / `financial-alert-worker` = **tenant-loop** por padrão; `actor-wallet-payout-worker` = **HOLD até PORTA-1/payout** (já default-off; sem execução/conexão nova agora).
7. **`unificard_infra` reservado** p/ exceções: admin/monitoria global estritamente necessária · decisão própria · wrapper nomeado · allowlist · auditoria/log · prova de menor blast radius · **NUNCA runtime normal**.
8. **Guard (`audit-rls-tenant-context`)** exige classificação explícita por acesso: `TENANT_CONTEXT | TENANT_LOOP | ADMIN_ONLY | INFRA_ROLE | HOLD | TEST_ONLY | MIGRATION_ONLY`.
9. **Guard FALHA se:** `pool.query` cru a tabela RLS em runtime normal · novo cross-tenant sem classificação · `unificard_infra` fora de allowlist · `DATABASE_INFRA_URL`/infra-pool aparecer sem DECISION própria · reconciliation descobrir tenants via tabela financeira RLS.

## §B — BLOCKER p/ RLS-runtime-live OPS (continua bloqueado até):
- baseline RLS = 0 · reconciliation via tenant-loop · ledger-integrity-monitor como ADMIN_ONLY ou tenant-loop · workers classificados/materializados ou HOLD · guard atualizado · app **sem repoint** p/ `unificard_app` até novo GO OPS.

## §C — Dinheiro permanece FORA
Esta decisão **não autoriza**: payout execution · payout worker · checkout financeiro · fee runtime novo · recovery payout · flags financeiras · RLS-runtime-live OPS.

## §D — Materialização (NÃO executa aqui; GO próprio)
`F-RLS-CROSS-TENANT-CONNECTION-MATERIALIZATION`: (1) reconciliation discovery via `tenants` + tenant-loop; (2) ledger-integrity-monitor ADMIN_ONLY/tenant-loop; (3) workers metrics/risk/alert → tenant-loop ou HOLD explícito; payout-worker HOLD; (4) guard baseline 2→0 + classificação cross-tenant + infra proibido sem DECISION própria. **MODO B; ZERO dinheiro/migration/role/env.**
