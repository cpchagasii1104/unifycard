# Relatório: Bloqueio por Débito Pendente
## CONTRATO v1.4/Fase10 - Implementação Completa

**Data:** 2024  
**Objetivo:** Fechar gap de segurança: "débito pendente bloqueia o actor automaticamente" + SLA de cobrança

---

## ✅ IMPLEMENTAÇÃO COMPLETA

### PASSO 1 — ENFORCEMENT: Dívida bloqueia ações críticas

#### 1.1 Verificação de débitos pendentes

**Arquivo:** `backend/src/core/reputation/penalty.service.ts`

**Método adicionado:**
```typescript
async hasPendingDebts(
  tenantId: string,
  actorId: string,
  actorType: 'user' | 'page' | 'group'
): Promise<{ hasDebt: boolean; totalAmountCents?: number }>
```

**Funcionalidade:**
- Verifica se actor tem débitos com `status = 'PENDING'`
- Retorna total em centavos se houver débito
- Usado em `canPerformAction()` e nas rotas

#### 1.2 Integração no fluxo de autorização

**Arquivo:** `backend/src/core/reputation/penalty.service.ts`

**Método atualizado:** `canPerformAction()`

**Ações bloqueadas:**
- `CREATE_EVENT` — Criar evento
- `PURCHASE` — Comprar ingresso

**Mensagem de erro padrão:**
```
"Conta bloqueada: débito pendente (R$X.XX). Quite para continuar."
```

#### 1.3 Integração nas rotas

**Arquivo:** `backend/src/core/events/event.routes.ts`

**Endpoints bloqueados:**
- `POST /events/:id/publish` — Publicar evento
- `POST /events/:id/checkout` — Checkout de ingresso

**Resposta HTTP:** `403 Forbidden`

**Exemplo de resposta:**
```json
{
  "error": "Conta bloqueada: débito pendente (R$50.00). Quite para continuar."
}
```

---

### PASSO 2 — SLA do débito + escalação

#### 2.1 Migration: Adicionar `due_at`

**Arquivo:** `backend/migrations/097_actor_debts_due_at.sql`

**Alterações:**
- Adiciona coluna `due_at TIMESTAMPTZ NOT NULL`
- Default: `created_at + INTERVAL '7 days'`
- Índice para queries de débitos vencidos: `idx_actor_debts_due_at`

**Comando para executar:**
```bash
npm run migrate
```

#### 2.2 Job de escalação diária

**Arquivo:** `backend/src/jobs/event-scheduler.ts`

**Método adicionado:** `dailyDebtEscalationJob()`

**Funcionalidade:**
1. Busca débitos vencidos (`status = 'PENDING' AND now() > due_at`)
2. Aplica penalty de score: `-20` pontos
3. Bloqueio automático via `hasPendingDebts()` (já implementado)

**Execução manual:**
```bash
npx ts-node scripts/run-scheduler-manual.ts dailyDebtEscalationJob
```

**Agendamento recomendado:** Diariamente (cron)

#### 2.3 Atualização do método existente

**Arquivo:** `backend/src/jobs/event-scheduler.ts`

**Método atualizado:** `processOverdueDebts()`

**Mudança:**
- Antes: `created_at < now() - INTERVAL '7 days'`
- Agora: `due_at < now()`

---

### PASSO 3 — Ligação com responsabilização

#### 3.1 Atualização do `createDebt`

**Arquivo:** `backend/src/core/events/responsibility.service.ts`

**Mudanças:**
- Inclui `due_at` no INSERT (padrão: `now() + INTERVAL '7 days'`)
- Metadata completa:
  ```typescript
  {
    source_event_id: eventId,
    reason_code: reason,
    caused_by_actor_id: debtorActorId,
    ...metadata
  }
  ```

**Campos incluídos:**
- `due_at` — Data de vencimento (SLA: 7 dias)
- `metadata` — Rastreabilidade completa

---

### PASSO 4 — Testes e documentação

#### 4.1 Testes unitários

**Arquivo:** `backend/src/core/reputation/__tests__/debt-blocking.test.ts`

**Cenários cobertos:**
1. ✅ Actor sem débito pode realizar ações
2. ✅ Actor com débito PENDING não consegue CREATE_EVENT
3. ✅ Actor com débito PENDING não consegue PURCHASE
4. ✅ Actor com débito PAID pode realizar ações

**Executar testes:**
```bash
npm test -- debt-blocking.test.ts
```

#### 4.2 Documentação

**Arquivo:** `backend/src/core/events/RELATORIO_DEBT_BLOCKING.md` (este arquivo)

---

## 📋 RESUMO DE ARQUIVOS MODIFICADOS

### Novos arquivos
1. `backend/migrations/097_actor_debts_due_at.sql` — Migration para `due_at`
2. `backend/src/core/reputation/__tests__/debt-blocking.test.ts` — Testes
3. `backend/src/core/events/RELATORIO_DEBT_BLOCKING.md` — Documentação

### Arquivos modificados
1. `backend/src/core/reputation/penalty.service.ts`
   - Adicionado: `hasPendingDebts()`
   - Atualizado: `canPerformAction()` — verifica débitos

2. `backend/src/core/events/event.routes.ts`
   - Atualizado: `POST /events/:id/publish` — verifica débitos
   - Atualizado: `POST /events/:id/checkout` — verifica débitos

3. `backend/src/core/events/responsibility.service.ts`
   - Atualizado: `createDebt()` — inclui `due_at` e metadata

4. `backend/src/jobs/event-scheduler.ts`
   - Atualizado: `processOverdueDebts()` — usa `due_at`
   - Adicionado: `dailyDebtEscalationJob()`

5. `backend/scripts/run-scheduler-manual.ts`
   - Adicionado: comando `dailyDebtEscalationJob`

---

## 🔍 CHECK FINAL

### Validações necessárias

#### 1. Migrations
```bash
npm run migrate
```
✅ Migration `097_actor_debts_due_at.sql` deve executar sem erros

#### 2. Testes
```bash
npm test -- debt-blocking.test.ts
```
✅ Todos os testes devem passar

#### 3. Teste manual: Actor com débito não consegue operar

**Cenário:**
1. Criar débito pendente para um actor
2. Tentar publicar evento → deve retornar 403
3. Tentar checkout → deve retornar 403
4. Quitar débito (status = 'PAID')
5. Tentar publicar evento → deve funcionar

**Script SQL para teste:**
```sql
-- Criar débito pendente
INSERT INTO actor_debts (
  tenant_id, event_id, debtor_actor_id, debtor_actor_type,
  creditor_actor_id, creditor_actor_type, amount_cents, reason, status,
  guarantor_actor_id, guarantor_actor_type, due_at
)
VALUES (
  '<tenant_id>', '<event_id>', '<actor_id>', 'user',
  '<actor_id>', 'user', 5000, 'CANCELLATION', 'PENDING',
  '<actor_id>', 'user', now() + INTERVAL '7 days'
);

-- Verificar bloqueio (via API)
-- POST /events/:id/publish → 403
-- POST /events/:id/checkout → 403

-- Quitar débito
UPDATE actor_debts
SET status = 'PAID', paid_at = now()
WHERE debtor_actor_id = '<actor_id>' AND status = 'PENDING';

-- Verificar desbloqueio (via API)
-- POST /events/:id/publish → 200
-- POST /events/:id/checkout → 200
```

#### 4. Job de escalação
```bash
npx ts-node scripts/run-scheduler-manual.ts dailyDebtEscalationJob
```
✅ Deve aplicar penalty de -20 para débitos vencidos

---

## 📊 ENDPOINTS BLOQUEADOS

| Endpoint | Método | Bloqueio |
|----------|--------|----------|
| `/events` | POST | ✅ Se débito PENDING |
| `/events/:id/publish` | POST | ✅ Se débito PENDING |
| `/events/:id/checkout` | POST | ✅ Se débito PENDING |

**Mensagem de erro padrão:**
```
"Conta bloqueada: débito pendente (R$X.XX). Quite para continuar."
```

**HTTP Status:** `403 Forbidden`

---

## ⏰ SLA DE COBRANÇA

### Regras

1. **Criação de débito:**
   - `due_at = created_at + 7 dias` (padrão)

2. **Débito vencido (now() > due_at):**
   - Penalty de score: `-20` pontos
   - Bloqueio automático (via `hasPendingDebts()`)

3. **Job de escalação:**
   - Executa diariamente
   - Aplica penalty para todos os débitos vencidos

4. **Transferência para organizador:**
   - Após 7 dias (via `processOverdueDebts()`)
   - Status muda para `TRANSFERRED_TO_ORGANIZER`

---

## 🚀 PRÓXIMOS PASSOS

### Configuração de Cron Jobs

**Recomendação:** Configurar agendamento para:
- `dailyDebtEscalationJob()` — Diariamente (ex: 00:00 UTC)
- `processOverdueDebts()` — Diariamente (ex: 01:00 UTC)

**Exemplo (cron):**
```bash
0 0 * * * npx ts-node scripts/run-scheduler-manual.ts dailyDebtEscalationJob
0 1 * * * npx ts-node scripts/run-scheduler-manual.ts processOverdueDebts
```

---

## ✅ CONCLUSÃO

**Gap de segurança fechado:**
- ✅ Débito pendente bloqueia ações críticas automaticamente
- ✅ SLA de 7 dias implementado
- ✅ Escalação automática (penalty + bloqueio)
- ✅ Testes cobrindo cenários principais
- ✅ Documentação completa

**Sistema pronto para produção após:**
1. Executar migration `097_actor_debts_due_at.sql`
2. Configurar cron jobs para escalação diária
3. Validar testes em ambiente dev

---

**Status:** ✅ IMPLEMENTAÇÃO COMPLETA














