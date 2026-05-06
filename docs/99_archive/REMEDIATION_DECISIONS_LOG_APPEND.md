# APPEND AO REMEDIATION_DECISIONS_LOG.md

Conteúdo consolidado para anexar ao final do `REMEDIATION_DECISIONS_LOG.md` no repositório.
Duas novas decisões: 0012 (primeiro nível) e 0013 (segundo nível destrutivo).

---

### DECISION-0012 — AUDITORIA FORENSE PRIMEIRO NÍVEL: reabertura de C44 + elevação de C47 + 4 desvios de processo

- **Data:** 2026-04-22
- **Tipo:** meta-decisão (correção de processo + reclassificação)
- **IDs afetados:** C44 (reabertura), C47 (reclassificação), desvios de plano (formalização)

#### Contexto

Auditoria forense executada em 2026-04-22 confrontou código real (`SRC_FULL.txt`) contra SYSTEM_REMEDIATION_PLAN, STATUS, AUTHORITY_PRECEDENCE e SNAPSHOTS. Identificou 6 desvios entre o que o plano exige e o que foi executado.

#### Desvios identificados

**D1 — C44 marcado FIXED com correção parcial (CORRUPTOR silencioso)**

Evidência:
- `modules/marketplace/group.repository.ts:L172499-172501`: código admite que colunas não existem (`// C44: coluna nao existe no schema Genesis`) e retorna hardcoded `parentGroupId: null`, `createdByUserId: null`
- `modules/marketplace/group.types.ts:L172677-172685`: interface `Group` **ainda declara** `parentGroupId`, `createdByActorId`, `createdByUserId`
- `modules/marketplace/group.service.ts`: valida `input.parentGroupId` e chama `getGroupById(input.parentGroupId)` como se funcionasse

Consequência: repository mente ao consumidor. API aceita `parentGroupId` no payload, não dá erro, retorna tudo com `parentGroupId: null`. Classe real: CORRUPTOR. Fechamento violou P1 do plano.

Ação: C44 reaberto como REOPENED.

**D2 — C47 subestimado (HIGH → CRITICAL)**

Evidência:
- `migrations/20260421010000_actor_has_permission_stub.sql:L9344`: função SQL retorna `TRUE` incondicionalmente
- `SRC_FULL.txt:L95479`: único caller em produção (`core/rbac/rbac.service.ts`)
- AUTHORITY_PRECEDENCE §3 e §4.1: ATL é camada soberana

Stub fail-open torna `AUTHORITY_PRECEDENCE.md` inoperante em produção. Não pode esperar FASE 6.

Ação: C47 HIGH→CRITICAL, FASE 6→FASE 4.

**D3 — Gate `schema-coherence` desapareceu dos snapshots**

Plano §9 exige 5 gates. Último snapshot com `schema-coherence`: FASE 1 (FAIL 817 violações). Snapshots FASE 4 (C12, C44, C46) listam apenas 4 gates.

Consequência: sem esse gate base, convergência monotônica é indemonstrável.

Ação: snapshots futuros obrigados a listar 5 gates.

**D4 — Commit 5b3f2096 violou P2**

Commit C13 crítico/2 misturou: (a) adicionar `acquireAccountLock` em bank-account.service.ts; (b) reconstruir 234 linhas do serviço a partir do `dist/`. Viola P2 (atomicidade) e AUTHORITY_PRECEDENCE §4.4 (IA não cria autoridade).

Ação: protocolo novo — reconstruções > 50 linhas exigem autorização humana explícita antes do write.

**D5 — Snapshot C12 quebrou monotonicidade sem declaração formal**

Snapshot C12 registrou "OPEN 28 → 29 (+1 temporário)". DECISION-0009 justifica mas não declara desvio de monotonicidade.

Ação: formalizada exceção permitida — reclassificações honestas (violação genérica → violações específicas) são exceção à monotonicidade, desde que (a) registradas em DECISIONS_LOG, (b) soma de OPEN não aumente mais de 2 na sessão, (c) cada nova OPEN tenha deadline + owner + justificativa.

**D6 — Contagens divergentes entre STATUS e snapshot**

STATUS topo: "OPEN 26 / FIXED 14 / DECISION_PENDING 9".
Último snapshot C46: "OPEN 28 / FIXED 12 / DECISION_PENDING 9".
Não batem.

Ação: reconciliação forçada. STATUS realinhado para 26 OPEN / 13 FIXED / 1 REOPENED (C44) / 9 DECISION_PENDING.

#### Decisões

1. C44 REOPENED. Classe corrigida para CORRUPTOR.
2. C47 CRITICAL, FASE 4.
3. Snapshots futuros DEVEM listar 5 gates.
4. Protocolo de reconstrução > 50 linhas exige autorização humana.
5. STATUS e snapshot não podem divergir.
6. Reclassificações honestas formalizadas como exceção à monotonicidade.

#### Responsável
Clayton (arbitragem). Decisão emitida por Claude (diretora, auditoria forense primeiro nível).

#### Referências
- SYSTEM_REMEDIATION_PLAN.md v1.0 §9, P1, P2
- AUTHORITY_PRECEDENCE.md §3, §4.1, §4.4
- DECISION-0009, DECISION-0010
- modules/marketplace/group.types.ts, group.repository.ts, group.service.ts
- migrations/20260421010000_actor_has_permission_stub.sql

---

### DECISION-0013 — AUDITORIA FORENSE SEGUNDO NÍVEL (destrutiva): 6 novas violações C52-C57 + reabertura de C14

- **Data:** 2026-04-22
- **Tipo:** meta-decisão (descoberta destrutiva + reabertura + obrigação de correção estrutural)
- **IDs afetados:** C14 (reaberto), C52, C53, C54, C55, C56, C57 (todos novos)
- **Supera:** nenhuma. **Complementa:** DECISION-0012.

#### Contexto

Primeira rodada de auditoria (DECISION-0012) foi **reprovada** por Clayton como superficial:
- Não executou falsificação real
- Não validou SSOT financeiro ponto a ponto
- Não testou causalidade
- Não tentou reabrir FIXEDs além de C44
- Zero novas violações num sistema com 50 abertas era estatisticamente improvável

Mandato de segunda rodada: **quebrar o sistema** se ele não estivesse correto. Cinco vetores atacados (SSOT, Schema drift, Integridade financeira, Authority bypass, Causalidade). Resultado: 6 novas violações reais + 1 FIXED reaberto.

#### Violações confirmadas

**C52 — `payment_intents` tem 2 writers com contratos divergentes** (HIGH, DECISION_PENDING)

- `modules/marketplace/payment-intent.repository.ts:L187829` — INSERT `(tenant_id, order_id, amount_cents, currency, status, metadata)` status `'CREATED'`
- `modules/payments/payment-intent-repository.ts:L221983` — INSERT `(tenant_id, reference_id, gateway, actor_id, amount_cents, currency, status, metadata)` status `'created'`

Classe: CORRUPTOR. Pior que C10 — mesma tabela, colunas diferentes, case diferente. Consumer filtrando por status uppercase não vê registros do outro writer.

**C53 — 6 catches de `42P01` ativos em caminhos críticos** (HIGH, OPEN)

- `core/compliance/authority-decision.service.ts` L39473, L39530, L39607 (autoridade!)
- `core/events/event-handler-failure.repository.ts` L47474, L47486, L47541, L47573 (event replay)
- `core/observability/handler-metrics.service.ts` L76676

Classe: CORRUPTOR. Subset reaberto de C14. Os 3 em compliance são especialmente graves — silenciam erro na camada de autoridade.

**C54 — 9 caminhos de produto movem dinheiro sem `requireFinancialRiskClearance`** (CRITICAL, OPEN)

Caminhos de produto (excluindo workers esperados rodarem como sistema):
- `core/economy/transaction.service.ts`
- `modules/escrow/escrow.service.ts`
- `modules/gateway/payment-event-resolver.ts`
- `modules/marketplace/payout.service.ts`
- `modules/marketplace/regional-fund.service.ts`
- `modules/marketplace/application/services/capacity-application.service.ts`
- `modules/marketplace/application/services/marketplace-orchestration.service.ts`
- `modules/marketplace/domain/orders/marketplace-orders.service.ts`
- `modules/treasury-split/treasury-split.service.ts`

Apenas 3 de 15 chamadores respeitam o gate (`payment-execution`, `reversal`, `bank-p2p-transfer`).

Classe: BLOCKER. Viola LEI §4.9.5 frontalmente.

**C55 — `authority-decision.service.ts` é fail-open em ATL/KYC/GUARDA** (CRITICAL, OPEN)

Padrão sistemático em `core/compliance/authority-decision.service.ts`: **"estado ausente = skip"**:
- ATL (L39476-39541): sem linha em `authority_roots` → skip. Sem linha ativa em `authority_trust_levels` → skip. Erro `42P01` → skip.
- KYC (L39571-39611): actor não encontrado → skip. `kyc_status == null` → skip. Erro `42P01` → skip.
- GUARDA: mesmo padrão.

Classe: BLOCKER. Sistema vazio (estado atual) = todos os skips disparam = autoridade inoperante. AUTHORITY_PRECEDENCE §4.1 inverted.

**C56 — `real-margin.service.ts` deriva receita via metadata** (CRITICAL, OPEN)

`modules/marketplace/real-margin.service.ts:L194079`:
```sql
SUM(COALESCE(
  (oi.metadata->'priceSnapshot'->>'finalPrice')::numeric,
  (oi.metadata->>'price')::numeric,
  0
) * oi.quantity) AS gross_revenue
```

Alimenta `gross_revenue` exposto como métrica de produto. Viola LEI §4.6 e PLANO §8. Gate cego para essa derivação.

Classe: CORRUPTOR.

**C57 — `authority_roots` sem FK para `actors`** (MEDIUM, OPEN)

Schema cria `authority_roots(actor_id UUID PRIMARY KEY)` sem `REFERENCES actors(id)`. Permite linha órfã → concede autoridade a actor inexistente.

Classe: DEBT com viés CORRUPTOR.

**C14 — REOPENED**

Reaberto como consequência de C53. Status FIXED baseado em classificação "11 catches SAFE" foi superficial — 6 desses catches estão em caminhos críticos.

#### Opções consideradas (principais)

**C52:**
- A. Consolidar em `modules/payments/payment-intent-repository.ts` (assinatura mais rica). **Recomendação técnica.**
- B. Consolidar em `modules/marketplace/payment-intent.repository.ts` (assinatura mais simples).
- C. Manter separados com tabelas físicas distintas.
- D. Contrato unificado em ambos.

**C55:**
- Inverter semântica de ausência via flag `strict`/`permissive`. Dev/sistema vazio roda em `permissive`; migração obrigatória para `strict` antes de primeiro usuário.

**C56:**
- Mover cálculo para `bank_ledger` (decisório), OU
- Documentar como estimativa (não-decisório) e garantir que nenhuma decisão financeira dependa.

#### Decisões

1. C14 REOPENED.
2. C52-C57 registrados conforme tabela.
3. **C47+C54+C55+C57 formam o "quadrinho de autoridade"** — têm que fechar juntos antes de qualquer cadastro real no sistema.
4. C52 entra na fila de decisões arquiteturais (sobe DECISION_PENDING para 10).
5. C56 exige decisão de produto separada.
6. Gates novos obrigatórios antes de FASE 4 concluída:
   - Callgraph `transfer`/`capture`/`reverse` → `requireFinancialRiskClearance` precedente
   - FKs entre tabelas SSOT (authority_roots↔actors, etc.)
   - Múltiplos writers por tabela
   - `::numeric` sobre `metadata->>` em coluna monetária
7. **Autocrítica obrigatória para próximas auditorias:**
   - Sempre falsificação real, não só leitura
   - Sempre tentar reabrir FIXEDs (mínimo 30% amostragem)
   - Sempre callgraph + cross-reference
   - Sempre identificar blind spots de gate
   - Zero novas violações = red flag — auditar a auditoria

#### Plano de execução

1. Commit DECISION-0012 + DECISION-0013 em REMEDIATION_DECISIONS_LOG.md
2. Commit STATUS atualizado (C14 REOPENED, C52-C57 adicionados)
3. Snapshot forense 2º nível em REMEDIATION_SNAPSHOTS.md
4. Sessão arquitetural imediata sobre C52
5. Sessão de fechamento do quadrinho de autoridade (C47+C54+C55+C57)
6. Sessão de fechamento de C53
7. Só então FASE 4 concluída

#### Consequências esperadas

- Contagem final: 31 OPEN / 13 FIXED / 2 REOPENED / 10 DECISION_PENDING (56 total)
- CRITICAL: 13 → 16
- HIGH: 22 → 24
- MEDIUM: 12 → 13

Regressão documental aparente = convergência real. Auditoria expôs o que já existia.

#### Dívida registrada

Se C47+C54+C55+C57 não fecharem como unidade antes do primeiro usuário real:
- Sistema de autoridade estruturalmente inoperante
- AUTHORITY_PRECEDENCE.md perde força em produção
- Qualquer cadastro pode executar ações financeiras sensíveis sem gate efetivo

#### Responsável
Clayton (arbitragem). Decisão emitida por Claude (diretora, auditoria forense segundo nível).

#### Validação prévia
Auditoria destrutiva conduzida em 2026-04-22 após reprovação explícita. 5 vetores atacados. 6 violações confirmadas. 1 reabertura.

#### Referências
- SYSTEM_REMEDIATION_PLAN.md v1.0 §8, P1
- AUTHORITY_PRECEDENCE.md §3, §4.1, §4.4
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md §4.6, §4.9.5, §5, §7
- DECISION-0012
- core/compliance/authority-decision.service.ts
- modules/marketplace/real-margin.service.ts:L194079
- modules/marketplace/payment-intent.repository.ts:L187829
- modules/payments/payment-intent-repository.ts:L221983
- migrations/20260421010000_actor_has_permission_stub.sql

---

**FIM DO APPEND**
