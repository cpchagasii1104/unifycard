# 🎯 PROMPT PARA CURSOR — CORREÇÕES DO SPLIT ENGINE

Você está no monorepo **UnifiCard**.

---

## CONTEXTO

Auditoria identificou 3 gaps no Split Engine:
1. Referral não integrado ao UnifyWork
2. console.log em vez de devLog no referral
3. Grupos não resolvidos automaticamente

---

## TAREFA 1: CORRIGIR referral-split.service.ts (devLog)

Arquivo: `backend/src/core/economy/referral-split.service.ts`

### ADICIONAR import no topo:

```typescript
import { devLog } from '@utils/devLog';
```

### SUBSTITUIR todas as ocorrências de console.log/warn/error:

| Linha | De | Para |
|-------|----|----|
| 60 | `console.log('[ReferralSplitService] Processando split:', {...})` | `devLog.info('referral.split.processing', {...})` |
| 85 | `console.log('[ReferralSplitService] ℹ️ Usuário não foi indicado...')` | `devLog.info('referral.split.no_referrer', { sourceUserId, reason: 'Usuário não foi indicado' })` |
| 97 | `console.log('[ReferralSplitService] ℹ️ Valor do split < R$ 0,01...')` | `devLog.info('referral.split.too_small', { amountCents, splitAmountCents })` |
| 117 | `console.log('[ReferralSplitService] ℹ️ Split já existe...')` | `devLog.info('referral.split.duplicate', { transactionId, splitId: existingSplit.split_id })` |
| 162 | `console.error('[ReferralSplitService] ❌ Falha ao criar...')` | `devLog.error('referral.split.create_failed', { transactionId, sourceUserId })` |
| 169 | `console.log('[ReferralSplitService] ✅ Split de referral criado:')` | `devLog.success('referral.split.created', {...})` |

---

## TAREFA 2: INTEGRAR REFERRAL AO UNIFYWORK

Localizar o arquivo de pagamento de serviços. Provável:
- `backend/src/core/unifywork/payment.service.ts`
- ou `backend/src/core/economy/assignment-completion.service.ts`

### ADICIONAR import:

```typescript
import { referralSplitService } from '@core/economy/referral-split.service';
```

### ADICIONAR após confirmação de pagamento:

```typescript
// Processar split de referral (indicação)
try {
  // Buscar user_id do worker
  const workerResult = await runQueryWithTenant<{ user_id: string | null }>(
    tenantId,
    `SELECT user_id FROM actors WHERE actor_id = $1 AND tenant_id = $2 LIMIT 1`,
    [workerActorId, tenantId]
  );

  const workerUserId = workerResult?.user_id;
  if (workerUserId) {
    await referralSplitService.processReferralSplit({
      tenantId,
      transactionId,
      sourceUserId: workerUserId,
      amountCents: totalAmountCents,
      percentageBps: 500, // 5% de comissão para indicador
      metadata: {
        type: 'service_payment',
        jobId,
        assignmentId,
      },
    });
  }
} catch (err) {
  // Não falha o pagamento se split falhar
  devLog.warn('referral.split.service_payment_error', { 
    error: err instanceof Error ? err.message : String(err) 
  });
}
```

---

## TAREFA 3: RESOLVER GRUPOS AUTOMATICAMENTE

Localizar onde `splitEngineService.applySplits()` é chamado.

### ANTES de applySplits, adicionar:

```typescript
import { groupAccountService } from '@core/economy/group-account.service';

// Resolver grupos do usuário pagador
const groupAccountIds = await groupAccountService.resolveGroupAccountIds({
  tenantId,
  userId: payerUserId, // ou buyerUserId
});

// Adicionar ao contexto
const context: SplitContext = {
  tenantId,
  amount,
  currency: 'BRL',
  source: 'service', // ou 'event_ticket'
  customerAccountId,
  workerAccountId,
  tenantAccountId,
  regionAccountId,
  groupAccountIds, // ← ADICIONAR ISSO
  metadata: { ... },
};

await splitEngineService.applySplits(context);
```

---

## VALIDAÇÃO

### Teste 1: Referral em serviço

1. Usuário A indica Usuário B (criar vínculo)
2. Usuário B presta serviço para Usuário C
3. C paga B
4. Verificar: `SELECT * FROM ledger_referral_splits WHERE source_user_id = 'B_user_id'`
5. Esperado: A recebe 5% de comissão

### Teste 2: Grupos recebem split

1. Usuário C está em Grupo X
2. C contrata serviço
3. Verificar: Grupo X recebeu 5% do valor
4. SQL: `SELECT * FROM group_accounts WHERE group_id = 'X'`

### Teste 3: devLog funciona

1. Executar transação
2. Verificar logs: `[DEV:referral.split.*]` aparecem
3. Em produção: logs não aparecem

---

## 🚨 NÃO FAZER

- NÃO alterar percentuais (70/15/10/5)
- NÃO criar nova tabela
- NÃO modificar Split Engine principal
- NÃO usar console.log

---

*Prompt baseado em auditoria — Claude — 02/01/2026*
