# 📊 Métricas Prioritárias — Validação Financeira (Fase 9)

## 🎯 Objetivo

Detectar rapidamente qualquer risco real no sistema financeiro, usando **3 queries-chave**.

**Regra de ouro:** Se essas 3 estiverem OK, 99% do risco estrutural está coberto.

---

## 🔴 MÉTRICA 1 — Ledger Desbalanceado (CRÍTICA)

### Query (Pronta para copiar/colar):

```sql
-- Verificar se há transações com ledger desbalanceado
SELECT 
  t.transaction_id,
  t.tenant_id,
  t.amount,
  t.created_at,
  SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE 0 END) as total_credits,
  ABS(SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount ELSE 0 END) - 
      SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE 0 END)) as difference
FROM transactions t
JOIN ledger l ON l.transaction_id = t.transaction_id
WHERE t.created_at >= NOW() - INTERVAL '24 hours'  -- Últimas 24h
GROUP BY t.transaction_id, t.tenant_id, t.amount, t.created_at
HAVING ABS(SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount ELSE 0 END) - 
           SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE 0 END)) > 0.01
ORDER BY t.created_at DESC;
```

### O que significa:

Verifica se alguma transação não fecha matematicamente (débitos ≠ créditos).

### Interpretação:

- ✅ **0 linhas** → Sistema íntegro
- ❌ **≥1 linha** → **ALERTA MÁXIMO**
  - Bug crítico
  - Possível corrupção de dados
  - Precisa investigação imediata

### Quando se preocupar:

👉 **Sempre.**  
Isso nunca deveria acontecer após a Fase 9.

### Ação imediata se falhar:

1. Parar novas transações (se possível)
2. Investigar a transação específica
3. Verificar logs do momento da criação
4. Corrigir causa raiz antes de continuar

---

## 🔴 MÉTRICA 2 — Saldo Negativo (CRÍTICA)

### Query (Pronta para copiar/colar):

```sql
-- Verificar contas de usuário com saldo negativo
SELECT 
  a.account_id,
  a.tenant_id,
  a.owner_id,
  a.owner_type,
  a.balance,
  a.currency,
  a.created_at
FROM accounts a
WHERE a.owner_type = 'user'  -- Contas de usuário
  AND a.balance < 0
ORDER BY a.balance ASC;
```

### O que significa:

Detecta usuários com saldo abaixo de zero (não permitido no MVP).

### Interpretação:

- ✅ **0 linhas** → Correto
- ❌ **≥1 linha** → **Erro grave**
  - Alguma validação falhou
  - Possível corrida de concorrência antiga
  - Invariante não está funcionando

### Quando se preocupar:

👉 **Sempre.**  
Saldo negativo não é permitido no MVP.

### Ação imediata se falhar:

1. Identificar a conta afetada
2. Verificar histórico de transações
3. Corrigir saldo (se legítimo) ou investigar fraude
4. Verificar por que o invariante não bloqueou

---

## 🟡 MÉTRICA 3 — Idempotência Violada (IMPORTANTE)

### Query (Pronta para copiar/colar):

```sql
-- Verificar se há eventIds duplicados com payloads diferentes
SELECT 
  event_id,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT transaction_id) as unique_transactions,
  COUNT(DISTINCT amount) as distinct_amounts,
  COUNT(DISTINCT from_account) as distinct_from_accounts,
  COUNT(DISTINCT to_account) as distinct_to_accounts,
  ARRAY_AGG(DISTINCT transaction_id) as transaction_ids,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM transactions
WHERE created_at >= NOW() - INTERVAL '24 hours'  -- Últimas 24h
GROUP BY event_id
HAVING COUNT(*) > 1
  AND (
    COUNT(DISTINCT amount) > 1 
    OR COUNT(DISTINCT from_account) > 1 
    OR COUNT(DISTINCT to_account) > 1
  )
ORDER BY transaction_count DESC;
```

### O que significa:

Verifica se o mesmo `eventId` gerou mais de uma transação **com payload diferente** (violação de idempotência).

**Nota:** Se o mesmo `eventId` gerar a mesma transação (mesmo `transaction_id`), isso é **correto** (idempotência funcionando).

### Interpretação:

- ✅ **0 linhas** → Idempotência perfeita
- ⚠️ **≥1 linha** → 
  - Pode ser dado legado (antes do hardening)
  - Ou bug de concorrência antigo
  - Ou tentativa de ataque

### Quando se preocupar:

- **Se eventos recentes aparecerem** → Investigar imediatamente
- **Se forem muito antigos** → Documentar e seguir (provavelmente legado)

### Ação se falhar:

1. Verificar data das transações
2. Se recente: investigar logs e padrão
3. Se antigo: documentar e monitorar

---

## 🧭 Ordem Recomendada de Execução

1. **Métrica 1 (Ledger Balanceado)**
   - → Se falhar, **pare tudo**

2. **Métrica 2 (Saldo Negativo)**
   - → Se falhar, **pare tudo**

3. **Métrica 3 (Idempotência)**
   - → Avaliar contexto/idade dos dados

---

## ✅ Baseline Esperado (Pós-Fase 9)

| Métrica | Resultado Esperado |
|---------|-------------------|
| Ledger desbalanceado | **0 linhas** |
| Saldo negativo | **0 linhas** |
| EventId duplicado (payload diferente) | **0 linhas recentes** |

### Se isso for verdade, você pode afirmar com segurança:

> **"O sistema financeiro é matematicamente consistente e protegido contra concorrência."**

---

## 🧠 O Que Ignorar (Por Enquanto)

Estes são **sinais de proteção funcionando**, não problemas:

- ✅ **Tentativas de saldo negativo bloqueadas** (logs, não dados)
- ✅ **Rejeições por idempotência** (usuário clicando duas vezes)
- ✅ **Erros explícitos de região inexistente** (comportamento correto)

Esses eventos aparecem nos **logs** como avisos, mas não indicam corrupção de dados.

---

## 📊 Query de Resumo Rápido (Todas as 3 de uma vez)

```sql
-- RESUMO GERAL DE SAÚDE (Últimas 24h)
SELECT 
  'Ledger Desbalanceado' as metric,
  COUNT(DISTINCT t.transaction_id)::text as violations
FROM transactions t
JOIN ledger l ON l.transaction_id = t.transaction_id
WHERE t.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY t.transaction_id
HAVING ABS(SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount ELSE 0 END) - 
           SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE 0 END)) > 0.01

UNION ALL

SELECT 
  'Saldo Negativo' as metric,
  COUNT(*)::text as violations
FROM accounts
WHERE owner_type = 'user'
  AND balance < 0

UNION ALL

SELECT 
  'Idempotência Violada' as metric,
  COUNT(*)::text as violations
FROM (
  SELECT event_id
  FROM transactions
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY event_id
  HAVING COUNT(*) > 1
    AND (
      COUNT(DISTINCT amount) > 1 
      OR COUNT(DISTINCT from_account) > 1 
      OR COUNT(DISTINCT to_account) > 1
    )
) as violations;
```

**Resultado esperado:**
```
metric                  | violations
------------------------|------------
Ledger Desbalanceado    | 0
Saldo Negativo          | 0
Idempotência Violada    | 0
```

---

## ▶️ Próximo Passo Após Isso

Depois de rodar essas 3 queries:

- ✅ **Se tudo OK** → Seguir para Etapa 2 (Hardening Avançado)
- ❌ **Se algo aparecer** → Focar exatamente naquele ponto, sem achismo

---

## 📝 Checklist de Validação Rápida

- [ ] Métrica 1 executada → 0 violações
- [ ] Métrica 2 executada → 0 violações
- [ ] Métrica 3 executada → 0 violações recentes
- [ ] Baseline confirmado
- [ ] Pronto para Etapa 2

---

**Última atualização:** Fase 9 Etapa 1 - Hardening Financeiro




























