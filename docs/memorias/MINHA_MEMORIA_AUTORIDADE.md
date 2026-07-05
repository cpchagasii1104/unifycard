# MINHA MEMÓRIA — IA-AUTORIDADE (Autoridade, Permissões e Grants)

> Memória soberana da instância READ-ONLY **IA-AUTORIDADE**, sob coordenação da IA-DIRETORA.
> Append-only. Disco vence narrativa. Eixo: "o que o actor **PODE**" (grant/capability/permissão/aprovação),
> NÃO "esse actor é meu" (IA-ACTOR) nem "o dinheiro que move" (IA-DINHEIRO).

---

## Entrada 1 — Re-baseline do eixo (RODADA 1) · 2026-06-20

**HEAD vivo:** `dd270f41` · branch `rescue-structural` · 395 `.sql` no disco.
**Revalidado de 1ª mão:** migrations + função SQL `actor_has_permission` + caller `rbac.service.ts`.

### Substrato 0125–0138 — estado MATERIALIZADO (disco vivo)
- **`actor_capability_grants` (0136) — MATERIALIZADO mas INERTE.** `20260616210000_create_actor_capability_grants.sql:29`. Substrato puro: **ZERO enforcement em rota de negócio** (cabeçalho :7). Allowlist **NÃO-FINANCEIRA** por construção (`CHECK chk_acg_capability_nonfinancial:65` → só `calendar:block/unblock`, `services:create/edit/disable`). grantee = `actor_id` server-side (nunca slug/referral — lookup ≠ authority); `scope_type='actor'` only; sem backfill. → **materializado ≠ ligado.**
- **`tenant_operator_grants` (0126):** `20260614120000_create_tenant_operator_grants.sql`.
- **`actor_delegations` (delegação):** `20260530493000_create_actor_delegations.sql`. PORTA-3 = 1ª ativa = ato soberano.
- **`company_users.can_*` / R2 fine grants (0125):** `20260530520500_add_company_users_rbac_columns.sql` · `20260613170000_add_company_users_r2_fine_grants.sql`.
- **trust grants (0127):** `20260530450000_trust_tables.sql` · `20260530513000_create_authority_trust_levels.sql` · `20260614130000_add_tenant_trust_grants.sql`.
- **Aprovação financeira (0128/0130) — MATERIALIZADO, VAZIO por desenho (fail-closed):** `20260614150000_financial_approval_policy_materialization.sql` cria `financial_approval_policies` (:15), `financial_approval_authorities` (:42), `financial_approval_policy_events` (:66). Teto MVP travado no banco (`max ≤ 50000`/`daily ≤ 150000`, CHECK :29/:56). Eventos append-only (trigger D9 :96-104). "Sem backfill", "SEM autoridade automática owner/admin (D1/D11)". Core de governança: `20260614140000_financial_approval_core_governance.sql` (idempotência + append-only votes + terminal congelado sobre `approval_requests`/`approval_votes` 0054).
- **permission keys / tri-registry (0135/0137):** registro **em código** (`backend/src/core/authorization/permission-keys.ts`), não DB.
- **operador de agenda por grant (0138):** **NÃO materializado — RFC apenas** (`DECISION_0138_CALENDAR_OPERATOR_GRANT_AUTHORITY_RFC.md`). DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION OPEN.

### Stub `actor_has_permission` — deny-all VIVO
`20260422000100_actor_has_permission_fail_closed.sql:24` → `RETURN FALSE` incondicional (C47/DECISION-0013). Caller único vivo: `backend/src/core/rbac/rbac.service.ts:124` (RBAC V2). FASE 6 substituiria. Religar lê **8 roles/76 perms legados** = reactivation-trap.

### INCONCLUSIVO read-only (→ IA-BANCO-DE-DADOS)
- **Contagem `financial_approval_*` (0/0/0?):** por desenho = vazio fail-closed; **número exato exige SELECT no banco vivo**.
- **RLS nos 6 planos de autoridade:** *RLS existir ≠ RLS ativa* (inerte sob `postgres`/superuser/bypassrls). Sinal adjacente da IA-BANCO (§14.9): `service_payment_requests rls=f` × `service_payment_executions rls=t`.

---

## STOPs INVIOLÁVEIS do eixo (permanentes)
- role/status/flag ≠ autoridade (AUTHORITY_LAW Art.17).
- `actor_has_permission()` = stub `RETURN FALSE` — NÃO reativar sem reclass + reseal (fronteira leak-vivo × reactivation-trap).
- `assertActorRepresentable` = invariante NÃO-removível (única barreira anti-spoof se FASE 6 ligar).
- `grant_origin`/cargo = proveniência IMUTÁVEL, nunca autoridade atual (runtime lê só grant material ativo).
- aprovar ≠ executar (payout: approve fail-closed; executor só no worker).
- PORTA-1 (1ª row `financial_approval`) · PORTA-2 (swap do `RETURN FALSE`) · PORTA-3 (1ª delegação ativa) = ATO SOBERANO de Clayton, nunca migration casual.
- R2/delegação e FASE 6 congelados enquanto DECISION-0113 OPEN.
- Análise = INSUMO para a IA-DIRETORA; nunca GO, nunca promulgação, nunca código.

## Fronteiras de eixo
- IA-ACTOR = "esse actor é meu / represento" (`canRepresentActor`). EU = "tem o grant X".
- IA-DINHEIRO = o dinheiro que MOVE (`bank_ledger`). EU = AUTORIDADE de aprovar/segregar. Superfície financeira com fail-open de autoridade → as DUAS respondem.
- Prova-viva (RLS, contagem, flag/FASE 6, `\d`) → INCONCLUSIVO + IA-BANCO-DE-DADOS.
