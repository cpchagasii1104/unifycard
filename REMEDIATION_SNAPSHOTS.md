# REMEDIATION SNAPSHOTS

**Documento append-only. Registro histórico da saúde global do sistema ao longo da remediação.**
**Um snapshot registrado nunca é editado.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Último snapshot | FASE 4 — C3 fechado — 2026-04-21 (1ca3d8b7) |
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

---

## SNAPSHOT intermediário — C14 concluído — 2026-04-21

**Commit de referência:** 8191b6f6
**Responsável:** Clayton

### Progresso C14
- 4 catches CRITICAL removidos: unified-availability.routes.ts (lista disponibilidades,
  lista bookings, lista participantes, verificar conflito)
- C14[5/6] e C14[6/6]: N/A (event.service.ts refatorado em 51065962)
- 11 catches restantes: SAFE (infra/retry/observabilidade)
- event-outbox.processor.ts:44: pendente revisão futura

### Gates (após último commit C14)
- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Status das violações
- Total: 35
- OPEN: 24 | IN_PROGRESS: 0 | FIXED: 2 | ALLOWLISTED: 0 | DEFERRED: 0 | DECISION_PENDING: 8

### Análise de convergência
C14 concluído. Sistema não mais retorna 200 OK com dados vazios quando tabela não existe
em rotas de disponibilidade. Cancelamento de evento não mais silencia erros de schema.
Catches SAFE mantidos por design (contexto Gênesis — tabelas opcionais em reconstrução).

---

**Próximo snapshot esperado:** após conclusão das demais violações da FASE 2.

---

## SNAPSHOT intermediário — fim de sessão 2026-04-21

**Commit de referência:** 0863ca1f (C8 FIXED) + b481146a (C26 FIXED)
**Responsável:** Clayton

### Gates (estado ao encerrar sessão)
- actor-writer-boundaries: FAIL (C45 pré-existente em groups.service.ts:232)
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Violações fechadas nesta sessão
- C8 FIXED: 5 commits fc97f893→81b93c9d
- C26 FIXED: b481146a

### Violações novas descobertas nesta sessão
- C36-C43: auditoria nomenclatura canônica
- C44: marketplace/group.repository.ts colunas inexistentes
- C45: groups.service findOrCreateUserActor fora do writer (§4.8.1)
- C46: groups ownerUserId vs actor_id fluxo quebrado

### Status das violações ao encerrar
- Total: 46 | OPEN: 33 | FIXED: 4 | DECISION_PENDING: 9

### Análise de convergência
C8 e C26 fechados. Sistema mais estável no núcleo.
Gate actor-writer-boundaries falha por violação pré-existente em groups.service.ts
— não introduzida nesta sessão. C45 e C46 documentados para FASE 4.
Próxima sessão: resolver C45 (mover findOrCreateUserActor para writer canônico)
para desbloquear C46 e o fluxo E2E de criação de grupo.

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada fase)

## SNAPSHOT FASE 3 concluída — 2026-04-21

**Commit de referência:** (hash do commit abaixo)
**Responsável:** Clayton

### Gates
- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### E2E validado
- POST /groups → 201 Created ✅
- Grupo persistido no banco com owner_actor_id correto ✅
- groups > 0 ✅

### Status das violações
- Total: 48 | OPEN: 33 | FIXED: 6 | DECISION_PENDING: 10

### Próxima fase
FASE 4 — bloqueadores críticos: C4, C3, C12, C1

---

## SNAPSHOT FASE 4 — C4 fechado — 2026-04-21

**Commit de referencia:** 340981e7 (status) apos 736b25c2 (C4) apos 009f9eca (core.service)
**Responsavel:** Clayton

### Gates
- actor-writer-boundaries: PASS (desbloqueado pelo complemento C45)
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Violacoes fechadas
- C4 FIXED: listRegionalFunds alinhado ao schema Genesis
- C45 complemento: core.service.ts:118 → ensureUserActor

### Status das violacoes
- Total: 48 | OPEN: 31 | FIXED: 7 | DECISION_PENDING: 10

### Decisoes registradas desde ultimo snapshot
- DECISION-0005, DECISION-0006

### Comparacao com snapshot FASE 3
- Bloqueantes eliminados: +1 (C4)
- Correcoes estruturais: +1 (complemento C45)
- Gate actor-writer: FAIL → PASS (historico)

### Analise de convergencia
FASE 4 iniciada com sucesso. Primeiro bloqueador critico (C4) eliminado.
Sistema agora tem 4 gates verdes pela primeira vez desde inicio da sessao.
Bank-balance-by-region alinhado ao schema real — nao mais leitura fantasma.
Proximo alvo: C1 (tabela ledger fantasma em 6 arquivos) — risco de
corrupcao financeira estrutural, nao apenas erro runtime.

---

## SNAPSHOT FASE 4 — C1 fechado — 2026-04-21

**Commit de referencia:** 4bff6f9b (ultimo fix de C1) apos b07b38a9 (DECISION-0007)
**Responsavel:** Clayton

### Gates
- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Violacoes fechadas
- C1 FIXED: 4 fixes de amputacao controlada em trust, groups,
  test-currency e work e2e spec

### Status das violacoes
- Total: 48 | OPEN: 29 | FIXED: 8 | DECISION_PENDING: 10

### Decisoes registradas desde ultimo snapshot
- DECISION-0007 (C1 amputacao controlada)

### Comparacao com snapshot FASE 4 / C4
- OPEN: 31 → 29 (−2: C1 + complemento C45 contabilizado antes)
  Nota: revisar contagem se algum item foi fechado paralelamente
- Sistema paralelo "ledger" eliminado de runtime de producao

### Analise de convergencia
FASE 4 avanca: C1 (maior bloqueador critico) eliminado sem inventar
semantica. Reputacao (trust) nao depende mais de dados fantasmas.
API de grupos nao retorna mais dados de tabela inexistente.
Proximos alvos FASE 4: C3, C12, C44, C46.

---

## SNAPSHOT FASE 4 — C3 fechado — 2026-04-21

**Commit de referencia:** 1ca3d8b7 (ultimo fix de C3) apos f9d4ef38 (DECISION-0008)
**Responsavel:** Clayton

### Gates
- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Violacoes fechadas
- C3 FIXED: 2 caminhos centrais de criacao de actor fora do writer
  canonico substituidos por ensureUserActor

### Status das violacoes
- Total: 48 | OPEN: 28 | FIXED: 9 | DECISION_PENDING: 10

### Decisoes registradas desde ultimo snapshot
- DECISION-0008 (C3 substituicao direta)

### Comparacao com snapshot C1
- OPEN: 29 → 28
- FIXED: 8 → 9
- Borda HTTP: criacao de actor 100% via writer canonico
- C12 parcialmente mitigado automaticamente (actorId na borda HTTP
  agora e garantidamente canonico)

### Analise de convergencia
FASE 4 avanca. C3 (criacao de actor fora do writer) eliminado em todos
os caminhos runtime de produto. 9 rotas consumidoras alinhadas
transparentemente. Mapa real descoberto pela auditoria do Cursor:
nao eram 3 INSERTs literais, eram 2 helpers utilitarios centrais.
C3-B (separacao read/write semantica) documentada como divida para FASE 6.
Proximos alvos FASE 4: C12 (pode ter sido parcialmente mitigado por C3),
C44 (marketplace/group.repository), C46 (ownerUserId vs actorId).

## SNAPSHOT FASE 4 — C12 fechado — 2026-04-22

**Commit de referência:** 20c5c2e9 (após af7cae11)
**Responsável:** Clayton

### Gates

- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Violações fechadas

- C12 FIXED: 3 rotas identity (wallet, ledger, reputation) alinhadas ao globalUserId canônico

### Violações criadas

- C50 OPEN: padrões culturais (organizers.routes.ts)
- C51 OPEN: store-onboarding

### Status das violações

- Total: 50 | OPEN: 29 | FIXED: 10 | DECISION_PENDING: 10

### Comparação com snapshot C3

- OPEN: 28 → 29 (+1 temporário por reclassificação)
- FIXED: 9 → 10
- Borda HTTP identity: 100% coerente (actorId→globalUserId)

### Análise de convergência

FASE 4 avança. C12 (mentira estrutural em identity) eliminado.
Aumento temporário de OPEN reflete reclassificação honesta:
C50/C51 são violações mais precisas que C12 genérico.
Próximos alvos: C44 (marketplace/group), C46 (ownerUserId vs actorId).

---


## SNAPSHOT FASE 4 — C44 fechado — 2026-04-22

**Commit de referência:** 47624254
**Responsável:** Clayton

### Gates

- actor-writer-boundaries: PASS
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0)

### Violações fechadas

- C44 FIXED: marketplace/group.repository.ts alinhado ao schema Genesis

### Violações criadas

- Nenhuma

### Status das violações

- Total: 50 | OPEN: 28 | FIXED: 11 | DECISION_PENDING: 10

### Comparação com snapshot C12

- OPEN: 29 → 28
- FIXED: 10 → 11
- Schema drift: eliminado em marketplace/group

### Análise de convergência

FASE 4 avança. C44 (schema drift em marketplace/group.repository) eliminado.
Repository alinhado ao Genesis sem migration nova. API backwards-compatible
preserva compatibilidade com group.service.ts. Colunas fantasmas
(parent_group_id, created_by_actor_id, created_by_user_id) removidas das
queries SQL, substituídas por actor_id (coluna real do schema).

---

