# DECISION-0033 — `canonical_products.type` como discriminator estrutural ontológico

**Data:** 2026-05-12
**Modo:** EXECUTOR (decisão arquitetural formalizada, sem implementação de código)
**Branch:** `rescue-structural`
**Escopo:** Edição institucional de 2 arquivos versionados + criação deste log. Zero alteração de schema, código TS ou comportamento runtime.

---

## Contexto da execução

Continuação direta da investigação C38+C39 (commit `dbef2569` resolveu C39 NOT-A-BUG; relatório material em `executei_9.md`, gitignored). Investigação distinguiu 5 tabelas com coluna `type` genérico em 2 categorias semânticas:
- **4 mecânicas** — renomeação trivial (CHECK ou valor já lowercase): `payment_execution_lock`, `promotions`, `reconciliation_discrepancies`, `reconciliation_ledger_discrepancies`
- **1 arquitetural** — `canonical_products.type = 'INDUSTRIAL'` (35 registros UPPERCASE)

Clayton autorizou Opção A com critério restrito + 2 exigências institucionais explícitas: ratificar como discriminator estrutural ontológico, com restrições para evitar buraco negro.

## Ações executadas (3 arquivos versionados)

| Arquivo | Tipo | Mudança |
|---|---|---|
| `REMEDIATION_DECISIONS_LOG.md` | Edit (append) | +DECISION-0033 (~150 linhas). Estrutura espelhada em DECISION-0032. Inclui 3 Restrições institucionais explícitas e pendência derivada para alteração normativa formal por humano/RFC. |
| `SYSTEM_REMEDIATION_STATUS.md` | Edit (in-place) | C38 status: OPEN → OPEN-PARCIAL. Nota material distinguindo subcaso arquitetural ratificado por DECISION-0033 dos 4 casos mecânicos pendentes. Entrada datada no Log de Mudanças. |
| `docs/03_execution_log/2026-05-12_DECISION-0033_canonical_products_type_discriminator.md` | Write (este arquivo) | Conformidade §7 AGENT_PROTOCOL |

## DECISION-0033 — sumário canônico

**Tipo:** arquitetural (semântica linguística — exceção formal restrita)
**Status:** ATIVO
**Encerra:** subcaso `canonical_products` de C38 (sem ação técnica)

**Categoria semântica estabelecida:**

`canonical_products.type` opera como **discriminator de classe ontológica** dentro do Core, distinto de status operacional. Comporta-se semanticamente análogo a `entity_type`/`actor_type`/`event_type` — exceções canônicas já reconhecidas em §3.4. Esta DECISION explicita o critério ontológico que DECISION-0028 invocou implicitamente.

**3 Restrições institucionais (anti-expansão oportunista):**

1. **Categoria limitada** — para qualificar como exceção análoga, coluna deve atender SIMULTANEAMENTE 4 critérios: discriminar classe de entidade em tabela canônica do Core; funcionar como gate estrutural em fluxos canônicos; cristalizar em tipo TS como literal de classe (não union de estados); pertencer a tabela com nome canônico.

2. **Proibição de expansão oportunista** — `*_status` permanecem governados por DECISION-0032 (lowercase); `<entity>_type` em tabelas operacionais seguem renomeação mecânica + lowercase; qualquer pretendida nova exceção exige DECISION dedicada com prova material.

3. **Prova de classe ontológica obrigatória em DECISIONs futuras** — argumentação por analogia ("é parecido com canonical_products.type") é insuficiente. Sem prova material dos 4 critérios → caminho default permanece DECISION-0032 (lowercase).

**Refutações registradas:**
- Opção B (normalizar como status operacional): refutada. Aplicaria regra correta na categoria errada — norma fora do domínio que a justifica perde força institucional.
- Opção C (renomear mantendo UPPERCASE): refutada. Replica fragilidade de DECISION-0028 sem fundamento ontológico explícito; refutável pelo princípio de DECISION-0032.

## Pendência derivada — alteração normativa formal (responsabilidade humana)

DECISION-0033 estabelece **posição arquitetural** mas não altera `07_NOMENCLATURA_CANONICA` §3.2 ou `SSOT_REGISTRY_UNIFICARD`. Restrições aplicáveis:
- §10 do `00_AGENT_PROTOCOL` proíbe IA de alterar documentos normativos.
- §3.2 do `07_NOMENCLATURA_CANONICA` exige processo formal: SSOT_REGISTRY → glossário → implementação, com Gate + RFC.

**Pendência:** Clayton (ou processo RFC) deve adicionar `canonical_product_type` (ou nome canônico equivalente) à lista de exceções estabelecidas em §3.2, com referência explícita a esta DECISION-0033 e suas 3 Restrições. Até essa alteração, status operacional é: DECISION vigente como decisão arquitetural; alteração normativa formal pendente.

## Sub-frente 2 — 4 tabelas mecânicas (caminho desbloqueado)

Com DECISION-0033 estabelecida, Sub-frente 2 fica desbloqueada para execução. Plano:

| Tabela | Renomear coluna para | Status do valor | Risco |
|---|---|---|---|
| `payment_execution_lock` | `lock_type` | `'settlement'` lowercase já em uso | Baixo |
| `promotions` | `promotion_type` (ou `discount_type`) | CHECK lowercase ativo (`'percentage'\|'fixed'`); tipo TS `PromotionType` já correto | Baixo |
| `reconciliation_discrepancies` | `discrepancy_type` | CHECK lowercase ativo; tipo TS `ReconciliationDiscrepancyType` já correto | Baixo |
| `reconciliation_ledger_discrepancies` | `discrepancy_type` | CHECK lowercase ativo (4 valores) | Baixo |

Estimativa: 1 migration ALTER TABLE RENAME COLUMN + ~6 arquivos TS editados + 0 alterações em tipos TS (já corretos). Aguarda autorização Clayton.

## Investigação paralela — DT-C36-actor-debts-case-drift

Próxima frente em paralelo dentro do framework autônomo. Mesma metodologia de payment-casing (executei_8). Escopo limitado a 1 tabela (`actor_debts`) com CHECK misto (`'pending'` + `'TRANSFERRED_TO_ORGANIZER'`). Prioridade: framework autônomo (drift evidente, norma já decide).

## Verificação

```bash
# Confirmar entrada DECISION-0033
grep -nE "^### DECISION-0033" REMEDIATION_DECISIONS_LOG.md

# Confirmar C38 status atualizado
grep -nE "^\| C38 \|" SYSTEM_REMEDIATION_STATUS.md

# Confirmar zero alteração de código
git diff HEAD -- "*.ts" "backend/migrations/*"
# (deve retornar vazio)

# Confirmar log institucional
ls docs/03_execution_log/2026-05-12_DECISION-0033_*
```

## Multi-agente

- **Investigação:** Claude Code (Opus 4.7) — relatório material `executei_9.md`
- **Refinamento ontológico:** Clayton — distinção decisiva entre status operacional vs discriminator estrutural; 2 exigências institucionais (categoria limitada + proibição de expansão oportunista)
- **Decisão soberana:** Clayton

## Estado físico ao final desta execução

| Item | Estado |
|---|---|
| `REMEDIATION_DECISIONS_LOG.md` | +DECISION-0033 (versionado) |
| `SYSTEM_REMEDIATION_STATUS.md` | C38 OPEN → OPEN-PARCIAL com nota material (versionado) |
| `docs/03_execution_log/2026-05-12_DECISION-0033_canonical_products_type_discriminator.md` | criado (versionado) |
| `executei_9.md` | inalterado, gitignored, 238 linhas (referência material) |
| Schema, código TS, comportamento runtime | **ZERO alteração** |
| `07_NOMENCLATURA_CANONICA` / `SSOT_REGISTRY_UNIFICARD` | inalterados (alteração normativa pendente para Clayton/RFC) |

---

**FIM DO LOG. Decisão arquitetural formalizada. Sub-frente 2 desbloqueada. Investigação paralela autorizada.**
