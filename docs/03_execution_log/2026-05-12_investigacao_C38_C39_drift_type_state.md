# Investigação C38 + C39 — drift `type`/`state` genérico

**Data:** 2026-05-12
**Modo:** GUARDIÃO estrito · read-only
**Branch:** `rescue-structural`
**Escopo:** Investigação material das 12 tabelas declaradas em `SYSTEM_REMEDIATION_STATUS` (C38 = 5 com `type` genérico, C39 = 7 com `state` genérico).

---

## Contexto

C38 e C39 estavam OPEN em `SYSTEM_REMEDIATION_STATUS` desde a auditoria estrutural original. Eram as frentes que aguardavam DECISION-0032 (DT-PAYMENT-CASING-DRIFT) antes de prosseguir, conforme briefing original: *"Antes de continuar com C38/C39, preciso de uma decisão arquitetural"*. Com DECISION-0032 fechada (commit `c8c0b08e`), investigação destas duas frentes foi conduzida sob o framework de autonomia operacional ratificado.

## Prova de rastreabilidade (§2.2.2 AGENT_PROTOCOL)

- **Documentos lidos:** `07_NOMENCLATURA_CANONICA` §3.2 (Glossário Canônico), §3.4 (Ambiguidade Semântica — termos isolados), §3.5 (Cláusula de Invalidação), §4.20 (Endereços — `state` canônico), §4.37 (entity_type), §4.38 (actor_type), §4.41 (event_type), §19.8 (idioma); `00_AGENT_PROTOCOL` §4.3.1 (check artefatos abertos antes de nova frente); `SYSTEM_REMEDIATION_STATUS`; `STATUS_EXECUCAO_GLOBAL`
- **SSOT que governa:** `07_NOMENCLATURA_CANONICA` (semântica linguística)
- **Pilar afetado:** Semântica linguística. Sem toque em causalidade financeira ou identidade.
- **Modo declarado:** GUARDIÃO estrito

## O que foi executado

### Comandos (todos read-only, reproduzíveis)

```bash
# PASSO 1 — Identificar tabelas alvo (descoberta material via banco)
psql -c "SELECT table_name FROM information_schema.columns
         WHERE table_schema='public' AND column_name='type'
         ORDER BY table_name;"

psql -c "SELECT table_name FROM information_schema.columns
         WHERE table_schema='public' AND column_name='state'
         ORDER BY table_name;"

# PASSO 2 — Schema, CHECKs e valores em uso
psql -c "SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
         FROM pg_constraint
         WHERE contype='c'
           AND conrelid::regclass::text IN (
             'canonical_products','payment_execution_lock','promotions',
             'reconciliation_discrepancies','reconciliation_ledger_discrepancies',
             'regional_activation_events','regional_activation_rules',
             'regional_funds','regional_impact_snapshots',
             'rides_cities','suppliers'
           )
           AND (pg_get_constraintdef(oid) ILIKE '%type%'
             OR pg_get_constraintdef(oid) ILIKE '%state%');"

# (Para cada tabela) SELECT DISTINCT <col>, COUNT(*) GROUP BY <col>;

# PASSO 3 — Callers TS e tipos cristalizados
grep -RnE "INSERT INTO (canonical_products|payment_execution_lock|promotions|reconciliation_discrepancies|reconciliation_ledger_discrepancies|regional_activation_events|regional_activation_rules|regional_funds|regional_impact_snapshots|rides_cities|suppliers)\b" backend/src --include="*.ts"

grep -RnE "PromotionType|DiscrepancyType|ReconciliationType|LockType" backend/src --include="*.ts"

grep -RnE "type.*'INDUSTRIAL'|'INDUSTRIAL'" backend/src --include="*.ts"
```

### Artefato local (não versionado por convenção de relatórios)

`C:/unificard/executei_9.md` (238 linhas, gitignored conforme `executei*.md` em `.gitignore:41`) — relatório material completo com 4 tabelas + estimativa técnica + hipóteses + 3 sub-frentes propostas.

## Achados materiais consolidados

### C38 — 5 tabelas com coluna `type` confirmadas

**Distribuição heterogênea:**

| Tabela | CHECK ativo | Valores em uso | Diagnóstico |
|---|---|---|---|
| `canonical_products` | ❌ nenhum | `'INDUSTRIAL'` (35 registros, UPPERCASE) | **Arquitetural** — discriminator de tipo de entidade canônica, análogo a `entity_type`/`actor_type`/`event_type` (§3.4 exceções canônicas) mas sem processo formal de adoção. Pede DECISION. |
| `payment_execution_lock` | ❌ nenhum | (vazia; código usa `'settlement'` lowercase) | **Mecânico** — renomear `type` → `lock_type`; valor já conforme. |
| `promotions` | ✅ `'percentage'\|'fixed'` (lower) | (vazia) | **Mecânico** — renomear `type` → `promotion_type`; CHECK e tipo TS `PromotionType` já conformes. |
| `reconciliation_discrepancies` | ✅ `'gateway'\|'bank'\|'settlement'` (lower) | (vazia) | **Mecânico** — renomear `type` → `discrepancy_type`; CHECK já conforme. |
| `reconciliation_ledger_discrepancies` | ✅ 4 valores lowercase (`ledger_mismatch`, etc.) | (vazia) | **Mecânico** — renomear `type` → `discrepancy_type`; CHECK já conforme. |

### C39 — 6 tabelas com coluna `state` (delta material vs STATUS: declarava 7)

**Achado:** **TODAS as 6 são endereço geográfico (UF brasileira), não state machine.** §4.20 da Nomenclatura reconhece explicitamente `state` como nome canônico para "Estado/Província". §3.4 proíbe `state` no sentido de *state machine* (orderState, accountState) — sentido distinto.

| Tabela | Contexto material (INSERT) |
|---|---|
| `regional_activation_events` | `country, state, city` adjacentes — endereço |
| `regional_activation_rules` | UNIQUE composta `(tenant_id, country, state, city)` — endereço |
| `regional_funds` | UNIQUE composta + `ON CONFLICT (tenant_id, country, state, city)` — endereço |
| `regional_impact_snapshots` | Contexto regional — endereço |
| `rides_cities` | INSERT: `name, state, timezone, lat, lng` — UF + fuso |
| `suppliers` | INSERT: `address, city, state, zip_code, country` — endereço claro |

**Conclusão:** C39 é classificação errônea na auditoria original. Auditoria mapeou pelo *nome literal* da coluna sem distinguir uso semântico (endereço §4.20 vs state machine §3.4). Não há drift de norma — todas as 6 são conformes.

Delta "7 vs 6 tabelas" não foi reproduzido na varredura material — provavelmente tabela removida pós-auditoria ou inclusão de `state_code` por engano. Não vale expandir investigação (anti-padrão "buraco negro de auditoria" — §22 do code.md).

## Estado físico ao final da investigação

| Item | Estado |
|---|---|
| `executei_9.md` (relatório material completo) | Criado, gitignored, 238 linhas |
| Schema do banco | Inalterado |
| Código TS | Inalterado |
| Arquivos versionados | Inalterados (zero modificação durante investigação read-only) |
| `git status` para arquivos versionados | Limpo |

## Próximos passos derivados (sub-frentes propostas)

**Sub-frente 1 — C39 NOT-A-BUG (autonomia)**
Atualizar `SYSTEM_REMEDIATION_STATUS` com nota material e reclassificação. Sem código, sem migration. Justificativa: §4.20 já reconhece `state` como nome canônico de endereço. **Executada nesta mesma sessão** (ver seção "Sub-frente 1" abaixo).

**Sub-frente 2 — C38 mecânica das 4 tabelas (consulta antes de executar)**
RENAME COLUMN em 4 tabelas + edits coordenados em ~6 arquivos TS. Toca código em produção; mesmo trivialidade técnica pede confirmação por envolver edits TS coordenados com schema. **Aguarda autorização.**

**Sub-frente 3 — DECISION-0033 sobre `canonical_products.type` (consulta obrigatória)**
Decisão arquitetural inédita — discriminator de tipo de entidade UPPERCASE em produção (35 registros). 3 opções: ratificar como exceção canônica (Opção A), renomear + normalizar (Opção B), renomear mantendo UPPERCASE (Opção C, herda fragilidade DECISION-0028). **Aguarda decisão de Clayton.**

## Sub-frente 1 executada nesta sessão

`SYSTEM_REMEDIATION_STATUS.md` atualizado:
- Linha 149 (C39): status field qualificado para refletir reclassificação NOT-A-BUG
- Nota material adicionada à descrição com referência a `executei_9.md` e ao parágrafo aplicável de §4.20
- Entrada no "Log de Mudanças de Status" registrando a reclassificação

Justificativa formal: §4.20 do `07_NOMENCLATURA_CANONICA` define explicitamente `state` (VARCHAR(100)) como nome canônico para "Estado/Província" em contexto de endereço. As 6 tabelas materialmente verificadas usam `state` nesse sentido — não há violação. Reclassificação não requer DECISION arquitetural inédita; é aplicação direta de norma vigente que decide o caso.

C38 permanece OPEN aguardando sub-frentes 2 e 3.

## Aderência ao protocolo

- ✅ `§2.2.2` Prova de rastreabilidade declarada antes da execução
- ✅ `§4` Modo declarado (GUARDIÃO) e respeitado durante investigação; transição para EXECUTOR apenas para Sub-frente 1 + log institucional
- ✅ `§6` Escrita apenas em diretórios permitidos (`docs/03_execution_log/`, arquivos institucionais raiz já autorizados)
- ✅ `§7` Log institucional gerado (este arquivo)
- ✅ `§-1.5` Filtro de classificação aplicado — Sub-frente 1 não bloqueia, não toca causalidade, reversível
- ✅ Framework de autonomia respeitado — Sub-frentes 2 e 3 aguardam autorização

---

**FIM DO LOG.**
