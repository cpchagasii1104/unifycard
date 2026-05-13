# F10 — DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION CLOSED via convergência em ensurePlatformAccounts

**Data:** 2026-05-13
**Modo:** GUARDIÃO (audit material curto) → EXECUTOR (convergência implementacional)
**Branch:** `rescue-structural`
**HEAD anterior:** `a351067f` (HK7 — cleanup pós-F9)
**HEAD pós-execução:** TBD

---

## 1. Origem material

Reancoragem institucional pós-HK7. Autorização Clayton: "de qualquer forma vamos ter que tratar desses assuntos, escolha qual que você acha melhor."

Escolha fundamentada: **DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION** (registrada em F6). Escopo cirúrgico, alinhado com DECISION-0036 (premissa ontológica account-centric), resolve bug real de produção: tenant criado via `ensurePlatformAccounts` puro não consegue executar primeiro checkout event_ticket (bankSplitEngine rejeita "System account reserve not found").

## 2. Audit material — runtime soberano identificado

Aplicação da heurística "runtime soberano = concentração de causalidade validada":

**`SystemAccountName` ('reserve'/'fee'/'regional_fund'/'escrow'/'platform_ops') — RUNTIME SOBERANO REAL:**

14 call sites ativos:
- `core/events/event-payment-execution.service.ts:63` — `getSystemAccount('escrow')`
- `core/unifybank/regional-fund-governance.service.ts:670` — `getSystemAccount('regional_fund')`
- `core/unifybank/regional-fund-governance.service.ts:718` — `getSystemAccount('fee')`
- `core/unifybank/transparency.service.ts:505,603` — `getSystemAccount('regional_fund')`
- `modules/bank/bank-integration.service.ts:789` — `getSystemAccount('fee')`
- `modules/marketplace/regional-fund.service.ts:130` — `getSystemAccount('reserve')`
- `modules/observability/financial-simulator.controller.ts:95` — `getSystemAccount('reserve')`
- `modules/rides/distribution/distribution.service.ts:75` — `getSystemAccount('fee')`
- `modules/services/service-order.service.ts:904` — `getSystemAccount('fee')`
- Scripts: `seed-initial-balance.ts:33`, `validate-financial-flow-real.ts:84,92`, `verify-simple-tx-double-entry.ts:18`

**`getPlatformLifecycleAccount` — uso restrito (4 call sites):**

- `modules/marketplace/payment-execution.service.ts:924` — `escrow_payments`
- `modules/marketplace/payment-execution.service.ts:927` — `clearing`
- `modules/observability/financial-simulator.controller.ts:146` — `clearing`
- `modules/observability/financial-simulator.controller.ts:150` — `bank_settlement`

**`risk_reserve`/`platform_fees`/`platform_revenue` — ZERO callers ativos.** Criados por `ensurePlatformAccounts` mas exercitados em nenhum caminho de produção. **Arquitetura aspiracional não convergida.**

**`seller_pending`/`seller_available`/`seller_payout`** — usados em payouts (preservar).

## 3. Fix aplicado (`bank-account.service.ts:340-415`)

Adicionada camada 2 ao `ensurePlatformAccounts` criando 4 contas SystemAccountName:

```ts
const systemAccountNames: SystemAccountName[] = ['reserve', 'fee', 'regional_fund', 'escrow'];
for (const name of systemAccountNames) {
  const ownerId = `system:${name}:${tenantId}`;
  const existing = await bankAccountRepository.getAccountByOwnerAndType(
    tenantId, ownerId, 'system', 'credit', currency
  );
  if (!existing) {
    try {
      await bankAccountRepository.createAccount(tenantId, {
        ownerId, ownerType: 'system', accountType: 'credit', currency,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('uq_bank_accounts_one_system_per_tenant') || msg.includes('duplicar valor da chave')) {
        continue;
      }
      throw err;
    }
  }
}
```

**Decisões arquiteturais materiais:**
- `account_type='credit'` genérico (NÃO requer migration DDL — CHECK constraint atual de 13 valores preservado)
- Conta resolvida via `getSystemAccount` por `owner_id` pattern (`system:${name}:${tenantId}`), não por `account_type`
- Camada 1 (9 contas legacy `risk_reserve`/`platform_fees`/etc.) PRESERVADA — não amputar callers de `getPlatformLifecycleAccount`
- `platform_ops` (5º valor de SystemAccountName) NÃO criado — zero callers atuais; pode ser adicionado se demanda emergir

## 4. Convergência alinhada com DECISION-0036 + heurística "runtime soberano"

**DECISION-0036 premissa ontológica:** "conta = destino financeiro soberano; actor = camada contextual/autoritativa."

**Heurística aplicada:** runtime soberano se identifica por concentração de causalidade validada — NÃO pelo timestamp do arquivo. SystemAccountName tem 14 callers; ensurePlatformAccounts naming legacy tem zero callers para 3 de 9 tipos.

**Padrão arquitetural:** convergência via **runtime soberano absorvendo o que o legado declarava aspiracionalmente**. Sem amputar contas legacy. Sem migration DDL. Sem nova cosmologia.

## 5. Cleanup smoke v3 (P5)

`backend/scripts/q3-e2e-v3-fundacional.ts` P5 atualizado:
- ANTES: criava manualmente 3 contas system (workaround pré-F10)
- AGORA: apenas VALIDA que `ensurePlatformAccounts` criou as 4 contas

Import de `bankAccountRepository` removido (não usado mais no script).

## 6. Validação dinâmica — 14/14 PASS

```
[P1-P4]  ✅ Registro + actorIds + ensurePlatformAccounts
[P5]     ✅ 3 contas system disponíveis via ensurePlatformAccounts (sem workaround manual)
[P6-P8]  ✅ Bootstrap + attendee seed + evento criado
[P9]     ✅ Checkout fundacional — event_ticket → bankSplitEngine → 4 splits
[P10]    ✅ 4 splits canônicos validados [7000, 1700, 1000, 300]
[P11]    ✅ Reserve fundada via 17% do split (NÃO via shortcut)
[P12]    ✅ system_coverage bigint > 0 (cap=483000, tot=17000)
[P13]    ✅ P2P canônico via context p2p_transfer
[P14]    ✅ Double-entry net=0 + pg_typeof(amount_cents) = bigint
```

**Prova material:** tenant criado via `ensurePlatformAccounts` puro agora suporta primeiro checkout event_ticket **nativamente**. Bug real de produção eliminado.

## 7. Verificação institucional

| Gate | Resultado |
|---|---|
| TSC backend | 0 erros |
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] |
| `validate:regression-guards` | GATE OK [financial + sql-lint + 300 migrations] |

## 8. DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION — CLOSED

`REMEDIATION_DT_LOG.md`:
- Status: OPEN → **CLOSED (2026-05-13 — encerrada por F10)**
- Resolução documentada: audit material + fix em `ensurePlatformAccounts` + validação 14/14 PASS

## 9. NÃO tocados (transparência institucional)

- ❌ Migration DDL — não necessária; convergência por `account_type='credit'` genérico
- ❌ Contas legacy `risk_reserve`/`platform_fees`/`platform_revenue` — preservadas mesmo sem callers ativos (não amputar; eventual limpeza em sessão dedicada se permanecer aspiracional)
- ❌ `platform_ops` (5º SystemAccountName) — zero callers; adicionado quando demanda emergir
- ❌ STATUS_EXECUCAO_GLOBAL.md — atualização cirúrgica fica para HK consolidado posterior (próxima sessão ou conforme prioridade)
- ❌ Outras DTs OPEN preservadas (não tocadas nesta frente)

## 10. Aderência ao protocolo

- §2.2.2 prova de rastreabilidade — 14 callers SystemAccountName mapeados com arquivo:linha
- §29 git add específico
- §25 pendências preservadas (DT-bank-* trio, DT-event-reservations, DT-q3-e2e-v2-service-booking, DT-C36-actor-debts)
- §10 não toquei norma
- DECISION-0036 premissa ontológica honrada
- Heurística "runtime soberano = concentração de causalidade validada" aplicada em **segundo caso material** (primeiro foi F8 event-economy/bank-integration)
- Calibração "menos meta-governança" — fix material direto sem inflar; nova DECISION não necessária (convergência implementacional)

## 11. Sobre validação da heurística "runtime soberano"

Esta é a **segunda aplicação independente** da heurística "runtime soberano se identifica pela concentração de causalidade validada":

1. **F8 (caso original):** event-economy.processCheckout (novo declarado canônico) vs bank-integration.processEventTicketPayment (legacy soberano). Bank-integration concentrava 5 capacidades operacionais (limite diário, autoria ownership, idempotência, ensureUserActor, multi actor_type) → runtime soberano.

2. **F10 (caso independente — diferente domínio):** ensurePlatformAccounts naming (legacy) vs SystemAccountName (vivo). SystemAccountName concentrava 14 callers ativos em 5 contextos distintos (events, marketplace, rides, services, reporting) → runtime soberano.

Ambos os casos confirmaram materialmente: **a soberania não vem do timestamp; vem da concentração de causalidade exercitada.**

Categoria registrada conforme registrada após F8: candidato a memória institucional persistente APÓS segunda aplicação independente em caso ambíguo. **F10 cumpre esse critério.** Pode ser promovido a memória permanente em próxima sessão de housekeeping institucional (decisão Clayton).

## 12. Estado pós-F10

| Item | Estado |
|---|---|
| `ensurePlatformAccounts` cria contas SystemAccountName | ✅ (camada 2 adicionada) |
| Tenant via `ensurePlatformAccounts` puro suporta checkout event_ticket | ✅ (validado em runtime) |
| DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION | **CLOSED** |
| Smoke v3 dinâmico | ✅ 14/14 PASS (sem workaround manual) |
| TSC + 3 gates | ✅ PASS |
| Heurística "runtime soberano" | ✅ 2ª validação independente em caso ambíguo |
| Migration DDL | ✗ não necessária |
| Contas legacy preservadas | ✅ (camada 1 intacta) |
