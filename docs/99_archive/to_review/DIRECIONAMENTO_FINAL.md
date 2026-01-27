# VALIDAÇÃO FINAL - Análise da Resposta do ChatGPT

**Data:** 20 de Dezembro de 2025

---

## ✅ O QUE O CHATGPT ACERTOU

### 1. Arquitetura Geral
✅ **CORRETO** - UnifyBank é o core financeiro, UnifyCard só dispara eventos, tudo passa pelo ledger.

### 2. Checkout
✅ **CORRETO** - Frontend não calcula valor, backend cria PENDING → ACTIVE, atomicidade garantida.

### 3. Split de Eventos
✅ **CORRETO** - 70% vai para organizador, EVENT_ORGANIZER é usado em vez de WORKER.

### 4. Feed Social
✅ **CORRETO** - Read-only, zero risco financeiro.

### 5. Pontos Críticos de Hardening
✅ **CORRETO** - Falta teste automatizado e idempotência.

---

## ⚠️ O QUE O CHATGPT ERROU OU SIMPLIFICOU DEMAIS

### 1. AGENDA - Funcionário NÃO tem agenda própria

**ChatGPT disse:**
> "Cada entidade tem a sua: Usuário, Empresa, **Funcionário**, Serviço, Evento"

**REALIDADE (código):**
```sql
-- migration 032_schedule_universal.sql
CONSTRAINT schedules_owner_check CHECK (
  (global_user_id IS NOT NULL)::int + 
  (company_id IS NOT NULL)::int + 
  (service_id IS NOT NULL)::int = 1
)
```

**A tabela `schedules` só suporta 3 tipos de owner:**
- `global_user_id` (usuário)
- `company_id` (empresa)
- `service_id` (serviço)

**Funcionário NÃO tem agenda própria.** O campo `can_manage_schedule` na tabela `company_employees` é apenas uma **permissão** para gerenciar a agenda da empresa, não uma agenda separada.

**Impacto:** Nenhum. O sistema está correto, o ChatGPT que explicou errado.

---

### 2. EVENTO TEM DOIS SISTEMAS DE ORGANIZADOR (Inconsistência)

**ChatGPT disse:**
> "70% vai para o ORGANIZADOR: Empresa (`created_by_company_id`) ou Usuário (`created_by_global_user_id`)"

**REALIDADE (código):**

Existem **DOIS** sistemas de organizador coexistindo:

| Sistema | Migration | Campos | Usado no Split? |
|---------|-----------|--------|-----------------|
| Event Organizers | 027 | `organizer_id` → `event_organizers` | ❌ NÃO |
| Created By | 068 | `created_by_company_id`, `created_by_global_user_id` | ✅ SIM |

O `EventOrganizerResolver` usa **apenas** `created_by_*`:
```typescript
// EventOrganizerResolver.ts
SELECT id, created_by_company_id, created_by_global_user_id
FROM events WHERE id = $1
```

**E ignora completamente:**
- A tabela `event_organizers`
- O campo `organizer_id` na tabela `events`
- O módulo `modules/events/organizers/`

**Isso é uma INCONSISTÊNCIA ARQUITETURAL:**
- Existe um módulo inteiro de organizadores (`/modules/events/organizers/`)
- Mas o split usa campos diferentes (`created_by_*`)

**Impacto:** Para o MVP, funciona. Mas precisa ser documentado e decidido qual sistema prevalece.

---

### 3. FUNCIONÁRIOS E SPLIT

**ChatGPT disse:**
> "Funcionários NÃO recebem split direto. Empresa recebe, empresa paga funcionário."

**CORRETO**, mas incompleto. O que falta dizer:
- Não existe mecanismo implementado de repasse empresa → funcionário
- Isso é decisão de negócio, não técnica
- O sistema suporta, mas não automatiza

---

## 🎯 DIRECIONAMENTO CORRETO PARA O PROJETO

### PRIORIDADE 0 (BLOQUEADOR)

#### 1. Teste Automatizado do Split EVENT
```typescript
// backend/tests/integration/event-split.test.ts
describe('EVENT Split', () => {
  test('EVENT_TICKET → 70% para empresa organizadora', async () => {
    // Criar evento com created_by_company_id
    // Executar checkout
    // Validar ledger: 70% na conta merchant da empresa
  });

  test('EVENT_TICKET → 70% para usuário se não houver empresa', async () => {
    // Criar evento SEM created_by_company_id
    // Executar checkout
    // Validar ledger: 70% na conta do usuário criador
  });

  test('EVENT sem organizador → erro fatal', async () => {
    // Cenário impossível (created_by_global_user_id é NOT NULL)
    // Mas testar que EventOrganizerResolver lança erro se event não encontrado
  });
});
```

#### 2. Idempotência no Checkout
```typescript
// Adicionar ao CheckoutRequest
interface CheckoutContext {
  // ... campos existentes
  idempotencyKey?: string; // NOVO
}

// Migration 072
ALTER TABLE event_tickets 
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_tickets_idempotency 
  ON event_tickets(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
```

### PRIORIDADE 1 (IMPORTANTE)

#### 3. Decidir Sistema de Organizador
**Opção A:** Usar apenas `created_by_*` (atual)
- Simples
- Funciona para MVP
- Limita a 1 organizador por evento

**Opção B:** Usar `event_organizers`
- Mais complexo
- Suporta múltiplos membros por organizador
- Requer refatorar `EventOrganizerResolver`

**Recomendação:** Manter Opção A para MVP, documentar que Opção B existe para futuro.

#### 4. Índice para `created_by_company_id`
```sql
-- Migration 072
CREATE INDEX IF NOT EXISTS idx_events_created_by_company 
  ON events(created_by_company_id) 
  WHERE created_by_company_id IS NOT NULL;
```

### PRIORIDADE 2 (NICE-TO-HAVE)

- Log específico EVENT_ORGANIZER no split
- Checklist pós-deploy
- Documentação dos dois sistemas de organizador

---

## 📋 PROMPT 6 RECOMENDADO

```
PROMPT 6 - HARDENING FINAL (Eventos)

CONTEXTO:
- Split de eventos implementado e funcionando
- 70% vai para created_by_company_id ou created_by_global_user_id
- Falta teste automatizado e idempotência

TAREFAS OBRIGATÓRIAS:

1. CRIAR TESTE: backend/tests/integration/event-split.test.ts
   - Testar EVENT_TICKET com empresa → 70% empresa
   - Testar EVENT_TICKET com usuário → 70% usuário
   - Testar EVENT_CONSUMPTION com empresa → 70% empresa
   - Validar ledger_entries após cada checkout

2. ADICIONAR IDEMPOTÊNCIA:
   - Novo campo idempotency_key em CheckoutContext
   - Migration 072: ADD COLUMN idempotency_key + UNIQUE INDEX
   - ON CONFLICT retornar ticket/consumption existente
   - Usar pattern já existente em social-ledger.service.ts

3. CRIAR ÍNDICE:
   - Migration 072: idx_events_created_by_company

TAREFAS OPCIONAIS:
- Log EVENT_SPLIT_APPLIED no splitLoggerService

NÃO FAZER:
- Não mexer na arquitetura
- Não mexer no EventOrganizerResolver (funciona)
- Não adicionar constraints (created_by_global_user_id já é NOT NULL)
```

---

## ✅ CONCLUSÃO

| Aspecto | ChatGPT | Minha Validação |
|---------|---------|-----------------|
| Arquitetura fechada | ✅ | ✅ Confirmado |
| Split correto | ✅ | ✅ Confirmado |
| Falta teste | ✅ | ✅ Confirmado |
| Falta idempotência | ✅ | ✅ Confirmado |
| Funcionário tem agenda | ❌ | ❌ **NÃO TEM** |
| Sistema de organizador | Simplificou | ⚠️ **Existem 2 sistemas** |

**O ChatGPT deu um resumo útil, mas simplificou demais alguns pontos. O direcionamento está correto: foco em testes + idempotência.**

O sistema está pronto para MVP. Resolve esses 2 pontos e segue para frontend/polish.
