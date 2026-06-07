# Execução — F-PJ-DELETE-GUARD-BANK-PORT (Lei 5 / DECISION-0088 / modelo actor-keyed) — backend

**Data:** 2026-06-07 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**Decisão:** Clayton — fechar o pilar "deletar com segurança" do arco PJ. **Esteira:** eu (escritora); par verifica READ-ONLY.

## Objetivo
Corrigir `companiesService.deleteCompany` para bloquear **fail-closed** a exclusão de PJ com vínculo financeiro material, removendo a dependência de tabelas fantasmas e usando o **Bank READ PORT canônico** — sem SQL direto em `bank_*`.

## READ-FIRST (confirmado de primeira mão)
- **Guard legado fantasma:** `deleteCompany` consultava `accounts` (`owner_id/owner_type='company'`, l.2011) e `transactions` (`from_account/to_account`, l.2024) — **nenhum `CREATE TABLE accounts/transactions` no backend** (grep vazio). Logo `42P01 relation does not exist` em **qualquer** exclusão: o guard nunca protegeu e a exclusão quebrava por exceção.
- **Bônus-bug:** soft-delete usava `runQueryWithTenant(...) as { rowCount }`, mas `runQueryWithTenant` devolve `rows[0]` (`pool.ts:190`); um UPDATE sem `RETURNING` volta `undefined` → boolean de sucesso não-confiável.
- **SSOT financeiro = actor-keyed** (`0003_bank_core.sql`): `bank_accounts.owner_type ∈ {actor,system,escrow}` (**não existe `'company'`**), `actor_id REFERENCES actors(id)`; `bank_transactions`/`bank_ledger`/`bank_splits` com `actor_id NOT NULL`. **Conclusão:** o footprint financeiro de uma PJ é inteiramente actor-keyed → os ports actor-keyed cobrem tudo. **Sem STOP** (o port expõe leitura suficiente).
- **Bank READ PORT canônico:** `bankPortsRegistry.getBankTransactionRead()` (injetado em `app.builder.ts:82`) → `getWalletSummaryByActorId(tenantId, actorId)` (saldo + accountsCount) + `listRecentTransactionsByActorId(tenantId, actorId, {limit})` (movimentos). Precedente de consumo em `core`: `dashboard.service.ts:34-40` (import dinâmico do registry; sem acoplar core→modules).
- **Resolver company→actor:** `actors.company_id` (a página/actor da empresa; criada por `createCompany` — confirmado pelo cleanup `DELETE FROM actors WHERE company_id` nos e2es PJ).

## Implementação (backend, sem migration)
`core/companies/companies.service.ts` — `deleteCompany`:
1. Resolve os actors da empresa: `SELECT id FROM actors WHERE tenant_id=$1 AND company_id=$2` (`runQueriesWithTenant`, multi-row). Leitura de **identidade** (`actors`), **não** de `bank_*`.
2. Se há actors: `getBankTransactionRead()` e, por actor, `Promise.all([getWalletSummaryByActorId, listRecentTransactionsByActorId({limit:1})])`.
   - `catch` → **fail-closed** `PJ_DELETE_BLOCKED_BANK_UNAVAILABLE` (incerteza no port = não posso provar ausência de vínculo).
   - `saldo≠0` (`summary.balanceCents`) OU `movimento` (`recentTxs.length>0`) → **bloqueia** `PJ_DELETE_BLOCKED_FINANCIAL_LINK`.
3. Sem actor, ou actor sem conta/saldo/movimento → segue para o soft-delete (**permitido** — preserva a regra atual: conta vazia não bloqueia; só vínculo material).
4. Soft-delete: `UPDATE companies SET status='inactive', updated_at=NOW() WHERE … RETURNING company_id` → `return deletedRow != null`. Mexe só em `status` (operacional) — **NÃO** toca `company_status`/KYB/documentos.

## Fronteiras respeitadas (escopo do envelope)
SEM migration · SEM SQL direto em `bank_ledger`/`bank_transactions`/`bank_accounts` (só o port) · SEM KYB/documentos/wizard · SEM actionContext hardening · SEM provider produção/scanner · SEM ACTIVE writer · `company_status`/KYB/documentos intocados.

## Prova
- **e2e** `validate-pipeline-e2e-pj-delete-guard-bank-port` **17/17**: D1 sem-vínculo→permitida + `status=inactive` + `company_status` intocado · D2 saldo≠0→bloqueado + não-soft-deleta · D3 conta vazia→permitida · D4 movimento→bloqueado · D5 port lança→fail-closed (`BANK_UNAVAILABLE`) · D6 sem actor→permitida (port não chamado) · D7 estrutural (sem `accounts`/`transactions`; usa `getBankTransactionRead`; resolve por `actors.company_id`; soft-delete em `status` não `company_status`; `RETURNING`). **Estratégia:** STUB do `BankTransactionReadPort` controla o veredito por cenário → exercita o **resolver real** (`companyId→actor`) contra o DB **sem fabricar** linhas em `bank_*` (substrato soberano).
- **Backend tsc** real fora de geo = **0** (inclui o e2e novo).
- **4 gates OK:** `actor-writer` · `bank-ledger` (guard via port, zero SQL direto em `bank_*`) · `regression-guards` (365, numeração única) · `arch --strict` `critical_new=0`/`warning_new=1`=c3.
- **Sem regressão:** `userrole-projection` 4/4 · `cnpj-on-entry-failclosed` 6/6. dev **365** (zero migration).

## O que NÃO foi feito (escopo)
migration · Bank write/escrow/payout · frontend/UI de delete · hard-delete (segue soft-delete) · cascata de remoção de actor/membros (cleanup é dos e2es, não do runtime) · actionContext hardening · providers de produção.

## DTs
- `DT-PJ-COMPANY-DELETE-GUARD-PHANTOM-TABLES` → **CLOSED** (aberta+fechada na fatia).

## Próximo passo recomendado
Arco PJ cobre agora **nascer→verificar→operar→deletar**. Candidatos: auditoria/hardening do `actionContext` (sistêmica — `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`), providers de PRODUÇÃO (storage/scanner), ou UI admin de review KYB.
