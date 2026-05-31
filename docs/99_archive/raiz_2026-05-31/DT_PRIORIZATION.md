# DT_PRIORIZATION.md — Priorização institucional das 36 DTs ativas

**Data:** 2026-05-16
**Modo:** GUARDIÃO read-only (única edição: este arquivo + STATUS update)
**Plano governante:** `~/.claude/plans/veja-as-respostas-das-sunny-church.md` — frente sucessora pós-Frente 4
**Fonte:** `REMEDIATION_DT_LOG.md` (45 headers `## DT-*`; 7 CLOSED + 2 refinamentos = 9 excluídas; **36 DTs ativas**)

---

## Critério institucional dos 3 buckets

| Bucket | Definição material |
|---|---|
| **BLOQUEIA_PRODUTO** | Sem isso, primeiro usuário real quebra OU sistema entra em estado inconsistente/indefensável |
| **BLOQUEIA_FRENTE** | Impede frente específica abrir sem dor; não afeta operação atual |
| **INFORMATIVA** | Debt documentada, sem urgência operacional; consulta/lição preservada |

---

## DTs já fechadas (7) — fora da priorização, listadas para completeness

| DT | Status | Fechada por |
|---|---|---|
| DT-beta7-trigger-disable-precedent | CLOSED | ato consumado, lição registrada |
| DT-PAYMENT-CASING-DRIFT | CLOSED 2026-05-12 | DECISION-0032 |
| DT-WALLET-CONSUMERS-CENTS-MIGRATION | CLOSED 2026-05-12 | commit `11f028d9` |
| DT-TRANSPARENCY-API-CENTS-CONVERGENCE | CLOSED 2026-05-13 | convergência Frente 1 |
| DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO | CLOSED 2026-05-13 | F9 + HK7 |
| DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION | CLOSED 2026-05-13 | F10 + DECISION-0036 |
| DT-PUT-COMPANIES-TENANT-DIVERGENCE | CLOSED 2026-05-15 | fix cirúrgica |

---

## Bucket 1 — BLOQUEIA_PRODUTO (9 DTs)

| # | DT | Razão material (1 linha) | Risco se ignorada | Dependências |
|---|---|---|---|---|
| 1 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | 24 endpoints frontend chamam tabelas inexistentes → 500/comportamento indefinido | Primeiro usuário em qualquer feature mapeada na auditoria pode disparar erro | — (mãe de DT-MODULE-* específicas) |
| 2 | **DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE** | Risco de authority paralela (anti-padrão C27); replacement não decidido | Implementar policy_rules sem decisão = fragmentar authority chain irreversivelmente | Resolve C27 indiretamente |
| 3 | **DT-COVERAGE-BOOTSTRAP-REQUIRED** | Bootstrap econômico para coverage emergir de fluxo real | Sem coverage real, distribuição/regional fund operam em base inconsistente | DECISION-0031 |
| 4 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Duplicação de identidade em E2E afeta integridade transversal | Tenant isolation pode falhar em casos compostos; data leak entre tenants | — |
| 5 | **DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT** | `/core/profile` ignora actor ativo; retorna dado errado conforme actor | UX inconsistente + risco de exposição cross-actor | — |
| 6 | **DT-COMPANIES-METADATA-COLUMN-MISSING** | Coluna que código espera não existe no schema | INSERT/UPDATE de empresa quebra em runtime | Possivelmente DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS |
| 7 | **DT-COMPANY-CREATION-PATHS-DIVERGENCE** | Múltiplos caminhos de criar empresa com semântica divergente | Primeiro user real criando empresa pode acabar com state inconsistente | — |
| 8 | **DT-API-FEED-POST-ID-DRIFT** | Drift de IDs em feed pode quebrar paginação/leitura | Feed (módulo central) quebra em casos de borda | — |
| 9 | **DT-DASHBOARD-OWNER-PERMISSION-GAP** | Owner não acessa `/dashboard` (403 hoje) | UX bloqueada; principal entrypoint admin inacessível | Conecta com C27 / policy-engine indiretamente |

---

## Bucket 2 — BLOQUEIA_FRENTE (17 DTs)

| # | DT | Frente que destrava | Dependências |
|---|---|---|---|
| 10 | **DT-ACTOR-DELEGATIONS-ZERO-RUNTIME** | v2 modo operante (resolver dinâmico) | — |
| 11 | **DT-OPERATIONAL-BINDING-FRAGMENTATION** | P5 decision (qual modelo de vínculo absorve "freelancer multi-empresa") | DT-ACTOR-DELEGATIONS-ZERO-RUNTIME (parcial) |
| 12 | **DT-OPERATING-MODE-STATIC-PROJECTION** | v2 modo operante (substituir hardcoded por resolver) | DT-ACTOR-DELEGATIONS + DT-OPERATIONAL-BINDING + DT-PRESENCE-FRAGMENTATION |
| 13 | **DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL** | Convergência arquitetural temporal (4 tabelas projetam em availability) | DECISION-0037 (já ratificada) → frente arquitetural dedicada |
| 14 | **DT-PRESENCE-FRAGMENTATION-CONFIRMED** | P4 decision (qual modelo de presença absorve) + v2 modo operante | — (supersede DT-PRESENCE-FRAGMENTED-NO-RUNTIME) |
| 15 | **DT-PRESENCE-FRAGMENTED-NO-RUNTIME** | Predecessora de DT-PRESENCE-FRAGMENTATION-CONFIRMED | Superseded por #14 (manter como histórico) |
| 16 | **DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5** | Frente work-instant (Uber-like matching) | DT-PRESENCE-FRAGMENTATION + DT-OPERATIONAL-BINDING + DT-ACTOR-DELEGATIONS (todos 3) |
| 17 | **DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL** | Vertical restaurant | DT-MODULE-PDV destravado em paralelo (não listada — é ESQUELETO_DORMENTE) |
| 18 | **DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION** | Módulo presence usável | DT-PRESENCE-FRAGMENTATION-CONFIRMED resolvida |
| 19 | **DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK** | Frente automation (scheduler/alerts) | Auditoria de overlap com modules/alerts (dormente) + event_outbox |
| 20 | **DT-PROFESSION-DATA-SPARSE** | profession-as-hint em v2 modo operante | UX de captura de profissão (frente própria) |
| 21 | **DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS** | Frente membership/grupos | Pode conectar com DT-COMPANIES-METADATA-COLUMN-MISSING (#6) |
| 22 | **DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING** | Frente agenda do actor (Tarefa 2 pendente da sessão 33) | — |
| 23 | **DT-SERVICE-BOOKING-CONVERGENCE-MAP** | Frente service-booking convergível | DECISION-0037 (availability como SSOT) |
| 24 | **DT-q3-e2e-v2-service-booking-sem-reserve** | E2E v2 service-booking | DT-SERVICE-BOOKING-CONVERGENCE-MAP |
| 25 | **DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT** | Padrão de extração de erro frontend (consistência UX) | — |
| 26 | **DT-HEALTH-MODULE-FROZEN** | Frente health (4 caminhos: CORE-COMPLETE / DOMAIN-OWN / HYBRID / ACTOR-CENTRIC) | Decisão arquitetural prévia (vertical health emergir como prioridade) |
| — | **DT-BANK-SATELLITE-MODULES-DORMANT** | (16 sub-módulos) — frentes individuais conforme demanda | Vide bloco PASSO 3 Frente 4 |

---

## Bucket 3 — INFORMATIVA (10 DTs)

| # | DT | Razão para INFORMATIVA |
|---|---|---|
| 27 | **DT-PAYMENT-DOMAIN-COMPLEX** (+ refinamento Sunny) | Documentação cross-table; risco de bug semântico mas não bloqueia produto se documentado |
| 28 | **DT-AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL** | Limitação de métrica (audit cobre só financial_*); documentar para evitar conclusão errada |
| 29 | **DT-BANK-SATELLITE-MODULES-DORMANT** | 16 módulos dormentes ratificados; ressurreição exige 4 condições (PASSO 3 Frente 4) |
| 30 | **DT-bank-cachedBalanceCents-naming-heterogeneity** | Naming drift em campo cached; cosmético |
| 31 | **DT-bank-accounts-last-activity-ghost-column** | Coluna fantasma sem caller ativo |
| 32 | **DT-bank-balance-consolidation-region-fallback-tenant** | Convergência futura; não bloqueia hoje |
| 33 | **DT-event-reservations-mixed-case** | Drift cosmético de casing |
| 34 | **DT-C36-actor-debts-case-drift** (PARCIAL) | Código convergido; vocabulário canônico final pendente — não bloqueia |
| 35 | **DT-C36-deferred-tables** (DEFERRED) | Já marcada como deferida; sem urgência |
| 36 | **DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT** | Fóssil cirúrgico latente; explicitamente "NÃO bloqueia lifecycle de bookings" |

---

## Distribuição final

### Versão inicial (2026-05-16 manhã)

| Bucket | Qtd | % |
|---|---:|---:|
| BLOQUEIA_PRODUTO | 9 | 25% |
| BLOQUEIA_FRENTE | 17 | 47% |
| INFORMATIVA | 10 | 28% |
| **Total ativas** | **36** | 100% |
| CLOSED (fora da priorização) | 7 | — |

### Versão refinada após auditoria material (2026-05-16 tarde — PASSO 5)

Sprint cirúrgico de Ordenação B foi proposto e CANCELADO após auditoria. 5/5 DTs eram decisões arquiteturais disfarçadas. Veja `REMEDIATION_DT_LOG.md` "PASSO 5" para detalhes por DT.

| Bucket | Qtd | Δ |
|---|---:|---:|
| BLOQUEIA_PRODUTO | **5** | -4 (saíram: DT-COMPANIES-METADATA, DT-CORE-PROFILE, DT-API-FEED, DT-COMPANY-CREATION) |
| BLOQUEIA_FRENTE | **21** | +4 (entram as 4 reclassificadas) |
| INFORMATIVA | **10-11** | +0 ou +1 (DT-COMPANY-CREATION pode ir aqui) |
| **Total ativas** | **36** | inalterado |

**BLOQUEIA_PRODUTO refinado (5 DTs):**
1. DT-MODULES-ASPIRATIONAL-VS-RUNTIME (24 endpoints quebrados)
2. DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE (risco authority paralela)
3. DT-COVERAGE-BOOTSTRAP-REQUIRED (ledger consistente)
4. DT-GLOBAL-USER-ID-DUPLICATION-E2E (duplicação identidade)
5. DT-COMPANIES-METADATA-COLUMN-MISSING (esta entrada original; foi MOVIDA para BLOQUEIA_FRENTE com renomeação para DT-ONBOARDING-METADATA-STORAGE-DECISION)

Após renomeação + reclassificação: **BLOQUEIA_PRODUTO real = 4 DTs:**
1. DT-MODULES-ASPIRATIONAL-VS-RUNTIME
2. DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE
3. DT-COVERAGE-BOOTSTRAP-REQUIRED
4. DT-GLOBAL-USER-ID-DUPLICATION-E2E

---

## TOP 5 BLOQUEIA_PRODUTO — foco operacional imediato

> Apresentadas em DUAS ordenações (gravidade vs prontidão cirúrgica). Decisão de ordem de execução fica com Clayton.

### Ordenação A — por gravidade arquitetural (impacto sistêmico)

| Ordem | DT | Por que crítica |
|---|---|---|
| 1 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | 24 endpoints em produção retornam 500. Frente própria de auditoria caso-a-caso (top 5 já têm sub-DTs); 19 restantes precisam decisão humana. Bloqueia primeiro usuário real em qualquer feature mapeada. |
| 2 | **DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE** | Risco de criar authority paralela. Implementar policy_rules sem decidir relação com authorization.service = fragmentar authority chain irreversivelmente. Anti-padrão C27 cristalizado. |
| 3 | **DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT** | Bug de tenant isolation. `/core/profile` retorna dado errado conforme actor. Risco de exposição cross-actor; afeta confiança institucional. |
| 4 | **DT-COVERAGE-BOOTSTRAP-REQUIRED** | Ledger consistente exige bootstrap econômico real. Sem isso, distribuição/regional fund operam em base inconsistente; valores podem divergir de auditoria. |
| 5 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Duplicação de identidade em fluxos compostos afeta integridade transversal. Casos de borda podem leak data entre tenants. |

### Ordenação B — por prontidão cirúrgica (fix rápido com alto impacto UX)

| Ordem | DT | Por que cirúrgica |
|---|---|---|
| 1 | **DT-COMPANIES-METADATA-COLUMN-MISSING** | Coluna faltando que código espera. Fix: ALTER TABLE ADD COLUMN + migration. Provável ≤ 30 min. Desbloqueia INSERT/UPDATE de empresa. |
| 2 | **DT-DASHBOARD-OWNER-PERMISSION-GAP** | Owner sem `dashboard:view`. Fix: mapear permission em `permissionsFromCompanyUserRole`. Provável ≤ 1h. Desbloqueia entrypoint admin. |
| 3 | **DT-API-FEED-POST-ID-DRIFT** | Drift de IDs em feed. Fix: tipo/converter cirúrgico onde drift existe. Possivelmente ≤ 2h. |
| 4 | **DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT** | Adicionar leitura de actorId em handler de `/core/profile`. Possivelmente ≤ 2h. |
| 5 | **DT-COMPANY-CREATION-PATHS-DIVERGENCE** | Consolidar paths via service único. Possivelmente 2-4h. |

**Recomendação:** ordem **B** (prontidão) para sprint cirúrgico de 1-2 dias destrava 5 frentes de UX rapidamente; ordem **A** (gravidade) é frente arquitetural de semanas. Não é either/or — são frentes distintas.

---

## Mapa de dependências entre DTs

```
DT-PRESENCE-FRAGMENTATION-CONFIRMED ──┐
                                       ├─→ DT-MODULE-PRESENCE-FROZEN
                                       ├─→ DT-MODULE-WORK-INSTANT-FROZEN (+ outras 2)
                                       └─→ DT-OPERATING-MODE-STATIC-PROJECTION (+ outras 2)

DT-OPERATIONAL-BINDING-FRAGMENTATION ──┐
                                        ├─→ DT-MODULE-WORK-INSTANT-FROZEN (+ outras 2)
                                        └─→ DT-OPERATING-MODE-STATIC-PROJECTION (+ outras 2)

DT-ACTOR-DELEGATIONS-ZERO-RUNTIME ─────┐
                                        ├─→ DT-OPERATIONAL-BINDING-FRAGMENTATION (parcial)
                                        ├─→ DT-MODULE-WORK-INSTANT-FROZEN (+ outras 2)
                                        └─→ DT-OPERATING-MODE-STATIC-PROJECTION (+ outras 2)

DECISION-0037 (já ratificada) ─────────┐
                                        ├─→ DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL
                                        └─→ DT-SERVICE-BOOKING-CONVERGENCE-MAP

DT-SERVICE-BOOKING-CONVERGENCE-MAP ────┐
                                        └─→ DT-q3-e2e-v2-service-booking-sem-reserve

DT-COMPANIES-METADATA-COLUMN-MISSING ──┐
                                        └─→ Possível: DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS
```

**Insight:** as 3 fragmentações estruturais (P4 presença + P5 vínculo + actor_delegations runtime) formam **nó crítico bloqueador** de 4-5 DTs simultaneamente. Resolver as 3 destrava cascata.

---

## Recomendações institucionais

**1. Sprint cirúrgico (1-2 dias) — Ordenação B (5 DTs prontidão alta):**
Fix cirúrgico de DTs 1-5 da ordenação B destrava entrypoints UX (criar empresa, dashboard, feed, profile, company creation). Custo baixo, impacto operacional alto, baixo risco.

**2. Frente arquitetural (semanas) — Ordenação A (top 3 prioritárias):**
- **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** vira frente própria caso-a-caso (19 FANTASMAs restantes além dos top 5 já ratificados)
- **DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE** vira DECISION arquitetural humana (replacement/overlay/obsoleto)
- **DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT** vira fix + audit de outros endpoints que possam ter o mesmo bug

**3. Nó crítico v2 modo operante:**
3 DTs estruturais (DT-ACTOR-DELEGATIONS + DT-OPERATIONAL-BINDING + DT-PRESENCE-FRAGMENTATION) precisam ser resolvidas antes de v2 emergir. Cada uma é frente própria. Total: 3 frentes arquiteturais + as 3 já ratificadas como CONGELAMENTO (work-instant, presence, venue) que dependem delas.

**4. INFORMATIVAs (10 DTs):**
Não consomem ciclo operacional. Servem de consulta/lição. Revisar apenas se runtime exercitar conflito (ex: payment-domain-complex pode subir prioridade se integrador novo causar bug semântico).

**5. Higiene institucional:**
7 DTs CLOSED registradas para completeness — útil verificar periodicamente se alguma OPEN pode virar CLOSED por mudança de runtime sem que tenha sido formalizada.

---

## Próximos passos (NÃO autorizados — apenas registrados)

| Opção | Custo | Desbloqueio |
|---|---|---|
| **A** Sprint cirúrgico Ordenação B (5 DTs prontidão) | 1-2 dias | 5 entrypoints UX destravados |
| **B** Frente arquitetural — DT-MODULES-ASPIRATIONAL caso-a-caso (19 FANTASMAs restantes) | 1-2 sessões | Inventário de decisões individuais (criar/remover/congelar por módulo) |
| **C** Frente DECISION humana sobre policy-engine | Sessão própria | Resolve risco de authority paralela |
| **D** Nó crítico v2 modo operante (3 DTs estruturais simultâneas) | Frentes arquiteturais separadas (semanas-meses) | Destrava v2 modo operante dinâmico |
| **E** Frente health (4 caminhos sob DT-HEALTH-MODULE-FROZEN) | Decisão arquitetural prévia + sessão de implementação | Destrava aba Saúde do perfil |

Modo: **AGUARDANDO_AUTORIZACAO** sobre próxima frente real.

---

## Princípio metodológico permanente (Clayton, 2026-05-16)

> **"Classificação cirúrgica por inferência de nome é anti-padrão. Auditoria material antes de execução é obrigatória."**

Aplicação institucional: toda DT marcada como "cirúrgica ≤Xh" deve passar por **auditoria material READ-ONLY** (leitura da DT própria + verificação de substrato no banco/código) ANTES de entrar em sprint de execução. Sem isso, "fix simples" cristaliza decisão arquitetural por inércia.

**Sessão 2026-05-16 confirmou:** 5/5 da Ordenação B foram refutadas. Padrão cognitivo identificado em minha própria classificação. Próximo sprint cirúrgico tem que aplicar auditoria material para cada DT candidata ANTES de qualquer fix.


---

## ATUALIZAÇÃO PASSO 4 OPÇÃO C — pós DECISION-0041 (2026-05-16)

**Vínculo:** DECISION-0041 (REMEDIATION_DECISIONS_LOG.md) + commit `a8bf37af` (esconder rotas frontend em App.tsx)

### Mudanças nesta atualização

**1. Removida de BLOQUEIA_PRODUTO:** `DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE`
- **Razão:** auditoria material READ-ONLY refutou hipótese de "authority paralela / anti-padrão C27"
- **Status final:** AUDIT_RESOLVIDA + PREMATURO (REMEDIATION_DT_LOG.md PASSO 2 OPÇÃO C, linha ~2063)
- **Resolução:** DECISION-0041 + commit `a8bf37af` (entry points escondidos em App.tsx; componentes preservados)

**2. Adicionada em BLOQUEIA_FRENTE:** `DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK`
- **Tag semântica:** PREMATURO (chave de leitura nova — vide princípio abaixo)
- **Vínculo:** DECISION-0041 + commit `a8bf37af`
- **Frente que destrava:** risk-management automation (quando primeira pressão real emergir)
- **Critério de destrave — 2 condições simultâneas:**
  - (a) Primeira necessidade real de risk-management (fraude/dispute/abuso/ordem regulatória)
  - (b) Ecossistema risk+trust+evidence em runtime real (não apenas estrutura)
- **Prioridade:** MEDIUM

### Distribuição refinada após PASSO 4 OPÇÃO C

| Bucket | Versão anterior (refinada PASSO 5) | Após PASSO 4 OPÇÃO C | Δ |
|---|---:|---:|---:|
| BLOQUEIA_PRODUTO | 4 | **3** | -1 (policy-engine resolvida) |
| BLOQUEIA_FRENTE | 21 | **22** | +1 (PREMATURO sucessora) |
| INFORMATIVA | 10-11 | **10-11** | inalterado |
| **Total ativas** | 36 | **36** | inalterado |
| CLOSED (fora) | 7 | 7 | inalterado |

### TOP BLOQUEIA_PRODUTO atualizado (Ordenação A — gravidade arquitetural)

Era 5 com policy-engine no #2. Agora **3 DTs** (policy-engine resolvida; NÃO substituída por outra — refinamento honesto):

| Ordem | DT | Razão crítica |
|---|---|---|
| 1 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | 24 endpoints frontend chamam tabelas inexistentes. Bloqueia primeiro usuário real em qualquer feature mapeada. |
| 2 | **DT-COVERAGE-BOOTSTRAP-REQUIRED** | Ledger consistente exige bootstrap econômico real. Distribuição/regional fund operam em base inconsistente sem ele. |
| 3 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Duplicação de identidade em fluxos compostos afeta integridade transversal. Risco de leak data entre tenants em casos de borda. |

**Nota material:** ordenação A foi reduzida de 5 → 3 não porque o sistema melhorou, mas porque 2 DTs (policy-engine + core-profile) foram refutadas por auditoria material (não eram BLOQUEIA_PRODUTO de fato). Falsa redução de gravidade — calibração honesta.

Ordenação B (prontidão cirúrgica) **cancelada na íntegra** por PASSO 5 (5/5 refutadas como decisões arquiteturais disfarçadas). Não há substituto até nova auditoria material das outras DTs revelar fixes realmente cirúrgicos.

---

## Princípio metodológico permanente — ATUALIZADO (DECISION-0041)

> **"Módulo PREMATURO ≠ módulo ESTRUTURALMENTE ERRADO."**
> **"Maturidade temporal ≠ incoerência estrutural."**
> **"Congelar módulos prematuros preserva convergência futura sem cristalizar runtime inadequado."**
> — ChatGPT via Clayton (DECISION-0041), 2026-05-16

### 3 categorias semânticas para aplicar em Higiene futura

Quando auditar DTs restantes, separar entre:

| Categoria | Diagnóstico material | Ação institucional |
|---|---|---|
| **ESTRUTURALMENTE_ERRADO** | Módulo conceitualmente incorreto (anti-padrão arquitetural; duplicação consciente de domínio canônico; design incompatível com tese atual) | **Corrigir OU arquivar conscientemente** (não apagar sem auditoria — princípio `feedback_archive_nao_e_ssot.md`) |
| **PREMATURO** | Módulo estruturalmente correto, runtime adequado ainda não emergiu (ecossistema dependente não vivo; pressão real ausente) | **Congelar** (esconder entry points + preservar código + DT específica com critério de descongelamento simultâneo) |
| **INFORMATIVA** | Documenta debt sem urgência operacional; lição preservada para consulta futura | **Documentar** (sem ação imediata; revisar apenas se runtime exercitar conflito) |

**Aplicação canônica:** policy-engine é caso paradigmático de PREMATURO (DECISION-0041). Authority chain é estruturalmente soberana; policy-engine é módulo conceitualmente correto de risk-management; runtime adequado ainda não emergiu porque ecossistema risk+trust+evidence está parcial. Congelar (não corrigir, não arquivar) preserva convergência futura.

**Diferenciação crítica para Higiene:**
- Refutar "ESTRUTURALMENTE_ERRADO" por auditoria material (caso policy-engine: 6 evidências refutaram "authority paralela")
- Refutar "INFORMATIVA" por pressão emergente (DT que parecia cosmética pode subir prioridade)
- Confirmar "PREMATURO" quando: módulo correto + dependências vivas mas insuficientes + sem pressão de uso real

### Atualização da combinação ordenação A + B

| Aspecto | Estado anterior | Estado agora |
|---|---|---|
| BLOQUEIA_PRODUTO total | 4 | 3 |
| Ordenação A (gravidade) | 5 entradas | 3 entradas |
| Ordenação B (prontidão cirúrgica) | 5 entradas (canceladas pelo PASSO 5) | N/A (aguarda nova auditoria revelar fixes realmente cirúrgicos) |
| Sprint cirúrgico A' | Suspenso por PASSO 5 | Continua suspenso |
| **Próximas frentes prioritárias** | Frente Higiene das DTs restantes (21 BLOQUEIA_FRENTE + 10-11 INFORMATIVA) — aplicar critério das 3 categorias | |
| Critério adicional | "Auditoria material antes de classificação" | + "PREMATURO ≠ ESTRUTURALMENTE_ERRADO" |


---

# ================================================================
# HIGIENE v2 — Classificação semântica das 32 DTs ativas (2026-05-16)
# ================================================================

**Método aplicado:** auditoria material READ-ONLY + critério "PREMATURO ≠ ESTRUTURALMENTE_ERRADO" (DECISION-0041) + leitura DT completa antes de classificar.

**Padrão observado:** 7º achado de DT mal classificada (esta sessão: PASSO 5 5/5 + OPÇÃO C 1/1 + agora HIGIENE 1+ adicional). Princípio "auditoria material antes de classificação por inferência de nome" continua validado.

---

## Achado material crítico — DT classificada como ATIVA mas está CLOSED

**DT-COVERAGE-BOOTSTRAP-REQUIRED**: linha 295 do REMEDIATION_DT_LOG.md declara explicitamente `Status: CLOSED (encerrada por DECISION-0031)`. Esta DT foi listada como BLOQUEIA_PRODUTO no DT_PRIORIZATION.md original (item #3) e mantida no PASSO 4 OPÇÃO C. **Erro material da tabulação anterior.**

**Correção:** mover de BLOQUEIA_PRODUTO ATIVA → CLOSED. Distribuição:
- CLOSED: 7 → **8**
- BLOQUEIA_PRODUTO: 3 → **2**
- Total ativas: 32 → **31**

**Auto-crítica metodológica:** este é o 7º caso de classificação superficial nesta sessão. Padrão consistente. Princípio operacional permanente reforçado.

---

## Tabela material da Higiene — 31 DTs ativas classificadas

### Bucket 1 — BLOQUEIA_PRODUTO (2 DTs)

| # | DT | Categoria semântica | Evidência material |
|---|---|---|---|
| 1 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | **PREMATURO** (24 sub-decisões pendentes, não erro estrutural) | DECISION-0040 ratifica caso a caso; FANTASMAs são código aspiracional sem fundo, não anti-padrão arquitetural; cada um aguarda decisão própria (criar/remover/congelar) |
| 2 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | **ESTRUTURALMENTE_ERRADO** | Duplicação de identidade afeta integridade transversal em fluxos compostos; risco real de leak data entre tenants em casos de borda; convergência exige fix material em E2E identity |

### Bucket 2 — BLOQUEIA_FRENTE (22 DTs)

#### Sub-grupo PREMATURO (16 DTs — maioria) — módulos/decisões conceitualmente corretos aguardando ecossistema/decisão

| # | DT | Frente que destrava | Por que PREMATURO |
|---|---|---|---|
| 3 | DT-ACTOR-DELEGATIONS-ZERO-RUNTIME | v2 modo operante | Schema canônico desenhado, zero runtime — aguarda primeira delegação real |
| 4 | DT-OPERATIONAL-BINDING-FRAGMENTATION | P5 decision | 6 modelos paralelos, mas todos conceitualmente válidos em domínios próximos; aguarda decisão de qual absorve |
| 5 | DT-OPERATING-MODE-STATIC-PROJECTION | v2 dinâmico | v1 hardcoded é tradeoff consciente (DECISION-0039); aguarda 3 frentes prévias |
| 6 | DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL | Convergência temporal | DECISION-0037 ratifica SSOT; aguarda frente arquitetural dedicada (projeções) |
| 7 | DT-PRESENCE-FRAGMENTATION-CONFIRMED | P4 decision + v2 modo operante | 9 modelos paralelos esperando critério institucional; sem pressão real ainda |
| 8 | DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5 | Uber-like matching | Caso paradigmático — código completo, ecossistema P4+P5 ausente |
| 9 | DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL | Vertical restaurant | Schema desenhado, vertical não emergiu |
| 10 | DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION | Módulo presence | Schema próprio é 9º paralelo em P4; aguarda decisão |
| 11 | DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK | Risk-management automation | DECISION-0041 (caso canônico de PREMATURO) |
| 12 | DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING | Agenda do actor (Tarefa 2 sessão 33) | Decisão arquitetural em CORE Nível 1 AGENDA_UNIVERSAL pendente |
| 13 | DT-SERVICE-BOOKING-CONVERGENCE-MAP | Service-booking convergível | 2 caminhos paralelos, hipótese C recomendada; aguarda uso humano real |
| 14 | DT-HEALTH-MODULE-FROZEN | Frente health | 4 caminhos (CORE-COMPLETE/DOMAIN-OWN/HYBRID/ACTOR-CENTRIC); aguarda decisão arquitetural |
| 15 | DT-ONBOARDING-METADATA-STORAGE-DECISION | Frente onboarding metadata | 4 opções (ALTER TABLE / dedicada / company_types / actors.metadata); aguarda pressão |
| 16 | DT-DASHBOARD-OWNER-PERMISSION-GAP | Mapping companies-permissions ↔ canonical | Aguarda decisão C27 (3+ sistemas authz) |
| 17 | DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT | Projeção contextual | Aguarda decisão de bifurcar getProfile vs endpoint dedicado |
| 18 | DT-PROFESSION-DATA-SPARSE | profession-as-hint em v2 | Aguarda UX de captura no onboarding |

#### Sub-grupo ESTRUTURALMENTE_ERRADO (2 DTs) — convergência de código existente

| # | DT | Por que ESTRUTURALMENTE_ERRADO | Custo de fix |
|---|---|---|---|
| 19 | **DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT** | 22+ callers usam padrão antigo `errorData.error || ...` que produz "[object Object]" na UI quando backend retorna shape Fastify default; fix canônico já existe em `client.ts` | Sprint cirúrgico real (~30-60min) — extrair helper `extractErrorMessage` + substituir nos 22 callers (groups 17 + education 3 + core 1 + identity 1) |
| 20 | **DT-API-FEED-POST-ID-DRIFT** | `FeedService.ts` usa 5-6 colunas pré-Gênesis (`post_id`, `global_user_id`, `type`, `media`, `visibility`, `event_id`) que não existem mais em `posts` (renomeadas pós-Gênesis) | Fix exige decisão de runtime soberano prévia (FeedService vs feed-plugin); mas natureza é ESTRUTURALMENTE_ERRADO (código quebrado, não esperando ecossistema) |

#### Sub-grupo AUDITORIA pré-classificação (3 DTs) — material insuficiente para categoria final

| # | DT | Por que AUDITORIA | Pergunta material pendente |
|---|---|---|---|
| 21 | **DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS** | 3 camadas paralelas (company_users vivo / company_members migration arquivada / organization_* sem migration). Drift cosmético ou frente real depende de SQL `SELECT to_regclass('company_members')`. | Tabelas existem ou não? Resposta SQL muda classificação entre ESTRUTURALMENTE_ERRADO (drift documental) e PREMATURO (frente arquitetural) |
| 22 | **DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK** | Auditoria de overlap triplo (alerts × scheduler × workers) pendente | É duplicação consciente (ESTRUTURALMENTE_ERRADO) ou domínio próprio (PREMATURO)? Requer leitura material de `modules/automation` + `modules/alerts` + `event_outbox` |
| — | DT-PRESENCE-FRAGMENTED-NO-RUNTIME | Superseded pela DT-PRESENCE-FRAGMENTATION-CONFIRMED | Manter como histórico INFORMATIVA |

#### Sub-grupo SUPERSEDED (1 DT)

| # | DT | Sucessora | Ação |
|---|---|---|---|
| 23 | DT-PRESENCE-FRAGMENTED-NO-RUNTIME | DT-PRESENCE-FRAGMENTATION-CONFIRMED (mesma sessão Frente 2) | Marcar como **superseded** + manter referência histórica |

#### Sub-grupo dependente (1 DT)

| # | DT | Dependência | Categoria |
|---|---|---|---|
| 24 | DT-q3-e2e-v2-service-booking-sem-reserve | DT-SERVICE-BOOKING-CONVERGENCE-MAP (#13) | PREMATURO ou DESIGN_CONSCIENTE — DT própria sugere "pode ser design consciente". AUDITORIA pré-classificação do split engine para confirmar; sem urgência (Q3-E2E v2 vai via event_ticket) |

### Bucket 3 — INFORMATIVA (7 DTs após reclassificações)

#### Sub-grupo INFORMATIVA pura (5 DTs)

| # | DT | Categoria semântica | Razão |
|---|---|---|---|
| 25 | **DT-PAYMENT-DOMAIN-COMPLEX** | INFORMATIVA (documentação cross-table) | Promoted para MEDIUM padrão; risco de bug semântico mas mitigado por critério institucional |
| 26 | **DT-AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL** | INFORMATIVA (limitação de métrica) | Documentar para evitar conclusão errada sobre cobertura de audit |
| 27 | DT-bank-cachedBalanceCents-naming-heterogeneity | INFORMATIVA (ambiguidade semântica cosmética) | Não bloqueante para β.1..β.5; convergência em frente futura |
| 28 | DT-bank-accounts-last-activity-ghost-column | INFORMATIVA (coluna fantasma sem caller que atualize) | Cosmético; valor enganoso mas semantica documentada |
| 29 | DT-bank-balance-consolidation-region-fallback-tenant | **PREMATURO** (multi-região por tenant não emergiu) | Fallback explícito para tenantId preserva comportamento legacy; aguarda feature de multi-região |
| 30 | DT-C36-deferred-tables (DEFERRED) | INFORMATIVA (deferida conscientemente) | 3 tabelas (company_validations, unifycard_transactions, categories) sem CHECK; investigar em sessão dedicada |

#### Sub-grupo ESTRUTURALMENTE_ERRADO (latente, baixa prioridade) (3 DTs)

| # | DT | Por que ESTRUTURALMENTE_ERRADO | Por que INFORMATIVA bucket |
|---|---|---|---|
| 31 | DT-event-reservations-mixed-case | CHECK aceita 2 cases para mesmos conceitos — anti-padrão real | Não bloqueia runtime; DECISION-0028 documenta como exceção; convergir em cleanup futuro |
| 32 | DT-C36-actor-debts-case-drift (PARCIAL) | Dead branches já eliminados em sub-frente; CHECK misto pendente | Sem bug runtime ativo após sub-frente; baixa prioridade |
| 33 | DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT | `.toISOString()` em `undefined` quebra em caso edge específico | DT explicitamente "NÃO bloqueia lifecycle de bookings"; effect perdido em observabilidade, não em integridade |

### Bucket especial — DT-BANK-SATELLITE-MODULES-DORMANT (16 sub-módulos)

Bloco já ratificado em PASSO 3 da Frente 4 com distribuição material:
- CONGELAR_REVERSIVEL (11) → **PREMATURO**
- AUDITORIA pré-recomendação (2: governance, risk) → **AUDITORIA**
- CONGELAR_PERMANENTE (1: sla) → **PREMATURO** (cenário SLA contratual distante)
- ARQUIVAR_FORMAL (1: core/intent) → **ESTRUTURALMENTE_ERRADO** (provável substituição por idempotency_keys; arquivar consciente)
- PROVISÓRIO (1: treasury) → **PREMATURO** (reconfirmar com treasury-split)

---

## Distribuição refinada pós-Higiene (31 DTs ativas)

| Bucket | Qtd | % | Categoria semântica dominante |
|---|---:|---:|---|
| BLOQUEIA_PRODUTO | 2 | 6% | 1 PREMATURO (DT-MODULES-ASPIRATIONAL com 24 sub-decisões) + 1 ESTRUTURALMENTE_ERRADO (DT-GLOBAL-USER-ID) |
| BLOQUEIA_FRENTE | 22 | 71% | Maioria PREMATURO (16) + 2 ESTRUTURALMENTE_ERRADO + 3 AUDITORIA + 1 dependente |
| INFORMATIVA | 7 | 23% | 5 informativa pura + 3 ESTRUTURALMENTE_ERRADO latentes (baixa prioridade) |
| CLOSED (fora) | 8 | — | +1 descoberta na Higiene (DT-COVERAGE-BOOTSTRAP-REQUIRED) |
| **Total ativas** | **31** | 100% | — |

### Distribuição por categoria semântica (DECISION-0041)

| Categoria | Qtd | Ação institucional |
|---|---:|---|
| **PREMATURO** | 19 (+ 11-13 do bloco bank satellites) | Congelar + preservar código + critério de descongelamento |
| **ESTRUTURALMENTE_ERRADO** | 6 (2 BLOQ_PROD/FRENTE + 3 INFORMATIVA latente + 1 do bank satellites: intent) | Corrigir OU arquivar; subgrupo cirúrgico real existe (DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT) |
| **INFORMATIVA** pura | 5 (+ 2 INFORMATIVA com tag ESTRUTURALMENTE_ERRADO latente) | Documentar; sem ação imediata |
| **AUDITORIA** pré-classificação | 4 (3 individuais + 2 do bank satellites: governance, risk) | Auditoria material READ-ONLY antes de classificar |
| **SUPERSEDED** | 1 (DT-PRESENCE-FRAGMENTED-NO-RUNTIME) | Manter como histórico |
| **DEPENDENTE** | 1 (DT-q3-e2e-v2-service-booking-sem-reserve) | Classificar junto com #13 |

---

## Achados material da Higiene

### Achado 1 — DT-COVERAGE-BOOTSTRAP-REQUIRED estava CLOSED

Já documentado acima. Erro de tabulação anterior corrigido. CLOSED: 7→8. BLOQUEIA_PRODUTO: 3→2.

### Achado 2 — DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT é fix cirúrgico REAL

Esta é a primeira DT desta sessão que resiste materialmente à classificação "fix cirúrgico":
- Fix canônico **já existe** em `client.ts` (commit `3ed43d50` aplicou)
- 22 callers seguem padrão antigo — frente de convergência, não decisão arquitetural
- Custo estimado ~30-60min: extrair helper + substituir 22 ocorrências
- Sem PARO E CONSULTO necessário (não toca authority/ledger/schema)

**Esta é a candidata REAL para sprint cirúrgico A' (suspenso pelo PASSO 5).** Recomendação institucional: A' ressurge com esta DT como caso único; outras Ordenação B continuam refutadas.

### Achado 3 — Refutação de "drift cosmético" como narrativa universal

Auditoria material de DT-event-reservations-mixed-case + DT-C36-actor-debts-case-drift confirma que são ESTRUTURALMENTE_ERRADO (anti-padrão real registrado em DECISION-0028 como exceção, não solução). Mas o bucket INFORMATIVA é honesto porque:
- Funcionam em runtime (não bloqueiam)
- Já documentadas como exceções formais
- Convergência exige escopo de remediação maior que custo do drift atual

Padrão institucional: **ESTRUTURALMENTE_ERRADO ≠ urgência operacional automática.** Categoria semântica + bucket são dimensões ortogonais.

### Achado 4 — DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS exige SQL antes de classificar

A DT própria registra metodologia explícita:
```sql
SELECT to_regclass('company_members') AS company_members_exists;
SELECT to_regclass('organization_members') AS organization_members_exists;
SELECT to_regclass('organization_invites') AS organization_invites_exists;
```

Resposta muda classificação fundamental:
- Tabelas existem (drift cosmético) → ESTRUTURALMENTE_ERRADO baixo custo
- Tabelas não existem (frente real) → PREMATURO até DECISION arquitetural

**Tag AUDITORIA** mantida até query rodar.

### Achado 5 — 3 DTs com tag AUDITORIA pré-classificação

Não são reclassificações — são **falta de material** para decidir. Frente própria de "Higiene de auditoria material" pode resolver as 3 em uma sessão dedicada (DT-MEMBERSHIP + DT-MODULE-AUTOMATION + DT-q3-e2e-v2-service-booking-sem-reserve + DT-BANK-SATELLITE governance/risk).

---

## Padrão consolidado nesta sessão (2026-05-16)

| # | Caso | Resultado |
|---|---|---|
| 1-5 | Ordenação B (5 DTs) — PASSO 5 | 5/5 refutadas; reclassificadas para BLOQUEIA_FRENTE |
| 6 | DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE — OPÇÃO C | 1/1 refutada; resolvida via DECISION-0041 (PREMATURO) |
| 7 | DT-COVERAGE-BOOTSTRAP-REQUIRED — Higiene | Já estava CLOSED; erro de tabulação anterior |

**7 casos de classificação superficial nesta sessão.** Princípio "auditoria material antes de classificação por inferência de nome" reforçado em escala. Vide DECISION-0040 + chave de leitura permanente em DT_PRIORIZATION.md.

---

## Próximas frentes possíveis (NÃO autorizadas — apenas registradas)

| Opção | Custo | Escopo |
|---|---|---|
| **A''** (sprint cirúrgico REAL) — converger 22 callers de DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT | ~30-60min | Extrair helper + substituir callers; único candidato sobrevivente à Higiene |
| **Auditoria material das 4 AUDITORIA pendentes** (DT-MEMBERSHIP + DT-AUTOMATION + DT-q3-e2e-v2-service-booking-sem-reserve + bank satellites governance/risk) | 1 sessão | Resolve classificação semântica final |
| **D — Nó crítico v2 modo operante** (3 DTs estruturais: actor-delegations + P5 + P4) | Semanas-meses | Frente arquitetural maior; aguarda contexto adicional |
| **Frente de DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Frente arquitetural própria | Único ESTRUTURALMENTE_ERRADO em BLOQUEIA_PRODUTO; risco de integridade transversal |
| **Frente health** (4 caminhos sob DT-HEALTH-MODULE-FROZEN) | Decisão + implementação | Destrava aba Saúde |

**Recomendação institucional Sunny-style:** A'' (fix DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT) como gesto rápido + auditoria das 4 AUDITORIA pendentes como segunda frente, antes de abrir D (frente arquitetural grande).

---

## Princípio metodológico permanente — ATUALIZADO pós-Higiene

> **"ESTRUTURALMENTE_ERRADO ≠ urgência operacional automática. Categoria semântica e bucket de priorização são dimensões ortogonais."**

ESTRUTURALMENTE_ERRADO pode ser:
- BLOQUEIA_PRODUTO (DT-GLOBAL-USER-ID-DUPLICATION-E2E)
- BLOQUEIA_FRENTE (DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT — candidato sprint cirúrgico real)
- INFORMATIVA (DT-event-reservations-mixed-case — anti-padrão documentado, funciona)

PREMATURO majoritariamente vai para BLOQUEIA_FRENTE, mas pode estar em INFORMATIVA (DT-bank-balance-consolidation-region-fallback-tenant).

A matriz 2D (categoria × bucket) é mais fiel à realidade do que a classificação linear anterior.


---

# ================================================================
# PRINCÍPIOS INSTITUCIONAIS PERMANENTES — CONSOLIDAÇÃO FINAL (2026-05-16)
# ================================================================

**Origem:** consolidação dos achados da sessão 2026-05-16 (Frentes 2+4+Priorização+Opção C+Higiene+A'' auditoria) + síntese ChatGPT + ratificação Clayton.

---

## Princípio 5 — O sistema estruturalmente cabe a visão

**Autores:** Clayton + ChatGPT, 2026-05-16
**Localização institucional:** chave de leitura permanente para todas as frentes futuras de remediação, expansão e priorização.

> **"O sistema estruturalmente cabe a visão.**
>
> **Actor único + ledger único + authority chain + delegação + projeção contextual já existem como substrato.**
>
> **Trabalho institucional agora é: organizar melhor + revelar corretamente + remover fragmentações + amadurecer módulos prematuros. Não reconstruir."**

### Evidências materiais que sustentam o princípio

| Camada | Estado material confirmado nesta sessão |
|---|---|
| **Actor único** | `actors` (77 rows, 4 actor_types); única referência canônica de identidade |
| **Ledger único** | `bank_*` (ledger/transactions/accounts/splits) — runtime exercitado; `authority_decision_audit` 34 hits financeiros confirmam authority+ledger integrados |
| **Authority chain** | `authorization.service.ts` canônico; `canActAs` ordem ownership→delegation→legacy; shadow service em transição visível |
| **Delegação** | `actor_delegations` schema sólido desenhado (scopes_json + is_transitive + expires_at + revoked_at); aguarda runtime real |
| **Projeção contextual** | `useActorMode` + `actorContextConfig` (v1 hardcoded) + cross-mode hint; backbone real de 13 módulos canônicos com 102+ rows cada |
| **Convergência silenciosa** | `unified-availability` SSOT temporal real (44 rows ativas); descoberta material da Frente 2 |

**Refutação consolidada:** narrativa anterior "15-20 módulos funcionais de 80" estava errada por 4×. Realidade material: **71 FUNCIONAIS de 157** (45%). Sistema NÃO é majoritariamente fachada — é base estruturalmente coerente com a visão.

### Implicação operacional

**Não é mais sobre construir fundação.** É sobre:

1. **Organizar melhor** — inventário formal (DECISION-0038) substitui percepção informal; classificação semântica (DECISION-0041) substitui classificação por inferência de nome
2. **Revelar corretamente** — projeção contextual emerge de capabilities reais (v2 modo operante quando 3 frentes prévias materializarem); UI projeta SSOTs já existentes
3. **Remover fragmentações** — P4 (presença, 9 modelos), P5 (vínculo, 6 modelos), bank satellites (16 dormentes); convergir ou congelar conscientemente, nunca acumular
4. **Amadurecer módulos prematuros** — DECISION-0041 categoria PREMATURO; aguardar pressão real, não antecipar

**Anti-padrões implícitos:**
- Tratar fundação como inexistente quando ela existe
- Reconstruir camadas que já têm runtime
- Acumular convergência interrompida sem congelamento explícito
- Classificar por inferência de nome em vez de auditoria material

---

## Princípio 6 — Módulos como projeções de núcleos estruturais

**Insight derivado:** muitos módulos provavelmente são **projeções diferentes dos mesmos núcleos estruturais**. Não são domínios independentes — são vistas/visões/views sobre invariantes compartilhados.

### Exemplo material confirmado nesta sessão — P1 Disponibilidade

`unified-availability` é SSOT temporal real. 4 tabelas paralelas materialmente projetáveis via `owner_type+owner_id`:

| Tabela paralela | Pode projetar em availability como | Estado runtime |
|---|---|---|
| `event_sessions` | `owner_type='event'` (capacity + range) | 0 rows (esqueleto) |
| `rides_driver_sessions` | `owner_type='driver'` (online flag + range) | 0 rows (esqueleto) |
| `pdv_sessions` | `owner_type='pdv'` (opened/closed range) | 0 rows (esqueleto) |
| `schedules+schedule_slots` | template recorrente → gera availabilities concretas | 0 rows (esqueleto) |

**Veredito material:** convergência arquitetural possível (DECISION-0037 ratifica SSOT); aguarda frente dedicada (DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL).

### Outros padrões a investigar quando frente real exigir

Hipóteses materialmente sustentadas pela Frente 2 mas não autorizadas a convergir agora:

- **P4 Presença:** 9 modelos paralelos podem ser projeções de `live_presence` (status enum ONLINE/OFFLINE como base) — aguardar primeira presença real
- **P5 Vínculo:** 6 modelos paralelos podem ser projeções de `actor_delegations` (scopes_json + expires_at como base) — aguardar primeira delegação real
- **P6 Pagamento:** 9 tabelas com vocabulário sobreposto — Payment Engine desenhado com responsabilidades separadas; não fragmentação, projeções por subdomínio (intent/milestone/transaction/escrow/payout)

**Princípio metodológico:** antes de "criar novo módulo X", perguntar primeiro **"X é projeção de núcleo Y existente?"**. Se sim, projetar via owner_type+owner_id (ou padrão equivalente). Se não, frente arquitetural própria justificada.

---

## Princípio 7 — Pergunta institucional reformulada

**Pergunta institucional não é mais 'cabe?'. É 'como expandir sem fragmentar?'**

Esta reformulação substitui implicitamente perguntas anteriores que já têm resposta material:

| Pergunta antiga | Resposta material confirmada | Pergunta nova |
|---|---|---|
| "A visão cabe na arquitetura atual?" | SIM (71/157 FUNCIONAIS, 13 módulos canônicos, SSOTs identificadas) | "Como expandir sem fragmentar?" |
| "Precisamos reconstruir camadas fundamentais?" | NÃO (actor + ledger + authority + delegação + projeção existem) | "Quais convergências silenciosas amadurecer primeiro?" |
| "Esse módulo deveria existir?" | Maioria sim conceitualmente | "Esse módulo é PREMATURO ou ESTRUTURALMENTE_ERRADO?" |
| "Quanto código está quebrado?" | Menos do que parecia (24 FANTASMAs com caller; nicho específico) | "Quais 24 endpoints precisam de decisão caso a caso?" |
| "Onde fica X feature na fundação?" | Frequentemente "X é projeção de núcleo Y" | "X reusa SSOT existente ou precisa frente própria?" |

**Aplicação na priorização:** as 31 DTs ativas devem ser triadas pela nova pergunta. Cada uma é:
- **Convergência silenciosa a amadurecer** (PREMATURO, congelar até pressão real)
- **Fragmentação acidental a remover** (ESTRUTURALMENTE_ERRADO, corrigir/arquivar)
- **Documentação de fronteira** (INFORMATIVA, preservar lição)

Nenhuma DT representa "fundação faltando" — todas operam sobre fundação existente.

---

## Consolidação dos 7 princípios institucionais permanentes da sessão

| # | Princípio | Origem | Localização |
|---|---|---|---|
| 1 | "Sistemas morrem na hora em que começam a convergir... congelar ANTES da fragmentação cristalizar" | Clayton, DECISION-0038 | REMEDIATION_DECISIONS_LOG.md |
| 2 | "Classificação cirúrgica por inferência de nome é anti-padrão. Auditoria material antes de execução é obrigatória" | Clayton, PASSO 5 Priorização | DT_PRIORIZATION.md + REMEDIATION_DT_LOG.md |
| 3 | "Módulo PREMATURO ≠ módulo ESTRUTURALMENTE ERRADO. Congelar módulos prematuros preserva convergência futura" | ChatGPT via Clayton, DECISION-0041 | REMEDIATION_DECISIONS_LOG.md |
| 4 | 3 categorias semânticas: ESTRUTURALMENTE_ERRADO / PREMATURO / INFORMATIVA | DECISION-0041 + Higiene | DT_PRIORIZATION.md |
| 5 | "O sistema estruturalmente cabe a visão. Trabalho é organizar/revelar/remover fragmentações/amadurecer prematuros — não reconstruir" | Clayton + ChatGPT, consolidação final | DT_PRIORIZATION.md (esta seção) |
| 6 | "Módulos como projeções de núcleos estruturais. Antes de criar X, perguntar: X é projeção de Y existente?" | Síntese material P1 Disponibilidade | DT_PRIORIZATION.md (esta seção) |
| 7 | "Pergunta institucional não é mais 'cabe?'. É 'como expandir sem fragmentar?'" | Clayton, consolidação final | DT_PRIORIZATION.md (esta seção) |

**Estes 7 princípios formam o framework operacional permanente para todas as frentes futuras de remediação, expansão arquitetural e priorização.** São chaves de leitura institucional vinculantes.

---

## Estado material após consolidação dos princípios

Sem mudança em código (sessão de registro institucional puro). DT_PRIORIZATION.md ganha +1 seção de princípios (esta). Modo permanece: **AGUARDANDO_AUTORIZACAO** para A''.expandido (ou outra direção).


---

## Princípio 8 — DT registra alerta, NÃO escopo (Clayton, 2026-05-16)

**Origem:** 8ª refutação material da sessão (A'' auditoria prévia descobriu 49 callers em 12 arquivos vs DT alegava 22 em 4).

> **"DT registra alerta, NÃO escopo. Toda DT exige re-auditoria de escopo antes de execução. Estimativa da DT é piso, não teto."**

### Fundamento material

DT é criada em momento histórico específico — captura o que o autor viu naquele instante. O sistema continua evoluindo:
- Novos arquivos com mesmo padrão podem ter sido criados depois
- Padrões similares podem existir em outras pastas não auditadas pela DT original
- Estimativas de tempo refletem escopo inicial, não escopo material atualizado
- Contagens específicas (ex.: "22 callers") são amostragem, não inventário definitivo

### Padrão concreto observado nesta sessão

| DT | Escopo alegado | Escopo material | Refutação |
|---|---|---|---|
| DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT | 22 callers, 4 arquivos | **49 callers, 12 arquivos** | DT subestimou em 2.2× |

### Implicação operacional

ANTES de qualquer execução de DT:
1. **Re-auditoria material do escopo** via grep/SQL com critério mais amplo que o original
2. **Verificação de overlap** com outras DTs ativas (mesmo arquivo, mesmo padrão, mesmo módulo)
3. **Recalibração de estimativa** baseada em escopo real (estimativa DT é piso)
4. **Decisão consciente** sobre escopo de execução (expandido / parcial / dividido)

### Ações proibidas (anti-padrões)

- ❌ Executar DT com estimativa original sem re-auditoria
- ❌ Tratar contagem da DT como verdade definitiva
- ❌ Ignorar arquivos não mencionados na DT que têm o mesmo padrão
- ❌ Fechar DT sem verificar se escopo material foi coberto

### Conexão com princípios anteriores

- **Reforça princípio 2** ("Classificação cirúrgica por inferência de nome é anti-padrão"): inferir escopo a partir da DT sem auditoria material é a mesma classe de erro
- **Complementa princípio 5** (sistema cabe a visão): se a fundação cabe, escopo de remediação se mede em relação ao runtime real, não à percepção inicial

### Localização institucional

Aplicar como reflexo permanente em **todas** as frentes futuras de execução de DT, incluindo as 4 AUDITORIA pendentes (DT-MEMBERSHIP + DT-AUTOMATION + DT-q3-e2e-v2-service-booking-sem-reserve + bank satellites governance/risk) e qualquer frente arquitetural grande (D nó crítico v2, DT-GLOBAL-USER-ID, health).


---

## ATUALIZAÇÃO PÓS-A''.expandido — DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT CLOSED (2026-05-16)

**Vínculo:** REMEDIATION_DT_LOG.md (entrada CLOSED 2026-05-16) + commit `036a8fc8`

### Mudança

- DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT: **OPEN → CLOSED**
- Bucket: BLOQUEIA_FRENTE → CLOSED (fora da priorização)
- Categoria semântica: ESTRUTURALMENTE_ERRADO (era único candidato a sprint cirúrgico real; resolvida)

### Distribuição refinada após A''.expandido

| Bucket | Anterior (pós-Higiene) | Após A''.expandido | Δ |
|---|---:|---:|---:|
| BLOQUEIA_PRODUTO | 2 | 2 | 0 |
| BLOQUEIA_FRENTE | 22 | **21** | -1 |
| INFORMATIVA | 7 | 7 | 0 |
| **Total ativas** | 31 | **30** | -1 |
| CLOSED (fora) | 8 | **9** | +1 |

### Métricas materiais do A''.expandido

| Item | Valor |
|---|---|
| Commits aplicados | 1 (`036a8fc8`) |
| Arquivos editados | 13 (12 callers + client.ts com helper exportado) |
| Substituições mecânicas | 49 |
| Inserções | 87 |
| Deleções | 61 |
| TSC frontend | 0 erros |
| Grep residual | 0 ocorrências do padrão antigo |
| Smoke 3 rotas | 200 × 3 |

### Próxima frente

4 AUDITORIA pré-classificação pendentes (Higiene v2 categoria AUDITORIA):
- DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS (requer SQL `to_regclass`)
- DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK (overlap triplo alerts × scheduler × workers)
- DT-q3-e2e-v2-service-booking-sem-reserve (auditoria split engine)
- DT-BANK-SATELLITE-MODULES-DORMANT subitens governance + risk

Após 4 AUDITORIA: decisão sobre frente arquitetural grande (D nó crítico v2 / DT-GLOBAL-USER-ID / health).

---

## PASSO 7 — Pós-frente 4 AUDITORIA pré-classificação (2026-05-16)

### Reclassificações materiais resultantes

| DT | Bucket anterior | Bucket final | Razão |
|---|---|---|---|
| DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS | AUDITORIA | sub-DT histórica permanece OPEN; substituída por DT-MEMBERSHIP-SSOT-DECISION-REQUIRED em BLOQUEIA_PRODUTO | DRIFT REAL com BUG LATENTE confirmado (`company_members` tabela inexistente; `authorization.service.ts:369` consulta-a) |
| DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK | AUDITORIA | BLOQUEIA_FRENTE | PREMATURO — zero rows, zero callers, zero authority hits |
| DT-BANK-SATELLITE governance (sub) | AUDITORIA | BLOQUEIA_FRENTE (sub-grupo ratificado) | PREMATURO — ratificação coletiva aplicada na sessão anterior cobre |
| DT-BANK-SATELLITE risk (sub) | AUDITORIA | BLOQUEIA_FRENTE (sub-grupo ratificado) | PREMATURO — idem |
| DT-q3-e2e-v2-service-booking-sem-reserve | AUDITORIA / BLOQUEIA_FRENTE #24 | **CLOSED** | DESIGN_CONSCIENTE — split engine sem reserve preliminar é decisão deliberada (DT-SERVICE-BOOKING-CONVERGENCE-MAP #13) |

### DT nova criada (BLOQUEIA_PRODUTO)

**DT-MEMBERSHIP-SSOT-DECISION-REQUIRED** — Decisão arquitetural entre 3 opções (A: `company_users` expandido / B: `company_members` via migration / C: `organization_*` via Sprint 78). Custo, blast radius, alinhamento, reversibilidade documentados em `REMEDIATION_DT_LOG.md`.

### Adicionais desta sessão (modal loop)

| DT | Bucket | Razão |
|---|---|---|
| DT-PROFILE-MODAL-LOOP-PAGE-ACTOR | **CLOSED** | Sub-instância resolvida de DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT; fix cirúrgico aplicado em `Profile.tsx:542-549` (guard `activeActor?.actor_type === 'user'`) |
| DT-PROFILE-PERSONAL-TAB-VISIBLE-FOR-NON-USER-ACTOR | INFORMATIVA | Descoberta lateral — aba "Pessoal" visível para page/group/channel com dados vazios; UX inconsistente mas não loop |

### Distribuição final após PASSO 7

| Bucket | Pré-PASSO 7 | Pós-PASSO 7 | Delta |
|---|---|---|---|
| BLOQUEIA_PRODUTO | 3 | **3** | inalterado (MEMBERSHIP-SSOT entra como nova; mas mantém balance via outras reclassificações documentadas) |
| BLOQUEIA_FRENTE | 22 | **21** | -1 (DT-q3-e2e-v2-service-booking-sem-reserve removida → CLOSED; AUDITORIA já estava contada como BF) |
| INFORMATIVA | 10-11 | **6** | -4/-5 (consolidação após auditoria material; algumas DTs informativas absorvidas em sub-grupos ratificados; DT-PROFILE-PERSONAL-TAB nova entra como INFORMATIVA) |
| CLOSED (fora) | 7 + 2 refin. | **10** | +3 (DT-q3-e2e-v2-service-booking + DT-PROFILE-MODAL-LOOP + 1 do bloco refinamentos consolidado) |

**Distribuição declarada por Clayton:** 3 / 21 / 6 / 10.

### TOP BLOQUEIA_PRODUTO atualizado (Ordenação A — gravidade arquitetural pós-PASSO 7)

| Ordem | DT | Razão crítica |
|---|---|---|
| 1 | **DT-MEMBERSHIP-SSOT-DECISION-REQUIRED** | BUG LATENTE REAL em runtime: `company_members` tabela inexistente consultada por `authorization.service.ts:369`. Frente admin/grupos quebra no primeiro fluxo. Decisão arquitetural (A/B/C) precisa preceder execução. Única DT desta sessão com evidência de quebra ativa. |
| 2 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | 24 endpoints frontend chamam tabelas inexistentes. Bloqueia primeiro usuário real em qualquer feature mapeada. |
| 3 | **DT-COVERAGE-BOOTSTRAP-REQUIRED** | Ledger consistente exige bootstrap econômico real. Distribuição/regional fund operam em base inconsistente sem ele. |
| 4 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Duplicação de identidade em fluxos compostos afeta integridade transversal. Risco de leak data entre tenants em casos de borda. |

**Razão para MEMBERSHIP no #1:** única DT desta sessão com BUG LATENTE REAL confirmado em runtime (`to_regclass NULL` + caller ativo em chain admin). 3 frentes arquiteturais (GLOBAL-USER-ID / D / health) ficam atrás porque MEMBERSHIP tem evidência de quebra ativa, não risco potencial.

### Próxima frente recomendada

**Frente MEMBERSHIP** (PASSO 2 do plano aprovado por Clayton 2026-05-16):
- 2.a — Auditoria profunda READ-ONLY do impacto real
- 2.b — DECISION arquitetural prévia (A/B/C)
- 2.c — Frente de execução (após DECISION) com gates + commits atômicos

Aguardar autorização explícita Clayton entre PASSO 1 (este update) e PASSO 2.a.

### Padrão consolidado — 9ª refutação material

Padrão da sessão 2026-05-16: 9 refutações materiais acumuladas a hipóteses pré-auditoria. Distribuição dos 5 DTs auditados na frente 4 AUDITORIA:
- 1 DRIFT REAL (MEMBERSHIP) — 20%
- 3 PREMATURO (AUTOMATION + governance + risk) — 60%
- 1 DESIGN_CONSCIENTE (service-booking) — 20%

Razão de refutação 4/5 (80%) reforça princípio 8 ("DT registra alerta, não escopo") + DECISION-0041 ("PREMATURO ≠ ESTRUTURALMENTE_ERRADO"). Hipótese inicial baseada em nome da DT ou intuição de gravidade sobre-estimou drift 4 de 5 vezes.

**Reflexo institucional permanente:** toda DT com tag AUDITORIA pré-classificação requer auditoria material READ-ONLY antes de classificação por inferência. Hipótese inicial é hipótese, não fato.

---

## PASSO 8 — Pós-execução frente MEMBERSHIP (DECISION-0042, 2026-05-16)

### Reclassificações resultantes

| DT | Bucket anterior | Bucket final | Razão |
|---|---|---|---|
| DT-MEMBERSHIP-SSOT-DECISION-REQUIRED | BLOQUEIA_PRODUTO #1 | **CLOSED** | DECISION-0042 aplicada — Opção A (company_users expandido) executada |
| DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS | BLOQUEIA_FRENTE #21 | CLOSED como standalone; preservada como sub-DT histórica de DECISION-0042 | Absorvida pela frente |
| DT-ORGANIZATION-SPRINT78-FROZEN | (não existia) | BLOQUEIA_FRENTE NOVA | Sprint 78 organization_* congelada com critério de descongelamento (Clayton decide quando demandar governança organizacional cross-tipo) |

### Distribuição final após PASSO 8

| Bucket | Pré-PASSO 8 | Pós-PASSO 8 | Delta |
|---|---|---|---|
| BLOQUEIA_PRODUTO | 3 | **2** | -1 (MEMBERSHIP CLOSED) |
| BLOQUEIA_FRENTE | 21 | **21** | -1 (MEMBERSHIP-MIGRATIONS sai como standalone) +1 (SPRINT78-FROZEN entra) = balanceado |
| INFORMATIVA | 6 | **6** | inalterado |
| CLOSED (fora) | 10 | **11** | +1 (DT-MEMBERSHIP-SSOT-DECISION-REQUIRED) |

### TOP BLOQUEIA_PRODUTO atualizado (Ordenação A pós-PASSO 8)

| Ordem | DT | Razão crítica |
|---|---|---|
| 1 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | 24 endpoints frontend chamam tabelas inexistentes. Bloqueia primeiro usuário real em qualquer feature mapeada. |
| 2 | **DT-COVERAGE-BOOTSTRAP-REQUIRED** | Ledger consistente exige bootstrap econômico real. Distribuição/regional fund operam em base inconsistente sem ele. |
| 3 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Duplicação de identidade em fluxos compostos afeta integridade transversal. Risco de leak data entre tenants em casos de borda. |

**MEMBERSHIP descido para CLOSED.** Próximas 3 candidatas mantêm prioridade estrutural — escolha humana sobre qual abrir.

### Bug visível residual descoberto (lateral, não tratado)

`CompanyTeamTab.tsx:173-200` linka 4 botões para `/organization/{members,invites,roles,units}` — rotas que retornam 500 em runtime (organization_* tabelas inexistentes). Ficou MAIS visível agora porque a aba `Equipe & Permissões` (que estava 100% quebrada) **passou a funcionar com DECISION-0042**, e usuários vão clicar nos botões. Mitigação cirúrgica (esconder/desabilitar botões) seria frente curta separada.

### Padrão capturado — 10ª refutação material acumulada da sessão

Hipóteses iniciais da auditoria MEMBERSHIP refutadas pelo material:

| Hipótese | Achado material |
|---|---|
| "1 caller backend de company_members" | 5 callers backend + frontend completo + Sprint 78 paralelo |
| "Opção B (restaurar archive) seria opção natural" | Opção A (substrato vivo) mais barato — apenas 1 migration aditiva + 2 refactors + 1 adapter, vs criar/migrar tabela inteira |
| "company_users é tabela simples" | Já tinha role + is_active + 5 colunas can_manage_* — quase no-op em termos de schema |
| "organization_* só existe como conceito" | 4 repos backend + 3 pages frontend + 4 migrations no archive — Sprint 78 inteira implementada (mas tabelas zero) |

Reforça princípio 8 ("DT registra alerta, não escopo") + princípio operacional: dados materiais sempre revelam cenário mais rico que hipótese inicial baseada em nome.

---

## PASSO 9 — Higiene 2026-05-17: DT-COVERAGE-BOOTSTRAP-REQUIRED removida das listas TOP

### Achado material da Frente #3 (auditoria GUARDIÃO READ-ONLY)

Clayton autorizou abertura de "Frente #3 — auditoria material profunda de COVERAGE-BOOTSTRAP em READ-ONLY". A primeira leitura do DT_LOG revelou contradição material:

**DT-COVERAGE-BOOTSTRAP-REQUIRED está institucionalmente CLOSED desde 2026-05-12** via DECISION-0031 (Opção Z — sistema correto, smoke v1 errado). Auditoria normativa contra 5 leis. Multi-agente: Claude Code + ChatGPT + Opus + Clayton soberano.

Evidências convergentes (todas pré-existentes a esta sessão):
- `REMEDIATION_DT_LOG.md:295` — `Status: CLOSED (encerrada por DECISION-0031)`
- `DT_PRIORIZATION.md:330-332` (registrado no PASSO 4 OPÇÃO C) — `"Erro material da tabulação anterior. Correção: mover de BLOQUEIA_PRODUTO ATIVA → CLOSED"`
- `DT_PRIORIZATION.md:459-461` — `"Achado 1 — DT-COVERAGE-BOOTSTRAP-REQUIRED estava CLOSED. Já documentado acima."`

### Por que a DT reapareceu em listas TOP posteriores

Listas TOP em PASSO 7 (linhas 800-803) e PASSO 8 (linhas 851-853) — escritas nesta sessão 2026-05-16/17 — **reinseriram a DT** como BLOQUEIA_PRODUTO sem cruzar com o estado material registrado. Padrão cognitivo #4 (verdade paralela) descrito em `~/.claude/projects/C--unificard/memory/feedback_norma_ja_decide.md` + code.md §-3.

Manifestação: ao escrever PASSO 7 e PASSO 8, ancorei na lista anterior (pré-Higiene) em vez de na DT viva. Hipótese inicial "lista TOP histórica = referência confiável" antes de ancorar materialmente na fonte (DT_LOG).

### Correção aplicada (esta entrada)

**As listas TOP BLOQUEIA_PRODUTO de PASSO 7 (linha 801) e PASSO 8 (linha 852) são SUPERSEDED por esta:**

| Ordem | DT | Razão crítica | Mudança |
|---|---|---|---|
| 1 | **DT-MODULES-ASPIRATIONAL-VS-RUNTIME** | 24 endpoints frontend chamam tabelas inexistentes. Bloqueia primeiro usuário real em qualquer feature mapeada. | mantida (mas: triada 100% nesta sessão; cobertura tratada via mitigações cirúrgicas + DT-FANTASMA-ORPHAN-COLLECTIVE — vide PASSO 8 e commits `99870acb`/`10fefd04`/`68d04914`/`825030e3`) |
| 2 | **DT-GLOBAL-USER-ID-DUPLICATION-E2E** | Duplicação de identidade em fluxos compostos afeta integridade transversal. Risco de leak data entre tenants em casos de borda. | promovida de #3 para #2 (DT-COVERAGE-BOOTSTRAP removida) |

**Removida da lista TOP:**
- ~~DT-COVERAGE-BOOTSTRAP-REQUIRED~~ — CLOSED desde 2026-05-12 por DECISION-0031. Não é BLOQUEIA_PRODUTO ativa. Trabalho residual viável existe (vide "Frentes derivadas legítimas" abaixo), mas não é "abrir DT-COVERAGE-BOOTSTRAP".

### Distribuição material atual (pós-Higiene)

| Bucket | Pré-Higiene (PASSO 8 erroneamente) | Pós-Higiene 2026-05-17 |
|---|---|---|
| BLOQUEIA_PRODUTO | 3 (com COVERAGE listada erroneamente) | **2** (MODULES-ASPIRATIONAL triada + GLOBAL-USER-ID arquitetural pendente) |
| BLOQUEIA_FRENTE | 21 | 21 |
| INFORMATIVA | 6 | 6 |
| CLOSED (fora) | 11 | 11 (COVERAGE-BOOTSTRAP já estava aqui materialmente desde 2026-05-12; somente a listagem TOP estava errada) |

### Frentes derivadas legítimas (NÃO é "DT-COVERAGE-BOOTSTRAP")

DECISION-0031 documenta sequência fundacional canônica. Trabalho residual identificável:

1. **Auditar coerência runtime com DECISION-0031** — verificar se `ensurePlatformAccounts` roda em criação de tenant + se há tenant com fluxo fundacional já exercitado. Trabalho de validação, não mitigação. **Toca causalidade financeira — DECISION humana para abrir.**
2. **Smoke v2 / Q3-E2E v2** — implementação do caminho fundacional via `event_ticket` com split engine reserve 17%. Frente própria de execução econômica real. **Toca causalidade financeira ATIVA — DECISION humana para abrir.**

Nenhuma é "abrir DT-COVERAGE-BOOTSTRAP" — DECISION-0031 explicitamente diz que essa DT está encerrada por design. Cláusula institucional permanente (DECISION-0031): *"qualquer frente futura que tente 'bootstrap artificial de cobertura' deve referenciar esta decisão antes de propor implementação."*

### 17ª refutação material da sessão

Hipótese: "Frente #3 = abrir DT-COVERAGE-BOOTSTRAP".
Realidade: **a DT está institucionalmente fechada há 5 dias por DECISION soberana multi-auditada.** Auditoria material no próprio log já havia documentado o erro de tabulação **3 vezes** (linhas 295, 330-332, 459-461) — e eu mesma propaguei a lista desatualizada em PASSO 7 e PASSO 8.

Reforça padrão estrutural §-3 code.md: reconhecer 4 vezes (agora 5) reduz frequência, não elimina o impulso. Auditoria material em pontos críticos é permanente, não fase temporária.

### Princípio operacional registrado

> "Listas TOP referenciais derivadas de outras listas (não da fonte material da DT) propagam erros como cascata. Toda consulta a 'qual DT abrir' deve cruzar com fonte material vigente (`Status: CLOSED|OPEN` na entrada da DT no DT_LOG), não com lista intermediária. Princípio análogo a runtime soberano (memória `feedback_runtime_soberano`): fonte concentra causalidade; listas projetam."

### Edits de código

Nenhum. Doc-only. Append-only para preservar histórico do erro como evidência institucional (igual code.md §-3 preserva 4 erros materiais).

---

## Princípios da convergência contextual progressiva — Frente /perfil (2026-05-17)

Origem material: Fase A da Frente "Convergência Contextual Profunda da Superfície". Auditoria histórica confirmou que `core/profile` early return PF foi cristalizado em commit `c4c45ec77` (2026-01-27) como "BLINDAGEM" sem DECISION formal; DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (2026-05-15) reclassificou como gap. Decisão arbitra entre as duas leituras do próprio autor — escolhida direção **(b) refinada — progressiva** (não maximalista, com 3 sinais de saturação, começando por /perfil em escopo cirúrgico).

Princípios registrados aqui são reflexo permanente para frentes futuras de convergência contextual.

### 1. Convergência por pressão local material

> Convergência contextual emerge por pressão local material, não por desenho global antecipado. Cada superfície adapta quando há pressão real (bug ativo, decisão bloqueada, caso de uso concreto).

### 2. Progressivo NÃO é lento — é respeito ao mecanismo histórico

> Progressiva NÃO é lentidão. É respeitar mecanismo histórico de convergência demonstrado em availability, delegation, authority, membership. Antecipar abstração contradiz padrão documentado em 14+ refutações materiais.

### 3. Separação de papéis: backend respeita identidade; frontend respeita projeção

> Backend respeita identidade. Frontend respeita projeção. Backend NÃO inventa shapes polymorphic por actor_type — isso recria módulos soberanos dentro de profile e contradiz padrão de convergência por pressão local.

### 4. Campos não aplicáveis são comportamento esperado, não gap

> Campos não aplicáveis por actor_type são comportamento esperado, não gap funcional a corrigir. Quando actor_type não tem semântica para um campo (ex: health_profile para actor_type='page'), ausência é comportamento esperado, não drift.

### 5. Frontend NÃO mascara ausência contextual

> Frontend NÃO mascara ausência contextual com fallback implícito de outro actor/contexto. Empresa usando dados PF silenciosamente, banda mostrando profile humano mascarado, CRM herdando contexto errado — todos cenários proibidos. Ausência contextual vira parte válida da semântica.

### 6. DECISION posterior à validação

> DECISION posterior à validação. Pattern do sistema: availability foi exercitada antes de DECISION-0037; delegation atravessou viva antes de qualquer DECISION formal; MEMBERSHIP foi resolvido em DECISION-0042 após pattern validado. Repetir esse padrão em /perfil — DECISION-0043 formalizada após pattern funcionar.

### 7. Três sinais de saturação para pausa estratégica

> Três sinais de saturação institucionalmente registrados para convergência contextual progressiva:
> - (a) 70%+ das superfícies operacionais não-soberanas adaptadas
> - (b) Pressão local cessou (2-3 sessões sem nova superfície exigindo adaptação)
> - (c) Cluster crítico atravessado (perfil + bank + CRM)
>
> Quando 2 dos 3 sinais batem: pausa estratégica, reavaliar se vale continuar.

### 8. Redirect reorganiza superfície, NÃO migra soberania

> Redirect contextual reorganiza superfície visual, NÃO altera activeActor, authority, ownership, delegation ou identidade soberana. Frontend NUNCA troca actor implicitamente via reroute. Superfície migra por soberania; soberania não migra por superfície.

### 9. Redirect contextual síncrono no cliente

> Redirect contextual em /perfil é derivado exclusivamente do activeActor já resolvido no cliente. Determinístico e síncrono por actor_type. NÃO depende de fetch assíncrono, permission lookup ou resolução remota.

### Aplicação institucional

Estes 9 princípios:
- São referência para PASSO 2 (3 fixes cirúrgicos), PASSO 3 (gates expandidos), PASSO 5 (DECISION-0043) e PASSO 6 (DT CLOSED) da mesma frente
- Devem ser invocados em frentes futuras de convergência contextual em outras superfícies (bank, CRM, agenda, etc.) — mesma direção, mesmo mecanismo
- NÃO substituem norma soberana (Constituição, LEI_DE_COERENCIA, AUTHORITY_LAW)
- NÃO autorizam refactor amplo — apenas explicitam direção quando pressão local emerge
- Sinal 7 (saturação) é gate institucional para evitar virar dogma de convergência infinita
