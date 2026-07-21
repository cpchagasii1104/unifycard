# CURRENT RECOVERY STATUS — painel executivo (projeção, NÃO-normativa)

> **NATUREZA:** projeção executiva **não-normativa** de uma página. **NÃO é norma, NÃO é cartório, NÃO é DECISION, NÃO é uma segunda fonte de verdade.** Só resume; em qualquer divergência, o cartório e as DECISIONs seladas prevalecem.
>
> **FONTES:** `PLANO_RECUPERACAO.md` · `REMEDIATION_DT_LOG.md` · `dividatecnica.md` · DECISIONs seladas (0190, 0191).
>
> **NÃO AUTORIZA:** nenhum GO, código, migration, guard, runner, Bank ou worker. Ler este painel nunca autoriza ato material — cada frente exige seu próprio GO.
>
> **Atualizado:** 2026-07-21 · **HEAD verificado:** `0baf21efc` · **Branch:** `rescue-structural`

---

## Objetivo original (em uma frase)
Recuperar a **confiabilidade arquitetural** do sistema — saber o que está vivo, o que é seguro, quais provas realmente rodam, onde há caminhos paralelos — **antes** de voltar a alterar código ou abrir produto. Substituir "pegar a próxima dívida" (reativo) por "reconstruir a verdade → mapear eixos → auditar conexões → achar causas-raiz → só então corrigir".

## O que foi auditado (read-only, concluído)
- **Mapeamento geral** (Rodadas 0–10) + consolidação (Anexo C: FIND-*, ROOT-*, ranking, 6 pacotes AUDIT-001..006).
- **AUDIT-001** `economic/v2`: cadeia de pagamento embutida em Eventos; rótulo "sandbox" enganoso.
- **AUDIT-002** guards: **44 de 84** órfãos classificados (F-1 Bank 19 · F-2 Authority 19 · F-3 RLS/workers 6).
- **ROOT-004** (impersonação histórica): reconstruído — 5 grupos / 8 handlers, **todos corrigidos**.
- **ROOT-001** (workers cross-tenant sob RLS): reconstruído — 25 workers inventariados; 3 workers globais achados.

## O que foi decidido (institucional, selado)
- **DECISION-0190** — economic/v2 honest sandbox & contenção. **SELADA · Veredito A** (`9a65f0291` + `33027ee60`).
- **DECISION-0191** — worker tenant execution contract (tenant-loop canônico). **SELADA · Veredito A** (`4223d3651` + `0baf21efc`).
- Comportamentos legítimos futuros definidos; nenhuma correção improvisada.

## O que foi implementado materialmente
**Nada.** Zero worker convertido · zero RLS nova · zero guard novo no runner · zero `501` em economic/v2 · zero migration · zero produto · **Δbank = 0**.

## O que está apenas documentado (decidido, não executado)
- Contenção `501` de economic/v2 (DECISION-0190 §9) → aguarda GO material.
- Conversão tenant-loop dos 3 workers (DECISION-0191) → aguarda GATEs + GO por tranche.
- Integração dos 44 guards válidos ao runner → aguarda fechar os 84 + envelope único.

## Riscos — estado real (honesto; "contido" ≠ "resolvido")
| Risco | Estado | Contenção atual |
|---|---|---|
| `economic/v2` alcança ledger real | **CONTIDO** | firewall do Bank default-off, fail-closed 403; PORTA-1 fechada |
| Impersonação (ROOT-004) | **CORRIGIDO** | 8 handlers com canRepresentActor/canActAs; guard fino fora do runner (sentinel amplo cobre, baseline 0) |
| ROOT-003: 84 guards fora do runner | **PARCIAL** | 44 classificados; runner "verde" ainda não prova cobertura total |

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
3. Runner → integrar os guards válidos em **um envelope único**.

## Auditorias pendentes (read-only)
- **AUDIT-002 F-4 a F-7** — 40 guards restantes (schema/legacy/produto/frontend; mais leves que F-1/F-2).
- GATE consumers de `ledger_snapshots` (decide RETIRE vs tenant-loop).
- GATE completo de `evaluateActorRisk`.
- Demais workers globais (`saga-timeout`, `reconciliation-scheduled`, `payment-worker`).
- AUDIT-003 (build de produção) · AUDIT-004 (denominador personificação) · AUDIT-005 (tenant-loop) · **AUDIT-006 (banco efêmero) = BLOQUEADO PELO AMBIENTE** (sem container runtime).

## Única próxima frente recomendada
**Concluir AUDIT-002 F-4 a F-7** (fechar os 84 guards) — read-only, mais rápido que os lotes anteriores, e pré-requisito do envelope único do runner. Só depois: decidir destino dos 84 → corrigir runner → escolher UMA frente material → voltar a produto.

## Ordem executiva
```
1. Painel executivo (este arquivo) ......... FEITO
2. AUDIT-002 F-4 a F-7 ...................... PRÓXIMO
3. Decidir destino final dos 84 guards
4. Corrigir o runner (envelope único)
5. UMA frente material (economic/v2 501  OU  1ª tranche de workers)
6. Voltar ao desenvolvimento de produto
```

---
*PORTA-1 fechada · F-4 não iniciado · nenhuma alteração material autorizada. Este painel é atualizado a cada marco; não substitui o cartório.*
