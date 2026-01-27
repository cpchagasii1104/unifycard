# Guia de Validação Prática - Fase 9 Etapa 1

## 🎯 Objetivo

Validar que os invariantes financeiros estão funcionando corretamente em produção/staging e medir o impacto real.

---

## ✅ PASSO 1: Executar Testes 3x (Anti-Flaky)

### Como executar:

```bash
cd backend
npx jest tests/integration/financial-hardening.test.ts --runInBand
```

**Repetir 3 vezes seguidas.**

### O que observar:

- ✅ **Todos os testes passam nas 3 execuções?**
  - Se falhar 1x, pode ser timing/lock
  - Se falhar sempre, há bug real

- ✅ **Tempo de execução é consistente?**
  - Testes de concorrência (50 threads) devem levar ~2-5s
  - Se variar muito (>10s), pode indicar deadlock ou lock contention

- ✅ **Nenhum erro de "Cannot redeclare variable" ou similar?**
  - Indica problema de compilação/escopo

### Critério de sucesso:

**3 execuções = 3 passos completos, sem falhas.**

Se passar, você tem confiança de que:
- Invariantes funcionam sob stress
- Não há race conditions
- Idempotência é real

---

## 📊 PASSO 2: Observar Invariantes em Ação

### O que adicionar nos logs:

Os invariantes já lançam erros, mas você precisa **rastrear quantas vezes eles são acionados**.

#### 2.1 - Invariante 1: Double-Entry Balanceado

**Onde observar:**
- `transaction.service.ts` linha ~223

**O que logar:**
```typescript
// ANTES do throw (se houver violação)
console.error('[INVARIANT_VIOLATION]', {
  type: 'DOUBLE_ENTRY_UNBALANCED',
  transactionId,
  totalDebits,
  totalCredits,
  difference: Math.abs(totalDebits - totalCredits),
  timestamp: new Date().toISOString()
});
```

**O que esperar em produção:**
- **0 ocorrências** = sistema está correto
- **> 0 ocorrências** = BUG CRÍTICO (investigar imediatamente)

---

#### 2.2 - Invariante 2: Saldo Não-Negativo

**Onde observar:**
- `transaction.service.ts` linha ~198
- `split-engine.service.ts` linha ~207
- `regional-fund-governance.service.ts` linha ~536

**O que logar:**
```typescript
console.warn('[INVARIANT_BLOCKED]', {
  type: 'NEGATIVE_BALANCE_PREVENTED',
  accountId: fromAccount,
  currentBalance: fromBalance,
  attemptedAmount: amount,
  wouldResultIn: newFromBalance,
  operation: 'transfer' | 'split' | 'governance',
  timestamp: new Date().toISOString()
});
```

**O que esperar em produção:**
- **Algumas ocorrências** = normal (usuários tentando transferir mais do que têm)
- **Muitas ocorrências do mesmo usuário** = possível fraude ou bug no frontend
- **Padrão suspeito** = investigar

**Métrica útil:**
- Taxa de bloqueio por tipo de operação
- Top 10 usuários com mais tentativas bloqueadas

---

#### 2.3 - Invariante 3: Idempotência Absoluta

**Onde observar:**
- `transaction.service.ts` linha ~103

**O que logar:**
```typescript
console.warn('[IDEMPOTENCY_VIOLATION]', {
  eventId,
  existingTransactionId,
  existingPayload: {
    amount: existingRow.amount,
    fromAccount: existingRow.from_account,
    toAccount: existingRow.to_account
  },
  newPayload: {
    amount,
    fromAccount,
    toAccount
  },
  timestamp: new Date().toISOString()
});
```

**O que esperar em produção:**
- **0 ocorrências** = ideal (retries funcionam corretamente)
- **Algumas ocorrências** = pode ser bug no frontend (duplo clique sem eventId)
- **Muitas ocorrências** = possível ataque ou bug crítico

**Métrica útil:**
- Taxa de violações por endpoint
- IPs/usuários com mais violações

---

#### 2.4 - Invariante 4: Split Invariants

**Onde observar:**
- `split-engine.service.ts` linha ~510

**O que logar:**
```typescript
// Se houver violação (não deve acontecer)
console.error('[INVARIANT_VIOLATION]', {
  type: 'SPLIT_SUM_MISMATCH',
  baseTransactionId,
  baseAmount,
  totalSplitAmount: finalTotal,
  difference: Math.abs(finalTotal - amount),
  splitConfigs: splitConfigs.map(c => ({ targetType: c.rule.targetType, amount: c.amount })),
  timestamp: new Date().toISOString()
});
```

**O que esperar em produção:**
- **0 ocorrências** = sistema está correto
- **> 0 ocorrências** = BUG CRÍTICO (investigar imediatamente)

---

#### 2.5 - Regra Global: Zero Fallback Silencioso

**Onde observar:**
- `region-account.service.ts` linha ~88

**O que logar:**
```typescript
// Quando região não é encontrada em produção
console.error('[REGION_RESOLUTION_FAILED]', {
  tenantId,
  userId: userId || null,
  jobId: jobId || null,
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});
```

**O que esperar em produção:**
- **0 ocorrências** = todos os tenants têm cityId configurado
- **Algumas ocorrências** = alguns tenants precisam configurar cityId
- **Muitas ocorrências** = problema de onboarding/configuração

---

## ⏱️ PASSO 3: Medir Impacto de Performance

### 3.1 - Métricas por Transação

Adicionar timing nas operações críticas:

```typescript
// Em transaction.service.ts, transfer()
const startTime = Date.now();

// ... código da transação ...

const duration = Date.now() - startTime;

console.log('[TRANSACTION_PERFORMANCE]', {
  operation: 'transfer',
  durationMs: duration,
  hasInvariants: true,
  eventId,
  timestamp: new Date().toISOString()
});
```

**O que medir:**
- Tempo médio de transação (antes vs depois dos invariantes)
- P95 e P99 (percentis)
- Impacto dos invariantes (~10-50ms por transação é aceitável)

**Baseline esperado:**
- Transação simples: 50-150ms
- Com invariantes: 60-200ms
- Se passar de 500ms, investigar

---

### 3.2 - Métricas de Concorrência

**Teste prático:**

```bash
# Simular 50 requisições simultâneas
for i in {1..50}; do
  curl -X POST http://localhost:3000/bank/p2p-transfer \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"toUserId":"...","amount":10,"eventId":"same-event-id"}' &
done
wait
```

**O que observar:**
- Todas retornam mesma `transactionId`?
- Tempo total de resposta
- Nenhum erro 500?

---

### 3.3 - Queries SQL Adicionais dos Invariantes

**Invariante 1 (Double-Entry):**
```sql
-- Adiciona ~5-10ms por transação
SELECT 
  COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
  COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) as total_credits
FROM ledger
WHERE transaction_id = $1
```

**Invariante 2 (Saldo Não-Negativo):**
```sql
-- Adiciona ~3-5ms por transação
SELECT account_id, balance, owner_type
FROM accounts
WHERE account_id IN ($1, $2)
  AND owner_type = 'user'
  AND balance < 0
```

**Custo total estimado:**
- **8-15ms por transação** (aceitável para garantia de correção)

---

## 📈 Dashboard Recomendado (Futuro)

### Métricas para monitorar:

1. **Taxa de bloqueios por invariante**
   - Invariante 2 (saldo negativo): normal ter alguns
   - Outros: deve ser 0

2. **Tempo médio de transação**
   - Baseline: 50-150ms
   - Com invariantes: 60-200ms
   - Alerta se > 500ms

3. **Taxa de idempotência**
   - Retries legítimos: normal
   - Violações: investigar

4. **Taxa de resolução de região**
   - Falhas em produção: 0 esperado
   - Se > 0: problema de configuração

---

## ✅ Checklist de Validação Completa

- [ ] Testes executados 3x, todos passaram
- [ ] Logs de invariantes configurados
- [ ] Observação de 24-48h em staging/produção
- [ ] Métricas de performance coletadas
- [ ] Nenhuma violação crítica detectada
- [ ] Impacto de performance aceitável (< 20% de overhead)
- [ ] Documentação atualizada com baseline

---

## 🚨 Sinais de Alerta (Investigar Imediatamente)

1. **Invariante 1 violado** (double-entry desbalanceado)
   - BUG CRÍTICO
   - Parar sistema se necessário
   - Investigar causa raiz

2. **Invariante 4 violado** (split não fecha)
   - BUG CRÍTICO
   - Parar splits até corrigir

3. **Performance degradada > 50%**
   - Investigar queries dos invariantes
   - Verificar índices
   - Considerar otimização

4. **Muitas violações de idempotência**
   - Possível ataque ou bug no frontend
   - Investigar padrão

---

## 📝 Próximos Passos

Após validação bem-sucedida:

1. ✅ **Etapa 2 do Hardening** (rate limits, circuit breakers)
2. ✅ **Documentação de confiança** (para investidores/parceiros)
3. ✅ **Monitoramento contínuo** (alertas automáticos)

---

**Última atualização:** Fase 9 Etapa 1 - Hardening Financeiro




























