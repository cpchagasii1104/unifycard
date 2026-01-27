# Core Financeiro — Invariantes e Travas Institucionais

**Status:** CANÔNICO · BINDING · CORE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)

---

## DEFINIÇÃO

O **Core Financeiro** do UnifiCard é composto por:

- **Tabela canônica de contas:** `accounts`
- **Tabela canônica de transações:** `transactions`
- **Tabela canônica de ledger:** `ledger`

Estas são as **ÚNICAS** fontes de verdade financeira. Nenhuma outra estrutura pode assumir este papel.

---

## INVARIANTES ABSOLUTOS

### 1. Tabela Canônica de Contas

**Regra:** `accounts` é a única tabela canônica de contas.

**Proibições:**
- ❌ NÃO criar nova tabela de contas
- ❌ NÃO usar `bank_accounts` em código novo (é legado)
- ❌ NÃO criar tabela paralela de contas

**Verificação:**
```bash
npm run check:financial-core
```

---

### 2. Ownership Explícito

**Regra:** Toda conta tem ownership explícito via `owner_id` e `owner_type`.

**Invariantes:**
- `accounts.owner_id` NUNCA é NULL
- `accounts.owner_type` NUNCA é NULL
- `owner_type` deve ser um dos valores permitidos: `'user'`, `'merchant'`, `'platform_ops'`, `'group'`, `'community_fund'`

**Verificação:**
```bash
npm run check:financial-invariants
```

---

### 3. Conta Platform Ops

**Regra:** Existe exatamente uma conta `platform_ops` por tenant.

**Invariantes:**
- Cada tenant tem exatamente 1 conta com `owner_type = 'platform_ops'`
- `owner_id` da conta `platform_ops` = `tenant_id`
- `currency` = `'BRL'` (padrão)

**Bootstrap:**
```bash
npm run seed:financial [tenant_id]
```

**Verificação:**
```bash
npm run check:financial-invariants
```

---

### 4. Transações Referenciam Accounts

**Regra:** Toda transação referencia `accounts.account_id` válido.

**Invariantes:**
- `transactions.from_account` referencia `accounts.account_id` (ou é NULL para depósitos externos)
- `transactions.to_account` referencia `accounts.account_id` (sempre presente)
- Não pode existir transação com `account_id` inexistente

**Verificação:**
```bash
npm run check:financial-invariants
```

---

### 5. Ledger Canônico

**Regra:** `ledger` é a tabela canônica de ledger (referencia `accounts`).

**Proibições:**
- ❌ NÃO criar nova tabela de ledger
- ❌ NÃO usar `bank_ledger` em código novo (é legado)
- ❌ NÃO criar tabela paralela de ledger

**Verificação:**
```bash
npm run check:financial-core
```

---

## CHECKLIST OBRIGATÓRIO ANTES DE MIGRATIONS

Antes de criar qualquer migration que toque em finanças:

- [ ] Verificar se não está criando nova tabela de contas
- [ ] Verificar se não está criando nova tabela de ledger
- [ ] Verificar se não está usando `bank_accounts` (usar `accounts`)
- [ ] Verificar se `owner_id` e `owner_type` são NOT NULL
- [ ] Verificar se transações referenciam `accounts.account_id`
- [ ] Rodar `npm run check:financial-core` antes de commitar
- [ ] Rodar `npm run check:financial-invariants` após migration

---

## VIOLAÇÕES GRAVES

São consideradas **violações graves** (bloqueiam merge):

1. **Criar tabela paralela de contas**
   - Exemplo: `CREATE TABLE my_accounts`
   - **Bloqueio:** Automático via `check:financial-core`

2. **Criar tabela paralela de ledger**
   - Exemplo: `CREATE TABLE my_ledger`
   - **Bloqueio:** Automático via `check:financial-core`

3. **Usar `bank_accounts` em código novo**
   - Exemplo: `SELECT * FROM bank_accounts`
   - **Bloqueio:** Automático via `check:financial-core`

4. **`owner_id` ou `owner_type` NULL em `accounts`**
   - **Bloqueio:** Automático via `check:financial-invariants`

5. **Mais de uma conta `platform_ops` por tenant**
   - **Bloqueio:** Automático via `check:financial-invariants`

6. **Transação referencia `account_id` inexistente**
   - **Bloqueio:** Automático via `check:financial-invariants`

---

## COMANDOS DE VERIFICAÇÃO

### Verificação Estrutural (Código)
```bash
npm run check:financial-core
```
Verifica:
- Nenhum código novo usa `bank_accounts`
- Nenhuma migration nova cria tabela de contas/ledger
- Padrões proibidos no código

### Verificação de Invariantes (Banco)
```bash
npm run check:financial-invariants [tenant_id]
```
Verifica:
- `owner_id` e `owner_type` nunca são NULL
- Exatamente uma conta `platform_ops` por tenant
- Transações sempre referenciam `accounts.account_id` válido

### Bootstrap Financeiro
```bash
npm run seed:financial [tenant_id]
```
Cria conta `platform_ops` se não existir (idempotente).

---

## ESTADO VÁLIDO: BANCO VAZIO

**Regra:** Banco vazio é um estado válido.

**Implicações:**
- Auditorias nunca falham por ausência de dados
- Verificações de invariantes tratam tabelas inexistentes como OK
- Scripts de bootstrap podem criar estruturas necessárias

**Exemplo:**
```typescript
// ✅ CORRETO: Tratamento defensivo
const result = await runQueryWithTenant(...);
const count = result ? parseInt(result.count ?? '0', 10) : 0;

// ❌ ERRADO: Assume que sempre há dados
const count = parseInt(result.count, 10); // Pode quebrar se result for undefined
```

---

## DOCUMENTOS CANÔNICOS RELACIONADOS

- `CORE_IMUTAVEL.md` — Core Imutável do sistema
- `MATRIZ_FONTES_DE_VERDADE.md` — Fontes canônicas
- `IDENTITY_CORE_CONTRACT.md` — Core de Identidade (Actor)

---

## AUTORIDADE

Este documento tem autoridade:
- **CANÔNICA** — Define a verdade institucional
- **OPERACIONAL** — Bloqueia violações automaticamente
- **BLOQUEANTE** — Impede regressões

Qualquer violação é uma **violação institucional** e deve ser bloqueada antes de merge.

---

**Última atualização:** 2026-01-XX  
**Versão:** 1.0


