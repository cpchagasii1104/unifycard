# RFC C2 Rollout — Estratégia de Introdução de bank_transactions.concept_id

**Status:** DECIDIDO · Opção B · 2026-04-24
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

**Passo 3 — Introduzir concept_id nos writers (3 sub-passos atômicos)**

*Passo 3-A:* Adicionar `concept_id: string | undefined` ao DTO (`CreateBankTransactionInput` em `bank-transaction.types.ts`) + runtime `throw CONCEPT_ID_REQUIRED` se `undefined` chegar ao INSERT em qualquer writer.
Done: build compila (campo opcional no tipo); ausência falha visivelmente com stack trace rastreável; zero NULL silencioso no ledger. P2 respeitado (commit autônomo e revertível).

*Passo 3-B:* Atualizar os ~23 arquivos call sites, um a um (ou em lotes por domínio), passando `concept_id` resolvido conforme mapeamento do RFC de seed.
Done por arquivo: build verde + runtime guard nunca disparado naquele call site.
Done global: `grep -r "concept_id: undefined"` no codebase retorna vazio.

*Passo 3-C:* Tornar `concept_id: string` (remover `| undefined` do DTO). Manter o runtime `throw` como **defensive invariant permanente** — cobre chamadas dinâmicas, dados externos e qualquer bypass fora do sistema de tipos.
Done: TS impede omissão em compile-time; runtime guard permanece ativo como segunda camada. Só executável após 3-B done global.

**Passo 4 — Atualizar call sites**
(Incorporado ao Passo 3-B acima.)

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
- Remoção do runtime guard (manter como defensive invariant permanente — TS não cobre chamadas dinâmicas)

## 8. Decisão

**DECISÃO: Opção B (NULL-first → seed → writers → call sites → NOT NULL)** — 2026-04-24 — Única opção que respeita P2 (atomicidade por passo), admite rollback granular, e explora a vantagem do sistema vazio (Passo 6 sem backfill histórico).

**Observação factual adicional (não muda a decisão):** Os ~63 concepts atualmente seeded cobrem apenas os domínios `servicos` e `item-comercial`. Nenhum concept de operação financeira (payout, escrow, split, p2p, treasury, etc.) está cadastrado. O RFC de seed de concepts financeiros (próximo passo) terá trabalho real de taxonomia, não só de organização.

## 9. Refinamento — 2026-04-24

O Passo 3 original ("tornar concept_id obrigatório no DTO antes de atualizar call sites") foi refinado em 3 sub-passos (3-A, 3-B, 3-C) para preservar atomicidade commit-a-commit. O Passo 4 original foi incorporado ao Passo 3-B. A sequência de passos do rollout não muda — apenas a execução interna do Passo 3 foi detalhada.