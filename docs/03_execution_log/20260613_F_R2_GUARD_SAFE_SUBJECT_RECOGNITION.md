# 2026-06-13 — F-R2-GUARD-SAFE-SUBJECT-RECOGNITION (MODO: EXECUTOR)

FATIA A do READ-FIRST R2 (`docs/04_audit/20260614_R2_FINE_GRAINED_PERMISSION_MODEL_AUDIT.md`): ensinar o
guard 0113 a reconhecer readers/admin-filters cujo SUBJECT de autorização vem server-side de `req.user`,
**sem alterar runtime de produção**. Parent `4e296359` · branch `rescue-structural` · dev **380 (sem migration)** · zero Bank.

## Domínio / prova normativa

Domínio = **authority/guard tooling** (heurística de fronteira 0113). NÃO toca SSOT financeiro/semântico/temporal,
NÃO cria tabela/migration, NÃO acede `bank_*`. Fonte material de autoridade (`canActAs`/`requirePermission`)
**intocada** — só a INSTRUMENTAÇÃO (guard + prova negativa + 1 e2e-test) mudou. Precedência Constituição > Leis >
SSOT Registry respeitada; nada vencido.

## Mudança (GUARD-ONLY)

`backend/scripts/audit-actor-authority-boundary.mjs`:
- Novo recognizer `safeSubjectProof(code)` — prova SINTÁTICA LOCAL de subject server-side. Duas formas:
  - **(A)** `fastify.requirePermission([...])` preHandler → subject = req.user via rbac.plugin (estrutural).
  - **(B)** `requirePermission(tenantId, <subj>, <target>, ...)` com `<subj>` = const local derivada de
    `req.user.userId/req.user.id` **E** `subj !== target`.
- Novo allowlist auditado `SAFE_SUBJECT_READERS` (3 readers). Um arquivo só sai do escopo se for desse allowlist
  **E** a prova `safeSubjectProof` AINDA estiver presente em runtime (regressão: perdeu a prova → flagga → FALHA).
- `export { safeSubjectProof, ... }` + guarda `isMain` (só roda `runGuard()` quando invocado direto; importável p/ teste).
- `SUBJECT_EQUALS_TARGET` (hard-fail não-baselineável) **mantido** intacto.

## Baseline 7 → 4

| Arquivo | Decisão | Razão |
| --- | --- | --- |
| reporting | **removido** | subject = req.user.id → requirePermission(financial:view_all_ledger); query.actorId = filtro cross-actor; reads+export, sem move-money |
| business-audit | **removido** | fastify.requirePermission([admin:view_audit_logs]); GETs imutáveis |
| risk-dashboard | **removido** | subject = req.user.userId??id → requirePermission; GETs; spoof subject==target já CLOSED |
| bank-http | **mantido** | BANK hard-stop + move-money writers; resolveForUser ≠ requirePermission |
| payout | **mantido** | FINANCIAL hard-stop + move-money writers (subject server-side mas é money-writer) |
| policy-engine | **mantido** | MIXED num único arquivo (reads + mutations create/activate/apply/revoke); binding per-actor = R2 DECISION_REQUIRED; guard file-level não prova por-rota |
| trust | **mantido** | requireRole(admin) INTERINO + mixed writes; R2.4 congelado |

**Divergência honesta vs auditoria R2:** o READ-FIRST previa 4 removidos (incl. "policy-reads"). Fechei **3** —
`policy.routes.ts` mistura reads e mutations no mesmo arquivo; o guard é file-level e não isola os reads safe das
mutations DECISION_REQUIRED. Conservador (GO): manter mixed baselineado. Meta "7→3" **não forçada**; 7→4 é o honesto.

## Provas

| Prova | Resultado |
| --- | --- |
| guard | `flagged=4 baseline=4 new=0 stale=0 safe_subject_recognized=3` rc=0 |
| prova negativa — client-declared sem binding | guard FALHA → restaura ✅ |
| prova negativa — subject==target spoof | guard FALHA → restaura ✅ |
| recognizer unit (8 casos) | req.user.id ✅ · req.user.userId??id ✅ · fastify.requirePermission([...]) ✅ · reject actionContext ✅ · reject params ✅ · reject query ✅ · reject subject==target ✅ · reject server-subject==target ✅ |
| prova positiva | guard reconhece os 3 readers + new=0 ✅ |
| e2e risk-dashboard T6 (ajustado) | lógica verde contra guard vivo (nota spoof-CLOSED migrou p/ SAFE_SUBJECT_READERS) |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo |
| git diff --check | limpo nos 3 arquivos (sem whitespace error) |

## Hard stops respeitados

Zero runtime de produção (rotas/services/repositories intocados); só guard `.mjs` + prova negativa `.ps1` + 1 e2e-test
`.ts` (T6, ajuste de asserção de conteúdo do guard). Sem migration (dev 380). Sem RBAC V2/FASE6/R2 runtime. Sem
permission model real alterado. Sem actor_roles/company_roles/grants. Bank/payout/reversal/dispute/booking/order/
service_offering intocados. `requirePermission` NÃO promovido a soberano — só reconhecido como prova de subject
server-side em readers, com subj!=target obrigatório.

## Cartório

- `DT-0113-CLASSIC-CHANNEL-READERS`: PARTIAL — baseline 7 → 4 (3 removidos por prova de subject server-side).
- `DT-0113-AUTHORITY-CLIENT-DECLARED-ACTOR-BOUNDARY`: baseline 7 → 4.
- `DECISION-0124`: adendo FATIA A (3 readers reconhecidos; policy mantido mixed).

## Estado

F-R2-GUARD-SAFE-SUBJECT-RECOGNITION: **IMPLEMENTED / HOLD PARA RESEAL**.
