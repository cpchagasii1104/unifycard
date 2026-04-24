# RFC C2 Rollout — Estratégia de Introdução de bank_transactions.concept_id

**Status:** PROPOSTO · aguarda decisão de Clayton · 2026-04-24
**Dependência:** RFC_C2_bank_transactions_concept_link.md (DECIDIDO: `concept_id`)

## 1. Contexto

Este RFC define a estratégia de rollout para introduzir a coluna `concept_id` em `bank_transactions`, conforme decidido no RFC anterior.

**Recapitulação:** Nova coluna `UUID NOT NULL` com FK → `concepts(concept_id)` — SSOT semântico. Zero fallback.

## 2. Constatação Factual

### 2.1 Estado do banco
- **bank_transactions:** Sistema em desenvolvimento, assumido vazio ou com dados de teste descartáveis.
- **concepts:** Tabela **existe e está populada**. Verificação em MIGRATIONS_FULL.txt:
  - Linha 4491: INSERT concepts domínio `servicos` (médico-clínico-geral, etc.)
  - Linha 10269: INSERT concepts domínio `item-comercial` (arroz, feijão, etc.)
  - Linha 11227+: Outros domínios

### 2.2 Call sites de escrita

**Arquivos que fazem INSERT INTO bank_transactions diretamente:** 2
- `backend/src/modules/bank/bank-transaction.service.ts` (5+ INSERTs)
- `backend/src/modules/bank/bank-ledger.service.ts`

**Arquivos que consomem esses serviços (call sites indiretos):** ~16-20 arquivos
- regional-fund.service.ts
- treasury-split.service.ts
- bank-p2p-transfer.service.ts
- donation.service.ts
- payment-execution.service.ts
- escrow.service.ts
- payout.service.ts
- bank-integration.service.ts
- event-economy.service.ts
- test-currency.service.ts
- (+ workers: treasury-split-worker, payment-worker, etc.)

**Total estimado:** ~23 arquivos / ~44 chamadas (conforme Passo 0 Item 5).

## 3. Opções de Rollout

### Opção A — Big Bang NOT NULL Direto

**Descrição:**
Migration única: `ADD COLUMN concept_id UUID NOT NULL REFERENCES concepts(concept_id)`

**Requisitos pré-migration:**
1. Seed de concepts cobrindo todos os domínios usados
2. Writers (bank-transaction.service.ts, bank-ledger.service.ts) atualizados para exigir concept_id
3. Todos os ~44 call sites atualizados para passar concept_id

**Prós:**
- Estado final imediato
- Zero drift transitório (nunca existe coluna nullable)
- Sem janela de inconsistência

**Contras:**
- Atomicidade impossível — modificar 23 arquivos em um commit viola P2 (atomicidade do plano)
- Risco de quebra total se um caller for esquecido
- Rollback é "tudo ou nada"
- Não permite paralelismo de trabalho

---

### Opção B — NULL-first + Validação + ALTER NOT NULL

**Descrição:**
Rollout em 6 passos incrementais, cada um atômico.

**Passo 1 — Migration forward-only**
```sql
ALTER TABLE bank_transactions
ADD COLUMN concept_id UUID REFERENCES concepts(concept_id);
-- NULL permitido inicialmente
```

**Passo 2 — Seed de concepts**
Garantir que existem concepts para todos os domínios financeiros usados pelos call sites.
(Já parcialmente cumprido pelas migrations existentes.)

**Passo 3 — Atualizar writers**
Modificar `bank-transaction.service.ts` e `bank-ledger.service.ts`:
- Adicionar `concept_id` como campo obrigatório no DTO de entrada
- Incluir `concept_id` nos INSERTs

**Passo 4 — Atualizar call sites**
Um por um (ou em lotes pequenos), atualizar os ~23 arquivos para passar `concept_id` real.
Cada lote é um commit atômico.

**Passo 5 — Validação E2E**
Gate CI: verificar que 100% dos INSERTs em bank_transactions têm concept_id NOT NULL.
```sql
SELECT COUNT(*) FROM bank_transactions WHERE concept_id IS NULL;
-- Deve retornar 0
```

**Passo 6 — Migration final**
```sql
ALTER TABLE bank_transactions
ALTER COLUMN concept_id SET NOT NULL;
```

**Prós:**
- Cada passo é atômico (P2 respeitado)
- Rollback viável por passo
- Permite paralelismo seguro (diferentes devs podem trabalhar em call sites diferentes)
- Sistema vazio elimina necessidade de backfill de linhas existentes
- Visibilidade de progresso (quantos call sites restam)

**Contras:**
- Janela transitória com coluna nullable
- Mitigação: gate CI validando que writers sempre populam o campo
- ~6 commits em vez de 1

---

### Opção C — NULL Permanente com Gate CI

**Descrição:**
Adicionar coluna nullable e nunca torná-la NOT NULL. Enforcement apenas em código/CI.

**Contras:**
- Viola a decisão travada ("zero fallback")
- Schema não reflete a invariante
- Drift entre código e banco possível

**Veredito:** DESCARTAR.

## 4. Recomendação

**Opção B — NULL-first + Validação + ALTER NOT NULL**

**Justificativa:**
1. **Princípio P2 (atomicidade):** Cada passo é um commit autocontido, verificável, revertível.
2. **Rollback granular:** Se o Passo 4 quebrar em algum call site, reverte-se só aquele commit.
3. **Paralelismo:** Call sites podem ser atualizados em paralelo por diferentes agentes/devs.
4. **Sistema vazio:** Não há linhas existentes para fazer backfill — o Passo 5 é só validação.
5. **Visibilidade:** Query simples mostra progresso (`WHERE concept_id IS NULL`).

## 5. Mapeamento Preliminar de Concepts por Call Site

**Objetivo:** Mostrar o tamanho da tarefa de seed/mapeamento. Não resolve aqui — só lista perguntas.

| Arquivo | Concept semântico? |
|---------|-------------------|
| regional-fund.service.ts | `?` (fund_allocation? regional_transfer?) |
| treasury-split.service.ts | `?` (treasury_distribution?) |
| bank-p2p-transfer.service.ts | `?` (p2p_transfer?) |
| donation.service.ts | `?` (donation?) |
| payment-execution.service.ts | `?` (order_payment? service_payment?) |
| escrow.service.ts | `?` (escrow_hold? escrow_release?) |
| payout.service.ts | `?` (payout?) |
| event-economy.service.ts | `?` (event_ticket_payment?) |
| test-currency.service.ts | `?` (test_currency? dev_seed?) |
| treasury-split-worker.ts | `?` (treasury_split_execution?) |
| payment-worker.ts | `?` (payment_processing?) |
| ... | ... |

**Próximo RFC:** Definir a taxonomia de concepts financeiros e mapear cada call site ao seu concept canônico.

## 6. Critério de Saída

Clayton aprova **Opção A**, **Opção B**, ou outra.

Após decisão, este RFC é atualizado com:
```
DECISÃO: <opção> — <data> — <justificativa 1 linha>
```

Só então se escreve:
1. RFC de seed de concepts financeiros
2. Migration do Passo 1
3. PRs de atualização de call sites

## 7. Fora do Escopo

- Taxonomia exata de concepts (RFC separado)
- Nome do parâmetro TypeScript nos writers (pode ser `conceptId` ou `concept_id`)
- Política de imutabilidade pós-emissão fiscal (COMPLIANCE §B)
- Coexistência com `purpose` (enum `transfer_purpose`) — pode ser deprecado depois

## 8. Decisão

_(Aguardando escolha de Clayton)_
