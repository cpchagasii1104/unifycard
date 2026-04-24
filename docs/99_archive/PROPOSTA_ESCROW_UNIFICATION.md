# PROPOSTA_ESCROW_UNIFICATION

> **STATUS (2026-04-19): IMPLEMENTADO**
> Fases 1-3 implementadas nesta sessao:
> - Migration escrow_accounts, payment_milestones, escrow_transactions aplicadas
> - escrow.service.ts: bridge bank-first implementado (bankTransactionService.transfer PRIMEIRO)
> - ESCROW_BANK_BRIDGE=1 ativa o bridge; fluxo legado mantido sem flag
> - Gates CI: actor-writer OK, bank-ledger OK, regression-guards OK
> - Ver: PLANO_BANK_PAYMENTS_REFATOR_ARQUITETURAL.md DT-01 - RESOLVIDO

**Política alvo:** **Caminho A** — uma fonte de verdade financeira (`bank_ledger` / `bank_transactions` via `bankTransactionService`); escrow deixa de ser segundo ledger implícito e passa a ser **estado de negócio + histórico** amarrado a movimentos bank com **ponte explícita**.

**Modo de execução:** **gradual** (sem big bang). Cada fase é reversível até cutover documentado.

**Data do documento:** 2026-04-14.

**Relacionado:** `PLANO_BANK_LEDGER_WRITER_ENFORCEMENT.md` (gate INSERT/UPDATE `bank_*`); `docs/03_execution_log/AUTHORITY_MAP_FINANCIAL_v1.md`.

---

## 1. Estado actual (factos no código)

| Elemento | Evidência |
|----------|-----------|
| Escrita em `escrow_transactions` | `escrow.repository.ts` — `INSERT INTO escrow_transactions` em `createTransaction` |
| Tipos de linha escrow | `hold`, `release`, `refund` (`escrow.types.ts`) |
| Criação de linhas | `escrow.service.ts` — `createTransaction` em `releasePayment` e `refundFunds` (tipo `release` / `refund`) |
| Coluna de ponte | `EscrowTransaction.bankTransactionId` / `bank_transaction_id` na row — **existe no modelo**; o `createTransaction` actual **não persiste** vínculo a `bank_transactions` |
| Bank constitucional | `0003_bank_core.sql` — `transfer_purpose` já inclui **`escrow_hold`** e **`escrow_release`** |
| Contas escrow no bank | `bank_accounts.owner_type` permite `'escrow'` |

**Conclusão:** o desenho constitucional do bank **já prevê** escrow; falta **política e código** que executem sempre que houver impacto patrimonial.

---

## 2. Regra de ouro (quando escrow “gera” movimento bank)

Escrow **decide** marcos e estados; **dinheiro que muda de titularidade ou saldo utilizável** executa-se **só** via `bankTransactionService` (ou método delegado que escreve em `bank_*`).

| Evento de negócio (escrow) | Gera movimento bank? | Notas |
|----------------------------|----------------------|--------|
| Criação de escrow + milestones | **Opcional fase 1** — preferir **não** debitar até “funds held” explícito | Se o fluxo actual só persiste intenção, manter; se já existe entrada de fundos, mapear `hold` |
| `authorizeMilestone` | **Não** (só estado) | |
| `releasePayment` | **Sim** | Liberação de valor: `escrow_release` (ou split alinhado ao produto) |
| `refundFunds` | **Sim** | Devolução: purpose `refund` ou política única a documentar vs `escrow_release` inverso |
| `hold` (futuro / se activado) | **Sim** | `escrow_hold` |

**Invariante I0:** nenhuma linha `escrow_transactions` com `transaction_type IN ('release','refund')` e `status = 'completed'` sem `bank_transaction_id` **preenchido** (após cutover da fase 2).

---

## 3. Mapeamento conceptual `escrow_transactions` → `bank_*`

Não é cópia 1:1 de linhas: uma linha escrow é **intenção / prova de negócio**; o bank regista **débito/crédito** com double-entry.

| `escrow_transactions.transaction_type` | `bank_transactions.purpose` (genesis) | Direcção (alto nível) |
|------------------------------------------|--------------------------------------|-------------------------|
| `hold` | `escrow_hold` | Fundos entram / ficam retidos na conta escrow (conta `owner_type = escrow`) |
| `release` | `escrow_release` | Saída da reserva escrow → beneficiário(ies) conforme regra de produto |
| `refund` | `refund` (ou combinação explícita) | Retorno ao pagador; **não** duplicar com `release` no mesmo valor |

**Invariante I1:** cada `escrow_transactions.transaction_id` liga-se a **zero ou uma** transação bank “primária” (idempotência); splits adicionais referenciam a mesma `reference_id` estável (ex.: id da linha escrow ou idempotency key).

**Invariante I2:** soma dos impactos em `bank_ledger` para um dado `reference_id` de escrow **não** excede os `amount_cents` autorizados pelos marcos + acordo (validação pré-flight no serviço).

---

## 4. Invariantes anti-duplicação

1. **Um gatilho, uma execução bank:** `releasePayment` / `refundFunds` chamam no máximo **uma** cadeia `bankTransactionService.*` por operação idempotente (chave: `tenantId` + `escrowId` + `milestoneId?` + tipo + valor).
2. **Escrow append-only:** `escrow_transactions` continua append-only; correções são **novas** linhas + estorno bank, nunca UPDATE silencioso de montante (alinhado a políticas existentes).
3. **Leitura de saldo “oficial”:** após cutover da fase 3, saldo “disponível” para UI/reporting de fundos em escrow vem de **`bank_ledger` / contas `owner_type = escrow`**, não de campos agregados só em `escrow_accounts` sem reconciliação (campos podem existir como **cache** desde que reconciliados).
4. **Gate CI:** qualquer novo `INSERT`/`UPDATE` `bank_*` fora de `modules/bank` continua **proibido** (`validate:bank-ledger-boundaries`).

---

## 5. Estratégia em fases (gradual)

### Fase 0 — Congelar semântica (1 PR documental)

- Fixar esta proposta como SSOT de produto.
- Checklist de testes manuais: um release + um refund em staging com reconciliação `bank_ledger`.

### Fase 1 — Ponte mínima (código)

**Ordem obrigatória (anti-duplicação):** (1) gerar **chave idempotente estável** antes de qualquer escrita de estado “released/refunded”; (2) executar movimento **bank** (`transfer` / `createSimpleTransaction` / split) com `(reference_type, reference_id)` únicos por operação; (3) **só depois** persistir linha em `escrow_transactions` **com** `bank_transaction_id` e/ou actualizar milestone / `escrow_accounts` — nunca o inverso (estado escrow “ganhou” sem bank concluído).

- Em `releasePayment` / `refundFunds` (e `hold` se aplicável): após validações actuais, invocar **`bankTransactionService.transfer`** (ou `createTransactionWithSplit` se houver split contratual) com:
  - `purpose` alinhado a `escrow_release` / `refund` / `escrow_hold`
  - `reference_type` + `reference_id` estáveis (ex.: `escrow_release` + UUID de operação **pré-gerado**, nunca depender de `INSERT` escrow pré-bank para o idempotente do bank)
- Persistir **`bank_transaction_id`** na linha `escrow_transactions` (coluna já existente no modelo TS; confirmar DDL em ambiente).

**Regra dura (retry):** se `bank_transaction_id` já está preenchido na linha de operação correspondente, **não** reexecutar lógica monetária nem recalcular montantes — apenas retornar estado idempotente / erro controlado.

### Fase 2 — Idempotência e falha fechada

- Se a chamada bank falhar: linha escrow fica `failed` com motivo; **não** marcar milestone como `released` sem bank sucedido (transacção SQL única ou saga explícita — decisão técnica na implementação).
- Reexecução segura: mesma chave → não duplicar bank.

### Fase 3 — Leituras e reporting

- Dashboards / APIs: para tenants em flag `ESCROW_BANK_BRIDGE=1`, saldos escrow a partir de agregações bank; tenants sem flag mantêm comportamento legado até deprecação.

### Fase 4 — Deprecação do “dois ledgers”

- Documentar sunset: `held_amount_cents` em `escrow_accounts` como derivado ou somente leitura reconciliada.
- Remover qualquer código que **infira** saldo só a partir de escrow sem cruzar bank.

---

## 6. Fora de âmbito (explícito)

- Big bang migração histórica de todas as linhas `escrow_transactions` antigas na primeira entrega.
- Alterar o gate `audit-bank-ledger-boundaries` para incluir escrow (não necessário: escrow não deve conter SQL `bank_*`).

---

## 7. Critérios de aceitação (definição de “feito”)

- [x] `release` e `refund` criam registo bank e preenchem `bank_transaction_id` (com `ESCROW_BANK_BRIDGE=true` e inputs obrigatórios).
- [ ] Teste de invariante (Jest ou integração): mesmo input idempotente não duplica linhas `bank_ledger` para o mesmo `reference_id`.
- [ ] Documento de runbook: “como reconciliar escrow vs bank” numa página interna ou `docs/03_execution_log/`.

---

## 8. Próximo passo único recomendado

Implementar **Fase 1** atrás de **feature flag** (ex.: `ESCROW_BANK_BRIDGE`), com **Fase 2** na mesma entrega mínima se o risco de duplicação for inaceitável sem idempotência.

### 8.1 Implementado no repo (2026-04-14)

- **Flag:** `ESCROW_BANK_BRIDGE` = `1` ou `true` → ponte activa; qualquer outro valor → fluxo legado (milestone + `escrow_transactions` sem bank).
- **Migração:** `backend/migrations/20260530120000_escrow_transactions_bank_transaction_id.sql` — `ADD COLUMN IF NOT EXISTS bank_transaction_id`.
- **Idempotência bank:** `reference_type = 'escrow_operation'`, `reference_id` = UUID v5 determinístico (`release`: tenant|escrow|milestoneId|release; `refund`: tenant|escrow|amount|idempotencyKey).
- **API:** `ReleasePaymentInput.toBankAccountId` obrigatório com bridge; `RefundInput.toBankAccountId` + `idempotencyKey` obrigatórios com bridge.
- **Conta custódia:** `bankAccountService.getOrCreateAccount` com `ownerType: 'escrow'`, `ownerId: escrowId`, `accountType: 'escrow_payments'`.
- **Ordem:** `transfer` → `createTransaction` (COMPLETED + `bank_transaction_id`) → `updateMilestoneStatus` / `updateEscrowStatus`.
- **Retry:** se já existe `escrow_transactions` com mesmo `transaction_id` (= operation id) e `bank_transaction_id` preenchido, devolve estado sem re-chamar bank.
- **Milestone já `released`:** `releasePayment` devolve imediatamente `{ escrow, milestone }` sem novo movimento (protecção contra segunda liberação no mesmo marco).
- **Logs:** `logger.info` com `escrow_bridge_release_transfer_ok` / `escrow_bridge_refund_transfer_ok` (tenantId, escrow_id, escrow_operation_id, bank_transaction_id, amount_cents, …).

**Pré-requisito operacional:** saldo na conta bank escrow; sem fundos o `transfer` falha com `INSUFFICIENT_FUNDS` (esperado até existir pipeline `hold`).

**Backlog (não bloqueia staging):** UNIQUE em `bank_transaction_id` ou coluna dedicada `escrow_operation_id`; endurecer refund além dos testes manuais.

### 8.2 Fase 2 — leitura via bank (implementado)

- **Flag:** `ESCROW_READ_FROM_BANK` = `1` ou `true`.
- **Serviço:** `backend/src/modules/escrow/escrow-bank-read.service.ts` — `getPosition` via `getOrCreateAccount(escrow)` + `bankLedgerRepository.calculateBalance`.
- **API:** `getEscrowAccount`, `getEscrowByAgreement`, `listEscrowAccounts` enriquecem resposta: `heldAmountCents` = custódia bank; `financialPosition` com `legacy_held_cents`, `divergence_cents`, etc.
- **Log:** `escrow_read_divergence_detected` (warn) quando `|divergence_cents| > 0`.
- **Escritas** (`releasePayment` / `refundFunds`) continuam a usar `findById` **sem** enriquecimento (valores legacy para agregados).

### 8.3 Fase 3 — Hardening (DDL + reconciliação)

- **Migração:** `backend/migrations/20260530140000_bank_escrow_hardening_unique_indexes.sql`
  - `uq_bank_transactions_tenant_reference` — `UNIQUE (tenant_id, reference_type, reference_id)` parcial (só referência preenchida); **falha** se já existirem duplicados.
  - `uq_escrow_transactions_bank_transaction_id` — `UNIQUE (bank_transaction_id)` parcial; **falha** se o mesmo `bank_transaction_id` estiver em duas linhas escrow.
- **Script:** `pnpm --dir backend run reconcile:escrow-bank-drift` — `backend/scripts/reconcile-escrow-bank-drift.mjs` (opcional `RECONCILE_ESCROW_STRICT=1`).
- **Runbook:** `docs/03_execution_log/ESCROW-BANK-HARDENING-RUNBOOK.md`.

**Dívida futura (documentada):** escritas em `release/refund` ainda usam agregados legacy em `escrow_accounts`; alinhar decisão ao bank quando o produto exigir.

---

*Documento append-friendly: decisões de implementação detalhada (splits, contas debit/credit exactas) devem ser registadas em PR ou `AUTHORITY_MAP_FINANCIAL_v1.md` §novo quando a Fase 1 for codificada.*
