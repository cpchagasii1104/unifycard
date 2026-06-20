# F-DB-ROLE-AND-RLS-HARDENING — EXECUTION (MACRO MATERIAL · RLS deixa de ser teatro · payout NÃO autorizado)

Elimina o bloqueador **"RLS theatre"** do Decision Pack: a app conectava como `postgres`/superuser, que BYPASSA RLS
mesmo em tabelas FORCE. Esta frente cria a **role de aplicação não-superuser/não-BYPASSRLS** `unificard_app`, endurece
RLS+FORCE+policy tenant-scoped nas 7 tabelas payout/approval/recovery, e adiciona um **pre-flight fail-closed** que
recusa money runtime inseguro. **NÃO abre payout, NÃO semeia PORTA-1, NÃO liga worker, NÃO abre external payout, NÃO
relaxa bank_*, NÃO altera destination_type, NÃO toca runtime de payout/worker/Bank/KYC/recovery.**

- **HEAD before:** `654932ef` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before:** limpo no escopo material (docs/memorias + untracked alheios) · **after:** limpo (committado)
- **migrations before/after:** 394 → **395** (+1: `20260620120000_db_role_rls_hardening.sql`) · **modo:** EXECUTOR (ultracode) · **natureza:** macro material / DB role + RLS hardening + pre-flight fail-closed

## READ-FIRST / discovery
- **role discovery:** runtime conecta via única `DATABASE_URL` = `postgresql://postgres@localhost/unificard_dev`.
  `current_user` = **postgres** = **superuser** (rolsuper=true). Sem app role prévia; existe `unificard_infra` (bypass de
  worker, criada em 20260516100000). Migrations e runtime usam a mesma conexão.
- **RLS discovery:** mecanismo de tenant vivo e canônico = `current_setting('app.current_tenant', true)`, setado
  transaction-local por `getClientWithTenant`/`runQueryWithTenant` (`set_config('app.current_tenant',$1,true)`).
  `bank_ledger/bank_transactions/bank_accounts/bank_splits/actors/...` já são RLS+FORCE+policy (20260516100000) — **não
  tocadas**. As 7 tabelas payout/approval/recovery estavam **BARE** (sem RLS), todas com `tenant_id UUID NOT NULL`.

## Implementado (migration + pre-flight + guard + test; sem tocar runtime de dinheiro)
- **Migration** `20260620120000_db_role_rls_hardening.sql` (idempotente, BEGIN/COMMIT):
  - **role `unificard_app`**: `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION` (auto-curativa via ALTER
    se já existir). Criada NOLOGIN — ops adiciona `LOGIN PASSWORD` fora do repo (sem segredo versionado).
  - **grants mínimos**: CONNECT (database corrente via `format()`), USAGE no schema, SELECT/INSERT/UPDATE/DELETE em
    ALL TABLES, USAGE/SELECT em sequences, EXECUTE em functions, + ALTER DEFAULT PRIVILEGES p/ objetos futuros.
    **SEM** CREATE no schema, **SEM** superuser/BYPASSRLS/CREATEROLE/CREATEDB, **SEM** `unificard_infra` (a app nunca
    recebe bypass).
  - **RLS+FORCE+policy** nas 7 tabelas (mesmo padrão canônico de 20260516100000; chave `app.current_tenant`): policy
    tenant (`USING`+`WITH CHECK`) + `*_infra_bypass TO unificard_infra USING(true)` (apenas infra, nunca app). Bloco de
    verificação final exige relrowsecurity+relforcerowsecurity nas 7.
- **Pre-flight** `src/core/database/db-role-rls-preflight.ts`: `inspectDbRoleSecurity` (pg_roles rolsuper/rolbypassrls +
  pg_class relrowsecurity/relforcerowsecurity + pg_policies) · `assertSecureDbRoleForMoneyRuntime` (lança
  `DB_ROLE_IS_SUPERUSER`/`DB_ROLE_BYPASSRLS`/`RLS_REQUIRED_TABLE_DISABLED`/`RLS_REQUIRED_POLICY_MISSING`/`DB_ROLE_RLS_UNSAFE`)
  · `runDbRoleRlsPreflight` (boot: **produção = fail-closed (lança)**; não-produção = aviso ALTO não-bloqueante, pois o
  dev ainda roda como postgres até a troca operacional). Wired em **BOOT.ts** (após DB info, antes dos workers).
  bank_* NÃO são re-listadas no pre-flight (respeita NO_DIRECT_BANK_TABLE_ACCESS; já cobertas por guard próprio).
- **Guard** `audit-db-role-rls-hardening.mjs` (em `validate:regression-guards`): exige role NOSUPERUSER/NOBYPASSRLS,
  ENABLE+FORCE+policy tenant-scoped nas 7, proíbe `USING(true)` app-facing (só infra), proíbe DISABLE/`row_security=off`,
  proíbe relaxar bank_*, exige pre-flight (pg_roles+rolsuper+rolbypassrls+assert+fail-closed-produção) wired no BOOT.
- **Test material** `validate-rls-tenant-isolation.ts` + runner efêmero `run-rls-isolation-ephemeral.ps1`
  (`validate:db-role-rls-hardening`).

## Provas materiais (DB efêmero `unificard_rls_hardening_e2e`) — 7/7
1. admin (postgres) É superuser e **vê AMBOS tenants** (bypass = o teatro). 2. `unificard_app` é **NOSUPERUSER+NOBYPASSRLS**.
3. sob `unificard_app`, RLS **isola por tenant** (A→1, B→1). 4. cross-tenant INSERT **bloqueado por WITH CHECK** (SQLSTATE
42501). 5. `assertSecureDbRoleForMoneyRuntime` **PASSA** sob `unificard_app`. 6. pre-flight **LANÇA `DB_ROLE_IS_SUPERUSER`**
sob admin. → **RLS deixa de ser teatro.**

## Negative-proofs (`negative-proof-db-role-rls-hardening.ps1`, pwsh 7 + WPS 5.1) — 7/7 mordem
NP1 app→SUPERUSER · NP2 app→BYPASSRLS · NP3 remove FORCE de tabela crítica · NP4 policy `USING(true)` app-facing ·
NP5 pre-flight deixa de consultar pg_roles · NP6 DISABLE RLS ativo · NP7 relaxa RLS de bank_ledger. Cada um: mutação
mínima → guard FAIL → restauração byte-idêntica → git limpo → guard OK.

## NÃO-GO preservado
payout: **NOT AUTHORIZED** · PORTA-1: **NOT SEEDED** (financial_approval real não criado) · ENABLE_PAYOUT_WORKER:
**default-off** · HTTP execution: **disabled/403** · external payout/PIX-out/TED/PSP: **NÃO aberto** · destination_type:
**internal_settlement-only (inalterado)** · Bank/Core runtime: **não relaxado** (bank_* RLS preservada; BankTransactionPort/
ledger/KYC/recovery intocados) · `financial_approval_policies/authorities` reais: **0/0** (fixtures só em efêmero).

## Gates
actor-writer OK · bank-ledger OK · regression-guards **76 OK / 0 FAIL** (+1: db-role-rls-hardening) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existentes) · check:migrations **395/395** (numeração/sufixos OK) · tsc **34**
(nenhum novo desta frente; Yala consolida 43) · `validate:db-role-rls-hardening` **OK (7/7)**.

## Estados
- `F-DB-ROLE-AND-RLS-HARDENING` → **EXECUTED / PENDING YALA**.
- **Payout NOT AUTHORIZED · PORTA-1 NOT SEEDED · worker default-off · external payout NOT AUTHORIZED.**
- `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` permanece **OPEN** (inalterada).

## Operacional (fora desta frente; sem segredo no repo)
Para o runtime efetivamente deixar de ser superuser: ops deve `ALTER ROLE unificard_app WITH LOGIN PASSWORD '…'` e
apontar a conexão de runtime para `unificard_app` (mantendo postgres/admin só para migrations). Enquanto isso, o
pre-flight de boot avisa em dev e **falha-fechado em produção**.

## Veredito
RLS deixa de ser teatro: app role não-superuser/não-bypassrls criada, RLS+FORCE+policy nas 7 tabelas financeiras, RLS
prova-se mordendo cross-tenant, pre-flight fail-closed em produção. Payout segue fechado. **Próxima macro:
F-PAYOUT-TOCTOU-SAFETY-HARDENING** (não PORTA-1).
