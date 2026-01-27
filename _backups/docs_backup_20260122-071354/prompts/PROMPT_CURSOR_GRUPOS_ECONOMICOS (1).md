# 🎯 PROMPT PARA CURSOR — GRUPOS ECONÔMICOS

Você está no monorepo **UnifiCard**.

---

## ⚠️ PRÉ-REQUISITO OBRIGATÓRIO

**NÃO EXECUTE ESTE PROMPT** antes de concluir `PROMPT_CURSOR_SPLIT_CORRECOES.md`.

Verificar se:
- [ ] `referral-split.service.ts` usa `devLog`
- [ ] Referral integrado ao UnifyWork
- [ ] Grupos resolvidos automaticamente no split

Se algum item acima não estiver feito, **PARE e execute primeiro**.

---

## CONTEXTO

O sistema de grupos já existe estruturalmente:
- Tabela `groups` ✔️
- Tabela `group_members` ✔️
- Tabela `group_accounts` ✔️
- Limite de 3 grupos por usuário ✔️
- `groupAccountService` ✔️

O que falta é **fechar o ciclo econômico**:
- Grupo receber split automaticamente
- Grupo aparecer no ledger
- Grupo exibir impacto no feed

---

## REGRA INVIOLÁVEL

> **Grupo sem conta econômica NÃO EXISTE no sistema.**

Se um grupo for criado sem `group_accounts`, ele é apenas decoração.

---

## TAREFA 1: GARANTIR CONTA AO CRIAR GRUPO

Arquivo: `backend/src/modules/groups/groups.service.ts`

### LOCALIZAR método de criação de grupo (createGroup ou similar)

### ADICIONAR após criação do grupo:

```typescript
import { groupAccountService } from '@core/economy/group-account.service';
import { devLog } from '@utils/devLog';

// Após INSERT em groups:

// Criar conta econômica para o grupo (OBRIGATÓRIO)
try {
  const accountId = await groupAccountService.createOrGetGroupAccount(
    tenantId,
    groupId
  );
  
  devLog.success('group.account.created', {
    groupId,
    accountId,
    tenantId,
  });
} catch (err) {
  devLog.error('group.account.creation_failed', {
    groupId,
    tenantId,
    error: err instanceof Error ? err.message : String(err),
  });
  
  // CRÍTICO: Grupo sem conta é inválido
  // Opção 1: Reverter criação do grupo
  // Opção 2: Marcar como incompleto
  throw new Error(`Grupo criado mas conta falhou: ${groupId}`);
}
```

---

## TAREFA 2: VALIDAR GRUPOS EXISTENTES SEM CONTA

### Criar script de migração de dados:

Arquivo: `backend/scripts/fix-groups-without-accounts.ts`

```typescript
// Script para criar contas para grupos que não têm

import { pool } from '@core/database/pool';
import { groupAccountService } from '@core/economy/group-account.service';

async function fixGroupsWithoutAccounts() {
  console.log('🔍 Buscando grupos sem conta...');
  
  const result = await pool.query(`
    SELECT g.group_id, g.tenant_id, g.name
    FROM groups g
    LEFT JOIN group_accounts ga ON ga.group_id = g.group_id
    WHERE ga.group_id IS NULL
      AND g.is_active = true
  `);
  
  console.log(`📊 Encontrados ${result.rows.length} grupos sem conta`);
  
  for (const group of result.rows) {
    try {
      const accountId = await groupAccountService.createOrGetGroupAccount(
        group.tenant_id,
        group.group_id
      );
      console.log(`✅ Conta criada para grupo "${group.name}": ${accountId}`);
    } catch (err) {
      console.error(`❌ Erro ao criar conta para grupo "${group.name}":`, err);
    }
  }
  
  console.log('🏁 Concluído');
}

fixGroupsWithoutAccounts().catch(console.error);
```

### Executar:

```bash
cd backend && npx ts-node scripts/fix-groups-without-accounts.ts
```

---

## TAREFA 3: EXIBIR IMPACTO NO FEED (grupo.fund.received)

O evento `group.fund.received` já é emitido em `split.service.ts` linha 240.

### Criar executor para auto-post:

Arquivo: `backend/src/core/orchestrator/executors/group-impact.executors.ts`

```typescript
// Executor: Criar post automático quando grupo recebe split

import { eventBus } from '@core/events/event-bus';
import { feedService } from '@core/feed/feed.service';
import { devLog } from '@utils/devLog';

interface GroupFundReceivedPayload {
  groupId: string;
  accountId: string;
  amount: number;
  source: string;
  transactionId: string;
}

async function handleGroupFundReceived(
  tenantId: string,
  payload: GroupFundReceivedPayload
) {
  const { groupId, amount, source, transactionId } = payload;
  
  devLog.info('group.impact.received', {
    groupId,
    amount,
    source,
    transactionId,
  });
  
  // Buscar nome do grupo
  const { runQueryWithTenant } = await import('@core/database/pool');
  const group = await runQueryWithTenant<{ name: string; actor_id?: string }>(
    tenantId,
    `SELECT name, actor_id FROM groups WHERE group_id = $1`,
    [groupId]
  );
  
  if (!group) {
    devLog.warn('group.impact.group_not_found', { groupId });
    return;
  }
  
  // Formatar valor
  const amountFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
  
  // Criar post automático no feed
  try {
    await feedService.createSystemPost({
      tenantId,
      actorId: group.actor_id || groupId, // Usar actor do grupo se existir
      actorType: 'group',
      intent: 'impact_received',
      content: `O grupo "${group.name}" recebeu ${amountFormatted} de impacto econômico! 🎉`,
      metadata: {
        type: 'group_impact',
        groupId,
        amount,
        source,
        transactionId,
      },
    });
    
    devLog.success('group.impact.post_created', {
      groupId,
      groupName: group.name,
      amount,
    });
  } catch (err) {
    devLog.error('group.impact.post_failed', {
      groupId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Registrar listener
eventBus.subscribe('group.fund.received', async (event) => {
  await handleGroupFundReceived(
    event.tenantId,
    event.payload as GroupFundReceivedPayload
  );
});

export { handleGroupFundReceived };
```

### Registrar executor no bootstrap:

Arquivo: `backend/src/core/orchestrator/index.ts` (ou similar)

```typescript
import './executors/group-impact.executors';
```

---

## TAREFA 4: ENDPOINT DE SALDO DO GRUPO

Arquivo: `backend/src/modules/groups/groups.routes.ts`

### ADICIONAR rota:

```typescript
// GET /groups/:groupId/balance
fastify.get<{
  Params: { groupId: string };
}>('/:groupId/balance', async (req, reply) => {
  const { groupId } = req.params;
  const tenantId = req.tenant?.id;
  
  if (!tenantId) {
    return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
  }
  
  // Verificar se usuário é membro do grupo
  const membership = await groupsRepository.getMembership(tenantId, groupId, req.user.userId);
  if (!membership) {
    return reply.status(403).send({ ok: false, message: 'Você não é membro deste grupo' });
  }
  
  // Buscar conta e saldo
  const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
  if (!groupAccount) {
    return reply.send({ 
      ok: true, 
      data: { 
        balance: 0, 
        currency: 'BRL',
        hasAccount: false,
      } 
    });
  }
  
  const account = await accountService.getAccountById(tenantId, groupAccount.accountId);
  
  return reply.send({
    ok: true,
    data: {
      balance: account?.balance || 0,
      currency: account?.currency || 'BRL',
      accountId: groupAccount.accountId,
      hasAccount: true,
    },
  });
});
```

---

## TAREFA 5: HISTÓRICO DE IMPACTO DO GRUPO

Arquivo: `backend/src/modules/groups/groups.routes.ts`

### ADICIONAR rota:

```typescript
// GET /groups/:groupId/impact-history
fastify.get<{
  Params: { groupId: string };
  Querystring: { limit?: number; offset?: number };
}>('/:groupId/impact-history', async (req, reply) => {
  const { groupId } = req.params;
  const { limit = 20, offset = 0 } = req.query;
  const tenantId = req.tenant?.id;
  
  if (!tenantId) {
    return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
  }
  
  // Verificar membership
  const membership = await groupsRepository.getMembership(tenantId, groupId, req.user.userId);
  if (!membership) {
    return reply.status(403).send({ ok: false, message: 'Você não é membro deste grupo' });
  }
  
  // Buscar conta do grupo
  const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
  if (!groupAccount) {
    return reply.send({ ok: true, data: { entries: [], total: 0 } });
  }
  
  // Buscar histórico do ledger
  const entries = await runQueryWithTenant(
    tenantId,
    `
    SELECT 
      l.entry_id,
      l.amount,
      l.entry_type,
      l.created_at,
      t.metadata
    FROM ledger l
    JOIN transactions t ON t.transaction_id = l.transaction_id
    WHERE l.account_id = $1
      AND l.entry_type = 'credit'
    ORDER BY l.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [groupAccount.accountId, limit, offset]
  );
  
  // Contar total
  const countResult = await runQueryWithTenant<{ count: string }>(
    tenantId,
    `SELECT COUNT(*) as count FROM ledger WHERE account_id = $1 AND entry_type = 'credit'`,
    [groupAccount.accountId]
  );
  
  return reply.send({
    ok: true,
    data: {
      entries: entries || [],
      total: parseInt(countResult?.count || '0', 10),
    },
  });
});
```

---

## VALIDAÇÃO

### Teste 1: Criar grupo → conta criada

```sql
-- Criar grupo via API
-- Verificar se conta existe:
SELECT g.name, ga.account_id, a.balance
FROM groups g
JOIN group_accounts ga ON ga.group_id = g.group_id
JOIN accounts a ON a.account_id = ga.account_id
WHERE g.name = 'Nome do Grupo';
```

### Teste 2: Contratar serviço → grupo recebe 5%

1. Usuário membro de Grupo X contrata serviço
2. Verificar:

```sql
SELECT a.balance
FROM group_accounts ga
JOIN accounts a ON a.account_id = ga.account_id
WHERE ga.group_id = 'X';
```

3. Saldo deve ter aumentado 5% do valor do serviço

### Teste 3: Post automático no feed

1. Após transação, verificar posts:

```sql
SELECT content, metadata
FROM posts
WHERE metadata->>'type' = 'group_impact'
  AND metadata->>'groupId' = 'X'
ORDER BY created_at DESC
LIMIT 1;
```

### Teste 4: API de saldo funciona

```bash
curl -X GET /api/groups/{groupId}/balance \
  -H "Authorization: Bearer {token}"
```

---

## 🚨 NÃO FAZER

- ❌ Criar grupo sem conta econômica
- ❌ Grupo "social-only"
- ❌ Pular executor de impacto
- ❌ Usar console.log (usar devLog)
- ❌ Alterar percentuais de split

---

## CRITÉRIO DE ACEITE

- [ ] Todo grupo tem conta em `group_accounts`
- [ ] Split distribui 5% para grupos automaticamente
- [ ] Post automático quando grupo recebe impacto
- [ ] Endpoint de saldo funciona
- [ ] Endpoint de histórico funciona
- [ ] devLog em todo lugar

---

*Prompt de grupos econômicos — Claude — 02/01/2026*
