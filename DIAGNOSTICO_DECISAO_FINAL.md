# DIAGNÓSTICO FINAL — DECISÃO DE CAMINHO

**Data:** 2026-02-11  
**Status:** ANÁLISE COMPLETA PARA DECISÃO

---

## 1. ESTADO ATUAL DO SISTEMA

### 1.1 Migrations
| Métrica | Valor |
|---------|-------|
| Total de migrations | 313 |
| Primeira | 0000_schema_migrations.sql |
| Última | 0990_fix_ledger_entries_evidence_pack_fk.sql |

### 1.2 Genesis Existente (0001_schema_genesis_ssot.sql)
**Já existe um Genesis com as tabelas SSOT:**
- ✅ tenants
- ✅ actors
- ✅ users
- ✅ profiles
- ✅ bank_accounts
- ✅ bank_transactions
- ✅ bank_ledger
- ✅ bank_splits
- ✅ event_log

**Problema:** Usa `IF NOT EXISTS` (viola Lei 3 proposta)

### 1.3 Ledgers PARALELOS Encontrados (VIOLAÇÃO Lei 5)
| Migration | Tabela | Status |
|-----------|--------|--------|
| 0001 | bank_ledger | ✅ SSOT (correto) |
| 0130 | ledger_entries | ❌ PARALELO |
| 0131 | impact_ledger | ❌ PARALELO |
| 0132 | loyalty_ledger | ❌ PARALELO |
| 0842 | social_ledger | ❌ PARALELO |

### 1.4 Splits PARALELOS Encontrados (VIOLAÇÃO Lei 5)
| Migration | Tabela | Status |
|-----------|--------|--------|
| 0001 | bank_splits | ✅ SSOT (correto) |
| 0054 | split_configuration | ❌ PARALELO |
| 0660 | payment_splits | ❌ PARALELO |
| 0837 | event_revenue_split | ❌ PARALELO |

### 1.5 Documentos Normativos Existentes
- ✅ 01_SSOT.md
- ✅ 02_ACTORS_SSOT.md
- ✅ 04_CATEGORIES_SSOT.md
- ✅ SSOT_CONTRACT.md
- ✅ SSOT_EXCLUSIVE_BANK_RULE.md
- ✅ SSOT_PREFLIGHT.md
- ✅ PROHIBITED_STRUCTURES.md (completo e detalhado!)
- ❌ CONSTITUIÇÃO NÃO EXISTE como documento separado

---

## 2. ANÁLISE DOS DOIS CAMINHOS

### CAMINHO A: Incremental (corrigir 313 migrations)

**Prós:**
- Preserva histórico completo
- Menor risco de "esquecer" algo

**Contras:**
- 3-4 semanas de trabalho
- Precisa editar migrations antigas (viola forward-only)
- Mantém ledgers paralelos até serem removidos
- Complexidade de dependências entre migrations
- Alta chance de novos bugs aparecerem
- Cada correção pode quebrar outra coisa

**Risco:** Ciclo infinito de correções

---

### CAMINHO B: Rebase Constitucional (Genesis novo)

**Prós:**
- 5-7 dias de trabalho
- Genesis limpo e determinístico
- Forward-only desde o início
- Elimina TODA dívida histórica
- 313 migrations arquivadas (não deletadas)
- Começa com SSOT puro

**Contras:**
- Perde histórico de execução (não de código)
- Requer recriar algumas estruturas auxiliares

**Risco:** Esquecer alguma estrutura necessária (mitigável com auditoria)

---

## 3. FATOS OBJETIVOS

1. **Você NÃO tem produção** — nenhum dado real a preservar
2. **Você NÃO tem usuários** — nenhum downtime a evitar
3. **O Genesis já existe** — 0001 já tem as tabelas SSOT
4. **Ledgers paralelos existem** — violação ativa de SSOT
5. **PROHIBITED_STRUCTURES.md já documenta** — as regras já estão claras
6. **313 migrations** — complexidade acumulada impossível de auditar manualmente

---

## 4. DECISÃO RECOMENDADA

### ⚡ REBASE CONSTITUCIONAL (Caminho B)

**Motivo principal:** Você quer "nunca mais voltar". Isso só é possível com fundação limpa.

**Diferencial do seu caso:**
- O Genesis JÁ EXISTE (0001)
- Os docs normativos JÁ EXISTEM
- As regras JÁ ESTÃO DOCUMENTADAS
- Só falta EXECUTAR a ruptura

---

## 5. O QUE MUDA NO PLANO v7

O plano v7 que criei assume criar Genesis do zero. Mas analisando seu sistema:

**O 0001 existente já tem quase tudo!**

A diferença é:
1. Remover `IF NOT EXISTS` 
2. Adicionar campos faltantes (purpose, justification, etc.)
3. Adicionar triggers constitucionais
4. Adicionar ENUMs

**Opções:**

### Opção B1: Reescrever Genesis (plano v7 original)
- Criar 5 novos arquivos do zero
- Ignorar 0001 existente
- Mais trabalho mas mais limpo

### Opção B2: Evoluir Genesis existente (mais eficiente)
- Usar 0001 como base
- Corrigir problemas (IF NOT EXISTS, campos)
- Adicionar triggers/ENUMs
- Menos trabalho, mesmo resultado

---

## 6. PROMPT PARA IA GUARDIÃ (CURSOR)

Se você decidir pelo Rebase, aqui está o prompt para a IA do Cursor auditar:

```
MODO: GUARDIÃO (auditoria apenas, sem alterações)

TAREFA: Auditar 0001_schema_genesis_ssot.sql para conformidade com SSOT

CHECKLIST:
1. [ ] Todas as tabelas usam UUID PRIMARY KEY?
2. [ ] Nenhum IF NOT EXISTS em CREATE TABLE?
3. [ ] bank_ledger tem trigger append-only?
4. [ ] bank_transactions tem purpose obrigatório?
5. [ ] Existe ENUM transfer_purpose?
6. [ ] Existe ENUM credit_status?
7. [ ] bank_accounts tem campos: credit_status, last_activity_at?
8. [ ] Existe view system_coverage?
9. [ ] Existe trigger check_coverage_before_credit?
10. [ ] Existe trigger check_atl_before_transaction?

LEITURA OBRIGATÓRIA:
- docs/01_normative/PROHIBITED_STRUCTURES.md
- docs/01_normative/SSOT_CONTRACT.md
- docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md

OUTPUT: Relatório listando o que EXISTE vs o que FALTA
NÃO ALTERAR CÓDIGO. Apenas documentar.
```

---

## 7. PRÓXIMOS PASSOS (se decidir Rebase)

1. **AGORA:** Decidir entre B1 (reescrever) ou B2 (evoluir)
2. **FASE 0:** Criar tag `PRE_REBASE_FREEZE` no estado atual
3. **FASE 1:** Arquivar 313 migrations
4. **FASE 2:** Criar/corrigir Genesis
5. **FASE 3:** Rodar determinismo 3x
6. **FASE 4:** Ativar Lei 2

---

## 8. PERGUNTA FINAL PARA VOCÊ

Antes de criar o plano definitivo final, preciso saber:

**Opção B1 ou B2?**

- **B1:** Reescrever Genesis do zero (5 arquivos novos, ignora 0001)
- **B2:** Evoluir 0001 existente (corrigir + adicionar o que falta)

Minha recomendação: **B2** — o 0001 já tem 80% do que precisa.

---

FIM DO DIAGNÓSTICO
