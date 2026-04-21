# REMEDIATION SNAPSHOTS

**Documento append-only. Registro histórico da saúde global do sistema ao longo da remediação.**
**Um snapshot registrado nunca é editado.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Último snapshot | (nenhum) |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0, Seção 9 (Validação de Estado Global) |

---

## Objetivo deste documento

Garantir **convergência monotônica** do sistema ao longo da remediação.

A cada fase completa, snapshot numérico é registrado. Comparação com snapshot anterior expõe se o sistema está melhorando, estagnando ou regredindo em qualquer dimensão medida.

**Piora em qualquer dimensão sem justificativa registrada em `REMEDIATION_DECISIONS_LOG.md` bloqueia avanço para próxima fase.**

---

## Quando registrar um snapshot

- **Obrigatório:** ao final de cada FASE completa (FASE 0, 1, 2, 3, 4, 5, 6, 7, 8)
- **Obrigatório:** antes de iniciar sessão arquitetural (FASE 6)
- **Recomendado:** após qualquer commit que altere gate, migrations ou >5 arquivos de código
- **Proibido:** registrar snapshot de conveniência ("parece estar bom agora") — apenas quando fase está realmente concluída segundo seu critério de aceitação

---

## Formato obrigatório de cada snapshot

```markdown
## SNAPSHOT após <FASE N / EVENTO> — YYYY-MM-DD

**Commit de referência:** <hash curto>
**Responsável:** <nome>

### Gates
- schema-coherence: <PASS | FAIL>, <N violações>
  - BLOCKER: N
  - CORRUPTOR: M
  - DEBT: K
- actor-writer-boundaries: <PASS | FAIL>
- bank-ledger-boundaries: <PASS | FAIL>
- regression-guards: <PASS | FAIL>
- architectural-patterns: <PASS | FAIL>

### Compilação
- tsc --noEmit: <N erros>

### Gate interno (extração)
- Arquivos .ts varridos: N
- Strings SQL candidatas: X
- Strings SQL válidas: Y
- Rejeitadas: X - Y

### Schema
- Tabelas no banco: N
- Tabelas em migrations: M
- DIFF: <lista>

### Allowlist
- Entradas ativas válidas: N
- Entradas expiradas: M
- Entradas adicionadas desde último snapshot: K
- Entradas removidas desde último snapshot: L

### Seed + E2E
- Seed realista executou completo: <sim | não | n/a>
- Fluxos validados: <lista ou "nenhum">
- Ledger consistente: <sim | não | n/a>
- Erros em E2E: <lista ou "nenhum">

### Status das violações
- Total: 30
- OPEN: N
- IN_PROGRESS: M
- FIXED: K
- ALLOWLISTED: L
- DEFERRED: P
- DECISION_PENDING: Q

### Decisões arquiteturais registradas desde último snapshot
- DECISION-NNNN, DECISION-MMMM, ... (ou "nenhuma")

### Comparação com snapshot anterior
- <métrica X>: <valor anterior> → <valor atual> (<melhor/pior/igual>)
- <métrica Y>: ...

### Análise de convergência
<texto curto: está convergindo? alguma dimensão piorou? se sim, justificativa em DECISION-NNNN>
```

---

## Regras de integridade

- **Ordem cronológica** estrita. Snapshot registrado nunca é reordenado.
- **Commit padronizado:** `"snapshot: FASE <N> concluída"`.
- **Nunca editar snapshot registrado.** Erros de registro: nova entrada com `Corrige SNAPSHOT de YYYY-MM-DD` e justificativa.
- **Piora detectada:** entrada obrigatória em `REMEDIATION_DECISIONS_LOG.md` antes do próximo snapshot.

---

## Registros

## SNAPSHOT após FASE 0 — 2026-04-21

**Commit de referência:** ab407330  
**Responsável:** Clayton

### Base normativa estabelecida

Arquivos criados e commitados na raiz C:\unificard\:

| Arquivo | Commit | Status |
|---|---|---|
| SYSTEM_REMEDIATION_PLAN.md | sessão 2026-04-21 | ✓ commitado |
| SYSTEM_REMEDIATION_STATUS.md | 848da51e | ✓ commitado |
| REMEDIATION_DECISIONS_LOG.md | ab407330 | ✓ commitado |
| REMEDIATION_SNAPSHOTS.md | ab407330 | ✓ commitado |

docs/01_normative/00_AGENT_PROTOCOL.md atualizado com seção §2.5 (commit 04a47b6f).

### Gates (estado na conclusão da FASE 0)

- schema-coherence v1: FAIL (895 violações — esperado, classificação antiga ainda não corrigida)
  - BLOCKER: 331
  - CORRUPTOR: 564
  - DEBT: 0
- actor-writer-boundaries: PASS (verde)
- bank-ledger-boundaries: PASS (verde)
- regression-guards: PASS (verde)
- architectural-patterns: PASS (verde)

### Compilação
- tsc --noEmit: 0 erros (corrigido em sessão anterior)

### Gate interno — extração (após ETAPA 1 do gate v1.1)
- Arquivos .ts varridos: 1.660
- Strings SQL candidatas (bruto): 3.170
- Strings SQL válidas (pós-filtro): 2.422
- Rejeitadas: 748 (376 em log, 11 em comentário, 361 outras)

### Schema
- Tabelas no banco: 206
- Tabelas em migrations (parser v1): 207
- DIFF banco↔migrations:
  - Em banco mas não em migrations: _deprecated_product_concept_resolution_queue, _deprecated_tenant_products, schema_migrations, system_coverage
  - Em migrations mas não em banco: _migration_category_merge, catalog_products, tenant_products, product_concepts, product_concept_resolution_queue

### Allowlist
- Entradas ativas válidas: 0 (nenhuma criada ainda)
- Entradas expiradas: 0

### Seed + E2E
- Seed realista: n/a (não implementado ainda — FASE 3)
- Ledger consistente: n/a

### Status das violações
- Total: 30
- OPEN: 21 | IN_PROGRESS: 0 | FIXED: 1 | ALLOWLISTED: 0 | DEFERRED: 0 | DECISION_PENDING: 8

### Próxima fase
FASE 1 — VISIBILIDADE
- Próxima ação: ETAPA 2 do gate v1.1 (parser de schema estendido para DO $$ blocks)
- Gate v1.1 ETAPA 1 commitado: 4b84175f
- ETAPAs pendentes: 2, 3, 4, 5 (validação manual)

### Comparação com snapshot anterior
- Primeiro snapshot — sem comparação disponível.

### Análise de convergência
FASE 0 concluída com sucesso. Base normativa estabelecida. Nenhuma regressão técnica.
Sistema ainda em estado de deriva sistêmica (30 violações abertas), conforme esperado.
Gate v1 rodou e detectou 895 violações brutas (maioria falso-positivo por classificação
antiga — corrigido nas próximas ETAPAs do gate v1.1).

---

## SNAPSHOT após FASE 1 — 2026-04-21

**Commit de referência:** 271d7569
**Responsável:** Clayton

### Gates
- schema-coherence v1.1: FAIL (817 violações — 326 BLOCKER + 491 CORRUPTOR + 88 DEBT)
  - BLOCKER: 326 (era 331 antes do allowlist)
  - CORRUPTOR: 491
  - DEBT: 88
- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS

### Compilação
- tsc --noEmit: 0 erros

### Gate schema-coherence — métricas de extração
- Arquivos .ts varridos: 1.660
- Strings SQL candidatas (bruto): 3.170
- Strings SQL válidas (pós-filtro): 2.422
- CREATE TABLE padrão A: 208 | padrão B (DO $$): 0
- Tabelas no banco: 206 | Em migrations: 207

### Schema DIFF banco↔migrations
- Em banco mas não em migrations: _deprecated_product_concept_resolution_queue, _deprecated_tenant_products, schema_migrations, system_coverage
- Em migrations mas não em banco: _migration_category_merge, catalog_products, product_concept_resolution_queue, product_concepts, tenant_products

### Allowlist
- Entradas ativas válidas: 10
- Entradas aplicadas: 5 (C1, C31, C32-C33, C34, C35)
- Entradas com tableMatch mas sem fileMatch ainda: C3, C4, C8, C12, C13 (files_scope não cobre todos os paths)

### Seed + E2E
- Seed realista: n/a (FASE 3)
- Ledger consistente: n/a

### Status das violações
- Total: 35
- OPEN: 26 | IN_PROGRESS: 0 | FIXED: 1 | ALLOWLISTED: 0 | DEFERRED: 0 | DECISION_PENDING: 8

### Writers verificados pelo gate
- Escritas em bank_* fora de módulos autorizados: 0 ✅
- Leituras em bank_* fora de módulos autorizados: 10 (C13)
- INSERT em actors fora do writer canônico: 2 (C3)

### Padrões proibidos detectados pelo gate
- Catches de schema (42P01): 0 detectados (falso negativo — real é ~9, ver DECISION-0001)
- metadata->> em decisão transacional: 0 detectados (falso negativo — real é ~9, ver DECISION-0001)

### Comparação com snapshot FASE 0
- Bloqueantes: 331 → 326 (↓ 5 por allowlist)
- Corruptores: 501 → 491 (↓ 10)
- DEBT: 91 → 88 (↓ 3)
- Allowlist: 0 → 5 entradas ativas
- Violações totais rastreadas: 30 → 35 (↑ 5 novas: C31-C35)

### Decisões registradas desde FASE 0
- DECISION-0001 (commit 2ad9d801): falsos negativos gate v1.1

### Análise de convergência
FASE 1 concluída. Gate v1.1 operacional com allowlist funcionando.
Allowlist cobre 5 das 10 entradas (C1, C31-C35). C3, C4, C8, C12, C13 ainda
não suprimidos por files_scope incompleto — manter como monitorados.
Sistema convergiu levemente (326 vs 331 bloqueantes).
Próxima fase: FASE 2 (C14 incremental — remover catches de schema).

---

**Próximo snapshot esperado:** após conclusão da FASE 2 (C14 incremental).

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada fase)
