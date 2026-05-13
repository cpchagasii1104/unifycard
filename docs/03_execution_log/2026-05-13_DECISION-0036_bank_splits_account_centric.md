# DECISION-0036 formalizada — bank_splits schema migra para target_account_id

**Data:** 2026-05-13
**Modo:** EXECUTOR institucional (formalização documental — NÃO toca código de runtime)
**Branch:** `rescue-structural`
**HEAD anterior:** `02fde77d` (F8 — delegação event-economy→bank-integration)
**HEAD pós-formalização:** TBD (este commit)

---

## 1. Origem material

Clayton + IA externa autorizaram formalização de DECISION-0036 com 4 refinamentos materiais sobre DRAFT em `executei_24.md`:

1. **Premissa ontológica elevada a invariante:** "Conta = destino financeiro soberano; actor = camada contextual/autoritativa"
2. **Volume bank_splits como pré-requisito material** (verificação read-only obrigatória antes de formalização)
3. **Decisão explícita sobre source_actor_id** ((a) invariante atorial vs (b) simetria) com justificativa material
4. **Política de backfill especificada** (comportamento para múltiplas accounts, fallback owner_id, validação pós-backfill)

## 2. Execução desta sessão (apenas formalização)

### 2.1 Verificações materiais executadas (read-only, fronteiras de parada honradas)

**Volume bank_splits:**
```
SELECT COUNT(*), COUNT(DISTINCT tenant_id), MIN(created_at), MAX(created_at) FROM bank_splits;
```
Resultado: 2 rows, 1 tenant, oldest 2026-04-30 14:44, newest 2026-04-30 15:22.

**Fronteira "volume > 0 → pare e reporte" acionada** conforme diretiva Clayton. Reporte feito. Clayton autorizou continuar Caminho 1 com refinamentos adicionais (audit material das rows + declaração de evolução arquitetural).

**Caracterização das 2 rows:**
- Ambas: mesmo tenant `fbe13b78`; source_actor `6510c69c` (user); target_actor `475a7d45` (user); R$400 (40000 cents); `revenue_share` 100%
- Ambas são caso simples actor→actor (modelo histórico legítimo)
- Backfill determinístico confirmado (1 bank_account `cf544aaa` única por target_actor; statement 3 resolve 1:1 sem ambiguidade)

**Distribuição source_actor_type:**
```
SELECT DISTINCT sa.actor_type, COUNT(*) FROM bank_splits bs JOIN actors sa ON sa.id = bs.source_actor_id GROUP BY sa.actor_type;
```
Resultado: 100% `'user'` (2 de 2).

**Investigação source — 4 evidências convergentes:**
1. 2 rows existentes: 100% source `actor_type='user'`
2. `bank-split.repository.ts:197-201` rejeita explicitamente source não-UUID-actor (`"actingForActorId deve ser UUID de actor válido"`)
3. `financial-authorship.helper:118` fallback `'system'` é STRING (não UUID) — sistema quebra se passar system como source
4. Padrão arquitetural: debit é sempre de payer/comprador atorial

**Decisão (a):** `source_actor_id` permanece UUID NOT NULL REFERENCES actors(id). Invariante declarada. Sem evidência de caminho real com source system → introduzir simetria seria especulação (princípio §25 norma assintótica).

### 2.2 DECISION-0036 formalizada em REMEDIATION_DECISIONS_LOG.md

Estrutura conforme template DECISION-0031:
- Contexto material (B8 descoberto F7→F8; DRAFT executei_24)
- Premissa ontológica elevada
- Evolução arquitetural reconhecida (actor→actor original + account-centric moderno)
- Audit material das 2 rows + backfill determinístico
- 3 opções avaliadas com refutações materiais (α escolhida; β/γ refutadas)
- Decisão sobre source = (a) com justificativa material
- Migration declarada (6 statements + política de backfill especificada)
- Repository refactor declarado
- Verificações pré-execução (1 e 3 ✓ executadas; 2 e 4 pendentes para sessão posterior)
- Plano operacional faseado (7 etapas)
- Consequências esperadas (curto/médio/longo prazo)
- Não autoriza (4 fronteiras explícitas)
- Impacto em DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO
- Pendência derivada (responsabilidade humana §10 AGENT_PROTOCOL)
- Referências (10 fontes materiais)

## 3. Refinamentos Clayton incorporados (4 de 4)

| Refinamento | Onde incorporado na DECISION |
|---|---|
| Premissa ontológica como invariante institucional | Seção dedicada "Premissa ontológica elevada a invariante" + repetida na justificativa final + pendência derivada para adendo normativo humano |
| Volume bank_splits como evidência material | Seção "Audit material da bank_splits histórica (read-only, 2026-05-13)" com caracterização completa das 2 rows + análise determinística do backfill |
| Decisão explícita sobre source | Seção dedicada "Decisão sobre `source_actor_id` (invariância vs simetria)" com 4 evidências convergentes e justificativa para (a) |
| Política de backfill especificada | Statement 3 da migration anotado com política para múltiplas accounts (primeira created_at ASC) e fallback owner_id (NÃO aplicável às 2 rows existentes); statement 4 adiciona validação pós-backfill explícita |

## 4. Refinamentos Clayton (do feedback após verificação de volume) também incorporados

| Refinamento adicional | Onde incorporado |
|---|---|
| Explicitar evolução arquitetural | Seção "Evolução arquitetural reconhecida" — "bank_splits originalmente modelava apenas fluxos actor→actor; runtime introduziu destinos account-centric sistêmicos não representáveis" |
| Registrar audit determinístico das 2 rows | Seção "Audit material da bank_splits histórica" — "as 2 rows históricas foram auditadas e possuem backfill determinístico 1:1 actor→account sem ambiguidade" |

## 5. Fronteiras honradas (alinhamento com diretiva Clayton)

| Fronteira | Status |
|---|---|
| "NÃO executar migration nesta sessão" | ✓ Não executada |
| "NÃO refatorar bank-split.repository.ts nesta sessão" | ✓ Não tocado |
| "NÃO re-executar smoke v3 nesta sessão" | ✓ Não re-executado |
| "Pare e reporte se volume > 0 rows" | ✓ Acionada e reportada antes de continuar |
| "Pare se source revelar (b) é necessária com escopo expandido" | ✓ Não acionada (evidência clara para (a)) |
| "Pare se durante redação emergir contradição com DECISION-0031/0032" | ✓ Não acionada |

## 6. Arquivos produzidos nesta sessão

- `REMEDIATION_DECISIONS_LOG.md` — DECISION-0036 appendada (formalização institucional)
- `docs/03_execution_log/2026-05-13_DECISION-0036_bank_splits_account_centric.md` — este log
- `executei_24.md` — DRAFT material da investigação (gitignored, já existia, referenciado pela DECISION)

## 7. NÃO tocados (transparência institucional)

- ✗ Migration `_bank_splits_target_account_id.sql` — NÃO criada (sessão posterior)
- ✗ `bank-split.repository.ts` — NÃO refatorado (sessão posterior)
- ✗ Smoke v3 — NÃO re-executado (sessão posterior)
- ✗ `STATUS_EXECUCAO_GLOBAL.md` — NÃO atualizado (HK posterior consolidará)
- ✗ `docs/01_normative/07_NOMENCLATURA_CANONICA.md` / `LEI_DE_COERÊNCIA_SISTÊMICA_UNIFICARD.md` — NÃO tocadas (pendência humana §10)
- ✗ Memória institucional persistente (`~/.claude/projects/.../memory/`) — premissa ontológica account-centric NÃO promovida (esperar formalização normativa humana antes de cristalizar em memória IA)

## 8. Aderência ao protocolo

- §7 — log institucional criado
- §29 — git add específico (apenas REMEDIATION_DECISIONS_LOG.md + este log)
- §25 — pendências preservadas (verificações 2 e 4 pendentes; adendo normativo humano; decisão futura sobre source_account_id simétrico)
- §10 — não toquei norma soberana; pendência derivada explícita para responsabilidade humana
- Calibração 2026-05-13 — investigação prévia material antes da formalização; fronteiras de parada honradas; recononhecimento explícito de quais arquivos NÃO foram tocados

## 9. Próximo passo recomendado

Sessão posterior dedicada (após autorização Clayton explícita):
- Verificações pré-execução restantes (2: auditar checks `target_actor_id IS NOT NULL` no backend; 4: índices)
- Migration soberana + repository refactor + smoke v3 re-execução
- Commit F9 + log + housekeeping HK consolidado

Não confundir com formalização desta sessão: esta sessão **declara** o que será feito; sessão posterior **executa**.

## 10. Estado final desta sessão

| Item | Estado |
|---|---|
| DECISION-0036 formalizada em REMEDIATION_DECISIONS_LOG.md | ✅ |
| Verificação volume bank_splits + audit determinístico | ✅ executada e registrada |
| Investigação source + decisão (a) registrada | ✅ executada e registrada |
| Log institucional criado | ✅ |
| Migration / repository / smoke / runtime | ✗ NÃO tocados (alinhado com diretiva) |
| 4 refinamentos Clayton incorporados | ✅ todos os 4 |
| 2 refinamentos adicionais Clayton (pós-volume) incorporados | ✅ ambos |
| Fronteiras honradas | ✅ 6 de 6 |
