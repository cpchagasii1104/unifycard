# Execution Log — DECISION-0116 · Política canônica de ownership/visibilidade intra-tenant (docs-only)

**Data:** 2026-06-10
**Frente:** `F-G10-SHARED-TENANT-OWNERSHIP-VISIBILITY-GOVERNANCE`
**HEAD origem:** `3d8ad25b` · **Branch:** `rescue-structural` · **dev:** 365
**Modo:** DOCS-ONLY (zero código/migration/banco/frontend)
**Esteira:** auditoria READ-ONLY clusters 2–8 → roteamento a 6 especialistas → consolidação READ-ONLY (PASS IA Diretora) → **GO docs-only Clayton/IA Diretora**.

---

## 1. O que foi promulgado

`DECISION-0116 — Política canônica de ownership e visibilidade intra-tenant`, com **8 classes** (`PUBLIC_TENANT`, `ACTOR_PRIVATE`, `COMPANY_INTERNAL`, `GROUP_MEMBERS`, `PERSONAL_SENSITIVE`, `INSTITUTIONAL_ADMIN`, `MONEY_PARTIES`, `DEFAULT_DENY`) e mapeamento ratificado de recursos.

Enquadramento: **raiz irmã de `DECISION-0113`** (0113 = hint-confiado; 0116 = missing-scope). Causa = `DECISION-0115 D1` (tenant compartilhado). RLS tenant-scoped permanece correta como isolamento entre tenants.

## 2. Base material (consolidação das 6 especialistas, HEAD `3d8ad25b`, 1ª mão)

- **IA-DECISOES + IA-DT:** raiz = ausência de política canônica de visibilidade por recurso (NÃO "RLS não isola por actor"); grep de norma de visibilidade-por-recurso = ZERO; RLS é tenant-scoped por desenho (`20260516100000_rls_critical_tables.sql`, 7 tabelas).
- **IA-BANCO-DE-DADOS:** `suppliers.created_by_actor_id` NOT NULL FK→actors (audit, não owner); **`contacts` NÃO existe** (`to_regclass`=NULL; 6 consumidores → 42P01); daily-metrics com 2 queries fantasmas (42703) + cross-tenant; `escrow_accounts.buyer/seller_actor_id` NOT NULL FK; `inventory_movements.actor_id` NOT NULL FK + índice. Todas as tabelas: **0 linhas** (latência por dado).
- **IA-ACTOR-USERS (Eixo A+B):** `created_by_actor_id` = autoria histórica, não autoridade; `GET /groups/mine` = canal-1 spoof vivo + type confusion; rotas groups atrás do stub `actor_has_permission=FALSE` (mascaradas hoje, leak na FASE 6); `company_users.can_*` materializa autoridade de empresa (vivo).
- **IA-DINHEIRO:** escrow = M-real (FK a `bank_transactions`; write-path é o buraco maior); finance-agenda = M-projeção (metadata, não ledger); purchase-orders = comercial não-M (§5.9.1); daily-metrics = money-adjacent (`totalRevenue` = return 0).
- **IA-DOCUMENTOS:** mecânica cartorial (DT-mãe no DT_LOG, mapa separado, G10 congelado, proibido "denominador fechado"). _(Divergência "sem nova DECISION" adjudicada pela IA Diretora: a matriz de classes é vácuo genuíno → 0116 necessária.)_

## 3. Prova própria fechada (executora, READ-ONLY)

`GET /groups/mine` confirmado no código vivo: `groups.routes.ts:507` `const userId = req.actionContext.actorId;` → `getUserGroups(tenantId, userId)` → `groups.repository` `WHERE g.tenant_id=$1 AND gm.user_id=$2` (`group_members.user_id` FK→`users(user_id)`). Type confusion (actorId onde se espera user_id) + canal-1 spoofável sem `canRepresentActor`. Caller frontend vivo: `frontend/src/api/groups.ts:210`. Correção mínima = `req.user.userId` (independe da 0116).

## 4. Artefatos criados/alterados

- **Novo:** `docs/02_decisions/DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY.md`
- **Novo:** `docs/02_decisions/MAPA_DENOMINADOR_TENANT_SHARED_ISOLATION.md`
- **Novo:** este execution log
- **Append:** `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0116 + metadado "Última entrada")
- **Append:** `REMEDIATION_DT_LOG.md` (DT-mãe `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY`)
- **Topo:** `STATUS_EXECUCAO_GLOBAL.md`
- **Append:** `opus.md`
- **Normalização protocolar:** memórias especialistas (flip cabeçalho ABERTO→RESPONDIDO) + `MINHA_MEMORIA_EXECUTORA_UNIFICARD.md` (checkboxes + nota append-only).

## 5. Gates

`validate:actor-writer-boundaries`, `validate:bank-ledger-boundaries`, `validate:regression-guards`, `validate-architectural-patterns.mjs --strict` — esperado 4/4 OK (docs-only não altera runtime; dev 365; critical_new=0).

## 6. Escopo intocado / STOPs

Zero código/migration/banco/frontend. `contacts` NÃO materializada; archive NÃO restaurado. `GET /groups/mine` NÃO implementado (próxima fatia, GO próprio). suppliers/inventory/PO/escrow/finance-agenda/daily-metrics NÃO tocados. C1/tenant compartilhado NÃO liberado; R2 congelado; FASE 6 não liberada; `DECISION-0113` NÃO declarada fechada; denominador global NÃO declarado fechado.

## 7. Próximo passo

Fatia de código `GET /groups/mine` (sob GO próprio) — fecha leak Classe-A vivo independente da 0116. Depois: enumeração do denominador Classe-A finito → hardening por classe (suppliers/inventory/PO) → gate de regressão → Yala → só então C1 liberável. Money (escrow/finance-agenda) em frente própria três paralelas.
