# F9 — DECISION-0036 implementada + smoke v3 fundacional 14/14 PASS

**Data:** 2026-05-13
**Modo:** EXECUTOR autônomo (autorizado por Clayton — "execute" sem meta-loops)
**Branch:** `rescue-structural`
**HEAD anterior:** `240a2bb0` (DECISION-0036 formalizada)
**HEAD pós-execução:** TBD

---

## 1. Resumo executivo

**DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO pronto para fechamento.** Caminho fundacional canônico declarado por DECISION-0031 está implementado, exercitado e validado em runtime real. Smoke v3 completa 14/14 PASS.

Implementação faseada conforme DECISION-0036:
1. ✅ Verificações pré-execução restantes (2 + 4)
2. ✅ Migration soberana `20260530538000_bank_splits_target_account_id.sql`
3. ✅ Refactor `bank-split.repository.ts` (resolveTargetActorId → resolveTargetActorIdOptional)
4. ✅ Fix bug pré-existente em `validateSplitsSum` (não usava client da transação)
5. ✅ Smoke v3 dinâmico 14/14 PASS
6. ✅ TSC + 3 gates PASS
7. Commit isolado (este)

## 2. Verificações pré-execução (2 + 4)

**Verificação 2 — checks `target_actor_id IS NOT NULL` no backend:**
```
grep -rEn "target_actor_id IS NOT NULL|targetActorId\s*!==?\s*null|targetActorId\s*&&" src/
→ Zero matches
```
Tornar `target_actor_id` NULLABLE é seguro — nenhum código depende explicitamente de NOT NULL.

**Verificação 4 — índices existentes em bank_splits:**
- `idx_bank_splits_transaction` (transaction_id) — preservado
- `idx_bank_splits_source` (source_actor_id) — preservado
- `idx_bank_splits_target` (target_actor_id) — preservado (legacy reads)
- `idx_bank_splits_target_account` (target_account_id) — CRIADO pela migration

## 3. Migration aplicada

`backend/migrations/20260530538000_bank_splits_target_account_id.sql`:
- Statement 1: ADD COLUMN target_account_id UUID REFERENCES bank_accounts(id)
- Statement 2: ALTER COLUMN target_actor_id DROP NOT NULL
- Statement 3: backfill `UPDATE bank_splits SET target_account_id = ba.id FROM bank_accounts ba WHERE ba.actor_id = bs.target_actor_id`
- Statement 4: validação pós-backfill (zero rows com target_account_id NULL)
- Statement 5: ALTER COLUMN target_account_id SET NOT NULL
- Statement 6: CREATE INDEX idx_bank_splits_target_account

**Resultado runtime:**
- 2 rows existentes: backfill 1:1 sem ambiguidade conforme audit DECISION-0036
- `target_actor_id` agora NULLABLE
- `target_account_id` agora NOT NULL com índice próprio

**Nota operacional:** migration aplicada via SQL direto (não via `npm run migrate`) devido a erro pré-existente em migration antiga `20260530516500_add_states_country_abbreviation_unique` no migration runner. Aplicação direta via Pool preservou transação BEGIN/COMMIT idêntica à do runner.

## 4. Refactor repository (`bank-split.repository.ts`)

- `resolveTargetActorId` (throw em destinos system) → renomeada para `resolveTargetActorIdOptional` retornando `null` para destinos sem actor.
- `createSplitWithAuthorship` agora insere `target_account_id` direto (NOT NULL) + `target_actor_id` opcional (NULLABLE, populated quando target tem actor associado — preserva legacy reads que agregam por actor).

Comentário institucional inline citando DECISION-0036 + premissa ontológica (conta = destino soberano, actor = camada contextual).

## 5. Bug B11 descoberto e corrigido em runtime (validateSplitsSum)

Smoke v3 pós-migration revelou bug PRÉ-EXISTENTE em `bank-split.repository.ts::validateSplitsSum`:

**Antes:**
```ts
async validateSplitsSum(tenantId, transactionId, transactionAmountCents) {
  const client = await getClientWithTenant(tenantId);  // NOVA CONEXÃO
  // ... SELECT SUM ... → splits inseridos na transação BEGIN não visíveis
}
```

**Sintoma:** `Split validation failed. transactionAmountCents: 10000, splitsSumCents: 0, differenceCents: 10000`

**Causa:** PostgreSQL READ COMMITTED — INSERTs em BEGIN..COMMIT só são visíveis na MESMA conexão até COMMIT. `validateSplitsSum` obtinha nova conexão e via 0 splits.

**Mascarado por B8:** antes de DECISION-0036, `resolveTargetActorId` rejeitava destinos system ANTES do validate ser chamado. Bug B11 nunca aparecia em runtime real.

**Fix aplicado:** `validateSplitsSum` aceita `existingClient` opcional; caller (`bank-transaction.service:1376`) passa `client` da transação ativa.

## 6. Bug B12 fix no script (concept_id P2P)

Smoke v3 P13 usava `concept_id: 'p2p-transfer'` — slug não existe na tabela `concepts`. Verificação read-only revelou que concepts financeiros existentes não incluem `p2p-transfer` específico. Fix no script: usar `split-payment` (slug existente, domain `financeiro-payment`, genérico para payments).

**Decisão institucional:** criar concept novo `p2p-transfer` seria categoria DECISION (cf. DECISION-C2-009/010/011/012 que aprovaram concepts). Esta sessão não cria concepts — usa existente. Concept dedicado para P2P fica para sessão futura se demanda material emergir.

## 7. Smoke v3 dinâmico — 14/14 PASS

```
[P1]  ✅ Organizer A registrado
[P2]  ✅ Attendee B registrado (mesmo tenant)
[P3]  ✅ actorIds resolvidos via actors.user_id lookup
[P4]  ✅ ensurePlatformAccounts (escrow_payments, platform_revenue, risk_reserve, etc.)
[P5]  ✅ 3 contas system criadas (reserve/fee/regional_fund)
[P6]  ✅ Bootstrap capacity inicial (mint liquidity_issuance → system:reserve)
[P7]  ✅ Attendee B com saldo inicial (R$200)
[P8]  ✅ Evento criado via POST /api/events (R$100, event_ticket)
[P9]  ✅ Checkout via POST /api/events/:id/checkout
       CHAMADA FUNDACIONAL: event_ticket → split engine → 4 splits
[P10] ✅ 4 splits canônicos validados: [7000, 1700, 1000, 300] cents = 70/3/10/17
[P11] ✅ Reserve fundada via 17% do split (NÃO via shortcut concept_id)
[P12] ✅ system_coverage.execution_capacity_cents bigint > 0 (cap=483000, tot=17000)
[P13] ✅ P2P attendee → organizer via context p2p_transfer (canônico)
[P14] ✅ Double-entry net=0 + pg_typeof(amount_cents) = bigint
```

**Prova material da DECISION-0031:** reserve fundada via 17% AUTOMÁTICO do split engine event_ticket no checkout, exercitando caminho declarado pela norma.

## 8. Verificação institucional

| Gate | Resultado |
|---|---|
| TSC backend | 0 erros |
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] |
| `validate:regression-guards` | GATE OK [financial + sql-lint + 300 migrations] |

## 9. Bugs descobertos durante F9 (cascade após migration)

| # | Bug | Categoria | Fix |
|---|---|---|---|
| B10 | `Split validation failed: splitsSumCents=0` | Bug pré-existente mascarado por B8 | ✅ Fix em validateSplitsSum (aceita existingClient) |
| B11 | `INVALID_CONCEPT_ID: 'p2p-transfer'` | Script smoke bug (concept não existe) | ✅ Trocado para 'split-payment' (concept existente) |

Padrão recorrente: resolver bug arquitetural prévio (B8) expõe próximo bug latente (B11 = validateSplitsSum). Diretiva Clayton "deixe o runtime revelar o próximo bug material" honrada — cada bug exposto e corrigido inline sem inflação.

## 10. DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO — convergência

**Critério de fechamento pré-F9:**
- ✅ v3 escrito + TSC + 4 gates
- ❌ Validação dinâmica em backend rodando

**Critério após F9:**
- ✅ v3 escrito + TSC + 3 gates PASS
- ✅ Validação dinâmica 14/14 PASS em runtime real
- ⏳ Cleanup de v2 (deletar OR marcar referência histórica) — opcional para sessão posterior

**Status:** PRONTA PARA FECHAMENTO (próxima sessão pode marcar CLOSED no REMEDIATION_DT_LOG.md após cleanup v2).

## 11. Aderência ao protocolo

- §2.2.2 prova de rastreabilidade — cada fix com arquivo:linha
- §29 git add específico
- §28 migration aplicada e validada (backfill determinístico zero rows NULL)
- §10 não toquei norma soberana
- §25 pendências preservadas (cleanup v2; concept p2p-transfer dedicado se demanda)
- Diretiva Clayton "execute" honrada — sem meta-loops, fixes inline, runtime exposto
- DECISION-0036 implementação faseada cumprida integralmente

## 12. Estado pós-F9

| Item | Estado |
|---|---|
| Migration `20260530538000_bank_splits_target_account_id.sql` | ✅ Aplicada (target_account_id NOT NULL; target_actor_id NULLABLE; 2 rows backfilled) |
| Repository refactor | ✅ resolveTargetActorIdOptional retornando null para system |
| validateSplitsSum corrigido | ✅ aceita existingClient (bug pré-existente B10) |
| Smoke v3 dinâmico | ✅ 14/14 PASS |
| Caminho fundacional canônico DECISION-0031 | ✅ EXERCITADO em runtime real |
| Reserve via 17% split event_ticket | ✅ VALIDADO materialmente |
| 4 splits canônicos (70/3/10/17) | ✅ PERSISTIDOS em bank_splits |
| DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO | ⏳ PRONTA PARA FECHAMENTO |
| TSC + 3 gates | ✅ PASS |
