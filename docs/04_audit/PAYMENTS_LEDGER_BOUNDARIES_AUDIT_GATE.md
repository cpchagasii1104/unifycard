# Gate de auditoria — fronteira financeira / ledger (payments)

**Norma:** `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — **§17.6** (molde de artefatos) e **§17.6.1** (gates de fronteira financeira: allowlist derivada do código real, não regex cega). **Ancoragem:** [`docs/CORE_DOCUMENTS.md`](../CORE_DOCUMENTS.md).

**Distinção:** o gate de [marketplace / pedido](./MARKETPLACE_ORDER_BOUNDARIES_AUDIT_GATE.md) protege **consistência operacional** do funil; este gate protege **autoridade para causar efeito financeiro** (escrita em `bank_ledger` via caminho canónico).

**Estado:** **Enforcement inicial (SOFT) implementado** — `backend/scripts/audit-payments-ledger-boundaries.sh` e `.github/workflows/payments-ledger-boundaries-audit.yml` reportam violações em PR (paths: `backend/src/modules/**`, `backend/scripts/**`) com `PAYMENTS_LEDGER_BOUNDARIES_AUDIT_SOFT=1` (não bloqueia CI). A **allowlist abaixo permanece provisória** até decisões de governança e baseline estável; a norma e o critério binário mantêm-se como referência.

---

## Princípio (facto verificado no código)

- **Único `INSERT INTO bank_ledger` de aplicação:** `backend/src/modules/bank/bank-ledger.repository.ts`.
- **Único chamador de `bankLedgerRepository.createEntry` na app:** `backend/src/modules/bank/bank-transaction.service.ts`.
- **Superfície de escrita** exposta por `bankTransactionService`:  
  `transfer` · `createSimpleTransaction` · `createTransactionWithSplit` · `createTransactionWithExplicitSplitLines`.

**Exceção a rever em PostgreSQL:** `markExternallySettled` chama função SQL `mark_externally_settled(...)` — efeito em ledger não passa por `createEntry` no TypeScript; validar definição da função antes de enforcement bloqueante.

---

## Critério de aprovação (binário)

O diff **só passa** se:

> Não introduz **novo** caminho que chame os quatro métodos acima **fora** da allowlist acordada **nem** escrita direta em `bank_ledger` fora do repositório canónico.

Veredito possível: **seguro** | **risco (mitigação exigida)** | **não passa**

---

## Allowlist de autoridade (rascunho — conjuntos)

Lista derivada do mapeamento de callers em `backend/src`. **Permanece provisória** até as três decisões de governança estarem explícitas e aprovadas; o script hardcoded espelha este conjunto (mais exclusões e ficheiros técnicos — ver script).

### Conjunto A — Runtime de negócio (candidatos fortes a permitidos)

| Caminho |
|---------|
| `modules/marketplace/payment-execution.service.ts` |
| `modules/marketplace/payout.service.ts` |
| `modules/reversal/reversal.service.ts` |
| `modules/treasury-split/treasury-split.service.ts` |
| `core/events/event-payment-execution.service.ts` |
| `core/events/event-economy.service.ts` |
| `modules/bank/bank-integration.service.ts` |
| `core/unifybank/bank-p2p-transfer.service.ts` |
| `core/unifybank/donation.service.ts` |
| `core/unifybank/regional-fund-governance.service.ts` |
| `modules/gateway/payment-event-resolver.ts` |

### Conjunto B — Workers (orquestração)

| Caminho |
|---------|
| `workers/payout-worker.ts` |
| `workers/bank-settlement-worker.ts` |
| `workers/governance-funding-commitment-worker.ts` |

### Conjunto C — Adapter / porta

| Caminho | Regra |
|---------|--------|
| `modules/bank/adapters/bank-transaction.adapter.ts` | O adapter **não** é autoridade por si: delega ao `bankTransactionService`. O gate deve tratar **quem invoca a porta** (`BankTransactionPort` / registry) como parte da autoridade, não só o ficheiro do adapter. |

### Conjunto D — Fachada `core/economy/transaction.service.ts`

**Decisão obrigatória (ver secção seguinte):** entrypoint oficial vs desincentivado.

### Conjunto E — Scripts (fora do runtime)

| Caminho |
|---------|
| `scripts/seed-initial-balance.ts` |
| `scripts/validate-financial-flow-real.ts` |
| `scripts/verify-simple-tx-double-entry.ts` |
| `scripts/backfill-payment-splits-to-bank.ts` |

**Política típica:** excluir do gate de PR em `main` **ou** job separado; não contam como “novo writer” em produção.

### Conjunto F — Simulador

| Caminho |
|---------|
| `modules/observability/financial-simulator.controller.ts` |

**Decisão obrigatória:** permitido só em não-prod / flag / sandbox ou excluído da allowlist de produção.

### Conjunto G — Higiene

| Caminho |
|---------|
| `modules/services/service-order.service.ts` |

Import de `bankTransactionService` sem uso aparente — **limpeza**, não entrada na allowlist.

---

## Três decisões de governança (obrigatórias antes da allowlist definitiva)

| # | Pergunta | Opções |
|---|----------|--------|
| 1 | `core/economy/transaction.service.ts` é entrypoint oficial? | (a) **Não** na allowlist — chamadas diretas ao domínio bank; (b) **Sim** — único wrapper permitido e documentado. |
| 2 | Adapter: permitido isoladamente? | **Não** — autoridade = **callers da porta** + registry; adapter só encaminha. |
| 3 | Simulador em produção? | (a) **Não** na allowlist prod; (b) **Sim** com flag/tenant/sandbox explícitos. |

### Recomendação pragmática (ponto de partida seguro)

1. **transaction.service (fachada):** **não** incluir na allowlist até haver decisão explícita; preferir chamadas ao domínio `bank` para evitar fachada genérica virar bypass.  
2. **Adapter:** permitido **como implementação da porta**; **quem importa** o que dispara `createSimpleTransaction` / `createTransactionWithSplit` via port deve estar coberto pela mesma política de autoridade.  
3. **Simulador:** **fora** da allowlist de produção; apenas dev/staging ou com controlos explícitos.

Esta recomendação não substitui aprovação formal da equipa.

### Registo formal (equipa — responder antes de implementar script/CI)

Responder **apenas SIM ou NÃO** (ou uma linha objetiva onde indicado). Sem isto, o gate de payments **não** deve ser implementado como bloqueante.

1. `core/economy/transaction.service.ts` pode ser autoridade para causar efeito financeiro (permanecer como caller de `bankTransactionService` na allowlist)? **Resposta:** ______________  
2. `BankTransactionPort` / `bank-transaction.adapter.ts`: o adapter é tratado como **único** entrypoint público permitido (SIM) ou **apenas** delegação e a autoridade é de quem regista/chama a porta (NÃO ao primeiro)? **Resposta:** ______________  
3. `financial-simulator.controller.ts` pode operar em **produção** (SIM) ou fica excluído da allowlist de prod (NÃO)? **Resposta:** ______________  

**Data da decisão:** ______________ **Responsável:** ______________

Após preencher: remover a menção a “provisória” na allowlist acima (ou marcar secção como **norma efetiva**) e avaliar passar o gate de **SOFT** para **bloqueante**.

**Nota:** o modo SOFT já está em uso para **observabilidade**; não substitui o preenchimento deste registo para congelar a allowlist definitiva.

---

## O que o revisor não assume

- Não assume que todo import de `bankTransactionService` escreve (ex.: `getTransactionById`).
- Não assume que scripts em `scripts/` rodam em produção.
- Não assume que funções SQL não têm efeito em `bank_ledger` sem ler a definição no repositório de migrações.

---

## Recovery operacional (manual) — `bank_settlements` em `processing`

**Contexto:** o worker de settlement (`backend/src/workers/bank-settlement-worker.ts`) só consome fila **`pending`**. Se o ledger já tiver sido aplicado e a marcação **`sent`** falhar, o registo pode ficar em **`processing`** sem novo processamento automático (sem job de recuperação — política deliberada até evolução futura).

**Como identificar presos:**

- Consulta por tenant: `listProcessingSettlements(tenantId)` em `backend/src/modules/bank-settlement/bank-settlement-repository.ts`.
- Ou SQL direto: `SELECT id, tenant_id, status, created_at FROM bank_settlements WHERE status = 'processing'`.

**Reprocessamento seguro:**

- Função **`reprocessSettlement(settlementId)`** (exportada do mesmo ficheiro do worker) — carrega o settlement por id e volta a chamar **`executeSettlementEffects`**, o mesmo pipeline idempotente usado no fluxo normal (§4.12.1: dois blocos `withIdempotency`).
- **Só aceita** `status === 'processing'`; caso contrário lança erro (evita reexecutar settlements já `sent` / `failed` / `pending` por engano).

**Garantia de segurança:**

- **Não** duplica transferência de dinheiro em retry: o primeiro bloco idempotente devolve resultado em cache se o efeito ledger já tiver sido registado com sucesso; o segundo bloco completa **`sent`** quando faltava.
- O serviço de bank também dedupe por `(reference_type, reference_id)` em transferências coerentes com o desenho actual.

**Nota:** evolução opcional futura — coluna temporal + job automático — não faz parte deste runbook; ver discussão de lifecycle em `07_NOMENCLATURA_CANONICA.md` §4.12.1 e decisão de produto.

---

## Artefatos (§17.6)

| Artefato | Estado |
|----------|--------|
| Norma (este ficheiro) | `PAYMENTS_LEDGER_BOUNDARIES_AUDIT_GATE.md` |
| Script | `backend/scripts/audit-payments-ledger-boundaries.sh` — **ativo (SOFT)** |
| Workflow CI | `.github/workflows/payments-ledger-boundaries-audit.yml` — **ativo (SOFT)** |
| Registo | `docs/04_audit/GATES.md` |

---

## Próximos passos (execução)

1. Fechar as três decisões de governança e congelar a allowlist.  
2. ~~Implementar script boundary-aware + CI SOFT~~ — **feito** (observabilidade; allowlist ainda provisória).  
3. **Blocking** após baseline limpa, revisão de `mark_externally_settled` no PostgreSQL e remoção ou alteração de `PAYMENTS_LEDGER_BOUNDARIES_AUDIT_SOFT`.
