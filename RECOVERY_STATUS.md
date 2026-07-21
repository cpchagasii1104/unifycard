# CURRENT RECOVERY STATUS — painel executivo (projeção, NÃO-normativa)

> **NATUREZA:** projeção executiva **não-normativa** de uma página. **NÃO é norma, NÃO é cartório, NÃO é DECISION, NÃO é uma segunda fonte de verdade.** Só resume; em qualquer divergência, o cartório e as DECISIONs seladas prevalecem.
>
> **FONTES:** `PLANO_RECUPERACAO.md` · `REMEDIATION_DT_LOG.md` · `dividatecnica.md` · DECISIONs seladas (0190, 0191).
>
> **NÃO AUTORIZA:** nenhum GO, código, migration, guard, runner, Bank ou worker. Ler este painel nunca autoriza ato material — cada frente exige seu próprio GO.
>
> **Atualizado:** 2026-07-21 · **HEAD verificado:** `f13a93e12` (selo final docs-only) · **Branch:** `rescue-structural`

---

## Objetivo original (em uma frase)
Recuperar a **confiabilidade arquitetural** do sistema — saber o que está vivo, o que é seguro, quais provas realmente rodam, onde há caminhos paralelos — **antes** de voltar a alterar código ou abrir produto. Substituir "pegar a próxima dívida" (reativo) por "reconstruir a verdade → mapear eixos → auditar conexões → achar causas-raiz → só então corrigir".

## O que foi auditado (read-only, concluído)
- **Mapeamento geral** (Rodadas 0–10) + consolidação (Anexo C: FIND-*, ROOT-*, ranking, 6 pacotes AUDIT-001..006).
- **AUDIT-001** `economic/v2`: cadeia de pagamento embutida em Eventos; rótulo "sandbox" enganoso.
- **✅ AUDIT-002 · CONCLUÍDO E SELADO** — **84/84 guards sem entrada nominal direta auditados individualmente** (F-1 Bank 19 · F-2 Authority 19 · F-3 RLS/Workers 6 · F-4 Schema 12 · F-5 Legacy/Produto 20 · F-6 Frontend 8; F-7 vazio). Veredito A, auditoria consolidada independente (Opus 4.8). **O selo significa "auditoria concluída", NÃO "dívida material resolvida".**
- **ROOT-004** (impersonação histórica): reconstruído — 5 grupos / 8 handlers, **todos corrigidos**.
- **ROOT-001** (workers cross-tenant sob RLS): reconstruído — 25 workers inventariados; 3 workers globais achados.
- **ROOT-003** reclassificado (histórico preservado): **R2 — cobertura existe, mas é opaca** (`PARTIALLY_RESOLVED_AND_CONTAINED`) → estado atual: **`MATERIALMENTE REMEDIADO E SELADO`** (2026-07-21). Arco: material inicial `bb90b4edb` → primeira Yala independente **Veredito B — remediação técnica estreita necessária** → remediação R1+R2+R3+R4 (`dc2dc0557`) → **reauditoria Yala independente Veredito A — remediação correta e apta a selo** → selo final. O meta-guard `audit-guard-coverage-manifest.mjs` torna a cobertura visível com **rótulos honestos**: `AUDIT FILES CONTINUOUSLY REACHED: 276` ≠ `CONTINUOUS GUARDS: 274` + `AGGREGATORS: 2` (274+2=276); `CI_OTHER_COMMAND` do actor-writer exige os **3 workflows** (`ALL_THREE_REQUIRED`, parser YAML estreito); runner tem **precondição de self-wiring** (meta-guard 1× no CMDS); localizador de array **endurecido contra decoys**. Falha fechado em drift = 0. Fecha: (1) contagem opaca, (2) adição invisível de guard contínuo, (3) contrato de comando externo nos workflows, (4) remoção isolada do wiring do meta-guard, (5) decoys no localizador estrutural. **Não** se declara autoproteção absoluta contra alteração coordenada e deliberada do runner (limite honesto preservado).

## F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT — SELO FINAL
```
F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT
SELADA
VEREDITO A
ROOT-003 MATERIALMENTE REMEDIADO
RUNNER: 201 COMMANDS
AUDIT FILES CONTINUOUSLY REACHED: 276
CONTINUOUS GUARDS: 274
AGGREGATORS: 2
DRIFT: 0
```
> Este painel é **executivo**, não é norma, e ler/atualizar este painel **não concede execução** de nenhuma frente.

## O que foi decidido (institucional, selado)
- **DECISION-0190** — economic/v2 honest sandbox & contenção. **SELADA · Veredito A** (`9a65f0291` + `33027ee60`).
- **DECISION-0191** — worker tenant execution contract (tenant-loop canônico). **SELADA · Veredito A** (`4223d3651` + `0baf21efc`).
- Comportamentos legítimos futuros definidos; nenhuma correção improvisada.

## O que foi implementado materialmente
**Nada.** Zero worker convertido · zero RLS nova · zero guard novo no runner · zero `501` em economic/v2 · zero migration · zero produto · **Δbank = 0**.

## O que está apenas documentado (decidido, não executado)
- Contenção `501` de economic/v2 (DECISION-0190 §9) → aguarda GO material.
- Conversão tenant-loop dos 3 workers (DECISION-0191) → aguarda GATEs + GO por tranche.
- Cobertura efetiva e anti-drift do runner (ROOT-003) → **implementados e selados** (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT). Resta aberto: hardening dos 25 `ACTIVE_BUT_INCOMPLETE` (nenhum guard ativo permanece sem enforcement).

## Riscos — estado real (honesto; "contido" ≠ "resolvido")
| Risco | Estado | Contenção atual |
|---|---|---|
| `economic/v2` alcança ledger real | **CONTIDO** | firewall do Bank default-off, fail-closed 403; PORTA-1 fechada |
| Impersonação (ROOT-004) | **CORRIGIDO** | 8 handlers com canRepresentActor/canActAs; guard fino coberto via agregador CI (sentinel amplo, baseline 0) |
| ROOT-003: cobertura opaca (classificação original R2 — cobertura existe, mas é opaca) | **MATERIALMENTE REMEDIADO E SELADO** | F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT selada (Veredito A): meta-guard torna a cobertura visível (rótulos honestos) e falha fechado em drift; 77/84 via 2 agregadores fail-closed; 1 via comando próprio; 6 one-shot; **0 ativos sem enforcement** |

## Cobertura CI (reconciliada 2026-07-21 · SELADA)
```
281 arquivos audit-* da campanha
197 entradas diretas no runner
 84 sem entrada nominal direta -> 84/84 AUDITADOS INDIVIDUALMENTE
 77 executados via 2 agregadores fail-closed (execFileSync)      [CI_AGGREGATED]
  1 executado via comando próprio de CI (validate:actor-writer-boundaries) [CI_OTHER_COMMAND]
  6 one-shot intencionais (harnesses de mutação + 1 ferramenta)  [NOT_CI_REQUIRED]
——
275 = cobertura contínua real (197+77+1)
  6 = one-shot, não exigíveis como contínuos
281 = total
  0 = ACTIVE_NOT_ENFORCED (guards ativos e válidos SEM qualquer enforcement)
```

> **Nota de denominador (duas fotografias distintas, ambas corretas em seu momento):**
> Fotografia do **selo do AUDIT-002** (2026-07-21, acima): **281/197/77/1/6**.
> Fotografia **pós-material de ROOT-003** (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT, mesmo dia): universo **283** arquivos audit-* · `CI_DIRECT` **198** · `CI_AGGREGATED` **77** · `CI_OTHER_COMMAND` **1** · `NOT_CI_REQUIRED` **7** · **276** arquivos audit continuamente alcançados = **274** `CONTINUOUS GUARDS` + **2** `AGGREGATORS` · drift **0**. A diferença vem dos 2 arquivos audit-* novos que a própria frente introduziu (o meta-guard e seu harness). **276 não é sinônimo de "guards contínuos"** — é a soma de guards contínuos (274) com agregadores (2).

## Matriz final de dois eixos (84 guards sem entrada direta)
```
Eixo A (qualidade):    ACTIVE_VALID=53 · ACTIVE_BUT_INCOMPLETE=25 · ONE_SHOT=5 · STALE=1  (=84)
Eixo B (enforcement):  CI_AGGREGATED=77 · CI_OTHER_COMMAND=1 · NOT_CI_REQUIRED=6 · ACTIVE_NOT_ENFORCED=0
```
25 `ACTIVE_BUT_INCOMPLETE` permanecem como **backlog de hardening**, não resolvidos por este selo.

### Workers globais (DECISION-0191 selada; material pendente)
```
governance-execution:
  leitura cross-tenant VIVA
  efeitos tenant-scoped
  material pendente (TENANT_LOOP_REQUIRED)

risk-identity-reconcile:
  leitura cross-tenant VIVA
  efeitos tenant-scoped
  mapa de efeitos de evaluateActorRisk ainda incompleto (GATE pendente)
  material pendente (TENANT_LOOP_REQUIRED)

ledger-snapshot:
  vivo, funcionalmente INERTE (RLS devolve 0 linhas)
  decisão TENANT_LOOP OR RETIRE pendente (GATE de consumers)
```

## Materiais pendentes (nenhum autorizado)
1. economic/v2 → contenção `501` (`F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT`).
2. Workers → tenant-loop por tranche (governance, risk, ledger-snapshot).
3. Runner → visibilidade dos sub-guards via agregador e anti-drift **FEITO E SELADO** (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT). Resta endurecer os `ACTIVE_BUT_INCOMPLETE` já identificados (hardening P1/P2, sem GO).

## Auditorias pendentes (read-only)
- AUDIT-002: **CONCLUÍDO E SELADO · VEREDITO A** (F-1 a F-6 concluídos; F-7 vazio pela partição encerrada). Nenhuma auditoria pendente neste pacote.
- GATE consumers de `ledger_snapshots` (decide RETIRE vs tenant-loop).
- GATE completo de `evaluateActorRisk`.
- Demais workers globais (`saga-timeout`, `reconciliation-scheduled`, `payment-worker`).
- AUDIT-003 (build de produção) · AUDIT-004 (denominador personificação) · AUDIT-005 (tenant-loop) · **AUDIT-006 (banco efêmero) = BLOQUEADO PELO AMBIENTE** (sem container runtime).

## AUDIT-002 · progresso por lote — CONCLUÍDO E SELADO
```
F-1 (Bank/Ledger/Firewall, 19) ......... CONCLUÍDO
F-2 (Authority/Actor, 19) ............... CONCLUÍDO
F-3 (RLS/Tenant/Workers, 6) ............. CONCLUÍDO
F-4 (Schema/Migrations, 12) ............. CONCLUÍDO
F-5 (Legacy/Runtime/Produto, 20) ........ CONCLUÍDO
F-6 (Frontend/Seams, 8) ................. CONCLUÍDO
F-7 (residual) ........................... VAZIO na partição
——
84/84 auditados · SELADO (Veredito A, Opus 4.8 consolidada)
```

## Única próxima frente: AINDA NÃO ESCOLHIDA
O selo do AUDIT-002 encerra a **auditoria**, não a **dívida material**. A frente de visibilidade+anti-drift do runner (ROOT-003 R2) está **selada** (Veredito A) — sai do backlog. Backlog aberto, sem frente escolhida:
- Hardening P1/P2 dos 25 `ACTIVE_BUT_INCOMPLETE`.
- Contenção `501` do economic/v2 (DECISION-0190).
- Tenant-loop dos 3 workers (DECISION-0191).
- Destino do `ledger-snapshot`.
- Revisão institucional futura do default público de audiência (DECISION-0115 D1).

## Ordem executiva
```
1. Painel executivo (este arquivo) .......... FEITO
2. AUDIT-002 F-1 a F-6 ........................ FEITO
3. Reconciliação do denominador (ROOT-003 R2) . FEITO
4. Selo docs-only do AUDIT-002 ................ FEITO
5. Escolher UMA frente material (backlog acima) PRÓXIMO — não escolhido
6. Voltar ao desenvolvimento de produto
```

---
*PORTA-1 fechada · nenhuma frente material escolhida · nenhuma alteração material autorizada. Este painel é atualizado a cada marco; não substitui o cartório.*
