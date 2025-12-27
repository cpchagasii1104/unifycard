-- Queries SQL para Validação dos Invariantes
-- Fase 9 Etapa 1 - Hardening Financeiro

-- ==========================================
-- INVARIANTE 1: Double-Entry Balanceado
-- ==========================================
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
WHERE t.tenant_id = $1  -- Substituir por tenant_id específico ou remover para todos
  AND t.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY t.transaction_id, t.tenant_id, t.amount, t.created_at
HAVING ABS(SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount ELSE 0 END) - 
           SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE 0 END)) > 0.01
ORDER BY t.created_at DESC;

-- Resultado esperado: 0 linhas
-- Se houver linhas = BUG CRÍTICO


-- ==========================================
-- INVARIANTE 2: Saldo Não-Negativo
-- ==========================================
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
WHERE a.owner_type = 'user'
  AND a.balance < 0
  AND a.tenant_id = $1  -- Opcional: filtrar por tenant
ORDER BY a.balance ASC;

-- Resultado esperado: 0 linhas
-- Se houver linhas = BUG CRÍTICO (invariante não está funcionando)


-- ==========================================
-- INVARIANTE 3: Idempotência
-- ==========================================
-- Verificar se há eventIds duplicados com payloads diferentes
-- (Isso não deveria existir, mas vamos verificar)
SELECT 
  event_id,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT amount) as distinct_amounts,
  COUNT(DISTINCT from_account) as distinct_from_accounts,
  COUNT(DISTINCT to_account) as distinct_to_accounts,
  ARRAY_AGG(transaction_id) as transaction_ids
FROM transactions
WHERE tenant_id = $1
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_id
HAVING COUNT(*) > 1
  AND (
    COUNT(DISTINCT amount) > 1 
    OR COUNT(DISTINCT from_account) > 1 
    OR COUNT(DISTINCT to_account) > 1
  )
ORDER BY transaction_count DESC;

-- Resultado esperado: 0 linhas
-- Se houver linhas = BUG CRÍTICO (idempotência violada)


-- ==========================================
-- INVARIANTE 4: Split Invariants
-- ==========================================
-- Verificar se splits somam exatamente o valor base
WITH base_transactions AS (
  SELECT 
    t.transaction_id as base_transaction_id,
    t.amount as base_amount,
    t.tenant_id
  FROM transactions t
  WHERE t.metadata->>'type' = 'donation'
    AND t.tenant_id = $1
    AND t.created_at >= NOW() - INTERVAL '24 hours'
),
split_totals AS (
  SELECT 
    st.transaction_id as base_transaction_id,
    st.amount as base_amount,
    st.tenant_id,
    SUM(CAST(split_t.amount AS NUMERIC)) as total_split_amount,
    ABS(st.amount - SUM(CAST(split_t.amount AS NUMERIC))) as difference
  FROM base_transactions st
  JOIN transactions split_t ON 
    split_t.metadata->>'originTransactionId' = st.base_transaction_id
    AND split_t.metadata->>'type' = 'split'
    AND split_t.tenant_id = st.tenant_id
  GROUP BY st.transaction_id, st.amount, st.tenant_id
)
SELECT 
  base_transaction_id,
  base_amount,
  total_split_amount,
  difference
FROM split_totals
WHERE difference > 0.01
ORDER BY difference DESC;

-- Resultado esperado: 0 linhas
-- Se houver linhas = BUG CRÍTICO (split não fecha)


-- ==========================================
-- MÉTRICAS DE PERFORMANCE
-- ==========================================
-- Tempo médio de transação (se você tiver coluna created_at e updated_at)
-- Ou usar logs de aplicação

-- Contagem de transações por hora
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as transaction_count,
  AVG(CAST(amount AS NUMERIC)) as avg_amount,
  SUM(CAST(amount AS NUMERIC)) as total_amount
FROM transactions
WHERE tenant_id = $1
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;


-- ==========================================
-- DETECÇÃO DE PADRÕES SUSPEITOS
-- ==========================================
-- Usuários com muitas tentativas de saldo negativo bloqueadas
-- (Precisa de logs estruturados, mas aqui está a query base)

-- Top 10 usuários por número de transações
SELECT 
  a.owner_id as user_id,
  COUNT(*) as transaction_count,
  SUM(CAST(t.amount AS NUMERIC)) as total_transferred,
  AVG(CAST(t.amount AS NUMERIC)) as avg_amount
FROM transactions t
JOIN accounts a ON a.account_id = t.from_account
WHERE a.owner_type = 'user'
  AND t.tenant_id = $1
  AND t.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY a.owner_id
ORDER BY transaction_count DESC
LIMIT 10;


-- ==========================================
-- VALIDAÇÃO DE CONCORRÊNCIA
-- ==========================================
-- Verificar se há transações com mesmo eventId (deve ser idempotente)
SELECT 
  event_id,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT transaction_id) as unique_transactions,
  ARRAY_AGG(DISTINCT transaction_id) as transaction_ids,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM transactions
WHERE tenant_id = $1
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_id
HAVING COUNT(*) > 1
ORDER BY transaction_count DESC;

-- Resultado esperado: 
-- Se event_id duplicado, deve ter apenas 1 transaction_id (idempotência funcionando)
-- Se houver transaction_ids diferentes para mesmo event_id = BUG


-- ==========================================
-- RESUMO GERAL DE SAÚDE
-- ==========================================
SELECT 
  'Total Transactions (24h)' as metric,
  COUNT(*)::text as value
FROM transactions
WHERE tenant_id = $1
  AND created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Negative Balance Accounts' as metric,
  COUNT(*)::text as value
FROM accounts
WHERE owner_type = 'user'
  AND balance < 0
  AND tenant_id = $1

UNION ALL

SELECT 
  'Unbalanced Transactions' as metric,
  COUNT(DISTINCT t.transaction_id)::text as value
FROM transactions t
JOIN ledger l ON l.transaction_id = t.transaction_id
WHERE t.tenant_id = $1
  AND t.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY t.transaction_id
HAVING ABS(SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount ELSE 0 END) - 
           SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE 0 END)) > 0.01;















