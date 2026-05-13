# DT-C36-actor-debts-case-drift — Sub-frente normalização código (sem revert CHECK)

**Data:** 2026-05-12
**Modo:** EXECUTOR (convergência defensiva — diretiva mestre §2)
**Branch:** `rescue-structural`
**Escopo:** 2 edits TS (event-scheduler.ts:257, trust.service.ts:481). Zero alteração de schema. Zero alteração de enforcement. CHECK preservado intacto.

---

## Contexto

Investigação `executei_10.md` identificou drift mais extenso que o documentado:
- 5 grafias diferentes para 2 conceitos em código de produção
- 3 comparações com valores **fora do CHECK** (dead branches em runtime)
- Tabela vazia em produção (drift dormente; comportamento errado seria garantido se exercitado)

Esta sub-frente elimina os dead branches **convergindo o código ao vocabulário do CHECK vigente** (`'pending'` + `'TRANSFERRED_TO_ORGANIZER'`), sem tocar o CHECK em si.

A revert/reaplicação do CHECK (para vocabulário canônico final lowercase) toca enforcement em produção — fronteira "paro e consulto" da diretiva mestre §2. Aguarda decisão arquitetural sobre vocabulário canônico final.

## Prova §2.2.2

- **Documentos lidos:** `executei_10.md` (mapeamento material 5 grafias / 3 dead branches); `REMEDIATION_DT_LOG.md` entrada `DT-C36-actor-debts-case-drift`; CHECK ativo `chk_actor_debts_status` (`'pending'` + `'TRANSFERRED_TO_ORGANIZER'`); DECISION-0032 (status operacional lowercase canônico — adjacente)
- **SSOT operacional:** vocabulário do CHECK vigente é o que aceita HOJE — código deve convergir para ele para eliminar dead branches enquanto vocabulário canônico final não é decidido
- **Pilar afetado:** Semântica linguística + dead code paths em runtime. NÃO toca enforcement (CHECK preservado).
- **Modo:** EXECUTOR (escopo restrito)

## Ações executadas

### 2 edits TS coordenados

**`backend/src/jobs/event-scheduler.ts:257`** — dead branch eliminado

Antes:
```sql
AND status = 'PENDING'
```

Depois:
```sql
-- CHECK chk_actor_debts_status aceita 'pending' (lowercase) — alinhado a §4.11.
-- (Antes: status = 'PENDING' UPPERCASE → dead branch em runtime, nunca match.)
AND status = 'pending'
```

**`backend/src/core/reputation/trust.service.ts:481`** — dead branches eliminados

Antes:
```sql
AND status IN ('paid', 'transferred_to_organizer')
```

Depois:
```sql
-- CHECK chk_actor_debts_status atual aceita 'pending' + 'TRANSFERRED_TO_ORGANIZER'.
-- 'paid' não existe na enum; 'transferred_to_organizer' lowercase tampouco.
-- Convergência defensiva ao vocabulário vigente do CHECK até DECISION sobre
-- vocabulário canônico final (DT-C36-actor-debts-case-drift).
AND status = 'TRANSFERRED_TO_ORGANIZER'
```

### NÃO foi tocado (preservação)

- `chk_actor_debts_status` (CHECK em produção — fronteira "paro e consulto")
- DEFAULT `'pending'` da coluna (correto)
- `event-scheduler.ts:150` `SET status = 'TRANSFERRED_TO_ORGANIZER'` (conforme CHECK)
- `trust.service.ts:463` `CASE WHEN status = 'TRANSFERRED_TO_ORGANIZER'` (conforme CHECK)
- `event-scheduler.ts:137,207` `WHERE ad.status = 'pending'` (conforme CHECK)
- `penalty.service.ts:284` `AND status = 'pending'` (conforme CHECK)

## Verificação

```bash
cd C:/unificard/backend && npx tsc --noEmit; echo "EXIT=$?"
# EXIT=0
```

Tabela `actor_debts` está vazia em produção (drift dormente). Esta sub-frente elimina o comportamento errado garantido se a tabela for exercitada — sem mexer em dados existentes nem em enforcement.

## Estado pós-correção

| Item | Estado |
|---|---|
| Dead branches em runtime (3 comparações com valores fora do CHECK) | ✅ Eliminados |
| TSC backend | ✅ 0 erros |
| Comportamento runtime do código `actor_debts` em produção | ✅ Inalterado (tabela vazia) |
| CHECK `chk_actor_debts_status` | ✅ Preservado intacto |
| DEFAULT `'pending'` da coluna | ✅ Preservado |
| Schema | ✅ Inalterado |
| Migration | ✅ Não criada (escopo só código) |
| DT-C36-actor-debts-case-drift | OPEN → PARCIAL (código convergido; CHECK e vocabulário canônico final pendentes) |

## Pendência preservada (PARO E CONSULTO)

A decisão arquitetural restante toca enforcement de schema e exige humano:

1. **Vocabulário canônico final** — mantém `'TRANSFERRED_TO_ORGANIZER'` UPPERCASE como exceção formal restrita (análogo a DECISION-0033, exigindo prova de classe ontológica), OU normaliza para `'transferred_to_organizer'` lowercase governado por DECISION-0032? Default da diretiva mestre §1 é convergir ao 07 (lowercase) salvo prova fortíssima de exceção.

2. **Valor `'paid'`** — `trust.service.ts:481` originalmente esperava como estado real (débito quitado fora de transferência). Adicionar à enum se for estado canônico necessário, ou descartar se for relíquia.

3. **Migration revert + reaplicar CHECK** — reverter CHECK misto atual e reaplicar CHECK lowercase puro com vocabulário decidido. Toca enforcement em produção — exige autorização explícita (diretiva mestre §2 fronteira: "Triggers/RLS/CHECK/FK em produção").

Esta sub-frente elimina dead branches sem antecipar decisão arquitetural — preserva opcionalidade até Clayton/RFC decidir.

## Aderência ao protocolo

- ✅ Modo EXECUTOR declarado (escopo restrito)
- ✅ §2.2.2 Prova de rastreabilidade
- ✅ §-1.5 — não bloqueia runtime atual; corrige dead branches; reversível
- ✅ §7 — log institucional criado
- ✅ §10 — não tocou norma
- ✅ Diretiva mestre §2 — convergência defensiva autônoma legítima (drift mapeado, dead branches observáveis, refactor local sem mudança arquitetural)
- ✅ Diretiva mestre §2 — PAROU EXPLICITAMENTE antes de tocar enforcement (CHECK em produção)
- ✅ §25 norma assintótica — convivência sem ratificação; vocabulário canônico final pendente; critério de convergência registrado na DT atualizada

---

**FIM DO LOG. Dead branches eliminados. CHECK preservado. DT em PARCIAL aguardando decisão sobre vocabulário canônico final.**
