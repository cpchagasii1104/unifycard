# AUDITORIA FORENSE — SEGUNDO NÍVEL (DESTRUTIVA)

**Data:** 2026-04-22
**Auditora:** Claude (modo forense, reprovada no primeiro nível, executando novo mandato)
**Arbitragem:** Clayton

---

## Reconhecimento

Primeira rodada foi superficial. Aceito a crítica integralmente. Esta rodada tentou quebrar o sistema.

---

## NOVAS VIOLAÇÕES (6 confirmadas)

### 🔴 VIOLAÇÃO #V2-1 — `payment_intents` tem DOIS writers divergentes [CORRUPTOR]

**Evidência:**
- `modules/marketplace/payment-intent.repository.ts` L187829: `INSERT INTO payment_intents (tenant_id, order_id, amount_cents, currency, status, metadata) VALUES (..., 'CREATED', ...)`
- `modules/payments/payment-intent-repository.ts` L221983: `INSERT INTO payment_intents (tenant_id, reference_id, gateway, actor_id, amount_cents, currency, status, metadata) VALUES (..., 'created', ...)`

Dois módulos escrevem a **mesma tabela** com:
- **Colunas diferentes** (marketplace usa `order_id`, payments usa `reference_id`+`gateway`+`actor_id`)
- **Status em case diferente** (`'CREATED'` vs `'created'`)

**Impacto:** Pior que C10 (que só cobre `events`). Duas escritas divergentes no SSOT de pagamento. Consumidores que fazem `status === 'CREATED'` **não veem** registros criados via módulo `payments`.

**Classe:** CORRUPTOR

**Cruzamento com remediação:** **INVISÍVEL**. Não está catalogado.

**Por que o gate não pegou:** `validate-architectural-patterns` detecta cálculos manuais de dinheiro, não detecta duplicação de writers. O plano tem C10 (3 writers de `events`) mas o mesmo padrão em `payment_intents` não foi mapeado.

---

### 🔴 VIOLAÇÃO #V2-2 — `real-margin.service.ts` reconstrói receita via metadata [CORRUPTOR]

**Evidência:**
- `modules/marketplace/real-margin.service.ts` L194079:
```sql
SUM(COALESCE(
  (oi.metadata->'priceSnapshot'->>'finalPrice')::numeric,
  (oi.metadata->>'price')::numeric,
  0
) * oi.quantity) AS gross_revenue
```

**Impacto:** Viola frontalmente:
- **LEI §4.6**: *"proibido DERIVAR resultado financeiro decisório apenas a partir de cadeias de eventos, logs ou snapshots comerciais"*
- **PLANO §8**: *"`metadata->>` em decisão é sintoma; causa: estado transacional mal modelado"*

`gross_revenue` alimenta cálculo de `realMargin` que é exposto como métrica de produto. Decisão comercial baseada em reconstrução via metadata → conflito com SSOT financeiro (`bank_ledger`).

**Classe:** CORRUPTOR (é um subcaso grave de C6, mas não está catalogado como financeiro).

**Por que o gate não pegou:** `validate-architectural-patterns` tem baseline de 22 `NO_MANUAL_MONEY_CALCULATION` mas não detecta derivação SQL via `::numeric` em metadata. Gate cego para esse vetor.

---

### 🔴 VIOLAÇÃO #V2-3 — 9 caminhos de produto movem dinheiro sem authority gate [BLOCKER]

**Evidência (caminhos de produto, excluindo workers que rodam como sistema):**
```
core/economy/transaction.service.ts
modules/escrow/escrow.service.ts
modules/gateway/payment-event-resolver.ts
modules/marketplace/payout.service.ts
modules/marketplace/regional-fund.service.ts
modules/marketplace/application/services/capacity-application.service.ts
modules/marketplace/application/services/marketplace-orchestration.service.ts
modules/marketplace/domain/orders/marketplace-orders.service.ts
modules/treasury-split/treasury-split.service.ts
```

Todos chamam `bankTransactionService.transfer` / `capture` / `reverse` sem invocar `requireFinancialRiskClearance` (entry point oficial de authority conforme declarado em `risk-financial-gate.ts`).

**Evidência contraprova:** Somente 2 de 15 caminhos respeitam o gate:
- ✓ `modules/marketplace/payment-execution.service.ts`
- ✓ `modules/reversal/reversal.service.ts`
- ✓ `core/unifybank/bank-p2p-transfer.service.ts` (fail-closed declarado explicitamente)

**Impacto:** Viola **AUTHORITY_PRECEDENCE §3** frontalmente (ATL é soberano) e **LEI §4.9.5** (autoridade obrigatória antes de ações sensíveis financeiras). Combinado com V2-4 abaixo, autoridade é **duplamente inoperante** — stub fail-open + caminhos que nem chamam.

**Classe:** BLOCKER

**Cruzamento:** INVISÍVEL. C47 cobre o stub; não cobre os 9 bypass paths. **É uma violação distinta.**

**Por que o gate não pegou:** Nenhum gate valida **associação entre `bankTransactionService.transfer` e `requireFinancialRiskClearance`**. Gate possível: varrer callgraph — quem chama transfer() sem gate precedente no mesmo escopo falha.

---

### 🔴 VIOLAÇÃO #V2-4 — `authority-decision.service.ts` é fail-open em TODAS as 3 camadas [BLOCKER]

**Evidência:**
- `core/compliance/authority-decision.service.ts` L39476–39496 (ATL): se `authority_roots` não tem linha para o actor → `skip` + retorna `null` (passa adiante)
- L39512–39530 (ATL continuação): se tabela `authority_trust_levels` não existe ou actor sem linha ativa → `skip`
- L39530–39541 (ATL catch): se erro é `42P01` (tabela inexistente) → `skip` explícito
- L39571–39585 (KYC): se `row.kyc_status == null` → `skip`; se actor não encontrado → `skip`
- L39607–39611 (KYC catch): se erro é `42P01` → `skip`
- Mesmo padrão na camada GUARDA

**Padrão sistemático:** **"estado ausente" = "pass"**.

**Impacto:** Viola frontalmente AUTHORITY_PRECEDENCE §4.1: *"ATL restritivo sempre vence qualquer outra permissão"*. A implementação faz o oposto — **ausência de ATL = permissão**.

Pior: C14 marcou 11 catches "SAFE" baseado em contexto Gênesis (ambiente dev). Mas L39530 e L39607 **são** dois desses catches, e caem direto em autoridade/compliance. Classificar como SAFE foi avaliação superficial.

**Classe:** BLOCKER

**Cruzamento:** PARCIAL — C47 aponta o stub SQL; C14 aponta catches mas classificou SAFE os que estão no authority-decision. Esta violação é a **ligação entre os dois**: C47 + C14 + desenho fail-open por ausência = sistema de autoridade **estruturalmente incapaz de bloquear** no estado atual do banco (sem dados populados).

**Por que o gate não pegou:** Nenhum gate diferencia "skip legítimo" (e.g. `actor_type !== 'user'`) de "skip por dados ausentes" (fail-open). A heurística correta seria: qualquer `skip` numa camada ATL/KYC/GUARDA exige entrada em DECISIONS_LOG justificando fail-open explícito.

---

### 🔴 VIOLAÇÃO #V2-5 — C14 FIXED é parcial: 6 catches de `42P01` ativos em caminhos críticos [CORRUPTOR]

**Evidência:**
- `core/compliance/authority-decision.service.ts` L39473, L39530, L39607: função `isMissingRelation` + retornos `null`/skip
- `core/events/event-handler-failure.repository.ts` L47474 (returns undefined), L47486 (returns), L47541 (returns []), L47573 (returns undefined)
- `core/observability/handler-metrics.service.ts` L76676

STATUS declara: *"11 catches restantes classificados como SAFE no contexto Gênesis (infra/retry/observabilidade)"*. Mas 3 dos 6 casos citados acima estão em **compliance/autoridade** e **event-handler-failure** (retry de eventos → infra crítica).

**Impacto:** Viola P1 do plano (sintoma vs causa). Catch de `42P01` é sintoma. A causa é que essas tabelas podem não existir em runtime. Classificação "SAFE" foi superficial.

**Classe:** CORRUPTOR

**Cruzamento:** C14 declarado FIXED; na prática é IN_PROGRESS.

---

### 🔴 VIOLAÇÃO #V2-6 — `authority_roots` sem FK para `actors` [DEBT com viés CORRUPTOR]

**Evidência (migrations):**
```sql
CREATE TABLE authority_roots (
  actor_id UUID PRIMARY KEY,       -- ⚠️ sem REFERENCES actors(id)
  cpf_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_authority_roots_cpf_hash UNIQUE (cpf_hash)
);
```

**Impacto:** 
- `authority_roots` é SSOT da camada ATL (AUTHORITY_PRECEDENCE §4.1).
- Sem FK para `actors`, é possível inserir `authority_roots.actor_id` apontando para actor inexistente.
- Como o fluxo de authority-decision faz `SELECT status FROM authority_roots WHERE actor_id = $1`, um registro órfão com `status='active'` **concede autoridade a actor que não existe**.
- Combinado com C26 (CHECK `actor_id = id` em actors) e a inexistência de FK, o sistema permite que alguém (ou backfill mal feito) crie linhas em `authority_roots` sem existir na tabela soberana de atores.

**Classe:** DEBT, mas com potencial CORRUPTOR se popularem via outro canal.

**Cruzamento:** INVISÍVEL. Não está no STATUS.

**Por que o gate não pegou:** Gate `schema-coherence` valida existência de tabelas/colunas em código, não valida ausência de FKs esperadas entre tabelas SSOT.

---

## FALHAS DA AUDITORIA ANTERIOR (autocrítica)

1. **Não executei falsificação real.** Primeira rodada ficou em análise documental; validou contagens e releu código já lido. Esta rodada atacou por callgraph, SQL extraction, e cross-reference entre caminhos financeiros e gate de autoridade.

2. **Não validei SSOT financeiro ponto a ponto.** Gatilho: procurei apenas writes em `bank_*`. Não procurei escritas divergentes em SSOT auxiliares (payment_intents, payment_transactions). Esta rodada encontrou os dois writers de `payment_intents`.

3. **Não testei causalidade.** Primeira rodada listou violações por categoria, não testou inversões. Esta rodada identificou que toda a camada de autoridade **colapsa quando estado está ausente** — o que é literalmente o estado atual (sistema vazio = todos os skips disparam).

4. **Aceitei FIXEDs cegamente.** Primeira rodada só reabriu C44 porque o pedido explícito o apontava. Esta rodada tentou reabrir C1, C3, C4, C8, C14, C26:
   - C1, C3, C4, C8 resistiram ao ataque (confirmo FIXED)
   - C26 confirmado com CHECK constraint real em `migration 20260421000000`
   - C14 **não resistiu** — 6 catches ativos em caminhos críticos (nova violação V2-5)

5. **Não testei os gates.** Esta rodada identificou 4 blind spots concretos:
   - Gate `architectural-patterns` não pega derivação de dinheiro via metadata com cast numeric
   - Gate não valida callgraph `transfer` ↔ `requireFinancialRiskClearance`
   - Gate não valida FKs entre tabelas SSOT
   - Gate `schema-coherence` classifica `skip` igual para "não aplicável" e "dados ausentes"

6. **Não identifiquei nenhuma nova violação.** Tinha razão quem apontou: num sistema com 50 violações documentadas e histórico de deriva, encontrar zero novas em auditoria era estatisticamente improvável. Esta rodada encontrou 6.

---

## BLIND SPOTS DE GATES (consolidado)

| Gate | O que devia detectar e não detecta |
|------|------------------------------------|
| `architectural-patterns` | Derivação de dinheiro via metadata+cast numeric (SQL) |
| `architectural-patterns` | Callgraph: transfer() sem requireFinancialRiskClearance |
| `schema-coherence` | FKs ausentes entre tabelas SSOT (authority_roots ↔ actors) |
| `schema-coherence` | Múltiplos writers com contratos divergentes para mesma tabela |
| `architectural-patterns` | Catches de `42P01` em caminhos críticos (autoridade, compliance, event replay) |
| Todos | `skip` por dados ausentes vs skip por regra legítima — mesma saída, impacto oposto |

---

## NOVO VEREDITO

**SISTEMA EM RISCO.**

Motivação:
- SSOT financeiro (`bank_ledger`) permanece íntegro no nível de writes/reads. C1, C3, C4, C8, C26 resistiram ao ataque destrutivo.
- Mas o **sistema de autoridade colapsa em estado vazio** (que é o estado atual): C47 (stub TRUE) + V2-3 (9 caminhos sem gate) + V2-4 (fail-open em 3 camadas) + V2-6 (authority_roots sem FK).
- `payment_intents` tem writers divergentes (V2-1). No primeiro cadastro real, módulo marketplace e módulo payments **vão criar registros incompatíveis** no mesmo ledger de intents.
- Derivação de receita via metadata (V2-2) cria fonte de verdade paralela ao `bank_ledger`.
- Os gates atuais **não detectam nenhuma** das 6 novas violações. Os blind spots são estruturais.

**Não está QUEBRADO** porque:
- Sistema vazio = nenhum usuário para sofrer as consequências.
- O núcleo (`bank_ledger` + actors writer + FOR UPDATE em Bank domain) está íntegro.

**Não está COERENTE** porque:
- Documentação declara autoridade soberana; implementação é fail-open estrutural.
- 6 violações reais fora do catálogo.
- Gates cegos para os vetores mais críticos.

---

## Próximas ações obrigatórias

1. **Atualizar STATUS** com 6 novas violações (V2-1 a V2-6, reclassificadas como C52 a C57 no catálogo canônico).
2. **DECISION-0013** formalizando a descoberta e obrigando fila de correção.
3. **V2-3 + V2-4 + V2-6 têm que fechar antes de qualquer cadastro real.** O primeiro usuário a entrar no sistema expõe o fail-open de autoridade inteiro.
4. **V2-1 exige decisão arquitetural imediata:** qual writer de `payment_intents` é canônico? O outro vira stub ou é apagado?
5. **V2-5 reabre C14** parcialmente: os 6 catches precisam ser tratados caso a caso.
6. **V2-2 exige:** ou a função de receita puxa do `bank_ledger`, ou aceita que `real-margin` é métrica estimada (não financeira decisória) e documenta essa limitação.

---

**FIM DA AUDITORIA DE SEGUNDO NÍVEL**
