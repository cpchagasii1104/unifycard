# PLANO DEFINITIVO — DECISION-0131 · MAPA DE EXECUÇÃO PARA A EXECUTORA

**HEAD vivo:** `20fe30cc` · branch `rescue-structural` · **dev 385/385** · 2026-06-14
**Origem:** consolidação de 1ª mão das 8 fatias (DT · Documentos · Tempo · YALA · Dinheiro · Banco · Decisões · Actor-Users).
**Estado:** insumo. **NÃO promulgado.** Execução gated em (1) rulings §B de Clayton e (2) DECISION-0131 docs-only + reseal Yala. READ-ONLY até lá.

---

## §0 — COMO LER ESTE PLANO

- `[independente]` = pode ir assim que houver GO + 0131 promulgada; não depende de ruling §B.
- `[gated: Bn]` = espera o ruling §B correspondente (numeração canônica em §2).
- Toda **contenção/tombstone** sela só com **TRIPÉ**: guard em `validate:regression-guards` + negative-proof que **morde** (falha se a porta reabrir) + e2e.
- Nenhuma frente é "definitiva-fechada" enquanto §B não for cravado. Este plano é o **mapa**; vira execução-fechada quando os gates colapsam.

---

## §1 — BASELINE PROVADO VIVO (1ª mão · não retrabalhar)

- `financial_approval_policies/authorities/events` = **0/0/0** → payout fail-closed para todos (substrato **materializado, não semeado**).
- `actor_delegations` = **9 total / 0 ativas / 9 revogadas** (wired via V5, **inerte**).
- `company_users` = **2 / 0 divergência** `is_active`×`member_status`.
- **Ausentes** (`to_regclass` NULL): `organization_members`, `user_identity_links`, `platform_operator_grants`, `cargo_templates`.
- RBAC legado **semeado** (8 roles / 76 perms / 1 user_role) + `actor_has_permission()` = **RETURN FALSE** (deny-all stub).
- **RLS = 0 em TODOS os 6 planos de autoridade** (`company_users`, `actor_delegations`, `financial_approval_authorities`, `tenant_operator_grants`, `reconciliation_disputes`, `reversals` — todos `rls=f/forced=f/0 policies`). Isolamento só app-level.
- **Gate authority-field-from-client JÁ EXISTE**: `audit-actor-authority-boundary.mjs` + `negative-proof-actor-authority-boundary.ps1`, em CI, com `SUBJECT_EQUALS_TARGET` não-baselineável.
- **T11 (body.actor)**: **7/7** rotas que declaram actor no body bindam `canRepresentActor` fail-closed → **CONTIDO**. ⚠️ Canal-1 `actionContext.actorId` em ~18 rotas (incl. money) **não** verificado → frente B2f.
- **T5 (dispute/reversal)** = **CONTIDO 4/4** (`parseActor` sem def/import). Payout executor HTTP = **403**; **aprovar≠executar** (executor só no worker `actor-wallet-payout-worker.ts:74`).
- 5 selos financeiros vivos em `regression-guards`; `bank_ledger` = SSOT append-only.
- baseline DECISION-0113 = **0** (recognized=6).
- **C63** (`schedules`/`schedule_slots`) morto no código (só comentários); REVOKE existe (`20260428200000`) — confirmar aplicação no banco.
- **Cartório:** §10.2 deprecia `user_identity_links` (NÃO `organization_members`); header do LOG diz "0116" (stale; corpo vai a 0130); `DECISOES.md` não indexa ≥0128; **0131 livre**; convenção recente = `## DECISION-`.
- **0121–0130 já promulgam grande parte do mapa** → 0131 é majoritariamente **CITA**, não decide.

---

## §2 — §B CANÔNICO (numeração do INSTRUMENTO) + remap + sinal das fatias

| Bn | Tema | Tipo | O que as fatias sinalizam (informa, não decide) | Remap |
|----|------|------|--------------------------------------------------|-------|
| **B1** | cargo-template | ABERTA | desenho catálogo-template limpo: `cargo_templates` greenfield + `grant_origin` nos planos + cascata de revogação; runtime lê **só grant material**, nunca o cargo | IA-Decisões chamou de "B2" |
| **B2** | contrato temporal comum | ABERTA | envelope por substrato de **GRANT** (aditivo); **agenda-time é SEPARADO** (veto colapso Booking/AvailabilityStatus); `financial_approval_authorities` **fica no Core** · **depende de B3** | IA-Decisões "B3" |
| **B3** | mapper de identidade | ABERTA (mais profundo) | `actor_id` canônico (Lei D2) + mapper explícito; **PRÉ-REQ de B2 e B5** (não migrar plano sem chave canônica) | não enumerado por IA-Decisões; é o S0 da IA-Banco |
| **B4** | normalização T6/T9 | RATIFICAR (Art.17) **+ backfill** | `member_status`=SSOT, `is_active`=projeção, `role='owner'`≠supergrant eterno; **flipar V2 EXIGE backfill de capability antes** (senão quebra acesso) | IA-Decisões "B4" |
| **B5** | RLS nos planos de autoridade | ABERTA | forçar RLS nos 6 planos (substrato de dinheiro); IA-Banco pronta com DDL | não enumerado por IA-Decisões; é o S2 da IA-Banco |
| **B6** | platform/cross-tenant | RATIFICAR (deferir) | deferir P4; **não** criar `platform_operator_grants`; tenant-scope segue 0126 | IA-Decisões "B7" |
| **B7** | vocabulário + hard-rule + guards | RATIFICAR | 5 estados + hard-rule 6º canal **de jure** + `assertActorRepresentable` **invariante não-removível** + guards de tombstone | IA-Decisões "B1/B5/B6" |

> **Reframe vinculante (IA-Actor-Users):** "body.actor" **não** é 6º canal novo — é a **variante body** dos 5 canais 0113 (`actionContext` · `x-actor-id` · `query` · `params:actorId` · `params:id-recurso`). A hard-rule de B7 se escreve uma vez: *qualquer superfície com actorId declarado (5 canais + variante body) exige binding `canRepresentActor`*. Sem taxonomia paralela.

---

## §3 — FRENTES (mapa de execução, por trilha e ordem de dependência)

### TRACK A · CARTÓRIO / NORMA
- **A1** `[independente, sob GO]` Higiene pré-0131: header do LOG `0116`→atual · corrigir citação §10.2 (`user_identity_links`) no mapa/instrumento/rascunho · back-fill 0128–0130 + indexar 0131 em `DECISOES.md` · convenção `## DECISION-0131`. *Files:* `REMEDIATION_DECISIONS_LOG.md`, `DECISOES.md`.
- **A2** `[gated: rulings §B]` **Opus** redige DECISION-0131 docs-only (índice: CITA 0013→0130 + cânone; PROMULGA B1–B7 conforme rulings; cabeçalho "DERIVA DE / SUBORDINADA A" + AUTHORITY_PRECEDENCE; os **6 guards "parece emendar"** da IA-Decisões). *File:* `docs/02_decisions/DECISION_0131_*.md`.
- **A3** `[gated: A2]` Entrada append-only no LOG + index. **Opus.**
- **A4** `[gated: A2]` **Reseal Yala.**

### TRACK B · SUPERFÍCIES DE AUTORIDADE (código)
- **B1f** `[independente]` **Estender** (não criar) o gate authority-field-from-client: reconhecer binding seguro em `requirePermission`/`requireRole` para `reporting`/`business-audit`/`policy-engine` → classic readers **7→3** (sobram `payout`+`bank-http` financeiro legítimo e `trust` R2-congelado). *File:* `audit-actor-authority-boundary.mjs`.
- **B2f** `[independente, CRÍTICO money]` Sweep + classificar canal-1 (`actionContext.actorId`) nas ~18 rotas Padrão B de `event.routes` (incl. `refund`/`chargeback`/`execute`). **VERIFICAR de 1ª mão:** essas rotas passam por `assertActorRepresentable` (rbac.plugin)? Se sim → canal-1 bound; se não → autoria spoofável em money. Cada rota → "self-segura (gate no service)" ou "binder". *STOP:* gate service-level **não** verificado — classificar, não concluir seguro.
- **B3f** `[independente]` Fix `groups/mine`: trocar fonte para `req.user.userId` (hoje passa `actionContext.actorId` → compara `gm.user_id` → namespaces distintos → retorna vazio). E2E: caller A não vê grupos de B. **Bug+design, não leak ativo.** *Files:* `groups.routes.ts:507`, `groups.repository.ts:463-478`.
- **B4f** `[independente, URGENTE]` `daily-metrics`: adicionar filtro `tenant_id` (hoje `pool.query` sem tenant = **leak cross-tenant**; "TODO admin" nunca implementado). *File:* `daily-metrics.routes.ts`.
- **B5f** `[gated: decisão de produto (papel/permissão)]` Gate `contacts` (PII: tax_id/email/phone cross-user) e `suppliers` (B2B cross-user). Sem FK de actor-owner → gate **institucional** (`company_users`/permissão), **não** `canRepresentActor`.

### TRACK C · SCHEMA DE AUTORIDADE (gated; ordem rígida C1→C2/C3)
- **C1** `[gated: B3]` **Mapper de identidade** `user_id`↔`global_user_id`↔`actor_id`. **PRÉ-REQ de C2 e C3.** Se ruling = `actor_id` canônico → normalizar FKs dos planos (migration ampla); se = função central → sem tabela nova.
- **C2** `[gated: B2 · depende de C1]` **Envelope temporal comum** nos substratos de GRANT (`actor_delegations`, `tenant_operator_grants`, `company_users`): `ADD COLUMN` aditivo nullable (`valid_from`/`valid_until`/`suspended_at`/`reason`/`created_by`/`revoked_by`); backfill `valid_from=created_at`; `tenant_operator_grants` é o mais fraco. `financial_approval_authorities` **NÃO toca** (fica no Core). **VETO:** colapsar `Booking`/`AvailabilityStatus` (agenda-time é eixo separado).
- **C3** `[gated: B5 · depende de C1]` **RLS** nos 6 planos: `ENABLE`+`FORCE ROW LEVEL SECURITY`+policy por `tenant_id` (espelhar `bank_ledger`/`user_roles`); **validar bypass de `unificard_infra` antes** (não quebrar workers/seed).
- **C4** `[independente]` **Rastro de operador no reversal**: `ADD COLUMN initiated_by_user_id` + `initiated_authority_id` (nullable); `chk_external_reversal_is_systemic` permanece válido (não toca `performed_by_user_id`). **Pré-req de Card-1.**

### TRACK D · REPRESENTAÇÃO / NORMALIZAÇÃO (gated)
- **D1** `[gated: B4 · COM BACKFILL]` Normalizar T6/T9: `member_status`=SSOT, `is_active`=projeção, `role='owner'` não-supergrant. **Sequência obrigatória:** MEDIR (`SELECT count(*) FILTER (WHERE can_manage_company)` vs `FILTER (WHERE role='owner' AND NOT can_manage_company)` em `company_users WHERE member_status='active'`) → **BACKFILL** `can_manage_company` para owners legítimos → **só então** flipar V2 (`canManageCompany`) → guard. Unifica as 2 lógicas OR (`checkOwnership`×`canManageCompany`). *DTs:* CHECKOWNERSHIP-STALE + PJ-ROLE-VOCABULARY-MISMATCH + PJ-ONBOARDING-ROLE-DUPLICATE.
- **D2** `[gated: B1, se catálogo]` `cargo_templates` greenfield (`id,tenant_id,name,capabilities_json,created_by`) + `grant_origin` nos planos; revogar cargo **cascateia** nos grants; runtime lê **só grant material ativo**; `grant_origin` = proveniência **imutável**, nunca autoridade atual (`canRepresentActor` já não lê nome de cargo).

### TRACK E · TEMPO (mostly independente)
- **E1** `[independente]` Citar `availability-owner-authority.ts` (DECISION-0118 D2) como **exemplar canônico** na 0131 ("dono do recurso ≠ actor de autoridade"). Doc-only (já implementado; policy==enum 6/6).
- **E2** `[independente]` Selar C63 tombstone temporal: confirmar REVOKE aplicado (`schema_migrations` `20260428200000`) + DT CLOSED.
- **E3** `[gated: ruling group authority / converge com D1]` Convergir fallback GROUP (`COALESCE(owner_actor_id, actor_id)`) com a normalização de group authority — não deixar fallback órfão.

### TRACK F · TOMBSTONE GUARDS (independentes; texto em `PROHIBITED_STRUCTURES.md` gated A2)
- **F1** `[independente]` Guard anti-reativação de `actor_has_permission` (stub `RETURN FALSE`) sobre os 8 roles/76 perms **semeados** — travar o **SWAP** + nenhum reader vivo de `user_roles` como autoridade. Tripé. *(Risco não é a tabela existir — é "ligar a FASE 6" e o decisor passar a ler 8/76 legados.)*
- **F2** `[independente]` Guard `organization_members` (ausente) + `user_identity_links` (ausente): falha se recriar tabela OU caller. Tripé.
- **F3** `[independente]` Guard `actor_has_any_role` (lost-in-rebase). Tripé.

---

## §4 — TRILHA CARTÃO FÍSICO (DECISION própria ≥ 0132 · FORA da 0131)

Ordem **obrigatória** antes de abrir a DECISION de cartão:
- **Card-0** 0131 promulgada + reseal (A2–A4).
- **Card-1** T5 dispute/reversal **reabilitado COM binding** (`canRepresentActor`/operador financeiro) + **C4** (rastro de operador) + 3 paralelas + E2E + reseal. *(hoje 403; nunca o `body.actor`/`system` de antes.)*
- **Card-2** Autorização/captura via `bank_ledger` com **idempotência por reference**; `unifycard_transactions` = LOG, não SSOT.
- **Card-3** Core financeiro **SEMEADO** (PORTA-1) + scope `physical_card_authorization` (migration do `scope` CHECK — hoje só `actor_wallet_payout`) + rever teto MVP (R$500/R$1500).
- **Card-4** Gate **KYB explícito** PJ→KYB material do negócio + **pino do invariante page-actor** (page-actor não tem `actor_wallet` sem passar pelo gate). *(Hoje PJ é barrada só pelo acidente `global_user_id`=NULL.)*
- **Card-5** **KYC externo de payout** (DT-PAYOUT-EXTERNAL-KYC-GATE-MISSING) + **substrato de ordem de payout externo** (DT-EXTERNAL-PAYOUT-ORDER-SUBSTRATE-MISSING).
- **Card-6** T12 `financial:*` classificado (FM-2): `view_*`=adaptador (`view_all_ledger` exige gate ADMIN real); `execute_payout`=reclassificar para leitura/relatório OU tombstone (não-autoridade).
- **Card-7** T10 plano platform/cross-tenant (B6) **OU** explicitamente fora do MVP do cartão.
- **Card-8** canal-1 money authorship em `event.routes` classificado + bound (B2f).
- **Card-9** RLS nos planos (C3).
- **Card-10** Resíduos 0113 DT-mãe + superfícies clássicas fechados (B1f reduz; `payout`/`bank-http` baseline legítimo).
- **Trava de escopo:** nenhum grant comum (`company_users`/`tenant_operator_grants`/`role`) autoriza cartão — **só o Core**. `availableBalanceCents` nunca autoriza; `amount_cents` BIGINT.

---

## §5 — PORTAS SOBERANAS (seed = promulgação · NÃO entram no GO da executora)

- **PORTA-1** 1ª row em `financial_approval_policies`+`authorities` → payout **aprovável** (hoje 0/0 = fail-closed). DECISION de **quem aprova e até quanto** (0130 D1/D4).
- **PORTA-2** swap do `RETURN FALSE` em `actor_has_permission` → liga RBAC legado (8/76). Exige reclass + reseal.
- **PORTA-3** 1ª delegação não-revogada → liga delegação **viva** (hoje 0 ativas). Exige proveniência + E2E ativo + reseal.

> A executora **prepara o tripé** que prova "fail-closed quando vazio"; o INSERT da 1ª row é **ato soberano de Clayton**, com sua própria DECISION/reseal — nunca migration de dado casual.

---

## §6 — SEQUÊNCIA DE ATIVAÇÃO

0. *(já pode, sob GO)* **A1** higiene cartorial.
1. **Clayton rula §B** (B1–B7) no instrumento.
2. *(read-only, paralelo, bloqueia A2)* **F-CANON-CONFIRM** (mapa × cânone soberano, sem divergência aberta — IA-Documentos/Decisões) + **LIVE-PROOF-T8** (proveniência das 9 revogadas no dev 385).
3. **Opus** redige 0131 docs-only (**A2**) → append + index (**A3**).
4. **Yala** reseal (**A4**).
5. Executora roda os **INDEPENDENTES**: B1f · B2f · B3f · B4f · C4 · E1 · E2 · F1 · F2 · F3 — cada selo com **tripé**.
6. Executora roda os **GATED**, em ordem de dependência: **C1**(B3) → **C2**(B2) → **C3**(B5); **D1**(B4 com backfill); **D2**(B1); B5f · E3 · B6 conforme rulings.
7. **Card track** abre como DECISION 0132 só após **Card-0…Card-10**.

---

## §7 — STOPS UNIVERSAIS (de todas as fatias)

- Não promulgar 0131 sem Clayton; **não fechar 0113 de carona** (DT-mãe segue OPEN; 6º canal = cobertura na DT-mãe, não fecho).
- **R2/delegação não-ativável como autoridade viva** sem proveniência + E2E + reseal **e** sem fechar resíduos 0113 / superfícies clássicas.
- **Cartão = DECISION própria (≥0132)**; não nasce em "financial authorization" antes de Card-1…10.
- **Seed (PORTA-1/2/3) = ato soberano**, nunca migration casual.
- **Agenda nunca autoriza dinheiro**; envelope temporal = auditoria, nunca autoridade decisória.
- `availableBalanceCents` nunca autoriza; saldo só `bank_ledger`; `amount_cents` BIGINT.
- **Citar** 0013/0042/0113/0114/0116/0121/0124/0125/0126/0127/0128/0129/0130 — nunca reescrever cabeçalho.
- Toda contenção/tombstone sela **só com tripé** (guard + negative-proof que morde + e2e).
- `assertActorRepresentable` = **invariante não-removível** (única barreira anti-spoof quando a FASE 6 ligar `actor_has_permission`).

---

*Plano definitivo como MAPA. Colapsa para execução-fechada quando os rulings §B forem cravados; nada executa antes de A2–A4.*
