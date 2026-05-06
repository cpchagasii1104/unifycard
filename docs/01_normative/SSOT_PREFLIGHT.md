# SSOT PREFLIGHT

## STATUS: CANÔNICO · OBRIGATÓRIO · BLOQUEANTE

---

## 1. FINALIDADE

Este documento define as **verificações obrigatórias de pré-execução**
antes de qualquer:

- migration
- alteração de backend
- execução de plano estrutural
- saneamento sistêmico

Nenhum plano pode ser executado sem que este preflight esteja **100% satisfeito**.

---

## 2. PRINCÍPIO FUNDAMENTAL

> **Nenhuma execução é válida se o estado real do sistema
> não corresponder exatamente ao que o plano assume.**

Assumir existência de:
- tabelas
- colunas
- arquivos
- documentos normativos

sem verificação explícita é **violação de governança**.

---

## 3. CHECKS OBRIGATÓRIOS (ANTES DE QUALQUER BLOCO)

### 3.1 Verificação de Documentos Normativos

Confirmar existência dos seguintes arquivos:

- `docs/01_normative/00_AGENT_PROTOCOL.md`
- `docs/01_normative/01_SSOT.md`
- `docs/01_normative/AUTHORITY_LAW.md`
- `docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md`
- `docs/01_normative/SSOT_CONTRACT.md`
- `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`
- `docs/01_normative/PROHIBITED_STRUCTURES.md`
- `docs/01_normative/SSOT_PREFLIGHT.md`

❌ Ausência de qualquer um → **EXECUÇÃO BLOQUEADA**

---

### 3.2 Verificação de Artefatos de CI

Confirmar existência e ativação de:

- `.github/workflows/ssot-check.yml`

O workflow deve:
- estar versionado
- estar ativo
- bloquear violações de SSOT

❌ Ausente ou desativado → **EXECUÇÃO BLOQUEADA**

---

### 3.3 Verificação de Estruturas de Banco (READ-ONLY)

Antes de executar qualquer migration, confirmar a existência das
estruturas **assumidas pelo plano**:

#### Tabelas mínimas esperadas

- `bank_transactions`
- `bank_ledger`
- `bank_accounts`
- `actors`
- `tenants`

#### Colunas mínimas esperadas

- `bank_transactions.settled_at` *(se referenciada para migração)*
- `actors.actor_id`
- `actors.tenant_id`

❌ Divergência entre plano e banco → **EXECUÇÃO BLOQUEADA**

⚠️ Esta verificação é **somente leitura**.
Nenhuma alteração é permitida nesta fase.

---

### 3.4 Verificação de Estruturas de Autoridade

Se o plano mencionar qualquer lógica de autoridade, verificar:

- existência da tabela `authority_trust_levels`
- existência da coluna `trust_level`
- relacionamento com `actors`

❌ Estrutura ausente → **EXECUÇÃO BLOQUEADA**

---

## 4. DECLARAÇÃO DE ESTADO DE EXECUÇÃO

Antes de iniciar um plano, deve existir uma declaração explícita de estado:

```text
ESTADO DE EXECUÇÃO:
- BLOCO 0: NÃO EXECUTADO
- BLOCO 1: NÃO EXECUTADO
- BLOCO 2: NÃO EXECUTADO
- ...

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
<!-- AUTO-GENERATED-END -->